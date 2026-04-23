import { addBsMonths, bsDateToAdIso, formatBsDate, startOfLocalDay, toLocalISODate } from './nepali-date';
import { getPersonalTrainerPlanMonths, getPlanMonths, isPersonalTrainerPlanAllowed } from './plans';
import { getMemberPackageLabel, getTotalMemberAmount, hasPersonalTraining } from './member-package';
import { addPayment } from './payments';
import { addMember, deleteMember, getComputedMembershipStatus, updateMember } from './members';

function resolvePaymentStatus(amount, paidAmount) {
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount >= amount) return 'paid';
  return 'partial';
}

function getRollbackPayload(member) {
  return {
    name: member.name,
    phone: member.phone,
    email: member.email,
    plan: member.plan,
    amount: member.amount,
    subscription_amount: member.subscription_amount,
    start_date: member.start_date,
    end_date: member.end_date,
    status: member.status,
    payment_status: member.payment_status,
    personal_training_enabled: member.personal_training_enabled,
    personal_training_plan: member.personal_training_plan,
    personal_training_amount: member.personal_training_amount,
    personal_training_start_date: member.personal_training_start_date,
    personal_training_end_date: member.personal_training_end_date,
    notes: member.notes,
  };
}

function assertValidPersonalTrainerSetup(memberLike, errorPrefix = 'Personal trainer package') {
  if (!hasPersonalTraining(memberLike)) return;

  if (!memberLike?.personal_training_plan) {
    throw new Error(`${errorPrefix} is missing a PT plan.`);
  }

  if (!isPersonalTrainerPlanAllowed(memberLike.plan, memberLike.personal_training_plan)) {
    throw new Error(`${errorPrefix} cannot be longer than the main membership plan.`);
  }

  const membershipEndDate = startOfLocalDay(memberLike?.end_date);
  const personalTrainingEndDate = startOfLocalDay(memberLike?.personal_training_end_date);

  if (membershipEndDate && personalTrainingEndDate && personalTrainingEndDate > membershipEndDate) {
    throw new Error(`${errorPrefix} cannot end after the main membership ends.`);
  }
}

export async function createMemberWithInitialPayment(memberData) {
  const { paid_amount: paidAmountRaw = 0, ...memberPayload } = memberData;
  const amount = Number(memberPayload.amount) || 0;
  const paidAmount = Number(paidAmountRaw) || 0;
  const resolvedPaymentStatus = resolvePaymentStatus(amount, paidAmount);

  assertValidPersonalTrainerSetup(memberPayload, 'PT package');

  const member = await addMember({
    ...memberPayload,
    payment_status: resolvedPaymentStatus,
  });

  if (paidAmount <= 0) {
    return { member, paymentResult: null };
  }

  try {
    const packageLabel = getMemberPackageLabel(memberPayload);
    const paymentResult = await addPayment({
      member_id: member.id,
      amount: paidAmount,
      payment_date: memberPayload.start_date,
      payment_method: 'cash',
      notes: `${resolvedPaymentStatus === 'partial' ? 'Initial partial payment' : 'Initial payment'} for ${packageLabel}`,
    });

    return { member, paymentResult };
  } catch (error) {
    let rollbackFailed = false;

    try {
      await deleteMember(member.id);
    } catch (rollbackError) {
      rollbackFailed = true;
      console.error('Failed to roll back member after payment error:', rollbackError);
    }

    if (rollbackFailed) {
      throw new Error(
        `The member payment could not be recorded, and the member rollback also failed. ${error.message || ''}`.trim()
      );
    }

    throw new Error(
      `Initial payment could not be recorded, so the member was not saved. ${error.message || ''}`.trim()
    );
  }
}

