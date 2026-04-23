import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  getEligiblePersonalTrainerPlans,
  PLANS,
  getPersonalTrainerPlanMonths,
  getPersonalTrainerPrices,
  getPlanMonths,
  getPlanPrices,
  getResolvedPersonalTrainerPlan,
  isPersonalTrainerPlanAllowed,
  loadPersonalTrainerPrices,
  loadPlanPrices,
} from '../lib/plans';
import {
  addBsMonths,
  bsDateToAdIso,
  formatBsDate,
  normalizeBsDateInput,
  startOfLocalDay,
} from '../lib/nepali-date';
import {
  getPersonalTrainingAmount,
  getSubscriptionAmount,
  hasPersonalTraining,
} from '../lib/member-package';
import Calendar from '@ideabreed/nepali-datepicker-reactjs';
import '@ideabreed/nepali-datepicker-reactjs/dist/index.css';

const BS_CALENDAR_FORMAT = 'YYYY-MM-DD';
const DEFAULT_SUBSCRIPTION_PLAN = '1 Month';
const DEFAULT_PERSONAL_TRAINER_PLAN = '1 Month';

const getTodayBs = () => formatBsDate(new Date());

const initialForm = {
  name: '',
  phone: '',
  email: '',
  plan: DEFAULT_SUBSCRIPTION_PLAN,
  subscription_amount: '',
  wants_personal_trainer: false,
  personal_training_plan: DEFAULT_PERSONAL_TRAINER_PLAN,
  personal_training_amount: '',
  paid_amount: '',
  start_date: getTodayBs(),
  end_date: '',
  personal_training_end_date: '',
  payment_status: 'paid',
  notes: '',
};

function formatPriceValue(value) {
  if (value === '' || value == null) return '';
  return String(value);
}

function getAutoEndDate(startDate, plan) {
  if (!startDate) return '';
  return addBsMonths(startDate, getPlanMonths(plan));
}

function getAutoPersonalTrainingEndDate(startDate, plan) {
  if (!startDate) return '';
  return addBsMonths(startDate, getPersonalTrainerPlanMonths(plan));
}

function getClampedBsDate(dateValue, maxDateValue) {
  if (!dateValue) return '';
  if (!maxDateValue) return dateValue;
  return dateValue > maxDateValue ? maxDateValue : dateValue;
}

function getResolvedPersonalTrainingEndDate(startDate, subscriptionEndDate, plan) {
  const autoPersonalTrainingEndDate = getAutoPersonalTrainingEndDate(startDate, plan);
  return getClampedBsDate(autoPersonalTrainingEndDate, subscriptionEndDate);
}

function getFormTotalAmount(form) {
  const subscriptionAmount = Number.parseInt(form.subscription_amount, 10) || 0;
  const personalTrainingAmount = form.wants_personal_trainer
    ? Number.parseInt(form.personal_training_amount, 10) || 0
    : 0;

  return subscriptionAmount + personalTrainingAmount;
}

function syncPaymentInputs(form) {
  const updated = { ...form };
  const totalAmount = getFormTotalAmount(updated);

  if (updated.payment_status === 'paid') {
    updated.paid_amount = totalAmount ? String(totalAmount) : '';
  }

  if (updated.payment_status === 'unpaid') {
    updated.paid_amount = '';
  }

  if (updated.payment_status === 'partial' && Number(updated.paid_amount) >= Number(totalAmount || 0)) {
    updated.paid_amount = '';
  }

  return updated;
}

