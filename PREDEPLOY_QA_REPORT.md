# Pre-Deploy QA Report

Project: Gym App
Workspace: `C:\Users\18703\OneDrive\Desktop\GYM`
Date: 2026-04-22

## Method

- Static code review of page components, shared components, and data-layer helpers
- Logic tracing across linked flows between sections
- Build verification with `npm run build`
- Manual test scenarios documented for UI validation before deployment

Latest build check:

- `npm run build` completed successfully on 2026-04-22
- Vite reported a bundle-size warning for the main JS chunk (`dist/assets/index-B7ZlX09K.js` at about 539 kB minified)

Fix implementation status:

- Code fixes have now been applied for the issues listed below
- A fresh production build passes after the fixes
- Manual browser retesting is still recommended before deployment, especially for auth recovery links and shared settings persistence

## Section Status

| Section | Status | Notes |
| --- | --- | --- |
| Dashboard | Code fixes applied | Retest stats, recent members ordering, expiring attention list, and fetch failure UI |
| Members | Code fixes applied | Retest renewals, edit flows, delete flow, and fetch failure UI |
| Payments | Code fixes applied | Retest validation, due-amount guardrails, and member sync messaging |
| Reports | Code fixes applied | Retest CSV export, date-range filtering, and zero-value chart rendering |
| Settings | Code fixes applied | Retest shared pricing persistence and export/delete flows |
| Login / Forgot / Reset | Code fixes applied | Retest bootstrap failure handling and password reset link flow |
| Overall Integration | Code fixes applied | Retest cross-section consistency after add, pay, edit, renew, and delete actions |

## Findings

### Dashboard

1. `New This Month` is based on `created_at`, not the member's actual membership start date.
File: `src/lib/stats.js`
Impact: If staff create a member record late, early, or backdate the start date, the Dashboard metric will not reflect the real join month shown elsewhere in the app.

2. `Recent Members` is ordered by `created_at` but labeled and displayed as recently joined members.
Files: `src/lib/members.js`, `src/pages/Dashboard.jsx`
Impact: The list can show members out of order relative to the displayed `Joined` date (`start_date`), which makes the section internally inconsistent.

3. Active-member and expiring-member dashboard counts rely on the stored `status` field instead of the computed membership state.
Files: `src/lib/stats.js`, `src/lib/members.js`
Impact: Members whose `end_date` has passed but whose stored `status` was never updated can still be counted or excluded incorrectly in Dashboard summary cards and attention lists.

4. Dashboard has no user-visible error state if the section data fetch fails.
File: `src/pages/Dashboard.jsx`
Impact: A failed stats or member query leaves the page without a clear recovery path for staff beyond a silent console error.

### Members

1. Membership renewal uses Gregorian month math instead of the app's Nepali-date membership logic.
File: `src/pages/Members.jsx`
Impact: Renewed members can receive an end date that does not match the same plan duration used by the add/edit member modal, especially around month boundaries.

2. Renewal updates the member to `payment_status: paid` before the renewal payment insert succeeds.
File: `src/pages/Members.jsx`
Impact: If the payment insert fails, the member can remain marked as paid without a matching ledger entry.

3. Member deletion does not handle linked payments explicitly.
Files: `src/pages/Members.jsx`, `src/lib/members.js`
Impact: Depending on database constraints, deleting a member may either fail unexpectedly or leave orphaned payment history.

4. Members page has no visible error state when member fetch fails.
File: `src/pages/Members.jsx`
Impact: Staff may see stale or empty results with no actionable explanation beyond a console error.

### Payments

1. Manual payment entry does not validate the converted AD payment date before saving.
File: `src/components/AddPaymentModal.jsx`
Impact: An invalid or empty converted date can still be passed into the save flow, which risks broken payment records.

2. Manual payment entry does not guard against overpayment relative to the member's current due amount.
Files: `src/components/AddPaymentModal.jsx`, `src/lib/members.js`
Impact: Staff can accidentally record more than the member owes, and the current balance logic will simply clamp the balance to zero instead of surfacing the mistake.

3. Payment-to-member sync failure is swallowed with only a console warning.
File: `src/lib/payments.js`
Impact: A payment can be recorded successfully while the related member status remains stale, and staff will still see a success message.

4. Add Payment modal has no user-facing error state if members fail to load.
File: `src/components/AddPaymentModal.jsx`
Impact: Staff can be left with an empty modal and no explanation beyond a console error.

### Reports

1. CSV export is malformed because values are joined with commas without CSV escaping or quoting.
File: `src/pages/Reports.jsx`
Impact: The exported file breaks as soon as any field contains a comma, quote, or newline. This already happens with the exported Nepali short date format, which includes a comma in normal output.

2. Payment History and CSV export ignore the selected report range and always use all recorded payments.
Files: `src/pages/Reports.jsx`, `src/lib/payments.js`
Impact: Staff can select `This Month`, `Last 3 Months`, or `This Year` and still export or review an all-time payment list, which makes the detail view disagree with the visible report filters.

