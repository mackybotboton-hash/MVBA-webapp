# Panaw Webapp: Phase 2 Cancellation & Refund Engine Design Notes

## Section D: Schema & Codebase Verification Report

### D.1 `deposit_payout_amount` Formulation
- **Verification Source**: `src/app/actions/admin-transactions.ts` (lines 94–105), `src/lib/payout-helper.ts` (lines 35–40), and migration `20261011000000_add_deposit_payout_amount.sql`.
- **Finding**:
  When an admin records a deposit payout to a host, `deposit_payout_amount` is calculated via `calculatePayout`:
  $$\text{depositWithoutFee} = \max(0, \text{downpayment\_amount} - \text{convenience\_fee})$$
  $$\text{depositPayout} = \max(0, \text{depositWithoutFee} - \text{commission\_amount})$$
- **Confirmation**:
  $$\text{deposit\_payout\_amount} \equiv \text{downpayment\_amount} - \text{convenience\_fee} - \text{commission\_amount}$$
  This confirms it **exactly equals** `downpayment_amount - convenience_fee - commission_amount` (clamped to $\ge 0$).
  When `deposit_payout_amount` is `NULL`, the exact fallback is:
  $$\max(0, \text{base\_deposit} - \text{commission\_amount})$$

---

### D.2 Real Enumerations & Status Values in Database & Codebase

#### 1. `bookings.status` (`booking_status` enum in `supabase/schema.sql` line 17):
- `'pending'`: Initial status when tourist submits reservation request via `request_booking_atomic_v2`.
- `'accepted'`: Set by host when approving reservation in `updateBookingStatusAction` (`booking-actions.ts`).
- `'declined'`: Set by host when declining reservation in `updateBookingStatusAction`.
- `'cancelled'`: Set when booking is cancelled via `cancel_booking_atomic`.
- `'completed'`: Set when guest check-in is finalized via `completeBookingAction` (`booking-actions.ts`) or QR check-in.
- **Cancellation Guard**: Only `'pending'` and `'accepted'` bookings can be cancelled. Attempting to cancel `'completed'`, `'declined'`, or other statuses is strictly rejected.

#### 2. `bookings.payment_status` (`payment_status` enum in `supabase/schema.sql` line 18):
- `'awaiting_deposit'`: Initial default on booking creation; tourist has not uploaded deposit receipt.
- `'deposit_uploaded'`: Set when tourist uploads GCash receipt in `uploadDepositReceiptAction` (`booking-actions.ts`).
- `'verified'`: Set when admin verifies deposit receipt in `verifyTransactionAction` (`admin-transactions.ts`).
- `'completed'`: Legacy enum entry representing full settlement.
- `'refunded'`: Set by `markRefundedAction` in `admin-transactions.ts` after refund disbursement is recorded.
- **Deposit Verification Guard**: If the actor is a tourist and `payment_status = 'deposit_uploaded'`, cancellation is rejected with: `"Your deposit is still being verified, please contact support."` Admins can still cancel.
- **Refund Eligibility**: Only bookings in `'verified'` or `'completed'` payment status are eligible for monetary refunds. Unverified bookings (`'awaiting_deposit'`) yield `refund_total = 0.00` and `0.00` legs.

#### 3. `bookings.payout_status` (`TEXT DEFAULT 'pending'` in `supabase/schema.sql` line 124):
- `'pending'` (or `NULL`): Initial default on booking creation. Panaw platform holds deposit in custody; host has not received funds.
- `'deposit_paid'`: Set by `recordPayoutAction` in `admin-transactions.ts` (line 87) when admin transfers the deposit payout (`deposit_payout_amount`) to the host.
- `'fully_paid'`: Set by `recordPayoutAction` when admin transfers the final payout to the host.
- **Leg Routing**:
  - If `payout_status IN ('deposit_paid', 'fully_paid')`: Host was paid. Host owes `host_leg = round(r * payout, 2)`, Panaw owes `panaw_leg = refund_total - host_leg`.
  - If `payout_status NOT IN ('deposit_paid', 'fully_paid')` (i.e. `'pending'` or `NULL`): Panaw holds all funds. `host_leg = 0.00`, Panaw owes `panaw_leg = refund_total`.

---

## 1. Money Rules & Mathematical Formulas

