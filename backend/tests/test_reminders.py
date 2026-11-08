"""Automatic credit-book reminders: opt-in only, at most weekly (WhatsApp Business policy)."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import update

from core.database import AsyncSessionLocal
from models.customer import CreditEntry
from tests.conftest import register


async def test_reminders_only_to_opted_in_customers_weekly(client, monkeypatch):
    import workers.tasks as tasks
    sent = []

    async def fake_template(to, template_name, language, body_params):
        sent.append((to, template_name))
    monkeypatch.setattr(tasks, "send_template_message", fake_template)

    h = await register(client)
    for name, phone, opt in (("Amina", "0611223344", True), ("Brahim", "0655667788", False)):
        c = (await client.post("/api/v1/customers/", json={"name": name, "phone": phone, "whatsapp_opt_in": opt},
                               headers=h)).json()
        await client.post(f"/api/v1/customers/{c['id']}/entries", json={"type": "CREDIT", "amount": 120}, headers=h)
    async with AsyncSessionLocal() as s:  # last activity 10 days ago
        await s.execute(update(CreditEntry).values(created_at=datetime.now(timezone.utc) - timedelta(days=10)))
        await s.commit()

    await tasks._send_karni_reminders()
    await tasks._send_karni_reminders()  # same week: nothing new
    assert sent == [("212611223344", "karni_reminder")]
