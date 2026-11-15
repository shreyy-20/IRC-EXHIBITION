import { useRef, useState, useEffect, useMemo } from 'react';
import type { PointerEvent, WheelEvent } from 'react';
import {
  Maximize2,
  Crosshair,
  Play,
  Volume2,
  VolumeX,
  X,
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  DoorOpen,
  CheckCircle2,
  Compass,
  Plus,
  Minus,
  Search,
} from 'lucide-react';
import type { ClubbedExhibitor } from '../data/clubbedExhibitors';
import type { RoutePath, NavNode } from '../data/venueGraph';
import { FLOOR_PATHWAYS } from '../data/floorPathways';
import type { HallTab } from './HallSelector';

type Props = {
  exhibitors: ClubbedExhibitor[];
  selectedExhibitor: ClubbedExhibitor | null;
  onSelectExhibitor: (exhibitor: ClubbedExhibitor) => void;
  activeHall: HallTab;
  route: RoutePath | null;
  activeStepIndex?: number | null;
  onSelectStep?: (index: number) => void;
  onExitNavigation?: () => void;
  isNavigatingLive?: boolean;
  onStartNavigation?: () => void;
  onShowDirections?: () => void;
  drawerOpen?: boolean;
  isMobile?: boolean;
  liveCoords?: { x: number; y: number } | null;
  liveHeading?: number | null;
  liveWalkedMeters?: number;
  liveStatusText?: string;
  hasArrived?: boolean;
  onManualStepAdvance?: () => void;
  onReanchorCheckpoint?: () => void;
  startCoords?: { x: number; y: number };
  startLabel?: string;
};

type ViewBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const VIEW_PRESETS: Record<HallTab, ViewBox> = {
  all: { x: 0, y: 0, width: 1600, height: 900 },
  'hall-1': { x: 820, y: 50, width: 730, height: 800 },
  hanger: { x: 50, y: 50, width: 730, height: 800 },
};

function isValidViewBox(vb?: ViewBox | null): vb is ViewBox {
  if (!vb) return false;
  return (
    Number.isFinite(vb.x) &&
    Number.isFinite(vb.y) &&
    Number.isFinite(vb.width) &&
    Number.isFinite(vb.height) &&
    vb.width > 50 &&
    vb.height > 50
  );
}

function clampViewBox(vb: ViewBox, defaultPreset: ViewBox): ViewBox {
  if (!isValidViewBox(vb)) return { ...defaultPreset };
  const minW = 200;
  const maxW = 2600;
  const width = Math.max(minW, Math.min(maxW, vb.width));
  const height = width * (defaultPreset.height / defaultPreset.width);
  const x = Math.max(-500, Math.min(1900, vb.x));
  const y = Math.max(-350, Math.min(1300, vb.y));
  return { x, y, width, height };
}

type RouteSegment = {
  fromNode: NavNode;
  toNode: NavNode;
  dx: number;
  dy: number;
  length: number;
  distanceM: number;
  angleDeg: number;
  cumDistSvg: number;
  stepIndex: number;
};

// Web Audio API Synthesizers for authentic navigation feedback
function playTurnChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // Autoplay restrictions
  }
}

function playArrivalChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.1, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.28);
    });
  } catch {
    // Autoplay restrictions
  }
}

// Clean corporate boilerplate suffixes for crisp, non-clustered stall labels when zoomed out
function cleanSimplifiedName(name: string): string {
  const stripped = name
    .replace(/\s*\((?:INDIA|A UNIT OF.*?|3M|P|LIMITED|PVT|LTD)\)/gi, '')
    .replace(/\b(?:PRIVATE LIMITED|PVT\.?\s*LTD\.?|LIMITED|LTD\.?|LLP|ENTERPRISES|TECHNOLOGIES|CONSULTING|ENGINEERS|INDUSTRIES)\b/gi, '')
    .trim()
    .replace(/\s{2,}/g, ' ');
  return stripped || name.trim();
}

// Word-wrapping and text scaling helper for exhibitor stalls with Level-of-Detail
function getWrappedLines(
  companyName: string,
  width: number,
  height: number,
  isSimplified = false
): { lines: string[]; fontSize: number; lineHeight: number } {
  const targetName = isSimplified ? cleanSimplifiedName(companyName) : companyName.trim();
  const words = targetName.split(/\s+/).filter(Boolean);

  let fontSize = 9;
  if (width < 50 || height < 36) fontSize = 7;
  else if (width < 70 || height < 46) fontSize = 8;
  else if (width >= 110 && height >= 65) fontSize = 10;
  else if (width >= 140 && height >= 80) fontSize = 11.5;

  const lineHeight = fontSize * 1.25;
  const paddingX = 4;
  const maxCharsPerLine = Math.max(4, Math.floor((width - paddingX * 2) / (fontSize * 0.54)));
  const maxLines = Math.max(1, Math.floor((height - 4) / lineHeight));

  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines) break;
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  const totalWords = words.length;
  const packedWords = lines.join(' ').split(/\s+/).length;
  if (packedWords < totalWords && lines.length > 0) {
    const last = lines[lines.length - 1];
    if (last.length > maxCharsPerLine - 2) {
      lines[lines.length - 1] = last.substring(0, Math.max(2, maxCharsPerLine - 3)) + '…';
    } else {
      lines[lines.length - 1] = last + '…';
    }
  }

  return { lines, fontSize, lineHeight };
}

