"""add score and capture_data to tr_responses

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-02

score  — 1-5 Likert for the overall wicket (null = not yet scored)
capture_data — JSON blob; {"components": [4, 5, 3, null, 2]} holds per-component scores
               index-matched to the wicket's event_components array
"""
from alembic import op
import sqlalchemy as sa

revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tr_responses', sa.Column('score', sa.Integer(), nullable=True))
    op.add_column('tr_responses', sa.Column('capture_data', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('tr_responses', 'capture_data')
    op.drop_column('tr_responses', 'score')
