"""Error monitoring. No-op without SENTRY_DSN; never sends request bodies or personal data."""
import logging

from app.config import settings


def init_monitoring(component: str) -> bool:
    if not settings.SENTRY_DSN:
        return False
    import sentry_sdk

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.APP_ENV,
        release="souk-ai@2.0.0",
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        send_default_pii=False,      # phone numbers / customer names stay on our side
        max_request_body_size="never",
    )
    sentry_sdk.set_tag("component", component)
    logging.getLogger("souk_ai").info("error monitoring enabled (%s)", component)
    return True