export function getStallBadge(ex: ClubbedExhibitor): { tag: string; stripeColor: string; bg: string } {
  const cat = (ex.category || '').toLowerCase();
  const id = (ex.id || '').toLowerCase();
  const firstStall = ex.stalls && ex.stalls.length > 0 ? ex.stalls[0] : '';

  if (cat.includes('gold') || id.includes('gold')) {
    return { tag: `GOLD-${firstStall || '5'}`, stripeColor: '#f59e0b', bg: '#fefce8' };
  }
  if (cat.includes('diamond') || id.includes('diamond')) {
    return { tag: `DIAMOND-${firstStall || '3'}`, stripeColor: '#0ea5e9', bg: '#f0f9ff' };
  }
  if (cat.includes('platinum') || id.includes('platinum')) {
    return { tag: `PLATINUM-${firstStall || '2'}`, stripeColor: '#64748b', bg: '#f8fafc' };
  }
  if (cat.includes('principal') || id.includes('principal')) {
    return { tag: 'PRINCIPAL', stripeColor: '#8b5cf6', bg: '#faf5ff' };
  }
  return { tag: firstStall ? `BOOTH ${firstStall}` : 'EXHIBITOR', stripeColor: '#3b82f6', bg: '#ffffff' };
}

export default function InteractiveFloorMap({
  exhibitors,
  selectedExhibitor,
  onSelectExhibitor,
  activeHall,
  route,
  activeStepIndex = null,
  onSelectStep,
  onExitNavigation,
  isNavigatingLive = false,
  onStartNavigation,
  onShowDirections,
  drawerOpen = false,
  isMobile = false,
  liveCoords = null,
  liveHeading = null,
  liveWalkedMeters = 0,
  liveStatusText = '',
  hasArrived = false,
  onManualStepAdvance,
  onReanchorCheckpoint,
  startCoords,
  startLabel,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<ViewBox>(VIEW_PRESETS[activeHall]);
  const [, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const showAisleLabels = false;

  // Zoom scale and Level-of-Detail (LOD) detection
  const zoomScale = useMemo(() => {
    return isValidViewBox(view) ? 1600 / view.width : 1;
  }, [view]);
  const isZoomedOut = zoomScale < 1.35;

  // Live Navigation States
  const [isCameraFollowEnabled, setIsCameraFollowEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Multi-touch gestures & drag detection refs
  const dragRef = useRef<{
    x: number;
    y: number;
    viewX: number;
    viewY: number;
  } | null>(null);

  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartViewRef = useRef<ViewBox | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const pointerDownOriginRef = useRef<{ x: number; y: number } | null>(null);

  const lastChimedStepRef = useRef<number>(-1);

  // Calculate discrete route segments
  const segments: RouteSegment[] = useMemo(() => {
    if (!route || route.nodes.length <= 1) return [];
    const list: RouteSegment[] = [];
    let cum = 0;
    for (let i = 0; i < route.nodes.length - 1; i++) {
      const fromNode = route.nodes[i];
      const toNode = route.nodes[i + 1];
      const dx = toNode.x - fromNode.x;
      const dy = toNode.y - fromNode.y;
      const length = Math.hypot(dx, dy);
      const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
      const step = route.steps?.[i + 1];
      const distanceM = step ? step.distanceM : Math.round(length * 0.1);
      list.push({
        fromNode,
        toNode,
        dx,
        dy,
        length,
        distanceM,
        angleDeg,
        cumDistSvg: cum,
        stepIndex: i + 1,
      });
      cum += length;
    }
    return list;
  }, [route]);

  // Current User Position (Live from phone sensors when navigating, or fixed start anchor)
  const currentUserPos = useMemo(() => {
    if (isNavigatingLive && liveCoords) {
      return liveCoords;
    }
    if (startCoords) {
      return startCoords;
    }
    if (route && route.nodes.length > 0) {
      return { x: route.nodes[0].x, y: route.nodes[0].y };
    }
    return { x: 1200, y: 830 };
  }, [isNavigatingLive, liveCoords, startCoords, route]);

  // User Heading / Compass Bearing
  const userBearing = useMemo(() => {
    if (isNavigatingLive && liveHeading !== null && liveHeading !== undefined) {
      return liveHeading;
    }
    if (segments.length > 0) {
      return segments[0].angleDeg;
    }
    return 0;
  }, [isNavigatingLive, liveHeading, segments]);

  // Remaining Distance in Meters
  const remainingDistanceMeters = useMemo(() => {
    if (!route) return 0;
    if (hasArrived) return 0;
    if (isNavigatingLive && liveWalkedMeters > 0) {
      return Math.max(0, Math.round(route.distanceMeters - liveWalkedMeters));
    }
    return route.distanceMeters;
  }, [route, hasArrived, isNavigatingLive, liveWalkedMeters]);

  // Active Segment & Turn Distance Calculation
  const { currentStepIndex, distanceToNextTurn } = useMemo(() => {
    if (!route || segments.length === 0) {
      return { currentStepIndex: 0, distanceToNextTurn: 0 };
    }

    let bestSeg = segments[0];
    let bestDist = Infinity;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const midX = (seg.fromNode.x + seg.toNode.x) / 2;
      const midY = (seg.fromNode.y + seg.toNode.y) / 2;
      const d = Math.hypot(midX - currentUserPos.x, midY - currentUserPos.y);
      if (d < bestDist) {
        bestDist = d;
        bestSeg = seg;
      }
    }

    const distToTurn = Math.round(
      Math.hypot(bestSeg.toNode.x - currentUserPos.x, bestSeg.toNode.y - currentUserPos.y) * 0.1
    );

    return {
      currentStepIndex: bestSeg.stepIndex,
      distanceToNextTurn: distToTurn,
    };
  }, [route, segments, currentUserPos]);

  // Play arrival chime on arrival
  useEffect(() => {
    if (hasArrived && soundEnabled) {
      playArrivalChime();
    }
  }, [hasArrived, soundEnabled]);

  // Turn chime when advancing to a new step
  useEffect(() => {
    if (soundEnabled && isNavigatingLive && currentStepIndex > 0 && lastChimedStepRef.current !== currentStepIndex) {
      lastChimedStepRef.current = currentStepIndex;
      playTurnChime();
    }
  }, [currentStepIndex, isNavigatingLive, soundEnabled]);

  // Mobile Camera Auto-Follow (Center smoothly around user's walking dot during live navigation)
  useEffect(() => {
    if (!isNavigatingLive || !isMobile || !isCameraFollowEnabled || !currentUserPos) return;

    setView((curr) => {
      const safeCurr = isValidViewBox(curr) ? curr : VIEW_PRESETS[activeHall];
      const targetW = 680;
      const targetH = 480;
      const targetX = currentUserPos.x - targetW / 2;
      const targetY = currentUserPos.y - targetH / 2;

      return clampViewBox(
        {
          x: safeCurr.x + (targetX - safeCurr.x) * 0.25,
          y: safeCurr.y + (targetY - safeCurr.y) * 0.25,
          width: targetW,
          height: targetH,
        },
        VIEW_PRESETS[activeHall]
      );
    });
  }, [currentUserPos, isNavigatingLive, isMobile, isCameraFollowEnabled, activeHall]);

  // Sync view when activeHall changes explicitly (Preserve viewport on stall selection)
  useEffect(() => {
    if (!isNavigatingLive) {
      setView(VIEW_PRESETS[activeHall]);
      setZoom(1);
    }
  }, [activeHall, isNavigatingLive]);

  // Inform parent step tracker
  useEffect(() => {
    if (currentStepIndex !== activeStepIndex) {
      onSelectStep?.(currentStepIndex);
    }
  }, [currentStepIndex, activeStepIndex, onSelectStep]);

  function changeZoom(factor: number) {
    setIsCameraFollowEnabled(false);
    setView((curr) => {
      const safeCurr = isValidViewBox(curr) ? curr : VIEW_PRESETS[activeHall];
      const newW = safeCurr.width * factor;
      const newH = safeCurr.height * factor;
      if (newW < 200 || newW > 2600) return safeCurr;

      setZoom(1600 / newW);
      return clampViewBox(
        {
          x: safeCurr.x + (safeCurr.width - newW) / 2,
          y: safeCurr.y + (safeCurr.height - newH) / 2,
          width: newW,
          height: newH,
        },
        VIEW_PRESETS[activeHall]
      );
    });
  }

  function resetView() {
    setIsCameraFollowEnabled(true);
    setView(VIEW_PRESETS[activeHall]);
    setZoom(1);
  }

  function handleWheel(e: WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    setIsCameraFollowEnabled(false);
    const factor = e.deltaY < 0 ? 0.88 : 1.14;
    changeZoom(factor);
  }

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // Completely isolate stall selection from map dragging/panning
    const target = e.target as Element | null;
    if (target && target.closest && target.closest('.interactive-booth-group')) {
      return;
    }

    setIsCameraFollowEnabled(false);

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointersRef.current.size === 1) {
      pointerDownOriginRef.current = { x: e.clientX, y: e.clientY };
      isDraggingRef.current = false;
      dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        viewX: isValidViewBox(view) ? view.x : VIEW_PRESETS[activeHall].x,
        viewY: isValidViewBox(view) ? view.y : VIEW_PRESETS[activeHall].y,
      };
    } else if (activePointersRef.current.size === 2) {
      // Begin 2-finger pinch gesture
      const pts = Array.from(activePointersRef.current.values());
      pinchStartDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartViewRef.current = isValidViewBox(view) ? { ...view } : { ...VIEW_PRESETS[activeHall] };
      isDraggingRef.current = true;
    }
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!activePointersRef.current.has(e.pointerId)) return;
    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const numPointers = activePointersRef.current.size;

    if (numPointers === 1 && dragRef.current && svgRef.current) {
      const origin = pointerDownOriginRef.current;
      const moveDist = origin ? Math.hypot(e.clientX - origin.x, e.clientY - origin.y) : 0;

      // Only engage map panning if moved beyond 6px (prevents tap jitter from canceling stall selection)
      if (moveDist > 6) {
        if (!isDraggingRef.current) {
          isDraggingRef.current = true;
          setDragging(true);
        }
        const rect = svgRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const dx = ((e.clientX - dragRef.current.x) / rect.width) * view.width;
          const dy = ((e.clientY - dragRef.current.y) / rect.height) * view.height;

          setView((curr) =>
            clampViewBox(
              {
                ...curr,
                x: dragRef.current!.viewX - dx,
                y: dragRef.current!.viewY - dy,
              },
              VIEW_PRESETS[activeHall]
            )
          );
        }
      }
    } else if (
      numPointers === 2 &&
      pinchStartDistRef.current &&
      pinchStartViewRef.current &&
      svgRef.current
    ) {
      // Two-finger pinch-to-zoom
      const pts = Array.from(activePointersRef.current.values());
      const currentDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchStartDistRef.current > 15 && currentDist > 15) {
        isDraggingRef.current = true;
        setDragging(true);
        const scale = pinchStartDistRef.current / currentDist;
        const initialView = pinchStartViewRef.current;
        const rect = svgRef.current.getBoundingClientRect();

        if (rect.width > 0 && rect.height > 0) {
          const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
          const midY = (pts[0].y + pts[1].y) / 2 - rect.top;

          const focalSvgX = initialView.x + (midX / rect.width) * initialView.width;
          const focalSvgY = initialView.y + (midY / rect.height) * initialView.height;

          const newW = initialView.width * scale;
          const newH = initialView.height * scale;

          const newX = focalSvgX - (midX / rect.width) * newW;
          const newY = focalSvgY - (midY / rect.height) * newH;

          setView(
            clampViewBox(
              { x: newX, y: newY, width: newW, height: newH },
              VIEW_PRESETS[activeHall]
            )
          );
        }
      }
    }
  }

  function handlePointerUp(e: PointerEvent<SVGSVGElement>) {
    activePointersRef.current.delete(e.pointerId);

    if (activePointersRef.current.size === 0) {
      dragRef.current = null;
      pinchStartDistRef.current = null;
      pinchStartViewRef.current = null;
      pointerDownOriginRef.current = null;
      setDragging(false);
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 60);
    } else if (activePointersRef.current.size === 1) {
      const remaining = Array.from(activePointersRef.current.values())[0];
      dragRef.current = {
        x: remaining.x,
        y: remaining.y,
        viewX: isValidViewBox(view) ? view.x : VIEW_PRESETS[activeHall].x,
        viewY: isValidViewBox(view) ? view.y : VIEW_PRESETS[activeHall].y,
      };
      pinchStartDistRef.current = null;
      pinchStartViewRef.current = null;
      pointerDownOriginRef.current = { x: remaining.x, y: remaining.y };
    }
  }

  // Filter exhibitors: display officially allotted exhibitor stalls only
  const visibleExhibitors = useMemo(() => {
    return exhibitors.filter((ex) => {
      if (ex.allocationStatus === 'unassigned') return false;
      if (ex.isServiceCounter) return false;
      if (activeHall === 'hall-1') return ex.hall === 'Hall-1';
      if (activeHall === 'hanger') return ex.hall === 'Hanger';
      return true;
    });
  }, [exhibitors, activeHall]);

  // Filter pathways according to active hall
  const visiblePathways = FLOOR_PATHWAYS.filter((p) => {
    if (activeHall === 'hall-1') return p.hall === 'Hall-1' || p.hall === 'Passage';
    if (activeHall === 'hanger') return p.hall === 'Hanger' || p.hall === 'Passage';
    return true;
  });

  // Path SVG string
  const routePathD =
    route && route.nodes.length > 1
      ? `M ${route.nodes[0].x} ${route.nodes[0].y} ` +
        route.nodes.slice(1).map((n) => `L ${n.x} ${n.y}`).join(' ')
      : '';

  const currentStep =
    route?.steps && currentStepIndex !== null && currentStepIndex !== undefined
      ? route.steps[currentStepIndex] || route.steps[0]
      : route?.steps?.[0];

  function getStepManeuverIcon(turnType?: string) {
    switch (turnType) {
      case 'left':
        return <CornerUpLeft size={22} className="gmaps-hud-icon left" />;
      case 'right':
        return <CornerUpRight size={22} className="gmaps-hud-icon right" />;
      case 'passage':
        return <DoorOpen size={22} className="gmaps-hud-icon passage" />;
      case 'arrive':
        return <CheckCircle2 size={22} className="gmaps-hud-icon arrive" />;
      case 'start':
        return <Compass size={22} className="gmaps-hud-icon start" />;
      default:
        return <ArrowUp size={22} className="gmaps-hud-icon straight" />;
    }
  }

  // Calculate ETA time
  const etaMinutes = Math.max(1, Math.round((remainingDistanceMeters / 65) * 10) / 10);
  const etaDate = new Date(Date.now() + etaMinutes * 60 * 1000);
  const etaTimeStr = etaDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="interactive-map-wrapper" ref={containerRef}>
      {/* Floating Vertical Zoom Pill (Reference Image 1) */}
      <div className="reference-zoom-pill" aria-label="Map Zoom and Fit Controls">
        <button
          type="button"
          onClick={() => changeZoom(0.8)}
          title="Zoom In"
          aria-label="Zoom in"
        >
          <Plus size={18} />
        </button>
        <div className="zoom-pill-divider" />
        <button
          type="button"
          onClick={() => changeZoom(1.25)}
          title="Zoom Out"
          aria-label="Zoom out"
        >
          <Minus size={18} />
        </button>
        <div className="zoom-pill-divider" />
        <button
          type="button"
          onClick={resetView}
          title="Reset and Fit Floor Plan"
          aria-label="Fit floor plan"
        >
          <Maximize2 size={16} />
        </button>
      </div>

      {/* SVG Canvas Container with Overlays */}
      <div className="svg-canvas-container">
        {/* ========================================================
            GOOGLE MAPS FLOATING TOP NAVIGATION HUD (LIVE NAVIGATION)
           ======================================================== */}
        {route && isNavigatingLive && (
          <div className="google-nav-top-hud">
            <div className="hud-maneuver-col">
              <div className="hud-maneuver-circle">
                {hasArrived ? (
                  <CheckCircle2 size={26} className="gmaps-hud-icon arrive" />
                ) : (
                  getStepManeuverIcon(currentStep?.turnType)
                )}
              </div>
            </div>

            <div className="hud-instruction-col">
              {hasArrived ? (
                <>
                  <div className="hud-distance-main arrived">YOU HAVE ARRIVED</div>
                  <div className="hud-corridor-name">
                    {selectedExhibitor?.companyName}
                  </div>
                </>
              ) : (
                <>
                  <div className="hud-distance-main">
                    {distanceToNextTurn > 0 ? `In ${distanceToNextTurn} m` : 'Proceed along path'}
                  </div>
                  <div className="hud-corridor-name">
                    {currentStep?.instruction || 'Follow highlighted walkway'}
                  </div>
                </>
              )}
            </div>

            <div className="hud-actions-col">
              <button
                type="button"
                className={`hud-audio-btn ${soundEnabled ? 'is-active' : ''}`}
                onClick={() => setSoundEnabled((prev) => !prev)}
                title={soundEnabled ? 'Mute navigation audio' : 'Enable turn audio cues'}
              >
                {soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
              </button>
              <button
                type="button"
                className="hud-close-btn"
                onClick={() => onExitNavigation?.()}
                title="Exit navigation mode"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================
            BOTTOM FLOATING ROUTE STRIP (REFERENCE IMAGE 1)
           ======================================================== */}
        {route && !drawerOpen && !isNavigatingLive && (
          <div className="reference-bottom-route-bar">
            <div className="reference-route-summary-card">
              <span className="ref-route-meters">{route.distanceMeters} m</span>
              <span className="ref-route-text">
                about {route.walkingMinutes} min walk from {route.nodes[0]?.label || 'Start'}
              </span>
              <button
                type="button"
                className="ref-route-end-btn"
                onClick={() => onExitNavigation?.()}
                title="End route"
              >
                End route
              </button>
            </div>

            <div className="ref-bottom-actions-cluster">
              {isMobile && onStartNavigation && (
                <button
                  type="button"
                  className="ref-start-live-nav-btn"
                  onClick={() => onStartNavigation()}
                  title="Start live movement navigation"
                >
                  <Play size={16} fill="currentColor" />
                  <span>START NAVIGATION</span>
                </button>
              )}
              <button
                type="button"
                className="ref-show-directions-btn"
                onClick={() => onShowDirections?.()}
                title="Show turn-by-turn directions"
              >
                <Search size={16} />
                <span>Show directions</span>
                <span className="ref-sparkle-dot" />
              </button>
            </div>
          </div>
        )}

        {/* SVG Map Canvas with Multi-Touch Pinch-to-Zoom & Pan */}
        <svg
          ref={svgRef}
          viewBox={`${isValidViewBox(view) ? view.x : VIEW_PRESETS[activeHall].x} ${
            isValidViewBox(view) ? view.y : VIEW_PRESETS[activeHall].y
          } ${isValidViewBox(view) ? view.width : VIEW_PRESETS[activeHall].width} ${
            isValidViewBox(view) ? view.height : VIEW_PRESETS[activeHall].height
          }`}
          className={`interactive-svg-canvas ${dragging ? 'is-dragging' : ''}`}
          style={{ touchAction: 'none' }}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          role="region"
          aria-label="Exhibition Venue Floor Plan"
        >
          <defs>
            {/* Filter for route glow */}
            <filter id="routeGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Pattern for passage */}
            <pattern
              id="passageHatch"
              width="12"
              height="12"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="12" stroke="#ea580c" strokeWidth="2.5" opacity="0.3" />
            </pattern>

            {/* Pattern for Grand Aisles */}
            <pattern
              id="aisleTile"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <rect width="20" height="20" fill="#f8fafc" />
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" strokeWidth="0.8" />
            </pattern>

            {/* Pattern for active route pathway corridor */}
            <pattern
              id="activeCorridorPattern"
              width="16"
              height="16"
              patternTransform="rotate(45 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line x1="0" y1="0" x2="0" y2="16" stroke="#0284c7" strokeWidth="2" opacity="0.15" />
            </pattern>

            {/* Google Maps Heading Flashlight Cone Gradient */}
            <linearGradient id="googleHeadingGlow" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
              <stop offset="60%" stopColor="#0284c7" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </linearGradient>

            {/* Google Maps Location Puck Radial Aura */}
            <radialGradient id="googlePuckGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0.0" />
            </radialGradient>
          </defs>

          {/* Background Grid */}
          <rect x="-1000" y="-1000" width="3600" height="2900" fill="#f1f5f9" />

          {/* ========================================================
              PERIMETER WALLS & GATES (REFERENCE IMAGE 1)
             ======================================================== */}
          <g id="reference-perimeter-and-gates">
            {/* North Wall */}
            <line x1="65" y1="65" x2="1530" y2="65" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            {/* East Wall */}
            <line x1="1530" y1="65" x2="1530" y2="830" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />

            {/* West Wall with WEST GATE 2 opening */}
            <line x1="65" y1="65" x2="65" y2="400" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <line x1="65" y1="500" x2="65" y2="830" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />

            {/* South Wall with GATE 1 and MAIN GATE openings */}
            <line x1="65" y1="830" x2="880" y2="830" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <line x1="1000" y1="830" x2="1120" y2="830" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />
            <line x1="1280" y1="830" x2="1530" y2="830" stroke="#1e293b" strokeWidth="4" strokeLinecap="round" />

            {/* WEST GATE 2 label and chevron arrow */}
            <g id="west-gate-2" transform="translate(50, 450)">
              <text
                x="-12"
                y="4"
                fill="#1e293b"
                fontSize="13"
                fontWeight="800"
                textAnchor="end"
                letterSpacing="1"
                transform="rotate(-90 -12 4)"
              >
                WEST GATE 2
              </text>
              <polygon points="5,-8 16,0 5,8" fill="#1e293b" />
            </g>

            {/* GATE 1 label and chevron arrow */}
            <g id="gate-1" transform="translate(940, 860)">
              <text x="0" y="0" fill="#1e293b" fontSize="13" fontWeight="800" textAnchor="middle" letterSpacing="1">
                GATE 1
              </text>
              <polygon points="-8,-12 0,-20 8,-12" fill="#1e293b" />
            </g>

            {/* MAIN GATE label and double chevrons */}
            <g id="main-gate" transform="translate(1200, 860)">
              <text x="0" y="0" fill="#1e293b" fontSize="14" fontWeight="800" textAnchor="middle" letterSpacing="1">
                MAIN GATE
              </text>
              <polygon points="-9,-12 0,-21 9,-12" fill="#1e293b" />
              <polygon points="-9,-6 0,-15 9,-6" fill="#1e293b" />
            </g>
          </g>

          {/* ========================================================
              VENUE LANDMARKS (PHOTOBOOTH, MEETING SPACE, ISNT PAVILION, POSTER DISPLAY)
             ======================================================== */}
          <g id="venue-landmarks">
            {/* PHOTOBOOTH (Bottom Left) */}
            <g id="landmark-photobooth">
              <rect x="80" y="690" width="145" height="110" rx="8" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="152" y="750" fill="#334155" fontSize="13" fontWeight="800" textAnchor="middle" letterSpacing="1">
                PHOTOBOOTH
              </text>
            </g>

            {/* MEETING SPACE (Middle Left) */}
            <g id="landmark-meetingspace">
              <rect x="80" y="550" width="145" height="95" rx="8" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="152" y="602" fill="#334155" fontSize="13" fontWeight="800" textAnchor="middle" letterSpacing="1">
                MEETING SPACE
              </text>
            </g>

            {/* ISNT PAVILION (Bottom Right) */}
            <g id="landmark-isntpavilion">
              <rect x="1320" y="660" width="150" height="120" rx="8" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
              <text x="1395" y="725" fill="#334155" fontSize="13" fontWeight="800" textAnchor="middle" letterSpacing="1">
                ISNT PAVILION
              </text>
            </g>

            {/* POSTER / DIGITAL DISPLAY (Right Wall Vertical Strip) */}
            <g id="landmark-posterdisplay">
              <rect x="1530" y="140" width="45" height="580" rx="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
              <text
                x="1552"
                y="430"
                fill="#334155"
                fontSize="13"
                fontWeight="800"
                textAnchor="middle"
                letterSpacing="3"
                transform="rotate(90 1552 430)"
              >
                POSTER / DIGITAL DISPLAY
              </text>
            </g>

            {/* Coffee / Relax icon near west lounge */}
            <g id="landmark-relax-icon" transform="translate(85, 435)">
              <rect width="32" height="32" rx="6" fill="#334155" />
              <path d="M 10 11 L 22 11 L 20 20 L 12 20 Z" fill="#ffffff" />
              <path d="M 20 13 H 23 A 2 2 0 0 1 23 17 H 19" fill="none" stroke="#ffffff" strokeWidth="1.5" />
            </g>
          </g>

          {/* ========================================================
              PHYSICAL FLOOR PATHWAYS & AISLES (FROM LAYOUT 12-11-26)
             ======================================================== */}
          <g id="floor-pathways-layer">
            {visiblePathways.map((pathway) => {
              const isTraversed = route?.pathwayIds.includes(pathway.id);

              let fillColor = 'url(#aisleTile)';
              let strokeColor = '#cbd5e1';
              let strokeWidth = 1;
              let fillOpacity = 0.95;

              if (pathway.type === 'grand_aisle') {
                fillColor = '#f8fafc';
                strokeColor = '#94a3b8';
              } else if (pathway.type === 'promenade') {
                fillColor = '#fdf4ff';
                strokeColor = '#e879f9';
              } else if (pathway.type === 'passage') {
                fillColor = 'url(#passageHatch)';
                strokeColor = '#f97316';
              }

              if (isTraversed) {
                fillColor = '#e0f2fe';
                strokeColor = '#0284c7';
                strokeWidth = 2.5;
                fillOpacity = 1;
              }

              return (
                <g key={pathway.id} className="floor-pathway-segment">
                  <rect
                    x={pathway.x}
                    y={pathway.y}
                    width={pathway.width}
                    height={pathway.height}
                    rx="4"
                    fill={fillColor}
                    fillOpacity={fillOpacity}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                  />

                  {isTraversed && (
                    <rect
                      x={pathway.x}
                      y={pathway.y}
                      width={pathway.width}
                      height={pathway.height}
                      rx="4"
                      fill="url(#activeCorridorPattern)"
                    />
                  )}

                  {showAisleLabels && (
                    <g
                      transform={`translate(${pathway.labelX}, ${pathway.labelY})`}
                      className="aisle-badge-group"
                      pointerEvents="none"
                    >
                      <rect
                        x={pathway.orientation === 'horizontal' ? -65 : -35}
                        y={-9}
                        width={pathway.orientation === 'horizontal' ? 130 : 70}
                        height={18}
                        rx="9"
                        fill={isTraversed ? '#0284c7' : '#334155'}
                        opacity={isTraversed ? 0.95 : 0.85}
                      />
                      <text
                        x="0"
                        y="3.5"
                        fill="#ffffff"
                        fontSize={pathway.orientation === 'horizontal' ? '8.5' : '7.5'}
                        fontWeight="800"
                        textAnchor="middle"
                        letterSpacing="0.6"
                      >
                        {pathway.orientation === 'horizontal'
                          ? `[ ${pathway.widthLabel} · ${pathway.shortName} ]`
                          : pathway.widthLabel}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* ========================================================
              EXHIBITOR CLUSTERS & BOOTHS
             ======================================================== */}
          <g id="exhibitor-booths">
            {visibleExhibitors.map((ex) => {
              const isSelected = selectedExhibitor?.id === ex.id;

              const badge = getStallBadge(ex);
              const stripeH = Math.min(15, Math.max(5, ex.height * 0.16));
              const availableHeight = ex.height - stripeH;
              const { lines, fontSize, lineHeight } = getWrappedLines(
                ex.companyName,
                ex.width,
                availableHeight,
                isZoomedOut
              );
              const totalTextHeight = lines.length * lineHeight;
              const startY = ex.y + stripeH + (availableHeight - totalTextHeight) / 2 + fontSize * 0.85;
              const centerX = ex.x + ex.width / 2;

              return (
                <g
                  key={ex.id}
                  className={`interactive-booth-group ${isSelected ? 'is-selected' : ''}`}
                  cursor="pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectExhibitor(ex);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    onSelectExhibitor(ex);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={ex.companyName}
                >
                  {/* Invisible expanded touch hit target (ensures effortless finger selection on mobile & touchscreen) */}
                  <rect
                    x={ex.x - 4}
                    y={ex.y - 4}
                    width={ex.width + 8}
                    height={ex.height + 8}
                    fill="transparent"
                    pointerEvents="all"
                  />

                  {/* Subtle outer glow / selection halo only when selected */}
                  {isSelected && (
                    <rect
                      x={ex.x - 3}
                      y={ex.y - 3}
                      width={ex.width + 6}
                      height={ex.height + 6}
                      rx="8"
                      fill="#ea580c"
                      opacity={0.35}
                    />
                  )}

                  {/* Main White Card Body */}
                  <rect
                    className="booth-body-rect"
                    x={ex.x}
                    y={ex.y}
                    width={ex.width}
                    height={ex.height}
                    rx="6"
                    fill="#ffffff"
                    stroke={isSelected ? '#ea580c' : '#cbd5e1'}
                    strokeWidth={isSelected ? 3.5 : 1.2}
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))"
                  />

                  {/* Category Color Top Banner Stripe */}
                  <rect
                    x={ex.x + 1}
                    y={ex.y + 1}
                    width={Math.max(1, ex.width - 2)}
                    height={stripeH}
                    rx="5"
                    fill={badge.stripeColor}
                  />

                  {/* Category / Stall Label inside top stripe */}
                  {ex.height >= 30 && (
                    <text
                      x={centerX}
                      y={ex.y + stripeH * 0.78}
                      fill="#ffffff"
                      fontSize={Math.max(7, Math.min(9.5, ex.width * 0.08))}
                      fontWeight="800"
                      textAnchor="middle"
                      letterSpacing="0.6"
                      pointerEvents="none"
                    >
                      {badge.tag}
                    </text>
                  )}

                  {/* Company Name Centered */}
                  <text
                    x={centerX}
                    y={startY}
                    fill="#0f172a"
                    fontSize={fontSize}
                    fontWeight="700"
                    textAnchor="middle"
                    pointerEvents="none"
                  >
                    {lines.map((line, idx) => (
                      <tspan
                        key={idx}
                        x={centerX}
                        dy={idx === 0 ? 0 : lineHeight}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>

          {/* ========================================================
              AUTHENTIC INDOOR WALKING ROUTE (REFERENCE IMAGE 1)
             ======================================================== */}
          {route && routePathD && (
            <g id="live-navigation-route">
              {/* Outer soft red path corridor glow */}
              <path
                d={routePathD}
                fill="none"
                stroke="#fca5a5"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.45"
              />

              {/* Bold Solid Red Walking Route Path */}
              <path
                d={routePathD}
                fill="none"
                stroke="#dc2626"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Destination Teardrop Pin (Google Maps Red Marker at Target Stall) */}
              {route.nodes[route.nodes.length - 1] && (
                <g
                  transform={`translate(${route.nodes[route.nodes.length - 1].x}, ${
                    route.nodes[route.nodes.length - 1].y
                  })`}
                  pointerEvents="none"
                >
                  <circle r="14" fill="#ef4444" opacity="0.25" className="beacon-ring" />
                  <path
                    d="M 0 0 C -7 -10, -12 -16, -12 -24 A 12 12 0 1 1 12 -24 C 12 -16, 7 -10, 0 0 Z"
                    fill="#dc2626"
                    stroke="#ffffff"
                    strokeWidth="2"
                    filter="drop-shadow(0 3px 6px rgba(0,0,0,0.35))"
                  />
                  <circle cx="0" cy="-24" r="4.5" fill="#ffffff" />
                </g>
              )}
            </g>
          )}

          {/* ========================================================
              "YOU ARE HERE" PUCK & SPEECH BUBBLE AT MAIN GATE (IMAGE 1)
             ======================================================== */}
          <g
            id="you-are-here-marker"
            transform={`translate(${route?.nodes[0]?.x ?? 1200}, ${route?.nodes[0]?.y ?? 830})`}
            pointerEvents="none"
          >
            {/* Concentric animated pulse ring */}
            <circle r="22" fill="#0284c7" opacity="0.22" className="beacon-ring" />

            {/* Outer white ring */}
            <circle
              r="12"
              fill="#ffffff"
              stroke="#0284c7"
              strokeWidth="2"
              filter="drop-shadow(0 2px 5px rgba(0,0,0,0.25))"
            />

            {/* Vibrant Teal Puck Center */}
            <circle r="8" fill="#0284c7" />

            {/* Mobile phone indicator icon next to puck */}
            <g transform="translate(16, -12)">
              <rect width="12" height="20" rx="3" fill="#ffffff" stroke="#1e293b" strokeWidth="1.5" />
              <rect x="2" y="3" width="8" height="12" rx="1" fill="#38bdf8" />
              <circle cx="6" cy="17.5" r="0.8" fill="#1e293b" />
            </g>

            {/* Speech bubble "You are here" tooltip with downward arrow */}
            <g transform="translate(0, -32)">
              <rect
                x="-48"
                y="-20"
                width="96"
                height="22"
                rx="4"
                fill="#0f2942"
                filter="drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
              />
              <text
                x="0"
                y="-5"
                fill="#ffffff"
                fontSize="11"
                fontWeight="800"
                textAnchor="middle"
                letterSpacing="0.4"
              >
                {startLabel ? (startLabel.length > 14 ? 'You are here' : startLabel) : 'You are here'}
              </text>
              {/* Downward pointer triangle */}
              <polygon points="-5,2 5,2 0,7" fill="#0f2942" />
            </g>
          </g>

          {/* ========================================================
              LIVE NAVIGATION USER POINTER PUCK (WHEN WALKING)
             ======================================================== */}
          {isNavigatingLive && currentUserPos && (
            <g
              id="google-maps-user-pointer"
              transform={`translate(${currentUserPos.x}, ${currentUserPos.y})`}
              style={{ pointerEvents: 'none' }}
            >
              {/* Flashlight Heading Beam Cone */}
              <g transform={`rotate(${userBearing + 90})`}>
                <path
                  d="M 0 0 L -36 -82 A 82 82 0 0 1 36 -82 Z"
                  fill="url(#googleHeadingGlow)"
                />
              </g>

              {/* Pulsing radar ring */}
              <circle r="24" fill="#38bdf8" opacity="0.25" className="google-radar-pulse" />

              {/* White outer boundary ring */}
              <circle
                r="13"
                fill="#ffffff"
                stroke="#1d4ed8"
                strokeWidth="1.5"
                filter="drop-shadow(0 3px 6px rgba(0,0,0,0.35))"
              />

              {/* Blue Core */}
              <circle r="9" fill="#2563eb" />

              {/* Directional White Chevron */}
              <g transform={`rotate(${userBearing + 90})`}>
                <path d="M 0 -6 L 4.5 3 L 0 1.5 L -4.5 3 Z" fill="#ffffff" />
              </g>
            </g>
          )}
        </svg>

        {/* ========================================================
            RE-CENTER FLOATING ACTION BUTTON (GOOGLE MAPS STYLE)
            Appears when the user pans/zooms away from the moving user puck
           ======================================================== */}
        {route && isNavigatingLive && !isCameraFollowEnabled && (
          <button
            type="button"
            className="google-recenter-fab"
            onClick={() => setIsCameraFollowEnabled(true)}
            title="Re-center camera on my walking location"
          >
            <Crosshair size={18} />
            <span>Re-center</span>
          </button>
        )}



        {/* ========================================================
            REAL-TIME MOBILE INDOOR NAVIGATION CONTROLLER
           ======================================================== */}
        {route && isNavigatingLive && (
          <div className="google-nav-bottom-bar real-sensor-bar">
            {/* Top row: Metrics and ETA */}
            <div className="gmaps-bottom-metrics-row">
              <div className="gmaps-eta-col">
                <span className="gmaps-time-remaining">{etaMinutes} min</span>
                <span className="gmaps-distance-remaining">({remainingDistanceMeters} m remaining)</span>
                <span className="gmaps-eta-clock">· ETA {etaTimeStr}</span>
              </div>

              <div className="gmaps-controls-col">
                {/* Manual step advance button for indoor testing or steady holding */}
                {onManualStepAdvance && (
                  <button
                    type="button"
                    className="gmaps-step-advance-btn"
                    onClick={onManualStepAdvance}
                    title="Advance step manually (indoor walking test)"
                  >
                    <span>👣 Take Step</span>
                  </button>
                )}

                {/* Re-anchor checkpoint button */}
                {onReanchorCheckpoint && (
                  <button
                    type="button"
                    className="gmaps-reanchor-btn"
                    onClick={onReanchorCheckpoint}
                    title="Re-anchor at nearest QR totem"
                  >
                    <span>📍 Checkpoint</span>
                  </button>
                )}

                {/* Exit Navigation */}
                <button
                  type="button"
                  className="gmaps-exit-btn"
                  onClick={() => onExitNavigation?.()}
                  title="Exit live navigation"
                >
                  <X size={17} />
                  <span>Exit</span>
                </button>
              </div>
            </div>

            {/* Bottom status row: Displays real indoor sensor status */}
            <div className="gmaps-sensor-status-row">
              <span className="sensor-indicator-dot active" />
              <span className="sensor-status-label">
                {liveStatusText || 'Indoor Sensor Tracking Active (Dead-Reckoning & Gyroscope)'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
