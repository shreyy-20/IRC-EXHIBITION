
from sqlalchemy.orm import Session

from app.models import (
    Event,
    Hall,
    Exhibitor,
    Booth,
    NavigationNode,
    NavigationEdge,
    AdminUser,
)
from app.security import hash_password


def seed_demo(db: Session) -> None:
    # 1. Create the demo event if it does not exist.
    event = db.get(Event, "demo-irc-expo")

    if not event:
        event = Event(
            id="demo-irc-expo",
            name="IRC Exhibition Finder - Sample Exhibition",
            description=(
                "Demonstration event with fictional exhibitors "
                "and an illustrative floor map."
            ),
            venue="Sample Exhibition Venue",
            is_demo=True,
        )
        db.add(event)
        db.commit()

    # 2. Create the hall independently of the event check.
    hall = db.get(Hall, "demo-hall-1")

    if not hall:
        hall = Hall(
            id="demo-hall-1",
            event_id=event.id,
            name="Sample Hall 1",
            map_key="sample-hall-1",
        )
        db.add(hall)
        db.commit()

    # 3. Create demo exhibitors and booths.
    samples = [
        ("ex-001", "RoadTech Systems", "Road Infrastructure",
         "Demonstration exhibitor for road construction technology.",
         "B01", 100, 120),

        ("ex-002", "BridgeWorks India", "Bridge Engineering",
         "Demonstration exhibitor for bridge engineering.",
         "B02", 270, 120),

        ("ex-003", "SafeRoute Technologies", "Road Safety",
         "Demonstration exhibitor for road safety solutions.",
         "B03", 440, 120),

        ("ex-004", "GreenPavement Labs", "Materials",
         "Demonstration exhibitor for sustainable pavement materials.",
         "B04", 100, 300),

        ("ex-005", "InfraData Analytics", "Technology",
         "Demonstration exhibitor for infrastructure data.",
         "B05", 270, 300),
    ]

    for eid, name, category, description, code, x, y in samples:
        exhibitor = db.get(Exhibitor, eid)

        if not exhibitor:
            exhibitor = Exhibitor(
                id=eid,
                event_id=event.id,
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
                    hall_id=hall.id,
                    exhibitor_id=eid,
                    code=code,
                    x=x,
                    y=y,
                )
            )

       # 4. Create navigation nodes.
    # All coordinates below are illustrative SVG coordinates,
    # using the frontend FloorMap viewBox of 700 x 470.
    node_data = [
        ("entrance", "Main Entrance", "entrance", 100, 389),
        ("junction-a", "Main Junction", "junction", 350, 242),
        ("junction-b", "North Aisle", "junction", 350, 150),
        ("junction-c", "South Aisle", "junction", 350, 330),
    ]

    for node_id, label, node_type, x, y in node_data:
        node = db.get(NavigationNode, node_id)

        if not node:
            node = NavigationNode(
                id=node_id,
                hall_id=hall.id,
                label=label,
                node_type=node_type,
                x=x,
                y=y,
            )
            db.add(node)
        else:
            # Update existing seeded nodes too. This corrects old (0, 0)
            # coordinates without requiring deletion of the database.
            node.hall_id = hall.id
            node.label = label
            node.node_type = node_type
            node.x = x
            node.y = y

    # Booth node coordinates correspond to the centres of the
    # five illustrative booth rectangles in FloorMap.tsx.
    booth_node_data = [
        ("booth-b01", "Booth B01", 150, 150),
        ("booth-b02", "Booth B02", 320, 150),
        ("booth-b03", "Booth B03", 490, 150),
        ("booth-b04", "Booth B04", 150, 330),
        ("booth-b05", "Booth B05", 320, 330),
    ]

    for node_id, label, x, y in booth_node_data:
        node = db.get(NavigationNode, node_id)

        if not node:
            node = NavigationNode(
                id=node_id,
                hall_id=hall.id,
                label=label,
                node_type="booth",
                x=x,
                y=y,
            )
            db.add(node)
        else:
            node.hall_id = hall.id
            node.label = label
            node.node_type = "booth"
            node.x = x
            node.y = y

    db.flush()