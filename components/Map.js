import { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip as LeafletTooltip,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Hitung jarak Haversine (km / m)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius bumi dalam KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return d; // km
}

function MapController({ data, focusLocation, markerRefs }) {
  const map = useMap();

  useEffect(() => {
    if (focusLocation && focusLocation.latitude && focusLocation.longitude) {
      map.flyTo([focusLocation.latitude, focusLocation.longitude], 16, { animate: true });
      const ref = markerRefs.current[focusLocation.odp_name];
      if (ref) {
        setTimeout(() => {
          ref.openPopup();
        }, 350);
      }
    } else if (data && data.length > 0) {
      const validCoords = data
        .filter((d) => d.latitude && d.longitude)
        .map((d) => [d.latitude, d.longitude]);
      if (validCoords.length > 0) {
        map.fitBounds(validCoords, { padding: [20, 20], maxZoom: 12 });
      }
    }
  }, [data, focusLocation, map, markerRefs]);

  return null;
}

// Event handler klik peta untuk mengukur jarak manual
function MapClickHandler({ measureMode, onMapClick }) {
  useMapEvents({
    click(e) {
      if (measureMode) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
}

export default function Map({ data, focusLocation, manualMeasureLine }) {
  const defaultCenter = [-1.7, 114.8];
  const markerRefs = useRef({});
  const [clickPoints, setClickPoints] = useState([]);
  const [measureActive, setMeasureActive] = useState(false);
  const [clickDistance, setClickDistance] = useState(null);

  const getColor = (status) => {
    const s = (status || '').toUpperCase();
    if (s.includes('RED')) return '#dc2626';
    if (s.includes('ORANGE')) return '#ea580c';
    if (s.includes('YELLOW')) return '#eab308';
    if (s.includes('GREEN')) return '#16a34a';
    return '#111827';
  };

  const handleMapClick = (latlng) => {
    if (clickPoints.length === 0) {
      setClickPoints([latlng]);
      setClickDistance(null);
    } else if (clickPoints.length === 1) {
      const p1 = clickPoints[0];
      const p2 = latlng;
      const dist = calculateDistance(p1[0], p1[1], p2[0], p2[1]);
      setClickPoints([p1, p2]);
      setClickDistance(dist);
    } else {
      setClickPoints([latlng]);
      setClickDistance(null);
    }
  };

  const resetClickMeasure = () => {
    setClickPoints([]);
    setClickDistance(null);
    setMeasureActive(false);
  };

  // Garis yang akan digambar di peta (prioritas: klik peta > input form)
  const activeLine = clickPoints.length === 2 ? clickPoints : manualMeasureLine;

  return (
    <div className="relative w-full h-full">
      {/* Control Floating Measure Klik Peta */}
      <div className="absolute top-2 right-2 z-[1000] flex flex-col items-end gap-1">
        <button
          type="button"
          onClick={() => {
            setMeasureActive(!measureActive);
            if (measureActive) resetClickMeasure();
          }}
          className={`px-2.5 py-1 text-[11px] font-bold rounded shadow border transition ${
            measureActive
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          {measureActive ? '✕ Matikan Penggaris' : '📏 Ukur Klik Peta'}
        </button>

        {measureActive && (
          <div className="bg-white/95 backdrop-blur p-2 rounded shadow border border-slate-300 text-[10px] text-slate-700 max-w-[200px]">
            {clickPoints.length === 0 && <p>Klik titik ke-1 di peta.</p>}
            {clickPoints.length === 1 && <p>Klik titik ke-2 untuk ukur.</p>}
            {clickDistance !== null && (
              <div className="space-y-1">
                <p className="font-extrabold text-blue-700 text-xs">
                  Jarak: {clickDistance >= 1 ? `${clickDistance.toFixed(2)} km` : `${Math.round(clickDistance * 1000)} meter`}
                </p>
                <button
                  type="button"
                  onClick={resetClickMeasure}
                  className="text-[9px] text-red-600 underline"
                >
                  Reset Titik
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={7}
        style={{ height: '100%', width: '100%', borderRadius: '0.375rem' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapController data={data} focusLocation={focusLocation} markerRefs={markerRefs} />
        <MapClickHandler measureMode={measureActive} onMapClick={handleMapClick} />

        {/* Garis Pengukur Jarak */}
        {activeLine && activeLine.length === 2 && (
          <Polyline
            positions={activeLine}
            pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6, 6' }}
          />
        )}

        {/* Marker Titik Klik */}
        {clickPoints.map((pt, i) => (
          <CircleMarker
            key={`click-pt-${i}`}
            center={pt}
            radius={5}
            pathOptions={{ fillColor: '#2563eb', color: '#fff', weight: 2, fillOpacity: 1 }}
          />
        ))}

        {/* Marker ODP */}
        {data.map((odp, idx) => {
          if (!odp.latitude || !odp.longitude) return null;
          const color = getColor(odp.status_final);

          return (
            <CircleMarker
              key={`${odp.odp_name}-${idx}`}
              center={[odp.latitude, odp.longitude]}
              radius={5}
              ref={(el) => {
                if (el) markerRefs.current[odp.odp_name] = el;
              }}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.9,
                color: '#ffffff',
                weight: 1,
              }}
            >
              {/* Tooltip Hover Ringkas */}
              <LeafletTooltip direction="top" offset={[0, -4]} opacity={0.95}>
                <div className="text-[10px] font-sans">
                  <span className="font-bold" style={{ color }}>
                    {odp.odp_name}
                  </span>{' '}
                  ({odp.sto || '-'})
                </div>
              </LeafletTooltip>

              {/* Popup Responsif & Tidak Kebesaran */}
              <Popup className="compact-custom-popup" maxWidth={240} minWidth={180}>
                <div className="text-[11px] font-sans leading-tight">
                  <div className="border-b pb-1 mb-1">
                    <p className="font-bold text-blue-900 truncate">{odp.odp_name}</p>
                    <span
                      className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded text-white mt-0.5"
                      style={{ backgroundColor: color }}
                    >
                      {odp.status_final || 'N/A'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[10px] text-slate-700">
                    <p className="truncate"><strong>STO:</strong> {odp.sto || '-'}</p>
                    <p className="truncate"><strong>Datel:</strong> {odp.datel || '-'}</p>
                    <p className="col-span-2 truncate"><strong>Desc:</strong> {odp.sto_desc || '-'}</p>
                    <p className="col-span-2 truncate"><strong>RX Level:</strong> {odp.ont_rx_level || '-'}</p>
                    <p className="col-span-2 truncate"><strong>Kab:</strong> {odp.kabupaten || '-'}</p>
                    <p><strong>Port:</strong> {odp.used || 0}/{odp.is_total || 0}</p>
                    <p><strong>OCC:</strong> {odp.is_total > 0 ? `${Math.round((odp.used/odp.is_total)*100)}%` : '0%'}</p>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono pt-1 mt-1 border-t truncate">
                    {odp.latitude?.toFixed(4)}, {odp.longitude?.toFixed(4)}
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
