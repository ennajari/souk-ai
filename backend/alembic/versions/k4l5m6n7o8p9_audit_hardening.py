"""Audit hardening: admin flag, token revocation, locale fields, idempotency keys, enum/type drift.

Revision ID: k4l5m6n7o8p9
Revises: j3k4l5m6n7o8
Create Date: 2026-11-08

Additive and reversible. Enum values added with ADD VALUE cannot be dropped on downgrade
(PostgreSQL limitation) — they are harmless if left in place.
"""
import os

import sqlalchemy as sa
from alembic import op

revision = "k4l5m6n7o8p9"
down_revision = "j3k4l5m6n7o8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drift: models declare these payment methods, fresh databases did not have them (card payments → 500)
    with op.get_context().autocommit_block():
        op.execute("ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'NFC_BANK'")
        op.execute("ALTER TYPE paymentmethod ADD VALUE IF NOT EXISTS 'NFC_SOUKCARD'")

    # 2. Drift: customers.is_active was created as INTEGER by e5f6a7b8c9d0, model compares to boolean
    op.execute("""
        DO $$ BEGIN
          IF (SELECT data_type FROM information_schema.columns
              WHERE table_name='customers' AND column_name='is_active') = 'integer' THEN
            ALTER TABLE customers ALTER COLUMN is_active DROP DEFAULT;
            ALTER TABLE customers ALTER COLUMN is_active TYPE BOOLEAN USING (is_active <> 0);
            ALTER TABLE customers ALTER COLUMN is_active SET DEFAULT true;
          END IF;
        END $$;
    """)

    # 3. Server-side admin role + JWT revocation + locale
    op.add_column("merchants", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("merchants", sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("merchants", sa.Column("country_code", sa.String(2), nullable=False, server_default="MA"))
    op.add_column("merchants", sa.Column("currency", sa.String(3), nullable=False, server_default="MAD"))
    op.add_column("merchants", sa.Column("timezone", sa.String(64), nullable=False,
                                         server_default="Africa/Casablanca"))
    # Seed the admin from ADMIN_PHONE only (phone is unique and needs that account's password);
    # never from email, which any user could set. Later admins: scripts/grant_admin.py
    admin_phone = os.getenv("ADMIN_PHONE", "").strip()
    if admin_phone:
        op.execute(sa.text("UPDATE merchants SET is_admin = true WHERE phone_number = :p").bindparams(p=admin_phone))

    # 4. Idempotent POS checkout (double tap, offline queue replay)
    op.create_table(
        "idempotency_keys",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("merchant_id", sa.String(36), sa.ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False),
        sa.Column("key", sa.String(100), nullable=False),
        sa.Column("response", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("merchant_id", "key", name="uq_idempotency_merchant_key"),
    )

    # 5. Hot query paths without index (dashboard/analytics/forecast scan by merchant + date)
    op.create_index("ix_transactions_merchant_created", "transactions", ["merchant_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_transactions_merchant_created", table_name="transactions")
    op.drop_table("idempotency_keys")
    for col in ("timezone", "currency", "country_code", "token_version", "is_admin"):
        op.drop_column("merchants", col)
    # customers.is_active stays BOOLEAN (the model expects it); enum values cannot be removed.
