import { supabase } from './supabase';

export const PLANS = [
  { label: '1 Month', value: '1 Month', months: 1 },
  { label: '2 Months', value: '2 Months', months: 2 },
  { label: '3 Months', value: '3 Months', months: 3 },
  { label: '4 Months', value: '4 Months', months: 4 },
  { label: '6 Months', value: '6 Months', months: 6 },
  { label: '1 Year', value: '1 Year', months: 12 },
];

export const PERSONAL_TRAINER_PLANS = [
  { label: '1 Month', value: '1 Month', months: 1 },
  { label: '3 Months', value: '3 Months', months: 3 },
  { label: '6 Months', value: '6 Months', months: 6 },
  { label: '1 Year', value: '1 Year', months: 12 },
];

export const DEFAULT_PRICES = {
  '1 Month': 1500,
  '2 Months': 2800,
  '3 Months': 4000,
  '4 Months': 5000,
  '6 Months': 7000,
  '1 Year': 12000,
};

export const DEFAULT_PERSONAL_TRAINER_PRICES = {
  '1 Month': 0,
  '3 Months': 0,
  '6 Months': 0,
  '1 Year': 0,
};

const PRICE_CONFIGS = {
  subscription: {
    defaults: DEFAULT_PRICES,
    storageKey: 'gym_plan_prices',
    settingKey: 'plan_prices',
    signedOutSaveError: 'You must be signed in to save subscription prices.',
    missingTableHelp: 'Shared settings table is missing in Supabase. Run supabase_app_settings_setup.sql, then try saving subscription prices again.',
  },
  personalTrainer: {
    defaults: DEFAULT_PERSONAL_TRAINER_PRICES,
    storageKey: 'gym_personal_trainer_prices',
    settingKey: 'personal_trainer_plan_prices',
    signedOutSaveError: 'You must be signed in to save personal trainer prices.',
    missingTableHelp: 'Shared settings table is missing in Supabase. Run supabase_app_settings_setup.sql, then try saving personal trainer prices again.',
  },
};

function resolvePricingErrorMessage(error, config) {
  const message = error?.message || '';

  if (/app_settings|schema cache/i.test(message)) {
    return config.missingTableHelp;
  }

  return message || 'Failed to save prices to the shared settings store. Run the latest Supabase setup script if needed.';
}

function normalizePrices(prices = {}, defaults = {}) {
  const merged = { ...defaults };

  Object.keys(defaults).forEach((planKey) => {
    const nextValue = Number.parseInt(prices?.[planKey], 10);
    merged[planKey] = Number.isFinite(nextValue) && nextValue >= 0
      ? nextValue
      : defaults[planKey];
  });

  return merged;
}

function readLocalPrices(config) {
  try {
    const saved = localStorage.getItem(config.storageKey);
    if (saved) {
      return normalizePrices(JSON.parse(saved), config.defaults);
    }
  } catch (error) {
    console.error('Failed to load plan prices from local storage:', error);
  }

  return normalizePrices({}, config.defaults);
}

function writeLocalPrices(prices, config) {
  const normalized = normalizePrices(prices, config.defaults);

  try {
    localStorage.setItem(config.storageKey, JSON.stringify(normalized));
  } catch (error) {
    throw new Error('Could not save prices in this browser. Check storage permissions and try again.');
  }

  return normalized;
}

async function loadPrices(config) {
  const localPrices = readLocalPrices(config);

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) return localPrices;

    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('user_id', user.id)
      .eq('setting_key', config.settingKey)
      .maybeSingle();

    if (error) throw error;
    if (!data?.setting_value) return localPrices;

    const remotePrices = normalizePrices(data.setting_value, config.defaults);
    writeLocalPrices(remotePrices, config);
    return remotePrices;
  } catch (error) {
    console.warn('Falling back to locally cached plan prices:', error);
    return localPrices;
  }
}

async function savePrices(prices, config) {
  const normalized = normalizePrices(prices, config.defaults);
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) {
    throw new Error(config.signedOutSaveError);
  }

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      [{
        user_id: user.id,
        setting_key: config.settingKey,
        setting_value: normalized,
      }],
      {
        onConflict: 'user_id,setting_key',
      }
    );

  if (error) {
    throw new Error(resolvePricingErrorMessage(error, config));
  }

  writeLocalPrices(normalized, config);
  return normalized;
}

export function getPlanPrices() {
  return readLocalPrices(PRICE_CONFIGS.subscription);
}

export async function loadPlanPrices() {
  return loadPrices(PRICE_CONFIGS.subscription);
}

export async function savePlanPrices(prices) {
  return savePrices(prices, PRICE_CONFIGS.subscription);
}

export function getPersonalTrainerPrices() {
  return readLocalPrices(PRICE_CONFIGS.personalTrainer);
}

export async function loadPersonalTrainerPrices() {
  return loadPrices(PRICE_CONFIGS.personalTrainer);
}

export async function savePersonalTrainerPrices(prices) {
  return savePrices(prices, PRICE_CONFIGS.personalTrainer);
}

export function getPlanMonths(planValue) {
  const plan = PLANS.find((entry) => entry.value === planValue);
  return plan ? plan.months : 1;
}

export function getPersonalTrainerPlanMonths(planValue) {
  const plan = PERSONAL_TRAINER_PLANS.find((entry) => entry.value === planValue);
  return plan ? plan.months : 1;
}

export function getEligiblePersonalTrainerPlans(subscriptionPlanValue) {
  const subscriptionMonths = getPlanMonths(subscriptionPlanValue);
  return PERSONAL_TRAINER_PLANS.filter((entry) => entry.months <= subscriptionMonths);
}

export function isPersonalTrainerPlanAllowed(subscriptionPlanValue, personalTrainerPlanValue) {
  if (!personalTrainerPlanValue) return true;
  return getPersonalTrainerPlanMonths(personalTrainerPlanValue) <= getPlanMonths(subscriptionPlanValue);
}

export function getResolvedPersonalTrainerPlan(subscriptionPlanValue, preferredPlanValue) {
  const eligiblePlans = getEligiblePersonalTrainerPlans(subscriptionPlanValue);

  if (eligiblePlans.length === 0) {
    return PERSONAL_TRAINER_PLANS[0]?.value || '1 Month';
  }

  if (eligiblePlans.some((entry) => entry.value === preferredPlanValue)) {
    return preferredPlanValue;
  }

  return eligiblePlans[eligiblePlans.length - 1].value;
}
