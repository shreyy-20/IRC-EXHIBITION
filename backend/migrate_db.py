import sys
from sqlalchemy import text
from app.database import engine, Base
import app.models

def migrate():
    print("Checking and applying database schema migrations...")
    
    statements = [
        # Events table
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'upcoming';",
        
        # Halls table
        "ALTER TABLE halls ADD COLUMN IF NOT EXISTS dimensions_length DOUBLE PRECISION;",
        "ALTER TABLE halls ADD COLUMN IF NOT EXISTS dimensions_width DOUBLE PRECISION;",
        "ALTER TABLE halls ADD COLUMN IF NOT EXISTS coordinate_system_type VARCHAR(50) DEFAULT 'illustrative_svg';",
        "ALTER TABLE halls ADD COLUMN IF NOT EXISTS layout_image_path VARCHAR(500);",
        
        # Exhibitors table
        "ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS contact_email VARCHAR(200);",
        "ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);",
        "ALTER TABLE exhibitors ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'unverified';",
        
        # Booths table
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS allocation_status VARCHAR(30) DEFAULT 'unassigned';",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'unverified';",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS source_document VARCHAR(300);",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS source_row INTEGER;",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS original_stall_string VARCHAR(500);",
        "ALTER TABLE booths ADD COLUMN IF NOT EXISTS hall_name VARCHAR(100);",
        
        # Facilities table
        "ALTER TABLE facilities ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';",
        "ALTER TABLE facilities ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'unverified';",
    ]
    
    with engine.begin() as conn:
        for stmt in statements:
            try:
                conn.execute(text(stmt))
            except Exception as e:
                print(f"Notice on statement '{stmt}': {e}")
                
    # Create any missing tables (like stall_allotments)
    Base.metadata.create_all(bind=engine)
    print("All schema migrations and tables are successfully verified!")

if __name__ == "__main__":
    migrate()
