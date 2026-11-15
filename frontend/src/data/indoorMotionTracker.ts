// Real-time Indoor Motion Tracking & Sensor Fusion Engine
// Supports Android Mobile Browsers, Device Motion (Pedometer/Step Detection),
// Device Orientation (Compass), HTML5 Geolocation, and QR Checkpoint Re-anchoring.
// Strictly NO automated timer simulations on Kiosk or Mobile.

import { VENUE_NODES, type RoutePath, type NavNode } from './venueGraph';
import { type QRCheckpoint } from './indoorPositioning';

export type TrackingMode = 'sensors_step_detector' | 'gps' | 'qr_checkpoint' | 'manual';

export type MotionTrackerState = {
  isActive: boolean;
  isSupported: boolean;
  trackingMode: TrackingMode;
  stepCount: number;
  walkedMeters: number;
  currentCoords: { x: number; y: number };
  headingDeg: number | null;
  accuracyMeters: number | null;
  lastCheckpoint: QRCheckpoint | null;
  statusMessage: string;
};

// Hitex Hyderabad Venue GPS Bounding Box calibration
// Hall-1 and Hanger pavilion boundaries
const VENUE_GPS_BOUNDS = {
  latNorth: 17.47365,
  latSouth: 17.47195,
  lngWest: 78.37190,
  lngEast: 78.37460,
  svgMinX: 65,
  svgMaxX: 1530,
  svgMinY: 65,
  svgMaxY: 830,
};

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;
  const isMobileUa = mobileRegex.test(ua);
  const isSmallScreen = window.innerWidth <= 840;
  const hasTouch = 'ontouchstart' in window || (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
  return isMobileUa || (isSmallScreen && Boolean(hasTouch));
}

export function isKioskMode(): boolean {
  if (typeof window === 'undefined') return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get('kiosk')) return true;
  if (params.get('mode') === 'kiosk') return true;
  if (params.get('checkpoint') || params.get('cp')) return false;
  return !isMobileDevice();
}

/**
 * Projects real GPS coordinates (WGS84 lat, lng) to the floor SVG coordinate space
 */
