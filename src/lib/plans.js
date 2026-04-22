import { supabase } from './supabase';

export const PLANS = [
  { label: '1 Month', value: '1 Month', months: 1 },
  { label: '2 Months', value: '2 Months', months: 2 },
  { label: '3 Months', value: '3 Months', months: 3 },
  { label: '4 Months', value: '4 Months', months: 4 },
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

const STORAGE_KEY = 'gym_plan_prices';
const SETTINGS_KEY = 'plan_prices';

function normalizePlanPrices(prices = {}) {
  const merged = { ...DEFAULT_PRICES };

  Object.keys(DEFAULT_PRICES).forEach((planKey) => {
    const nextValue = Number.parseInt(prices?.[planKey], 10);
    merged[planKey] = Number.isFinite(nextValue) && nextValue >= 0
      ? nextValue
      : DEFAULT_PRICES[planKey];
  });

  return merged;
}

function readLocalPlanPrices() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return normalizePlanPrices(JSON.parse(saved));
    }
  } catch (error) {
    console.error('Failed to load plan prices from local storage:', error);
  }

  return normalizePlanPrices();
}

function writeLocalPlanPrices(prices) {
  const normalized = normalizePlanPrices(prices);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch (error) {
    throw new Error('Could not save prices in this browser. Check storage permissions and try again.');
  }

  return normalized;
}

export function getPlanPrices() {
  return readLocalPlanPrices();
}

export async function loadPlanPrices() {
  const localPrices = readLocalPlanPrices();

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) return localPrices;

    const { data, error } = await supabase
      .from('app_settings')
      .select('setting_value')
      .eq('user_id', user.id)
      .eq('setting_key', SETTINGS_KEY)
      .maybeSingle();

    if (error) throw error;
    if (!data?.setting_value) return localPrices;

    const remotePrices = normalizePlanPrices(data.setting_value);
    writeLocalPlanPrices(remotePrices);
    return remotePrices;
  } catch (error) {
    console.warn('Falling back to locally cached plan prices:', error);
    return localPrices;
  }
}

export async function savePlanPrices(prices) {
  const normalized = normalizePlanPrices(prices);
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) {
    throw new Error('You must be signed in to save subscription prices.');
  }

  const { error } = await supabase
    .from('app_settings')
    .upsert(
      [{
        user_id: user.id,
        setting_key: SETTINGS_KEY,
        setting_value: normalized,
      }],
      {
        onConflict: 'user_id,setting_key',
      }
    );

  if (error) {
    throw new Error(
      error.message || 'Failed to save prices to the shared settings store. Run the latest Supabase setup script if needed.'
    );
  }

  writeLocalPlanPrices(normalized);
  return normalized;
}

export function getPlanMonths(planValue) {
  const plan = PLANS.find((entry) => entry.value === planValue);
  return plan ? plan.months : 1;
}
