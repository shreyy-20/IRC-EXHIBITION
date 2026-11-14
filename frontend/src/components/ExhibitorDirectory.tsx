import { useState, useMemo } from 'react';
import {
  Search,
  X,
  Building2,
  Navigation,
  Navigation2,
  AlertTriangle,
  Filter,
  Sparkles,
  MapPin,
  Square,
  Compass,
} from 'lucide-react';
import type { ClubbedExhibitor } from '../data/clubbedExhibitors';
import type { RoutePath } from '../data/venueGraph';
import type { HallTab } from './HallSelector';

type Props = {
  exhibitors: ClubbedExhibitor[];
  selectedExhibitor: ClubbedExhibitor | null;
  onSelectExhibitor: (exhibitor: ClubbedExhibitor) => void;
  activeHall: HallTab;
  onHallChange: (hall: HallTab) => void;
  route?: RoutePath | null;
  isNavigatingLive?: boolean;
  onStartNavigation?: () => void;
  onExitNavigation?: () => void;
  currentLocationLabel?: string;
  onChangeLocation?: () => void;
};

export default function ExhibitorDirectory({
  exhibitors,
  selectedExhibitor,
  onSelectExhibitor,
  activeHall,
  onHallChange,
  route,
  isNavigatingLive = false,
  onStartNavigation,
  onExitNavigation,
  currentLocationLabel = 'Main Entrance Kiosk',
  onChangeLocation,
}: Props) {
  const [query, setQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'companies' | 'counters' | 'verified' | 'duplicate'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return exhibitors.filter((ex) => {
      // Hall filter
      if (activeHall === 'hall-1' && ex.hall !== 'Hall-1') return false;
      if (activeHall === 'hanger' && ex.hall !== 'Hanger') return false;

      // Type / Status filter
      if (filterType === 'companies' && (ex.isServiceCounter || ex.allocationStatus === 'unassigned')) return false;
      if (filterType === 'counters' && !ex.isServiceCounter) return false;
      if (filterType === 'verified' && ex.allocationStatus !== 'verified') return false;
      if (filterType === 'duplicate' && !ex.isDuplicate) return false;

      if (!q) return true;

      // Check match on company/counter name
      const nameMatch = ex.companyName.toLowerCase().includes(q);
      // Check match on stall numbers
      const stallMatch = ex.stalls.some((s) => String(s) === q || String(s).includes(q));
      // Check match on raw string
      const rawMatch = ex.rawLikelyStallNumbers.toLowerCase().includes(q);
      // Check match on category
      const catMatch = ex.category.toLowerCase().includes(q);

      return nameMatch || stallMatch || rawMatch || catMatch;
    });
  }, [exhibitors, query, activeHall, filterType]);

  // Check if searched query matched duplicate stall 288
  const hasDuplicateMatch = query.includes('288') || filtered.some((ex) => ex.isDuplicate);

  return (
    <div className="exhibitor-directory-shell" id="directory">
      {/* Search Header */}
      <div className="directory-header">
        <div className="directory-title-block">
          <h3>Exhibitor Directory &amp; Counters</h3>
          <p>
            Search by company, stall number, or service counter. Instant route is drawn on the map.
          </p>
        </div>

        <div className="directory-stats-chip">
          <Sparkles size={14} />
          <span>{filtered.length} Listed</span>
        </div>
      </div>

      {/* Real-Time Search Bar */}
      <div className="directory-search-bar">
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company (Zydex, Orafol), stall # (21, 288), or counter (Registration, Help Desk)..."
            aria-label="Search exhibitors by company, stall number, or service counter"
          />
          {query && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setQuery('')}
              aria-label="Clear search query"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="directory-filters-row">
        <div className="filter-group">
          <Filter size={14} className="filter-label-icon" />
          <span className="filter-label">Filter:</span>
          <button
            type="button"
            className={`filter-chip ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All
          </button>
          <button
            type="button"
            className={`filter-chip ${filterType === 'companies' ? 'active' : ''}`}
            onClick={() => setFilterType('companies')}
          >
            Companies
          </button>
          <button
            type="button"
            className={`filter-chip ${filterType === 'counters' ? 'active' : ''}`}
            onClick={() => setFilterType('counters')}
          >
            Services &amp; Counters
          </button>
          <button
            type="button"
            className={`filter-chip warning-chip ${filterType === 'duplicate' ? 'active' : ''}`}
            onClick={() => setFilterType('duplicate')}
          >
            Duplicate 288
          </button>
        </div>
      </div>

      {/* Duplicate Warning Callout if stall 288 is queried */}
      {hasDuplicateMatch && (
        <div className="discrepancy-banner warning">
          <AlertTriangle size={18} />
          <div>
            <strong>DISCREPANCY ALERT · STALL 288 DUPLICATE ALLOCATION:</strong>
            <p>
              Stall 288 is assigned to both <em>AMMANN INDIA PRIVATE LIMITED</em> and{' '}
              <em>CTM TECHNICAL TEXTILES LIMITED</em>. Both options are listed below for navigation.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================
          SELECTED DESTINATION SPOTLIGHT & ROUTE PREVIEW CARD
         ======================================================== */}
      {selectedExhibitor && (
        <section className="destination-spotlight-card" aria-label="Selected Destination Navigation Card">
          <div className="spotlight-top-bar">
            <span className="spotlight-kicker">
              <Compass size={14} />
              {isNavigatingLive ? 'LIVE NAVIGATION IN PROGRESS' : 'DESTINATION SELECTED'}
            </span>
            <button
              type="button"
              className="spotlight-close-btn"
              onClick={() => onExitNavigation?.()}
              title="Clear selection"
            >
              <X size={16} />
            </button>
          </div>

          <div className="spotlight-main">
            <h4 className="spotlight-title">{selectedExhibitor.companyName}</h4>
            <div className="spotlight-meta-tags">
              <span className="spotlight-badge stall-badge">
                {selectedExhibitor.stallsFormatted}
              </span>
              <span className="spotlight-badge hall-badge">{selectedExhibitor.hall}</span>
              <span className="spotlight-badge cat-badge">{selectedExhibitor.category}</span>
            </div>

            {/* Origin & Routing Metrics */}
            <div className="spotlight-route-info">
              <div className="origin-row">
                <MapPin size={15} className="origin-pin-icon" />
                <span>
                  From: <strong>{currentLocationLabel}</strong>
                </span>
                {onChangeLocation && (
                  <button
                    type="button"
                    className="change-origin-link"
                    onClick={onChangeLocation}
                  >
                    Change
                  </button>
                )}
              </div>

              {route && (
                <div className="route-metrics-strip">
                  <div className="metric-item">
                    <span className="metric-val">{route.distanceMeters} m</span>
                    <span className="metric-lbl">Walking Distance</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-val">{route.walkingMinutes} min</span>
                    <span className="metric-lbl">Est. Walking Time</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-val">{route.steps.length} turns</span>
                    <span className="metric-lbl">Passage Route</span>
                  </div>
                </div>
              )}
            </div>

            {/* Prominent Action Button: START NAVIGATION */}
            <div className="spotlight-actions">
              {!isNavigatingLive ? (
                <button
                  type="button"
                  className="spotlight-start-nav-btn primary-nav-action"
                  onClick={() => onStartNavigation?.()}
                >
                  <Navigation2 size={19} className="nav-arrow-icon" />
                  <span>START NAVIGATION</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="spotlight-stop-nav-btn"
                  onClick={() => onExitNavigation?.()}
                >
                  <Square size={16} fill="currentColor" />
                  <span>EXIT NAVIGATION</span>
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Exhibitor Cards List */}
      <div className="exhibitors-card-grid">
        {filtered.map((ex) => {
          const isSelected = selectedExhibitor?.id === ex.id;

          return (
            <article
              key={ex.id}
              className={`exhibitor-card ${isSelected ? 'is-selected' : ''} ${
                ex.isDuplicate ? 'has-duplicate' : ''
              } ${ex.isOutOfRange ? 'has-out-of-range' : ''} ${
                ex.isServiceCounter ? 'is-service-card' : ''
              }`}
              onClick={() => onSelectExhibitor(ex)}
            >
              <div className="exhibitor-card-top">
                <div className="exhibitor-clubbed-badge">
                  <span>{ex.isServiceCounter ? 'Facility:' : 'Stalls:'}</span>
                  <strong>{ex.stallsFormatted}</strong>
                </div>

                <div className="exhibitor-hall-tag">
                  <span>{ex.hall}</span>
                </div>
              </div>

              <div className="exhibitor-company-name">
                <Building2 size={17} className="building-icon" />
                <h4>{ex.companyName}</h4>
              </div>

              <div className="exhibitor-meta-row">
                <span className="exhibitor-category">{ex.category}</span>
                <span
                  className={`status-pill ${
                    ex.isServiceCounter
                      ? 'pill-service'
                      : ex.isDuplicate
                        ? 'pill-duplicate'
                        : ex.isOutOfRange
                          ? 'pill-oor'
                          : ex.allocationStatus === 'verified'
                            ? 'pill-verified'
                            : 'pill-provisional'
                  }`}
                >
                  {ex.verificationStatus}
                </span>
              </div>

              <div className="exhibitor-card-action">
                <button
                  type="button"
                  className="navigate-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectExhibitor(ex);
                  }}
                >
                  <Navigation size={14} />
                  <span>{isSelected ? 'Route Active' : 'Select & View Route'}</span>
                </button>
                <small className="raw-source-note">
                  {ex.isServiceCounter ? 'Official Service' : `Source Row ${ex.sourceRow}`}
                </small>
              </div>
            </article>
          );
        })}

        {filtered.length === 0 && (
          <div className="empty-results-box">
            <Building2 size={36} />
            <p>No exhibitors or counters matched your search query "{query}".</p>
            <button
              type="button"
              className="clear-filters-link"
              onClick={() => {
                setQuery('');
                setFilterType('all');
                onHallChange('all');
              }}
            >
              Reset all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
