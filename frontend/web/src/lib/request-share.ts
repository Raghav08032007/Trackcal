// Identical GET requests to /api/ that are in flight at the same moment share one network request. A page and the
// layout often ask for the same thing while the app starts (the session, the day's plan, the adventure summary); on a
// slow phone each extra request costs a round trip. Rules that keep this safe:
// - only GETs are shared, and only while in flight: nothing is cached once the answer arrives;
// - any other request (a save) forgets what is in flight, so a GET that starts after a save never gets older data;
// - each caller keeps its own cancel signal: cancelling one caller rejects only that caller, never the shared request.
const inflight = new Map<string, Promise<Response>>();
const SHARED_TIMEOUT_MS = 20000;

export function forgetInflight() { inflight.clear(); }

export function shareGet(key: string, start: (signal: AbortSignal) => Promise<Response>, signal?: AbortSignal | null): Promise<Response> {
  let pending = inflight.get(key);
  if (!pending) {
    const request = start(AbortSignal.timeout(SHARED_TIMEOUT_MS));
    pending = request;
    inflight.set(key, request);
    const clear = () => { if (inflight.get(key) === request) inflight.delete(key); };
    request.then(clear, clear);
  }
  const mine = pending.then(response => response.clone());   // the shared response is never read itself, so each caller gets a full copy
  if (!signal) return mine;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    mine.then(value => { signal.removeEventListener("abort", onAbort); resolve(value); }, error => { signal.removeEventListener("abort", onAbort); reject(error); });
  });
}
