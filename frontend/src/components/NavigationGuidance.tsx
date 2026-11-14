import { useState, useEffect } from 'react';
import {
  MapPin,
  Clock,
  Compass,
  Footprints,
  QrCode,
  X,
  AlertTriangle,
  Download,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  CornerUpRight,
  CornerUpLeft,
  ArrowUp,
  DoorOpen,
  CheckCircle2,
  Navigation2,
} from 'lucide-react';
import type { ClubbedExhibitor } from '../data/clubbedExhibitors';
import type { RoutePath } from '../data/venueGraph';

type Props = {
  exhibitor: ClubbedExhibitor;
  route: RoutePath | null;
  startNodeId: string;
  onChangeStartNode: (nodeId: string) => void;
  onClear: () => void;
  activeStepIndex?: number | null;
  onSelectStep?: (index: number) => void;
};

const START_CHECKPOINTS = [
  { id: 'entrance_main', label: 'Main Venue Entrance (Hall-1 South Foyer · 6.0m)' },
  { id: 'entrance_hall1', label: 'Hall-1 Registration Foyer' },
  { id: 'passage_mid', label: 'Inter-Hall Covered Passage (2.5m Walkway)' },
  { id: 'hanger_mid_ramappa_n', label: 'Ramappa Temple Pavilion (Hanger Central · 4.0m)' },
];

