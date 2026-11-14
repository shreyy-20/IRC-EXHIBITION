from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, ForeignKey, Boolean, DateTime, Integer, UniqueConstraint, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

def now_utc():
    return datetime.now(timezone.utc)

class Event(Base):
    __tablename__ = "events"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    venue: Mapped[str] = mapped_column(String(200), default="")
    is_demo: Mapped[bool] = mapped_column(Boolean, default=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="upcoming")  # active/upcoming/completed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    exhibitors: Mapped[list["Exhibitor"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    halls: Mapped[list["Hall"]] = relationship(back_populates="event", cascade="all, delete-orphan")
    stall_allotments: Mapped[list["StallAllotment"]] = relationship(back_populates="event", cascade="all, delete-orphan")

class Hall(Base):
    __tablename__ = "halls"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    map_key: Mapped[str] = mapped_column(String(100), default="sample-hall")
    dimensions_length: Mapped[float | None] = mapped_column(Float, nullable=True)
    dimensions_width: Mapped[float | None] = mapped_column(Float, nullable=True)
    coordinate_system_type: Mapped[str] = mapped_column(String(50), default="illustrative_svg")
    layout_image_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    event: Mapped[Event] = relationship(back_populates="halls")
    booths: Mapped[list["Booth"]] = relationship(back_populates="hall", cascade="all, delete-orphan")
    facilities: Mapped[list["Facility"]] = relationship(back_populates="hall", cascade="all, delete-orphan")

class Exhibitor(Base):
    __tablename__ = "exhibitors"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(120), default="General")
    description: Mapped[str] = mapped_column(Text, default="")
    website: Mapped[str] = mapped_column(String(300), default="")
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)
    contact_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    verification_status: Mapped[str] = mapped_column(String(30), default="unverified")  # unverified/source_listed/provisional/verified/confirmed
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    event: Mapped[Event] = relationship(back_populates="exhibitors")
    booths: Mapped[list["Booth"]] = relationship(back_populates="exhibitor", cascade="all, delete-orphan")

class Booth(Base):
    __tablename__ = "booths"
    __table_args__ = (UniqueConstraint("hall_id", "code", name="uq_booth_hall_code"),)
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    hall_id: Mapped[str] = mapped_column(ForeignKey("halls.id"), nullable=False, index=True)
    exhibitor_id: Mapped[str | None] = mapped_column(ForeignKey("exhibitors.id"), nullable=True, index=True)
    code: Mapped[str] = mapped_column(String(30), nullable=False)
    x: Mapped[float] = mapped_column(Float, default=0)
    y: Mapped[float] = mapped_column(Float, default=0)
    width: Mapped[float] = mapped_column(Float, default=100)
    height: Mapped[float] = mapped_column(Float, default=60)
    allocation_status: Mapped[str] = mapped_column(String(30), default="unassigned")  # unassigned/source_listed/provisional/verified/confirmed/duplicate/out_of_range/requires_review
    verification_status: Mapped[str] = mapped_column(String(30), default="unverified")
    source_document: Mapped[str | None] = mapped_column(String(300), nullable=True)
    source_row: Mapped[int | None] = mapped_column(Integer, nullable=True)
    original_stall_string: Mapped[str | None] = mapped_column(String(500), nullable=True)
    hall_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hall: Mapped[Hall] = relationship(back_populates="booths")
    exhibitor: Mapped[Exhibitor | None] = relationship(back_populates="booths")

class StallAllotment(Base):
    __tablename__ = "stall_allotments"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    source_row: Mapped[int | None] = mapped_column(Integer, nullable=True)
    serial_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    company_name: Mapped[str] = mapped_column(String(300), nullable=False)
    raw_stall_numbers: Mapped[str] = mapped_column(String(500), nullable=False)
    parsed_numbers: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    source_document: Mapped[str | None] = mapped_column(String(300), nullable=True)
    validation_status: Mapped[str] = mapped_column(String(30), default="pending")
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    hall_association: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    event: Mapped[Event] = relationship(back_populates="stall_allotments")

class NavigationNode(Base):
    __tablename__ = "navigation_nodes"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    hall_id: Mapped[str] = mapped_column(ForeignKey("halls.id"), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    node_type: Mapped[str] = mapped_column(String(40), default="junction")
    x: Mapped[float] = mapped_column(Float, default=0)
    y: Mapped[float] = mapped_column(Float, default=0)

class NavigationEdge(Base):
    __tablename__ = "navigation_edges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    hall_id: Mapped[str] = mapped_column(ForeignKey("halls.id"), nullable=False, index=True)
    from_node: Mapped[str] = mapped_column(ForeignKey("navigation_nodes.id"), nullable=False)
    to_node: Mapped[str] = mapped_column(ForeignKey("navigation_nodes.id"), nullable=False)
    distance_m: Mapped[float] = mapped_column(Float, nullable=False)
    is_accessible: Mapped[bool] = mapped_column(Boolean, default=True)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)

class QRCodeRecord(Base):
    __tablename__ = "qr_codes"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    destination_id: Mapped[str] = mapped_column(String(64), nullable=False)
    destination_label: Mapped[str] = mapped_column(String(160), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

class AnalyticsEvent(Base):
    __tablename__ = "analytics_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(60), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(String(64))
    query_text: Mapped[str | None] = mapped_column(String(250))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)

class AdminUser(Base):
    __tablename__ = "admin_users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Facility(Base):
    __tablename__ = "facilities"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    hall_id: Mapped[str] = mapped_column(ForeignKey("halls.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(140), nullable=False)
    facility_type: Mapped[str] = mapped_column(String(50), nullable=False)
    x: Mapped[float] = mapped_column(Float, default=0)
    y: Mapped[float] = mapped_column(Float, default=0)
    description: Mapped[str] = mapped_column(Text, default="")
    verification_status: Mapped[str] = mapped_column(String(30), default="unverified")
    hall: Mapped[Hall] = relationship(back_populates="facilities")