Let:
$$\text{base\_deposit} = \max(0, \text{downpayment\_amount} - \text{convenience\_fee})$$
$$r = \begin{cases} 1.0 & \text{if Host Cancellation or Force Majeure} \\ \frac{\text{deposit\_refund}}{\text{base\_deposit}} & \text{if } \text{base\_deposit} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$
$$\text{payout} = \begin{cases} \text{deposit\_payout\_amount} & \text{if NOT NULL} \\ \max(0, \text{base\_deposit} - \text{commission\_amount}) & \text{otherwise} \end{cases}$$

### Leg Allocation:
1. **Payout already sent (`payout_status IN ('deposit_paid', 'fully_paid')`)**:
   $$\text{host\_leg} = \text{round}(r \times \text{payout}, 2)$$
   $$\text{panaw\_leg} = \text{refund\_total} - \text{host\_leg}$$
2. **Payout not yet sent (`payout_status NOT IN ('deposit_paid', 'fully_paid')`)**:
   $$\text{host\_leg} = 0.00$$
   $$\text{panaw\_leg} = \text{refund\_total}$$

### Adjusted Host Payout:
- When booking is **not paid** (`payment_status NOT IN ('verified', 'completed')`):
  $$\text{adjusted\_host\_payout\_amount} = 0.00$$
- When booking is **paid**:
  $$\text{adjusted\_host\_payout\_amount} = \max(0, \text{payout} - \text{round}(r \times \text{payout}, 2))$$

### Core Mathematical Invariants:
1. $\text{host\_leg} + \text{panaw\_leg} \equiv \text{refund\_total}$ (centavo-exact on stored columns).
2. $\text{adjusted\_host\_payout\_amount} \le \text{payout}$ (host retained payout never exceeds original payout).
3. Total refund never exceeds what the tourist actually paid ($\text{refund\_total} \le \text{downpayment\_amount}$).

---

## 2. Worked Examples Table

**Baseline Parameters**:
- Total Booking Price: **₱1,000.00**
- Base Deposit: **₱200.00** (20%)
- Convenience Fee: **₱100.00**
- Total Paid at Booking (`downpayment_amount`): **₱300.00**
- Platform Commission: **₱80.00**
- Host Deposit Payout (`payout`): **₱120.00** ($\text{base\_deposit} - \text{commission} = 200 - 80$)

