"""
Souk.AI Deployment Script
Usage: python deploy.py
Requires: pip install paramiko
"""
import os
import paramiko
from pathlib import Path

HOST = "51.77.145.117"
USER = "ubuntu"
PASSWORD = "spmKyptte6wCAa"
REMOTE_BASE = "/opt/souk-ai"
LOCAL_BASE = Path(__file__).parent

FILES = [
    ("backend/requirements.txt",               "backend/requirements.txt"),
    ("backend/services/ai_engine.py",           "backend/services/ai_engine.py"),
    ("backend/services/whatsapp.py",            "backend/services/whatsapp.py"),
    ("backend/workers/tasks.py",                "backend/workers/tasks.py"),
    ("backend/workers/celery_app.py",           "backend/workers/celery_app.py"),
    ("backend/models/product.py",               "backend/models/product.py"),
    ("backend/alembic/versions/d4e5f6a7b8c9_add_expiry_date_to_products.py",
     "backend/alembic/versions/d4e5f6a7b8c9_add_expiry_date_to_products.py"),
]

REMOTE_COMMANDS = [
    # Update FRONTEND_URL if not set
    "grep -q 'FRONTEND_URL' /opt/souk-ai/backend/.env || echo 'FRONTEND_URL=https://bit.ly/souk_ia' >> /opt/souk-ai/backend/.env",
    # Rebuild containers (reportlab added)
    "cd /opt/souk-ai && docker compose up --build -d 2>&1",
    # Wait for backend to be ready
    "sleep 15",
    # Apply migration
    "cd /opt/souk-ai && docker compose exec -T backend alembic upgrade head",
    # Confirm
    "cd /opt/souk-ai && docker compose ps",
]


def main():
    print(f"Connecting to {USER}@{HOST}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("Connected!")

    # Upload files
    sftp = ssh.open_sftp()
    for local_rel, remote_rel in FILES:
        local_path = LOCAL_BASE / local_rel
        remote_path = f"{REMOTE_BASE}/{remote_rel}"
        print(f"  Uploading {local_rel}...", end=" ")
        sftp.put(str(local_path), remote_path)
        print("OK")
    sftp.close()
    print("All files uploaded!\n")

    # Run commands
    for cmd in REMOTE_COMMANDS:
        print(f"$ {cmd[:80]}...")
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=300)
        out = stdout.read().decode("utf-8", errors="replace").strip()
        err = stderr.read().decode("utf-8", errors="replace").strip()
        if out:
            print(out)
        if err and "warning" not in err.lower():
            print(f"[stderr] {err}")
        print()

    ssh.close()
    print("Deployment complete!")


if __name__ == "__main__":
    main()
