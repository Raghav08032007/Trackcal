# Food photo accuracy

`python tools/food-bench/run.py --api http://127.0.0.1:8011 --per 3` sends openly licensed dish photos from Wikimedia
Commons (the file title names the dish) through the app's own `/api/analyze`. Photos are cached in `videos/food-bench/`.

## 27 Nov 2026: 16 Indian dishes, 36 photos analysed (12 more got no answer: the free model returned 502)

| Measure | Result |
|---|---|
| Right dish named first (top-1) | 67% |
| Right dish first or among the one-tap alternatives (top-4) | 81% |
| Biryani called pulao | 0 of 5 |
| Vegetarian / non-vegetarian mix-ups | 1 (butter chicken read as paneer butter masala; butter chicken was an alternative) |

Strong: biryani vs pulao vs fried rice, idli, paratha, paneer dishes, chole, samosa, poha.
Weak: mutton vs chicken in biryani (often right in the alternatives), plain rotis (one read as a tortilla), butter chicken
vs paneer butter masala. Some misses are the photos' fault: a "pulao" photo that is a whole thali, a "pav bhaji" photo
that shows only the bread.

What changed for the user (same day): look-alike rules in the prompt (biryani/pulao/fried rice, mutton/chicken/paneer/egg,
roti/paratha/naan, dosa/uttapam/idli, sambar/rasam; meat or bone means never "vegetable"), up to 3 alternatives, a
one-tap "Not right?" correction that re-checks the same photo with the chosen name, and photo tips (30-40 cm, 45°, whole
plate, daylight, a spoon for scale, spread mixed dishes).

Next: a paid vision model for the photo step (free models are slower, rate limited and less precise), dish-specific
prompts for the weak pairs, and per-100 g values from the IFCT catalog for the corrected dish.
