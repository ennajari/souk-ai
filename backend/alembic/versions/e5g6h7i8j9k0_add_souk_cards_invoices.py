"""add souk_cards, card_transactions, invoices tables + NFC payment methods

Revision ID: e5g6h7i8j9k0
Revises: d4f5g6h7i8j9
Create Date: 2026-05-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5g6h7i8j9k0'
down_revision = 'd4f5g6h7i8j9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Souk Cards (Carte Souk.AI) ──
    op.create_table(
        "souk_cards",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("card_number", sa.String(16), unique=True, nullable=False, index=True),
        sa.Column("holder_name", sa.String(100), nullable=False),
        sa.Column("holder_phone", sa.String(20), nullable=False, index=True),
        sa.Column("pin_hash", sa.String(128), nullable=False),
        sa.Column("balance", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.Enum("ACTIVE", "SUSPENDED", "EXPIRED", name="cardstatus"), nullable=False, server_default="ACTIVE"),
        sa.Column("nfc_uid", sa.String(32), unique=True, nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Card Transactions ──
    op.create_table(
        "card_transactions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("card_id", sa.String(36), sa.ForeignKey("souk_cards.id"), nullable=False, index=True),
        sa.Column("type", sa.Enum("TOP_UP", "PAYMENT", "REFUND", name="cardtransactiontype"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("balance_after", sa.Numeric(10, 2), nullable=False),
        sa.Column("reference", sa.String(100), nullable=True),
        sa.Column("merchant_id", sa.String(36), sa.ForeignKey("merchants.id"), nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # ── Invoices ──
    op.create_table(
        "invoices",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("merchant_id", sa.String(36), sa.ForeignKey("merchants.id"), nullable=False, index=True),
        sa.Column("customer_name", sa.String(100), nullable=True),
        sa.Column("customer_phone", sa.String(20), nullable=True),
        sa.Column("items", sa.JSON, nullable=False),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MAD"),
        sa.Column("status", sa.Enum("PENDING", "PAID", "EXPIRED", "CANCELLED", name="invoicestatus"), nullable=False, server_default="PENDING"),
        sa.Column("payment_method", sa.Enum("NFC_BANK", "NFC_SOUKCARD", "CASH", "CMI", name="invoicepaymentmethod"), nullable=True),
        sa.Column("payment_ref", sa.String(100), nullable=True),
        sa.Column("token", sa.String(32), unique=True, nullable=False, index=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("invoices")
    op.drop_table("card_transactions")
    op.drop_table("souk_cards")
    op.execute("DROP TYPE IF EXISTS invoicestatus")
    op.execute("DROP TYPE IF EXISTS invoicepaymentmethod")
    op.execute("DROP TYPE IF EXISTS cardtransactiontype")
    op.execute("DROP TYPE IF EXISTS cardstatus")
