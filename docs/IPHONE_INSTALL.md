# Install AllPay Employee on iPhone (Windows + USB)

You are on **Windows**. Apple does not let you build iPhone apps locally on Windows, so this project uses **GitHub Actions (cloud Mac)** to produce the install file:

**`AllPay-Employee-release.ipa`**

Then you install that file on your iPhone using **Sideloadly** (free, works on Windows with a USB cable).

> **Note:** UPI Scan & Pay still does **not** work on iPhone (Android only). You can use login, history, settings, and manual expense recording.

---

## Part 1 — Get the `.ipa` file

### Step 1: Push the latest code to GitHub

From PowerShell:

```powershell
cd C:\Users\gopal\Desktop\Expenzo\AllPay--App
git add .
git commit -m "Add iOS IPA build workflow and install guide"
git push origin main
```

### Step 2: Run the iOS build on GitHub

1. Open: https://github.com/gopal172002/AllPay--App/actions
2. Click **Build iOS IPA** in the left sidebar
3. Click **Run workflow** → **Run workflow**
4. Wait about **15–25 minutes** for the green checkmark

### Step 3: Download the app file

1. Open the completed workflow run
2. Scroll to **Artifacts**
3. Download **AllPay-Employee-iOS**
4. Unzip it — you will get:

   **`AllPay-Employee-release.ipa`**

Keep this file. This is your iPhone app install package.

---

## Part 2 — Install on iPhone from Windows (Sideloadly)

### What you need

- Windows laptop
- iPhone (any recent model, including iPhone 17 Pro)
- USB cable (Lightning or USB‑C)
- Free **Apple ID** (your normal iCloud email)
- The **`AllPay-Employee-release.ipa`** file from Part 1

### Step 1: Install Sideloadly

1. Download from: https://sideloadly.io/
2. Install on Windows
3. If prompted, also install **iTunes** or **Apple Devices** from Microsoft Store (needed for USB drivers)

### Step 2: Prepare the iPhone

1. Connect iPhone to laptop with USB
2. On iPhone: tap **Trust This Computer**
3. Unlock the phone and keep it on the home screen

### Step 3: Sideload the app

1. Open **Sideloadly**
2. Select your **iPhone** in the device dropdown (left side)
3. Drag **`AllPay-Employee-release.ipa`** into Sideloadly
4. Enter your **Apple ID** email when asked
5. Enter your Apple ID **password** (or app-specific password if you use 2FA)
6. Click **Start**
7. Wait until it says **Done**

### Step 4: Trust the app on iPhone (first time only)

1. On iPhone: **Settings → General → VPN & Device Management**
2. Under **Developer App**, tap your Apple ID
3. Tap **Trust**
4. Open **AllPay Employee** from the home screen

---

## Part 3 — After install

### Login

Use your normal employee onboarding / invite flow. The app talks to:

`https://allpay-dashboard.onrender.com/api`

### If the app expires (free Apple ID)

With a **free** Apple ID, sideloaded apps last about **7 days**. When it stops opening:

1. Connect iPhone to Windows again
2. Run Sideloadly with the same `.ipa` again
3. Re-trust if needed

For a **permanent** install (no weekly refresh), you need a paid **Apple Developer Program** ($99/year) and TestFlight — see Part 4.

---

## Part 4 — Alternative install methods

### Option A — Mac + Xcode (if you get access to a Mac)

```bash
cd AllPay--App
npm install
cd ios && bundle exec pod install && cd ..
open ios/AllpayEmployeeApp.xcworkspace
```

In Xcode: select your iPhone → **Run**. No `.ipa` file needed.

### Option B — TestFlight (best for teams, needs $99/year Apple Developer)

1. Enroll at https://developer.apple.com/programs/
2. Upload a signed build to App Store Connect
3. Add testers in TestFlight
4. Install from the **TestFlight** app on iPhone (no weekly re-install)

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| GitHub build fails | Open the failed run → read the red step log. Often `pod install` or a native module issue. |
| Sideloadly does not see iPhone | Install Apple Devices / iTunes, use a data cable, unlock phone, tap Trust. |
| "Unable to install" | Delete old AllPay app, try Sideloadly again with a fresh `.ipa`. |
| App opens then crashes | Re-download a new `.ipa` from GitHub Actions after a fresh build. |
| UPI payment does not work | Expected on iPhone — use an Android device for UPI testing. |

---

## Quick checklist

- [ ] Push code to GitHub
- [ ] Run **Build iOS IPA** workflow
- [ ] Download **AllPay-Employee-release.ipa**
- [ ] Install **Sideloadly** on Windows
- [ ] Connect iPhone by USB
- [ ] Sideload `.ipa` with your Apple ID
- [ ] Trust app in iPhone Settings
- [ ] Open **AllPay Employee**
