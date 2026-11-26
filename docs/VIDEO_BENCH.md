# Video bench: testing the camera coach on real videos

The bench runs exercise videos through the same pieces the camera page uses: the pose model, the rep counter and the live coach. It reports, per exercise:

- how often the count was right;
- whether the coach named the mistake made on purpose;
- how often it complained about a clean video (false alarms).

Videos never leave the computer. The `videos/` folder is in `.gitignore`.

## 1. Your own videos (the most valuable)

Record with a phone on a stand, as people really use the app. For each exercise, record:

- **Correct, the recommended angle:** 8–12 reps. The camera page says side-on or facing the camera.
- **Correct, the other angle:** for exercises that count from both angles.
- **One clip per common mistake:** half reps (`shallow`), rushing (`fast`), wrong angle (`facing` or `side`), elbow flaring on overhead extensions (`elbow-out`), the upper arm swinging on kickbacks (`arm-swing`), standing too upright on rows (`upright`), swinging the body on curls, presses and raises (`body-swing`).

Different people, clothes, rooms and lighting all help. Name each file `<exercise>_<reps>reps[_<mistake>][_anything].mp4`, for example:

```
videos/me/squat_10reps.mp4
videos/me/kickback_8reps_facing.mp4
videos/me/row_10reps_upright_dim-room.mp4
```

The exercise is the id from the camera page address (`?exercise=squat`). Or list the videos in `labels.csv` (`file,exercise,reps,mistake`).

Then run:

```
cd "F:\track cal"
node tools/video-bench/run.mjs videos/me
```

It writes `report.md` (and `report.json`, with every frame's joint angle for checking) next to the videos.

## 2. Example videos of the 3D coach (synthetic, any amount)

```
node tools/video-bench/make-videos.mjs videos/avatar --kinds squat,pushup,kickback --reps 6 --turns 0,90 --models f,m --speeds 1,1.4
node tools/video-bench/run.mjs videos/avatar
```

Every combination of exercise, camera angle, body model and speed becomes one labelled video. A side-only move filmed from the front is labelled with the angle mistake. These catch problems in the pose model's reading, such as the push-up elbow below, before real people hit them. They don't replace real videos.

## 3. Open dataset: Mendeley, 7 exercises, good/bad form (CC BY 4.0)

*A Multi-View Raw Video Dataset of Seven Fitness Exercises with Good/Bad Form Labels*, Prashanth et al., 2026, [DOI 10.17632/kgbb3yn47p.2](https://data.mendeley.com/datasets/kgbb3yn47p/2).

- **Content:** 26 people, smartphone video from the front, side and diagonal.
- **Exercises:** side bend, bent-over row, curl, push-up, shoulder press, squat, overhead triceps extension.
- **Licence:** CC BY 4.0, so the authors must be credited wherever results from it are shown.

To use it:
1. Download it with "Download All" on that page and unzip it to `videos/mendeley`.
2. Create the labels and run the bench:
   ```
   node tools/video-bench/mendeley-labels.mjs videos/mendeley
   node tools/video-bench/run.mjs videos/mendeley
   ```

It has no rep counts, so it measures coaching only: a bad-form video should draw a form fix, a good one none.

## 4. Research datasets (measurement only)

These need the owners' research agreements, signed by you. They may be used to measure accuracy, never shipped in the app or used to train what it ships:

- [QEVD](https://www.qualcomm.com/developer/software/qevd-dataset) (Qualcomm, live coaching feedback);
- [Fitness-AQA](https://github.com/ParitoshParmar/Fitness-AQA) (7 error types on squat, barbell row and overhead press);
- [RepCount](https://svip-lab.github.io/dataset/RepCount_dataset.html) (rep counting).

Convert their labels to `labels.csv` and run the same command.

## What the first runs found (44 videos of the 3D coach: 11 exercises, 2 bodies, 2 camera angles)

Counted exactly on every clean video: jumping jacks, knee push-ups, rows, squats, sumo squats, side raises, kickbacks and overhead extensions (from the recommended angle). Kickbacks and side raises filmed from the wrong angle drew the right fix ("Turn side-on" / "Face the camera") every time.

Fixed:
- **Curls lost every rep on one body ("keep your elbows still").** From the side or three-quarters, the far elbow is half hidden behind the body, and its point jittered by 0.5 torso lengths while the counted elbow moved 0.15. The still-elbow check now judges only the arm being counted. It still watches other limbs, so bird dogs aren't counted as donkey kicks. On that video the count went from 0 to 4 of 5.
- **The push-up and plank demo floated the feet above the mat.** The plank was too flat for straight arms, so with the hands on the floor the toes hung in the air. The counter rightly rejected that as "not a push-up". The plank is now 67° from vertical and the bottom of a push-up 79°, the angles at which hands and toes both touch the floor. This also fixes the demo people watch. In the simulator, exact push-up counts went from 55–60% to 65%. Burpees, whose shoulders now drop less, were re-timed so the minimum rep time is 750 ms instead of 950 ms. They count as before or better (within one rep 75% → 80–95%), with no half reps or standing still counted.

Open:
- **Side-on push-ups still count 1–2 of 5 on the 3D coach.** Lying flat, the pose model reads the straight arm at the top as 138–157°, often just under the 150° lockout the counter requires. A lower lockout (140–142°) would count these, but in the simulator it also counted quarter push-ups in 10% of sets and stopped telling people with shallow reps to go deeper, so it was not kept. Real push-up videos will decide it. If real straight arms also read about 140°, the lockout check should move to the shoulder-to-wrist distance.
