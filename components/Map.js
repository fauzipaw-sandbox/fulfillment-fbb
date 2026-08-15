import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

function MapController({ data, focusLocation }) {
  const map = useMap();
  useEffect(() => {
    if (focusLocation && focusLocation.latitude && focusLocation.longitude) {
      map.flyTo([focusLocation.latitude, focusLocation.longitude], 16, { animate: true });
    } else if (data && data.length > 0) {
      const validCoords = data.filter((d) => d.latitude && d.longitude).map((d) => [d.latitude, d.longitude]);
      if (validCoords.length > 0) {
        map.fitBounds(validCoords, { padding: [30, 30], maxZoom: 12 });
      }
    }
  }, [data, focusLocation, map]);
  return null;
}

export default function Map({ data, focusLocation }) {
  const defaultCenter = [-1.7, 114.8];
  const getColor = (status) => {
    const s = (status || '').toUpperCase();
    if (s.includes('RED')) return '#dc2626';
    if (s.includes('ORANGE')) return '#ea580c';
    if (s.includes('YELLOW')) return '#eab308';
    if (s.includes('GREEN')) return '#16a34a';
    return '#111827'; 
  };

  return (
    <MapContainer center={defaultCenter} zoom={7} style={{ height: '100%', width: '100%', borderRadius: '0.375rem' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapController data={data} focusLocation={focusLocation} />
      {data.map((odp, idx) => {
        if (!odp.latitude || !odp.longitude) return null;
        const color = getColor(odp.status_final);
        return (
          <CircleMarker key={`${odp.odp_name}-${idx}`} center={[odp.latitude, odp.longitude]} radius={5} pathOptions={{ fillColor: color, fillOpacity: 0.85, color: '#ffffff', weight: 1 }}>
            <Popup>
              <div className="text-xs font-sans space-y-1">
                <p className="font-bold text-blue-900 border-b pb-1">{odp.odp_name}</p>
                <p><strong>STO:</strong> {odp.sto || '-'}</p>
                <p><strong>Kabupaten:</strong> {odp.kabupaten || '-'}</p>
                <p><strong>Used / Total:</strong> {odp.used || 0} / {odp.is_total || 0}</p>
                <p><strong>Status:</strong> <span className="font-semibold" style={{ color }}>{odp.status_final || 'N/A'}</span></p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
