"""Phase G: segments. Made from a stretch of your own run; every later pass along it is timed from the route; direction, detours and
parallel streets don't count; public segments never touch privacy zones or a route's hidden ends; the friends ranking shows only
people who opted in and follow each other, from activities the viewer may see."""
import math
import random
from datetime import datetime, timedelta, timezone

import pytest

import database, models

from services import segments as seg
from tests.client import client
from tests.test_activities_helpers import LAT0, LON0
from tests.test_social import member

A = '/api/v1/activities'
SEG = A + '/segments'
S = '/api/v1/social'
K = 111195 * math.cos(math.radians(LAT0))


@pytest.fixture(autouse=True)
def flag_on(monkeypatch):
    monkeypatch.setenv('FEATURE_SOCIAL_FEED', 'true')


def track(speed, metres=5000, start=0.0, west=False, north=0.0, noise=2.0, seed=1):
    """A fix a second along a straight street running east (or west), `north` metres off it."""
    rng, out, x = random.Random(seed), [], start
    for t in range(1, int(metres / speed) + 1):
        x += -speed if west else speed
        out.append([LAT0 + (north + rng.gauss(0, noise)) / 111195, LON0 + (x + rng.gauss(0, noise)) / K, t * 1000, 5])
    return out


def run(h, speed=10 / 3, visibility='private', minutes_ago=90, **kw):
    started = (datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)).isoformat()
    r = client.post(A, headers=h, json={'sport': 'run', 'started_at': started, 'visibility': visibility, 'fixes': track(speed, **kw)})
    assert r.status_code == 201, r.text
    return r.json()['activity']


def make(h, activity, start=1000, end=2000, visibility='public', name='Riverside kilometre'):
    return client.post(SEG, headers=h, json={'activity_id': activity['id'], 'name': name, 'start_m': start, 'end_m': end, 'visibility': visibility})


def test_a_segment_is_cut_from_your_run_and_times_every_later_pass():
    _, h, _ = member()
    first = run(h)                                         # 5 km at 3.33 m/s
    r = make(h, first)
    assert r.status_code == 201, r.text
    s = r.json()['segment']
    assert s['distance_m'] == pytest.approx(1000, rel=0.03) and s['attempts'] == 1
    assert s['best']['elapsed_s'] == pytest.approx(300, rel=0.06)          # 1 km at 3.33 m/s
    fast = run(h, speed=4.0, minutes_ago=30)
    assert fast['segments'] and fast['segments'][0]['place'] == 1
    assert fast['segments'][0]['elapsed_s'] == pytest.approx(250, rel=0.06)
    again = client.get(f'{SEG}/{s["id"]}', headers=h).json()['segment']
    assert again['attempts'] == 2 and again['best']['activity_id'] == fast['id'] and len(again['history']) == 2
    slow = run(h, speed=2.5, minutes_ago=10)
    assert slow['segments'][0]['place'] == 3
    # 237.9 is stored as single precision (reads back 237.89999): a pass must never count as faster than itself.
    with database.SessionLocal() as db:
        db.query(models.SegmentEffort).filter_by(activity_id=fast['id']).update({'elapsed_s': 237.9})
        db.commit()
    assert client.get(f'{A}/{fast["id"]}', headers=h).json()['activity']['segments'][0]['place'] == 1
    listed = client.get(SEG, headers=h).json()
    assert [x['id'] for x in listed['segments']] == [s['id']] and listed['ranking'] is False


def test_only_a_pass_in_the_right_direction_along_the_line_counts():
    _, h, _ = member()
    s = make(h, run(h)).json()['segment']
    assert run(h, west=True, start=5000, minutes_ago=60)['segments'] == []      # the same street, the other way
    assert run(h, north=150, minutes_ago=50)['segments'] == []                  # a parallel street 150 m away
    assert run(h, metres=1500, minutes_ago=40)['segments'] == []                # stops half way along
    laps = seg.efforts(client.get(f'{SEG}/{s["id"]}', headers=h).json()['segment']['points'], s['distance_m'],
                       [[LAT0, LON0 + x / K, x / 4.0, None, x] for x in range(0, 5001, 50)])
    assert len(laps) == 1 and laps[0][1] == pytest.approx(250, rel=0.05)


