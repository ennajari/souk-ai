from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "souk_ai",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Africa/Casablanca",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        # Daily low-stock alerts at 09:00 Casablanca time
        "low-stock-alerts-daily": {
            "task": "send_low_stock_alerts",
            "schedule": crontab(hour=9, minute=0),
        },
        # Nightly forecast update at 01:00
        "update-forecasts-nightly": {
            "task": "update_forecasts",
            "schedule": crontab(hour=1, minute=0),
        },
        # Weekly summary every Monday at 08:00
        "weekly-summary-monday": {
            "task": "send_weekly_summary",
            "schedule": crontab(day_of_week="monday", hour=8, minute=0),
        },
        # Credit score update every Sunday at 02:00
        "update-credit-scores-weekly": {
            "task": "update_credit_scores",
            "schedule": crontab(day_of_week="sunday", hour=2, minute=0),
        },
        # Daily sales report every night at 00:00 (midnight)
        "daily-sales-report-midnight": {
            "task": "send_daily_sales_report",
            "schedule": crontab(hour=0, minute=0),
        },
        # Daily karni (credit) reminders at 10:00 Casablanca time
        "karni-reminders-daily": {
            "task": "send_karni_reminders",
            "schedule": crontab(hour=10, minute=0),
        },
        # Daily expiry alerts at 08:00 — products expiring within 3 days
        "expiry-alerts-daily": {
            "task": "send_expiry_alerts",
            "schedule": crontab(hour=8, minute=0),
        },
    },
)

celery_app.autodiscover_tasks(["workers"])
