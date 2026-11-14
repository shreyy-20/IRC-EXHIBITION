
import type {
  EventInfo,
  Exhibitor,
  Booth,
  RouteResult,
  NavigationGraph,
} from './types';

// --------------------------------------------------
// API CONFIGURATION
// --------------------------------------------------

const rawApi = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const cleanApi = rawApi.replace(/\/+$/, '');
const API = cleanApi.endsWith('/api') ? cleanApi : `${cleanApi}/api`;


// --------------------------------------------------
// GENERIC API REQUEST HANDLER
// --------------------------------------------------

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    throw new Error(
      body.detail || `Request failed (${response.status})`
    );
  }

  return response.json() as Promise<T>;
}


// --------------------------------------------------
// EVENT APIs
// --------------------------------------------------

export const getEvent = (id: string) =>
  request<EventInfo>(
    `/events/${encodeURIComponent(id)}`
  );


export const getExhibitors = (
  id: string,
  q = ''
) =>
  request<Exhibitor[]>(
    `/events/${encodeURIComponent(id)}/exhibitors${
      q ? `?q=${encodeURIComponent(q)}` : ''
    }`
  );


// --------------------------------------------------
// BOOTH APIs
// --------------------------------------------------

export const getBooths = (hallId: string) =>
  request<Booth[]>(
    `/halls/${encodeURIComponent(hallId)}/booths`
  );


// --------------------------------------------------
// NAVIGATION APIs
// --------------------------------------------------

// Fetch navigation nodes and edges for SVG floor map.
export const getNavigationGraph = (
  hallId: string
) =>
  request<NavigationGraph>(
    `/navigation/halls/${encodeURIComponent(hallId)}/graph`
  );


// Calculate shortest route between two navigation nodes.
export const getRoute = (
  start_node: string,
  destination_node: string
) =>
  request<RouteResult>(
    '/navigation/route',
    {
      method: 'POST',
      body: JSON.stringify({
        start_node,
        destination_node,
      }),
    }
  );