| Scenario | $r$ | Days Before | Fee Rule | Deposit Refund | Fee Refund | Total Refund | Payout Sent (`deposit_paid`) Legs & Adjusted | Payout Pending (`pending`) Legs & Adjusted |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **Standard (Full)** | 1.0 | 10 days | `never` | ₱200.00 | ₱0.00 | **₱200.00** | Host: ₱120.00, Panaw: ₱80.00, Adj: ₱0.00 | Host: ₱0.00, Panaw: ₱200.00, Adj: ₱0.00 |
| **Standard (Full)** | 1.0 | 10 days | `full_tier_only` | ₱200.00 | ₱100.00 | **₱300.00** | Host: ₱120.00, Panaw: ₱180.00, Adj: ₱0.00 | Host: ₱0.00, Panaw: ₱300.00, Adj: ₱0.00 |
| **Standard (Full)** | 1.0 | 10 days | `always` | ₱200.00 | ₱100.00 | **₱300.00** | Host: ₱120.00, Panaw: ₱180.00, Adj: ₱0.00 | Host: ₱0.00, Panaw: ₱300.00, Adj: ₱0.00 |
| **Standard (Boundary)** | 1.0 | 7 days | `never` | ₱200.00 | ₱0.00 | **₱200.00** | Host: ₱120.00, Panaw: ₱80.00, Adj: ₱0.00 | Host: ₱0.00, Panaw: ₱200.00, Adj: ₱0.00 |
| **Standard (Partial)** | 0.5 | 6 days | `never` | ₱100.00 | ₱0.00 | **₱100.00** | Host: ₱60.00, Panaw: ₱40.00, Adj: ₱60.00 | Host: ₱0.00, Panaw: ₱100.00, Adj: ₱60.00 |
| **Standard (Partial)** | 0.5 | 6 days | `full_tier_only` | ₱100.00 | ₱0.00 | **₱100.00** | Host: ₱60.00, Panaw: ₱40.00, Adj: ₱60.00 | Host: ₱0.00, Panaw: ₱100.00, Adj: ₱60.00 |
| **Standard (Partial)** | 0.5 | 6 days | `always` | ₱100.00 | ₱100.00 | **₱200.00** | Host: ₱60.00, Panaw: ₱140.00, Adj: ₱60.00 | Host: ₱0.00, Panaw: ₱200.00, Adj: ₱60.00 |
| **Standard (Lower Partial)** | 0.5 | 3 days | `never` | ₱100.00 | ₱0.00 | **₱100.00** | Host: ₱60.00, Panaw: ₱40.00, Adj: ₱60.00 | Host: ₱0.00, Panaw: ₱100.00, Adj: ₱60.00 |
| **Standard (Late)** | 0.0 | 2 days | any | ₱0.00 | ₱0.00 | **₱0.00** | Host: ₱0.00, Panaw: ₱0.00, Adj: ₱120.00 | Host: ₱0.00, Panaw: ₱0.00, Adj: ₱120.00 |
| **Flexible** | 1.0 | 3 days | `never` | ₱200.00 | ₱0.00 | **₱200.00** | Host: ₱120.00, Panaw: ₱80.00, Adj: ₱0.00 | Host: ₱0.00, Panaw: ₱200.00, Adj: ₱0.00 |
| **Flexible (Late)** | 0.0 | 2 days | any | ₱0.00 | ₱0.00 | **₱0.00** | Host: ₱0.00, Panaw: ₱0.00, Adj: ₱120.00 | Host: ₱0.00, Panaw: ₱0.00, Adj: ₱120.00 |
| **Non-Refundable** | 0.0 | 14 days | any | ₱0.00 | ₱0.00 | **₱0.00** | Host: ₱0.00, Panaw: ₱0.00, Adj: ₱120.00 | Host: ₱0.00, Panaw: ₱0.00, Adj: ₱120.00 |
| **Host Cancel** | 1.0 | any | any | ₱200.00 | ₱100.00 | **₱300.00** | Host: ₱120.00, Panaw: ₱180.00, Adj: ₱0.00 | Host: ₱0.00, Panaw: ₱300.00, Adj: ₱0.00 |
| **Force Majeure (Admin)** | 1.0 | any | any | ₱200.00 | ₱100.00 | **₱300.00** | Host: ₱120.00, Panaw: ₱180.00, Adj: ₱0.00 | Host: ₱0.00, Panaw: ₱300.00, Adj: ₱0.00 |

---

## 3. Function Design & Security Controls

1. **Admin Cancel Without Force Majeure**:
   - An administrator can cancel any reservation on behalf of a guest.
   - When an administrator initiates `cancel_booking_atomic` without specifying `p_force_majeure = true` (or passing `false`), the calculation engine strictly evaluates the **guest policy path** (standard/flexible/non-refundable rules according to `days_before`).
   - Only when an administrator explicitly declares `p_force_majeure = true` is the 100% deposit and fee refund ($r = 1.0$) applied.

2. **Explicit Search Path**:
   `SET search_path = public, pg_temp` is configured on all functions (`compute_cancellation_refund`, `estimate_cancellation_refund`, `cancel_booking_atomic`) to prevent search path hijacking.

3. **GCash Validation Rules**:
   - `p_refund_gcash_number` is validated (regex `^09\d{9}$`) **only** when `v_actor = 'tourist'` and `refund_total > 0`.
   - When host or admin cancels, `refund_gcash_number` is stored as `NULL`.
   - *Phase 3 Hook*: Tourist will supply refund GCash number via cancellation receipt / settlement view in Phase 3.

4. **Reason String Sanitization**:
   `p_reason` is trimmed and capped to 500 characters:
   `v_reason := left(trim(coalesce(p_reason, '')), 500);`

5. **Role Claim Isolation**:
   `cancel_booking_atomic` saves `current_setting('request.jwt.claim.role', true)` into `v_saved_jwt_role`, elevates temporarily to `service_role` strictly for the row freeze `UPDATE`, and immediately restores `v_saved_jwt_role`.

6. **TODO Note on Parameter Immutability**:
   > **Important Security Architecture Note**: The cancellation and refund mathematical engine depends strictly on `bookings.convenience_fee`, `bookings.check_in_date`, `bookings.check_out_date`, `bookings.tourist_id`, `bookings.owner_id`, and `bookings.room_id` being completely immutable from tourist and untrusted client callers. If client UPDATE policies allow modifying these fields, a separate hardening migration must protect them.
