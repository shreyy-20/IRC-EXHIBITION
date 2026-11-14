import json
import os
import re
from sqlalchemy.orm import Session

from app.models import (
    Event,
    Hall,
    Exhibitor,
    Booth,
    NavigationNode,
    NavigationEdge,
    AdminUser,
    Facility,
)
from app.security import hash_password


def seed_demo(db: Session) -> None:
    # ---------------------------------------------------------
    # 0. Default Admin User
    # ---------------------------------------------------------
    admin = db.query(AdminUser).filter_by(username="admin").first()
    if not admin:
        admin = AdminUser(
            username="admin",
            password_hash=hash_password("admin123"),
            is_active=True,
        )
        db.add(admin)
        db.commit()

    # ---------------------------------------------------------
    # 1. Demo Event & Sample Hall (For backward-compatible tests)
    # ---------------------------------------------------------
    demo_event = db.get(Event, "demo-irc-expo")
    if not demo_event:
        demo_event = Event(
            id="demo-irc-expo",
            name="IRC Exhibition Finder - Sample Exhibition",
            description="Demonstration event with fictional exhibitors and an illustrative floor map.",
            venue="Sample Exhibition Venue",
            is_demo=True,
        )
        db.add(demo_event)
        db.commit()

    demo_hall = db.get(Hall, "demo-hall-1")
    if not demo_hall:
        demo_hall = Hall(
            id="demo-hall-1",
            event_id=demo_event.id,
            name="Sample Hall 1",
            map_key="sample-hall-1",
        )
        db.add(demo_hall)
        db.commit()

    samples = [
        ("ex-001", "RoadTech Systems", "Road Infrastructure", "Demonstration exhibitor for road construction technology.", "B01", 100, 120),
        ("ex-002", "BridgeWorks India", "Bridge Engineering", "Demonstration exhibitor for bridge engineering.", "B02", 270, 120),
        ("ex-003", "SafeRoute Technologies", "Road Safety", "Demonstration exhibitor for road safety solutions.", "B03", 440, 120),
        ("ex-004", "GreenPavement Labs", "Materials", "Demonstration exhibitor for sustainable pavement materials.", "B04", 100, 300),
        ("ex-005", "InfraData Analytics", "Technology", "Demonstration exhibitor for infrastructure data.", "B05", 270, 300),
    ]

    for eid, name, category, description, code, x, y in samples:
        exhibitor = db.get(Exhibitor, eid)
        if not exhibitor:
            exhibitor = Exhibitor(
                id=eid,
                event_id=demo_event.id,
                name=name,
                category=category,
                description=description,
            )
            db.add(exhibitor)

        booth_id = f"booth-{code.lower()}"
        booth = db.get(Booth, booth_id)
        if not booth:
            db.add(
                Booth(
                    id=booth_id,
                    hall_id=demo_hall.id,
                    exhibitor_id=eid,
                    code=code,
                    x=x,
                    y=y,
                )
            )

    demo_node_data = [
        ("entrance", "Main Entrance", "entrance", 100, 389),
        ("junction-a", "Main Junction", "junction", 350, 242),
        ("junction-b", "North Aisle", "junction", 350, 150),
        ("junction-c", "South Aisle", "junction", 350, 330),
    ]

    for node_id, label, node_type, x, y in demo_node_data:
        node = db.get(NavigationNode, node_id)
        if not node:
            node = NavigationNode(
                id=node_id,
                hall_id=demo_hall.id,
                label=label,
                node_type=node_type,
                x=x,
                y=y,
            )
            db.add(node)
        else:
            node.hall_id = demo_hall.id
            node.label = label
            node.node_type = node_type
            node.x = x
            node.y = y

    # ---------------------------------------------------------
    # 2. Authoritative Event: irc-expo-2026 (HITEX Hyderabad)
    # ---------------------------------------------------------
    irc_event = db.get(Event, "irc-expo-2026")
    if not irc_event:
        irc_event = Event(
            id="irc-expo-2026",
            name="85th Annual Session of Indian Roads Congress (IRC 2026)",
            description="National exhibition on road and highway infrastructure, smart transport, and safety.",
            venue="HITEX Exhibition Centre, Hyderabad",
            is_demo=False,
            is_published=True,
            status="active",
        )
        db.add(irc_event)
        db.commit()

    hall_1 = db.get(Hall, "hall-1")
    if not hall_1:
        hall_1 = Hall(
            id="hall-1",
            event_id=irc_event.id,
            name="Hall-1 (Stalls 1 to 208)",
            map_key="hall-1",
            dimensions_length=120.0,
            dimensions_width=60.0,
            coordinate_system_type="svg_vector_dijkstra",
        )
        db.add(hall_1)

    hanger = db.get(Hall, "hanger")
    if not hanger:
        hanger = Hall(
            id="hanger",
            event_id=irc_event.id,
            name="Hanger (Stalls 209 to 387)",
            map_key="hanger",
            dimensions_length=120.0,
            dimensions_width=60.0,
            coordinate_system_type="svg_vector_dijkstra",
        )
        db.add(hanger)
    db.commit()

    # ---------------------------------------------------------
    # 3. Seed Authoritative Service Facilities
    # ---------------------------------------------------------
    facilities_data = [
        ("fac-reg", "hall-1", "Registration Counters 1–8", "registration", 1040, 795, "Main visitor check-in counters"),
        ("fac-help", "hall-1", "Help Desk & Information", "helpdesk", 1240, 795, "Delegate assistance and inquiries"),
        ("fac-ramappa", "hanger", "Theme Pavilion — Ramappa Temple", "landmark", 260, 410, "18m x 6m central cultural feature"),
        ("fac-committee", "hall-1", "IRC Committee Office", "office", 860, 750, "Organiser headquarters and secretariat"),
        ("fac-vip", "hall-1", "VIP Lounge & Protocol", "lounge", 980, 750, "Dignitary reception and hospitality"),
        ("fac-med", "hall-1", "First Aid & Medical Station", "medical", 1320, 750, "Emergency first aid and paramedics"),
        ("fac-food", "hanger", "Food Court & Dining Lawn", "dining", 65, 785, "Catering and delegate refreshment"),
        ("fac-wc-h1", "hall-1", "Restrooms (Hall-1)", "restroom", 1460, 750, "Public washroom facilities"),
        ("fac-wc-hgr", "hanger", "Restrooms (Hanger)", "restroom", 65, 105, "Public washroom facilities"),
    ]

    for fid, hid, fname, ftype, fx, fy, fdesc in facilities_data:
        fac = db.get(Facility, fid)
        if not fac:
            db.add(
                Facility(
                    id=fid,
                    hall_id=hid,
                    name=fname,
                    facility_type=ftype,
                    x=fx,
                    y=fy,
                    description=fdesc,
                    verification_status="verified",
                )
            )

    # ---------------------------------------------------------
    # 4. Seed Navigation Nodes & Edges from venueGraph
    # ---------------------------------------------------------
    venue_nodes_seed = [
        ("entrance_main", "hall-1", "Main Venue Entrance", "entrance", 1200, 830),
        ("entrance_hall1", "hall-1", "Hall-1 Entry Foyer", "entrance", 1200, 760),
        ("hall1_south_mid", "hall-1", "Hall-1 South Main Junction", "aisle", 1200, 740),
        ("hall1_mid_c1", "hall-1", "Hall-1 Center Junction 1", "aisle", 1070, 520),
        ("passage_mid", "hall-1", "Inter-Hall Connecting Passage", "passage", 780, 450),
        ("hanger_mid_ramappa_n", "hanger", "Ramappa Theme Pavilion (North Access)", "landmark", 470, 390),
        ("hanger_east_mid", "hanger", "Hanger East Junction (Passage)", "aisle", 690, 450),
        ("hanger_west_mid", "hanger", "Hanger West Corridor (Mid)", "aisle", 250, 450),
    ]

    for nid, hid, nlabel, ntype, nx, ny in venue_nodes_seed:
        node = db.get(NavigationNode, nid)
        if not node:
            db.add(
                NavigationNode(
                    id=nid,
                    hall_id=hid,
                    label=nlabel,
                    node_type=ntype,
                    x=nx,
                    y=ny,
                )
            )

    db.commit()
