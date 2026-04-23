export const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  esewa: 'eSewa',
  khalti: 'Khalti',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
};

export const PAYMENT_METHOD_OPTIONS = Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function getPaymentMethodLabel(method) {
  return PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS.cash;
}