3. `New Members` and `Member Growth` are calculated from `created_at`, not the member's actual membership `start_date`.
Files: `src/lib/stats.js`
Impact: Report charts can misstate when members actually joined, especially for backdated entries or delayed data entry.

4. `Unpaid Balances` uses members filtered by stored `status` instead of the computed live membership state.
File: `src/lib/stats.js`
Impact: If a member is past `end_date` but their stored status was never refreshed, the report can overstate or understate unpaid balances.

5. Zero-value periods are rendered with a visible minimum bar height in the reports insight cards.
File: `src/pages/Reports.jsx`
Impact: A month with zero revenue or zero member growth still shows a noticeable bar, which misrepresents the data visually.

### Settings

1. Subscription pricing is stored only in browser `localStorage`, not in Supabase or another shared store.
Files: `src/pages/Settings.jsx`, `src/lib/plans.js`
Impact: Default plan prices can differ across browsers, devices, and admins after deployment, so staff may not see the same pricing defaults.

2. Saving subscription prices can show a false success message if browser storage fails.
Files: `src/pages/Settings.jsx`, `src/lib/plans.js`
Impact: `savePlanPrices()` swallows storage errors, so the UI reports success even when the new prices were not persisted.

3. Full-data export ignores Supabase query errors for members and payments.
File: `src/pages/Settings.jsx`
Impact: The app can produce an incomplete or empty backup file and still show `Data exported successfully!`, which is risky before destructive operations.

4. Settings has no user-visible error state if account info fetch fails.
File: `src/pages/Settings.jsx`
Impact: The page can render blank account fields without explaining that the user/session lookup failed.

### Login / Forgot / Reset

1. Initial auth bootstrap can leave the entire app stuck on the loading screen if `supabase.auth.getSession()` rejects.
File: `src/App.jsx`
Impact: A startup auth failure has no recovery path because the loading flag is only cleared on the success path.

2. Reset Password does not verify that a valid recovery session exists before showing or submitting the form.
File: `src/pages/ResetPassword.jsx`
Impact: Expired or invalid reset links fail only after form submission with a generic error, and the route can behave like a normal password-change screen if the user is already signed in.

3. Password-reset email redirect is hard-coded to `window.location.origin + /reset-password`.
File: `src/lib/auth.js`
Impact: If the app is deployed under a subpath instead of the domain root, reset emails will point to the wrong URL.

### Overall Integration

1. The app mixes `created_at`, `start_date`, and live Nepali-date plan logic for member timing.
Files: `src/lib/stats.js`, `src/lib/members.js`, `src/pages/Members.jsx`
Impact: Dashboard cards, Reports charts, recent-member ordering, and renewal dates can disagree about when a membership actually started and when it should end.

2. Different sections mix stored status fields with computed live status fields.
Files: `src/lib/stats.js`, `src/lib/members.js`, `src/lib/payments.js`
Impact: Dashboard, Members, and Reports can disagree about whether someone is active, expired, paid, partial, or unpaid after time passes or a sync partially fails.

3. Member updates and payment writes are not transactional across related flows.
Files: `src/pages/Members.jsx`, `src/lib/payments.js`
Impact: One write can succeed while the linked write fails, leaving the member ledger, payment history, and summary sections out of sync.

4. Settings/configuration state is local-only while operational data is stored remotely.
Files: `src/pages/Settings.jsx`, `src/lib/plans.js`
Impact: Core pricing behavior changes depending on which browser or device a staff member uses, even though member and payment data are shared.

## Test Scenarios

### Dashboard

Executed review scope:

- Dashboard summary card data sources
- Add Member flow from Dashboard
- Recent Members list logic
- Expiring / Needs Attention logic
- Date formatting and expiry-day calculation

Recommended manual QA scenarios:

1. Create a member with today's start date and confirm:
   - `Total Active Members` increments
   - `Recent Members` shows the member
   - `Monthly Revenue` updates if paid or partial

2. Create a member whose `start_date` is manually set to a previous month and verify:
   - Whether `New This Month` should change or not
   - Whether `Recent Members` position matches the displayed joined date

3. Create a member whose `end_date` falls within 7 days and verify:
   - `Expiring Soon (30d)` count increments
   - `Needs Attention` shows the member
   - Badge text matches the real number of days remaining

4. Test a member whose membership has passed the end date without being manually renewed or edited, then verify:
   - Dashboard cards exclude them from active counts
   - `Needs Attention` behavior remains correct

5. Force a failing network/database response and verify Dashboard shows an actionable error state instead of only logging to console.

### Members

Executed review scope:

- Add member flow
- Edit member flow
- Partial-payment capture
- Renew flow
- Delete flow
- Search and filter logic
- Due / payment badge rendering

Recommended manual QA scenarios:

