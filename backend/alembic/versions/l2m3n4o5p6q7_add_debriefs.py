"""add debriefs — recorded team debriefs with AI distillation

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-07-25
"""
from alembic import op
import sqlalchemy as sa

revision = 'l2m3n4o5p6q7'
down_revision = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'debriefs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('assessment_id', sa.String(36), sa.ForeignKey('assessments.id'), nullable=False, index=True),
        sa.Column('title', sa.String(200), nullable=False, server_default='Team debrief'),
        sa.Column('status', sa.String(20), nullable=False, server_default='uploaded'),
        sa.Column('audio_blob_ref', sa.String(500), nullable=True),
        sa.Column('audio_content_type', sa.String(100), nullable=True),
        sa.Column('audio_deleted', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('duration_sec', sa.Integer(), nullable=True),
        sa.Column('transcript', sa.Text(), nullable=True),
        sa.Column('distilled', sa.JSON(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('committed_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table('debriefs')
