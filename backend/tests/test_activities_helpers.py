"""Synthetic GPS tracks for the activity tests: heading east from a fixed point, a fix a second, a little wander."""
import math
import random

LAT0, LON0 = 12.9716, 77.5946


def fixes_for(legs, noise=2.0, seed=1):
    rng = random.Random(seed)
    out, t, x = [], 0.0, 0.0
    for seconds, speed in legs:
        for _ in range(int(seconds)):
            t += 1
            x += speed
            out.append([LAT0 + rng.gauss(0, noise) / 111195, LON0 + (x + rng.gauss(0, noise)) / (111195 * math.cos(math.radians(LAT0))), t * 1000, 5])
    return out
