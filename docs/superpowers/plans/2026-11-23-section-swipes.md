# Section swipe navigation

Implement the user's requested native navigation in the existing web and Kotlin clients. Use the four existing root sections in their visible order. Reuse the current visual palette and authentication boundaries.

- [ ] Share the web tab map between gesture navigation and the bottom bar. Add horizontal intent detection, direction-aware page transitions, a moving tab indicator and previous/next cues.
- [ ] Keep vertical scrolling, zoom, form controls, chart interaction, swipe-to-delete, dialogs and the 3D canvas in control of their own gestures. Respect reduced motion and browser edge gestures. Preserve ordinary links and browser history.
- [ ] Use Compose HorizontalPager for Kotlin root sections, keep visited state and scrolling, and retain normal workout/programmatic navigation and modal detail behavior.
- [ ] Check gesture thresholds, cancellation, nested controls and repeated navigation. Open the local web interface and exercise the interaction. Run TypeScript, lint, targeted tests and Android CI.
- [ ] Review, commit and deploy the web, then build and verify a signed Android update.

The user expanded the request during implementation. Active workouts must remain resumable until explicitly finished/cancelled. Fully planned strength sessions finish on the server after one hour without a newly saved set; incomplete sessions wait. Use persisted server save time to protect delayed offline uploads, recheck eligibility while holding the workout lock, and reuse the normal finish/AI queue transaction. Add only the required timestamp migration. Show the rule in both clients.

Audit secondary screens and apply consistent native sans typography, touch controls and readable action grouping across the existing web and Compose theme. Exercise main routes, forms, detail pages, dialogs and model interaction using synthetic local account data.
