from pydantic import BaseModel, ConfigDict, Field

class ExhibitorOut(BaseModel):
    id: str
    name: str
    category: str
    description: str
    website: str
    is_featured: bool = False
    model_config = ConfigDict(from_attributes=True)

class ExhibitorCreate(BaseModel):
    id: str = Field(min_length=2, max_length=64)
    event_id: str
    name: str = Field(min_length=2, max_length=200)
    category: str = "General"
    description: str = ""
    website: str = ""
    is_featured: bool = False

class BoothOut(BaseModel):
    id: str
    code: str
    x: float
    y: float
    width: float
    height: float
    exhibitor: ExhibitorOut | None = None
    model_config = ConfigDict(from_attributes=True)

class RouteRequest(BaseModel):
    start_node: str
    destination_node: str

class RouteResponse(BaseModel):
    nodes: list[str]
    distance_m: float
    walking_minutes: float
    message: str

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class HallCreate(BaseModel):
    id: str
    event_id: str
    name: str
    map_key: str = "sample-hall"

class BoothUpdate(BaseModel):
    code: str
    exhibitor_id: str | None = None
    x: float
    y: float
    width: float = 100
    height: float = 60

class FacilityCreate(BaseModel):
    id: str
    hall_id: str
    name: str
    facility_type: str
    x: float = 0
    y: float = 0

class NavigationNodeCreate(BaseModel):
    id: str
    hall_id: str
    label: str
    node_type: str = "junction"
    x: float = 0
    y: float = 0

class NavigationEdgeCreate(BaseModel):
    hall_id: str
    from_node: str
    to_node: str
    distance_m: float = Field(gt=0)
    is_accessible: bool = True
    is_blocked: bool = False
