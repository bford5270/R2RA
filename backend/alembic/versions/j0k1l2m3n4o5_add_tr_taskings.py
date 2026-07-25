"""add tr_taskings — S3T evaluator wicket/MET taskings

Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
Create Date: 2026-07-25

tr_taskings: one row per (assessment, evaluator) — the set of T&R wickets
(PECL event codes) and METs S3T assigned to that evaluator, with
assigned/returned lifecycle.
"""
from alembic import op
import sqlalchemy as sa

revision = 'j0k1l2m3n4o5'
down_revision = 'i9j0k1l2m3n4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'tr_taskings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('assessment_id', sa.String(36), sa.ForeignKey('assessments.id'), nullable=False, index=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False, index=True),
        sa.Column('event_codes', sa.JSON(), nullable=False),
        sa.Column('mets', sa.JSON(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='assigned'),
        sa.Column('assigned_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('assigned_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('returned_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('tr_taskings')
