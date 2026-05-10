"""add crosswalk_overrides and crosswalk_meta tables

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-27

"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'crosswalk_overrides',
        sa.Column('jts_item', sa.String(100), primary_key=True),
        sa.Column('wickets', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('mets', sa.JSON, nullable=False, server_default='[]'),
        sa.Column('note', sa.Text, nullable=True),
        sa.Column('edited_by', sa.String(36), nullable=True),
        sa.Column('edited_at', sa.DateTime, nullable=False),
    )
    op.create_table(
        'crosswalk_meta',
        sa.Column('key', sa.String(50), primary_key=True),
        sa.Column('value', sa.String(200), nullable=False),
        sa.Column('updated_by', sa.String(36), nullable=True),
        sa.Column('updated_at', sa.DateTime, nullable=True),
    )


def downgrade() -> None:
    op.drop_table('crosswalk_meta')
    op.drop_table('crosswalk_overrides')
