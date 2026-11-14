from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

class Base(DeclarativeBase):
    pass

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

def sync_db_schema():
    """Ensure all required columns and tables exist in PostgreSQL automatically."""
    statements = [
        # Events
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'upcoming';",
        
        # Halls
        "ALTER TABLE halls ADD COLUMN IF NOT EXISTS dimensions_length DOUBLE PRECISION;",
        "ALTER TABLE halls ADD COLUMN IF NOT EXISTS dimensions_width DOUBLE PRECISION;",
        "ALTER TABLE halls ADD COLUMN IF NOT EXISTS coordinate_system_type VARCHAR(50) DEFAULT 'illustrative_svg';",
        "ALTER TABLE halls ADD COLUMN IF NOT EXISTS layout_image_path VARCHAR(500);",
        
        # Exhibitors
        "ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS contact_email VARCHAR(200);",
        "ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);",
        "ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'unverified';",
        
        # Booths
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS allocation_status VARCHAR(30) DEFAULT 'unassigned';",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'unverified';",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS source_document VARCHAR(300);",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS source_row INTEGER;",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS original_stall_string VARCHAR(500);",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS hall_name VARCHAR(100);",
        
        # Facilities
        "ALTER TABLE facilities ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';",
        "ALTER TABLE facilities ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'unverified';",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception:
                pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
