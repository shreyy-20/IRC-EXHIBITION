
import { useRef, useState } from 'react'
import type { PointerEvent, WheelEvent } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react'

import type {
  Booth,
  NavigationNode,
  RouteResult,
} from '../types'

type Props = {
  booths: Booth[]
  selectedId: string | null
  onSelect: (booth: Booth) => void
  nodes: NavigationNode[]
  route: RouteResult | null
}

type ViewBox = {
  x: number
  y: number
  width: number
  height: number
}

// The CAD drawing has an aspect ratio of approximately 1.446.
// This viewBox preserves that proportion.
const INITIAL_VIEW: ViewBox = {
  x: 0,
  y: 0,
  width: 1200,
  height: 830,
}

const MIN_ZOOM = 0.7
const MAX_ZOOM = 5

const CAD_LAYOUT = '/exhibition-venue-layout.svg'

export default function FloorMap({
  booths,
  selectedId,
  onSelect,
  nodes,
  route,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  const [view, setView] = useState<ViewBox>(INITIAL_VIEW)
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)

  const dragRef = useRef<{
    x: number
    y: number
    viewX: number
    viewY: number
  } | null>(null)

  function changeZoom(direction: number) {
    setView((current) => {
      const factor = direction > 0 ? 0.8 : 1.25

      const width = current.width * factor
      const height = current.height * factor

      const nextZoom = INITIAL_VIEW.width / width

      if (nextZoom < MIN_ZOOM || nextZoom > MAX_ZOOM) {
        return current
      }

      setZoom(nextZoom)

      return {
        x: current.x + (current.width - width) / 2,
        y: current.y + (current.height - height) / 2,
        width,
        height,
      }
    })
  }

  function resetMap() {
    setView(INITIAL_VIEW)
    setZoom(1)
  }

  function handleWheel(event: WheelEvent<SVGSVGElement>) {
    event.preventDefault()

    const svg = svgRef.current
    if (!svg) return

    const rect = svg.getBoundingClientRect()

    const pointerX =
      ((event.clientX - rect.left) / rect.width) * view.width +
      view.x

    const pointerY =
      ((event.clientY - rect.top) / rect.height) * view.height +
      view.y

    const factor = event.deltaY < 0 ? 0.85 : 1.18

    const width = view.width * factor
    const height = view.height * factor

    const nextZoom = INITIAL_VIEW.width / width

    if (nextZoom < MIN_ZOOM || nextZoom > MAX_ZOOM) return

    const ratioX = (pointerX - view.x) / view.width
    const ratioY = (pointerY - view.y) / view.height

    setView({
      x: pointerX - ratioX * width,
      y: pointerY - ratioY * height,
      width,
      height,
    })

    setZoom(nextZoom)
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0) return

    event.currentTarget.setPointerCapture(event.pointerId)

    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      viewX: view.x,
      viewY: view.y,
    }

    setDragging(true)
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (!dragRef.current || !svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()

    const deltaX =
      ((event.clientX - dragRef.current.x) / rect.width) *
      view.width

    const deltaY =
      ((event.clientY - dragRef.current.y) / rect.height) *
      view.height

    setView((current) => ({
      ...current,
      x: dragRef.current!.viewX - deltaX,
      y: dragRef.current!.viewY - deltaY,
    }))
  }

  function handlePointerUp() {
    dragRef.current = null
    setDragging(false)
  }

  return (
    <section className="map-shell">

      {/* Map heading */}
      <div className="map-heading">
        <div>
          <strong>EXHIBITION VENUE</strong>

          <span className="map-subtitle">
            CAD-Based Exhibition Layout
          </span>
        </div>

        <div className="map-legend">
          <span>Actual CAD drawing</span>
        </div>
      </div>

      {/* CAD map viewer */}
      <div className="map-viewport">

        <svg
          ref={svgRef}
          viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="CAD-derived exhibition venue floor plan"
          className={`floor-map ${dragging ? 'is-dragging' : ''}`}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onLostPointerCapture={handlePointerUp}
        >

          {/* Background */}
          <rect
            x="-10000"
            y="-10000"
            width="30000"
            height="30000"
            fill="#ffffff"
          />

          {/* Actual converted CAD drawing */}
          <image
            href={CAD_LAYOUT}
            x="0"
            y="0"
            width="1200"
            height="830"
            preserveAspectRatio="none"
          />

        </svg>

        {/* Map controls */}
        <div className="map-controls">

          <button
            type="button"
            onClick={() => changeZoom(1)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn size={18} />
          </button>

          <button
            type="button"
            onClick={() => changeZoom(-1)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut size={18} />
          </button>

          <button
            type="button"
            onClick={resetMap}
            aria-label="Reset map"
            title="Reset map"
          >
            <RotateCcw size={17} />
          </button>

        </div>

        <div className="zoom-indicator">
          {Math.round(zoom * 100)}%
        </div>

        <div className="map-pan-hint">
          <Move size={13} />
          Scroll to zoom · Drag to move
        </div>

      </div>

      {/* Booth selection */}
      <div className="map-booth-selector">

        <div className="map-booth-heading">
          <strong>Booth directory</strong>

          <span>
            {booths.length} records loaded
          </span>
        </div>

        {booths.length > 0 ? (
          <div className="map-booth-list">
            {booths.map((booth) => (
              <button
                key={booth.id}
                type="button"
                className={
                  selectedId === booth.id
                    ? 'map-booth-chip selected'
                    : 'map-booth-chip'
                }
                onClick={() => onSelect(booth)}
                aria-pressed={selectedId === booth.id}
              >
                {booth.code}
              </button>
            ))}
          </div>
        ) : (
          <p>No booth records are currently available.</p>
        )}

      </div>

      {/* Data accuracy notice */}
      <div className="map-data-notice">
        <strong>CAD reference map</strong>

        <p>
          This map displays the converted exhibition venue drawing.
          Individual booth coordinates, booth allocations, entrance
          locations and navigation routes have not yet been calibrated
          against the approved 341-stall plan.
        </p>

        <p>
          {nodes.length > 0 || route
            ? 'Existing navigation data is not overlaid because its coordinate system has not been verified against this CAD drawing.'
            : 'Navigation overlays will be enabled after coordinate calibration.'}
        </p>
      </div>

    </section>
  )
}
