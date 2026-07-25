"""add scenario_cases + lo_feedback

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-07-25

scenario_cases: role2builder case files attached to an assessment.
lo_feedback: per-evaluator learning-objective feedback per wicket.
"""
from alembic import op
import sqlalchemy as sa

revision = 'k1l2m3n4o5p6'
down_revision = 'j0k1l2m3n4o5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'scenario_cases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('assessment_id', sa.String(36), sa.ForeignKey('assessments.id'), nullable=False, index=True),
        sa.Column('label', sa.String(200), nullable=False),
        sa.Column('source_ref', sa.String(300), nullable=True),
        sa.Column('event_codes', sa.JSON(), nullable=False),
        sa.Column('blob_ref', sa.String(500), nullable=False),
        sa.Column('hash', sa.String(64), nullable=False),
        sa.Column('filename', sa.String(300), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=False),
        sa.Column('uploaded_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        'lo_feedback',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('assessment_id', sa.String(36), sa.ForeignKey('assessments.id'), nullable=False, index=True),
        sa.Column('event_code', sa.String(30), nullable=False, index=True),
        sa.Column('case_id', sa.String(36), sa.ForeignKey('scenario_cases.id'), nullable=True),
        sa.Column('rating', sa.Integer(), nullable=True),
        sa.Column('recommendation', sa.String(10), nullable=True),
        sa.Column('comment', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('lo_feedback')
    op.drop_table('scenario_cases')
