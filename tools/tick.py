"""Local scheduler for development: calls POST /internal/tick once a minute, so reminders, social notifications and the Monday
email go out while you run the app on your own machine. In production use an always-on worker or a cron job instead
(docs/PUSH_NOTIFICATIONS.md); this script is the same call, on a loop.

    backend/.venv/Scripts/python tools/tick.py                 # every minute, against http://127.0.0.1:8000
    backend/.venv/Scripts/python tools/tick.py --once --url http://127.0.0.1:8013

Reads TICK_SECRET from backend/.env and never prints it. Prints only counts (nothing personal).
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def secret():
    value = os.getenv('TICK_SECRET', '')
    env = Path(__file__).resolve().parents[1] / 'backend' / '.env'
    if not value and env.exists():
        for line in env.read_text(encoding='utf-8').splitlines():
            if line.startswith('TICK_SECRET='):
                value = line.split('=', 1)[1].strip().strip('"').strip("'")
    if len(value) < 32:
        sys.exit('TICK_SECRET (32+ characters) is not set in backend/.env.')
    return value


def tick(url, key):
    request = urllib.request.Request(url, method='POST', headers={'X-Tick-Secret': key})
    try:
        with urllib.request.urlopen(request, timeout=55) as response:
            return response.status, json.loads(response.read() or b'{}')
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read() or b'{}')
        except ValueError:
            return error.code, {}
    except OSError as error:
        return 0, {'error': f'not reachable ({error.__class__.__name__})'}


def main():
    parser = argparse.ArgumentParser(description='Run the TrackCal scheduler locally.')
    parser.add_argument('--url', default='http://127.0.0.1:8000', help='the API, without /internal/tick')
    parser.add_argument('--once', action='store_true', help='one pass, then exit')
    parser.add_argument('--every', type=int, default=60, help='seconds between passes (default 60)')
    args = parser.parse_args()
    key, url = secret(), args.url.rstrip('/') + '/internal/tick'
    while True:
        status, body = tick(url, key)
        stamp = time.strftime('%H:%M:%S')
        if status == 200:
            print(stamp, 'ok', {k: body[k] for k in ('planned', 'sent', 'skipped', 'failed', 'pending', 'emailed') if k in body}, flush=True)
        elif status == 503:
            print(stamp, 'push not configured; emailed:', body.get('emailed', 0), flush=True)
        elif status == 404:
            print(stamp, 'refused: the API has a different TICK_SECRET', flush=True)
        else:
            print(stamp, 'failed', status, body.get('error', ''), flush=True)
        if args.once:
            return 0 if status in (200, 503) else 1
        time.sleep(max(10, args.every))


if __name__ == '__main__':
    sys.exit(main())
