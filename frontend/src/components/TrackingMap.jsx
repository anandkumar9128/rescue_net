import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'

// Fix Leaflet default icon issue with Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom icons
const volunteerIcon = new L.Icon({
  iconUrl:    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl:  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
  popupAnchor:[1, -34],
})

const destinationIcon = new L.Icon({
  iconUrl:    'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl:  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
  popupAnchor:[1, -34],
})

// Haversine distance in km (used for ETA overlay while route loads)
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R    = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Auto-pan map when volunteer position changes
function AutoPan({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, map.getZoom(), { animate: true, duration: 1 })
  }, [center, map])
  return null
}

/**
 * RoutingControl — uses Leaflet Routing Machine (OSRM) to draw road route.
 * The default turn-by-turn panel is hidden via CSS; only the polyline shows.
 */
function RoutingControl({ from, to }) {
  const map            = useMap()
  const controlRef     = useRef(null)
  const prevFromRef    = useRef(null)
  const prevToRef      = useRef(null)

  useEffect(() => {
    if (!from || !to || !map) return

    // Skip if both positions are the same as last render
    const sameFrom = prevFromRef.current &&
      prevFromRef.current[0] === from[0] && prevFromRef.current[1] === from[1]
    const sameTo   = prevToRef.current &&
      prevToRef.current[0] === to[0]   && prevToRef.current[1] === to[1]
    if (sameFrom && sameTo) return

    prevFromRef.current = from
    prevToRef.current   = to

    // Remove previous control
    if (controlRef.current) {
      try { map.removeControl(controlRef.current) } catch {}
      controlRef.current = null
    }

    // Build new routing control
    const control = L.Routing.control({
      waypoints: [
        L.latLng(from[0], from[1]),
        L.latLng(to[0],   to[1]),
      ],
      router: L.Routing.osrmv1({
        serviceUrl: 'https://router.project-osrm.org/route/v1',
        profile: 'driving',
      }),
      lineOptions: {
        styles: [
          { color: '#3b82f6', weight: 5, opacity: 0.85 },      // blue route line
          { color: '#ffffff', weight: 2, opacity: 0.3, dashArray: '1 10' }, // inner guide
        ],
        extendToWaypoints: true,
        missingRouteTolerance: 10,
      },
      show:              false,   // hide the directions panel
      addWaypoints:      false,   // don't let user add stops
      draggableWaypoints:false,
      fitSelectedRoutes: false,   // we manage the view ourselves
      showAlternatives:  false,
      createMarker:      () => null, // suppress LRM's own markers (we draw ours)
    }).addTo(map)

    controlRef.current = control

    return () => {
      try { map.removeControl(control) } catch {}
    }
  }, [from, to, map])

  return null
}

/**
 * TrackingMap — reusable Leaflet map for volunteer tracking
 *
 * Props:
 *   volunteerPos    { lat, lng }  — live volunteer GPS (can be null)
 *   destinationPos  { lat, lng }  — rescue site location (static)
 *   volunteerName   string        — label for volunteer marker
 *   destinationLabel string       — label for destination marker
 *   height          string        — CSS height (default '320px')
 */
export default function TrackingMap({
  volunteerPos,
  destinationPos,
  volunteerName    = 'Volunteer',
  destinationLabel = 'Rescue Site',
  height           = '320px',
}) {
  if (!destinationPos?.lat || !destinationPos?.lng) {
    return (
      <div
        className="flex items-center justify-center bg-slate-900 rounded-xl text-slate-500 text-sm"
        style={{ height }}
      >
        📍 No location data available
      </div>
    )
  }

  const center = volunteerPos
    ? [volunteerPos.lat, volunteerPos.lng]
    : [destinationPos.lat, destinationPos.lng]

  const distanceKm = volunteerPos
    ? haversineKm(volunteerPos.lat, volunteerPos.lng, destinationPos.lat, destinationPos.lng)
    : null

  const etaMinutes = distanceKm != null
    ? Math.ceil((distanceKm / 30) * 60)
    : null

  // LRM waypoints
  const routeFrom = volunteerPos    ? [volunteerPos.lat,    volunteerPos.lng]    : null
  const routeTo   = destinationPos  ? [destinationPos.lat,  destinationPos.lng]  : null

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/50 relative" style={{ height }}>
      {/* ── Info overlay ── */}
      <div className="absolute top-2 left-2 z-[1000] flex gap-2 flex-wrap">
        {distanceKm != null && (
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-lg">
            📏 {distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`}
          </div>
        )}
        {etaMinutes != null && (
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-400 shadow-lg">
            ⏱ ETA ~{etaMinutes < 60 ? `${etaMinutes} min` : `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`}
          </div>
        )}
        {!volunteerPos && (
          <div className="bg-slate-900/90 backdrop-blur-sm border border-amber-700/50 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-400 shadow-lg">
            ⏳ Waiting for volunteer GPS...
          </div>
        )}
      </div>

      {/* ── Map ── */}
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />

        {/* Volunteer marker — blue, live */}
        {volunteerPos && (
          <Marker position={[volunteerPos.lat, volunteerPos.lng]} icon={volunteerIcon}>
            <Popup>
              <div className="text-sm font-semibold">🔵 {volunteerName}</div>
              <div className="text-xs text-gray-500">Live location</div>
            </Popup>
          </Marker>
        )}

        {/* Destination marker — red, static */}
        <Marker position={[destinationPos.lat, destinationPos.lng]} icon={destinationIcon}>
          <Popup>
            <div className="text-sm font-semibold">🔴 {destinationLabel}</div>
            <div className="text-xs text-gray-500">Rescue site</div>
          </Popup>
        </Marker>

        {/* Road route via LRM — only when both positions are known */}
        {routeFrom && routeTo && (
          <RoutingControl from={routeFrom} to={routeTo} />
        )}

        {/* Auto-pan when volunteer moves */}
        {volunteerPos && <AutoPan center={[volunteerPos.lat, volunteerPos.lng]} />}
      </MapContainer>

      {/* Hide LRM's default turn-by-turn panel & waypoint drag handles */}
      <style>{`
        .leaflet-routing-container { display: none !important; }
        .leaflet-routing-alt       { display: none !important; }
      `}</style>
    </div>
  )
}
