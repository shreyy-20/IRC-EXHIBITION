import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  MapPin,
  QrCode,
  LogIn,
  Plus,
  X,
  LogOut,
  Share2,
  Check,
  ChevronRight,
  ChevronLeft,
  Search,
  Coffee,
  CornerUpLeft,
  CornerUpRight,
  ArrowUp,
  ExternalLink,
  Smartphone,
} from 'lucide-react';

import { clubbedExhibitors, type ClubbedExhibitor } from './data/clubbedExhibitors';
import { findShortestPath, type RoutePath } from './data/venueGraph';
import {
  resolveInitialPosition,
  PHYSICAL_KIOSKS,
  QR_CHECKPOINTS,
  buildCheckpointNavUrl,
  type PositioningState,
} from './data/indoorPositioning';

import { type HallTab } from './components/HallSelector';
import InteractiveFloorMap from './components/InteractiveFloorMap';
import {
  IndoorMotionTracker,
  isMobileDevice,
} from './data/indoorMotionTracker';

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const EVENT_ID = 'irc-expo-2026';

const rawApi = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const cleanApi = rawApi.replace(/\/+$/, '');
const API = cleanApi.endsWith('/api') ? cleanApi : `${cleanApi}/api`;

const TOKEN_KEY = 'irc_admin_token';

function safeGetStorage(key: string): string {
  try {
    return localStorage.getItem(key) || '';
  } catch {
    return '';
  }
}

function safeSetStorage(key: string, val: string): void {
  try {
    localStorage.setItem(key, val);
  } catch {}
}

function safeRemoveStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

type AdminStats = {
  events: number;
  exhibitors: number;
  halls: number;
  booths: number;
};

// --------------------------------------------------
// MAIN APPLICATION
// --------------------------------------------------

