function toSafeAmount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function hasPersonalTraining(member) {
  return Boolean(
    member?.personal_training_enabled
      || member?.personal_training_plan
      || toSafeAmount(member?.personal_training_amount) > 0
  );
}

export function getPersonalTrainingAmount(member) {
  return hasPersonalTraining(member) ? toSafeAmount(member?.personal_training_amount) : 0;
}

export function getSubscriptionAmount(member) {
  const totalAmount = Number(member?.amount);
  const ptAmount = getPersonalTrainingAmount(member);

  if (member?.subscription_amount !== null && member?.subscription_amount !== undefined && member?.subscription_amount !== '') {
    const explicitAmount = Number(member.subscription_amount);

    if (Number.isFinite(explicitAmount) && explicitAmount > 0) {
      return explicitAmount;
    }
  }

  if (Number.isFinite(totalAmount) && totalAmount >= 0) {
    return Math.max(0, totalAmount - ptAmount);
  }

  return 0;
}

export function getTotalMemberAmount(member) {
  if (member?.amount !== null && member?.amount !== undefined && member?.amount !== '') {
    const storedAmount = Number(member.amount);

    if (Number.isFinite(storedAmount) && storedAmount > 0) {
      return storedAmount;
    }
  }

  return getSubscriptionAmount(member) + getPersonalTrainingAmount(member);
}

export function getMemberPackageLabel(member) {
  const subscriptionPlan = member?.plan || '1 Month';

  if (!hasPersonalTraining(member)) {
    return subscriptionPlan;
  }

  const personalTrainingPlan = member?.personal_training_plan || 'Custom PT';
  return `${subscriptionPlan} + PT (${personalTrainingPlan})`;
}