export default function NavigationGuidance({
  exhibitor,
  route,
  startNodeId,
  onChangeStartNode,
  onClear,
  activeStepIndex = 0,
  onSelectStep,
}: Props) {
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [isPlayingSimulation, setIsPlayingSimulation] = useState(false);

  // Auto-play walk simulation
  useEffect(() => {
    if (!isPlayingSimulation || !route || route.nodes.length <= 1) return;

    const timer = setInterval(() => {
      const currentIndex = activeStepIndex ?? 0;
      if (currentIndex < route.nodes.length - 1) {
        onSelectStep?.(currentIndex + 1);
      } else {
        // Reached destination
        setIsPlayingSimulation(false);
      }
    }, 1800);

    return () => clearInterval(timer);
  }, [isPlayingSimulation, activeStepIndex, route, onSelectStep]);

  // Generate QR code deep link
  async function handleGenerateQr() {
    setGeneratingQr(true);
    try {
      const destinationParam = encodeURIComponent(exhibitor.clubbedLabel);
      const targetUrl = `${window.location.origin}/?destination=${destinationParam}`;

      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(
        targetUrl
      )}`;

      setQrBlobUrl(qrApiUrl);
      setShowQrModal(true);
    } catch {
      // fallback
    } finally {
      setGeneratingQr(false);
    }
  }

  function handlePrevStep() {
    if (!route) return;
    const curr = activeStepIndex ?? 0;
    if (curr > 0) {
      onSelectStep?.(curr - 1);
    }
  }

  function handleNextStep() {
    if (!route) return;
    const curr = activeStepIndex ?? 0;
    if (curr < route.nodes.length - 1) {
      onSelectStep?.(curr + 1);
    }
  }

  function getStepIcon(turnType: string) {
    switch (turnType) {
      case 'left':
        return <CornerUpLeft size={16} className="step-icon-turn left" />;
      case 'right':
        return <CornerUpRight size={16} className="step-icon-turn right" />;
      case 'passage':
        return <DoorOpen size={16} className="step-icon-turn passage" />;
      case 'arrive':
        return <CheckCircle2 size={16} className="step-icon-turn arrive" />;
      case 'start':
        return <Compass size={16} className="step-icon-turn start" />;
      default:
        return <ArrowUp size={16} className="step-icon-turn straight" />;
    }
  }

  const currentStep =
    route?.steps && activeStepIndex !== null && activeStepIndex !== undefined
      ? route.steps[activeStepIndex] || route.steps[0]
      : route?.steps?.[0];

  return (
    <div className="navigation-guidance-card">
      {/* Destination Header */}
      <div className="nav-header">
        <div className="nav-dest-title">
          <div className="nav-pin-icon">
            <MapPin size={22} />
          </div>
          <div>
            <div className="nav-eyebrow">ACTIVE LIVE DESTINATION</div>
            <h3 className="nav-company-name">{exhibitor.companyName}</h3>
            <div className="nav-stalls-tag">
              <span>Clubbed Stalls: </span>
              <strong>{exhibitor.stallsFormatted}</strong>
              <span className="nav-hall-badge">{exhibitor.hall}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="nav-close-btn"
          onClick={onClear}
          title="Clear active navigation route"
          aria-label="Close navigation"
        >
          <X size={18} />
        </button>
      </div>

      {/* Origin Selection Row */}
      <div className="nav-origin-row">
        <label htmlFor="checkpoint-select">
          <Compass size={15} />
          <span>Starting Checkpoint:</span>
        </label>
        <select
          id="checkpoint-select"
          value={startNodeId}
          onChange={(e) => {
            onChangeStartNode(e.target.value);
            onSelectStep?.(0);
            setIsPlayingSimulation(false);
          }}
        >
          {START_CHECKPOINTS.map((cp) => (
            <option key={cp.id} value={cp.id}>
              {cp.label}
            </option>
          ))}
        </select>
      </div>

      {/* Discrepancy Notice if applicable */}
      {exhibitor.isDuplicate && (
        <div className="nav-discrepancy-alert">
          <AlertTriangle size={16} />
          <span>
            <strong>Audit Note:</strong> Stall 288 is a shared duplicate allocation in the allotment register
            (Ammann India &amp; CTM Technical Textiles).
          </span>
        </div>
      )}

      {exhibitor.isOutOfRange && (
        <div className="nav-discrepancy-alert out-of-range">
          <AlertTriangle size={16} />
          <span>
            <strong>Audit Note:</strong> Stalls &gt; 341 are physically drawn on the 12-11-2026 Hanger layout drawing.
          </span>
        </div>
      )}

      {/* Walking Metrics */}
      {route ? (
        <div className="nav-metrics-strip">
          <div className="metric-box">
            <Footprints size={18} />
            <div>
              <strong>{route.distanceMeters} m</strong>
              <span>Walking Distance</span>
            </div>
          </div>

          <div className="metric-box">
            <Clock size={18} />
            <div>
              <strong>{route.walkingMinutes} min</strong>
              <span>Est. Walk Time</span>
            </div>
          </div>

          <div className="metric-box">
            <Compass size={18} />
            <div>
              <strong>{route.steps.length} Waypoints</strong>
              <span>Verified Path Legs</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="nav-calculating-notice">
          Calculating shortest indoor walking path...
        </div>
      )}

      {/* Walk Simulation & Step Controller */}
      {route && route.steps.length > 0 && (
        <div className="nav-simulation-player">
          <div className="simulation-header">
            <div className="sim-title">
              <span className="sim-pulse-dot" />
              <strong>Interactive Walk Wayfinding:</strong>
            </div>
            <div className="sim-step-counter">
              Step {(activeStepIndex ?? 0) + 1} of {route.steps.length}
            </div>
          </div>

          {/* Current Step Spotlight Card */}
          {currentStep && (
            <div className="current-step-spotlight">
              <div className="spotlight-icon-col">
                {getStepIcon(currentStep.turnType)}
              </div>
              <div className="spotlight-content">
                <div className="spotlight-aisle-tag">
                  <span className="aisle-badge-pill">{currentStep.aisleWidth} AISLE</span>
                  <span className="aisle-name-text">{currentStep.aisleName}</span>
                </div>
                <div className="spotlight-instruction">
                  {currentStep.instruction}
                </div>
                <div className="spotlight-meta">
                  <span>Segment: {currentStep.distanceM}m</span>
                  <span>·</span>
                  <span>Total Walked: {currentStep.cumulativeDistanceM}m / {route.distanceMeters}m</span>
                </div>
              </div>
            </div>
          )}

          {/* Player controls */}
          <div className="sim-controls-bar">
            <button
              type="button"
              className="sim-ctrl-btn"
              onClick={handlePrevStep}
              disabled={(activeStepIndex ?? 0) <= 0}
              title="Previous Waypoint"
            >
              <SkipBack size={15} />
              <span>Previous</span>
            </button>

            <button
              type="button"
              className={`sim-play-btn ${isPlayingSimulation ? 'is-playing' : ''}`}
              onClick={() => {
                if ((activeStepIndex ?? 0) >= route.steps.length - 1) {
                  onSelectStep?.(0);
                }
                setIsPlayingSimulation((prev) => !prev);
              }}
              title={isPlayingSimulation ? 'Pause Walk' : 'Auto Play Walk Simulation'}
            >
              {isPlayingSimulation ? <Pause size={16} /> : <Play size={16} />}
              <span>{isPlayingSimulation ? 'Pause Simulation' : 'Simulate Walk'}</span>
            </button>

            <button
              type="button"
              className="sim-ctrl-btn"
              onClick={handleNextStep}
              disabled={(activeStepIndex ?? 0) >= route.steps.length - 1}
              title="Next Waypoint"
            >
              <span>Next</span>
              <SkipForward size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Step-by-Step Directions List */}
      {route && route.steps.length > 0 && (
        <div className="nav-steps-list">
          <div className="nav-steps-heading">
            <strong>Turn-by-Turn Waypoint Guidance:</strong>
            <span className="click-hint">Click any step to inspect on map</span>
          </div>
          <ol>
            {route.steps.map((step, idx) => {
              const isStepActive = (activeStepIndex ?? 0) === idx;
              return (
                <li
                  key={`step-${idx}`}
                  className={`nav-step-item ${isStepActive ? 'is-active-step' : ''} ${
                    step.turnType === 'arrive' ? 'dest-step' : ''
                  }`}
                  onClick={() => {
                    onSelectStep?.(idx);
                    setIsPlayingSimulation(false);
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <span className="step-num">{idx + 1}</span>
                  <div className="step-details-col">
                    <div className="step-corridor-row">
                      <span className="step-width-badge">{step.aisleWidth}</span>
                      <span className="step-aisle-label">{step.aisleName}</span>
                    </div>
                    <span className="step-text">{step.instruction}</span>
                  </div>
                  {step.distanceM > 0 && (
                    <span className="step-dist-badge">{step.distanceM}m</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {/* Bottom Mobile QR / Action Buttons */}
      <div className="nav-action-buttons">
        <button
          type="button"
          className="google-maps-view-btn"
          onClick={() => {
            const mapEl = document.getElementById('map-view');
            if (mapEl) {
              mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }}
          title="Jump to live Google Maps simulation on the map"
        >
          <Navigation2 size={16} />
          <span>Follow on Google Maps View</span>
        </button>

        <button
          type="button"
          className="qr-generate-button"
          onClick={handleGenerateQr}
          disabled={generatingQr}
        >
          <QrCode size={16} />
          <span>{generatingQr ? 'Generating QR...' : 'Open on Mobile (QR Code)'}</span>
        </button>

        <button
          type="button"
          className="clear-route-button"
          onClick={onClear}
        >
          <span>Clear Route</span>
        </button>
      </div>

      {/* QR Code Modal */}
      {showQrModal && qrBlobUrl && (
        <div className="qr-modal-backdrop" onClick={() => setShowQrModal(false)}>
          <div className="qr-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="qr-modal-header">
              <h4>Scan to Navigate on Mobile Phone</h4>
              <button
                type="button"
                className="close-icon-btn"
                onClick={() => setShowQrModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="qr-image-frame">
              <img
                src={qrBlobUrl}
                alt={`QR code to navigate to ${exhibitor.companyName}`}
              />
            </div>

            <div className="qr-modal-info">
              <strong>{exhibitor.companyName}</strong>
              <span>Stalls {exhibitor.stallsFormatted} · {exhibitor.hall}</span>
              <p>
                Point your smartphone camera at this QR code to load the layout map and turn-by-turn
                corridor directions directly on your device.
              </p>
            </div>

            <div className="qr-modal-actions">
              <a
                href={qrBlobUrl}
                download={`IRC-Expo-${exhibitor.stalls[0] || 'destination'}-QR.png`}
                className="qr-download-link"
                target="_blank"
                rel="noreferrer"
              >
                <Download size={15} />
                <span>Save QR Image</span>
              </a>
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setShowQrModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
