# Mobile experience implementation plan

The user requested a polished, app-like web experience verified locally in a browser, with popular fitness apps as references, and completion of the Kotlin application including the model.

The implementation builds on the existing Next.js and Compose clients, shared account APIs, offline set queues and sage/paper palette. Hevy informs quick set entry and previous values. Fitbod informs the muscle view. The existing 3D muscle asset and actual account training data supply the body view. AI continues through the server's existing DeepSeek/Qwen integration.

The design decision is to improve the current applications in place. A separate frontend would duplicate existing training and offline behavior. A cosmetic skin alone would leave the current navigation and entry problems in place.

- [ ] Open the app locally with an isolated database containing synthetic fixtures. Inspect dashboard, active workout, profile/model, keyboard and navigation at mobile and desktop widths.
- [ ] Improve the web app shell, dashboard and workout controls with touch-sized actions, obvious current-tab state, clear hierarchy and usable small screens. Preserve existing routes and account access checks.
- [ ] Add the account's interactive muscle model to Kotlin with native rendering, reuse the existing model and loading/selection data, handle renderer lifecycle and unavailable assets.
- [ ] Complete native template editing and AI program creation using the existing validated server functionality. Preserve request deduplication and account ownership.
- [ ] Test core browser interactions, mobile overflow, offline set retention and reconnection, renderer asset loading and both admin entry points. Run TypeScript, lint, appropriate tests and Android build checks.
- [ ] Review the integrated change, commit, run CI and deploy production. Download and verify the resulting APK. Provide screenshots and report any remaining device-only verification.

Local test data is held in fitness_ui_dev_20261123, a separate PostgreSQL database. Production credentials and private account data stay out of screenshots, fixtures and commits.
