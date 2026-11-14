
import heapq
import io
import uuid
import csv

from collections import Counter

import qrcode

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Query,
    Response,
    UploadFile,
    File,
)

from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy.orm import Session, joinedload
from sqlalchemy import select, or_, func

from app.core.config import settings
from app.database import Base, engine, get_db, sync_db_schema

from app.models import (
    Event,
    Exhibitor,
    Hall,
    Booth,
    NavigationNode,
    NavigationEdge,
    QRCodeRecord,
    AnalyticsEvent,
    Facility,
)

from app.schemas import (
    ExhibitorOut,
    BoothOut,
    RouteRequest,
    RouteResponse,
    LoginRequest,
    TokenResponse,
    ExhibitorCreate,
    HallCreate,
    BoothUpdate,
    FacilityCreate,
    NavigationNodeCreate,
    NavigationEdgeCreate,
)

from app.seed import seed_demo
from app.security import verify_password, create_access_token, require_admin


# --------------------------------------------------
# APPLICATION CONFIGURATION
# --------------------------------------------------

app = FastAPI(
    title="IRC EXHIBITION FINDER API",
    version="0.3.0",
    description="Exhibition discovery and indoor navigation platform",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# STARTUP
# --------------------------------------------------

@app.on_event("startup")
def startup():
    # Sync columns and create tables
    sync_db_schema()
    Base.metadata.create_all(bind=engine)

    with Session(engine) as db:
        seed_demo(db)
        db.commit()


# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "irc-exhibition-finder-api",
    }


# --------------------------------------------------
# AUTHENTICATION
# --------------------------------------------------

@app.post("/api/auth/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    db: Session = Depends(get_db),
):
    from app.models import AdminUser

    user = (
        db.query(AdminUser)
        .filter_by(
            username=payload.username,
            is_active=True,
        )
        .first()
    )

    if not user or not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
        )

    return TokenResponse(
        access_token=create_access_token(user.username)
    )


@app.get("/api/auth/me")
def auth_me(admin=Depends(require_admin)):
    return {
        "username": admin.username,
        "role": "admin",
    }


# --------------------------------------------------
# EVENTS
# --------------------------------------------------

@app.get("/api/events")
def list_events(db: Session = Depends(get_db)):
    events = db.scalars(
        select(Event).order_by(Event.name)
    ).all()

    return [
        {
            "id": event.id,
            "name": event.name,
            "venue": event.venue,
            "is_demo": event.is_demo,
        }
        for event in events
    ]


@app.get("/api/events/{event_id}")
def get_event(
    event_id: str,
    db: Session = Depends(get_db),
):
    event = db.get(Event, event_id)

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    return {
        "id": event.id,
        "name": event.name,
        "description": event.description,
        "venue": event.venue,
        "is_demo": event.is_demo,
    }


