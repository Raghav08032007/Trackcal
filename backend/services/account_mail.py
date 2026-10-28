"""Explicitly configured SMTP transport. Never logs messages, addresses or action tokens."""
import os
import smtplib
import ssl
from email.message import EmailMessage
from urllib.parse import urlsplit

def configuration():
    base = os.getenv("PUBLIC_APP_URL", "").rstrip("/")
    parsed = urlsplit(base)
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise RuntimeError("Email delivery requires a valid PUBLIC_APP_URL.")
    if parsed.scheme != "https" and not (os.getenv("APP_ENV") != "production" and parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")):
        raise RuntimeError("Public email links require HTTPS.")
    if not os.getenv("SMTP_HOST") or not os.getenv("SMTP_FROM"):
        raise RuntimeError("Email delivery is not configured.")
    return base

def deliver(address: str, purpose: str, token: str):
    base = configuration()
    reset = purpose == "reset"
    message = EmailMessage()
    message["Subject"] = "Reset your TrackCal password" if reset else "Verify your TrackCal email"
    message["From"] = os.environ["SMTP_FROM"]
    message["To"] = address
    route = "reset-password" if reset else "verify-email"
    message.set_content(f"Use this one-time link to {'reset your password' if reset else 'verify your email'}:\n\n{base}/{route}#token={token}\n\nThe link expires in {'30 minutes' if reset else '24 hours'}. If you did not request this, ignore this email. TrackCal will never ask you to reply with your password.")
    use_ssl = os.getenv("SMTP_SSL", "false").lower() == "true"
    transport = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
    with transport(os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "465" if use_ssl else "587")), timeout=10, **({"context": ssl.create_default_context()} if use_ssl else {})) as smtp:
        if not use_ssl: smtp.starttls(context=ssl.create_default_context())
        if os.getenv("SMTP_USER"): smtp.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
        smtp.send_message(message)
