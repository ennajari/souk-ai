"""Add credit_requests table

Revision ID: h1i2j3k4l5m6
Revises: g8h9i0j1k2l3
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = 'h1i2j3k4l5m6'
down_revision = 'g8h9i0j1k2l3'
branch_labels = None
depends_on = None


def upgrade():
    # Use raw SQL to avoid SQLAlchemy trying to re-create the enum type
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'creditrequeststatus') THEN
                CREATE TYPE creditrequeststatus AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISBURSED');
            END IF;
        END $$;
    """)

    op.execute("""
        CREATE TABLE IF NOT EXISTS credit_requests (
            id VARCHAR(36) PRIMARY KEY,
            merchant_id VARCHAR(36) NOT NULL REFERENCES merchants(id),
            amount NUMERIC(10, 2) NOT NULL,
            term_days INTEGER NOT NULL,
            fee_percentage NUMERIC(5, 2) NOT NULL,
            status creditrequeststatus NOT NULL DEFAULT 'PENDING',
            admin_note TEXT,
            reviewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    """)

    op.execute("CREATE INDEX IF NOT EXISTS ix_credit_requests_merchant_id ON credit_requests (merchant_id);")


def downgrade():
    op.execute("DROP TABLE IF EXISTS credit_requests;")
    op.execute("DROP TYPE IF EXISTS creditrequeststatus;")
