"""The activity maths on tracks whose true answers are known, with the noise and glitches real phones produce."""
import math
import random

import pytest

from services import activity_stats as stats

LAT0, LON0 = 12.9716, 77.5946  # Bengaluru


def at(north_m, east_m):
    return LAT0 + north_m / 111195, LON0 + east_m / (111195 * math.cos(math.radians(LAT0)))


def track(legs, noise=0.0, every=1.0, acc=5.0, seed=1, alt=None):
    """legs: [(seconds, speed m/s)] heading east. noise: GPS wander in metres (standard deviation)."""
    rng = random.Random(seed)
    fixes, t, x = [], 0.0, 0.0
    for seconds, speed in legs:
        for _ in range(int(seconds / every)):
            t += every
            x += speed * every
            lat, lon = at(rng.gauss(0, noise), x + rng.gauss(0, noise))
            fixes.append([lat, lon, t * 1000, acc, alt(t, x) if alt else None])
    return fixes


def test_steady_5k_run_is_measured_to_within_one_percent_with_gps_wander():
    # 5 km at 3.33 m/s (5:00 /km), fixes every second, 3 m of wander.
    result = stats.analyse(track([(1500, 10 / 3)], noise=3), 'run')
    assert result['distance_m'] == pytest.approx(5000, rel=0.01)
    assert result['moving_s'] == pytest.approx(1500, abs=15)
    assert [s['km'] for s in result['splits']] == [1, 2, 3, 4, 5]
    for split in result['splits']:
        assert split['pace_s_per_km'] == pytest.approx(300, abs=12)
    best = {b['label']: b['seconds'] for b in result['best_efforts']}
    assert best['1 km'] == pytest.approx(300, abs=10) and best['5 km'] == pytest.approx(1500, abs=15)
    assert '10 km' not in best


@pytest.mark.parametrize('noise', [2, 4, 8])
def test_standing_still_adds_no_distance_and_no_moving_time(noise):
    # Ten minutes standing, even on a phone that under-reports its error (claims 5 m, scatters 8 m).
    result = stats.analyse(track([(600, 0)], noise=noise), 'walk')
    assert result['distance_m'] < 30
    assert result['moving_s'] < 30


def test_a_coffee_stop_is_paused_and_does_not_slow_the_pace():
    # 1 km walk, 5 minutes standing still with GPS wander, 1 km walk.
    result = stats.analyse(track([(750, 4 / 3), (300, 0), (750, 4 / 3)], noise=3), 'walk')
    assert result['distance_m'] == pytest.approx(2000, rel=0.02)
    assert result['elapsed_s'] == pytest.approx(1800, abs=2)
    assert result['moving_s'] == pytest.approx(1500, abs=40)


def test_glitch_jumps_and_rough_fixes_are_dropped():
    fixes = track([(600, 3)], noise=2)
    for k in range(50, len(fixes), 60):
        fixes[k][0] += 0.01          # a 1.1 km jump north and straight back
    for k in range(25, len(fixes), 40):
        fixes[k][3] = 120            # a 120 m accuracy fix
    result = stats.analyse(fixes, 'run')
    assert result['distance_m'] == pytest.approx(1800, rel=0.02)
    assert result['fixes_dropped'] > 20


def test_a_short_spike_is_a_glitch_on_foot():
    # A single fix 100 m off the path: too far for a walker to go and come back, so it is dropped.
    fixes = track([(600, 1.4)], noise=2)
    for k in range(100, len(fixes), 120):
        fixes[k][0] += 100 / 111195
    clean = stats.analyse(track([(600, 1.4)], noise=2), 'walk')['distance_m']
    assert stats.analyse(fixes, 'walk')['distance_m'] == pytest.approx(clean, rel=0.01)


