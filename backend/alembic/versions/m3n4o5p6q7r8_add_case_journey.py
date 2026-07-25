"""add continuum-of-care journey + personnel to scenario_cases

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
Create Date: 2026-07-25

journey: ordered phase entries (POI → triage → trauma bay → OR → post-op →
evac) with per-phase notes, time, and personnel. personnel: case-level
roster (bed team, surg tech, etc.). Both optional.
"""
from alembic import op
import sqlalchemy as sa

revision = 'm3n4o5p6q7r8'
down_revision = 'l2m3n4o5p6q7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('scenario_cases', sa.Column('journey', sa.JSON(), nullable=False, server_default='[]'))
    op.add_column('scenario_cases', sa.Column('personnel', sa.JSON(), nullable=False, server_default='[]'))


def downgrade() -> None:
    op.drop_column('scenario_cases', 'personnel')
    op.drop_column('scenario_cases', 'journey')
