import { useState, useMemo } from 'react';
import {
  Search,
  X,
  Building2,
  Navigation,
  Navigation2,
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
  currentLocationLabel = 'Entrance Kiosk',
  onChangeLocation,
}: Props) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const list = exhibitors.filter((ex) => {
      if (ex.allocationStatus === 'unassigned' || ex.isServiceCounter) return false;
      if (activeHall === 'hall-1' && ex.hall !== 'Hall-1') return false;
      if (activeHall === 'hanger' && ex.hall !== 'Hanger') return false;

      if (!q) return true;

      const nameMatch = ex.companyName.toLowerCase().includes(q);
      const stallMatch = ex.stalls.some((s) => String(s) === q);
      return nameMatch || stallMatch;
    });

    // Sort alphabetically by company name for easy scanning
    return list.sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [exhibitors, query, activeHall]);

  return (
    <div className="exhibitor-directory-shell" id="directory">
      {/* Search Bar */}
      <div className="directory-search-bar">
        <div className="search-input-wrap">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exhibitor company..."
            aria-label="Search exhibitor company"
          />
          {query && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Selected Destination Card */}
      {selectedExhibitor && (
        <section className="destination-spotlight-card" aria-label="Selected Exhibitor">
          <div className="spotlight-top-bar">
            <span className="spotlight-kicker">
              <Compass size={15} />
              {isNavigatingLive ? 'NAVIGATING' : 'SELECTED'}
            </span>
            <button
              type="button"
              className="spotlight-close-btn"
              onClick={() => onExitNavigation?.()}
              title="Clear selection"
            >
              <X size={18} />
            </button>
          </div>

          <div className="spotlight-main">
            <h4 className="spotlight-title">{selectedExhibitor.companyName}</h4>
            <div className="spotlight-meta-tags">
              <span className="spotlight-badge hall-badge">{selectedExhibitor.hall}</span>
            </div>

            {/* Walking Route Metrics */}
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
                    <span className="metric-lbl">Distance</span>
                  </div>
                  <div className="metric-item">
                    <span className="metric-val">{route.walkingMinutes} min</span>
                    <span className="metric-lbl">Walk Time</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Button: Start / Exit Navigation */}
            <div className="spotlight-actions">
              {!isNavigatingLive ? (
                <button
                  type="button"
                  className="spotlight-start-nav-btn primary-nav-action"
                  onClick={() => onStartNavigation?.()}
                >
                  <Navigation2 size={20} className="nav-arrow-icon" />
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
              className={`exhibitor-card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectExhibitor(ex)}
            >
              <div className="exhibitor-card-top">
                <div className="exhibitor-company-name">
                  <Building2 size={18} className="building-icon" />
                  <h4>{ex.companyName}</h4>
                </div>
                <div className="exhibitor-hall-tag">
                  <span>{ex.hall}</span>
                </div>
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
                  <Navigation size={15} />
                  <span>{isSelected ? 'Selected' : 'Navigate'}</span>
                </button>
              </div>
            </article>
          );
        })}

        {filtered.length === 0 && (
          <div className="empty-results-box">
            <Building2 size={36} />
            <p>No exhibitors matched "{query}".</p>
            <button
              type="button"
              className="clear-filters-link"
              onClick={() => {
                setQuery('');
                onHallChange('all');
              }}
            >
              View all exhibitors
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
