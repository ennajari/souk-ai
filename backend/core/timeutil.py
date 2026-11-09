"""Day/month boundaries in the merchant's own timezone ("today" in Casablanca is not "today" in UTC)."""
import calendar
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def merchant_zone(merchant) -> ZoneInfo:
    try:
        return ZoneInfo(getattr(merchant, "timezone", None) or "Africa/Casablanca")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def local_today(zone: ZoneInfo, now: datetime | None = None) -> date:
    return (now or datetime.now(timezone.utc)).astimezone(zone).date()


def day_start_utc(day: date, zone: ZoneInfo) -> datetime:
    """UTC instant of local midnight for `day` (DST-safe)."""
    return datetime.combine(day, time.min, tzinfo=zone).astimezone(timezone.utc)


def month_start(day: date, months_back: int = 0) -> date:
    y, m = day.year, day.month - months_back
    while m <= 0:
        y, m = y - 1, m + 12
    return date(y, m, 1)


def local_date(dt: datetime, zone: ZoneInfo) -> date:
    return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(zone).date()


def days_in_month(day: date) -> int:
    return calendar.monthrange(day.year, day.month)[1]


def days_back(day: date, n: int) -> date:
    return day - timedelta(days=n)
