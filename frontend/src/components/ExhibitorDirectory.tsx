import { useState, useMemo } from 'react';
import {
  Search,
  X,
  Building2,
  Navigation,
  AlertTriangle,
  Filter,
  Sparkles,
} from 'lucide-react';
import type { ClubbedExhibitor } from '../data/clubbedExhibitors';
import type { HallTab } from './HallSelector';

type Props = {
  exhibitors: ClubbedExhibitor[];
  selectedExhibitor: ClubbedExhibitor | null;
  onSelectExhibitor: (exhibitor: ClubbedExhibitor) => void;
  activeHall: HallTab;
  onHallChange: (hall: HallTab) => void;
};

export default function ExhibitorDirectory({
  exhibitors,
  selectedExhibitor,
  onSelectExhibitor,
  activeHall,
  onHallChange,
}: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'duplicate' | 'out_of_range'>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return exhibitors.filter((ex) => {
      // Hall filter
      if (activeHall === 'hall-1' && ex.hall !== 'Hall-1') return false;
      if (activeHall === 'hanger' && ex.hall !== 'Hanger') return false;

      // Status filter
      if (statusFilter === 'verified' && ex.allocationStatus !== 'verified') return false;
      if (statusFilter === 'duplicate' && !ex.isDuplicate) return false;
      if (statusFilter === 'out_of_range' && !ex.isOutOfRange) return false;

      if (!q) return true;

      // Check match on company name
      const nameMatch = ex.companyName.toLowerCase().includes(q);
      // Check match on stall numbers
      const stallMatch = ex.stalls.some((s) => String(s) === q || String(s).includes(q));
      // Check match on raw string
      const rawMatch = ex.rawLikelyStallNumbers.toLowerCase().includes(q);
      // Check match on category
      const catMatch = ex.category.toLowerCase().includes(q);

      return nameMatch || stallMatch || rawMatch || catMatch;
    });
  }, [exhibitors, query, activeHall, statusFilter]);

  // Check if searched query matched duplicate stall 288
  const hasDuplicateMatch = query.includes('288') || filtered.some((ex) => ex.isDuplicate);

  return (
    <div className="exhibitor-directory-shell" id="directory">
      {/* Search Header */}
      <div className="directory-header">
        <div className="directory-title-block">
          <h3>Exhibitor Directory &amp; Stall Clusters</h3>
          <p>
            Browse companies with clubbed stall numbers. Click any company to automatically
            display the live walking route on the venue map.
          </p>
        </div>

        <div className="directory-stats-chip">
          <Sparkles size={14} />
          <span>{filtered.length} Companies Listed</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="directory-search-bar">
        <div className="search-input-wrap">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company name (e.g. Zydex, Orafol) or stall number (e.g. 21, 288, 385)..."
            aria-label="Search exhibitors by company or stall number"
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
          <span className="filter-label">Hall:</span>
          <button
            type="button"
            className={`filter-chip ${activeHall === 'all' ? 'active' : ''}`}
            onClick={() => onHallChange('all')}
          >
            All Halls
          </button>
          <button
            type="button"
            className={`filter-chip ${activeHall === 'hall-1' ? 'active' : ''}`}
            onClick={() => onHallChange('hall-1')}
          >
            Hall-1
          </button>
          <button
            type="button"
            className={`filter-chip ${activeHall === 'hanger' ? 'active' : ''}`}
            onClick={() => onHallChange('hanger')}
          >
            Hanger
          </button>
        </div>

        <div className="filter-group status-group">
          <span className="filter-label">Status:</span>
          <button
            type="button"
            className={`filter-chip ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Records
          </button>
          <button
            type="button"
            className={`filter-chip ${statusFilter === 'verified' ? 'active' : ''}`}
            onClick={() => setStatusFilter('verified')}
          >
            Major Clusters
          </button>
          <button
            type="button"
            className={`filter-chip warning-chip ${statusFilter === 'duplicate' ? 'active' : ''}`}
            onClick={() => setStatusFilter('duplicate')}
          >
            Duplicate (288)
          </button>
          <button
            type="button"
            className={`filter-chip warning-chip ${statusFilter === 'out_of_range' ? 'active' : ''}`}
            onClick={() => setStatusFilter('out_of_range')}
          >
            Out of Range (&gt;341)
          </button>
        </div>
      </div>

      {/* Duplicate Warning Callout if stall 288 or duplicate is queried */}
      {hasDuplicateMatch && (
        <div className="discrepancy-banner warning">
          <AlertTriangle size={18} />
          <div>
            <strong>DISCREPANCY ALERT · STALL 288 DUPLICATE ALLOCATION:</strong>
            <p>
              Stall 288 is assigned to both <em>AMMANN INDIA PRIVATE LIMITED</em> (Row 97)
              and <em>CTM TECHNICAL TEXTILES LIMITED</em> (Row 103) in the source allotment register.
              Both options are displayed below for organiser verification.
            </p>
          </div>
        </div>
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
              } ${ex.isOutOfRange ? 'has-out-of-range' : ''}`}
              onClick={() => onSelectExhibitor(ex)}
            >
              <div className="exhibitor-card-top">
                <div className="exhibitor-clubbed-badge">
                  <span>Stalls:</span>
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
                    ex.isDuplicate
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
                  <span>{isSelected ? 'Live Path Active' : 'Navigate to Stalls'}</span>
                </button>
                <small className="raw-source-note">Source Row {ex.sourceRow}</small>
              </div>
            </article>
          );
        })}

        {filtered.length === 0 && (
          <div className="empty-results-box">
            <Building2 size={36} />
            <p>No exhibitors matched your search query "{query}".</p>
            <button
              type="button"
              className="clear-filters-link"
              onClick={() => {
                setQuery('');
                setStatusFilter('all');
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
