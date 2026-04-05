import { useEffect, useState, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix Leaflet default icon issue with Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ── Custom icons ───────────────────────────────────────────────────────────────
const volunteerIcon = new L.Icon({
  iconUrl:     'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl:   'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})
const destinationIcon = new L.Icon({
  iconUrl:     'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl:   'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:    [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
})

// ── Haversine fallback distance (straight-line) in km ─────────────────────────
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Auto-pan when volunteer moves ─────────────────────────────────────────────
function AutoPan({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.flyTo(center, map.getZoom(), { animate: true, duration: 1 })
  }, [center, map])
  return null
}

// ── OSRM Route fetcher (no npm package needed — raw API call) ─────────────────
function OSRMRoute({ from, to, onRouteFound }) {
  const [routeCoords, setRouteCoords] = useState(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!from || !to) return

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const [fLat, fLng] = from
    const [tLat, tLng] = to

    // OSRM public routing API — lng,lat order in URL
    const url = `https://router.project-osrm.org/route/v1/driving/${fLng},${fLat};${tLng},${tLat}?overview=full&geometries=geojson`

    fetch(url, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        const route = data.routes?.[0]
        if (!route) return

        // GeoJSON coords are [lng, lat] — convert to [lat, lng] for Leaflet
        const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
        setRouteCoords(coords)

        if (onRouteFound) {
          onRouteFound({
            totalDistance: route.distance,   // metres
            totalTime:     route.duration,   // seconds
          })
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') console.warn('OSRM routing error:', err)
      })

    return () => controller.abort()
  }, [from?.[0], from?.[1], to?.[0], to?.[1]])  // eslint-disable-line

  if (!routeCoords) return null

  return (
    <>
      {/* Road-coloured route line */}
      <Polyline
        positions={routeCoords}
        pathOptions={{ color: '#3b82f6', weight: 5, opacity: 0.85 }}
      />
      {/* Inner white dashed guide */}
      <Polyline
        positions={routeCoords}
        pathOptions={{ color: '#ffffff', weight: 2, opacity: 0.3, dashArray: '1 10' }}
      />
    </>
  )
}

// ── Main TrackingMap component ─────────────────────────────────────────────────
/**
 * Props:
 *   volunteerPos    { lat, lng }  — live volunteer GPS (can be null)
 *   destinationPos  { lat, lng }  — rescue site (static)
 *   volunteerName   string
 *   destinationLabel string
 *   height          string        CSS height, default '320px'
 */
export default function TrackingMap({
  volunteerPos,
  destinationPos,
  volunteerName    = 'Volunteer',
  destinationLabel = 'Rescue Site',
  height           = '320px',
}) {
  const [routeSummary, setRouteSummary] = useState(null)

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

  // Real road distance from OSRM, or straight-line fallback while loading
  const distanceKm = routeSummary
    ? routeSummary.totalDistance / 1000
    : volunteerPos
      ? haversineKm(volunteerPos.lat, volunteerPos.lng, destinationPos.lat, destinationPos.lng)
      : null

  // Real driving time from OSRM, or speed-based fallback
  const etaMinutes = routeSummary
    ? Math.ceil(routeSummary.totalTime / 60)
    : distanceKm != null
      ? Math.ceil((distanceKm / 30) * 60)
      : null

  const routeFrom = volunteerPos   ? [volunteerPos.lat,   volunteerPos.lng]   : null
  const routeTo   = destinationPos ? [destinationPos.lat, destinationPos.lng] : null

  return (
    <div className="rounded-xl overflow-hidden border border-slate-700/50 relative" style={{ height }}>

      {/* ── Info overlay ── */}
      <div className="absolute top-2 left-2 z-[1000] flex gap-2 flex-wrap pointer-events-none">
        {distanceKm != null && (
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium text-white shadow-lg">
            {routeSummary ? '🛣' : '📏'}{' '}
            {distanceKm < 1
              ? `${Math.round(distanceKm * 1000)} m`
              : `${distanceKm.toFixed(1)} km`}
            {routeSummary && <span className="ml-1 text-slate-400">(road)</span>}
          </div>
        )}
        {etaMinutes != null && (
          <div className="bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-400 shadow-lg">
            ⏱ ETA ~{etaMinutes < 60
              ? `${etaMinutes} min`
              : `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}m`}
          </div>
        )}
        {!volunteerPos && (
          <div className="bg-slate-900/90 backdrop-blur-sm border border-amber-700/50 rounded-lg px-3 py-1.5 text-xs font-medium text-amber-400 shadow-lg">
            ⏳ Waiting for volunteer GPS…
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

        {/* Blue volunteer marker (live) */}
        {volunteerPos && (
          <Marker position={[volunteerPos.lat, volunteerPos.lng]} icon={volunteerIcon}>
            <Popup>
              <div className="text-sm font-semibold">🔵 {volunteerName}</div>
              <div className="text-xs text-gray-500">Live location</div>
            </Popup>
          </Marker>
        )}

        {/* Red destination marker (static) */}
        <Marker position={[destinationPos.lat, destinationPos.lng]} icon={destinationIcon}>
          <Popup>
            <div className="text-sm font-semibold">🔴 {destinationLabel}</div>
            <div className="text-xs text-gray-500">Rescue site</div>
          </Popup>
        </Marker>

        {/* Road route via OSRM fetch (no npm package needed) */}
        {routeFrom && routeTo && (
          <OSRMRoute from={routeFrom} to={routeTo} onRouteFound={setRouteSummary} />
        )}

        {/* Auto-pan to follow volunteer */}
        {volunteerPos && <AutoPan center={[volunteerPos.lat, volunteerPos.lng]} />}
      </MapContainer>
    </div>
  )
}
