
export type EventInfo = {
  id: string;
  name: string;
  description: string;
  venue: string;
  is_demo: boolean;
};

export type Exhibitor = {
  id: string;
  name: string;
  category: string;
  description: string;
  website: string;
};

export type Booth = {
  id: string;
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  exhibitor: Exhibitor | null;
};

export type RouteResult = {
  nodes: string[];
  distance_m: number;
  walking_minutes: number;
  message: string;
};

// Individual indoor navigation point
export type NavigationNode = {
  id: string;
  label: string;
  node_type: string;
  x: number;
  y: number;
};

// Complete navigation graph for a hall
export type NavigationGraph = {
  hall_id: string;

  coordinate_system: {
    type: string;
    viewBox: string;
    is_official_venue_map: boolean;
  };

  nodes: NavigationNode[];

  edges: {
    id: number;
    from_node: string;
    to_node: string;
    distance_m: number;
    is_accessible: boolean;
    is_blocked: boolean;
  }[];
};
