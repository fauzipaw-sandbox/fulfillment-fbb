import { useEffect, useRef, useState, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Tooltip as LeafletTooltip,
  Polyline,
  Marker,
  Popup,
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

// Custom Icon Segitiga Order (15px)
const createTriangleIcon = (color = '#e11d48') => {
  return L.divIcon({
    className: 'custom-triangle-marker',
    html: `
      <div style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.45)); display: flex; align-items: center; justify-content: center; cursor: pointer;">
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

function MapController({ data, focusLocation, markerRefs, roadRouteCoordinates, manualMeasureLine, isFullscreen }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);

  useEffect(() => {
    if (roadRouteCoordinates && roadRouteCoordinates.length > 0) {
      map.fitBounds(roadRouteCoordinates, { padding: [35, 35], maxZoom: 16 });
    } else if (manualMeasureLine && manualMeasureLine.length === 2) {
      map.fitBounds(manualMeasureLine, { padding: [35, 35], maxZoom: 16 });
    } else if (focusLocation && focusLocation.latitude && focusLocation.longitude) {
      map.flyTo([focusLocation.latitude, focusLocation.longitude], 17, { animate: true });
      const ref = markerRefs.current[focusLocation.odp_name];
      if (ref) {
        setTimeout(() => ref.openTooltip(), 300);
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
  data = [],
  ordersData = [],
  focusLocation,
  manualMeasureLine,
  manualMeasureInfo,
  roadRouteCoordinates,
}) {
  const defaultCenter = [-1.7, 114.8];
  const containerRef = useRef(null);
  const markerRefs = useRef({});

  const [clickPoints, setClickPoints] = useState([]);
  const [measureActive, setMeasureActive] = useState(false);
  const [mapType, setMapType] = useState('street');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedOrderState, setSelectedOrderState] = useState('FALLOUT');

  // Fullscreen Listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFs = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFs);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen().catch(() => setIsFullscreen(true));
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => setIsFullscreen(false));
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else {
        setIsFullscreen(false);
      }
    }
  };

  const availableProcessStates = useMemo(() => {
    const set = new Set();
    (ordersData || []).forEach((o) => {
      const ps = (o.process_state || '').trim().toUpperCase();
      if (ps) set.add(ps);
    });
    return Array.from(set).sort();
  }, [ordersData]);

  const visibleOrders = useMemo(() => {
    if (selectedOrderState === 'NONE') return [];
    return (ordersData || []).filter((o) => {
      if (!o.lat || !o.lon) return false;
      const ps = (o.process_state || '').trim().toUpperCase();
      if (selectedOrderState === 'ALL') return true;
      return ps === selectedOrderState;
    });
  }, [ordersData, selectedOrderState]);

  const getColor = (status) => {
    const s = (status || '').toUpperCase();
    if (s.includes('RED')) return '#dc2626';
    if (s.includes('ORANGE')) return '#ea580c';
    if (s.includes('YELLOW')) return '#eab308';
    if (s.includes('GREEN')) return '#16a34a';
    return '#111827';
  };

  const getRxColor = (rxVal) => {
    if (rxVal === null || rxVal === undefined) return '#64748b';
    if (rxVal > -18) return '#16a34a';
    if (rxVal >= -21 && rxVal <= -18) return '#ca8a04';
    if (rxVal >= -25 && rxVal < -21) return '#ea580c';
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

  const findNearestOdp = (lat, lon) => {
    if (!lat || !lon || !data || data.length === 0) return null;
    let minDistance = Infinity;
    let nearest = null;

    data.forEach((odp) => {
      if (odp.latitude && odp.longitude) {
        const dist = calculateDistance(lat, lon, odp.latitude, odp.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = odp;
        }
      }
    });

    return nearest ? { ...nearest, distanceKm: minDistance } : null;
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full transition-all duration-200 ${
        isFullscreen ? 'fixed inset-0 z-[99999] w-screen h-screen bg-slate-900' : 'rounded'
      }`}
    >
      {/* Map Control Buttons Top Right */}
      <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1.5 flex-wrap justify-end">
        {/* Dropdown Filter Order */}
        <div className="bg-white/95 backdrop-blur px-2 py-1 rounded shadow border border-slate-300 flex items-center gap-1.5 text-[10.5px]">
          <span className="font-bold text-slate-700 flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 bg-rose-600 rounded-xs"></span>
            Order:
          </span>
          <select
            value={selectedOrderState}
            onChange={(e) => setSelectedOrderState(e.target.value)}
            className="p-0.5 border border-slate-300 rounded font-black text-rose-800 bg-rose-50 text-[10px] outline-none cursor-pointer"
          >
            <option value="FALLOUT">FALLOUT ({ordersData.filter(o => (o.process_state||'').toUpperCase() === 'FALLOUT').length})</option>
            <option value="ALL">SEMUA STATUS ({ordersData.length})</option>
            {availableProcessStates.filter(ps => ps !== 'FALLOUT').map((ps) => {
              const count = ordersData.filter(o => (o.process_state||'').toUpperCase() === ps).length;
              return (
                <option key={ps} value={ps}>
                  {ps} ({count})
                </option>
              );
            })}
            <option value="NONE">-- Sembunyikan Order --</option>
          </select>
        </div>

        {/* Map Type Toggle */}
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

        {/* Ukur Jarak */}
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

        {/* Fullscreen Button */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="px-2.5 py-1 text-[10px] font-black rounded shadow border bg-[#0f172a] text-white hover:bg-slate-800 transition flex items-center gap-1 cursor-pointer"
          title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh (Mode Presentasi)'}
        >
          <span>{isFullscreen ? '🗗' : '⛶'}</span>
          <span>{isFullscreen ? 'Exit' : 'Fullscreen'}</span>
        </button>
      </div>

      {measureActive && (
        <div className="absolute top-12 right-2.5 z-[1000] bg-white/95 backdrop-blur p-2 rounded shadow border border-slate-300 text-[10px] text-slate-800 min-w-[150px]">
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
        style={{ height: '100%', width: '100%', borderRadius: isFullscreen ? '0' : '0.375rem' }}
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
          isFullscreen={isFullscreen}
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

        {/* ================= 1. MARKER LINGKARAN ODP ================= */}
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
              radius={4.5}
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
              <LeafletTooltip
                direction="top"
                offset={[0, -2]}
                opacity={1}
                interactive={true}
                className="compact-custom-tooltip"
              >
                <div className="text-[10px] font-sans bg-white p-2 rounded shadow-lg text-slate-800 min-w-[190px] max-w-[240px]">
                  <div className="border-b border-slate-200 pb-1 mb-1 flex items-center justify-between gap-1">
                    <p className="font-extrabold text-blue-900 truncate max-w-[130px]" title={odp.odp_name}>
                      {odp.odp_name}
                    </p>
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.2 rounded text-white uppercase"
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
                  </div>

                  <div className="text-[8px] text-slate-400 font-mono pt-1 mt-1 border-t border-slate-100 flex justify-between">
                    <span>{odp.latitude?.toFixed(4)}, {odp.longitude?.toFixed(4)}</span>
                    <span className="font-sans font-semibold text-slate-500">Avai: {odp.avai || 0}</span>
                  </div>
                </div>
              </LeafletTooltip>
            </CircleMarker>
          );
        })}

        {/* ================= 2. MARKER SEGITIGA ORDER (LEAFLET POPUP ATTACHED ON PIN) ================= */}
        {visibleOrders.map((fo, fIdx) => {
          if (!fo.lat || !fo.lon) return null;
          const nearestOdp = findNearestOdp(fo.lat, fo.lon);
          const nearestColor = nearestOdp ? getColor(nearestOdp.status_final) : '#64748b';
          const nearestOcc = nearestOdp && nearestOdp.is_total > 0
            ? Math.round((nearestOdp.used / nearestOdp.is_total) * 100)
            : 0;

          const pState = (fo.process_state || 'UNKNOWN').toUpperCase();
          const markerColor = pState === 'FALLOUT' ? '#e11d48' : pState === 'COMPLETED' ? '#16a34a' : pState.includes('CANCEL') ? '#ea580c' : '#8b5cf6';
          const icon = createTriangleIcon(markerColor);

          return (
            <Marker
              key={`order-${fo.order_id}-${fIdx}`}
              position={[fo.lat, fo.lon]}
              icon={icon}
              eventHandlers={{
                mouseover: (e) => {
                  e.target.openPopup();
                },
              }}
            >
              <Popup
                autoPan={true}
                className="custom-order-leaflet-popup"
                minWidth={240}
                maxWidth={280}
              >
                <div className="bg-white p-2.5 rounded-lg text-slate-800 space-y-1.5 font-sans">
                  {/* Header Badge */}
                  <div className="border-b border-slate-200 pb-1 flex items-center justify-between gap-1">
                    <span className="font-black text-[11px] truncate flex items-center gap-1" style={{ color: markerColor }}>
                      <span>🔺</span> {pState}
                    </span>
                    <span className="bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded text-[8.5px] whitespace-nowrap">
                      {fo.order_duration_cat || '3 HARI'}
                    </span>
                  </div>

                  {/* Order Details Grid */}
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px]">
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">ORDER ID</span>
                      <span className="font-mono font-black text-purple-900 block truncate" title={fo.order_id}>
                        {fo.order_id}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">PELANGGAN</span>
                      <span className="font-bold text-slate-800 block truncate" title={fo.name}>
                        {fo.name || '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">NO HP</span>
                      <span className="font-mono text-slate-700 block truncate">
                        {fo.no_handphone || fo.no_handphone_mask || '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">STO</span>
                      <span className="font-bold text-slate-700 block truncate">{fo.sto_co || '-'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">WOK</span>
                      <span className="font-bold text-slate-700 block truncate">{fo.wok || '-'}</span>
                    </div>

                    {fo.address && fo.address !== '-' && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[7.5px] uppercase font-bold">ALAMAT</span>
                        <span className="text-slate-600 block text-[8.5px] leading-tight line-clamp-2" title={fo.address}>
                          {fo.address}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Remarks / Fallout Reason Box (Scrollable & Text Selectable) */}
                  {(fo.fallout_reason || fo.fallout_reason_clean) && (
                    <div className="bg-red-50 p-1.5 rounded border border-red-200 text-[9px] text-red-900 space-y-0.5">
                      <span className="text-red-700 font-black block text-[8px] uppercase tracking-wide">
                        REMARKS / FALLOUT REASON:
                      </span>
                      <p className="font-bold text-red-800 leading-tight">
                        {fo.fallout_reason_clean || 'LAINNYA'}
                      </p>
                      {fo.fallout_reason && (
                        <div className="text-[8.5px] text-slate-700 leading-snug break-words max-h-24 overflow-y-auto pr-1 pt-1 border-t border-red-200 font-mono bg-white p-1 rounded">
                          {fo.fallout_reason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nearest ODP Analysis */}
                  {nearestOdp ? (
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200 text-[9px] space-y-0.5">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-0.5">
                        <span className="font-black text-slate-700 text-[8px] uppercase">📍 ODP TERDEKAT</span>
                        <span className="font-bold text-blue-700 text-[8.5px]">
                          {nearestOdp.distanceKm >= 1
                            ? `${nearestOdp.distanceKm.toFixed(2)} km`
                            : `${Math.round(nearestOdp.distanceKm * 1000)} m`}
                        </span>
                      </div>
                      <p className="font-extrabold text-blue-900 truncate" title={nearestOdp.odp_name}>
                        {nearestOdp.odp_name}
                      </p>
                      <div className="flex items-center justify-between pt-0.5">
                        <span>
                          Port: <strong>{nearestOdp.used}/{nearestOdp.is_total}</strong> ({nearestOcc}%)
                        </span>
                        <span
                          className="text-white px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase"
                          style={{ backgroundColor: nearestColor }}
                        >
                          {nearestOdp.status_final}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-400 italic text-[8.5px]">Tidak ada ODP terdekat terdeteksi</p>
                  )}

                  {/* Coordinate Footer */}
                  <div className="text-[8px] text-slate-400 font-mono pt-1 border-t border-slate-100 flex justify-between">
                    <span>Sumber: {fo.coordSource || 'ROW'}</span>
                    <span>{fo.lat?.toFixed(4)}, {fo.lon?.toFixed(4)}</span>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
