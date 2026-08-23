# Expenzo UPI Intent tracking

Expenzo is an **expense tracker with payment initiation convenience**. It is not a UPI payment provider, PSP, TPAP, wallet, or bank.

## Trust model

| What happened | Expenzo status |
|---|---|
| External UPI app returned a success Activity Result | `SUCCESS_REPORTED` |
| Expenzo independently verified settlement with NPCI/the bank | **Not available** |

`SUCCESS_REPORTED` means: the UPI app reported success for the payment Expenzo initiated. It does **not** mean bank-verified or settled.

## Money path

```
User's bank → UPI (PhonePe / GPay / Paytm / BHIM / bank app) → scanned payee VPA
```

Expenzo never becomes the payee. If the QR has `pa=shop@upi`, the intent pays `shop@upi`.

## Flow (direct pay-to-payee)

1. Scan a `upi://pay?...` QR (validated by `UpiQrParser`)
2. Confirm payee + amount (never auto-pay after scan)
3. Persist payment `INITIATED`
4. Build NPCI-safe URI via `buildUpiPayUri` (QR relay; never invent `mode` / `orgid` / `sign`)
5. Launch UPI Intent:
   - **Android:** generic `upi://pay?...` + system chooser (NPCI “proxy utility”)
   - **iOS:** app schemes (`paytmmp://upi/pay`, PhonePe, GPay, BHIM) — bare `upi://` is often stolen by WhatsApp
6. User enters PIN **only inside the UPI app**
7. Parse result (Android) or manual **I paid — record expense** (iOS)

## NPCI linking rules we follow

From NPCI UPI Deep Linking Spec:

| Rule | What AllPay does |
|---|---|
| Proxy apps may scan QR and launch the link | Yes — relay payee URI into PSP apps |
| Do not alter signed intents (`sign`) | Exact QR URI when amount matches |
| Never invent `sign` / fake `orgid` | Stripped if amount changes on signed QR; never invented |
| `pa` with literal `@` | Kept unencoded |
| Spaces as `%20` | Yes |
| `sign` last if present | Yes |
| No synthetic merchant `tr` | App never invents `tr=EXP...` |
| P2P: no fake `mc` | Only relay `mc` from merchant QR |

Shopping apps (Flipkart, etc.) succeed because they pay **their registered merchant VPA** via a **PSP SDK** that signs intents (`mode=05`, `orgid=000000`, valid `sign`). That is a different product path than “pay arbitrary scanned personal UPI ID”.

## Why banks may still show “UPI risk policy”

After PIN, the **payer bank** (e.g. SBI) can still decline a third-party intent to a **personal VPA**, even when the same VPA typed inside Paytm works. That is bank risk scoring, not AllPay PIN handling.

Highest success rates:

1. **Shop / merchant QR** (has `mc`, often `sign`) — same class as shopping checkouts
2. Generic Android chooser → Google Pay / PhonePe / BHIM
3. Personal UPI IDs — sometimes blocked by bank policy on auto-open links

## Security

- No UPI PIN / OTP / bank password UI or storage
- Only `upi://pay` URIs are launched
- Amount stored as integer paise
- Duplicate expenses blocked by `paymentId` uniqueness

## Real-device tests

Install and complete a live payment (small amount) with Google Pay, PhonePe, Paytm, BHIM, and at least one bank app.

### iPhone

1. Scan QR → Confirm → Pay (opens chosen UPI app with payee filled)
2. Complete PIN in the UPI app
3. Return → tap **I paid — record expense** if status is unknown
