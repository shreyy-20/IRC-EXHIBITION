// Indoor Positioning Framework for IRC Exhibition Finder
// Supports Physical Touchscreen Kiosks, Mobile QR Checkpoint scans, and Continuous Positioning

export type PhysicalKiosk = {
  id: string;
  name: string;
  locationName: string;
  nodeId: string;
  x: number;
  y: number;
  hall: 'Hall-1' | 'Hanger';
  description: string;
};

export type QRCheckpoint = {
  id: string;
  code: string;
  label: string;
  locationName: string;
  nodeId: string;
  x: number;
  y: number;
  hall: 'Hall-1' | 'Hanger' | 'Passage';
  description: string;
};

export type PositioningState = {
  source: 'kiosk' | 'qr_checkpoint' | 'manual' | 'sensor';
  id: string;
  label: string;
  nodeId: string;
  hall: 'Hall-1' | 'Hanger' | 'Passage';
  coords: { x: number; y: number };
  headingDeg: number | null;
  timestamp: number;
};

// Authoritative Physical Kiosks at HITEX Hyderabad Venue
export const PHYSICAL_KIOSKS: Record<string, PhysicalKiosk> = {
  kiosk_entrance: {
    id: 'kiosk_entrance',
    name: 'Kiosk 1 — Main Entrance',
    locationName: 'Registration Foyer & Main Gate',
    nodeId: 'entrance_main',
    x: 1200,
    y: 830,
    hall: 'Hall-1',
    description: 'Touchscreen terminal at the visitor registration and security entrance.',
  },
  kiosk_hall1_center: {
    id: 'kiosk_hall1_center',
    name: 'Kiosk 2 — Hall-1 Central Hub',
    locationName: 'Hall-1 6.0M Central Grand Aisle',
    nodeId: 'hall1_mid_c1',
    x: 1070,
    y: 520,
    hall: 'Hall-1',
    description: 'Touchscreen kiosk between Platinum sponsor stalls and central aisle.',
  },
  kiosk_hanger_hub: {
    id: 'kiosk_hanger_hub',
    name: 'Kiosk 3 — Hanger Central Hub',
    locationName: 'Ramappa Temple Theme Pavilion Promenade',
    nodeId: 'hanger_mid_ramappa_n',
    x: 470,
    y: 390,
    hall: 'Hanger',
    description: 'Touchscreen kiosk adjacent to the 18m × 6m Ramappa Temple landmark.',
  },
};

// Physical QR Wayfinding Checkpoints installed throughout the exhibition
export const QR_CHECKPOINTS: QRCheckpoint[] = [
  {
    id: 'cp_entrance',
    code: 'CP-01',
    label: 'Main Registration & Entrance',
    locationName: 'Foyer / Gate A',
    nodeId: 'entrance_main',
    x: 1200,
    y: 830,
    hall: 'Hall-1',
    description: 'Main arrival foyer directly opposite Registration Counters 1–8.',
  },
  {
    id: 'cp_hall1_foyer',
    code: 'CP-02',
    label: 'Hall-1 South Promenade',
    locationName: 'Hall-1 South 6.0M Aisle',
    nodeId: 'hall1_south_mid',
    x: 1200,
    y: 740,
    hall: 'Hall-1',
    description: 'Southern arterial corridor inside Hall-1 beside Committee Office.',
  },
  {
    id: 'cp_hall1_center',
    code: 'CP-03',
    label: 'Hall-1 Central Grand Aisle',
    locationName: 'Hall-1 Center Junction',
    nodeId: 'hall1_mid_c1',
    x: 1070,
    y: 520,
    hall: 'Hall-1',
    description: 'Major intersection connecting Cross Aisle 1 with 6.0M Central Grand Aisle.',
  },
  {
    id: 'cp_passage',
    code: 'CP-04',
    label: 'Inter-Hall Connecting Passage',
    locationName: 'Covered 2.5M Walkway',
    nodeId: 'passage_mid',
    x: 780,
    y: 450,
    hall: 'Passage',
    description: 'Weatherproof connecting passage between Hall-1 and Hanger.',
  },
  {
    id: 'cp_ramappa',
    code: 'CP-05',
    label: 'Ramappa Temple Pavilion',
    locationName: 'Hanger Central Promenade (4.0M)',
    nodeId: 'hanger_mid_ramappa_n',
    x: 470,
    y: 390,
    hall: 'Hanger',
    description: 'Central cultural exhibition pavilion in Hanger.',
  },
  {
    id: 'cp_hanger_east',
    code: 'CP-06',
    label: 'Hanger East Corridor',
    locationName: 'Passage Exit / Hanger East Aisle',
    nodeId: 'hanger_east_mid',
    x: 690,
    y: 450,
    hall: 'Hanger',
    description: 'East corridor entry point immediately after crossing from Hall-1.',
  },
  {
    id: 'cp_hanger_west',
    code: 'CP-07',
    label: 'Hanger West Corridor',
    locationName: 'Hanger West 3.0M Aisle',
    nodeId: 'hanger_west_mid',
    x: 250,
    y: 450,
    hall: 'Hanger',
    description: 'Western corridor near Stalls 350–387 and dining lawn access.',
  },
];

