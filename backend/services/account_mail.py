"""Explicitly configured SMTP transport. Never logs messages, addresses or action tokens.

For development and tests, MAIL_OUTBOX=<folder> writes each message there as an .eml file instead of sending it, so every email can be
checked before SMTP keys exist. It is refused in production."""
import os
import smtplib
import ssl
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from pathlib import Path
from urllib.parse import urlsplit
from services.i18n import msg, tr

DEFAULT_FROM = "TrackCal <no-reply@localhost>"
# The email bodies, sent in the language of the request that asked for them (sign-up, forgot password).
RESET = msg("Use this one-time link to reset your password:{link}The link expires in 30 minutes. If you did not request this, ignore this email. "
            "TrackCal will never ask you to reply with your password.")
VERIFY = msg("Use this one-time link to verify your email:{link}The link expires in 24 hours. If you did not request this, ignore this email. "
             "TrackCal will never ask you to reply with your password.")


def configuration():
    base = os.getenv("PUBLIC_APP_URL", "").rstrip("/")
    parsed = urlsplit(base)
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        raise RuntimeError("Email delivery requires a valid PUBLIC_APP_URL.")
    if parsed.scheme != "https" and not (os.getenv("APP_ENV") != "production" and parsed.scheme == "http" and parsed.hostname in ("localhost", "127.0.0.1")):
        raise RuntimeError("Public email links require HTTPS.")
    if not outbox() and (not os.getenv("SMTP_HOST") or not os.getenv("SMTP_FROM")):
        raise RuntimeError("Email delivery is not configured.")
    return base


def outbox():
    """The development outbox folder, or None. Never used in production."""
    folder = os.getenv("MAIL_OUTBOX", "").strip()
    return Path(folder) if folder and os.getenv("APP_ENV") != "production" else None


def send(message: EmailMessage):
    """Send one message by SMTP, or write it to the development outbox."""
    if not message["From"]:
        message["From"] = os.getenv("SMTP_FROM") or DEFAULT_FROM
    folder = outbox()
    if folder:
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{datetime.now(timezone.utc):%Y%m%dT%H%M%S}-{uuid.uuid4().hex[:8]}.eml").write_bytes(bytes(message))
        return
    use_ssl = os.getenv("SMTP_SSL", "false").lower() == "true"
    transport = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
    with transport(os.environ["SMTP_HOST"], int(os.getenv("SMTP_PORT", "465" if use_ssl else "587")), timeout=10, **({"context": ssl.create_default_context()} if use_ssl else {})) as smtp:
        if not use_ssl: smtp.starttls(context=ssl.create_default_context())
        if os.getenv("SMTP_USER"): smtp.login(os.environ["SMTP_USER"], os.environ.get("SMTP_PASSWORD", ""))
        smtp.send_message(message)


def deliver(address: str, purpose: str, token: str):
    base = configuration()
    reset = purpose == "reset"
    message = EmailMessage()
    message["Subject"] = tr("Reset your TrackCal password") if reset else tr("Verify your TrackCal email")
    message["From"] = os.getenv("SMTP_FROM") or DEFAULT_FROM
    message["To"] = address
    route = "reset-password" if reset else "verify-email"
    link = f'{base}/{route}#token={token}'
    message.set_content(tr(RESET if reset else VERIFY).replace('{link}', '\n\n' + link + '\n\n'))   # the link on its own lines, never translated
    send(message)
