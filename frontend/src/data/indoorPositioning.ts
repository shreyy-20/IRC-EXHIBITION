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

// Authoritative 8 Physical Kiosks across Both Hangars (4 in Hangar 1, 4 in Hangar 2)
export const PHYSICAL_KIOSKS: Record<string, PhysicalKiosk> = {
  // Hangar 1 (Hall-1)
  kiosk_1: {
    id: 'kiosk_1',
    name: 'Kiosk 1 — Hangar 1 Main Entrance & Foyer',
    locationName: 'Registration Foyer / Main Gate',
    nodeId: 'entrance_main',
    x: 1200,
    y: 830,
    hall: 'Hall-1',
    description: 'Touchscreen kiosk at the main visitor registration entrance and security gate.',
  },
  kiosk_2: {
    id: 'kiosk_2',
    name: 'Kiosk 2 — Hangar 1 West Aisle & Passage Access',
    locationName: 'West Aisle Junction near Connecting Passage',
    nodeId: 'hall1_mid_w',
    x: 890,
    y: 520,
    hall: 'Hall-1',
    description: 'Touchscreen kiosk serving Western Hall-1 stalls and inter-hangar passage.',
  },
  kiosk_3: {
    id: 'kiosk_3',
    name: 'Kiosk 3 — Hangar 1 Central Grand Promenade',
    locationName: 'Hall-1 6.0M Central Grand Aisle',
    nodeId: 'hall1_mid_c1',
    x: 1070,
    y: 520,
    hall: 'Hall-1',
    description: 'Central touchscreen kiosk between Platinum sponsors and central aisle.',
  },
  kiosk_4: {
    id: 'kiosk_4',
    name: 'Kiosk 4 — Hangar 1 North-East Wing',
    locationName: 'North-East 4.0M Corridor',
    nodeId: 'hall1_north_e',
    x: 1450,
    y: 320,
    hall: 'Hall-1',
    description: 'Touchscreen kiosk serving northern stalls and eastern sponsor pavilion.',
  },

  // Hangar 2 (Hanger)
  kiosk_5: {
    id: 'kiosk_5',
    name: 'Kiosk 5 — Hangar 2 East Passage Arrival Hub',
    locationName: 'Hanger East Aisle / Passage Exit',
    nodeId: 'hanger_east_mid',
    x: 690,
    y: 450,
    hall: 'Hanger',
    description: 'Touchscreen kiosk directly at arrival from the covered connecting passage.',
  },
  kiosk_6: {
    id: 'kiosk_6',
    name: 'Kiosk 6 — Hangar 2 Central Theme Pavilion Hub',
    locationName: 'Ramappa Temple Pavilion Concourse',
    nodeId: 'hanger_mid_ramappa_n',
    x: 470,
    y: 390,
    hall: 'Hanger',
    description: 'Touchscreen kiosk adjacent to the Ramappa Temple central landmark pavilion.',
  },
  kiosk_7: {
    id: 'kiosk_7',
    name: 'Kiosk 7 — Hangar 2 West Gate & Meeting Concourse',
    locationName: 'Hanger West 3.0M Aisle near West Gate 2',
    nodeId: 'hanger_west_mid',
    x: 250,
    y: 450,
    hall: 'Hanger',
    description: 'Touchscreen kiosk near West Gate 2, Photobooth and Meeting Space.',
  },
  kiosk_8: {
    id: 'kiosk_8',
    name: 'Kiosk 8 — Hangar 2 North Pavilion Promenade',
    locationName: 'Hanger North Aisle Junction',
    nodeId: 'hanger_mid_top',
    x: 470,
    y: 140,
    hall: 'Hanger',
    description: 'Touchscreen kiosk serving northern pavilion stalls and dining lawn access.',
  },
};

export function resolveKioskId(rawParam: string | null): PhysicalKiosk | null {
  if (!rawParam) return null;
  const p = rawParam.toLowerCase().trim();
  if (PHYSICAL_KIOSKS[p]) return PHYSICAL_KIOSKS[p];
  if (PHYSICAL_KIOSKS[`kiosk_${p}`]) return PHYSICAL_KIOSKS[`kiosk_${p}`];
  const num = parseInt(p, 10);
  if (!isNaN(num) && num >= 1 && num <= 8) {
    return PHYSICAL_KIOSKS[`kiosk_${num}`] || null;
  }
  if (p === 'kiosk_entrance') return PHYSICAL_KIOSKS['kiosk_1'];
  if (p === 'kiosk_hall1_center') return PHYSICAL_KIOSKS['kiosk_3'];
  if (p === 'kiosk_hanger_hub') return PHYSICAL_KIOSKS['kiosk_6'];
  return null;
}

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
    const k1 = PHYSICAL_KIOSKS['kiosk_1'];
    return {
      source: 'kiosk',
      id: k1.id,
      label: k1.name,
      nodeId: k1.nodeId,
      hall: k1.hall,
      coords: { x: k1.x, y: k1.y },
      headingDeg: null,
      timestamp: Date.now(),
    };
  }

  const params = new URLSearchParams(window.location.search);

  // 1. Kiosk parameter (?kiosk=kiosk_1 .. kiosk_8 or numeric ?kiosk=1 .. 8)
  const kioskParam = params.get('kiosk');
  const matchedKiosk = resolveKioskId(kioskParam);
  if (matchedKiosk) {
    return {
      source: 'kiosk',
      id: matchedKiosk.id,
      label: matchedKiosk.name,
      nodeId: matchedKiosk.nodeId,
      hall: matchedKiosk.hall,
      coords: { x: matchedKiosk.x, y: matchedKiosk.y },
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

  // 3. Fallback default: Kiosk 1 (Hangar 1 Main Entrance)
  const defaultKiosk = PHYSICAL_KIOSKS['kiosk_1'];
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
