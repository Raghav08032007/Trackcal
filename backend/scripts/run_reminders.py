"""Sends due push reminders. Run it from cron with --once, or leave it running: python scripts/run_reminders.py [--once] [--every 300]"""
import argparse, sys, time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import database
from services import notifications


def run_once():
    send = notifications.webpush_sender()
    if send is None: raise SystemExit('Set VAPID_PRIVATE_KEY and VAPID_SUBJECT first.')
    return notifications.tick(database.SessionLocal, send)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--once', action='store_true'); parser.add_argument('--every', type=int, default=300)
    options = parser.parse_args()
    while True:
        try: print(run_once(), flush=True)
        except Exception as failure: print('Reminder run failed:', type(failure).__name__, flush=True)  # the next run retries; no details that could hold secrets
        if options.once: break
        time.sleep(max(60, options.every))
