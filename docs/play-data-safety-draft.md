# Google Play Data Safety draft

This is a technical inventory, not a legal declaration. The owner must verify
retention, legal basis, processor contracts and whether each external provider
acts as a service provider before submitting Play Console forms.

## Data collected by the product

| Play category | Fitness-AI data | Purpose |
| --- | --- | --- |
| Personal info | Email address, profile name | Authentication, account management |
| Health and fitness | Workouts, exercises, sets, weight, repetitions, RPE/RIR estimate, rest, body measurements, goals, sleep, nutrition and recovery notes | Core training service, progress and AI coaching |
| App activity | Templates, schedules, feature interactions, AI conversations/analyses | App functionality and personalization |
| Social | Friend relationships and shared training activity | Optional social functionality |
| Financial info | Payment status, balance and provider transaction identifiers where enabled | Purchases and account balance |
| Device or other IDs | Push subscription endpoint/keys, session identifiers | Authentication and notifications |
| User content | Free-text workout, exercise and coaching notes | Core functionality and AI context |

## External processing to verify

- Hosting/database provider.
- Email delivery provider (Resend).
- AI/embedding providers configured in the deployment.
- Payment providers enabled in the deployment.
- Web Push/browser push services.

The declaration must reflect the actual dev/production configuration, not all
optional SDKs present in source code.

## Security statements to verify

- HTTPS encrypts data in transit.
- Database backups and production access are restricted.
- Authentication/session secrets are not shipped in the Android bundle.
- Users can request deletion of account and associated data.
- Retention periods and backup-deletion timing are documented.

## Missing product requirements

Before Play submission, implement:

1. An authenticated in-app account deletion action with explicit confirmation.
2. A public deletion-request page reachable without installing or logging into
   the app.
3. A public privacy policy naming the controller, contact, purposes,
   processors, retention, user rights and deletion procedure.
4. An operational process for deleting or anonymizing retained backups.

Google requires both an in-app deletion path and a public web resource when an
app allows account creation:
https://support.google.com/googleplay/android-developer/answer/13327111
