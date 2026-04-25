"""add tr_responses table

Revision ID: a1b2c3d4e5f6
Revises: 992da4aaacff
Create Date: 2026-04-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '992da4aaacff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'tr_responses',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('assessment_id', sa.String(length=36), sa.ForeignKey('assessments.id'), nullable=False),
        sa.Column('event_code', sa.String(length=30), nullable=False),
        sa.Column('status', sa.String(length=15), nullable=False, server_default='unanswered'),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('authored_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('last_modified_by', sa.String(length=36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_tr_responses_assessment_id', 'tr_responses', ['assessment_id'])
    op.create_index('ix_tr_responses_event_code', 'tr_responses', ['event_code'])


def downgrade() -> None:
    op.drop_index('ix_tr_responses_event_code', 'tr_responses')
    op.drop_index('ix_tr_responses_assessment_id', 'tr_responses')
    op.drop_table('tr_responses')