def test_climb_ignores_altitude_noise_and_counts_a_real_hill():
    flat = stats.analyse(track([(900, 3)], alt=lambda t, x: 900 + random.Random(int(t)).gauss(0, 2)), 'run')
    assert flat['elevation_gain_m'] < 10
    hill = stats.analyse(track([(900, 3)], alt=lambda t, x: 900 + min(x, 1350) * 0.05 - max(0, x - 1350) * 0.05), 'run')
    assert hill['elevation_gain_m'] == pytest.approx(67.5, abs=6)
    assert hill['elevation_loss_m'] == pytest.approx(67.5, abs=6)


def test_best_effort_finds_the_fastest_kilometre_anywhere_in_the_run():
    # 2 km easy at 6:00 /km, 1 km hard at 4:00 /km, 1 km easy.
    result = stats.analyse(track([(720, 1000 / 360), (240, 1000 / 240), (360, 1000 / 360)], noise=1), 'run')
    best = {b['label']: b['seconds'] for b in result['best_efforts']}
    assert best['1 km'] == pytest.approx(240, abs=8)
    assert result['max_speed_ms'] == pytest.approx(1000 / 240, rel=0.05)


def test_sparse_fixes_and_bad_input_are_handled():
    sparse = stats.analyse(track([(1200, 3)], every=5, noise=2), 'run')
    assert sparse['distance_m'] == pytest.approx(3600, rel=0.015)
    assert stats.analyse([], 'run')['distance_m'] == 0
    junk = [None, [1], ['a', 2, 3, 4], [float('nan'), 1, 2, 3], [95, 0, 1, 5], [*at(0, 0), 0, 5], [*at(0, 0), 0, 5]]
    assert stats.analyse(junk, 'run')['fixes_used'] == 1
    with pytest.raises(ValueError):
        stats.analyse([], 'swim')


def test_stored_route_is_simplified_but_keeps_its_shape():
    result = stats.analyse(track([(1200, 3)], noise=0.5), 'run')
    assert len(result['route']) < 200
    assert result['route'][-1][4] == pytest.approx(result['distance_m'], abs=1)


def test_hiding_the_start_and_end_of_a_shared_route():
    route = stats.analyse(track([(1000, 3)], noise=0), 'run')['route']
    start, end = route[0], route[-1]
    shared = stats.hide_near(route, [(start[0], start[1], 200), (end[0], end[1], 200)])
    assert shared and all(stats.metres(p, start) > 200 and stats.metres(p, end) > 200 for p in shared)


def winding(speed, seconds, noise, seed=3, turn_every=60):
    """A city walk: straight blocks with right-angle turns, irregular fix spacing like real phones."""
    rng = random.Random(seed)
    fixes, t, x, y, heading, since = [], 0.0, 0.0, 0.0, 0, 0.0
    while t < seconds:
        dt = rng.choice([1, 1, 1, 2, 3])
        t += dt
        since += dt
        if since >= turn_every:
            heading, since = (heading + rng.choice([1, 3])) % 4, 0.0
        dx, dy = [(1, 0), (0, 1), (-1, 0), (0, -1)][heading]
        x, y = x + dx * speed * dt, y + dy * speed * dt
        fixes.append([*at(y + rng.gauss(0, noise), x + rng.gauss(0, noise)), t * 1000, rng.uniform(4, 12)])
    return fixes


@pytest.mark.parametrize('seed', [3, 5, 7])
@pytest.mark.parametrize('sport,speed,noise', [('walk', 1.1, 5), ('walk', 1.4, 3), ('walk', 0.8, 5), ('walk', 1.3, 8), ('run', 3.0, 5), ('run', 4.0, 6), ('ride', 7.0, 4)])
def test_winding_city_route_is_within_three_and_a_half_percent(sport, speed, noise, seed):
    # GPS watches are typically 1-3% off; right-angle corners are rounded a little, as people round them too.
    seconds = 1800
    result = stats.analyse(winding(speed, seconds, noise, seed=seed), sport)
    assert result['distance_m'] == pytest.approx(speed * seconds, rel=0.035)
    assert result['moving_s'] == pytest.approx(seconds, rel=0.03)
