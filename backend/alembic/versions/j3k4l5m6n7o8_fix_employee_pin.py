"""Fix employee pin_code column size and make nullable

Revision ID: j3k4l5m6n7o8
Revises: i2j3k4l5m6n7
Create Date: 2026-05-20
"""
from alembic import op
import sqlalchemy as sa

revision = "j3k4l5m6n7o8"
down_revision = "i2j3k4l5m6n7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # pin_code was VARCHAR(6) but stores bcrypt hashes (~60 chars)
    # Also make it nullable so PIN is optional for employees
    op.execute("ALTER TABLE employees ALTER COLUMN pin_code TYPE VARCHAR(128)")
    op.execute("ALTER TABLE employees ALTER COLUMN pin_code DROP NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE employees ALTER COLUMN pin_code SET NOT NULL")
    op.execute("ALTER TABLE employees ALTER COLUMN pin_code TYPE VARCHAR(6)")
