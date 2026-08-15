import { useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
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

function MapController({ data, focusLocation, markerRefs, roadRouteCoordinates, manualMeasureLine }) {
  const map = useMap();

  useEffect(() => {
    if (roadRouteCoordinates && roadRouteCoordinates.length > 0) {
      map.fitBounds(roadRouteCoordinates, { padding: [35, 35], maxZoom: 16 });
    } else if (manualMeasureLine && manualMeasureLine.length === 2) {
      map.fitBounds(manualMeasureLine, { padding: [35, 35], maxZoom: 16 });
    } else if (focusLocation && focusLocation.latitude && focusLocation.longitude) {
      map.flyTo([focusLocation.latitude, focusLocation.longitude], 17, { animate: true });
      const ref = markerRefs.current[focusLocation.odp_name];
      if (ref) {
        setTimeout(() => ref.openPopup(), 300);
      }
    } else if (data && data.length > 0) {
      const validCoords = data
        .filter((d) => d.latitude && d.longitude)
        .map((d) => [d.latitude, d.longitude]);
      if (validCoords.length > 0) {
        map.fitBounds(validCoords, { padding: [20, 20], maxZoom: 12 });
      }
    }
  }, [data, focusLocation, roadRouteCoordinates, manualMeasureLine, map, markerRefs]);

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

export default function Map({
  data,
  focusLocation,
  manualMeasureLine,
  manualMeasureInfo,
  roadRouteCoordinates,
}) {
  const defaultCenter = [-1.7, 114.8];
  const markerRefs = useRef({});
  const [clickPoints, setClickPoints] = useState([]);
  const [measureActive, setMeasureActive] = useState(false);
  const [mapType, setMapType] = useState('street');

  const getColor = (status) => {
    const s = (status || '').toUpperCase();
    if (s.includes('RED')) return '#dc2626';
    if (s.includes('ORANGE')) return '#ea580c';
    if (s.includes('YELLOW')) return '#eab308';
    if (s.includes('GREEN')) return '#16a34a';
    return '#111827';
  };

  // Poin 4: Pewarnaan Nilai ONT RX Level
  const getRxColor = (rxVal) => {
    if (rxVal === null || rxVal === undefined) return '#64748b';
    if (rxVal > -18) return '#16a34a';
    if (rxVal >= -21) return '#ca8a04';
    if (rxVal >= -25) return '#ea580c';
    return '#dc2626';
  };

  const handleMapClick = (latlng) => {
    setClickPoints((prev) => [...prev, latlng]);
  };

  const resetClickMeasure = () => {
    setClickPoints([]);
    setMeasureActive(false);
  };

  const totalClickDistance = clickPoints.reduce((acc, curr, idx) => {
    if (idx === 0) return 0;
    const prev = clickPoints[idx - 1];
    return acc + calculateDistance(prev[0], prev[1], curr[0], curr[1]);
  }, 0);

  return (
    <div className="relative w-full h-full">
      <div className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5">
        <div className="bg-white rounded shadow border border-slate-300 overflow-hidden flex text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setMapType('street')}
            className={`px-2 py-1 transition ${mapType === 'street' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
          >
            Peta
          </button>
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-2 py-1 transition ${mapType === 'satellite' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
          >
            Satelit
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            setMeasureActive(!measureActive);
            if (measureActive) resetClickMeasure();
          }}
          className={`px-2 py-1 text-[10px] font-bold rounded shadow border transition ${
            measureActive
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
        >
          {measureActive ? '✕ Tutup' : '📏 Ukur'}
        </button>
      </div>

      {measureActive && (
        <div className="absolute top-12 right-2 z-[1000] bg-white/95 backdrop-blur p-2 rounded shadow border border-slate-300 text-[10px] text-slate-800 min-w-[150px]">
          <p className="font-bold border-b pb-0.5">
            Titik: <span className="text-blue-600 font-black">{clickPoints.length}</span>
          </p>
          {clickPoints.length < 2 ? (
            <p className="text-[9px] text-slate-500 mt-0.5">Klik peta berurutan.</p>
          ) : (
            <div className="mt-0.5 space-y-0.5">
              <p className="text-xs font-black text-blue-700">
                {totalClickDistance >= 1
                  ? `${totalClickDistance.toFixed(2)} km`
                  : `${Math.round(totalClickDistance * 1000)} m`}
              </p>
              <button
                type="button"
                onClick={() => setClickPoints([])}
                className="text-[9px] text-red-600 underline font-semibold"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={7}
        style={{ height: '100%', width: '100%', borderRadius: '0.375rem' }}
      >
        {mapType === 'satellite' ? (
          <TileLayer
            attribution='Tiles &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        ) : (
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        )}

        <MapController
          data={data}
          focusLocation={focusLocation}
          markerRefs={markerRefs}
          roadRouteCoordinates={roadRouteCoordinates}
          manualMeasureLine={manualMeasureLine}
        />
        <MapClickHandler measureMode={measureActive} onMapClick={handleMapClick} />

        {roadRouteCoordinates && roadRouteCoordinates.length > 0 && (
          <Polyline positions={roadRouteCoordinates} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.9 }} />
        )}

        {manualMeasureLine && manualMeasureLine.length === 2 && (
          <>
            <Marker position={manualMeasureLine[0]}>
              <Popup><div className="text-[10px] font-bold text-blue-700">Titik A</div></Popup>
            </Marker>
            <Marker position={manualMeasureLine[1]}>
              <Popup>
                <div className="text-[10px] font-sans">
                  <p className="font-bold text-emerald-700">Titik B</p>
                  <p className="font-bold text-blue-900 mt-0.5">Jarak: {manualMeasureInfo?.km} km</p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {clickPoints.length > 1 && (
          <Polyline positions={clickPoints} pathOptions={{ color: '#ea580c', weight: 2.5, dashArray: '4, 4' }} />
        )}

        {clickPoints.map((pt, i) => (
          <CircleMarker
            key={`click-pt-${i}`}
            center={pt}
            radius={5}
            pathOptions={{ fillColor: '#ea580c', color: '#fff', weight: 2, fillOpacity: 1 }}
          />
        ))}

        {data.map((odp, idx) => {
          if (!odp.latitude || !odp.longitude) return null;
          const color = getColor(odp.status_final);
          const rxColor = getRxColor(odp.ont_rx_level);
          const formattedRx = odp.ont_rx_level !== null ? `${Number(odp.ont_rx_level).toFixed(2)} dBm` : '-';
          const occVal = odp.is_total > 0 ? Math.round((odp.used / odp.is_total) * 100) : 0;

          return (
            <CircleMarker
              key={`${odp.odp_name}-${idx}`}
              center={[odp.latitude, odp.longitude]}
              radius={5}
              ref={(el) => {
                if (el) markerRefs.current[odp.odp_name] = el;
              }}
              eventHandlers={{
                mouseover: (e) => {
                  e.target.openPopup();
                },
              }}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.9,
                color: '#ffffff',
                weight: 1,
              }}
            >
              <Popup className="compact-custom-popup" maxWidth={230} minWidth={180}>
                <div className="text-[10px] font-sans bg-white p-2 text-slate-800 pointer-events-auto">
                  <div className="border-b border-slate-200 pb-1 mb-1 flex items-center justify-between gap-1">
                    <p className="font-extrabold text-blue-900 truncate max-w-[130px]" title={odp.odp_name}>
                      {odp.odp_name}
                    </p>
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.2 rounded text-white tracking-wider uppercase"
                      style={{ backgroundColor: color }}
                    >
                      {odp.status_final}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px]">
                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">STO</span>
                      <span className="font-bold text-slate-700 truncate block">{odp.sto || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">WOK</span>
                      <span className="font-bold text-slate-700 truncate block">{odp.wok || '-'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">KABUPATEN</span>
                      <span className="font-bold text-slate-700 truncate block">{odp.kabupaten || '-'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">PORT (USED/TOT)</span>
                      <span className="font-bold text-slate-800">
                        {odp.used || 0}/{odp.is_total || 0}{' '}
                        <span className="font-black" style={{ color }}>
                          ({occVal}%)
                        </span>
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">ONT RX LEVEL</span>
                      <span className="font-black" style={{ color: rxColor }}>
                        {formattedRx}
                      </span>
                    </div>
                    {odp.sto_desc && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[7.5px] uppercase font-bold">DESC</span>
                        <span className="font-medium text-slate-600 truncate block">{odp.sto_desc}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-[8px] text-slate-400 font-mono pt-1 mt-1 border-t border-slate-100 flex justify-between">
                    <span>{odp.latitude?.toFixed(4)}, {odp.longitude?.toFixed(4)}</span>
                    <span className="font-sans font-semibold text-slate-500">Avai: {odp.avai || 0}</span>
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
