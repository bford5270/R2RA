"""add exercises table and exercise_id to assessments

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-05-10
"""
from alembic import op
import sqlalchemy as sa

revision = 'h8i9j0k1l2m3'
down_revision = 'g7h8i9j0k1l2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'exercises',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('start_date', sa.Date, nullable=False),
        sa.Column('end_date', sa.Date, nullable=False),
        sa.Column('location', sa.String(200), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.add_column('assessments', sa.Column('exercise_id', sa.String(36), sa.ForeignKey('exercises.id'), nullable=True))
    op.create_index('ix_assessments_exercise_id', 'assessments', ['exercise_id'])


def downgrade() -> None:
    op.drop_index('ix_assessments_exercise_id', 'assessments')
    op.drop_column('assessments', 'exercise_id')
    op.drop_table('exercises')
