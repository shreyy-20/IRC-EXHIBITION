import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { PointerEvent, WheelEvent } from 'react';
import {
  Maximize2,
  Crosshair,
  Play,
  Pause,
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
import { FLOOR_PATHWAYS, type FloorPathway } from '../data/floorPathways';
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

// Word-wrapping and text scaling helper for exhibitor stalls
function getWrappedLines(
  companyName: string,
  width: number,
  height: number
): { lines: string[]; fontSize: number; lineHeight: number } {
  const words = companyName.trim().split(/\s+/);

  let fontSize = 9;
  if (width < 50 || height < 36) fontSize = 7;
  else if (width < 70 || height < 46) fontSize = 8;
  else if (width >= 110 && height >= 65) fontSize = 10;
  else if (width >= 140 && height >= 80) fontSize = 11.5;

  const lineHeight = fontSize * 1.25;
  const paddingX = 6;
  const maxCharsPerLine = Math.max(5, Math.floor((width - paddingX * 2) / (fontSize * 0.56)));
  const maxLines = Math.max(1, Math.floor((height - 8) / lineHeight));

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
      lines[lines.length - 1] = last.substring(0, maxCharsPerLine - 3) + '…';
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
  onShowDirections,
  drawerOpen = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<ViewBox>(VIEW_PRESETS[activeHall]);
  const [, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [hoveredExhibitor, setHoveredExhibitor] = useState<ClubbedExhibitor | null>(null);
  const [hoveredPathway, setHoveredPathway] = useState<FloorPathway | null>(null);
  const showAisleLabels = false;

  // Google Maps Style Live Navigation State
  const [isWalking, setIsWalking] = useState(false);
  const [walkProgressSvg, setWalkProgressSvg] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [isCameraFollowEnabled, setIsCameraFollowEnabled] = useState(true);
  const [userBearing, setUserBearing] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasArrived, setHasArrived] = useState(false);

  const dragRef = useRef<{
    x: number;
    y: number;
    viewX: number;
    viewY: number;
  } | null>(null);

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

  const totalSvgLength = useMemo(() => {
    return segments.reduce((sum, s) => sum + s.length, 0);
  }, [segments]);

  // Reset navigation when route or selected exhibitor changes
  useEffect(() => {
    if (route) {
      setHasArrived(false);
      lastChimedStepRef.current = -1;
      if (segments[0]) {
        setUserBearing(segments[0].angleDeg);
      }
      if (isNavigatingLive) {
        setIsWalking(true);
        setIsCameraFollowEnabled(true);
      } else {
        setIsWalking(false);
        setWalkProgressSvg(0);
        setIsCameraFollowEnabled(false);

        // Frame route cleanly according to halls traversed
        if (route.nodes.length > 0) {
          const hasHall1 = route.nodes.some((n) => n.x >= 750);
          const hasHanger = route.nodes.some((n) => n.x <= 850);
          if (hasHall1 && hasHanger) {
            setView(VIEW_PRESETS['all']);
            setZoom(1);
          } else if (hasHall1) {
            setView(VIEW_PRESETS['hall-1']);
            setZoom(1);
          } else {
            setView(VIEW_PRESETS['hanger']);
            setZoom(1);
          }
        }
      }
    } else {
      setIsWalking(false);
      setWalkProgressSvg(0);
      setHasArrived(false);
      setIsCameraFollowEnabled(false);
    }
  }, [route, segments, isNavigatingLive]);

  // Jump pointer when parent selects a specific step index
  useEffect(() => {
    if (
      activeStepIndex !== null &&
      activeStepIndex !== undefined &&
      segments.length > 0 &&
      !isWalking
    ) {
      const targetSeg = segments[activeStepIndex - 1] || segments[0];
      setWalkProgressSvg(targetSeg.cumDistSvg);
      setIsCameraFollowEnabled(true);
      setUserBearing(targetSeg.angleDeg);
    }
  }, [activeStepIndex, segments, isWalking]);

  // Sync view when activeHall changes (only if no active navigation)
  useEffect(() => {
    if (!route) {
      setView(VIEW_PRESETS[activeHall]);
      setZoom(1);
    }
  }, [activeHall, route]);

  // Animation Loop (60fps continuous smooth walking along path)
  useEffect(() => {
    if (!isWalking || !route || totalSvgLength <= 0 || hasArrived) return;

    let lastTime = performance.now();
    let animId: number;

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      // Normal walking speed: ~1.2 m/s base speed
      const svgUnitsPerMeter =
        route.distanceMeters > 0 ? totalSvgLength / route.distanceMeters : 1;
      const deltaSvg = 1.2 * speedMultiplier * svgUnitsPerMeter * dt;

      setWalkProgressSvg((prev) => {
        const next = prev + deltaSvg;
        if (next >= totalSvgLength) {
          setIsWalking(false);
          setHasArrived(true);
          if (soundEnabled) playArrivalChime();
          return totalSvgLength;
        }
        return next;
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isWalking, route, totalSvgLength, speedMultiplier, soundEnabled, hasArrived]);

  // Calculate current user position, active segment, and metrics
  const {
    currentUserPos,
    currentSegment,
    currentStepIndex,
    remainingDistanceMeters,
    distanceToNextTurn,
  } = useMemo(() => {
    if (!route || segments.length === 0) {
      return {
        currentUserPos: route?.nodes[0]
          ? { x: route.nodes[0].x, y: route.nodes[0].y }
          : { x: 1200, y: 830 },
        currentSegment: null,
        currentStepIndex: 0,
        remainingDistanceMeters: route?.distanceMeters || 0,
        distanceToNextTurn: 0,
      };
    }

    let currentSeg = segments[0];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (
        walkProgressSvg >= seg.cumDistSvg &&
        walkProgressSvg <= seg.cumDistSvg + seg.length
      ) {
        currentSeg = seg;
        break;
      }
      if (i === segments.length - 1) {
        currentSeg = seg;
      }
    }

    const distIntoSeg = Math.max(
      0,
      Math.min(currentSeg.length, walkProgressSvg - currentSeg.cumDistSvg)
    );
    const alpha = currentSeg.length > 0 ? distIntoSeg / currentSeg.length : 0;
    const userX = currentSeg.fromNode.x + alpha * currentSeg.dx;
    const userY = currentSeg.fromNode.y + alpha * currentSeg.dy;

    const progressRatio = totalSvgLength > 0 ? walkProgressSvg / totalSvgLength : 0;
    const remainingM = Math.max(0, Math.round(route.distanceMeters * (1 - progressRatio)));

    const distToNextTurnSvg = currentSeg.length - distIntoSeg;
    const metersPerSvg =
      route.distanceMeters > 0 ? route.distanceMeters / totalSvgLength : 0.1;
    const distToNextM = Math.max(0, Math.round(distToNextTurnSvg * metersPerSvg));

    return {
      currentUserPos: { x: userX, y: userY },
      currentSegment: currentSeg,
      currentStepIndex: currentSeg.stepIndex,
      remainingDistanceMeters: remainingM,
      distanceToNextTurn: distToNextM,
    };
  }, [route, segments, walkProgressSvg, totalSvgLength]);

  // Update bearing and trigger turn sound when entering new step
  useEffect(() => {
    if (!currentSegment) return;
    setUserBearing(currentSegment.angleDeg);

    if (
      soundEnabled &&
      currentStepIndex > 0 &&
      lastChimedStepRef.current !== currentStepIndex
    ) {
      lastChimedStepRef.current = currentStepIndex;
      playTurnChime();
    }

    // Inform parent step tracker
    if (currentStepIndex !== activeStepIndex) {
      onSelectStep?.(currentStepIndex);
    }
  }, [currentSegment, currentStepIndex, activeStepIndex, onSelectStep, soundEnabled]);

  // Static Map Layout: Camera auto-follow is disabled to keep the kiosk map static and stable
  useEffect(() => {
    // Map layout remains static to prevent jitter, distortion, or view jumps on touchscreens
  }, [currentUserPos, isCameraFollowEnabled, route]);

  function changeZoom(factor: number) {
    setIsCameraFollowEnabled(false);
    setView((curr) => {
      const newW = curr.width * factor;
      const newH = curr.height * factor;
      if (newW < 250 || newW > 2500) return curr;

      setZoom(1600 / newW);
      return {
        x: curr.x + (curr.width - newW) / 2,
        y: curr.y + (curr.height - newH) / 2,
        width: newW,
        height: newH,
      };
    });
  }

  function resetView() {
    setIsCameraFollowEnabled(true);
    if (!route) {
      setView(VIEW_PRESETS[activeHall]);
      setZoom(1);
    }
  }

  function handleWheel(e: WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    setIsCameraFollowEnabled(false);
    const factor = e.deltaY < 0 ? 0.88 : 1.14;
    changeZoom(factor);
  }

  function handlePointerDown(e: PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    // When the user drags manually, pause camera follow like Google Maps
    setIsCameraFollowEnabled(false);
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      viewX: view.x,
      viewY: view.y,
    };
    setDragging(true);
  }

  function handlePointerMove(e: PointerEvent<SVGSVGElement>) {
    if (!dragRef.current || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - dragRef.current.x) / rect.width) * view.width;
    const dy = ((e.clientY - dragRef.current.y) / rect.height) * view.height;

    setView((curr) => ({
      ...curr,
      x: dragRef.current!.viewX - dx,
      y: dragRef.current!.viewY - dy,
    }));
  }

  function handlePointerUp() {
    dragRef.current = null;
    setDragging(false);
  }

  const handleScrubberChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setWalkProgressSvg(val);
      setIsCameraFollowEnabled(true);
      if (val >= totalSvgLength) {
        setHasArrived(true);
        setIsWalking(false);
      } else {
        setHasArrived(false);
      }
    },
    [totalSvgLength]
  );

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
              <span className="ref-route-text">about {route.walkingMinutes} min walk from Main Gate</span>
              <button
                type="button"
                className="ref-route-end-btn"
                onClick={() => onExitNavigation?.()}
                title="End route"
              >
                End route
              </button>
            </div>
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
        )}

        {/* SVG Map Canvas */}
        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          className={`interactive-svg-canvas ${dragging ? 'is-dragging' : ''}`}
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
              const isHovered = hoveredPathway?.id === pathway.id;

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

              if (isHovered) {
                strokeColor = '#2563eb';
                strokeWidth = 2.5;
              }

              return (
                <g
                  key={pathway.id}
                  className="floor-pathway-segment"
                  onPointerEnter={() => setHoveredPathway(pathway)}
                  onPointerLeave={() => setHoveredPathway(null)}
                >
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
              const isHovered = hoveredExhibitor?.id === ex.id;

              const badge = getStallBadge(ex);
              const stripeH = Math.min(15, Math.max(5, ex.height * 0.16));
              const availableHeight = ex.height - stripeH;
              const { lines, fontSize, lineHeight } = getWrappedLines(
                ex.companyName,
                ex.width,
                availableHeight
              );
              const totalTextHeight = lines.length * lineHeight;
              const startY = ex.y + stripeH + (availableHeight - totalTextHeight) / 2 + fontSize * 0.85;
              const centerX = ex.x + ex.width / 2;

              return (
                <g
                  key={ex.id}
                  className="interactive-booth-group"
                  cursor="pointer"
                  onClick={() => onSelectExhibitor(ex)}
                  onPointerEnter={() => setHoveredExhibitor(ex)}
                  onPointerLeave={() => setHoveredExhibitor(null)}
                  role="button"
                  tabIndex={0}
                  aria-label={ex.companyName}
                >
                  {/* Subtle outer glow / selection halo */}
                  {(isSelected || isHovered) && (
                    <rect
                      x={ex.x - 3}
                      y={ex.y - 3}
                      width={ex.width + 6}
                      height={ex.height + 6}
                      rx="8"
                      fill={isSelected ? '#ea580c' : '#38bdf8'}
                      opacity={isSelected ? 0.35 : 0.25}
                    />
                  )}

                  {/* Main White Card Body */}
                  <rect
                    x={ex.x}
                    y={ex.y}
                    width={ex.width}
                    height={ex.height}
                    rx="6"
                    fill="#ffffff"
                    stroke={isSelected ? '#ea580c' : isHovered ? '#0284c7' : '#cbd5e1'}
                    strokeWidth={isSelected ? 3.5 : isHovered ? 2 : 1.2}
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
                You are here
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

        {/* Information Tooltip for Exhibitors */}
        {hoveredExhibitor && !route && (
          <div className="map-floating-tooltip" style={{ left: '20px', bottom: '20px' }}>
            <div className="tooltip-header">
              <strong>{hoveredExhibitor.companyName}</strong>
              <span className="tooltip-badge">{hoveredExhibitor.hall}</span>
            </div>
          </div>
        )}

        {/* ========================================================
            GOOGLE MAPS BOTTOM NAVIGATION CONTROLLER BAR
           ======================================================== */}
        {route && isNavigatingLive && (
          <div className="google-nav-bottom-bar">
            {/* Top row: Metrics and ETA */}
            <div className="gmaps-bottom-metrics-row">
              <div className="gmaps-eta-col">
                <span className="gmaps-time-remaining">{etaMinutes} min</span>
                <span className="gmaps-distance-remaining">({remainingDistanceMeters} m)</span>
                <span className="gmaps-eta-clock">· ETA {etaTimeStr}</span>
              </div>

              <div className="gmaps-controls-col">
                {/* Speed selector (1x, 2x, 3x) */}
                <div className="gmaps-speed-pills">
                  {[1, 2, 3].map((sp) => (
                    <button
                      key={`speed-${sp}`}
                      type="button"
                      className={`gmaps-speed-btn ${speedMultiplier === sp ? 'is-active' : ''}`}
                      onClick={() => setSpeedMultiplier(sp)}
                      title={`Walking speed ${sp}x (${(sp * 1.2).toFixed(1)} m/s)`}
                    >
                      {sp}x
                    </button>
                  ))}
                </div>

                {/* Play / Pause Walk simulation */}
                <button
                  type="button"
                  className={`gmaps-play-btn ${isWalking ? 'is-playing' : ''}`}
                  onClick={() => {
                    if (hasArrived) {
                      setWalkProgressSvg(0);
                      setHasArrived(false);
                      setIsWalking(true);
                      setIsCameraFollowEnabled(true);
                    } else {
                      setIsWalking((prev) => !prev);
                      setIsCameraFollowEnabled(true);
                    }
                  }}
                  title={isWalking ? 'Pause walking' : 'Resume walking'}
                >
                  {isWalking ? <Pause size={17} /> : <Play size={17} />}
                  <span>{isWalking ? 'Pause' : hasArrived ? 'Restart' : 'Resume'}</span>
                </button>

                {/* Exit Navigation */}
                <button
                  type="button"
                  className="gmaps-exit-btn"
                  onClick={() => onExitNavigation?.()}
                  title="Exit navigation"
                >
                  <X size={17} />
                  <span>Exit</span>
                </button>
              </div>
            </div>

            {/* Bottom row: Interactive Progress Scrubber */}
            <div className="gmaps-scrubber-row">
              <input
                type="range"
                min="0"
                max={Math.max(1, totalSvgLength)}
                step="1"
                value={walkProgressSvg}
                onChange={handleScrubberChange}
                className="gmaps-progress-slider"
                title="Drag to preview position along route"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
