# Expenzo UPI Intent tracking

Expenzo is an **expense tracker with payment initiation convenience**. It is not a UPI payment provider, PSP, TPAP, wallet, or bank.

## Trust model

| What happened | Expenzo status |
|---|---|
| External UPI app returned a success Activity Result | `SUCCESS_REPORTED` |
| Expenzo independently verified settlement with NPCI/the bank | **Not available** |

`SUCCESS_REPORTED` means: the UPI app reported success for the payment Expenzo initiated. It does **not** mean bank-verified or settled.

There is no `GET /upi/verify/{txnId}` and no Razorpay/Cashfree/Stripe path for this flow.

## Money path

```
User's bank → UPI (PhonePe / GPay / Paytm / BHIM / bank app) → scanned payee VPA
```

Expenzo never becomes the payee. If the QR has `pa=shop@upi`, the intent pays `shop@upi`.

## Flow

1. Scan a `upi://pay?...` QR (camera-kit; validated by `UpiQrParser`)
2. Confirm payee + amount (never auto-pay after scan)
3. Persist payment `INITIATED` (local + `POST /api/v1/payments`)
4. Launch Android `ACTION_VIEW` UPI Intent (`UPI_APP_OPENED`)
5. User pays and enters PIN **only inside the UPI app**
6. Parse Activity Result → `SUCCESS_REPORTED` / `FAILED` / `PENDING` / `CANCELLED` / `UNKNOWN`
7. `POST /api/v1/payments/{id}/result`
8. On `SUCCESS_REPORTED` (or manual `USER_CONFIRMED`), create one linked expense

## Statuses

`INITIATED` → `UPI_APP_OPENED` → `SUCCESS_REPORTED` | `FAILED` | `PENDING` | `CANCELLED` | `UNKNOWN`

`USER_CONFIRMED` is a separate manual fallback. It is never rewritten to `SUCCESS_REPORTED`.

If Expenzo is killed while the UPI app is open, in-flight payments become `UNKNOWN` on next launch.

## Security

- No UPI PIN / OTP / bank password UI or storage
- Only `upi://pay` URIs are launched; http/https/javascript/file/intent are rejected
- Callback extras are untrusted client input
- Amount stored as integer paise
- Duplicate expenses blocked by `paymentId` uniqueness
- Analytics events contain no VPA, txn ids, or raw payloads

## Known UPI Intent limitations

- Callback extras and field names differ by app (GPay, PhonePe, Paytm, BHIM, banks)
- Some apps return `RESULT_CANCELED` even after a successful pay
- Some apps return empty extras → `UNKNOWN`
- Android may kill Expenzo while the user is in the UPI app
- There is no official public NPCI inquiry API for arbitrary third-party apps
- **iOS** opens `upi://pay` via app-specific deep links (Paytm / PhonePe / GPay / BHIM) — never WhatsApp via bare `upi://`
## Why “UPI risk policy” happens with auto-open links

NPCI / banks often **reject third-party `upi://pay` intents** to personal VPAs
(even after PIN), while the **same payment typed inside Paytm/PhonePe succeeds**.

AllPay therefore:

1. Copies the payee UPI ID
2. Opens your UPI app (home — not a payment deep link)
3. You pay normally inside that app
4. Return and tap **I paid — record expense**

Auto deep-link fill is no longer the primary path for P2P expense payments.

## Real-device tests before production

Install and complete a live payment (small amount) with:

- Google Pay
- PhonePe
- Paytm
- BHIM
- At least one bank UPI app (SBI / HDFC / iMobile etc.)

For each: success, user-cancel, pending, kill-Expenzo-during-pay, and duplicate-return (do not create two expenses).

### iPhone

1. Install a UPI app (Google Pay / PhonePe / Paytm / BHIM)
2. Scan QR → Confirm → Pay (opens UPI app)
3. Complete PIN in the UPI app
4. Return to AllPay → tap **I paid — record expense**
5. Confirm expense appears in History
