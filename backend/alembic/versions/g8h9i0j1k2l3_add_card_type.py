"""Add card_type to souk_cards

Revision ID: g8h9i0j1k2l3
Revises: f7a8b9c0d1e2
Create Date: 2026-05-17
"""
from alembic import op
import sqlalchemy as sa

revision = 'g8h9i0j1k2l3'
down_revision = 'f7a8b9c0d1e2'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cardtype') THEN
                CREATE TYPE cardtype AS ENUM ('CLIENT', 'SUPPLIER');
            END IF;
        END $$;
    """)

    op.execute("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 'souk_cards' AND column_name = 'card_type'
            ) THEN
                ALTER TABLE souk_cards ADD COLUMN card_type cardtype NOT NULL DEFAULT 'CLIENT';
            END IF;
        END $$;
    """)


def downgrade():
    op.drop_column('souk_cards', 'card_type')
    sa.Enum(name='cardtype').drop(op.get_bind(), checkfirst=True)
