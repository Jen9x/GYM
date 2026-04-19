// Centralized plan definitions
export const PLANS = [
  { label: '1 Month', value: '1 Month', months: 1 },
  { label: '2 Months', value: '2 Months', months: 2 },
  { label: '3 Months', value: '3 Months', months: 3 },
  { label: '4 Months', value: '4 Months', months: 4 },
  { label: '6 Months', value: '6 Months', months: 6 },
  { label: '1 Year', value: '1 Year', months: 12 },
];

// Default prices (used if nothing saved in localStorage)
export const DEFAULT_PRICES = {
  '1 Month': 1500,
  '2 Months': 2800,
  '3 Months': 4000,
  '4 Months': 5000,
  '6 Months': 7000,
  '1 Year': 12000,
};

const STORAGE_KEY = 'gym_plan_prices';

export function getPlanPrices() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_PRICES, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load plan prices:', e);
  }
  return { ...DEFAULT_PRICES };
}

export function savePlanPrices(prices) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prices));
  } catch (e) {
    console.error('Failed to save plan prices:', e);
  }
}

export function getPlanMonths(planValue) {
  const plan = PLANS.find((p) => p.value === planValue);
  return plan ? plan.months : 1;
}
