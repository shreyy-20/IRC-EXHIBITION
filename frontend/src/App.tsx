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
  ArrowRight,
  Compass,
  QrCode,
  ShieldCheck,
  LogIn,
  Plus,
  X,
  LogOut,
  Layers,
} from 'lucide-react';

import { clubbedExhibitors, type ClubbedExhibitor } from './data/clubbedExhibitors';
import { findShortestPath, type RoutePath } from './data/venueGraph';

import HallSelector, { type HallTab } from './components/HallSelector';
import InteractiveFloorMap from './components/InteractiveFloorMap';
import ExhibitorDirectory from './components/ExhibitorDirectory';
import NavigationGuidance from './components/NavigationGuidance';
import VenueLayouts from './components/VenueLayouts';

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
  const [startNodeId, setStartNodeId] = useState<string>('entrance_main');
  const [activeRoute, setActiveRoute] = useState<RoutePath | null>(null);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

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

  // Recalculate route whenever selectedExhibitor or startNodeId changes
  useEffect(() => {
    if (selectedExhibitor) {
      const targetNode = selectedExhibitor.accessNodeId || 'hall1_node_b2';
      const path = findShortestPath(startNodeId, targetNode);
      setActiveRoute(path);

      // Track destination
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
    }
  }, [selectedExhibitor, startNodeId]);

  // Deep-link destination parameter handling
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dest = params.get('destination');
    if (!dest) return;

    const term = decodeURIComponent(dest).toLowerCase();
    const match = clubbedExhibitors.find((ex) =>
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

  // Selection handler
  const handleSelectExhibitor = useCallback((exhibitor: ClubbedExhibitor) => {
    setSelectedExhibitor(exhibitor);
    setActiveStepIndex(0);

    // Automatically focus on corresponding hall if currently viewing 'all'
    if (exhibitor.hall === 'Hall-1') {
      setActiveHall('hall-1');
    } else if (exhibitor.hall === 'Hanger') {
      setActiveHall('hanger');
    }

    // Scroll smoothly to map section if visitor is viewing from directory
    const mapSection = document.getElementById('map-view');
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

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
    <div className="app">
      {/* ========================================================
          HEADER & TOPBAR
         ======================================================== */}
      <header className="topbar">
        <a className="brand" href="#">
          <span className="brand-mark">IRC</span>
          <span>
            EXHIBITION FINDER
            <small>85th ANNUAL SESSION · HYDERABAD</small>
          </span>
        </a>

        <nav>
          <a href="#map-view">Floor Map &amp; Navigation</a>
          <a href="#directory">Exhibitors ({clubbedExhibitors.length})</a>
          <a href="#venue-layouts">Venue Drawings</a>
          <a href="#about">Exhibition Zones</a>
        </nav>

        <button
          type="button"
          className="admin-link"
          onClick={() => {
            setAdminOpen((prev) => !prev);
            setAdminError('');
          }}
        >
          <ShieldCheck size={15} />
          Organiser Access
        </button>
      </header>

      {/* ========================================================
          ADMIN CONSOLE DRAWER
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

      {/* ========================================================
          MAIN CONTENT
         ======================================================== */}
      <main>
        {/* HERO SECTION */}
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span />
              85th INDIAN ROADS CONGRESS · HITEX HYDERABAD
            </div>

            <h1>
              Find your stalls.
              <br />
              <em>Navigate live.</em>
            </h1>

            <p>
              Explore all 102 exhibiting companies and their clubbed stall numbers across
              <strong> Hall-1</strong> and <strong>Hanger</strong>. Click any company name or stall
              cluster to automatically calculate and display the live walking path on the map.
            </p>

            <div className="hero-buttons-row">
              <a className="primary-button" href="#map-view">
                Explore Live Venue Map
                <ArrowRight size={17} />
              </a>
              <a className="secondary-hero-button" href="#directory">
                Search Exhibitor List
              </a>
            </div>

            <div className="hero-meta">
              <span>
                <MapPin size={15} />
                Revised 12-11-2026 Layout
              </span>
              <span>
                <QrCode size={15} />
                Mobile QR Wayfinding
              </span>
              <span>
                <Compass size={15} />
                Graph Dijkstra Live Routing
              </span>
            </div>
          </div>

          <div className="hero-art">
            <div className="art-card art-card-back">
              <div className="art-label">EXHIBITION OVERVIEW</div>
              <div className="art-lines">
                <i />
                <i />
                <i />
              </div>
            </div>

            <div className="art-card art-card-front">
              <div className="art-top">
                <Compass size={19} />
                <span>LIVE INDOOR WAYFINDING</span>
              </div>
              <div className="mini-map">
                <i />
                <i />
                <i />
                <b>LIVE ROUTE ACTIVE</b>
              </div>
              <div className="art-foot">
                <span>Hall-1 ⇄ Hanger Connected</span>
                <ArrowRight size={16} />
              </div>
            </div>

            <div className="floating-pin">
              <MapPin size={19} />
            </div>
          </div>
        </section>

        {/* METRICS STRIP */}
        <section className="stats">
          <div>
            <strong>102</strong>
            <span>Allotted Exhibitors</span>
          </div>
          <div>
            <strong>341</strong>
            <span>Reported Stall Total</span>
          </div>
          <div>
            <strong>2</strong>
            <span>Halls (Hall-1 &amp; Hanger)</span>
          </div>
          <div>
            <strong>1</strong>
            <span>Ramappa Theme Pavilion</span>
          </div>
        </section>

        {/* ========================================================
            MAP & NAVIGATION ENGINE SECTION
           ======================================================== */}
        <section id="map-view" className="section map-section-anchor">
          <div className="section-heading">
            <div>
              <div className="eyebrow">INDOOR NAVIGATION &amp; FLOOR MAP</div>
              <h2>Interactive Venue Layout</h2>
              <p>
                Click any company booth on the map or select from the directory below to view
                the live walking route from the main entrance through the aisles.
              </p>
            </div>

            <span className="sample-tag live-tag">
              <span className="live-dot" />
              LIVE DIJKSTRA ROUTING
            </span>
          </div>

          {/* Hall View Selector */}
          <HallSelector
            activeHall={activeHall}
            onChangeHall={setActiveHall}
            hall1Count={hall1Count}
            hangerCount={hangerCount}
          />

          {/* Active Navigation Guidance Card (Shows when a company is selected) */}
          {selectedExhibitor && (
            <NavigationGuidance
              exhibitor={selectedExhibitor}
              route={activeRoute}
              startNodeId={startNodeId}
              onChangeStartNode={(id) => {
                setStartNodeId(id);
                setActiveStepIndex(0);
              }}
              onClear={() => {
                setSelectedExhibitor(null);
                setActiveStepIndex(0);
              }}
              activeStepIndex={activeStepIndex}
              onSelectStep={setActiveStepIndex}
            />
          )}

          {/* Interactive Vector Floor Map */}
          <InteractiveFloorMap
            exhibitors={clubbedExhibitors}
            selectedExhibitor={selectedExhibitor}
            onSelectExhibitor={handleSelectExhibitor}
            activeHall={activeHall}
            route={activeRoute}
            activeStepIndex={activeStepIndex}
            onSelectStep={setActiveStepIndex}
            onExitNavigation={() => {
              setSelectedExhibitor(null);
              setActiveStepIndex(0);
            }}
          />
        </section>

        {/* ========================================================
            EXHIBITOR DIRECTORY WITH CLUBBED STALLS
           ======================================================== */}
        <section className="section directory-section-anchor">
          <div className="section-heading">
            <div>
              <div className="eyebrow">STALL ALLOTMENT REGISTER</div>
              <h2>Company Directory &amp; Clubbed Stalls</h2>
              <p>
                Find exhibitors by company name, partial string, or stall number. Every company
                is grouped with all their allotted stalls in one unified clickable card.
              </p>
            </div>
          </div>

          <ExhibitorDirectory
            exhibitors={clubbedExhibitors}
            selectedExhibitor={selectedExhibitor}
            onSelectExhibitor={handleSelectExhibitor}
            activeHall={activeHall}
            onHallChange={setActiveHall}
          />
        </section>

        {/* ========================================================
            OFFICIAL VENUE CAD DRAWINGS REFERENCE
           ======================================================== */}
        <VenueLayouts />

        {/* ========================================================
            ABOUT / FEATURES
           ======================================================== */}
        <section className="features" id="about">
          <div className="eyebrow">BUILT FOR IRC 85th ANNUAL SESSION</div>
          <h2>
            Smart exhibition discovery.
            <br />
            <em>Seamless indoor navigation.</em>
          </h2>

          <div className="feature-grid">
            <article>
              <Building2 />
              <h3>Clubbed Stall Blocks</h3>
              <p>
                Multi-stall exhibitors such as Zydex, Automark, ARRB, and Kataline are grouped as
                unified blocks so visitors can identify large pavilions immediately.
              </p>
            </article>

            <article>
              <Compass />
              <h3>Shortest-Path Navigation</h3>
              <p>
                Dijkstra graph-based routing traverses actual aisles, connecting Hall-1 and Hanger
                via the approved inter-hall passage without cutting through booths.
              </p>
            </article>

            <article>
              <Layers />
              <h3>Hall-1 &amp; Hanger Split</h3>
              <p>
                Explore each hall independently or inspect the complete combined exhibition
                floor with the Ramappa Temple Theme Pavilion clearly marked.
              </p>
            </article>

            <article>
              <QrCode />
              <h3>Mobile Checkpoint Wayfinding</h3>
              <p>
                Scan destination QR codes from exhibition kiosks to carry turn-by-turn directions
                directly on your smartphone.
              </p>
            </article>
          </div>
        </section>
      </main>

      {/* ========================================================
          FOOTER
         ======================================================== */}
      <footer>
        <div className="brand">
          <span className="brand-mark">IRC</span>
          <span>
            EXHIBITION FINDER
            <small>INDIAN ROADS CONGRESS 2026 · HITEX HYDERABAD</small>
          </span>
        </div>

        <span>
          Based on Revised Exhibition Layout 12-11-2026 &amp; Stall Allotment Register
        </span>
      </footer>
    </div>
  );
}
