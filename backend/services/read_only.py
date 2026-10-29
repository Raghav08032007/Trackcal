"""Lock-free reads for the adventure summary (KI-15).

GET /adventure/summary used to lock the user's rows on every read because the same code may also persist newly
earned achievements and character unlocks. Now it first runs with READ_ONLY set: no FOR UPDATE locks, and the first
attempt to write raises NeedsWrite. The endpoint then rolls back and reruns the normal locked path, so writes keep
exactly the same locking and integrity as before."""
from contextvars import ContextVar

READ_ONLY = ContextVar('trackcal_read_only', default=False)


class NeedsWrite(Exception):
    pass


def locked(query):
    return query if READ_ONLY.get() else query.with_for_update()


def writing():
    if READ_ONLY.get(): raise NeedsWrite()
