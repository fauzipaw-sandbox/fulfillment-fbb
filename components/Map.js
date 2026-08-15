import { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Tooltip as LeafletTooltip,
  Polyline,
  Marker,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function MapController({ data, focusLocation, markerRefs, manualMeasureLine }) {
  const map = useMap();

  useEffect(() => {
    if (manualMeasureLine && manualMeasureLine.length === 2) {
      map.fitBounds(manualMeasureLine, { padding: [50, 50], maxZoom: 16 });
    } else if (focusLocation && focusLocation.latitude && focusLocation.longitude) {
      map.flyTo([focusLocation.latitude, focusLocation.longitude], 17, { animate: true });
      const ref = markerRefs.current[focusLocation.odp_name];
      if (ref) {
        setTimeout(() => ref.openPopup(), 350);
      }
    } else if (data && data.length > 0) {
      const validCoords = data
        .filter((d) => d.latitude && d.longitude)
        .map((d) => [d.latitude, d.longitude]);
      if (validCoords.length > 0) {
        map.fitBounds(validCoords, { padding: [25, 25], maxZoom: 12 });
      }
    }
  }, [data, focusLocation, manualMeasureLine, map, markerRefs]);

  return null;
}

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

export default function Map({ data, focusLocation, manualMeasureLine, manualMeasureInfo }) {
  const defaultCenter = [-1.7, 114.8];
  const markerRefs = useRef({});
  const [clickPoints, setClickPoints] = useState([]);
  const [measureActive, setMeasureActive] = useState(false);

  const getColor = (status) => {
    const s = (status || '').toUpperCase();
    if (s.includes('RED')) return '#dc2626';
    if (s.includes('ORANGE')) return '#ea580c';
    if (s.includes('YELLOW')) return '#eab308';
    if (s.includes('GREEN')) return '#16a34a';
    return '#111827';
  };

  const handleMapClick = (latlng) => {
    setClickPoints((prev) => [...prev, latlng]);
  };

  const resetClickMeasure = () => {
    setClickPoints([]);
    setMeasureActive(false);
  };

  // Hitung akumulasi jarak multi-point
  const totalClickDistance = clickPoints.reduce((acc, curr, idx) => {
    if (idx === 0) return 0;
    const prev = clickPoints[idx - 1];
    return acc + calculateDistance(prev[0], prev[1], curr[0], curr[1]);
  }, 0);

  return (
    <div className="relative w-full h-full">
      {/* Floating Control: Multi-Point Measurement */}
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
          {measureActive ? '✕ Selesai / Tutup Penggaris' : '📏 Penggaris Multi-Titik'}
        </button>

        {measureActive && (
          <div className="bg-white/95 backdrop-blur p-2 rounded shadow-lg border border-slate-300 text-[11px] text-slate-800 min-w-[190px]">
            <p className="font-bold text-slate-900 border-b pb-1">
              Titik Terpilih: <span className="text-blue-600 font-extrabold">{clickPoints.length}</span>
            </p>
            {clickPoints.length < 2 ? (
              <p className="text-[10px] text-slate-500 mt-1">Klik titik-titik di peta secara berurutan.</p>
            ) : (
              <div className="mt-1 space-y-1">
                <p className="text-[10px] text-slate-600">Total Akumulasi Jarak:</p>
                <p className="text-sm font-black text-blue-700">
                  {totalClickDistance >= 1
                    ? `${totalClickDistance.toFixed(2)} km`
                    : `${Math.round(totalClickDistance * 1000)} meter`}
                </p>
                <button
                  type="button"
                  onClick={() => setClickPoints([])}
                  className="text-[10px] text-red-600 underline font-semibold"
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

        <MapController
          data={data}
          focusLocation={focusLocation}
          markerRefs={markerRefs}
          manualMeasureLine={manualMeasureLine}
        />
        <MapClickHandler measureMode={measureActive} onMapClick={handleMapClick} />

        {/* 1. Visualisasi Garis Pengukur Input Titik A & B */}
        {manualMeasureLine && manualMeasureLine.length === 2 && (
          <>
            <Polyline
              positions={manualMeasureLine}
              pathOptions={{ color: '#2563eb', weight: 4, dashArray: '6, 6' }}
            />
            <Marker position={manualMeasureLine[0]}>
              <Popup>
                <div className="text-xs font-sans">
                  <p className="font-bold text-blue-700">Titik A (Awal)</p>
                  <p>{manualMeasureInfo?.from || '-'}</p>
                </div>
              </Popup>
            </Marker>
            <Marker position={manualMeasureLine[1]}>
              <Popup>
                <div className="text-xs font-sans">
                  <p className="font-bold text-green-700">Titik B (Tujuan)</p>
                  <p>{manualMeasureInfo?.to || '-'}</p>
                  <p className="font-bold text-blue-900 mt-1">Jarak: {manualMeasureInfo?.km} km</p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* 2. Visualisasi Garis Pengukur Multi-Titik Klik */}
        {clickPoints.length > 1 && (
          <Polyline
            positions={clickPoints}
            pathOptions={{ color: '#ea580c', weight: 3, dashArray: '4, 4' }}
          />
        )}

        {clickPoints.map((pt, i) => (
          <CircleMarker
            key={`click-pt-${i}`}
            center={pt}
            radius={6}
            pathOptions={{ fillColor: '#ea580c', color: '#fff', weight: 2, fillOpacity: 1 }}
          >
            <LeafletTooltip permanent direction="top" offset={[0, -5]}>
              <span className="font-bold text-[10px]">#{i + 1}</span>
            </LeafletTooltip>
          </CircleMarker>
        ))}

        {/* 3. Marker Titik ODP */}
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
              <LeafletTooltip direction="top" offset={[0, -4]} opacity={0.95}>
                <div className="text-[10px] font-sans">
                  <span className="font-bold" style={{ color }}>
                    {odp.odp_name}
                  </span>{' '}
                  ({odp.sto || '-'})
                </div>
              </LeafletTooltip>

              <Popup className="compact-custom-popup" maxWidth={250} minWidth={190}>
                <div className="text-[11px] font-sans leading-tight">
                  <div className="border-b pb-1 mb-1">
                    <p className="font-bold text-blue-900 truncate">{odp.odp_name}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span
                        className="inline-block text-[9px] font-bold px-1.5 py-0.2 rounded text-white"
                        style={{ backgroundColor: color }}
                      >
                        {odp.status_final || 'N/A'}
                      </span>
                      {odp.rx_category && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-800 border">
                          RX: {odp.ont_rx_level ? `${odp.ont_rx_level} dBm` : 'N/A'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-1 gap-y-0.5 text-[10px] text-slate-700">
                    <p className="truncate"><strong>STO:</strong> {odp.sto || '-'}</p>
                    <p className="truncate"><strong>WOK:</strong> {odp.wok || '-'}</p>
                    <p className="col-span-2 truncate"><strong>Datel:</strong> {odp.datel || '-'}</p>
                    <p className="col-span-2 truncate"><strong>STO Desc:</strong> {odp.sto_desc || '-'}</p>
                    <p className="col-span-2 truncate"><strong>Kab:</strong> {odp.kabupaten || '-'}</p>
                    <p><strong>Port:</strong> {odp.used || 0}/{odp.is_total || 0}</p>
                    <p><strong>OCC:</strong> {odp.is_total > 0 ? `${Math.round((odp.used / odp.is_total) * 100)}%` : '0%'}</p>
                  </div>
                  <div className="text-[9px] text-slate-400 font-mono pt-1 mt-1 border-t truncate">
                    Lat: {odp.latitude?.toFixed(4)}, Long: {odp.longitude?.toFixed(4)}
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
