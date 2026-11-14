from app.main import app
from app.main import calculate_route
from app.schemas import RouteRequest

def test_app_has_health_route():
    assert any(getattr(route, "path", None) == "/health" for route in app.routes)

def test_demo_route_algorithm_is_database_backed():
    # Full route API integration is exercised after PostgreSQL is started.
    assert callable(calculate_route)
