
import { useState } from 'react'
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Map,
  LayoutGrid,
  Info,
  Maximize2,
} from 'lucide-react'

type LayoutTab = 'venue' | 'stalls'

const LAYOUTS = {
  stalls: {
    image: '/exhibition-venue-layout.svg',
    alt: 'CAD-derived exhibition stall layout for the 85th Indian Roads Congress',
    title: 'Exhibition Stall Layout',
  },
  venue: {
    image: '/layouts/venue-overview-reference.png',
    alt: 'Venue overview showing exhibition halls and supporting facilities',
    title: 'Venue Overview',
  },
}

export default function VenueLayouts() {
  const [tab, setTab] = useState<LayoutTab>('stalls')
  const [zoom, setZoom] = useState(1)
  const [showInfo, setShowInfo] = useState(true)

  const activeLayout = LAYOUTS[tab]

  function changeTab(next: LayoutTab) {
    setTab(next)
    setZoom(1)
  }

  function zoomIn() {
    setZoom((value) => Math.min(4, +(value + 0.2).toFixed(2)))
  }

  function zoomOut() {
    setZoom((value) => Math.max(0.5, +(value - 0.2).toFixed(2)))
  }

  function resetZoom() {
    setZoom(1)
  }

  function openFullLayout() {
    window.open(activeLayout.image, '_blank', 'noopener,noreferrer')
  }

  return (
    <section className="venue-layout-section" id="venue-layouts">

      {/* Section heading */}
      <div className="section-heading">
        <div>
          <div className="eyebrow">OFFICIAL VENUE REFERENCE</div>
          <h2>Explore the exhibition layouts</h2>
          <p>
            Explore the supplied exhibition CAD drawing and venue overview.
            Zoom in to inspect the layout details.
          </p>
        </div>

        <span className="sample-tag source-tag">
          CAD-DERIVED LAYOUT
        </span>
      </div>

      {/* Layout toolbar */}
      <div className="layout-toolbar">

        <div
          className="layout-tabs"
          role="tablist"
          aria-label="Exhibition layout"
        >
          <button
            className={tab === 'stalls' ? 'selected' : ''}
            onClick={() => changeTab('stalls')}
            role="tab"
            aria-selected={tab === 'stalls'}
          >
            <LayoutGrid size={16} />
            Stall layout
          </button>

          <button
            className={tab === 'venue' ? 'selected' : ''}
            onClick={() => changeTab('venue')}
            role="tab"
            aria-selected={tab === 'venue'}
          >
            <Map size={16} />
            Venue overview
          </button>
        </div>

        {/* Zoom controls */}
        <div className="zoom-controls">

          <button
            type="button"
            aria-label="Zoom out"
            onClick={zoomOut}
            disabled={zoom <= 0.5}
          >
            <ZoomOut size={17} />
          </button>

          <span>{Math.round(zoom * 100)}%</span>

          <button
            type="button"
            aria-label="Zoom in"
            onClick={zoomIn}
            disabled={zoom >= 4}
          >
            <ZoomIn size={17} />
          </button>

          <button
            type="button"
            aria-label="Reset zoom"
            onClick={resetZoom}
          >
            <RotateCcw size={15} />
          </button>

          <button
            type="button"
            aria-label="Open full layout"
            title="Open full layout in new tab"
            onClick={openFullLayout}
          >
            <Maximize2 size={15} />
          </button>

        </div>
      </div>

      {/* Layout viewer */}
      <div
        className="layout-image-frame"
        aria-label={activeLayout.title}
      >
        <div
          className="layout-image-inner"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
          }}
        >
          <img
            key={activeLayout.image}
            src={activeLayout.image}
            alt={activeLayout.alt}
            draggable={false}
            onError={(event) => {
              event.currentTarget.style.opacity = '0.25'
            }}
          />
        </div>
      </div>

      {/* Layout information */}
      {tab === 'stalls' ? (
        <div className="layout-facts">
          <div>
            <strong>341</strong>
            <span>Current confirmed stall total</span>
          </div>

          <div>
            <strong>—</strong>
            <span>Platinum · revised register pending</span>
          </div>

          <div>
            <strong>—</strong>
            <span>Gold · revised register pending</span>
          </div>

          <div>
            <strong>—</strong>
            <span>Silver · revised register pending</span>
          </div>

          <div>
            <strong>18m × 6m</strong>
            <span>Theme Pavilion · Ramappa Temple</span>
          </div>
        </div>
      ) : (
        <div className="layout-facts venue-facts">
          <div>
            <strong>8B</strong>
            <span>Hangar · 50m × 70m</span>
          </div>

          <div>
            <strong>8A</strong>
            <span>Hall · 48m × 72m</span>
          </div>

          <div>
            <strong>17</strong>
            <span>Store · 50m × 30m</span>
          </div>

          <div>
            <strong>14A</strong>
            <span>Kitchen Area-1 · 9m × 50m</span>
          </div>

          <div>
            <strong>20m × 5m</strong>
            <span>Toilet block · M/F</span>
          </div>
        </div>
      )}

      {/* Layout notes */}
      <button
        type="button"
        className="layout-info-toggle"
        onClick={() => setShowInfo((value) => !value)}
        aria-expanded={showInfo}
      >
        <Info size={15} />
        {showInfo ? 'Hide' : 'Show'} layout notes
      </button>

      {showInfo && (
        <p className="layout-source-note">
          The stall layout displayed above is derived from the supplied
          Exhibition Venue Layout CAD drawing. The currently confirmed
          exhibition total is 341 stalls. Individual booth identification,
          exhibitor allocation, availability status, entrance orientation
          and navigation routes must be verified against the latest
          approved stall allocation plan before being treated as live data.

          The venue overview is retained as a separate reference image.
        </p>
      )}

    </section>
  )
}
