"""Create a local Grocy API key, verify it and save it server-side without printing it."""
from datetime import datetime, timedelta
from pathlib import Path
import re
import secrets
import sqlite3
import requests

backend = Path(__file__).resolve().parents[1]
database = backend / "runtime" / "grocy" / "data" / "grocy.db"
if not database.exists(): raise SystemExit("Start Grocy and open its local homepage to initialize it first.")
with sqlite3.connect(database) as connection:
    existing = connection.execute("SELECT api_key FROM api_keys WHERE description=?", ("TrackCal local connector",)).fetchone()
    if existing: key = existing[0]
    else:
        user = connection.execute("SELECT id FROM users WHERE username='admin'").fetchone()
        if not user: raise SystemExit("No local Grocy administrator found; create an API key in Grocy instead.")
        key = secrets.token_hex(32)
        expires = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d %H:%M:%S")
        connection.execute("INSERT INTO api_keys(api_key,user_id,expires,key_type,description) VALUES(?,?,?,'default',?)", (key, user[0], expires, "TrackCal local connector"))
result = requests.get("http://127.0.0.1:9283/api/stock", headers={"GROCY-API-KEY": key}, timeout=15)
result.raise_for_status()
assert isinstance(result.json(), list)
env = backend / ".env"
text = env.read_text()
for name, value in {"GROCY_URL": "http://127.0.0.1:9283", "GROCY_API_KEY": key}.items():
    if re.search(r"(?m)^" + name + "=", text): text = re.sub(r"(?m)^" + name + r"=.*$", lambda _: name + "=" + value, text)
    else: text += "\n" + name + "=" + value + "\n"
env.write_text(text)
print("PASS: real Grocy stock API authenticated; 30-day key saved server-side. Configure INTEGRATION_OWNER_ID before reading it through TrackCal.")