1. Add a member as:
   - fully paid
   - unpaid
   - partial
   Verify the table shows the right badge and due amount for each.

2. Edit a partial-payment member and:
   - add more paid amount
   - try to lower paid amount below already recorded payments
   - change plan and amount
   Verify the expected validations and ledger behavior.

3. Renew a member near the end of a Nepali month and compare the new end date with the same plan duration produced by the Add/Edit Member modal.

4. Simulate payment insert failure during renewal and verify the member is not left in a false `paid` state.

5. Delete a member who already has payment history and verify:
   - whether deletion succeeds
   - whether payments are cleaned up or blocked intentionally
   - whether the user gets a clear error if deletion is not allowed

6. Force a members fetch failure and verify the page shows a user-facing error state.

### Payments

Executed review scope:

- Payment ledger fetch/render flow
- Manual payment modal
- Payment insert data layer
- Payment-to-member synchronization
- Date conversion in payment entry

Recommended manual QA scenarios:

1. Record a valid payment for:
   - a fully unpaid member
   - a partially paid member
   - a fully paid member
   Verify the ledger entry appears and the Members section updates correctly.

2. Try recording a payment larger than the member's due amount and verify the app blocks or clearly warns about overpayment.

3. Force a broken/empty payment date and verify the modal blocks submission with a user-facing validation message.

4. Simulate a failure in the member-status sync after a successful payment insert and verify the user is informed that the payment saved but member data may need refresh/retry.

5. Simulate a members-load failure in the Add Payment modal and verify the user sees a clear error state instead of only an empty selector.

### Reports

Executed review scope:

- Report stats query logic
- Revenue and member growth chart inputs
- Payment history table behavior
- CSV export behavior
- Range-filter consistency

Recommended manual QA scenarios:

1. Switch the report range between:
   - `This Month`
   - `Last 3 Months`
   - `Last 6 Months`
   - `This Year`
   Verify summary cards, charts, payment table, and CSV export all reflect the same range.

2. Export payments where:
   - the notes contain commas
   - the notes contain quotes
   - the notes contain line breaks
   Verify the CSV opens cleanly in spreadsheet software with the correct column alignment.

3. Create a member with a backdated `start_date` but a new record `created_at`, then verify `New Members` and `Member Growth` reflect the intended business date.

4. Create a stale member whose `end_date` has passed but stored `status` is still `active`, then verify `Unpaid Balances` is still accurate.

5. Test a month with zero revenue or zero new members and verify the chart visually shows zero rather than a visible positive bar.

### Settings

Executed review scope:

- Account information fetch/render path
- Subscription pricing storage and save flow
- JSON export path
- Delete-all-data flow

Recommended manual QA scenarios:

1. Change plan prices, refresh the page, then open the app in a second browser or private window and verify whether the same defaults appear there.

2. Simulate storage failure or blocked browser storage and verify the app does not show a false success message after saving prices.

3. Simulate a members or payments query failure during export and verify the app clearly reports backup failure instead of downloading an incomplete file.

4. Force account-info fetch failure and verify the page shows a visible error state rather than blank fields.

5. Export a backup, run `Delete All Member Data`, and verify Dashboard, Members, Payments, and Reports all reflect the deletion consistently afterward.

### Login / Forgot / Reset

Executed review scope:

- Login submit flow
- Forgot-password email flow
- Reset-password page flow
- App auth bootstrap and protected-route behavior

Recommended manual QA scenarios:

1. Simulate failure in `supabase.auth.getSession()` during app startup and verify the app does not remain stuck on an infinite loading screen.

2. Test login with:
   - valid credentials
   - invalid credentials
   - temporary network/auth failure
   Verify the user always gets a clear outcome.

3. Send a password-reset email and verify the link returns to the correct deployed route.

4. Open `/reset-password` with:
   - a valid recovery link
   - an expired or already-used recovery link
   - no recovery link at all
   Verify the user gets a clear explanation before entering a new password.

5. If the production app will be hosted under a subpath, verify the reset email uses that base path instead of redirecting to the domain root.

### Overall Integration

Executed review scope:

- Cross-section date and status semantics
- Payment/member synchronization behavior
- Shared configuration persistence
- Production build readiness

Recommended manual QA scenarios:

1. Add a member, record a payment, renew the member, and then verify Dashboard, Members, Payments, and Reports all show the same status and amounts.

2. Create a member with:
   - a backdated `start_date`
   - a current `created_at`
   - a partial payment
   Verify every section uses the same business meaning for join date, due amount, and active state.

3. Simulate a partial failure where:
   - a payment insert succeeds but member sync fails
   - a renewal member update succeeds but payment insert fails
   Verify the app gives staff a clear warning and remains recoverable.

4. Change subscription prices in Settings, then add members from a different browser/device and verify plan defaults stay consistent across staff workflows.

5. Review the production build output and monitor initial load performance because the current build passes but ships a large main bundle warning.
