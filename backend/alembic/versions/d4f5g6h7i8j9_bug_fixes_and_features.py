"""bug fixes and features: supplier merchant_id, customer credit_limit, inventory_logs, transaction RETURN type

Revision ID: d4f5g6h7i8j9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-31 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4f5g6h7i8j9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add merchant_id to suppliers (nullable — existing suppliers stay accessible)
    op.add_column('suppliers', sa.Column('merchant_id', sa.String(36), nullable=True))
    op.create_index('ix_suppliers_merchant_id', 'suppliers', ['merchant_id'])

    # 2. Add credit_limit to customers
    op.add_column('customers', sa.Column('credit_limit', sa.Numeric(10, 2), server_default='0', nullable=False))

    # 3. Add RETURN to transactiontype enum
    op.execute("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'RETURN'")

    # 4b. Lower default reorder threshold from 10 to 5 for existing rows
    op.execute("UPDATE inventory SET reorder_threshold = 5 WHERE reorder_threshold = 10")

    # 5. Create inventory_logs table
    op.create_table(
        'inventory_logs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('product_id', sa.String(36), sa.ForeignKey('products.id'), nullable=False, index=True),
        sa.Column('merchant_id', sa.String(36), sa.ForeignKey('merchants.id'), nullable=False, index=True),
        sa.Column('quantity_before', sa.Numeric(10, 2), nullable=False),
        sa.Column('quantity_change', sa.Numeric(10, 2), nullable=False),
        sa.Column('quantity_after', sa.Numeric(10, 2), nullable=False),
        sa.Column('reason', sa.String(255), nullable=True),
        sa.Column('source', sa.String(50), server_default='manual', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade():
    op.drop_table('inventory_logs')
    op.drop_column('customers', 'credit_limit')
    op.drop_index('ix_suppliers_merchant_id', table_name='suppliers')
    op.drop_column('suppliers', 'merchant_id')
