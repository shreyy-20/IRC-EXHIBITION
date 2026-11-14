import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import type { PointerEvent, WheelEvent } from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Move,
  Footprints,
  Eye,
  EyeOff,
  Navigation2,
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
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [view, setView] = useState<ViewBox>(VIEW_PRESETS[activeHall]);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [hoveredExhibitor, setHoveredExhibitor] = useState<ClubbedExhibitor | null>(null);
  const [hoveredPathway, setHoveredPathway] = useState<FloorPathway | null>(null);
  const [showAisleLabels, setShowAisleLabels] = useState(true);

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

  // Google Maps Style Camera Auto-Follow (Smoothly keeps pointer centered in view)
  useEffect(() => {
    if (!isCameraFollowEnabled || !currentUserPos || !route || !isWalking) return;

    const focusWidth = 560;
    const focusHeight = 420;
    const targetX = Math.max(0, Math.min(1600 - focusWidth, currentUserPos.x - focusWidth / 2));
    const targetY = Math.max(0, Math.min(900 - focusHeight, currentUserPos.y - focusHeight / 2));

    setView((curr) => {
      const dx = (targetX - curr.x) * 0.22;
      const dy = (targetY - curr.y) * 0.22;
      if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return curr;
      return {
        ...curr,
        x: curr.x + dx,
        y: curr.y + dy,
        width: focusWidth,
        height: focusHeight,
      };
    });
    setZoom(1.9);
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

  function toggleFullscreen() {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
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

  // Filter exhibitors: display official company booths and service facilities
  // Exclude unassigned stalls and custom-drawn landmarks (Ramappa Temple & Committee Office) from generic booth rendering
  const visibleExhibitors = useMemo(() => {
    return exhibitors.filter((ex) => {
      if (ex.allocationStatus === 'unassigned') return false;
      if (ex.id === 'counter-ramappa' || ex.id === 'counter-committee') return false;
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

  // Calculate direction arrows along route segments
  const routeArrows =
    route && route.nodes.length > 1
      ? route.nodes.slice(0, -1).map((fromNode, i) => {
          const toNode = route.nodes[i + 1];
          const midX = (fromNode.x + toNode.x) / 2;
          const midY = (fromNode.y + toNode.y) / 2;
          const angle = (Math.atan2(toNode.y - fromNode.y, toNode.x - fromNode.x) * 180) / Math.PI;
          return { id: `arrow-${i}`, midX, midY, angle, stepIndex: i + 1 };
        })
      : [];

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
      {/* Map Header Toolbar */}
      <div className="map-toolbar">
        <div className="map-title-zone">
          <div className="map-live-pill">
            <span className="live-dot" />
            <span>EXHIBITION INDOOR NAVIGATION MAP</span>
          </div>
          <strong>
            {activeHall === 'all'
              ? 'Complete Exhibition Venue (Hall-1 & Hanger)'
              : activeHall === 'hall-1'
                ? 'Hall-1 Floor Layout (Stalls 1–208 · 6.0m Grand Aisles)'
                : 'Hanger Floor Layout (Stalls 209–387 · Ramappa Temple Pavilion)'}
          </strong>
        </div>

        <div className="map-actions-group">
          {/* Aisle Labels Toggle */}
          <button
            type="button"
            className={`map-toggle-btn ${showAisleLabels ? 'is-active' : ''}`}
            onClick={() => setShowAisleLabels((prev) => !prev)}
            title="Toggle walkway dimension tags (6.0m, 4.0m, 3.0m, 2.5m)"
          >
            {showAisleLabels ? <Eye size={14} /> : <EyeOff size={14} />}
            <span>Aisle Widths ({showAisleLabels ? 'ON' : 'OFF'})</span>
          </button>

          <div className="map-zoom-buttons">
            <button
              type="button"
              onClick={() => changeZoom(0.8)}
              title="Zoom In"
              aria-label="Zoom in"
            >
              <ZoomIn size={17} />
            </button>
            <button
              type="button"
              onClick={() => changeZoom(1.25)}
              title="Zoom Out"
              aria-label="Zoom out"
            >
              <ZoomOut size={17} />
            </button>
            <button
              type="button"
              onClick={resetView}
              title="Reset View"
              aria-label="Reset view"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              onClick={toggleFullscreen}
              title="Full Screen Map"
              aria-label="Full screen"
            >
              <Maximize2 size={15} />
            </button>
          </div>
          <span className="zoom-text">{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      {/* SVG Canvas Container with Google Maps Overlays */}
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
                    {selectedExhibitor?.companyName} ({selectedExhibitor?.stallsFormatted})
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
                  {currentStep && (
                    <div className="hud-sub-info">
                      <span className="hud-aisle-badge">{currentStep.aisleWidth} AISLE</span>
                      <span>{currentStep.aisleName}</span>
                    </div>
                  )}
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
            ROUTE PREVIEW FLOATING CARD (DESTINATION SELECTED PREVIEW)
           ======================================================== */}
        {route && !isNavigatingLive && (
          <div className="google-nav-preview-card">
            <div className="preview-card-info">
              <div className="preview-destination-badge">
                <Navigation2 size={14} />
                <span>ROUTE PREVIEW</span>
              </div>
              <h3 className="preview-destination-name">
                {selectedExhibitor?.companyName || 'Selected Destination'}
              </h3>
              <div className="preview-metrics-row">
                <span className="metric-pill dist">
                  <strong>{route.distanceMeters} m</strong>
                </span>
                <span className="metric-pill time">
                  <strong>{route.walkingMinutes} min</strong> walk
                </span>
                <span className="metric-pill stalls">{selectedExhibitor?.stallsFormatted}</span>
                <span className="metric-pill hall">{selectedExhibitor?.hall}</span>
              </div>
            </div>
            <div className="preview-actions">
              <button
                type="button"
                className="preview-start-nav-btn"
                onClick={() => onStartNavigation?.()}
                title="Start live turn-by-turn indoor navigation"
              >
                <Play size={16} fill="currentColor" />
                <span>START NAVIGATION</span>
              </button>
              <button
                type="button"
                className="preview-cancel-btn"
                onClick={() => onExitNavigation?.()}
                title="Clear route"
              >
                <X size={17} />
              </button>
            </div>
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
              HANGER REGION (LEFT)
             ======================================================== */}
          <g id="hanger-boundary">
            <rect
              x="65"
              y="65"
              width="680"
              height="770"
              rx="12"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="2.5"
            />
            <rect x="65" y="65" width="680" height="34" rx="8" fill="#1e293b" />
            <text
              x="405"
              y="87"
              fill="#f8fafc"
              fontSize="14"
              fontWeight="800"
              textAnchor="middle"
              letterSpacing="2"
            >
              HANGER · STALLS 209 TO 387
            </text>

            {/* THEME PAVILION: RAMAPPA TEMPLE (Pink landmark in center, 18m × 6m) */}
            <g
              id="theme-pavilion"
              cursor="pointer"
              onClick={() => {
                const ramappa = exhibitors.find((e) => e.id === 'counter-ramappa');
                if (ramappa) onSelectExhibitor(ramappa);
              }}
              role="button"
              tabIndex={0}
              aria-label="Theme Pavilion Ramappa Temple"
            >
              {selectedExhibitor?.id === 'counter-ramappa' && (
                <rect x="254" y="404" width="222" height="92" rx="10" fill="#fbcfe8" opacity="0.6" />
              )}
              <rect
                x="260"
                y="410"
                width="210"
                height="80"
                rx="8"
                fill={selectedExhibitor?.id === 'counter-ramappa' ? '#fdf2f8' : '#fbcfe8'}
                stroke={selectedExhibitor?.id === 'counter-ramappa' ? '#be185d' : '#db2777'}
                strokeWidth={selectedExhibitor?.id === 'counter-ramappa' ? 3.5 : 2.5}
              />
              <rect x="266" y="416" width="198" height="68" rx="6" fill="#fdf2f8" opacity="0.8" />
              <text
                x="365"
                y="443"
                fill="#9d174d"
                fontSize="13"
                fontWeight="900"
                textAnchor="middle"
                letterSpacing="1"
              >
                THEME PAVILION
              </text>
              <text
                x="365"
                y="462"
                fill="#be185d"
                fontSize="11"
                fontWeight="800"
                textAnchor="middle"
              >
                RAMAPPA TEMPLE (18m × 6m)
              </text>
              <text
                x="365"
                y="477"
                fill="#9d174d"
                fontSize="8.5"
                fontWeight="700"
                textAnchor="middle"
                letterSpacing="0.5"
              >
                Flanked by 4.0m Grand Promenades
              </text>
            </g>
          </g>

          {/* ========================================================
              CONNECTING PASSAGE (BETWEEN HANGER & HALL-1)
             ======================================================== */}
          <g id="inter-hall-passage">
            <rect
              x="745"
              y="412"
              width="105"
              height="76"
              fill="url(#passageHatch)"
              stroke="#f97316"
              strokeWidth="2.5"
            />
            <rect x="745" y="412" width="105" height="76" fill="#fff7ed" opacity="0.88" />
            <line x1="745" y1="412" x2="745" y2="488" stroke="#c2410c" strokeWidth="4" />
            <line x1="850" y1="412" x2="850" y2="488" stroke="#c2410c" strokeWidth="4" />

            <text
              x="797"
              y="442"
              fill="#c2410c"
              fontSize="11"
              fontWeight="900"
              textAnchor="middle"
              letterSpacing="1.5"
            >
              COVERED PASSAGE
            </text>
            <text
              x="797"
              y="460"
              fill="#ea580c"
              fontSize="9"
              fontWeight="800"
              textAnchor="middle"
            >
              ◀ 2.5M WALKWAY ▶
            </text>
            <text
              x="797"
              y="476"
              fill="#9a3412"
              fontSize="8"
              fontWeight="700"
              textAnchor="middle"
            >
              Hall-1 ⇄ Hanger
            </text>
          </g>

          {/* ========================================================
              HALL-1 REGION (RIGHT)
             ======================================================== */}
          <g id="hall1-boundary">
            <rect
              x="850"
              y="65"
              width="680"
              height="770"
              rx="12"
              fill="#ffffff"
              stroke="#cbd5e1"
              strokeWidth="2.5"
            />
            <rect x="850" y="65" width="680" height="34" rx="8" fill="#143a5b" />
            <text
              x="1190"
              y="87"
              fill="#f8fafc"
              fontSize="14"
              fontWeight="800"
              textAnchor="middle"
              letterSpacing="2"
            >
              HALL-1 · STALLS 1 TO 208
            </text>

            {/* Committee Office */}
            <g
              id="committee-office"
              cursor="pointer"
              onClick={() => {
                const comm = exhibitors.find((e) => e.id === 'counter-committee');
                if (comm) onSelectExhibitor(comm);
              }}
              role="button"
              tabIndex={0}
              aria-label="IRC Committee Office"
            >
              {selectedExhibitor?.id === 'counter-committee' && (
                <rect x="854" y="744" width="107" height="72" rx="8" fill="#e2e8f0" opacity="0.6" />
              )}
              <rect
                x="860"
                y="750"
                width="95"
                height="60"
                rx="6"
                fill={selectedExhibitor?.id === 'counter-committee' ? '#fef08a' : '#f1f5f9'}
                stroke={selectedExhibitor?.id === 'counter-committee' ? '#ca8a04' : '#64748b'}
                strokeWidth={selectedExhibitor?.id === 'counter-committee' ? 3 : 2}
              />
              <text x="907" y="776" fill="#1e293b" fontSize="9.5" fontWeight="900" textAnchor="middle">
                COMMITTEE
              </text>
              <text x="907" y="792" fill="#334155" fontSize="8.5" fontWeight="800" textAnchor="middle">
                OFFICE
              </text>
            </g>

            {/* Main Entrance Foyer */}
            <g id="main-entrance">
              <rect
                x="1140"
                y="805"
                width="120"
                height="32"
                rx="6"
                fill="#15803d"
                stroke="#166534"
                strokeWidth="2.5"
              />
              <text
                x="1200"
                y="826"
                fill="#ffffff"
                fontSize="11"
                fontWeight="900"
                textAnchor="middle"
                letterSpacing="1.5"
              >
                MAIN ENTRANCE
              </text>
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

              let fillColor = '#eff6ff';
              let strokeColor = '#3b82f6';
              let textColor = '#1e3a8a';

              if (ex.isServiceCounter) {
                fillColor = '#f0fdf4';
                strokeColor = '#059669';
                textColor = '#065f46';
              } else if (ex.isDuplicate) {
                fillColor = '#fee2e2';
                strokeColor = '#ef4444';
                textColor = '#991b1b';
              } else if (ex.isOutOfRange) {
                fillColor = '#ffedd5';
                strokeColor = '#f97316';
                textColor = '#9a3412';
              } else if (ex.category.toLowerCase().includes('gold')) {
                fillColor = '#fef9c3';
                strokeColor = '#eab308';
                textColor = '#854d0e';
              } else if (ex.category.toLowerCase().includes('silver')) {
                fillColor = '#f1f5f9';
                strokeColor = '#94a3b8';
                textColor = '#334155';
              } else if (ex.allocationStatus === 'verified') {
                fillColor = '#ecfdf5';
                strokeColor = '#10b981';
                textColor = '#065f46';
              }

              if (isSelected) {
                fillColor = '#fef08a';
                strokeColor = '#ca8a04';
                textColor = '#713f12';
              }

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
                  aria-label={`${ex.companyName} at Stalls ${ex.stallsFormatted}`}
                >
                  {(isSelected || isHovered) && (
                    <rect
                      x={ex.x - 4}
                      y={ex.y - 4}
                      width={ex.width + 8}
                      height={ex.height + 8}
                      rx="7"
                      fill={isSelected ? '#eab308' : '#60a5fa'}
                      opacity={isSelected ? 0.45 : 0.28}
                    />
                  )}

                  <rect
                    x={ex.x}
                    y={ex.y}
                    width={ex.width}
                    height={ex.height}
                    rx="4"
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={isSelected ? 3 : isHovered ? 2 : 1.2}
                  />

                  <rect
                    x={ex.x}
                    y={ex.y}
                    width={ex.width}
                    height={Math.min(18, ex.height * 0.35)}
                    rx="3"
                    fill={strokeColor}
                    opacity="0.88"
                  />
                  <text
                    x={ex.x + ex.width / 2}
                    y={ex.y + Math.min(13, ex.height * 0.26)}
                    fill="#ffffff"
                    fontSize={ex.width > 90 ? '9' : '7.5'}
                    fontWeight="800"
                    textAnchor="middle"
                  >
                    {ex.stalls.length > 5
                      ? `{${ex.stalls[0]}..${ex.stalls[ex.stalls.length - 1]}}`
                      : ex.stallsFormatted}
                  </text>

                  <text
                    x={ex.x + ex.width / 2}
                    y={ex.y + Math.min(32, ex.height * 0.65)}
                    fill={textColor}
                    fontSize={ex.width > 110 ? '9' : '7.5'}
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {ex.companyName.length > 18
                      ? ex.companyName.substring(0, 16) + '…'
                      : ex.companyName}
                  </text>
                </g>
              );
            })}
          </g>

          {/* ========================================================
              LIVE NAVIGATION ROUTE OVERLAY
             ======================================================== */}
          {route && routePathD && (
            <g id="live-navigation-route" filter="url(#routeGlow)">
              {/* Outer soft path corridor glow */}
              <path
                d={routePathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.55"
              />

              {/* Traversed vs remaining polyline */}
              <path
                d={routePathD}
                fill="none"
                stroke="#0284c7"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="9 6"
                className="animated-walking-path"
              />

              {/* Directional chevrons along path */}
              {routeArrows.map((arrow) => (
                <g
                  key={arrow.id}
                  transform={`translate(${arrow.midX}, ${arrow.midY}) rotate(${arrow.angle})`}
                  className="route-chevron-arrow"
                >
                  <polygon
                    points="-7,-5 3,0 -7,5 -4,0"
                    fill="#0369a1"
                    stroke="#ffffff"
                    strokeWidth="1"
                  />
                </g>
              ))}

              {/* Route checkpoints */}
              {route.nodes.map((node, idx) => (
                <circle
                  key={`node-${node.id}-${idx}`}
                  cx={node.x}
                  cy={node.y}
                  r={4}
                  fill="#ffffff"
                  stroke="#0369a1"
                  strokeWidth={2}
                />
              ))}

              {/* Start Point Marker (Google Maps Green Origin) */}
              {route.nodes[0] && (
                <g transform={`translate(${route.nodes[0].x}, ${route.nodes[0].y})`} pointerEvents="none">
                  <circle r="12" fill="#22c55e" opacity="0.3" className="beacon-ring" />
                  <circle r="6" fill="#16a34a" stroke="#ffffff" strokeWidth="2" />
                  <circle r="2" fill="#ffffff" />
                </g>
              )}

              {/* Destination Teardrop Pin (Google Maps Red Marker) */}
              {route.nodes[route.nodes.length - 1] && (
                <g
                  transform={`translate(${route.nodes[route.nodes.length - 1].x}, ${
                    route.nodes[route.nodes.length - 1].y
                  })`}
                  pointerEvents="none"
                >
                  <circle r="14" fill="#ef4444" opacity="0.25" className="beacon-ring" />
                  <path
                    d="M 0 0 C -6 -8, -10 -14, -10 -20 A 10 10 0 1 1 10 -20 C 10 -14, 6 -8, 0 0 Z"
                    fill="#dc2626"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    filter="drop-shadow(0 2px 5px rgba(0,0,0,0.35))"
                  />
                  <circle cx="0" cy="-20" r="4" fill="#ffffff" />
                </g>
              )}

              {/* ========================================================
                  GOOGLE MAPS NAVIGATION USER POINTER PUCK
                  (Continuous 60fps smooth movement & heading beam)
                 ======================================================== */}
              {currentUserPos && (
                <g
                  id="google-maps-user-pointer"
                  transform={`translate(${currentUserPos.x}, ${currentUserPos.y})`}
                  style={{ pointerEvents: 'none' }}
                >
                  {/* Flashlight Heading Beam Cone fanning forward */}
                  <g transform={`rotate(${userBearing + 90})`}>
                    <path
                      d="M 0 0 L -36 -82 A 82 82 0 0 1 36 -82 Z"
                      fill="url(#googleHeadingGlow)"
                    />
                  </g>

                  {/* Pulsing radar accuracy ring */}
                  <circle r="24" fill="#38bdf8" opacity="0.25" className="google-radar-pulse" />

                  {/* White outer boundary ring with elevation shadow */}
                  <circle
                    r="13"
                    fill="#ffffff"
                    stroke="#1d4ed8"
                    strokeWidth="1.5"
                    filter="drop-shadow(0 3px 6px rgba(0,0,0,0.35))"
                  />

                  {/* Vibrant Google Maps Blue Core */}
                  <circle r="9" fill="#2563eb" />

                  {/* Directional White Chevron inside puck */}
                  <g transform={`rotate(${userBearing + 90})`}>
                    <path d="M 0 -6 L 4.5 3 L 0 1.5 L -4.5 3 Z" fill="#ffffff" />
                  </g>
                </g>
              )}
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

        {/* Hover Information Tooltip for Exhibitors */}
        {hoveredExhibitor && !route && (
          <div className="map-floating-tooltip" style={{ left: '20px', bottom: '20px' }}>
            <div className="tooltip-header">
              <strong>{hoveredExhibitor.companyName}</strong>
              <span className="tooltip-badge">{hoveredExhibitor.hall}</span>
            </div>
            <div className="tooltip-stalls">
              <span>Clubbed Stalls: </span>
              <strong>{hoveredExhibitor.stallsFormatted}</strong>
            </div>
            <div className="tooltip-meta">
              <span>Category: {hoveredExhibitor.category}</span>
              {hoveredExhibitor.isDuplicate && (
                <span className="tooltip-warning">⚠ Duplicate Allocation (Stall 288)</span>
              )}
              {hoveredExhibitor.isOutOfRange && (
                <span className="tooltip-warning">⚠ Stall &gt; 341 (Marked in Hanger)</span>
              )}
            </div>
            <div className="tooltip-hint">Click booth to start Google Maps indoor navigation</div>
          </div>
        )}

        {/* Hover Information Tooltip for Pathways */}
        {hoveredPathway && !hoveredExhibitor && !route && (
          <div className="map-floating-tooltip pathway-tooltip" style={{ left: '20px', bottom: '20px' }}>
            <div className="tooltip-header">
              <Footprints size={15} color="#0284c7" />
              <strong>{hoveredPathway.name}</strong>
              <span className="tooltip-badge aisle-badge">{hoveredPathway.widthLabel} WIDE</span>
            </div>
            <div className="tooltip-stalls">
              <span>Location: </span>
              <strong>{hoveredPathway.hall}</strong>
            </div>
            <div className="tooltip-meta">
              <span>{hoveredPathway.description}</span>
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

        {/* Pan/Zoom Hint (when not navigating) */}
        {!route && (
          <div className="map-pan-hint-pill">
            <Move size={13} />
            <span>Click & Drag to pan · Scroll wheel to zoom · Click any booth to navigate</span>
          </div>
        )}
      </div>

      {/* Map Legend */}
      <div className="map-legend-bar">
        <div className="legend-item">
          <span className="legend-color-box grand-aisle" />
          <span>6.0M Main Grand Aisle</span>
        </div>
        <div className="legend-item">
          <span className="legend-color-box promenade" />
          <span>4.0M Temple Promenade</span>
        </div>
        <div className="legend-item">
          <span className="legend-color-box cross-aisle" />
          <span>3.0M Cross Aisle</span>
        </div>
        <div className="legend-item">
          <span className="legend-color-box passage" />
          <span>2.5M Covered Passage</span>
        </div>
        <div className="legend-item">
          <span className="legend-color-box theme-pavilion" />
          <span>Ramappa Temple (18m×6m)</span>
        </div>
        {route && (
          <div className="legend-item route-active">
            <Navigation2 size={13} color="#2563eb" />
            <span>Google Maps Live Navigation Active</span>
          </div>
        )}
      </div>
    </div>
  );
}