export async function updateMemberWithPaymentAdjustment(existingMember, memberData) {
  const { paid_amount: paidAmountRaw = 0, ...memberPayload } = memberData;
  const amount = Number(memberPayload.amount) || 0;
  const targetPaidAmount = Number(paidAmountRaw) || 0;
  const existingPaidAmount = Number(existingMember?.paid_this_period) || 0;

  assertValidPersonalTrainerSetup(memberPayload, 'PT package');

  if (targetPaidAmount < existingPaidAmount) {
    throw new Error('Paid amount cannot be lower than the payments already recorded. Use the Payments section for corrections.');
  }

  const additionalPayment = targetPaidAmount - existingPaidAmount;
  const interimPaymentStatus = resolvePaymentStatus(amount, existingPaidAmount);
  const finalPaymentStatus = resolvePaymentStatus(amount, targetPaidAmount);
  const rollbackPayload = getRollbackPayload(existingMember);

  await updateMember(existingMember.id, {
    ...memberPayload,
    payment_status: additionalPayment > 0 ? interimPaymentStatus : finalPaymentStatus,
  });

  if (additionalPayment <= 0) {
    return { paymentResult: null };
  }

  try {
    const packageLabel = getMemberPackageLabel(memberPayload);
    const paymentResult = await addPayment({
      member_id: existingMember.id,
      amount: additionalPayment,
      payment_date: toLocalISODate(new Date()),
      payment_method: 'cash',
      notes: `Payment recorded while updating ${packageLabel}`,
    });

    return { paymentResult };
  } catch (error) {
    try {
      await updateMember(existingMember.id, rollbackPayload);
    } catch (rollbackError) {
      console.error('Failed to roll back member after update/payment mismatch:', rollbackError);
      throw new Error(
        `The payment could not be recorded, and restoring the previous member details also failed. ${error.message || ''}`.trim()
      );
    }

    throw new Error(
      `The payment could not be recorded, so the member changes were rolled back. ${error.message || ''}`.trim()
    );
  }
}

export async function renewMemberMembership(member) {
  if (getComputedMembershipStatus(member) !== 'expired') {
    throw new Error('Only expired memberships can be renewed.');
  }

  assertValidPersonalTrainerSetup(member, 'Saved PT package');

  const todayBs = formatBsDate(new Date());
  const nextEndBs = addBsMonths(todayBs, getPlanMonths(member.plan));
  const personalTrainingEnabled = hasPersonalTraining(member);
  const nextPersonalTrainingEndBs = personalTrainingEnabled
    ? addBsMonths(todayBs, getPersonalTrainerPlanMonths(member.personal_training_plan))
    : '';
  const startDate = bsDateToAdIso(todayBs);
  const endDate = bsDateToAdIso(nextEndBs);
  const personalTrainingEndDate = personalTrainingEnabled ? bsDateToAdIso(nextPersonalTrainingEndBs) : null;

  if (!startDate || !endDate) {
    throw new Error('Could not calculate the renewal dates. Please try again.');
  }

  if (personalTrainingEnabled && !personalTrainingEndDate) {
    throw new Error('Could not calculate the personal trainer renewal dates. Please try again.');
  }

  const rollbackPayload = getRollbackPayload(member);

  await updateMember(member.id, {
    start_date: startDate,
    end_date: endDate,
    status: 'active',
    payment_status: 'unpaid',
    personal_training_start_date: personalTrainingEnabled ? startDate : null,
    personal_training_end_date: personalTrainingEnabled ? personalTrainingEndDate : null,
  });

  try {
    const packageLabel = getMemberPackageLabel(member);
    const paymentResult = await addPayment({
      member_id: member.id,
      amount: getTotalMemberAmount(member),
      payment_date: startDate,
      payment_method: 'cash',
      notes: `Renewal - ${packageLabel}`,
    });

    return {
      startDate,
      endDate,
      paymentResult,
    };
  } catch (error) {
    try {
      await updateMember(member.id, rollbackPayload);
    } catch (rollbackError) {
      console.error('Failed to roll back member after renewal payment error:', rollbackError);
      throw new Error(
        `Renewal payment failed, and the previous membership dates could not be restored automatically. ${error.message || ''}`.trim()
      );
    }

    throw new Error(
      `Renewal payment failed, so the membership dates were restored. ${error.message || ''}`.trim()
    );
  }
}
