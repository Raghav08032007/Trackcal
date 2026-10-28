# Wellness measurements and calculations

28 October 2026. Measurement entry is optional and private. No photograph infers height/weight. No measurement entry/change earns XP or determines exercise intensity or body-shape/weight-loss plans.

## Storage and conversion

Store original value/unit, canonical value, explicit recorded timestamp and server creation time in wellness_measurements. Recorded timestamps require an offset, normalize to UTC and cannot be future-dated. Each route authenticates and scopes records to the active user. Export/delete use the same ownership boundary.

- Height: inches × 2.54 = centimeters; reverse divides by 2.54.
- Weight: pounds × 0.45359237 = kilograms; reverse divides by 0.45359237.
- Duration: minutes; repetitions: reps; activity frequency: days/week; hydration: ml; sleep: hours.

Finite validation ranges: height 30–275 cm, weight 1–500 kg, duration 0–180 min, repetitions 0–500, frequency 0–7, hydration 0–10,000 ml, sleep 0–24 h. These are storage validation bounds, not prescribed targets. BMI uses the latest recorded height and weight separately, even when other measurement types occupy the most recent history page. History displays up to 200 recent records; underlying records remain retained/exportable. Changing display units preserves the original values.

## BMI safeguards

BMI = kg / (cm / 100)^2, displayed rounded to one decimal. With either input absent, no BMI is calculated. No classification is produced for any age group. Adults receive limitations/context; under-20 or unspecified-age users receive an explicit notice that age-/sex-specific clinical interpretation is unavailable. BMI does not trigger recommendations, calorie goals, progression or rewards.

Reference: [CDC adult BMI calculator](https://www.cdc.gov/bmi/adult-calculator/) describes BMI as a screening measure and its adult calculator as 20+. [CDC BMI FAQ](https://www.cdc.gov/bmi/faq/) distinguishes child/teen age- and sex-specific interpretation. The application deliberately avoids approximating those classifications. These references do not validate the app clinically.

## Legacy calculator boundary

The earlier explicit adult calorie calculator remains separate from personalized onboarding. Standalone local calculations require integral age 20–100. Signed-in dashboard calculations also require a server-confirmed adult preference and reject minor-account flags; API calculations reject non-adult saved age groups and minor accounts. Service failures do not bypass the check. The new flow never calls this legacy calculator, generates restrictive targets for younger users or prescribes a universal water target. Existing user-entered reference goals are not silently overwritten.

Remaining limitations: self-reported age/measurements, no clinically validated pediatric interpretation, no wearable sync and no medical personalization. Clinical/physical-device certification is not implied by arithmetic and authorization tests.
