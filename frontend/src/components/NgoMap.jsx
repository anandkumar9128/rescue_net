import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

// ── Fix Leaflet Default Icon Issue ─────────────────────────────────────────
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const criticalIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const defaultIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
});

const NEED_ICONS = { Medical: '🏥', Food: '🍱', Rescue: '🚁', Shelter: '🏠' };

// ── Heatmap Layer (uses leaflet.heat directly via useMap) ──────────────────
function HeatLayer({ points }) {
  const map = useMap();
  const heatRef = useRef(null);

  useEffect(() => {
    if (!map || !points || points.length === 0) {
      if (heatRef.current) {
        map.removeLayer(heatRef.current);
        heatRef.current = null;
      }
      return;
    }

    // Build heatmap data: [lat, lng, intensity]
    const heatData = points
      .filter(c => c.location?.lat && c.location?.lng)
      .map(c => [
        c.location.lat,
        c.location.lng,
        (c.priority_score || 1) * 10,
      ]);

    // Remove old layer if it exists
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
    }

    // Create new heat layer
    heatRef.current = L.heatLayer(heatData, {
      radius: 35,
      blur: 25,
      maxZoom: 17,
      max: 100,
      gradient: {
        0.2: '#2563eb',
        0.4: '#7c3aed',
        0.6: '#f59e0b',
        0.8: '#f97316',
        1.0: '#ef4444',
      },
    }).addTo(map);

    return () => {
      if (heatRef.current) {
        map.removeLayer(heatRef.current);
      }
    };
  }, [map, points]);

  return null;
}

// ── Auto-fit bounds to show all clusters ───────────────────────────────────
function AutoBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points || points.length === 0) return;

    const valid = points.filter(c => c.location?.lat && c.location?.lng);
    if (valid.length === 0) return;

    const bounds = L.latLngBounds(
      valid.map(c => [c.location.lat, c.location.lng])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [map, points]);

  return null;
}

// ── Main NgoMap Component ──────────────────────────────────────────────────
export default function NgoMap({ clusters, onAssign }) {
  if (!clusters || clusters.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center bg-slate-900/80 rounded-xl border border-slate-800 text-slate-500 h-[400px] gap-3">
        <span className="text-4xl">🗺</span>
        <span className="text-sm">No active hotspot zones detected</span>
        <span className="text-xs text-slate-600">Incoming SOS requests will appear here in real-time</span>
      </div>
    );
  }

  // Find the highest-priority cluster
  const maxCluster = clusters.reduce(
    (a, b) => ((a.priority_score || 0) > (b.priority_score || 0) ? a : b),
    clusters[0]
  );

  // Default center
  const centerLat = clusters[0]?.location?.lat || 28.6139;
  const centerLng = clusters[0]?.location?.lng || 77.209;

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl shadow-brand-500/10 border border-slate-700/60 relative">
      {/* Legend overlay */}
      <div className="absolute top-3 right-3 z-[1000] bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-2 pointer-events-none">
        <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-1">Intensity</div>
        <div className="flex items-center gap-1">
          <div className="w-16 h-2 rounded-full" style={{ background: 'linear-gradient(to right, #2563eb, #7c3aed, #f59e0b, #f97316, #ef4444)' }} />
        </div>
        <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
          <span>Low</span>
          <span>Critical</span>
        </div>
      </div>

      {/* Cluster count badge */}
      <div className="absolute top-3 left-3 z-[1000] bg-brand-500/20 backdrop-blur-sm border border-brand-500/40 rounded-lg px-3 py-1.5 pointer-events-none">
        <span className="text-brand-400 text-xs font-bold">{clusters.length} Active Zone{clusters.length !== 1 ? 's' : ''}</span>
      </div>

      <MapContainer
        center={[centerLat, centerLng]}
        zoom={12}
        style={{ height: "500px", width: "100%", zIndex: 10 }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />

        {/* 🔥 Heatmap via leaflet.heat */}
        <HeatLayer points={clusters} />

        {/* Auto-fit map to show all clusters */}
        <AutoBounds points={clusters} />

        {/* 📍 Cluster markers with popups */}
        {clusters.map((c) => {
          if (!c.location?.lat || !c.location?.lng) return null;
          const isCritical = c._id === maxCluster?._id;

          return (
            <Marker
              key={c._id}
              position={[c.location.lat, c.location.lng]}
              icon={isCritical ? criticalIcon : defaultIcon}
            >
              <Popup>
                <div style={{ minWidth: '180px', padding: '4px' }}>
                  {isCritical && (
                    <div style={{
                      background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.5)',
                      color: '#dc2626',
                      fontSize: '11px',
                      textAlign: 'center',
                      fontWeight: 'bold',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      marginBottom: '8px',
                    }}>
                      🔥 CRITICAL ZONE
                    </div>
                  )}
                  <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px', color: '#1e293b' }}>
                    {NEED_ICONS[c.need_type] || '📍'} {c.need_type} Alert
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.6' }}>
                    👥 Affected: <strong>{c.total_people}</strong><br />
                    ⚠️ Severity: <strong>{c.max_severity}</strong><br />
                    🎯 Priority: <strong>{c.priority_score?.toFixed(1)}</strong>
                  </div>
                  <button
                    onClick={() => onAssign(c._id)}
                    style={{
                      marginTop: '10px',
                      width: '100%',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: 'white',
                      fontWeight: '600',
                      fontSize: '12px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      letterSpacing: '0.5px',
                    }}
                  >
                    ⚡ Dispatch Team
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
