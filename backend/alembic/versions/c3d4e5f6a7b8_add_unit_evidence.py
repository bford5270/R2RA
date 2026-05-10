"""add unit_evidence table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'unit_evidence',
        sa.Column('id', sa.String(36), primary_key=True, nullable=False),
        sa.Column('unit_id', sa.String(36), sa.ForeignKey('units.id'), nullable=False),
        sa.Column('category', sa.String(20), nullable=False, server_default='other'),
        sa.Column('label', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('blob_ref', sa.String(500), nullable=True),
        sa.Column('hash', sa.String(64), nullable=True),
        sa.Column('filename', sa.String(255), nullable=True),
        sa.Column('content_type', sa.String(100), nullable=True),
        sa.Column('uploaded_by', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_unit_evidence_unit_id', 'unit_evidence', ['unit_id'])


def downgrade() -> None:
    op.drop_index('ix_unit_evidence_unit_id', 'unit_evidence')
    op.drop_table('unit_evidence')
