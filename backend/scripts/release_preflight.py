"""Read-only deployment configuration review. Never prints environment values or sends mail."""
import argparse
import json
import os
from pathlib import Path
import shutil
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from services.production_config import validate_production, valid_https_origin

def inspect_configuration():
    checks=[]
    def add(name, ok, action):
        checks.append({"check":name,"status":"pass" if ok else "blocked","action":"" if ok else action})
    add("production_mode",os.getenv("APP_ENV")=="production","Use APP_ENV=production on the deployment host.")
    try:
        validate_production()
        valid=os.getenv("APP_ENV")=="production"
    except (RuntimeError, ValueError):
        valid=False
    add("api_security_configuration",valid,"Configure a unique signing secret, HTTPS origins, non-mock inference and a valid AI quota.")
    add("public_origin",valid_https_origin(os.getenv("PUBLIC_APP_URL","")),"Configure PUBLIC_APP_URL as one explicit HTTPS origin.")
    from services.account_mail import configuration
    try:
        configuration(); mail_ok=True
    except (RuntimeError, ValueError):
        mail_ok=False
    add("mail_configuration",mail_ok,"Set PUBLIC_APP_URL, SMTP_HOST and SMTP_FROM; verify real delivery separately.")
    add("database_configuration",all(os.getenv(name) for name in ("DB_HOST","DB_USER","DB_PASSWORD","DB_NAME")),"Configure database connection fields on the server.")
    add("ai_provider_configuration",bool(os.getenv("OPENROUTER_API_KEY")),"Configure the server-only AI provider key, or keep AI unavailable explicitly.")
    add("container_cli_present",bool(shutil.which("docker")),"Validate containers on a Docker-capable deployment host.")
    return {"scope":"configuration_only","configuration_passed":all(row["status"]=="pass" for row in checks),
            "launch_ready":False,"checks":checks,"required_runtime_evidence":[
                "HTTPS/session and real email-delivery smoke tests",
                "Database plus uploaded-file backup restoration drill",
                "Built-image security review, load test and rollback drill",
                "Accessible physical-device customer journeys",
                "Independent nutrition benchmark and beta/customer economics",
                "Packaged frontend source available to remote CI"],
            "note":"Configuration presence does not validate credentials, services, accuracy or market readiness."}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file",type=Path,help="Explicit server environment file; values are never printed.")
    args=parser.parse_args()
    if args.env_file:
        from dotenv import load_dotenv
        if not args.env_file.is_file(): parser.error("Environment file was not found.")
        load_dotenv(args.env_file,override=True)
    report=inspect_configuration()
    print(json.dumps(report,indent=2))
    return 0 if report["configuration_passed"] else 1

if __name__=="__main__": raise SystemExit(main())
