import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  MapPin,
  Building2,
  Compass,
  QrCode,
  ShieldCheck,
  LogIn,
  Plus,
  X,
  LogOut,
  Share2,
  Check,
  ChevronRight,
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
import ExhibitorDirectory from './components/ExhibitorDirectory';

// --------------------------------------------------
// CONFIGURATION
// --------------------------------------------------

const EVENT_ID = 'irc-expo-2026';

const rawApi = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
const cleanApi = rawApi.replace(/\/+$/, '');
const API = cleanApi.endsWith('/api') ? cleanApi : `${cleanApi}/api`;

const TOKEN_KEY = 'irc_admin_token';

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

  // Mobile View Toggle ('map' | 'directory')
  const [mobileTab, setMobileTab] = useState<'map' | 'directory'>('map');

  // Modals
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Admin state
  const [adminOpen, setAdminOpen] = useState(false);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
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

  // Handle URL deep-link parameter (?destination=... or ?stall=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dest = params.get('destination') || params.get('stall');
    if (!dest) return;

    const term = decodeURIComponent(dest).toLowerCase();
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

  // Selection handler (instantly calculates route and shows preview)
  const handleSelectExhibitor = useCallback((exhibitor: ClubbedExhibitor) => {
    setSelectedExhibitor(exhibitor);
    setActiveStepIndex(0);
    setIsNavigatingLive(false); // Start in route preview mode

    // Automatically adjust hall view if needed
    if (exhibitor.hall === 'Hall-1') {
      setActiveHall('hall-1');
    } else if (exhibitor.hall === 'Hanger') {
      setActiveHall('hanger');
    }

    // On mobile screens, automatically show the map
    setMobileTab('map');
  }, []);

  // Start Live Indoor Navigation
  const handleStartNavigation = useCallback(() => {
    if (activeRoute) {
      setIsNavigatingLive(true);
      setMobileTab('map');
    }
  }, [activeRoute]);

  // Exit / Stop Navigation
  const handleExitNavigation = useCallback(() => {
    setIsNavigatingLive(false);
    setSelectedExhibitor(null);
    setActiveRoute(null);
  }, []);

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
      localStorage.setItem(TOKEN_KEY, data.access_token);
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
    localStorage.removeItem(TOKEN_KEY);
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
          SIMPLIFIED TOP APPLICATION BAR
         ======================================================== */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">IRC</span>
          <span>
            EXHIBITION FINDER
            <small>85th ANNUAL SESSION · HITEX HYDERABAD</small>
          </span>
        </div>

        {/* Indoor Positioning Origin Selector */}
        <div className="topbar-position-pill" onClick={() => setShowLocationModal(true)}>
          <MapPin size={15} className="location-pin-icon" />
          <div className="position-text-block">
            <span className="position-label">MY LOCATION:</span>
            <strong className="position-name">{positionState.label}</strong>
          </div>
          <button type="button" className="position-change-btn" title="Change start location">
            Change
          </button>
        </div>

        {/* Hall View Quick Selector */}
        <div className="topbar-hall-tabs">
          <button
            type="button"
            className={`hall-tab-btn-mini ${activeHall === 'all' ? 'active' : ''}`}
            onClick={() => setActiveHall('all')}
          >
            All Halls
          </button>
          <button
            type="button"
            className={`hall-tab-btn-mini ${activeHall === 'hall-1' ? 'active' : ''}`}
            onClick={() => setActiveHall('hall-1')}
          >
            Hall-1 ({hall1Count})
          </button>
          <button
            type="button"
            className={`hall-tab-btn-mini ${activeHall === 'hanger' ? 'active' : ''}`}
            onClick={() => setActiveHall('hanger')}
          >
            Hanger ({hangerCount})
          </button>
        </div>

        {/* Quick Tools: QR Codes & Organiser Access */}
        <div className="topbar-actions">
          <button
            type="button"
            className="qr-action-btn"
            onClick={() => setShowQrModal(true)}
            title="Mobile QR Wayfinding Checkpoints"
          >
            <Smartphone size={16} />
            <span>Mobile QR</span>
          </button>

          <button
            type="button"
            className="admin-link"
            onClick={() => {
              setAdminOpen((prev) => !prev);
              setAdminError('');
            }}
          >
            <ShieldCheck size={16} />
            <span>Organiser</span>
          </button>
        </div>
      </header>

      {/* ========================================================
          MOBILE VIEW TAB TOGGLE (Only visible on small viewports)
         ======================================================== */}
      <div className="mobile-view-tabs" role="tablist">
        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === 'map' ? 'active' : ''}`}
          onClick={() => setMobileTab('map')}
        >
          <Compass size={17} />
          <span>Interactive Map</span>
          {activeRoute && <span className="tab-route-pulse" />}
        </button>

        <button
          type="button"
          className={`mobile-tab-btn ${mobileTab === 'directory' ? 'active' : ''}`}
          onClick={() => setMobileTab('directory')}
        >
          <Building2 size={17} />
          <span>Directory ({clubbedExhibitors.length})</span>
        </button>
      </div>

      {/* ========================================================
          TWO-COMPONENT MAIN WORKSPACE
          1. Exhibitor / Counter Directory (Left Pane)
          2. Interactive Floor Map (Right Pane)
         ======================================================== */}
      <main className="app-workspace-split">
        {/* Left Pane: Exhibitor & Service Counter Directory */}
        <aside
          className={`directory-sidebar-pane ${mobileTab === 'directory' ? 'mobile-visible' : 'mobile-hidden'}`}
          aria-label="Exhibitor Directory & Destination Selector"
        >
          <ExhibitorDirectory
            exhibitors={clubbedExhibitors}
            selectedExhibitor={selectedExhibitor}
            onSelectExhibitor={handleSelectExhibitor}
            activeHall={activeHall}
            onHallChange={setActiveHall}
            route={activeRoute}
            isNavigatingLive={isNavigatingLive}
            onStartNavigation={handleStartNavigation}
            onExitNavigation={handleExitNavigation}
            currentLocationLabel={positionState.label}
            onChangeLocation={() => setShowLocationModal(true)}
          />
        </aside>

        {/* Right Pane: Interactive Vector Exhibition Floor Map */}
        <section
          className={`map-viewport-pane ${mobileTab === 'map' ? 'mobile-visible' : 'mobile-hidden'}`}
          aria-label="Interactive Exhibition Floor Map"
        >
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
          />
        </section>
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
