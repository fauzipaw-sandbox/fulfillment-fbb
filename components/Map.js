import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export default function Map({ data }) {
  // Koordinat default (misal di Kalimantan / Palangkaraya)
  const center = [-1.7, 114.8]; 

  return (
    <MapContainer center={center} zoom={7} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      
      {data.map((odp) => {
        if (odp.latitude && odp.longitude) {
          return (
            <Marker key={odp.odp_name} position={[odp.latitude, odp.longitude]}>
              <Popup>
                <strong>{odp.odp_name}</strong><br/>
                STO: {odp.sto} <br/>
                Status: {odp.status_final}
              </Popup>
            </Marker>
          );
        }
        return null;
      })}
    </MapContainer>
  );
}