function buildMemberForm(editData, subscriptionPrices, personalTrainerPrices) {
  if (editData) {
    const startDate = formatBsDate(editData.start_date) || getTodayBs();
    const subscriptionPlan = editData.plan || DEFAULT_SUBSCRIPTION_PLAN;
    const endDate = formatBsDate(editData.end_date) || getAutoEndDate(startDate, subscriptionPlan);
    const personalTrainingEnabled = hasPersonalTraining(editData);
    const personalTrainingPlan = getResolvedPersonalTrainerPlan(
      subscriptionPlan,
      editData.personal_training_plan || DEFAULT_PERSONAL_TRAINER_PLAN
    );
    const personalTrainingEndDate = personalTrainingEnabled
      ? getClampedBsDate(
        formatBsDate(editData.personal_training_end_date) || getAutoPersonalTrainingEndDate(startDate, personalTrainingPlan),
        endDate
      )
      : '';
    const resolvedPaymentStatus = editData.computed_payment_status || editData.payment_status || 'paid';
    const recordedPaidAmount = Number(editData.paid_this_period);
    const subscriptionAmount = getSubscriptionAmount(editData);
    const personalTrainingAmount = personalTrainingEnabled ? getPersonalTrainingAmount(editData) : 0;
    const totalAmount = subscriptionAmount + personalTrainingAmount;

    return {
      name: editData.name || '',
      phone: editData.phone || '',
      email: editData.email || '',
      plan: subscriptionPlan,
      subscription_amount: formatPriceValue(subscriptionAmount),
      wants_personal_trainer: personalTrainingEnabled,
      personal_training_plan: personalTrainingPlan,
      personal_training_amount: personalTrainingEnabled ? formatPriceValue(personalTrainingAmount) : '',
      paid_amount: recordedPaidAmount > 0
        ? String(recordedPaidAmount)
        : resolvedPaymentStatus === 'paid' && totalAmount > 0
          ? String(totalAmount)
          : '',
      start_date: startDate,
      end_date: endDate,
      personal_training_end_date: personalTrainingEndDate,
      payment_status: resolvedPaymentStatus,
      notes: editData.notes || '',
    };
  }

  const startDate = getTodayBs();
  const defaultAmount = subscriptionPrices[DEFAULT_SUBSCRIPTION_PLAN] || '';

  return {
    ...initialForm,
    subscription_amount: formatPriceValue(defaultAmount),
    paid_amount: defaultAmount ? String(defaultAmount) : '',
    start_date: startDate,
    end_date: getAutoEndDate(startDate, DEFAULT_SUBSCRIPTION_PLAN),
    personal_training_end_date: getResolvedPersonalTrainingEndDate(
      startDate,
      getAutoEndDate(startDate, DEFAULT_SUBSCRIPTION_PLAN),
      DEFAULT_PERSONAL_TRAINER_PLAN
    ),
  };
}

