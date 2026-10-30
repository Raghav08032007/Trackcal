# Test-hook requests for the next version

The Version A journeys find controls by their accessible role and name. The harness was not allowed to change app code, so it couldn't add `data-testid` attributes. A redesign must either keep the names below or add the matching `data-testid`, and update `tools/bench/journeys/<LABEL>.mjs` to match. The success checks themselves don't depend on the UI: they read stored data. So a renamed control can only cause a loud journey failure, never a false pass.

| Journey | Control used in A | Requested `data-testid` |
|---|---|---|
| J1 | textboxes `name`, `email` and `password`; button "Create free account" | `signup-name`, `signup-email`, `signup-password`, `signup-submit` |
| J1 | link "Continue tracking without finishing" | `onboarding-skip` |
| J1 | link "Log a meal ↗"; labels "Food name", "calories"; button "Confirm diary entry" | `quick-log-open`, `meal-name`, `meal-calories`, `meal-confirm` |
| All | links "Food", "Move", "Play", "Progress" (main navigation) | `nav-food`, `nav-move`, `nav-play`, `nav-progress` |
| J2 | label "Food search"; buttons "Search catalog" and "Choose …" | `food-search`, `food-search-submit`, `food-result` |
| J3 | button "Use favorite <name>" | `favorite-use` |
| J4 | nav "Food pages" → link "Barcode"; label "Barcode number"; button "Lookup Barcode"; text "Product not found" | `food-tab-barcode`, `barcode-input`, `barcode-lookup`, `barcode-not-found` |
| J4/J5 | link "Journal"; button "Add meal"; button "+250 ml" | `food-tab-journal`, `journal-add-meal`, `water-add-250` |
| J6 | buttons "Add Wall push fundamentals", "Start workout", "Add set for exercise 1"; labels "reps · exercise 1 set 1", "Recorded session minutes"; button "Complete workout" | `exercise-add`, `workout-start`, `set-add`, `set-reps`, `session-minutes`, `workout-complete` |
| J7 | heading /See how far you/ | `progress-summary` |
| J8 | select "Appearance" | `theme-select`; plus `language-select`, if B adds languages, so J8 can measure a language change too |
| Screens | page headings ("Your food diary", "Your activity overview", "Your daily rhythm") | `page-ready` on the main region, set once data has loaded |
