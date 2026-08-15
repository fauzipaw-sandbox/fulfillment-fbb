import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function Map({ data }) {
  const center = [-1.7, 114.8]; // Titik tengah Kalimantan

  return (
    <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {data.map((odp) => {
        if (odp.latitude && odp.longitude) {
          return (
            <Marker key={odp.odp_name} position={[odp.latitude, odp.longitude]}>
              <Popup>
                <div className="text-xs">
                  <p className="font-bold text-blue-700">{odp.odp_name}</p>
                  <p><strong>STO:</strong> {odp.sto || '-'}</p>
                  <p><strong>Used / Total:</strong> {odp.used} / {odp.is_total}</p>
                  <p><strong>Status:</strong> {odp.status_final}</p>
                </div>
              </Popup>
            </Marker>
          );
        }
        return null;
      })}
    </MapContainer>
  );
}
