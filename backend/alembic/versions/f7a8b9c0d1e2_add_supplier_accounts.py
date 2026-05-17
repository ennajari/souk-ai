"""Add supplier accounts and payment link

Revision ID: f7a8b9c0d1e2
Revises: e5g6h7i8j9k0
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa

revision = 'f7a8b9c0d1e2'
down_revision = 'e5g6h7i8j9k0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create accounttype enum
    accounttype = sa.Enum('MERCHANT', 'SUPPLIER', name='accounttype')
    accounttype.create(op.get_bind(), checkfirst=True)

    # 2. Add account_type to merchants
    op.add_column('merchants', sa.Column('account_type', sa.Enum('MERCHANT', 'SUPPLIER', name='accounttype'), server_default='MERCHANT', nullable=False))

    # 3. Add supplier_account_id to suppliers (links supplier record to supplier's own account)
    op.add_column('suppliers', sa.Column('supplier_account_id', sa.String(36), sa.ForeignKey('merchants.id'), nullable=True))
    op.create_index('ix_suppliers_supplier_account_id', 'suppliers', ['supplier_account_id'])

    # 4. Add payment_id to supplier_orders
    op.add_column('supplier_orders', sa.Column('payment_id', sa.String(36), sa.ForeignKey('payments.id'), nullable=True))

    # 5. Add IN_DELIVERY to supplierorderstatus enum
    op.execute("ALTER TYPE supplierorderstatus ADD VALUE IF NOT EXISTS 'IN_DELIVERY' AFTER 'SUBMITTED'")


def downgrade() -> None:
    op.drop_column('supplier_orders', 'payment_id')
    op.drop_index('ix_suppliers_supplier_account_id', 'suppliers')
    op.drop_column('suppliers', 'supplier_account_id')
    op.drop_column('merchants', 'account_type')
    sa.Enum('MERCHANT', 'SUPPLIER', name='accounttype').drop(op.get_bind(), checkfirst=True)
