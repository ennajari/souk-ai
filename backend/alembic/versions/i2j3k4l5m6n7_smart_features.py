"""Add supplier catalog, product dates, global barcodes, employee contracts, revenue tracking

Revision ID: i2j3k4l5m6n7
Revises: h1i2j3k4l5m6
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = 'i2j3k4l5m6n7'
down_revision = 'h1i2j3k4l5m6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Supplier catalog items — products each supplier offers
    op.execute("""
        CREATE TABLE IF NOT EXISTS supplier_catalog_items (
            id VARCHAR(36) PRIMARY KEY,
            supplier_id VARCHAR(36) NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
            name VARCHAR(200) NOT NULL,
            unit VARCHAR(20) DEFAULT 'piece',
            unit_price NUMERIC(10,2) DEFAULT 0,
            barcode VARCHAR(50),
            category VARCHAR(50),
            is_available BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_supplier_catalog_supplier ON supplier_catalog_items(supplier_id)")

    # 2. Global barcode database — shared across all merchants
    op.execute("""
        CREATE TABLE IF NOT EXISTS global_barcodes (
            barcode VARCHAR(50) PRIMARY KEY,
            name_fr VARCHAR(200),
            name_ar VARCHAR(200),
            unit VARCHAR(20) DEFAULT 'piece',
            category VARCHAR(50),
            avg_price NUMERIC(10,2) DEFAULT 0,
            report_count INTEGER DEFAULT 1,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    # 3. Add manufacture_date to products (expiry_date already exists)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE products ADD COLUMN manufacture_date DATE;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$
    """)

    # 4. Employee contracts / work periods
    op.execute("""
        CREATE TABLE IF NOT EXISTS employee_contracts (
            id VARCHAR(36) PRIMARY KEY,
            employee_id VARCHAR(36) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
            merchant_id VARCHAR(36) NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
            start_date DATE NOT NULL,
            end_date DATE,
            salary NUMERIC(10,2) DEFAULT 0,
            notes TEXT,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_employee_contracts_emp ON employee_contracts(employee_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_employee_contracts_merchant ON employee_contracts(merchant_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS employee_contracts")
    op.execute("DROP TABLE IF EXISTS global_barcodes")
    op.execute("DROP TABLE IF EXISTS supplier_catalog_items")
    op.execute("ALTER TABLE products DROP COLUMN IF EXISTS manufacture_date")
