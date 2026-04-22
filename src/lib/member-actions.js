import { addBsMonths, bsDateToAdIso, formatBsDate, toLocalISODate } from './nepali-date';
import { getPlanMonths } from './plans';
import { addPayment } from './payments';
import { addMember, deleteMember, updateMember } from './members';

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
    start_date: member.start_date,
    end_date: member.end_date,
    status: member.status,
    payment_status: member.payment_status,
    notes: member.notes,
  };
}

export async function createMemberWithInitialPayment(memberData) {
  const { paid_amount: paidAmountRaw = 0, ...memberPayload } = memberData;
  const amount = Number(memberPayload.amount) || 0;
  const paidAmount = Number(paidAmountRaw) || 0;
  const resolvedPaymentStatus = resolvePaymentStatus(amount, paidAmount);

  const member = await addMember({
    ...memberPayload,
    payment_status: resolvedPaymentStatus,
  });

  if (paidAmount <= 0) {
    return { member, paymentResult: null };
  }

  try {
    const paymentResult = await addPayment({
      member_id: member.id,
      amount: paidAmount,
      payment_date: memberPayload.start_date,
      payment_method: 'cash',
      notes: `${resolvedPaymentStatus === 'partial' ? 'Initial partial payment' : 'Initial payment'} for ${memberPayload.plan} plan`,
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
    const paymentResult = await addPayment({
      member_id: existingMember.id,
      amount: additionalPayment,
      payment_date: toLocalISODate(new Date()),
      payment_method: 'cash',
      notes: `Payment recorded while updating ${memberPayload.plan} plan`,
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
  const todayBs = formatBsDate(new Date());
  const nextEndBs = addBsMonths(todayBs, getPlanMonths(member.plan));
  const startDate = bsDateToAdIso(todayBs);
  const endDate = bsDateToAdIso(nextEndBs);

  if (!startDate || !endDate) {
    throw new Error('Could not calculate the renewal dates. Please try again.');
  }

  const rollbackPayload = getRollbackPayload(member);

  await updateMember(member.id, {
    start_date: startDate,
    end_date: endDate,
    status: 'active',
    payment_status: 'unpaid',
  });

  try {
    const paymentResult = await addPayment({
      member_id: member.id,
      amount: member.amount,
      payment_date: startDate,
      payment_method: 'cash',
      notes: `Renewal - ${member.plan} plan`,
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
