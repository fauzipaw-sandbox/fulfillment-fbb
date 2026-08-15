import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Tooltip as LeafletTooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapController({ data, focusLocation, markerRefs }) {
  const map = useMap();

  useEffect(() => {
    if (focusLocation && focusLocation.latitude && focusLocation.longitude) {
      map.flyTo([focusLocation.latitude, focusLocation.longitude], 17, { animate: true });
      const ref = markerRefs.current[focusLocation.odp_name];
      if (ref) {
        setTimeout(() => {
          ref.openPopup();
        }, 400);
      }
    } else if (data && data.length > 0) {
      const validCoords = data
        .filter((d) => d.latitude && d.longitude)
        .map((d) => [d.latitude, d.longitude]);
      if (validCoords.length > 0) {
        map.fitBounds(validCoords, { padding: [30, 30], maxZoom: 12 });
      }
    }
  }, [data, focusLocation, map, markerRefs]);

  return null;
}

export default function Map({ data, focusLocation }) {
  const defaultCenter = [-1.7, 114.8];
  const markerRefs = useRef({});

  const getColor = (status) => {
    const s = (status || '').toUpperCase();
    if (s.includes('RED')) return '#dc2626';
    if (s.includes('ORANGE')) return '#ea580c';
    if (s.includes('YELLOW')) return '#eab308';
    if (s.includes('GREEN')) return '#16a34a';
    return '#111827';
  };

  return (
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
      {data.map((odp, idx) => {
        if (!odp.latitude || !odp.longitude) return null;
        const color = getColor(odp.status_final);

        return (
          <CircleMarker
            key={`${odp.odp_name}-${idx}`}
            center={[odp.latitude, odp.longitude]}
            radius={6}
            ref={(el) => {
              if (el) markerRefs.current[odp.odp_name] = el;
            }}
            pathOptions={{
              fillColor: color,
              fillOpacity: 0.9,
              color: '#ffffff',
              weight: 1.5,
            }}
          >
            {/* Muncul otomatis saat kursor diarahkan (hover) */}
            <LeafletTooltip direction="top" offset={[0, -5]} opacity={0.95}>
              <div className="text-[11px] font-sans">
                <p className="font-bold" style={{ color }}>{odp.odp_name}</p>
                <p>Status: <strong>{odp.status_final}</strong></p>
                <p>STO: <strong>{odp.sto || '-'}</strong></p>
              </div>
            </LeafletTooltip>

            {/* Popup Detail Lengkap */}
            <Popup>
              <div className="text-xs font-sans space-y-1 min-w-[200px]">
                <div className="border-b pb-1">
                  <p className="font-extrabold text-blue-900 text-sm">{odp.odp_name}</p>
                  <p className="text-[10px] font-bold" style={{ color }}>
                    Status: {odp.status_final || 'N/A'}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-gray-700 pt-1">
                  <p><strong>Datel:</strong> {odp.datel || '-'}</p>
                  <p><strong>STO:</strong> {odp.sto || '-'}</p>
                  <p className="col-span-2"><strong>STO Desc:</strong> {odp.sto_desc || '-'}</p>
                  <p className="col-span-2"><strong>ONT RX Level:</strong> {odp.ont_rx_level || '-'}</p>
                  <p className="col-span-2"><strong>Kabupaten:</strong> {odp.kabupaten || '-'}</p>
                  <p><strong>Used Port:</strong> {odp.used || 0}</p>
                  <p><strong>Total Port:</strong> {odp.is_total || 0}</p>
                  <p className="col-span-2 text-[10px] text-gray-500 font-mono pt-1 border-t">
                    Lat: {odp.latitude}, Long: {odp.longitude}
                  </p>
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
