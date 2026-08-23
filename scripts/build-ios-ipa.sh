#!/usr/bin/env bash
# Build AllPay-Employee-release.ipa on macOS (requires Xcode + CocoaPods).
# Windows cannot run this script — use GitHub Actions or Sideloadly instead.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Installing npm dependencies..."
npm ci

echo "Installing CocoaPods..."
cd ios
bundle exec pod install

echo "Archiving iOS app..."
xcodebuild \
  -workspace AllpayEmployeeApp.xcworkspace \
  -scheme AllpayEmployeeApp \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$PWD/build/AllpayEmployeeApp.xcarchive" \
  archive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  PROVISIONING_PROFILE_SPECIFIER=""

APP_PATH="build/AllpayEmployeeApp.xcarchive/Products/Applications/AllpayEmployeeApp.app"
if [ ! -d "$APP_PATH" ]; then
  echo "Build failed: app bundle not found at $APP_PATH"
  exit 1
fi

rm -rf Payload AllPay-Employee-release.ipa
mkdir Payload
cp -R "$APP_PATH" Payload/
zip -qr AllPay-Employee-release.ipa Payload
rm -rf Payload

echo ""
echo "Done: ios/AllPay-Employee-release.ipa"
echo "Install on iPhone with Sideloadly (Windows) or Xcode (Mac)."
