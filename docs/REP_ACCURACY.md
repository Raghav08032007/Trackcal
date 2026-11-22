# Rep counting accuracy (simulated bench)

Measured with `SIM_BENCH=1 npx vitest run tests/rep-bench.test.ts` (frontend/web): every camera exercise filmed 12 times by the
simulated body (tests/sim) on laptops and phones, from angles near the recommended one, with tracking noise and dropped
frames; each rep goes to 65-100% of the full movement. Half reps (12-28% of the movement) and standing still must not count.
Seeds 101-112, which were not used for tuning. Real volunteers' recordings (`npm run rep-eval`) remain the final judge.

| | Before (G3) | After |
|---|---|---|
| Sets counted exactly right | 60% | 73% |
| Sets within one rep | 82% | 88% |
| Real reps counted | 89% | 93% |
| Half-rep sets with a count | 1% | 1% |
| Standing still with a count | 0% | 0% |

What changed: the depth a rep must reach ('down') was calibrated per exercise so a rep to about 60% of the full movement
counts while a quarter rep stays clear of it, as squats already did. 32 exercises changed; changes that made an exercise worse
on the bench were undone. Known weak spots: Superman lifts (a 7-degree movement, too small for one joint angle; needs a
lift-height signal), side bends, pull-ups, reverse flyes on some angles and plank shoulder taps.

## Per exercise (after)

```
exercise        exact  ±1   reps counted   half-rep sets counted   still counted
sidebend           8%   33%    62/86           0%                   0%
superman          25%   42%    66/86           0%                   0%
revfly            25%   50%    67/87           0%                   0%
cleanpress        33%   50%    60/84           0%                   0%
pullup            17%   58%    68/87           0%                   0%
shouldertap       25%   58%    70/87           0%                   0%
sideleg           25%   67%    66/84           0%                   0%
goodmorning       42%   67%    70/87           0%                   0%
front             50%   67%    66/76           0%                   0%
wallpush          33%   75%    74/86           0%                   0%
pushup            42%   75%    74/87           0%                   0%
crunch            42%   75%    74/87           0%                   0%
row               58%   75%    71/83           0%                   0%
decline           58%   75%    76/84           0%                   0%
seatrow           42%   83%    74/84           0%                   0%
dip               42%   83%    72/83           0%                   0%
hammer            50%   83%    78/87           0%                   0%
nordic            50%   83%    78/87           0%                   0%
donkey            58%   83%    80/87           0%                   0%
flutter           58%   83%    77/84           0%                   0%
legext            58%   83%    79/87           0%                   0%
bench             67%   83%    70/76           8%                   0%
kneepush          75%   83%    80/86           0%                   0%
burpee            75%   83%    81/87           0%                   0%
buttkick          75%   83%    76/86           0%                   0%
hspu              75%   83%    72/81           0%                   0%
rdl               58%   92%    77/83           0%                   0%
hipthrust         58%   92%    81/87           0%                   0%
raise             67%   92%    71/76           0%                   0%
bridge            67%   92%    81/87           0%                   0%
overhead          67%   92%    80/86           8%                   8%
conccurl          67%   92%    81/86           0%                   0%
pullover          67%   92%    77/86           0%                   0%
hangleg           67%   92%    78/84           0%                   0%
wcalf             75%   92%    69/76           0%                   0%
kbswing           75%   92%    80/84           0%                   0%
deadlift          83%   92%    83/86           0%                   0%
pikepush          83%   92%    83/86           0%                   0%
incline           92%   92%    82/84           0%                   0%
knee              67%  100%    77/81           0%                   0%
latpull           67%  100%    80/84           8%                   0%
uprow             75%  100%    73/76           0%                   0%
inclinebench      75%  100%    77/80           8%                   0%
kickback          83%  100%    84/86           0%                   0%
skull             83%  100%    74/76           0%                   0%
revcrunch         83%  100%    85/87           0%                   0%
bulgarian         83%  100%    85/87           0%                   0%
highknee          92%  100%    85/86           0%                   0%
climber           92%  100%    83/84           0%                   0%
thruster          92%  100%    85/86           0%                   0%
birddog           92%  100%    83/84           0%                   0%
bicycle           92%  100%    83/84           0%                   0%
punch             92%  100%    75/76           0%                   0%
squat            100%  100%    76/76           0%                   0%
curl             100%  100%    81/81           0%                   0%
press            100%  100%    76/76           8%                   0%
situp            100%  100%    76/76           0%                   0%
lunge            100%  100%    76/76           0%                   0%
jack             100%  100%    81/81           0%                   0%
sumo             100%  100%    81/81           0%                   0%
calf             100%  100%    81/81           0%                   0%
legraise         100%  100%    86/86           0%                   0%
wsquat           100%  100%    87/87           0%                   0%
ohsquat          100%  100%    84/84           0%                   0%
wlunge           100%  100%    87/87           0%                   0%
sidelunge        100%  100%    87/87           0%                   0%
squatjump        100%  100%    87/87           0%                   0%
vup              100%  100%    83/83           0%                   0%
pistol           100%  100%    87/87           0%                   0%
legcurl          100%  100%    84/84           0%                   0%
jumplunge        100%  100%    87/87           0%                   0%
tuckjump         100%  100%    86/86           0%                   0%
snatch           100%  100%    87/87           0%                   0%
```