export default function App() {
  const [activeHall, setActiveHall] = useState<HallTab>('all');
  const [selectedExhibitor, setSelectedExhibitor] = useState<ClubbedExhibitor | null>(null);
  const [positionState, setPositionState] = useState<PositioningState>(() => resolveInitialPosition());
  const [activeRoute, setActiveRoute] = useState<RoutePath | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isNavigatingLive, setIsNavigatingLive] = useState<boolean>(false);

  // Kiosk vs Mobile Device Mode
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkpoint') || params.get('cp')) return true;
    if (params.get('kiosk')) return false;
    return isMobileDevice();
  });

  // Real-time Indoor Motion & Sensor Fusion States
  const [liveCoords, setLiveCoords] = useState<{ x: number; y: number } | null>(null);
  const [liveHeading, setLiveHeading] = useState<number | null>(null);
  const [liveWalkedMeters, setLiveWalkedMeters] = useState<number>(0);
  const [liveStatusText, setLiveStatusText] = useState<string>('');
  const [hasArrived, setHasArrived] = useState<boolean>(false);
  const indoorTrackerRef = useRef<IndoorMotionTracker | null>(null);

  // Live Digital Clock (matching Reference Image 1)
  const [currentTime, setCurrentTime] = useState(() => {
    const d = new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // Sliding Right Drawer States (Reference Images 2 & 3)
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [drawerMode, setDrawerMode] = useState<'directions' | 'directory'>('directions');
  const [directoryQuery, setDirectoryQuery] = useState<string>('');

  // Modals
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Admin state
  const [adminOpen, setAdminOpen] = useState(false);
  const [token, setToken] = useState(() => safeGetStorage(TOKEN_KEY));
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [addingExhibitor, setAddingExhibitor] = useState(false);

  // Immediate Route Calculation whenever destination or position changes
  useEffect(() => {
    if (selectedExhibitor) {
      const targetNode = selectedExhibitor.accessNodeId || 'hall1_node_b2';
      const path = findShortestPath(positionState.nodeId, targetNode);
      setActiveRoute(path);

      // Track analytics asynchronously
      fetch(`${API}/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: EVENT_ID,
          event_type: 'destination_selected',
          entity_id: selectedExhibitor.id,
          query_text: selectedExhibitor.clubbedLabel,
        }),
      }).catch(() => {});
    } else {
      setActiveRoute(null);
      setIsNavigatingLive(false);
    }
  }, [selectedExhibitor, positionState.nodeId]);

  // Handle URL deep-link parameters (?checkpoint=..., ?kiosk=..., ?destination=... or ?stall=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cpParam = params.get('checkpoint') || params.get('cp');
    const kioskParam = params.get('kiosk');
    const destParam = params.get('destination') || params.get('stall');

    if (kioskParam && PHYSICAL_KIOSKS[kioskParam]) {
      const k = PHYSICAL_KIOSKS[kioskParam];
      setPositionState({
        source: 'kiosk',
        id: k.id,
        label: k.name,
        nodeId: k.nodeId,
        hall: k.hall,
        coords: { x: k.x, y: k.y },
        headingDeg: null,
        timestamp: Date.now(),
      });
    } else if (cpParam) {
      const matchCp = QR_CHECKPOINTS.find(
        (cp) => cp.id === cpParam || cp.code.toLowerCase() === cpParam.toLowerCase()
      );
      if (matchCp) {
        setPositionState({
          source: 'qr_checkpoint',
          id: matchCp.id,
          label: `${matchCp.code} — ${matchCp.label}`,
          nodeId: matchCp.nodeId,
          hall: matchCp.hall,
          coords: { x: matchCp.x, y: matchCp.y },
          headingDeg: null,
          timestamp: Date.now(),
        });
      }
    }

    if (destParam) {
      const term = decodeURIComponent(destParam).toLowerCase();
      const match = clubbedExhibitors.find(
        (ex) =>
          ex.id.toLowerCase() === term ||
          ex.companyName.toLowerCase().includes(term) ||
          ex.clubbedLabel.toLowerCase().includes(term) ||
          ex.stalls.some((s) => String(s) === term)
      );

      if (match) {
        setSelectedExhibitor(match);
        if (match.hall === 'Hall-1') setActiveHall('hall-1');
        if (match.hall === 'Hanger') setActiveHall('hanger');
      }
    }
  }, []);

  // Hall counts
  const hall1Count = useMemo(
    () => clubbedExhibitors.filter((ex) => ex.hall === 'Hall-1').length,
    []
  );
  const hangerCount = useMemo(
    () => clubbedExhibitors.filter((ex) => ex.hall === 'Hanger').length,
    []
  );

  // Selection handler (instantly calculates route, displays route on map, preserves viewport)
  const handleSelectExhibitor = useCallback((exhibitor: ClubbedExhibitor) => {
    setSelectedExhibitor(exhibitor);
    setActiveStepIndex(0);
    setIsNavigatingLive(false);

    // On Kiosk display, open the side directions drawer.
    // On Mobile phones, do NOT cover the map with a full drawer:
    // keep the drawer closed so the floor map and drawn route remain 100% visible,
    // with the bottom route bar showing distance, time, and "Show directions" button.
    if (!isMobile) {
      setDrawerOpen(true);
      setDrawerMode('directions');
    } else {
      setDrawerOpen(false);
    }

    if (exhibitor.hall === 'Hall-1' && activeHall === 'hanger') {
      setActiveHall('hall-1');
    } else if (exhibitor.hall === 'Hanger' && activeHall === 'hall-1') {
      setActiveHall('hanger');
    }
  }, [isMobile, activeHall]);

  // Start Live Indoor Navigation (Strictly on mobile devices / mobile view)
  const handleStartNavigation = useCallback(() => {
    if (activeRoute) {
      setIsNavigatingLive(true);
      setHasArrived(false);
      setLiveWalkedMeters(0);
    }
  }, [activeRoute]);

  // Exit / Stop Navigation
  const handleExitNavigation = useCallback(() => {
    setIsNavigatingLive(false);
    setSelectedExhibitor(null);
    setActiveRoute(null);
    setDrawerOpen(false);
    setLiveCoords(null);
    setLiveHeading(null);
    setLiveWalkedMeters(0);
    setLiveStatusText('');
    setHasArrived(false);
  }, []);

  // Motion Tracker Lifecycle Effect (Runs sensors only when user presses START NAVIGATION)
  useEffect(() => {
    if (!isNavigatingLive || !activeRoute) {
      if (indoorTrackerRef.current) {
        indoorTrackerRef.current.stop();
        indoorTrackerRef.current = null;
      }
      return;
    }

    const initialCoords = positionState.coords || { x: 1200, y: 830 };
    const destNodeId = selectedExhibitor?.accessNodeId || null;

    const tracker = new IndoorMotionTracker(initialCoords, {
      onPositionUpdate: (coords: { x: number; y: number }, walkedM: number) => {
        setLiveCoords(coords);
        setLiveWalkedMeters(walkedM);
      },
      onHeadingUpdate: (heading: number) => {
        setLiveHeading(heading);
      },
      onRerouteNeeded: (divergedNodeId: string) => {
        if (selectedExhibitor) {
          const newPath = findShortestPath(divergedNodeId, selectedExhibitor.accessNodeId || 'hall1_node_b2');
          if (newPath) {
            setActiveRoute(newPath);
            tracker.setRoute(newPath, selectedExhibitor.accessNodeId || null);
          }
        }
      },
      onArrival: () => {
        setHasArrived(true);
        setLiveStatusText('You have arrived at your destination!');
      },
      onStatusChange: (status: string) => {
        setLiveStatusText(status);
      },
    });

    indoorTrackerRef.current = tracker;
    tracker.setRoute(activeRoute, destNodeId);
    tracker.start();

    return () => {
      tracker.stop();
      indoorTrackerRef.current = null;
    };
  }, [isNavigatingLive, activeRoute, selectedExhibitor]);

  const handleManualStepAdvance = useCallback(() => {
    if (indoorTrackerRef.current) {
      indoorTrackerRef.current.advanceManualStep(0.75);
    }
  }, []);

  const handleReanchorCheckpoint = useCallback(() => {
    setShowLocationModal(true);
  }, []);

  // Filtered exhibitors list for Directory mode
  const filteredExhibitors = useMemo(() => {
    const q = directoryQuery.trim().toLowerCase();
    const list = clubbedExhibitors.filter((ex) => {
      if (ex.allocationStatus === 'unassigned' || ex.isServiceCounter) return false;
      if (activeHall === 'hall-1' && ex.hall !== 'Hall-1') return false;
      if (activeHall === 'hanger' && ex.hall !== 'Hanger') return false;
      if (!q) return true;
      const nameMatch = ex.companyName.toLowerCase().includes(q);
      const stallMatch = ex.stalls.some((s) => String(s) === q);
      return nameMatch || stallMatch;
    });
    return list.sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [directoryQuery, activeHall]);

  // Turn steps generator matching Reference Images 2 & 3
  const turnSteps = useMemo(() => {
    if (!activeRoute || !selectedExhibitor) return [];
    if (activeRoute.steps.length === 0) {
      return [
        {
          icon: 'arrive' as const,
          text: `${selectedExhibitor.companyName} is on your right`,
          dist: `${activeRoute.distanceMeters} m`,
        },
      ];
    }

    const list: Array<{ icon: 'left' | 'right' | 'straight' | 'arrive'; text: string; dist: string }> = [];

    for (let i = 0; i < activeRoute.steps.length; i++) {
      const s = activeRoute.steps[i];
      const isFirst = i === 0;
      const isLast = i === activeRoute.steps.length - 1;

      let icon: 'left' | 'right' | 'straight' | 'arrive' = 'straight';
      if (s.turnType === 'left') icon = 'left';
      else if (s.turnType === 'right') icon = 'right';
      else if (isLast) icon = 'arrive';

      let text = '';
      const cleanName = s.aisleName
        .replace(/Corridor|Aisle|Promenade|6\.0M|4\.0M|2\.5M/gi, '')
        .trim();

      if (isLast) {
        icon = 'arrive';
        text = `${selectedExhibitor.companyName} is on your right`;
      } else if (isFirst) {
        if (s.turnType === 'right') {
          text = `Go right past ${cleanName || 'MR Chemie'}`;
        } else if (s.turnType === 'left') {
          text = `Go left past ${cleanName || 'Fujifilm India'}`;
        } else {
          text = `Head straight along ${s.aisleName}`;
        }
      } else {
        if (s.turnType === 'right') {
          text = `Turn right at ${cleanName || 'intersection'}`;
        } else if (s.turnType === 'left') {
          text = `Turn left at ${cleanName || 'ISNT Pavilion'}`;
        } else if (s.turnType === 'passage') {
          text = `Pass through connecting passage to ${s.hall}`;
        } else {
          text = `Continue along ${s.aisleName}`;
        }
      }

      list.push({
        icon,
        text,
        dist: `${s.distanceM} m`,
      });
    }

    if (list.length === 0 || list[list.length - 1].icon !== 'arrive') {
      list.push({
        icon: 'arrive',
        text: `${selectedExhibitor.companyName} is on your right`,
        dist: '',
      });
    }

    return list;
  }, [activeRoute, selectedExhibitor]);

  function getCompanyMonogram(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'EX';
    if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }

  function getCompanyWebsite(name: string): string {
    const clean = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 14);
    return `${clean}.com`;
  }

  function getBoothTag(ex: ClubbedExhibitor): string {
    const cat = (ex.category || '').toLowerCase();
    const firstStall = ex.stalls && ex.stalls.length > 0 ? ex.stalls[0] : '';
    if (cat.includes('gold')) return `Gold · Booth Gold-${firstStall || '5'}`;
    if (cat.includes('diamond')) return `Diamond · Booth Diamond-${firstStall || '3'}`;
    if (cat.includes('platinum')) return `Platinum · Booth Platinum-${firstStall || '2'}`;
    if (cat.includes('principal')) return 'Principal · Booth Main';
    return firstStall ? `Exhibitor · Booth E-${firstStall}` : 'Exhibitor';
  }

  // Switch start location
  function handleSelectStartLocation(type: 'kiosk' | 'qr_checkpoint', id: string) {
    if (type === 'kiosk') {
      const k = PHYSICAL_KIOSKS[id];
      if (k) {
        setPositionState({
          source: 'kiosk',
          id: k.id,
          label: k.name,
          nodeId: k.nodeId,
          hall: k.hall,
          coords: { x: k.x, y: k.y },
          headingDeg: null,
          timestamp: Date.now(),
        });
      }
    } else {
      const cp = QR_CHECKPOINTS.find((c) => c.id === id);
      if (cp) {
        setPositionState({
          source: 'qr_checkpoint',
          id: cp.id,
          label: `${cp.code} — ${cp.label}`,
          nodeId: cp.nodeId,
          hall: cp.hall,
          coords: { x: cp.x, y: cp.y },
          headingDeg: null,
          timestamp: Date.now(),
        });
      }
    }
    setShowLocationModal(false);
    setIsNavigatingLive(false);
  }

  // Copy mobile navigation link to clipboard
  function handleCopyMobileLink() {
    const url = buildCheckpointNavUrl(
      positionState.id,
      selectedExhibitor ? selectedExhibitor.id : undefined
    );
    navigator.clipboard?.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  // Admin login
  async function adminLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setAdminLoading(true);
      setAdminError('');

      const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Admin login failed. Check credentials.');
      }

      const data = await response.json();
      safeSetStorage(TOKEN_KEY, data.access_token);
      setToken(data.access_token);
      setPassword('');
      await loadAdminStats(data.access_token);
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setAdminLoading(false);
    }
  }

  async function loadAdminStats(auth = token) {
    try {
      const response = await fetch(`${API}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${auth}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAdminStats(data);
      }
    } catch {
      // ignore
    }
  }

  function adminLogout() {
    safeRemoveStorage(TOKEN_KEY);
    setToken('');
    setAdminStats(null);
    setAdminError('');
    setPassword('');
  }

  async function addExhibitor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      setAddingExhibitor(true);
      setAdminError('');

      const response = await fetch(`${API}/admin/exhibitors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: `ex-${Date.now()}`,
          event_id: EVENT_ID,
          name: newName.trim(),
          category: newCategory.trim() || 'General',
          description: 'Added via Admin Console',
          website: '',
          is_featured: false,
        }),
      });

      if (!response.ok) throw new Error('Could not add exhibitor.');
      setNewName('');
      setNewCategory('General');
      await loadAdminStats();
    } catch (err) {
      setAdminError(err instanceof Error ? err.message : 'Unable to add exhibitor.');
    } finally {
      setAddingExhibitor(false);
    }
  }

  return (
    <div className="app app-fullscreen-shell">
      {/* ========================================================
          AUTHENTIC TOP APPLICATION BAR (REFERENCE IMAGE 1)
         ======================================================== */}
      <header className="ref-topbar">
        <div className="ref-topbar-left">
          <div className="ref-brand-title">IRC 2026</div>
          <div className="ref-brand-subtitle">
            85th ANNUAL SESSION · HITEX HYDERABAD · 14–17 NOV
          </div>
        </div>

        <div className="ref-topbar-center">
          {/* Hall View Quick Selector */}
          <div className="ref-hall-pills">
            <button
              type="button"
              className={`ref-hall-pill ${activeHall === 'all' ? 'active' : ''}`}
              onClick={() => setActiveHall('all')}
            >
              All ({clubbedExhibitors.length})
            </button>
            <button
              type="button"
              className={`ref-hall-pill ${activeHall === 'hall-1' ? 'active' : ''}`}
              onClick={() => setActiveHall('hall-1')}
            >
              Hall-1 ({hall1Count})
            </button>
            <button
              type="button"
              className={`ref-hall-pill ${activeHall === 'hanger' ? 'active' : ''}`}
              onClick={() => setActiveHall('hanger')}
            >
              Hanger ({hangerCount})
            </button>
            <button
              type="button"
              className={`ref-hall-pill ${isMobile ? 'active' : ''}`}
              onClick={() => {
                setIsMobile((prev) => !prev);
                setIsNavigatingLive(false);
              }}
              title={isMobile ? 'Current: Mobile View. Click for Kiosk Mode' : 'Current: Kiosk Mode. Click for Mobile View'}
              style={{ fontWeight: 700 }}
            >
              {isMobile ? '📱 Mobile' : '🖥️ Kiosk'}
            </button>
          </div>

          {/* Directory Drawer Toggle button */}
          <button
            type="button"
            className="ref-directory-toggle-btn"
            onClick={() => {
              setDrawerOpen(true);
              setDrawerMode('directory');
            }}
          >
            <Search size={15} />
            <span>Search Exhibitors</span>
          </button>
        </div>

        <div className="ref-topbar-right">
          {/* Location Kiosk Selector */}
          <div
            className="ref-location-pill"
            onClick={() => setShowLocationModal(true)}
            title="Change start location"
          >
            <MapPin size={14} className="location-pin-icon" />
            <span className="location-name">{positionState.label}</span>
          </div>

          {/* Mobile QR */}
          <button
            type="button"
            className="ref-qr-pill"
            onClick={() => setShowQrModal(true)}
            title="Mobile QR Wayfinding"
          >
            <Smartphone size={15} />
            <span>Mobile QR</span>
          </button>

          {/* Live Digital Clock & Relax & Recharge */}
          <div className="ref-clock-container">
            <div className="ref-clock-time-row">
              <span className="ref-clock-digits">{currentTime}</span>
              <div className="ref-clock-icon-bubble">
                <Coffee size={14} />
              </div>
            </div>
            <div className="ref-clock-subtext">Hyderabad · RELAX & RECHARGE</div>
          </div>
        </div>
      </header>

      {/* ========================================================
          MAIN WORKSPACE CANVAS & SLIDING DRAWER (IMAGES 1, 2, 3)
         ======================================================== */}
      <main className="ref-main-canvas-shell">
        {/* Full Interactive Floor Map */}
        <div className={`ref-map-pane ${drawerOpen ? 'drawer-is-open' : 'drawer-is-closed'}`}>
          <InteractiveFloorMap
            exhibitors={clubbedExhibitors}
            selectedExhibitor={selectedExhibitor}
            onSelectExhibitor={handleSelectExhibitor}
            activeHall={activeHall}
            route={activeRoute}
            activeStepIndex={activeStepIndex}
            onSelectStep={setActiveStepIndex}
            onExitNavigation={handleExitNavigation}
            isNavigatingLive={isNavigatingLive}
            onStartNavigation={handleStartNavigation}
            onShowDirections={() => {
              setDrawerOpen(true);
              setDrawerMode('directions');
            }}
            drawerOpen={drawerOpen}
            isMobile={isMobile}
            liveCoords={liveCoords}
            liveHeading={liveHeading}
            liveWalkedMeters={liveWalkedMeters}
            liveStatusText={liveStatusText}
            hasArrived={hasArrived}
            onManualStepAdvance={handleManualStepAdvance}
            onReanchorCheckpoint={handleReanchorCheckpoint}
          />
        </div>

        {/* Right Sliding Navigation & Directory Drawer (Reference Images 2 & 3) */}
        {drawerOpen && (
          <aside className="ref-sliding-drawer" aria-label="Wayfinding and Exhibitor Drawer">
            {drawerMode === 'directions' && selectedExhibitor && activeRoute ? (
              /* Turn-by-Turn Wayfinding View (Images 2 & 3) */
              <div className="ref-directions-view">
                {/* Drawer Header */}
                <div className="ref-drawer-header">
                  <button
                    type="button"
                    className="ref-back-all-btn"
                    onClick={() => setDrawerMode('directory')}
                  >
                    <ChevronLeft size={16} />
                    <span>All exhibitors</span>
                  </button>
                  <button
                    type="button"
                    className="ref-drawer-close-btn"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close directions"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Company Header Card */}
                <div className="ref-company-card">
                  <div className="ref-company-icon-box">
                    <span className="ref-monogram">{getCompanyMonogram(selectedExhibitor.companyName)}</span>
                  </div>
                  <div className="ref-company-details">
                    <h2 className="ref-company-name">{selectedExhibitor.companyName}</h2>
                    <div className="ref-company-booth-sub">{getBoothTag(selectedExhibitor)}</div>
                    <a
                      href={`https://${getCompanyWebsite(selectedExhibitor.companyName)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ref-company-website"
                    >
                      {getCompanyWebsite(selectedExhibitor.companyName)}
                    </a>
                  </div>
                </div>

                {/* Two Large Metric Boxes */}
                <div className="ref-metrics-two-box">
                  <div className="ref-metric-card red-card">
                    <div className="ref-metric-num red-text">{activeRoute.distanceMeters} m</div>
                    <div className="ref-metric-label">walking distance</div>
                  </div>
                  <div className="ref-metric-card dark-card">
                    <div className="ref-metric-num dark-text">{activeRoute.walkingMinutes} min</div>
                    <div className="ref-metric-label">at an easy pace</div>
                  </div>
                </div>

                {/* Mobile Start Live Navigation CTA inside Drawer */}
                {isMobile && !isNavigatingLive && (
                  <button
                    type="button"
                    className="ref-drawer-start-live-btn"
                    onClick={() => {
                      handleStartNavigation();
                      setDrawerOpen(false);
                    }}
                    style={{
                      width: '100%',
                      margin: '12px 0 6px',
                      padding: '13px 18px',
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '15px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                    }}
                  >
                    <Smartphone size={18} />
                    <span>START LIVE NAVIGATION</span>
                  </button>
                )}

                {/* Step-by-Step Wayfinding List */}
                <div className="ref-steps-list-container">
                  {turnSteps.map((step, idx) => (
                    <div key={`step-${idx}`} className={`ref-step-row ${step.icon === 'arrive' ? 'arrive-step' : ''}`}>
                      <div className="ref-step-icon-box">
                        {step.icon === 'right' ? (
                          <CornerUpRight size={18} strokeWidth={2.5} />
                        ) : step.icon === 'left' ? (
                          <CornerUpLeft size={18} strokeWidth={2.5} />
                        ) : step.icon === 'arrive' ? (
                          <MapPin size={18} color="#ffffff" fill="#ffffff" />
                        ) : (
                          <ArrowUp size={18} strokeWidth={2.5} />
                        )}
                      </div>
                      <div className="ref-step-text">{step.text}</div>
                      {step.dist && <div className="ref-step-dist">{step.dist}</div>}
                    </div>
                  ))}
                </div>

                {/* Take this route with you QR Card */}
                <div className="ref-take-route-qr-card">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                      buildCheckpointNavUrl(positionState.id, selectedExhibitor.id)
                    )}`}
                    alt="Take route QR"
                    className="ref-qr-img"
                  />
                  <div className="ref-qr-text-col">
                    <h4 className="ref-qr-title">Take this route with you</h4>
                    <p className="ref-qr-desc">
                      Scan with your phone camera. Opens right here, no app.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* All Exhibitors Directory View (Mode B) */
              <div className="ref-directory-view">
                {/* Directory Header */}
                <div className="ref-drawer-header">
                  <h3 className="ref-dir-heading">Exhibitors ({filteredExhibitors.length})</h3>
                  <button
                    type="button"
                    className="ref-drawer-close-btn"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close directory"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="ref-dir-search-bar">
                  <Search size={18} className="ref-search-icon" />
                  <input
                    type="text"
                    value={directoryQuery}
                    onChange={(e) => setDirectoryQuery(e.target.value)}
                    placeholder="Search company or stall number..."
                    aria-label="Search company or stall"
                  />
                  {directoryQuery && (
                    <button
                      type="button"
                      className="ref-clear-search-btn"
                      onClick={() => setDirectoryQuery('')}
                      aria-label="Clear search"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* Hall Pills Inside Drawer */}
                <div className="ref-dir-hall-pills">
                  <button
                    type="button"
                    className={`ref-dir-hall-btn ${activeHall === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveHall('all')}
                  >
                    All Halls
                  </button>
                  <button
                    type="button"
                    className={`ref-dir-hall-btn ${activeHall === 'hall-1' ? 'active' : ''}`}
                    onClick={() => setActiveHall('hall-1')}
                  >
                    Hall-1
                  </button>
                  <button
                    type="button"
                    className={`ref-dir-hall-btn ${activeHall === 'hanger' ? 'active' : ''}`}
                    onClick={() => setActiveHall('hanger')}
                  >
                    Hanger
                  </button>
                </div>

                {/* List of Exhibitors */}
                <div className="ref-dir-list">
                  {filteredExhibitors.map((ex) => {
                    const isSelected = selectedExhibitor?.id === ex.id;
                    return (
                      <div
                        key={ex.id}
                        className={`ref-dir-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleSelectExhibitor(ex)}
                      >
                        <div className="ref-dir-item-icon">
                          <span>{getCompanyMonogram(ex.companyName)}</span>
                        </div>
                        <div className="ref-dir-item-info">
                          <div className="ref-dir-item-name">{ex.companyName}</div>
                          <div className="ref-dir-item-sub">
                            {getBoothTag(ex)} · {ex.hall}
                          </div>
                        </div>
                        <ChevronRight size={18} className="ref-dir-chevron" />
                      </div>
                    );
                  })}
                  {filteredExhibitors.length === 0 && (
                    <div className="ref-dir-empty">
                      No exhibitors match "{directoryQuery}".
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        )}
      </main>

      {/* ========================================================
          INDOOR POSITIONING / START LOCATION MODAL
         ======================================================== */}
      {showLocationModal && (
        <div className="app-modal-overlay" onClick={() => setShowLocationModal(false)}>
          <div className="app-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">INDOOR POSITIONING</span>
                <h3>Select Your Current Location</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowLocationModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="modal-description">
              Choose your physical kiosk or scanned QR checkpoint. The navigation engine will
              calculate walking routes from this exact location.
            </p>

            {/* Touchscreen Kiosks */}
            <div className="location-group-section">
              <h4>
                <MapPin size={16} />
                Physical Touchscreen Kiosks
              </h4>
              <div className="location-options-list">
                {Object.values(PHYSICAL_KIOSKS).map((k) => (
                  <button
                    key={k.id}
                    type="button"
                    className={`location-option-item ${positionState.id === k.id ? 'is-current' : ''}`}
                    onClick={() => handleSelectStartLocation('kiosk', k.id)}
                  >
                    <div className="loc-info">
                      <strong>{k.name}</strong>
                      <span>{k.locationName} · {k.hall}</span>
                    </div>
                    {positionState.id === k.id ? (
                      <span className="current-badge">Selected</span>
                    ) : (
                      <ChevronRight size={17} className="chevron" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* QR Checkpoints */}
            <div className="location-group-section">
              <h4>
                <QrCode size={16} />
                Mobile QR Wayfinding Checkpoints
              </h4>
              <div className="location-options-list">
                {QR_CHECKPOINTS.map((cp) => (
                  <button
                    key={cp.id}
                    type="button"
                    className={`location-option-item ${positionState.id === cp.id ? 'is-current' : ''}`}
                    onClick={() => handleSelectStartLocation('qr_checkpoint', cp.id)}
                  >
                    <div className="loc-info">
                      <strong>{cp.code}: {cp.label}</strong>
                      <span>{cp.locationName} · {cp.hall}</span>
                    </div>
                    {positionState.id === cp.id ? (
                      <span className="current-badge">Selected</span>
                    ) : (
                      <ChevronRight size={17} className="chevron" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          MOBILE QR CHECKPOINTS MODAL (FOR DELEGATES' PHONES)
         ======================================================== */}
      {showQrModal && (
        <div className="app-modal-overlay" onClick={() => setShowQrModal(false)}>
          <div className="app-modal-box qr-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">DELEGATE WAYFINDING</span>
                <h3>Navigate on Your Mobile Device</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowQrModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <p className="modal-description">
              Scan any QR checkpoint placed on physical venue pillars or entrance totems to open
              live navigation on your phone from that location.
            </p>

            <div className="qr-checkpoints-grid">
              {QR_CHECKPOINTS.map((cp) => {
                const navUrl = buildCheckpointNavUrl(
                  cp.id,
                  selectedExhibitor ? selectedExhibitor.id : undefined
                );
                const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  navUrl
                )}`;

                return (
                  <div key={cp.id} className="qr-checkpoint-card">
                    <img src={qrImgSrc} alt={`QR for ${cp.label}`} className="qr-image" />
                    <strong className="qr-code-tag">{cp.code}</strong>
                    <h5 className="qr-label">{cp.label}</h5>
                    <span className="qr-hall">{cp.hall}</span>
                    <a
                      href={navUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="qr-test-link"
                    >
                      <ExternalLink size={13} />
                      Open as {cp.code}
                    </a>
                  </div>
                );
              })}
            </div>

            <div className="qr-modal-footer">
              <button
                type="button"
                className="copy-nav-link-btn"
                onClick={handleCopyMobileLink}
              >
                {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
                <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Current Navigation Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ADMIN CONSOLE DRAWER (ORGANISER ACCESS)
         ======================================================== */}
      {adminOpen && (
        <section className="admin-panel" aria-label="Organiser Administration Console">
          <div className="admin-panel-head">
            <div>
              <div className="eyebrow">ORGANISER CONSOLE</div>
              <h2>Exhibition Administration</h2>
            </div>
            <button
              type="button"
              className="icon-button"
              onClick={() => setAdminOpen(false)}
              aria-label="Close admin panel"
            >
              <X size={18} />
            </button>
          </div>

          {!token ? (
            <form className="admin-login" onSubmit={adminLogin}>
              <label>
                Username
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </label>

              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </label>

              {adminError && <div className="notice error">{adminError}</div>}

              <button className="primary-button" type="submit" disabled={adminLoading}>
                <LogIn size={16} />
                {adminLoading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          ) : (
            <>
              <div className="admin-stats">
                <div>
                  <strong>{adminStats ? adminStats.exhibitors : clubbedExhibitors.length}</strong>
                  <span>Exhibitor Records</span>
                </div>
                <div>
                  <strong>341</strong>
                  <span>Reported Stall Limit</span>
                </div>
                <div>
                  <strong>{adminStats ? adminStats.halls : 2}</strong>
                  <span>Exhibition Halls</span>
                </div>
                <div>
                  <strong>1</strong>
                  <span>Duplicate Flag (Stall 288)</span>
                </div>
              </div>

              {adminError && <div className="notice error">{adminError}</div>}

              <form className="admin-add" onSubmit={addExhibitor}>
                <h3>
                  <Plus size={16} />
                  Add Exhibitor Record
                </h3>
                <input
                  required
                  placeholder="Company name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
                <input
                  placeholder="Category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <button className="primary-button" type="submit" disabled={addingExhibitor}>
                  {addingExhibitor ? 'Saving…' : 'Save Exhibitor'}
                </button>
              </form>

              <button type="button" className="logout-button" onClick={adminLogout}>
                <LogOut size={15} />
                Sign out
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
}
