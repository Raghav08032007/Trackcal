# Usability session script

Each session takes 30–40 minutes. Run it with 5 participants per version, and the same 6 tasks for every version. If you test A and B with the same people, alternate which version comes first: P1, P3 and P5 see A first; P2 and P4 see B first.

## Before the session

- **Device.** Use a mid-range Android phone (about 360 px wide) running Chrome, on normal Wi-Fi. Don't use the facilitator's own account.
- **Account.** Reset the demo account with `python tools/bench/seed.py`. It must be against the test database, never the real one. Then sign in on the phone as `bench-demo@tests.example.com`.
  - For task 1, use a guest window instead (it is a sign-up).
- **Recording.** Use screen recording only, without face video, and only if the participant agreed on the consent form.
- **Paperwork.** Have the recording sheet (`RECORDING_SHEET.md`) and the SUS form (`SUS.md`) ready.

## Introduction (read aloud)

> Thanks for helping. We're testing the app, not you, so there are no wrong answers. If something is confusing, that's exactly what we need to find. Please think aloud as you go: say what you're looking for and what you expect to happen. I can't help during a task, but you can stop or skip any task at any time. Is it OK if I record the screen? No faces or voices are kept beyond our notes.

## Tasks

Read each task exactly as written, and don't name any buttons. Start the timer when you finish reading, and stop it when the participant says they are done or gives up.

**Time limits.** Each task has a limit. When it runs out, record the task as "not completed" and move on.

| # | Task (read aloud) | Start screen | Success means | Limit |
|---|---|---|---|---|
| 1 | "You've just heard about this app. Make an account and log what you had for breakfast: two idlis, about 150 calories." | Sign-up page (guest) | A meal is in the diary | 4 min |
| 2 | "You just had a bowl of rice. Log it by searching for it." | Home | A rice item is in today's diary | 2 min |
| 3 | "You eat idli with sambar almost every morning. Log it again as quickly as you can." | Home | Idli with sambar is in today's diary | 1 min |
| 4 | "Scan or type the barcode on this card (8909999000010). If the app doesn't know it, log the snack another way." | Home | A meal is logged after the not-found message | 3 min |
| 5 | "You just drank a glass of water. Record it." | Home | Water goes up | 1 min |
| 6 | "Do a short workout: one set of 10 wall push-ups, about 5 minutes. Record it and finish." | Home | The session is completed | 3 min |

After each task, ask: **"On a scale of 1 (very hard) to 7 (very easy), how easy was that?"** This is the Single Ease Question (SEQ).

**Observing.** Note what you see without interpreting it, for example "tapped Play looking for food" or "paused 8 s on the diary".

## After the tasks

1. Hand over the SUS form (`SUS.md`). The participant fills it in alone.
2. Ask three open questions:
   - What was the most frustrating moment?
   - What would make you open this every day?
   - Anything else?
3. Thank them. Then delete the recording once your notes are written up, and within 30 days at the latest.

## Reporting (per version)

Report, for each version:

- **Per task**: completion rate, median time, median SEQ, and the main issues seen (an issue counts if 2 or more of the 5 participants hit it).
- **Overall**: mean SUS. 68 is the industry average; above 80 is good.

With 5 participants, report numbers as observations, not as statistically significant differences.