/**
 * Resolves initial position from URL query parameters (?kiosk=..., ?checkpoint=..., ?start=...)
 * Defaults to Main Entrance Kiosk.
 */
export function resolveInitialPosition(): PositioningState {
  if (typeof window === 'undefined') {
    return {
      source: 'kiosk',
      id: 'kiosk_entrance',
      label: 'Kiosk 1 — Main Entrance',
      nodeId: 'entrance_main',
      hall: 'Hall-1',
      coords: { x: 1200, y: 830 },
      headingDeg: null,
      timestamp: Date.now(),
    };
  }

  const params = new URLSearchParams(window.location.search);

  // 1. Kiosk parameter (?kiosk=kiosk_hall1_center)
  const kioskParam = params.get('kiosk');
  if (kioskParam && PHYSICAL_KIOSKS[kioskParam]) {
    const k = PHYSICAL_KIOSKS[kioskParam];
    return {
      source: 'kiosk',
      id: k.id,
      label: k.name,
      nodeId: k.nodeId,
      hall: k.hall,
      coords: { x: k.x, y: k.y },
      headingDeg: null,
      timestamp: Date.now(),
    };
  }

  // 2. QR Checkpoint parameter (?checkpoint=cp_ramappa or ?cp=CP-05)
  const cpParam = params.get('checkpoint') || params.get('cp');
  if (cpParam) {
    const match = QR_CHECKPOINTS.find(
      (cp) => cp.id === cpParam || cp.code.toLowerCase() === cpParam.toLowerCase()
    );
    if (match) {
      return {
        source: 'qr_checkpoint',
        id: match.id,
        label: `${match.code} — ${match.label}`,
        nodeId: match.nodeId,
        hall: match.hall,
        coords: { x: match.x, y: match.y },
        headingDeg: null,
        timestamp: Date.now(),
      };
    }
  }

  // 3. Fallback default
  const defaultKiosk = PHYSICAL_KIOSKS.kiosk_entrance;
  return {
    source: 'kiosk',
    id: defaultKiosk.id,
    label: defaultKiosk.name,
    nodeId: defaultKiosk.nodeId,
    hall: defaultKiosk.hall,
    coords: { x: defaultKiosk.x, y: defaultKiosk.y },
    headingDeg: null,
    timestamp: Date.now(),
  };
}

/**
 * Builds a mobile navigation URL targeting a specific checkpoint and optional destination.
 */
export function buildCheckpointNavUrl(checkpointId: string, destinationId?: string): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams();
  params.set('checkpoint', checkpointId);
  if (destinationId) {
    params.set('destination', destinationId);
  }
  return `${base}?${params.toString()}`;
}
