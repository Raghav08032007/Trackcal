import os
from urllib.parse import urlsplit

def valid_https_origin(value):
    try:
        parsed = urlsplit(value)
        port = parsed.port
        return bool(parsed.scheme == "https" and parsed.hostname and "*" not in parsed.netloc
                    and not any(char.isspace() for char in value)
                    and not parsed.username and not parsed.password
                    and parsed.path in ("", "/") and not parsed.query and not parsed.fragment
                    and (port is None or 1 <= port <= 65535))
    except ValueError:
        return False

def validate_production():
    if os.getenv("APP_ENV") != "production": return
    secret = os.getenv("APP_SECRET_KEY", "")
    if len(secret) < 32 or any(marker in secret.lower() for marker in ("change_me", "change-me", "your_secret", "your-secret")): raise RuntimeError("Production requires a unique APP_SECRET_KEY of at least 32 characters, not a template placeholder.")
    if os.getenv("AI_MOCK_MODE", "false").lower() == "true": raise RuntimeError("Mock inference is forbidden in production.")
    origins = [item.strip() for item in os.getenv("CORS_ORIGINS", "").split(",") if item.strip()]
    if not origins or any(not valid_https_origin(item) for item in origins): raise RuntimeError("Production CORS origins must be explicit HTTPS origins without credentials, wildcards, paths, queries or fragments.")
    if os.getenv("JWT_ALGORITHM", "HS256") != "HS256": raise RuntimeError("This deployment supports HS256 tokens only.")
    try:
        if not 1 <= int(os.getenv("DAILY_AI_LIMIT", "15")) <= 1000: raise ValueError()
    except ValueError: raise RuntimeError("DAILY_AI_LIMIT must be between 1 and 1000.")
