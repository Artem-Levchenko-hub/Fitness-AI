# Android release readiness

Updated: 2026-07-28

## Verdict

The intended Android package is a Trusted Web Activity:

- package: `app.leadgenerator.fitness`;
- host: `app.lead-generator.ru`;
- source: `android/twa-manifest.json`;
- min SDK: 23;
- current release metadata: `1.0.0` / version code `3`.

The PWA itself is installable and the dev site is healthy. The repository is
not yet able to produce a release AAB: Bubblewrap output/Gradle wrapper,
upload signing configuration and Play Console declarations are absent.

## Required owner inputs

1. Confirm the final app name, package ID and support/legal contact.
2. Confirm whether this package already exists in Play Console and whether
   version code `2` was ever uploaded.
3. Create or select the Play Console app and enable Play App Signing.
4. Provide the upload-certificate SHA-256 fingerprint and, after Play creates
   it, the app-signing SHA-256 fingerprint. Do not commit a keystore or
   passwords.
5. Approve the privacy policy, retention rules and account-deletion process.

## Build pipeline

1. Install a current JDK and Bubblewrap CLI in CI.
2. Run Bubblewrap update/init from `android/twa-manifest.json`.
3. Set `targetSdkVersion` to API 36 for submissions on or after
   2026-08-31. Confirm the generated Gradle project before every release.
4. Store upload keystore and passwords only in CI/secret storage.
5. Build an AAB, not only an APK.
6. Run `bundletool validate` and create a universal test APK from the AAB.
7. Test login, offline fallback, notifications, deep links, AI flow,
   Myo-reps, account deletion and payment links on physical Android devices.
8. Upload only to an internal testing track first. Production publication
   requires separate owner confirmation.

Official target API reference:
https://developer.android.com/google/play/requirements/target-sdk

## Digital Asset Links

TWA verification requires:

`https://app.lead-generator.ru/.well-known/assetlinks.json`

The public file currently exists with the expected package and one SHA-256
fingerprint. It is not represented in the local repository and its provenance
(upload key or Play app-signing key) is not documented. The final file must
contain `delegate_permission/common.handle_all_urls` and every fingerprint
needed for the actual signing path. If verification fails, Android opens a
Custom Tab instead of a full-screen TWA.

Do not create this file with placeholder fingerprints.

Official TWA reference:
https://developer.chrome.com/docs/android/trusted-web-activity/quick-start

## Play Console checklist

- Developer identity and contact details verified.
- App access instructions supplied for email-code authentication.
- Store listing: name, short/full descriptions, icon, feature graphic,
  phone/tablet screenshots and support URL.
- Privacy policy URL published and reachable without authentication.
- Data Safety form completed for every collected/shared data type.
- Account deletion available in-app and through a public web URL.
- Health Apps declaration completed for fitness/training functionality.
- Content rating, target audience and ads declaration completed.
- Permissions reviewed after generating the Android manifest.
- Internal testing passed before closed/open/production tracks.

Official policy references:

- Data Safety:
  https://support.google.com/googleplay/android-developer/answer/10787469
- Account deletion:
  https://support.google.com/googleplay/android-developer/answer/13327111
- Health Apps declaration:
  https://support.google.com/googleplay/android-developer/answer/14738291

## Hard blockers

- No generated Android/Gradle project or reproducible AAB command.
- No signing/upload key configuration.
- Public Digital Asset Links is not reproducible from the repository and its
  single fingerprint is not confirmed against Play App Signing.
- No public privacy policy.
- No in-app or public-web account deletion flow.
- Play Console ownership/version-code history is unknown.
