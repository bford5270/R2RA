"""widen audit_log entity_id to 120 chars

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('audit_log', 'entity_id',
                    existing_type=sa.String(length=36),
                    type_=sa.String(length=120),
                    existing_nullable=False)


def downgrade() -> None:
    op.alter_column('audit_log', 'entity_id',
                    existing_type=sa.String(length=120),
                    type_=sa.String(length=36),
                    existing_nullable=False)
