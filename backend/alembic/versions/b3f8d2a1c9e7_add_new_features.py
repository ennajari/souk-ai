"""add conversations, forecasts, credit_history, supplier product_ids, supplier_order merchant_id

Revision ID: b3f8d2a1c9e7
Revises: c9846b219cd3
Create Date: 2026-02-28 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b3f8d2a1c9e7"
down_revision: Union[str, None] = "c9846b219cd3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add VOICE to transactionsource enum
    op.execute("ALTER TYPE transactionsource ADD VALUE IF NOT EXISTS 'VOICE'")

    # Add product_ids to suppliers
    op.add_column("suppliers", sa.Column("product_ids", sa.JSON(), nullable=True))

    # Add merchant_id to supplier_orders
    op.add_column("supplier_orders", sa.Column("merchant_id", sa.String(length=36), nullable=True))
    op.create_index("ix_supplier_orders_merchant_id", "supplier_orders", ["merchant_id"])
    op.create_foreign_key(
        "fk_supplier_orders_merchant_id", "supplier_orders",
        "merchants", ["merchant_id"], ["id"]
    )

    # Create conversation_messages table
    op.create_table(
        "conversation_messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("merchant_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.Enum("USER", "ASSISTANT", name="messagerole"), nullable=False),
        sa.Column("message_type", sa.Enum("TEXT", "VOICE", name="messagetype"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("intent", sa.String(length=50), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_conversation_messages_merchant_id", "conversation_messages", ["merchant_id"])

    # Create forecasts table
    op.create_table(
        "forecasts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("merchant_id", sa.String(length=36), nullable=False),
        sa.Column("product_id", sa.String(length=36), nullable=False),
        sa.Column("forecast_date", sa.Date(), nullable=False),
        sa.Column("predicted_demand", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("confidence_lower", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("confidence_upper", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("restock_recommendation", sa.Integer(), nullable=False),
        sa.Column("factors", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_forecasts_merchant_id", "forecasts", ["merchant_id"])
    op.create_index("ix_forecasts_product_id", "forecasts", ["product_id"])
    op.create_index("ix_forecasts_forecast_date", "forecasts", ["forecast_date"])

    # Create credit_history table
    op.create_table(
        "credit_history",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("merchant_id", sa.String(length=36), nullable=False),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("factors", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_credit_history_merchant_id", "credit_history", ["merchant_id"])


def downgrade() -> None:
    op.drop_index("ix_credit_history_merchant_id", table_name="credit_history")
    op.drop_table("credit_history")
    op.drop_index("ix_forecasts_forecast_date", table_name="forecasts")
    op.drop_index("ix_forecasts_product_id", table_name="forecasts")
    op.drop_index("ix_forecasts_merchant_id", table_name="forecasts")
    op.drop_table("forecasts")
    op.drop_index("ix_conversation_messages_merchant_id", table_name="conversation_messages")
    op.drop_table("conversation_messages")
    op.drop_constraint("fk_supplier_orders_merchant_id", "supplier_orders", type_="foreignkey")
    op.drop_index("ix_supplier_orders_merchant_id", table_name="supplier_orders")
    op.drop_column("supplier_orders", "merchant_id")
    op.drop_column("suppliers", "product_ids")