export function gpsToSvgCoords(lat: number, lng: number): { x: number; y: number } | null {
  const { latNorth, latSouth, lngWest, lngEast, svgMinX, svgMaxX, svgMinY, svgMaxY } =
    VENUE_GPS_BOUNDS;

  // Check if within reasonable proximity of Hitex Hyderabad venue
  if (lat < latSouth - 0.005 || lat > latNorth + 0.005 || lng < lngWest - 0.005 || lng > lngEast + 0.005) {
    return null;
  }

  const clampedLat = Math.max(latSouth, Math.min(latNorth, lat));
  const clampedLng = Math.max(lngWest, Math.min(lngEast, lng));

  const ratioY = (latNorth - clampedLat) / (latNorth - latSouth);
  const ratioX = (clampedLng - lngWest) / (lngEast - lngWest);

  const x = svgMinX + ratioX * (svgMaxX - svgMinX);
  const y = svgMinY + ratioY * (svgMaxY - svgMinY);

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * Finds the nearest walkable aisle node to any arbitrary (x, y) coordinates
 */
export function findNearestAisleNode(x: number, y: number): NavNode {
  let closest: NavNode = Object.values(VENUE_NODES)[0];
  let minDist = Infinity;

  for (const node of Object.values(VENUE_NODES)) {
    const d = Math.hypot(node.x - x, node.y - y);
    if (d < minDist) {
      minDist = d;
      closest = node;
    }
  }

  return closest;
}

export type MotionCallbacks = {
  onPositionUpdate: (coords: { x: number; y: number }, walkedM: number, mode: TrackingMode) => void;
  onHeadingUpdate: (headingDeg: number) => void;
  onStepDetected?: (stepNumber: number, stepStrideM: number) => void;
  onRerouteNeeded: (fromNodeId: string) => void;
  onArrival: () => void;
  onStatusChange: (status: string) => void;
};

export class IndoorMotionTracker {
  private active = false;
  private callbacks: MotionCallbacks;
  private currentCoords: { x: number; y: number };
  private currentHeading: number | null = null;
  private stepCount = 0;
  private walkedMeters = 0;
  private activeRoute: RoutePath | null = null;
  private destinationNodeId: string | null = null;

  // Sensor listeners references
  private motionListener: ((e: DeviceMotionEvent) => void) | null = null;
  private orientationListener: ((e: DeviceOrientationEvent) => void) | null = null;
  private geoWatchId: number | null = null;

  // Step detection filter states
  private lastStepTimestamp = 0;
  private accelFilterPrev = 9.8;
  private isStepWaveHigh = false;
  private readonly STRIDE_LENGTH_M = 0.72; // Average indoor walking stride
  private readonly STEP_PEAK_THRESHOLD = 1.35; // Dynamic acceleration peak (m/s^2)
  private readonly MIN_STEP_CADENCE_MS = 290; // Human walking step cadence limit

  constructor(initialCoords: { x: number; y: number }, callbacks: MotionCallbacks) {
    this.currentCoords = { ...initialCoords };
    this.callbacks = callbacks;
  }

  public setRoute(route: RoutePath | null, destNodeId: string | null) {
    this.activeRoute = route;
    this.destinationNodeId = destNodeId;
  }

  public setInitialAnchor(coords: { x: number; y: number }, checkpoint?: QRCheckpoint) {
    this.currentCoords = { ...coords };
    this.stepCount = 0;
    this.walkedMeters = 0;
    const msg = checkpoint
      ? `Anchored at ${checkpoint.code} — ${checkpoint.label}`
      : 'Initial position anchored';
    this.callbacks.onStatusChange(msg);
    this.callbacks.onPositionUpdate(this.currentCoords, this.walkedMeters, 'qr_checkpoint');
  }

  public advanceManualStep(strideM = 0.75) {
    if (!this.activeRoute || this.activeRoute.nodes.length <= 1) return;
    this.stepCount++;
    this.walkedMeters = Math.min(this.activeRoute.distanceMeters, this.walkedMeters + strideM);
    this.handleStepAdvance(strideM);
  }

  public start() {
    if (this.active) return;
    this.active = true;

    // Check if running on mobile device with sensors
    const mobile = isMobileDevice();
    if (!mobile) {
      this.callbacks.onStatusChange('Desktop/Kiosk display (Static reference map)');
      return;
    }

    this.callbacks.onStatusChange('Activating phone movement sensors & GPS...');

    // 1. Device Orientation (Compass Heading)
    this.initCompassHeading();

    // 2. Device Motion (Accelerometer Pedometer Step Counter)
    this.initAccelerometerPedometer();

    // 3. HTML5 Geolocation (Hardware GPS / Wi-Fi Assisted Positioning)
    this.initGeolocationWatch();
  }

  public stop() {
    this.active = false;

    if (this.motionListener && typeof window !== 'undefined') {
      window.removeEventListener('devicemotion', this.motionListener);
      this.motionListener = null;
    }

    if (this.orientationListener && typeof window !== 'undefined') {
      window.removeEventListener('deviceorientation', this.orientationListener);
      window.removeEventListener('deviceorientationabsolute', this.orientationListener);
      this.orientationListener = null;
    }

    if (this.geoWatchId !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.geoWatchId);
      this.geoWatchId = null;
    }

    this.callbacks.onStatusChange('Live phone tracking stopped');
  }

  private initCompassHeading() {
    if (typeof window === 'undefined') return;

    this.orientationListener = (e: DeviceOrientationEvent) => {
      let heading: number | null = null;

      // iOS WebKit compass heading
      if ('webkitCompassHeading' in e && typeof (e as unknown as { webkitCompassHeading: number }).webkitCompassHeading === 'number') {
        heading = (e as unknown as { webkitCompassHeading: number }).webkitCompassHeading;
      } else if (e.alpha !== null && e.alpha !== undefined) {
        // Android DeviceOrientationEvent absolute heading
        heading = 360 - e.alpha;
      }

      if (heading !== null && !isNaN(heading)) {
        this.currentHeading = Math.round(heading);
        this.callbacks.onHeadingUpdate(this.currentHeading);
      }
    };

    if ('ondeviceorientationabsolute' in window) {
      (window as any).addEventListener('deviceorientationabsolute', this.orientationListener, { passive: true });
    } else if ('ondeviceorientation' in window) {
      (window as any).addEventListener('deviceorientation', this.orientationListener, { passive: true });
    }
  }

  private initAccelerometerPedometer() {
    if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) return;

    this.motionListener = (e: DeviceMotionEvent) => {
      if (!this.active) return;

      const acc = e.acceleration || e.accelerationIncludingGravity;
      if (!acc) return;

      const ax = acc.x || 0;
      const ay = acc.y || 0;
      const az = acc.z || 0;

      // Compute total acceleration magnitude
      const mag = Math.sqrt(ax * ax + ay * ay + az * az);

      // Low-pass exponential moving average to filter sensor noise
      const filtered = 0.8 * this.accelFilterPrev + 0.2 * mag;
      const delta = Math.abs(mag - filtered);
      this.accelFilterPrev = filtered;

      const now = performance.now();

      // Step peak detection logic:
      // A step occurs when dynamic acceleration rises above the threshold and then drops
      if (delta > this.STEP_PEAK_THRESHOLD && !this.isStepWaveHigh) {
        if (now - this.lastStepTimestamp > this.MIN_STEP_CADENCE_MS) {
          this.isStepWaveHigh = true;
          this.lastStepTimestamp = now;
          this.stepCount += 1;
          this.walkedMeters += this.STRIDE_LENGTH_M;

          this.handleStepAdvance(this.STRIDE_LENGTH_M);
          this.callbacks.onStepDetected?.(this.stepCount, this.STRIDE_LENGTH_M);
        }
      } else if (delta < this.STEP_PEAK_THRESHOLD * 0.6) {
        this.isStepWaveHigh = false;
      }
    };

    window.addEventListener('devicemotion', this.motionListener, { passive: true });
  }

  private initGeolocationWatch() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    try {
      this.geoWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!this.active) return;
          const { latitude, longitude, accuracy } = pos.coords;
          const svgCoords = gpsToSvgCoords(latitude, longitude);

          if (svgCoords) {
            // If GPS accuracy is within reasonable venue tolerance (< 20 meters), snap to venue aisle
            if (accuracy <= 22) {
              const nearest = findNearestAisleNode(svgCoords.x, svgCoords.y);
              this.currentCoords = { x: nearest.x, y: nearest.y };
              this.callbacks.onPositionUpdate(this.currentCoords, this.walkedMeters, 'gps');
              this.callbacks.onStatusChange(`GPS Position Fix (Accuracy: ±${Math.round(accuracy)}m)`);
              this.checkRouteDeviationOrArrival();
            } else {
              this.callbacks.onStatusChange(`Indoor Step Sensors Active (GPS Degraded: ±${Math.round(accuracy)}m)`);
            }
          }
        },
        () => {
          // Fallback to step detection inside exhibition halls (expected due to metal roofs)
          this.callbacks.onStatusChange('Indoor Step Detection Active (No GPS indoors)');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 1000,
          timeout: 8000,
        }
      );
    } catch {
      // Ignore permission or browser restrictions
    }
  }

  /**
   * Advances the user along the active walkable route when a physical step is detected
   */
  private handleStepAdvance(strideM: number) {
    void strideM;
    if (!this.activeRoute || this.activeRoute.nodes.length <= 1) return;

    const nodes = this.activeRoute.nodes;
    const totalDist = this.activeRoute.distanceMeters;

    if (totalDist <= 0) return;

    // Convert walked meters to SVG interpolation
    // Calculate cumulative SVG distance along the route polyline
    let targetSvgDist = 0;
    const segmentLengths: number[] = [];
    let totalSvgLen = 0;

    for (let i = 0; i < nodes.length - 1; i++) {
      const len = Math.hypot(nodes[i + 1].x - nodes[i].x, nodes[i + 1].y - nodes[i].y);
      segmentLengths.push(len);
      totalSvgLen += len;
    }

    const ratio = Math.min(1.0, this.walkedMeters / totalDist);
    targetSvgDist = ratio * totalSvgLen;

    let accumulated = 0;
    let newX = nodes[0].x;
    let newY = nodes[0].y;

    for (let i = 0; i < segmentLengths.length; i++) {
      const segLen = segmentLengths[i];
      if (accumulated + segLen >= targetSvgDist) {
        const segAlpha = (targetSvgDist - accumulated) / segLen;
        newX = nodes[i].x + segAlpha * (nodes[i + 1].x - nodes[i].x);
        newY = nodes[i].y + segAlpha * (nodes[i + 1].y - nodes[i].y);
        break;
      }
      accumulated += segLen;
      if (i === segmentLengths.length - 1) {
        newX = nodes[nodes.length - 1].x;
        newY = nodes[nodes.length - 1].y;
      }
    }

    this.currentCoords = { x: Math.round(newX), y: Math.round(newY) };
    this.callbacks.onPositionUpdate(this.currentCoords, this.walkedMeters, 'sensors_step_detector');
    this.callbacks.onStatusChange(
      `Walking: Step ${this.stepCount} (${this.walkedMeters.toFixed(1)}m) · ${Math.max(
        0,
        Math.round(totalDist - this.walkedMeters)
      )}m remaining`
    );

    this.checkRouteDeviationOrArrival();
  }

  private checkRouteDeviationOrArrival() {
    if (!this.activeRoute || this.activeRoute.nodes.length === 0) return;

    const destNode = this.activeRoute.nodes[this.activeRoute.nodes.length - 1];
    const distToDest = Math.hypot(destNode.x - this.currentCoords.x, destNode.y - this.currentCoords.y);

    // Approximate SVG units to meters (~0.1m per SVG unit)
    const metersToDest = distToDest * 0.1;

    // Arrival detection: within 4 meters of destination
    if (metersToDest <= 4.0 || this.walkedMeters >= this.activeRoute.distanceMeters - 1) {
      this.callbacks.onArrival();
      this.callbacks.onStatusChange('You have arrived at your destination!');
      return;
    }

    // Check deviation: find nearest node
    const nearest = findNearestAisleNode(this.currentCoords.x, this.currentCoords.y);
    const isOnCurrentRoute = this.activeRoute.nodes.some((n) => n.id === nearest.id);

    // If user moved onto a different corridor or deviated significantly (> 12m), re-route
    const distToRoute = Math.hypot(nearest.x - this.currentCoords.x, nearest.y - this.currentCoords.y) * 0.1;
    if (!isOnCurrentRoute && distToRoute > 10.0 && this.destinationNodeId) {
      this.callbacks.onStatusChange('Off planned walkway — recalculating shortest route...');
      this.callbacks.onRerouteNeeded(nearest.id);
    }
  }
}