def test_public_segments_avoid_privacy_zones_and_the_hidden_ends_of_a_route():
    _, h, _ = member()
    activity = run(h)
    assert make(h, activity, start=50, end=600).status_code == 422             # inside the first 200 m
    client.post(A + '/privacy-zones', headers=h, json={'label': 'Home', 'lat': LAT0, 'lon': LON0 + 1500 / K, 'radius_m': 200})
    blocked = make(h, activity)
    assert blocked.status_code == 422 and 'privacy zone' in blocked.json()['detail']
    assert make(h, activity, visibility='private').status_code == 201         # private: seen by its creator only
    assert make(h, activity, start=1000, end=1100).status_code == 422          # shorter than 200 m
    assert make(h, activity, start=2000, end=1000).status_code == 422


def test_private_segments_and_other_peoples_activities_stay_private():
    _, owner, _ = member()
    _, other, _ = member()
    private = make(owner, run(owner), visibility='private').json()['segment']
    assert client.get(f'{SEG}/{private["id"]}', headers=other).status_code == 404
    assert run(other, minutes_ago=20)['segments'] == []                        # a private segment never times anyone else
    mine = run(owner, minutes_ago=30)
    assert client.post(SEG, headers=other, json={'activity_id': mine['id'], 'name': 'Taken', 'start_m': 1000, 'end_m': 2000}).status_code == 404
    assert client.delete(f'{SEG}/{private["id"]}', headers=other).status_code == 404
    assert client.delete(f'{SEG}/{private["id"]}', headers=owner).status_code == 204
    assert client.get(f'{SEG}/{private["id"]}', headers=owner).status_code == 404


def follow_each_other(a, a_handle, b, b_handle):
    assert client.post(f'{S}/follow/{b_handle}', headers=a).json()['status'] == 'active'
    assert client.post(f'{S}/follow/{a_handle}', headers=b).json()['status'] == 'active'


def test_the_friends_ranking_is_opt_in_mutual_and_respects_visibility_and_blocks():
    _, a, a_handle = member()
    _, b, b_handle = member()
    _, c, c_handle = member()
    follow_each_other(a, a_handle, b, b_handle)
    assert client.post(f'{S}/follow/{a_handle}', headers=c).json()['status'] == 'active'   # c follows a, a doesn't follow c
    s = make(a, run(a)).json()['segment']
    run(b, speed=4.0, visibility='followers', minutes_ago=30)
    run(c, speed=5.0, visibility='everyone', minutes_ago=30)
    view = lambda h: client.get(f'{SEG}/{s["id"]}', headers=h).json()['segment']['ranking']
    assert view(a) == {'opted_in': False, 'entries': []}                    # no ranking until you opt in
    for h in (a, b, c):
        assert client.patch(SEG + '/settings', headers=h, json={'ranking': True}).json() == {'ranking': True}
    entries = view(a)['entries']
    assert [e['handle'] for e in entries] == [b_handle, a_handle]           # b is faster; c isn't mutual, so isn't shown
    assert entries[1]['me'] and entries[0]['place'] == 1
    client.patch(SEG + '/settings', headers=b, json={'ranking': False})
    assert [e['handle'] for e in view(a)['entries']] == [a_handle]          # b opted out
    client.patch(SEG + '/settings', headers=b, json={'ranking': True})
    run(b, speed=6.0, visibility='private', minutes_ago=5)                   # b's fastest pass is private: not shown
    assert view(a)['entries'][0]['elapsed_s'] == pytest.approx(250, rel=0.06)
    client.post(f'{S}/block/{a_handle}', headers=b, json={'kind': 'block'})
    assert [e['handle'] for e in view(a)['entries']] == [a_handle]          # a block hides both ways


def test_a_perfectly_straight_street_is_still_matched():
    """Box limits are stored in single precision; a route with no wobble at all must still find its segment."""
    _, h, _ = member()
    s = make(h, run(h, noise=0.0, seed=3)).json()['segment']
    assert run(h, speed=4.0, noise=0.0, minutes_ago=30)['segments'][0]['segment_id'] == s['id']


def test_efforts_of_a_deleted_activity_disappear():
    _, h, _ = member()
    s = make(h, run(h)).json()['segment']
    later = run(h, speed=5.0, minutes_ago=10)
    assert client.get(f'{SEG}/{s["id"]}', headers=h).json()['segment']['best']['activity_id'] == later['id']
    assert client.delete(f'{A}/{later["id"]}', headers=h).status_code == 204
    after = client.get(f'{SEG}/{s["id"]}', headers=h).json()['segment']
    assert after['attempts'] == 1 and after['best']['activity_id'] != later['id']
