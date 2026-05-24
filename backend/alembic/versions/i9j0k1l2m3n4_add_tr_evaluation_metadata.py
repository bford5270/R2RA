"""add T&R evaluation metadata fields

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
Create Date: 2026-05-24

tr_responses:
  conducted_on       — date training event was actually conducted
  conditions_met     — evaluator attestation that specified condition was met
  headcount          — number of personnel assessed

assessments:
  tr_evaluator_name  — evaluator full name
  tr_evaluator_rank  — evaluator rank/grade (e.g. "MAJ", "GS-13")
  tr_evaluator_billet — evaluator billet/position
  tr_aar_narrative   — commander's/evaluator's overall assessment narrative
  tr_aar_priorities  — identified training priorities (free text)
"""
from alembic import op
import sqlalchemy as sa

revision = 'i9j0k1l2m3n4'
down_revision = 'h8i9j0k1l2m3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tr_responses', sa.Column('conducted_on', sa.Date(), nullable=True))
    op.add_column('tr_responses', sa.Column('conditions_met', sa.Boolean(), nullable=True))
    op.add_column('tr_responses', sa.Column('headcount', sa.Integer(), nullable=True))

    op.add_column('assessments', sa.Column('tr_evaluator_name', sa.String(100), nullable=True))
    op.add_column('assessments', sa.Column('tr_evaluator_rank', sa.String(30), nullable=True))
    op.add_column('assessments', sa.Column('tr_evaluator_billet', sa.String(100), nullable=True))
    op.add_column('assessments', sa.Column('tr_aar_narrative', sa.Text(), nullable=True))
    op.add_column('assessments', sa.Column('tr_aar_priorities', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('assessments', 'tr_aar_priorities')
    op.drop_column('assessments', 'tr_aar_narrative')
    op.drop_column('assessments', 'tr_evaluator_billet')
    op.drop_column('assessments', 'tr_evaluator_rank')
    op.drop_column('assessments', 'tr_evaluator_name')

    op.drop_column('tr_responses', 'headcount')
    op.drop_column('tr_responses', 'conditions_met')
    op.drop_column('tr_responses', 'conducted_on')
