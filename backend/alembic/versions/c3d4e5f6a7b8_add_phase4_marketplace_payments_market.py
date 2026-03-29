"""add phase4 marketplace payments market intelligence

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Marketplace Listings ──
    op.create_table(
        "marketplace_listings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("merchant_id", sa.String(36), sa.ForeignKey("merchants.id"), nullable=False, index=True),
        sa.Column("product_id", sa.String(36), sa.ForeignKey("products.id"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("category", sa.String(50), nullable=False, server_default="OTHER"),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("min_quantity", sa.Integer, nullable=False, server_default="1"),
        sa.Column("available_quantity", sa.Integer, nullable=False, server_default="0"),
        sa.Column("unit", sa.String(20), nullable=False, server_default="piece"),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("delivery_zones", sa.JSON, nullable=True),
        sa.Column("images", sa.JSON, nullable=True),
        sa.Column("status", sa.Enum("ACTIVE", "SOLD", "EXPIRED", "DRAFT", name="listingstatus"), nullable=False, server_default="ACTIVE"),
        sa.Column("is_featured", sa.Boolean, nullable=False, server_default="false"),
        sa.Column("views_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── Marketplace Orders ──
    op.create_table(
        "marketplace_orders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("listing_id", sa.String(36), sa.ForeignKey("marketplace_listings.id"), nullable=False, index=True),
        sa.Column("buyer_id", sa.String(36), sa.ForeignKey("merchants.id"), nullable=False, index=True),
        sa.Column("seller_id", sa.String(36), sa.ForeignKey("merchants.id"), nullable=False, index=True),
        sa.Column("quantity", sa.Integer, nullable=False),
        sa.Column("unit_price", sa.Numeric(10, 2), nullable=False),
        sa.Column("total_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("status", sa.Enum("PENDING", "ACCEPTED", "SHIPPED", "DELIVERED", "CANCELLED", "DISPUTED", name="marketplaceorderstatus"), nullable=False, server_default="PENDING"),
        sa.Column("delivery_address", sa.Text, nullable=True),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column("payment_id", sa.String(36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── Payments ──
    op.create_table(
        "payments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("merchant_id", sa.String(36), sa.ForeignKey("merchants.id"), nullable=False, index=True),
        sa.Column("order_id", sa.String(36), nullable=True, index=True),
        sa.Column("order_type", sa.String(20), nullable=False, server_default="marketplace"),
        sa.Column("method", sa.Enum("CMI", "CASH_PLUS", "BANK_TRANSFER", "CASH", name="paymentmethod"), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="MAD"),
        sa.Column("status", sa.Enum("PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED", "CANCELLED", name="paymentstatus"), nullable=False, server_default="PENDING"),
        sa.Column("external_ref", sa.String(100), nullable=True),
        sa.Column("gateway_response", sa.JSON, nullable=True),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── Merchant Payment Config ──
    op.create_table(
        "merchant_payment_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("merchant_id", sa.String(36), sa.ForeignKey("merchants.id"), nullable=False, unique=True, index=True),
        sa.Column("cmi_merchant_id", sa.String(100), nullable=True),
        sa.Column("cmi_api_key", sa.String(255), nullable=True),
        sa.Column("cashplus_agent_id", sa.String(100), nullable=True),
        sa.Column("cashplus_api_key", sa.String(255), nullable=True),
        sa.Column("preferred_method", sa.Enum("CMI", "CASH_PLUS", "BANK_TRANSFER", "CASH", name="paymentmethod", create_type=False), nullable=False, server_default="CASH"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    # ── Market Benchmarks ──
    op.create_table(
        "market_benchmarks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("category", sa.String(50), nullable=False, index=True),
        sa.Column("city", sa.String(100), nullable=True, index=True),
        sa.Column("period", sa.String(10), nullable=False),
        sa.Column("total_merchants", sa.Integer, nullable=False, server_default="0"),
        sa.Column("avg_revenue", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("median_revenue", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("avg_transactions", sa.Integer, nullable=False, server_default="0"),
        sa.Column("avg_basket_size", sa.Numeric(10, 2), nullable=False, server_default="0"),
        sa.Column("top_products", sa.JSON, nullable=True),
        sa.Column("price_index", sa.JSON, nullable=True),
        sa.Column("growth_rate", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("market_benchmarks")
    op.drop_table("merchant_payment_configs")
    op.drop_table("payments")
    op.drop_table("marketplace_orders")
    op.drop_table("marketplace_listings")
    op.execute("DROP TYPE IF EXISTS listingstatus")
    op.execute("DROP TYPE IF EXISTS marketplaceorderstatus")
    op.execute("DROP TYPE IF EXISTS paymentmethod")
    op.execute("DROP TYPE IF EXISTS paymentstatus")
