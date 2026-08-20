import { useEffect, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
  Tooltip as LeafletTooltip,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createTriangleIcon = (color = '#e11d48') => {
  return L.divIcon({
    className: 'custom-analysis-triangle',
    html: `
      <div style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); display: flex; align-items: center; justify-content: center; cursor: pointer;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2">
          <path d="M12 2L1 21h22L12 2z" />
          <circle cx="12" cy="14" r="1.5" fill="#ffffff"/>
        </svg>
      </div>
    `,
    iconSize: [15, 15],
    iconAnchor: [7.5, 7.5],
    popupAnchor: [0, -10],
  });
};

function MapAutoCenter({ selectedTarget, radiusLimit }) {
  const map = useMap();

  useEffect(() => {
    if (selectedTarget && selectedTarget.lat && selectedTarget.lon) {
      map.flyTo([selectedTarget.lat, selectedTarget.lon], 17, { animate: true, duration: 1 });
    }
  }, [selectedTarget, radiusLimit, map]);

  return null;
}

export default function AnalysisMap({
  odpData = [],
  ordersData = [],
  selectedTarget = null,
  radiusLimit = 250,
  onSelectTarget,
}) {
  const defaultCenter = [-1.7, 114.8];
  const [mapType, setMapType] = useState('street');

  const getColor = (status) => {
    const s = (status || '').toUpperCase();
    if (s.includes('RED')) return '#dc2626';
    if (s.includes('ORANGE')) return '#ea580c';
    if (s.includes('YELLOW')) return '#eab308';
    if (s.includes('GREEN')) return '#16a34a';
    return '#111827';
  };

  return (
    <div className="relative w-full h-full">
      {/* Map Control Buttons */}
      <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1.5">
        <div className="bg-white rounded shadow border border-slate-300 overflow-hidden flex text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setMapType('street')}
            className={`px-2.5 py-1 transition cursor-pointer ${
              mapType === 'street' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Peta
          </button>
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-2.5 py-1 transition cursor-pointer ${
              mapType === 'satellite' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            Satelit
          </button>
        </div>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
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

        <MapAutoCenter selectedTarget={selectedTarget} radiusLimit={radiusLimit} />

        {/* Lingkaran Radius 250M */}
        {selectedTarget && selectedTarget.lat && selectedTarget.lon && (
          <>
            <Circle
              center={[selectedTarget.lat, selectedTarget.lon]}
              radius={radiusLimit}
              pathOptions={{
                color: '#2563eb',
                weight: 2.5,
                dashArray: '6, 6',
                fillColor: '#3b82f6',
                fillOpacity: 0.12,
              }}
            />
            <CircleMarker
              center={[selectedTarget.lat, selectedTarget.lon]}
              radius={8}
              pathOptions={{
                color: '#ffffff',
                weight: 3,
                fillColor: '#2563eb',
                fillOpacity: 1,
              }}
            />
          </>
        )}

        {/* Marker ODP */}
        {odpData.map((odp, idx) => {
          if (!odp.latitude || !odp.longitude) return null;
          const color = getColor(odp.status_final);
          const occVal = odp.is_total > 0 ? Math.round((odp.used / odp.is_total) * 100) : 0;
          const isSelected = selectedTarget?.targetType === 'ODP' && selectedTarget?.odp_name === odp.odp_name;

          return (
            <CircleMarker
              key={`analysis-odp-${odp.odp_name}-${idx}`}
              center={[odp.latitude, odp.longitude]}
              radius={isSelected ? 7 : 4.5}
              eventHandlers={{
                click: () => {
                  if (onSelectTarget) {
                    onSelectTarget({
                      ...odp,
                      targetType: 'ODP',
                      displayName: odp.odp_name,
                      lat: odp.latitude,
                      lon: odp.longitude,
                    });
                  }
                },
              }}
              pathOptions={{
                fillColor: isSelected ? '#2563eb' : color,
                fillOpacity: 0.95,
                color: '#ffffff',
                weight: isSelected ? 2.5 : 1,
              }}
            >
              <LeafletTooltip direction="top" offset={[0, -2]} opacity={1}>
                <div className="text-[10px] font-sans bg-white p-2 rounded shadow text-slate-800 min-w-[180px]">
                  <p className="font-extrabold text-blue-900 border-b pb-0.5">{odp.odp_name}</p>
                  <p className="mt-1">
                    Port: <strong>{odp.used}/{odp.is_total}</strong> ({occVal}%) &bull; Avai: {odp.avai}
                  </p>
                  <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                    STO: {odp.sto} | {odp.status_final}
                  </p>
                  <p className="text-[8px] text-blue-600 font-black mt-1">👉 Klik untuk buat radius {radiusLimit}m</p>
                </div>
              </LeafletTooltip>
            </CircleMarker>
          );
        })}

        {/* Marker Order */}
        {ordersData.map((ord, idx) => {
          if (!ord.lat || !ord.lon) return null;
          const pState = (ord.process_state || 'UNKNOWN').toUpperCase();
          const markerColor = pState === 'FALLOUT' ? '#e11d48' : pState === 'COMPLETED' ? '#16a34a' : pState.includes('CANCEL') ? '#ea580c' : '#8b5cf6';
          const icon = createTriangleIcon(markerColor);

          return (
            <Marker
              key={`analysis-ord-${ord.order_id}-${idx}`}
              position={[ord.lat, ord.lon]}
              icon={icon}
              eventHandlers={{
                click: () => {
                  if (onSelectTarget) {
                    onSelectTarget({
                      ...ord,
                      targetType: 'ORDER',
                      displayName: `${ord.order_id} - ${ord.name || 'Pelanggan'}`,
                      lat: ord.lat,
                      lon: ord.lon,
                    });
                  }
                },
              }}
            >
              <Popup minWidth={220}>
                <div className="text-[10px] font-sans p-1 space-y-1 select-text">
                  <p className="font-black text-purple-900 border-b pb-0.5">🔺 {ord.order_id}</p>
                  <p><strong>Pelanggan:</strong> {ord.name || '-'}</p>
                  <p><strong>Status:</strong> {pState}</p>
                  {ord.fallout_reason && (
                    <p className="text-[9px] text-red-600 font-bold bg-red-50 p-1 rounded">
                      Remarks: {ord.fallout_reason}
                    </p>
                  )}
                  <p className="text-[8px] text-blue-600 font-black pt-1">
                    👉 Klik titik ini untuk jadikan pusat radius {radiusLimit}m
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
