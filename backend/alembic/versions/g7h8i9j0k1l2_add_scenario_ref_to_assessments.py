"""add scenario_ref to assessments

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa

revision = 'g7h8i9j0k1l2'
down_revision = 'f6a7b8c9d0e1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('assessments', sa.Column('scenario_ref', sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_column('assessments', 'scenario_ref')