export default function AddMemberModal({ onClose, onSave, editData }) {
  const [initialSubscriptionPrices] = useState(() => getPlanPrices());
  const [initialPersonalTrainerPrices] = useState(() => getPersonalTrainerPrices());
  const [subscriptionPrices, setSubscriptionPrices] = useState(initialSubscriptionPrices);
  const [personalTrainerPrices, setPersonalTrainerPrices] = useState(initialPersonalTrainerPrices);
  const [form, setForm] = useState(() => buildMemberForm(editData, initialSubscriptionPrices, initialPersonalTrainerPrices));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const subscriptionAmount = Number.parseInt(form.subscription_amount, 10) || 0;
  const personalTrainingAmount = form.wants_personal_trainer
    ? Number.parseInt(form.personal_training_amount, 10) || 0
    : 0;
  const totalAmount = subscriptionAmount + personalTrainingAmount;
  const paidAmount = Number.parseInt(form.paid_amount, 10) || 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);
  const availablePersonalTrainerPlans = getEligiblePersonalTrainerPlans(form.plan);

  useEffect(() => {
    let active = true;

    async function syncPrices() {
      const [remoteSubscriptionPrices, remotePersonalTrainerPrices] = await Promise.all([
        loadPlanPrices(),
        loadPersonalTrainerPrices(),
      ]);

      if (!active) return;

      setSubscriptionPrices(remoteSubscriptionPrices);
      setPersonalTrainerPrices(remotePersonalTrainerPrices);

      if (!editData) {
        setForm((currentForm) => {
          const nextForm = { ...currentForm };
          const currentPlan = currentForm.plan || DEFAULT_SUBSCRIPTION_PLAN;
          const currentPersonalTrainerPlan = currentForm.personal_training_plan || DEFAULT_PERSONAL_TRAINER_PLAN;
          const localSubscriptionAmount = initialSubscriptionPrices[currentPlan] || 0;
          const localPersonalTrainerAmount = initialPersonalTrainerPrices[currentPersonalTrainerPlan] || 0;
          const remoteSubscriptionAmount = remoteSubscriptionPrices[currentPlan] || 0;
          const remotePersonalTrainerAmount = remotePersonalTrainerPrices[currentPersonalTrainerPlan] || 0;
          let hasChanges = false;

          const shouldRefreshSubscriptionAmount =
            currentForm.subscription_amount === ''
            || Number(currentForm.subscription_amount) === Number(localSubscriptionAmount);

          if (shouldRefreshSubscriptionAmount) {
            nextForm.subscription_amount = formatPriceValue(remoteSubscriptionAmount);
            hasChanges = true;
          }

          if (currentForm.wants_personal_trainer) {
            const shouldRefreshPersonalTrainerAmount =
              currentForm.personal_training_amount === ''
              || Number(currentForm.personal_training_amount) === Number(localPersonalTrainerAmount);

            if (shouldRefreshPersonalTrainerAmount) {
              nextForm.personal_training_amount = formatPriceValue(remotePersonalTrainerAmount);
              hasChanges = true;
            }
          }

          return hasChanges ? syncPaymentInputs(nextForm) : currentForm;
        });
      }
    }

    syncPrices();

    return () => {
      active = false;
    };
  }, [editData, initialPersonalTrainerPrices, initialSubscriptionPrices]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleChange = (field, value) => {
    const safeValue = field.includes('date') ? normalizeBsDateInput(value) : value;

    setForm((currentForm) => {
      let updated = { ...currentForm, [field]: safeValue };

      if (field === 'plan' || field === 'start_date') {
        const startDate = field === 'start_date' ? safeValue : currentForm.start_date;
        const plan = field === 'plan' ? safeValue : currentForm.plan;

        updated.end_date = getAutoEndDate(startDate, plan);

        if (field === 'plan' && !editData) {
          updated.subscription_amount = formatPriceValue(subscriptionPrices[safeValue] || 0);
        }

        if (updated.wants_personal_trainer) {
          const resolvedPersonalTrainingPlan = getResolvedPersonalTrainerPlan(
            plan,
            updated.personal_training_plan || DEFAULT_PERSONAL_TRAINER_PLAN
          );

          if (resolvedPersonalTrainingPlan !== updated.personal_training_plan) {
            updated.personal_training_plan = resolvedPersonalTrainingPlan;
            updated.personal_training_amount = formatPriceValue(personalTrainerPrices[resolvedPersonalTrainingPlan] || 0);
          }

          updated.personal_training_end_date = getAutoPersonalTrainingEndDate(
            startDate,
            updated.personal_training_plan || DEFAULT_PERSONAL_TRAINER_PLAN
          );
          updated.personal_training_end_date = getClampedBsDate(updated.personal_training_end_date, updated.end_date);
        }
      }

      if (field === 'end_date' && updated.wants_personal_trainer) {
        updated.personal_training_end_date = getResolvedPersonalTrainingEndDate(
          currentForm.start_date,
          safeValue,
          updated.personal_training_plan || DEFAULT_PERSONAL_TRAINER_PLAN
        );
      }

      if (field === 'wants_personal_trainer') {
        if (safeValue) {
          const personalTrainingPlan = getResolvedPersonalTrainerPlan(
            currentForm.plan,
            currentForm.personal_training_plan || DEFAULT_PERSONAL_TRAINER_PLAN
          );
          updated.personal_training_plan = personalTrainingPlan;
          updated.personal_training_amount = formatPriceValue(personalTrainerPrices[personalTrainingPlan] || 0);
          updated.personal_training_end_date = getResolvedPersonalTrainingEndDate(
            currentForm.start_date,
            currentForm.end_date,
            personalTrainingPlan
          );
        } else {
          updated.personal_training_amount = '';
          updated.personal_training_end_date = '';
        }
      }

      if (field === 'personal_training_plan') {
        const resolvedPersonalTrainingPlan = getResolvedPersonalTrainerPlan(currentForm.plan, safeValue);
        updated.personal_training_end_date = getResolvedPersonalTrainingEndDate(
          currentForm.start_date,
          currentForm.end_date,
          resolvedPersonalTrainingPlan
        );
        updated.personal_training_plan = resolvedPersonalTrainingPlan;

        if (!editData) {
          updated.personal_training_amount = formatPriceValue(personalTrainerPrices[resolvedPersonalTrainingPlan] || 0);
        }
      }

      if (
        field === 'subscription_amount'
        || field === 'personal_training_amount'
        || field === 'wants_personal_trainer'
        || field === 'plan'
        || field === 'personal_training_plan'
      ) {
        updated = syncPaymentInputs(updated);
      }

      if (field === 'payment_status') {
        updated = syncPaymentInputs(updated);
      }

      return updated;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const startDate = normalizeBsDateInput(form.start_date);
      const endDate = normalizeBsDateInput(form.end_date) || getAutoEndDate(startDate || getTodayBs(), form.plan);
      const personalTrainingEndDate = form.wants_personal_trainer
        ? normalizeBsDateInput(form.personal_training_end_date)
          || getResolvedPersonalTrainingEndDate(startDate || getTodayBs(), endDate, form.personal_training_plan)
        : '';
      const adStartStr = bsDateToAdIso(startDate);
      const adEndStr = bsDateToAdIso(endDate);
      const adPersonalTrainingEndStr = form.wants_personal_trainer ? bsDateToAdIso(personalTrainingEndDate) : null;
      const membershipAmount = Number.parseInt(form.subscription_amount, 10) || 0;
      const resolvedPersonalTrainingAmount = form.wants_personal_trainer
        ? Number.parseInt(form.personal_training_amount, 10) || 0
        : 0;
      const combinedAmount = membershipAmount + resolvedPersonalTrainingAmount;

      if (!membershipAmount) {
        throw new Error('Please enter a valid subscription amount.');
      }

      if (form.wants_personal_trainer && !resolvedPersonalTrainingAmount) {
        throw new Error('Please enter a valid personal trainer amount.');
      }

      if (form.wants_personal_trainer && !isPersonalTrainerPlanAllowed(form.plan, form.personal_training_plan)) {
        throw new Error('PT plan cannot be longer than the subscription plan. Please choose a shorter PT package.');
      }

      if (!adStartStr) {
        throw new Error('Please select a valid start date.');
      }

      if (!adEndStr) {
        throw new Error('Please select a valid end date.');
      }

      if (form.wants_personal_trainer && !adPersonalTrainingEndStr) {
        throw new Error('Please select a valid personal trainer end date.');
      }

      if (
        form.wants_personal_trainer
        && startOfLocalDay(adPersonalTrainingEndStr)
        && startOfLocalDay(adEndStr)
        && startOfLocalDay(adPersonalTrainingEndStr) > startOfLocalDay(adEndStr)
      ) {
        throw new Error('PT package cannot end after the main membership. Pick a shorter PT plan or extend the membership end date.');
      }

      let resolvedPaidAmount = 0;

      if (form.payment_status === 'paid') {
        resolvedPaidAmount = combinedAmount;
      }

      if (form.payment_status === 'partial') {
        resolvedPaidAmount = Number.parseInt(form.paid_amount, 10) || 0;

        if (!resolvedPaidAmount) {
          throw new Error('Enter how much the member paid.');
        }

        if (resolvedPaidAmount >= combinedAmount) {
          throw new Error('Partial payment must be less than the full amount. Choose Paid if they paid everything.');
        }
      }

      const resolvedPaymentStatus = resolvedPaidAmount <= 0
        ? 'unpaid'
        : resolvedPaidAmount >= combinedAmount
          ? 'paid'
          : 'partial';

      const today = startOfLocalDay(new Date());
      const resolvedEndDate = startOfLocalDay(adEndStr);
      const statusResolved = today && resolvedEndDate && resolvedEndDate >= today ? 'active' : 'expired';

      const memberData = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        plan: form.plan,
        amount: combinedAmount,
        subscription_amount: membershipAmount,
        personal_training_enabled: form.wants_personal_trainer,
        personal_training_plan: form.wants_personal_trainer ? form.personal_training_plan : null,
        personal_training_amount: form.wants_personal_trainer ? resolvedPersonalTrainingAmount : 0,
        personal_training_start_date: form.wants_personal_trainer ? adStartStr : null,
        personal_training_end_date: form.wants_personal_trainer ? adPersonalTrainingEndStr : null,
        paid_amount: resolvedPaidAmount,
        start_date: adStartStr,
        end_date: adEndStr,
        status: statusResolved,
        payment_status: resolvedPaymentStatus,
        notes: form.notes.trim() || null,
      };

      await onSave(memberData);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{editData ? 'Edit Member' : 'Add New Member'}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            <div className="form-grid">
              <div className="form-group full">
                <label htmlFor="member-name">Full Name *</label>
                <input
                  id="member-name"
                  type="text"
                  className="form-input light"
                  placeholder="Enter member's full name"
                  value={form.name}
                  onChange={(event) => handleChange('name', event.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-phone">Phone Number *</label>
                <input
                  id="member-phone"
                  type="tel"
                  className="form-input light"
                  placeholder="+977 98XXXXXXXX"
                  value={form.phone}
                  onChange={(event) => handleChange('phone', event.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-email">Email (Optional)</label>
                <input
                  id="member-email"
                  type="email"
                  className="form-input light"
                  placeholder="email@example.com"
                  value={form.email}
                  onChange={(event) => handleChange('email', event.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="member-plan">Subscription Plan *</label>
                <select
                  id="member-plan"
                  className="form-select"
                  value={form.plan}
                  onChange={(event) => handleChange('plan', event.target.value)}
                >
                  {PLANS.map((plan) => (
                    <option key={plan.value} value={plan.value}>
                      {plan.label} - Rs. {(subscriptionPrices[plan.value] || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="member-subscription-amount">Subscription Amount (Rs.) *</label>
                <input
                  id="member-subscription-amount"
                  type="number"
                  className="form-input light"
                  placeholder="e.g. 1500"
                  value={form.subscription_amount}
                  onChange={(event) => handleChange('subscription_amount', event.target.value)}
                  required
                  min="0"
                />
              </div>

              <div className="form-group full">
                <label style={{ marginBottom: 8 }}>Personal Trainer</label>
                <label
                  htmlFor="member-personal-trainer-toggle"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '14px 16px',
                    borderRadius: 12,
                    border: '1px solid var(--color-card-border)',
                    background: 'var(--color-bg)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    id="member-personal-trainer-toggle"
                    type="checkbox"
                    checked={form.wants_personal_trainer}
                    onChange={(event) => handleChange('wants_personal_trainer', event.target.checked)}
                    style={{ marginTop: 4 }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                      Add personal trainer package
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
                      Track PT pricing separately and include it in the member&apos;s total bill.
                    </div>
                  </div>
                </label>
              </div>

              {form.wants_personal_trainer && (
                <>
                  <div className="form-group">
                    <label htmlFor="member-personal-trainer-plan">PT Plan *</label>
                    <select
                      id="member-personal-trainer-plan"
                      className="form-select"
                      value={form.personal_training_plan}
                      onChange={(event) => handleChange('personal_training_plan', event.target.value)}
                    >
                      {availablePersonalTrainerPlans.map((plan) => (
                        <option key={plan.value} value={plan.value}>
                          {plan.label} - Rs. {(personalTrainerPrices[plan.value] || 0).toLocaleString()}
                        </option>
                      ))}
                    </select>
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                      PT packages can only be the same length or shorter than the main membership.
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="member-personal-trainer-amount">PT Amount (Rs.) *</label>
                    <input
                      id="member-personal-trainer-amount"
                      type="number"
                      className="form-input light"
                      placeholder="Enter PT amount"
                      value={form.personal_training_amount}
                      onChange={(event) => handleChange('personal_training_amount', event.target.value)}
                      required
                      min="0"
                    />
                  </div>
                </>
              )}

              <div className="form-group custom-datepicker-wrapper">
                <label htmlFor="member-start">Start Date *</label>
                <div
                  style={{
                    padding: '0.4rem 0.5rem',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-card-border)',
                    borderRadius: '10px',
                  }}
                >
                  <Calendar
                    key={`start-${form.start_date}`}
                    defaultDate={form.start_date}
                    dateFormat={BS_CALENDAR_FORMAT}
                    language="en"
                    onChange={({ bsDate }) => handleChange('start_date', bsDate)}
                  />
                </div>
              </div>

              <div className="form-group custom-datepicker-wrapper">
                <label>Subscription End Date</label>
                <div
                  style={{
                    padding: '0.4rem 0.5rem',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-card-border)',
                    borderRadius: '10px',
                    minWidth: '100%',
                  }}
                >
                  <Calendar
                    key={`end-${form.end_date || form.start_date || getTodayBs()}`}
                    defaultDate={form.end_date || getTodayBs()}
                    dateFormat={BS_CALENDAR_FORMAT}
                    language="en"
                    onChange={({ bsDate }) => handleChange('end_date', bsDate)}
                  />
                </div>
              </div>

              {form.wants_personal_trainer && (
                <div className="form-group full">
                  <label>PT End Date</label>
                  <div
                    style={{
                      padding: '12px 14px',
                      borderRadius: 12,
                      background: 'var(--color-bg)',
                      border: '1px solid var(--color-card-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {form.personal_training_end_date || getAutoPersonalTrainingEndDate(form.start_date, form.personal_training_plan)}
                  </div>
                </div>
              )}

              <div className="form-group full">
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 12,
                    border: '1px solid var(--color-card-border)',
                    background: 'var(--color-bg)',
                  }}
                >
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                    Charge Summary
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span>Subscription</span>
                      <strong>Rs. {subscriptionAmount.toLocaleString()}</strong>
                    </div>
                    {form.wants_personal_trainer && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span>Personal Trainer</span>
                        <strong>Rs. {personalTrainingAmount.toLocaleString()}</strong>
                      </div>
                    )}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        paddingTop: 8,
                        marginTop: 4,
                        borderTop: '1px solid var(--color-card-border)',
                        fontSize: 16,
                      }}
                    >
                      <span>Total</span>
                      <strong>Rs. {totalAmount.toLocaleString()}</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="member-payment">Payment Status *</label>
                <select
                  id="member-payment"
                  className="form-select"
                  value={form.payment_status}
                  onChange={(event) => handleChange('payment_status', event.target.value)}
                >
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                  <option value="partial">Partial</option>
                </select>
              </div>

              {form.payment_status === 'partial' && (
                <div className="form-group">
                  <label htmlFor="member-paid-amount">Amount Received (Rs.) *</label>
                  <input
                    id="member-paid-amount"
                    type="number"
                    className="form-input light"
                    placeholder="Enter amount received"
                    value={form.paid_amount}
                    onChange={(event) => handleChange('paid_amount', event.target.value)}
                    required
                    min="1"
                    max={Math.max(0, totalAmount - 1) || undefined}
                  />
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: paidAmount > 0 && paidAmount < totalAmount
                        ? 'var(--color-success)'
                        : 'var(--color-text-muted)',
                    }}
                  >
                    {paidAmount > 0 && paidAmount < totalAmount
                      ? `Remaining balance: Rs. ${remainingAmount.toLocaleString()}`
                      : 'Enter the amount received now so the remaining balance is tracked correctly.'}
                  </div>
                </div>
              )}

              <div className="form-group full">
                <label htmlFor="member-notes">Notes (Optional)</label>
                <textarea
                  id="member-notes"
                  className="form-textarea"
                  placeholder="Any additional notes..."
                  value={form.notes}
                  onChange={(event) => handleChange('notes', event.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              id="save-member-btn"
            >
              {loading ? <div className="spinner" /> : editData ? 'Update Member' : 'Add Member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