@app.get(
    "/api/events/{event_id}/exhibitors",
    response_model=list[ExhibitorOut],
)
def list_exhibitors(
    event_id: str,
    q: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    if not db.get(Event, event_id):
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    stmt = select(Exhibitor).where(
        Exhibitor.event_id == event_id
    )

    if q:
        term = f"%{q.strip()}%"

        stmt = stmt.where(
            or_(
                Exhibitor.name.ilike(term),
                Exhibitor.category.ilike(term),
                Exhibitor.description.ilike(term),
            )
        )

    return list(
        db.scalars(
            stmt.order_by(Exhibitor.name)
        ).all()
    )


@app.post(
    "/api/admin/exhibitors",
    response_model=ExhibitorOut,
)
def create_exhibitor(
    payload: ExhibitorCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    if not db.get(Event, payload.event_id):
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    if db.get(Exhibitor, payload.id):
        raise HTTPException(
            status_code=409,
            detail="Exhibitor ID already exists",
        )

    item = Exhibitor(**payload.model_dump())

    db.add(item)
    db.commit()
    db.refresh(item)

    return item


@app.put(
    "/api/admin/exhibitors/{exhibitor_id}",
    response_model=ExhibitorOut,
)
def update_exhibitor(
    exhibitor_id: str,
    payload: ExhibitorCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    item = db.get(Exhibitor, exhibitor_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Exhibitor not found",
        )

    for key, value in payload.model_dump().items():
        if key != "id":
            setattr(item, key, value)

    db.commit()
    db.refresh(item)

    return item


@app.delete("/api/admin/exhibitors/{exhibitor_id}")
def delete_exhibitor(
    exhibitor_id: str,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    item = db.get(Exhibitor, exhibitor_id)

    if not item:
        raise HTTPException(
            status_code=404,
            detail="Exhibitor not found",
        )

    db.delete(item)
    db.commit()

    return {
        "deleted": exhibitor_id,
    }


# --------------------------------------------------
# HALLS AND BOOTHS
# --------------------------------------------------

@app.get(
    "/api/halls/{hall_id}/booths",
    response_model=list[BoothOut],
)
def list_booths(
    hall_id: str,
    db: Session = Depends(get_db),
):
    if not db.get(Hall, hall_id):
        raise HTTPException(
            status_code=404,
            detail="Hall not found",
        )

    stmt = (
        select(Booth)
        .options(joinedload(Booth.exhibitor))
        .where(Booth.hall_id == hall_id)
        .order_by(Booth.code)
    )

    return list(
        db.scalars(stmt).unique().all()
    )


@app.get("/api/events/{event_id}/halls")
def list_halls(
    event_id: str,
    db: Session = Depends(get_db),
):
    if not db.get(Event, event_id):
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    halls = db.scalars(
        select(Hall)
        .where(Hall.event_id == event_id)
        .order_by(Hall.name)
    ).all()

    return [
        {
            "id": hall.id,
            "name": hall.name,
            "map_key": hall.map_key,
        }
        for hall in halls
    ]


@app.post("/api/admin/halls")
def create_hall(
    payload: HallCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    if not db.get(Event, payload.event_id):
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    if db.get(Hall, payload.id):
        raise HTTPException(
            status_code=409,
            detail="Hall ID already exists",
        )

    hall = Hall(**payload.model_dump())

    db.add(hall)
    db.commit()
    db.refresh(hall)

    return {
        "id": hall.id,
        "name": hall.name,
        "map_key": hall.map_key,
    }


@app.put(
    "/api/admin/booths/{booth_id}",
    response_model=BoothOut,
)
def update_booth(
    booth_id: str,
    payload: BoothUpdate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    booth = db.get(Booth, booth_id)

    if not booth:
        raise HTTPException(
            status_code=404,
            detail="Booth not found",
        )

    if (
        payload.exhibitor_id
        and not db.get(Exhibitor, payload.exhibitor_id)
    ):
        raise HTTPException(
            status_code=404,
            detail="Exhibitor not found",
        )

    for key, value in payload.model_dump().items():
        setattr(booth, key, value)

    db.commit()

    return db.scalar(
        select(Booth)
        .options(joinedload(Booth.exhibitor))
        .where(Booth.id == booth_id)
    )


# --------------------------------------------------
# INDOOR NAVIGATION - ROUTE CALCULATION
# --------------------------------------------------

@app.post(
    "/api/navigation/route",
    response_model=RouteResponse,
)
def calculate_route(
    payload: RouteRequest,
    db: Session = Depends(get_db),
):
    start = db.get(
        NavigationNode,
        payload.start_node,
    )

    destination = db.get(
        NavigationNode,
        payload.destination_node,
    )

    if not start or not destination:
        raise HTTPException(
            status_code=404,
            detail="Starting point or destination was not found",
        )

    # Both nodes must belong to the same hall.
    if start.hall_id != destination.hall_id:
        raise HTTPException(
            status_code=400,
            detail="Starting point and destination must be in the same hall",
        )

    hall_id = start.hall_id

    # Load only walkable edges from the selected hall.
    edges = db.scalars(
        select(NavigationEdge).where(
            NavigationEdge.hall_id == hall_id,
            NavigationEdge.is_blocked.is_(False),
        )
    ).all()

    # Build an undirected weighted graph.
    graph = {}

    for edge in edges:
        graph.setdefault(
            edge.from_node, []
        ).append(
            (edge.to_node, edge.distance_m)
        )

        graph.setdefault(
            edge.to_node, []
        ).append(
            (edge.from_node, edge.distance_m)
        )

    # Dijkstra shortest-path algorithm.
    queue = [
        (0.0, payload.start_node, [payload.start_node])
    ]

    best = {}

    while queue:
        distance, node, path = heapq.heappop(queue)

        if node in best and best[node] <= distance:
            continue

        best[node] = distance

        if node == payload.destination_node:
            return RouteResponse(
                nodes=path,
                distance_m=round(distance, 2),
                walking_minutes=round(distance / 75, 1),
                message=(
                    "Illustrative route calculated from the "
                    "configured demonstration navigation graph."
                ),
            )

        for neighbour, weight in graph.get(node, []):
            if neighbour not in best:
                heapq.heappush(
                    queue,
                    (
                        distance + weight,
                        neighbour,
                        path + [neighbour],
                    ),
                )

    raise HTTPException(
        status_code=404,
        detail="No walkable route exists between these locations",
    )


# --------------------------------------------------
# PUBLIC NAVIGATION GRAPH
# Used by the frontend SVG floor map.
# --------------------------------------------------

@app.get("/api/navigation/halls/{hall_id}/graph")
def get_public_navigation_graph(
    hall_id: str,
    db: Session = Depends(get_db),
):
    hall = db.get(Hall, hall_id)

    if not hall:
        raise HTTPException(
            status_code=404,
            detail="Hall not found",
        )

    nodes = db.scalars(
        select(NavigationNode).where(
            NavigationNode.hall_id == hall_id
        )
    ).all()

    edges = db.scalars(
        select(NavigationEdge).where(
            NavigationEdge.hall_id == hall_id
        )
    ).all()

    return {
        "hall_id": hall_id,
        "coordinate_system": {
            "type": "illustrative_svg",
            "viewBox": "0 0 700 470",
            "is_official_venue_map": False,
        },
        "nodes": [
            {
                "id": node.id,
                "label": node.label,
                "node_type": node.node_type,
                "x": node.x,
                "y": node.y,
            }
            for node in nodes
        ],
        "edges": [
            {
                "id": edge.id,
                "from_node": edge.from_node,
                "to_node": edge.to_node,
                "distance_m": edge.distance_m,
                "is_accessible": edge.is_accessible,
                "is_blocked": edge.is_blocked,
            }
            for edge in edges
        ],
    }


# --------------------------------------------------
# QR CODE GENERATION
# --------------------------------------------------

@app.post("/api/qr/generate")
def generate_qr(
    payload: dict,
    db: Session = Depends(get_db),
):
    event_id = str(payload.get("event_id", ""))
    destination_id = str(payload.get("destination_id", ""))

    label = str(
        payload.get("destination_label", destination_id)
    )

    if not db.get(Event, event_id):
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    record_id = uuid.uuid4().hex[:16]

    db.add(
        QRCodeRecord(
            id=record_id,
            event_id=event_id,
            destination_id=destination_id,
            destination_label=label,
        )
    )

    db.add(
        AnalyticsEvent(
            event_id=event_id,
            event_type="qr_generated",
            entity_id=destination_id,
        )
    )

    db.commit()

    if settings.allowed_origins:
        url = (
            f"{settings.allowed_origins[0]}"
            f"/?event={event_id}&destination={destination_id}"
        )
    else:
        url = (
            f"http://localhost:5173/"
            f"?event={event_id}&destination={destination_id}"
        )

    image = qrcode.make(url)

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")

    return Response(
        content=buffer.getvalue(),
        media_type="image/png",
        headers={
            "X-QR-ID": record_id,
        },
    )


# --------------------------------------------------
# ANALYTICS
# --------------------------------------------------

@app.post("/api/analytics/track")
def track_analytics(
    payload: dict,
    db: Session = Depends(get_db),
):
    event_id = str(payload.get("event_id", ""))

    if not db.get(Event, event_id):
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    db.add(
        AnalyticsEvent(
            event_id=event_id,
            event_type=str(
                payload.get("event_type", "interaction")
            )[:60],
            entity_id=payload.get("entity_id"),
            query_text=payload.get("query_text"),
        )
    )

    db.commit()

    return {
        "recorded": True,
    }


@app.get("/api/admin/analytics")
def admin_analytics(
    event_id: str = "demo-irc-expo",
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    rows = db.scalars(
        select(AnalyticsEvent).where(
            AnalyticsEvent.event_id == event_id
        )
    ).all()

    counts = Counter(
        row.event_type for row in rows
    )

    return {
        "total_events": len(rows),
        "by_type": dict(counts),
    }


@app.get("/api/admin/dashboard")
def admin_dashboard(
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    return {
        "events": db.scalar(
            select(func.count()).select_from(Event)
        ) or 0,

        "exhibitors": db.scalar(
            select(func.count()).select_from(Exhibitor)
        ) or 0,

        "halls": db.scalar(
            select(func.count()).select_from(Hall)
        ) or 0,

        "booths": db.scalar(
            select(func.count()).select_from(Booth)
        ) or 0,
    }


# --------------------------------------------------
# CSV EXHIBITOR IMPORT
# --------------------------------------------------

@app.post("/api/admin/import-exhibitors")
async def import_exhibitors(
    file: UploadFile = File(...),
    event_id: str = Query(...),
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    if not db.get(Event, event_id):
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    if (
        not file.filename
        or not file.filename.lower().endswith(".csv")
    ):
        raise HTTPException(
            status_code=400,
            detail="Upload a CSV file",
        )

    content = (
        await file.read()
    ).decode("utf-8-sig")

    reader = csv.DictReader(
        io.StringIO(content)
    )

    required = {"id", "name"}

    if (
        not reader.fieldnames
        or not required.issubset(set(reader.fieldnames))
    ):
        raise HTTPException(
            status_code=400,
            detail="CSV requires id and name columns",
        )

    created = 0

    for row in reader:
        if not row.get("id") or not row.get("name"):
            continue

        if db.get(Exhibitor, row["id"]):
            continue

        db.add(
            Exhibitor(
                id=row["id"],
                event_id=event_id,
                name=row["name"],
                category=row.get("category") or "General",
                description=row.get("description") or "",
                website=row.get("website") or "",
            )
        )

        created += 1

    db.commit()

    return {
        "created": created,
    }


# --------------------------------------------------
# FACILITIES
# --------------------------------------------------

@app.get("/api/halls/{hall_id}/facilities")
def list_facilities(
    hall_id: str,
    db: Session = Depends(get_db),
):
    if not db.get(Hall, hall_id):
        raise HTTPException(
            status_code=404,
            detail="Hall not found",
        )

    facilities = db.scalars(
        select(Facility).where(
            Facility.hall_id == hall_id
        )
    ).all()

    return [
        {
            "id": facility.id,
            "name": facility.name,
            "facility_type": facility.facility_type,
            "x": facility.x,
            "y": facility.y,
        }
        for facility in facilities
    ]


@app.post("/api/admin/facilities")
def create_facility(
    payload: FacilityCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    if not db.get(Hall, payload.hall_id):
        raise HTTPException(
            status_code=404,
            detail="Hall not found",
        )

    if db.get(Facility, payload.id):
        raise HTTPException(
            status_code=409,
            detail="Facility ID already exists",
        )

    facility = Facility(**payload.model_dump())

    db.add(facility)
    db.commit()
    db.refresh(facility)

    return {
        "id": facility.id,
        "name": facility.name,
        "facility_type": facility.facility_type,
    }


@app.delete("/api/admin/facilities/{facility_id}")
def delete_facility(
    facility_id: str,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    facility = db.get(Facility, facility_id)

    if not facility:
        raise HTTPException(
            status_code=404,
            detail="Facility not found",
        )

    db.delete(facility)
    db.commit()

    return {
        "deleted": facility_id,
    }


# --------------------------------------------------
# ADMIN NAVIGATION GRAPH
# --------------------------------------------------

@app.get("/api/admin/navigation/{hall_id}")
def get_admin_navigation_graph(
    hall_id: str,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    if not db.get(Hall, hall_id):
        raise HTTPException(
            status_code=404,
            detail="Hall not found",
        )

    nodes = db.scalars(
        select(NavigationNode).where(
            NavigationNode.hall_id == hall_id
        )
    ).all()

    edges = db.scalars(
        select(NavigationEdge).where(
            NavigationEdge.hall_id == hall_id
        )
    ).all()

    return {
        "nodes": [
            {
                "id": node.id,
                "label": node.label,
                "node_type": node.node_type,
                "x": node.x,
                "y": node.y,
            }
            for node in nodes
        ],
        "edges": [
            {
                "id": edge.id,
                "from_node": edge.from_node,
                "to_node": edge.to_node,
                "distance_m": edge.distance_m,
                "is_accessible": edge.is_accessible,
                "is_blocked": edge.is_blocked,
            }
            for edge in edges
        ],
    }


@app.post("/api/admin/navigation/nodes")
def create_navigation_node(
    payload: NavigationNodeCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    if not db.get(Hall, payload.hall_id):
        raise HTTPException(
            status_code=404,
            detail="Hall not found",
        )

    if db.get(NavigationNode, payload.id):
        raise HTTPException(
            status_code=409,
            detail="Node ID already exists",
        )

    node = NavigationNode(**payload.model_dump())

    db.add(node)
    db.commit()
    db.refresh(node)

    return {
        "id": node.id,
        "label": node.label,
    }


@app.post("/api/admin/navigation/edges")
def create_navigation_edge(
    payload: NavigationEdgeCreate,
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    if not db.get(Hall, payload.hall_id):
        raise HTTPException(
            status_code=404,
            detail="Hall not found",
        )

    for node_id in (
        payload.from_node,
        payload.to_node,
    ):
        node = db.get(
            NavigationNode,
            node_id,
        )

        if not node or node.hall_id != payload.hall_id:
            raise HTTPException(
                status_code=400,
                detail=f"Node {node_id} is not in this hall",
            )

    edge = NavigationEdge(**payload.model_dump())

    db.add(edge)
    db.commit()
    db.refresh(edge)

    return {
        "id": edge.id,
        "distance_m": edge.distance_m,
    }


@app.patch(
    "/api/admin/navigation/edges/{edge_id}/block"
)
def set_edge_blocked(
    edge_id: int,
    blocked: bool = Query(...),
    db: Session = Depends(get_db),
    admin=Depends(require_admin),
):
    edge = db.get(
        NavigationEdge,
        edge_id,
    )

    if not edge:
        raise HTTPException(
            status_code=404,
            detail="Navigation edge not found",
        )

    edge.is_blocked = blocked

    db.commit()

    return {
        "id": edge.id,
        "is_blocked": edge.is_blocked,
    }
