import { useEffect, useRef, useState, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Circle,
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

const createTriangleIcon = (color = '#e11d48') => {
  return L.divIcon({
    className: 'custom-analysis-triangle',
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

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
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

function MapController({ selectedTarget, radiusLimit, isFullscreen }) {
  const map = useMap();

  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [isFullscreen, map]);

  useEffect(() => {
    if (selectedTarget && selectedTarget.lat && selectedTarget.lon) {
      map.flyTo([selectedTarget.lat, selectedTarget.lon], 17, { animate: true, duration: 1 });
    }
  }, [selectedTarget, radiusLimit, map]);

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

export default function AnalysisMap({
  odpData = [],
  ordersData = [],
  selectedTarget = null,
  radiusLimit = 250,
  onSelectTarget,
  selectedOrderState = 'FALLOUT',
  setSelectedOrderState,
  availableProcessStates = [],
}) {
  const defaultCenter = [-1.7, 114.8];
  const containerRef = useRef(null);

  const [mapType, setMapType] = useState('street');
  const [measureActive, setMeasureActive] = useState(false);
  const [clickPoints, setClickPoints] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
    return acc + calculateDistanceMeters(prev[0], prev[1], curr[0], curr[1]);
  }, 0);

  const findNearestOdp = (lat, lon) => {
    if (!lat || !lon || !odpData || odpData.length === 0) return null;
    let minDistance = Infinity;
    let nearest = null;

    odpData.forEach((odp) => {
      if (odp.latitude && odp.longitude) {
        const dist = calculateDistanceMeters(lat, lon, odp.latitude, odp.longitude);
        if (dist < minDistance) {
          minDistance = dist;
          nearest = odp;
        }
      }
    });

    return nearest ? { ...nearest, distanceMeters: Math.round(minDistance) } : null;
  };

  const visibleOrders = useMemo(() => {
    if (selectedOrderState === 'NONE') return [];
    return (ordersData || []).filter((o) => {
      if (!o.lat || !o.lon) return false;
      const ps = (o.process_state || '').trim().toUpperCase();
      if (selectedOrderState === 'ALL') return true;
      return ps === selectedOrderState;
    });
  }, [ordersData, selectedOrderState]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full transition-all duration-200 ${
        isFullscreen ? 'fixed inset-0 z-[99999] w-screen h-screen bg-slate-900' : 'rounded'
      }`}
    >
      <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1.5 flex-wrap justify-end">
        {/* Dropdown Process State */}
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
            <option value="FALLOUT">FALLOUT ({ordersData.filter((o) => (o.process_state || '').toUpperCase() === 'FALLOUT').length})</option>
            <option value="ALL">SEMUA STATUS ({ordersData.length})</option>
            {availableProcessStates.filter((ps) => ps !== 'FALLOUT').map((ps) => {
              const count = ordersData.filter((o) => (o.process_state || '').toUpperCase() === ps).length;
              return (
                <option key={ps} value={ps}>
                  {ps} ({count})
                </option>
              );
            })}
            <option value="NONE">-- Sembunyikan Order --</option>
          </select>
        </div>

        {/* Map Type */}
        <div className="bg-white rounded shadow border border-slate-300 overflow-hidden flex text-[10px] font-bold">
          <button
            type="button"
            onClick={() => setMapType('street')}
            className={`px-2 py-1 transition cursor-pointer ${mapType === 'street' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
          >
            Peta
          </button>
          <button
            type="button"
            onClick={() => setMapType('satellite')}
            className={`px-2 py-1 transition cursor-pointer ${mapType === 'satellite' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
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
          className={`px-2 py-1 text-[10px] font-bold rounded shadow border transition cursor-pointer ${
            measureActive
              ? 'bg-amber-500 text-white border-amber-600'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
        >
          {measureActive ? '✕ Tutup' : '📏 Ukur'}
        </button>

        {/* Fullscreen */}
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
                {totalClickDistance >= 1000
                  ? `${(totalClickDistance / 1000).toFixed(2)} km`
                  : `${Math.round(totalClickDistance)} m`}
              </p>
              <button
                type="button"
                onClick={() => setClickPoints([])}
                className="text-[9px] text-red-600 underline font-semibold cursor-pointer"
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={8}
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

        <MapController selectedTarget={selectedTarget} radiusLimit={radiusLimit} isFullscreen={isFullscreen} />
        <MapClickHandler measureMode={measureActive} onMapClick={handleMapClick} />

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

        {/* 1. Lingkaran Radius 250M */}
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
                fillOpacity: 0.14,
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

        {/* 2. Marker ODP */}
        {odpData.map((odp, idx) => {
          if (!odp.latitude || !odp.longitude) return null;
          const color = getColor(odp.status_final);
          const rxColor = getRxColor(odp.ont_rx_level);
          const formattedRx = odp.ont_rx_level !== null ? `${Number(odp.ont_rx_level).toFixed(2)} dBm` : '-';
          const occVal = odp.is_total > 0 ? Math.round((odp.used / odp.is_total) * 100) : 0;
          const isSelected = selectedTarget?.targetType === 'ODP' && selectedTarget?.odp_name === odp.odp_name;

          return (
            <CircleMarker
              key={`odp-${odp.odp_name}-${idx}`}
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
              <LeafletTooltip direction="top" offset={[0, -2]} opacity={1} className="compact-custom-tooltip">
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

                  <div className="text-[8px] text-blue-600 font-black pt-1 mt-1 border-t border-slate-100 flex justify-between items-center">
                    <span>Avai: {odp.avai || 0}</span>
                    <span>👉 Klik: Radius {radiusLimit}m</span>
                  </div>
                </div>
              </LeafletTooltip>
            </CircleMarker>
          );
        })}

        {/* 3. Marker Order */}
        {visibleOrders.map((ord, idx) => {
          if (!ord.lat || !ord.lon) return null;
          const nearestOdp = findNearestOdp(ord.lat, ord.lon);
          const nearestColor = nearestOdp ? getColor(nearestOdp.status_final) : '#64748b';
          const nearestOcc = nearestOdp && nearestOdp.is_total > 0
            ? Math.round((nearestOdp.used / nearestOdp.is_total) * 100)
            : 0;

          const pState = (ord.process_state || 'UNKNOWN').toUpperCase();
          const markerColor = pState === 'FALLOUT' ? '#e11d48' : pState === 'COMPLETED' ? '#16a34a' : pState.includes('CANCEL') ? '#ea580c' : '#8b5cf6';
          const icon = createTriangleIcon(markerColor);
          const remarksRaw = ord.fallout_reason || ord.order_status_desc || '';

          return (
            <Marker
              key={`order-${ord.order_id}-${idx}`}
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
              <Popup autoPan={true} minWidth={250} maxWidth={320}>
                <div className="bg-white p-1 text-slate-800 space-y-1.5 font-sans select-text">
                  <div className="border-b border-slate-200 pb-1 flex items-center justify-between gap-1">
                    <span className="font-black text-[11px] truncate flex items-center gap-1" style={{ color: markerColor }}>
                      <span>🔺</span> {pState}
                    </span>
                    <span className="bg-slate-100 text-slate-700 font-bold px-1.5 py-0.5 rounded text-[8.5px] whitespace-nowrap">
                      {ord.order_duration_cat || '3 HARI'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9.5px]">
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">ORDER ID</span>
                      <span className="font-mono font-black text-purple-900 block select-all cursor-text">
                        {ord.order_id}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">PELANGGAN</span>
                      <span className="font-bold text-slate-800 block truncate" title={ord.name}>
                        {ord.name || '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">NO HP</span>
                      <span className="font-mono text-slate-700 block select-all cursor-text">
                        {ord.no_handphone || ord.no_handphone_mask || '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">STO</span>
                      <span className="font-bold text-slate-700 block truncate">{ord.sto_co || '-'}</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block text-[7.5px] uppercase font-bold">WOK</span>
                      <span className="font-bold text-slate-700 block truncate">{ord.wok || '-'}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-1.5 rounded border border-slate-200 text-[9px] space-y-0.5">
                    <span className="text-slate-500 font-black block text-[8px] uppercase tracking-wide">
                      REMARKS / STATUS REASON:
                    </span>
                    <p className="font-bold text-slate-800 leading-tight">
                      {ord.fallout_reason_clean || pState}
                    </p>
                    <div className="text-[8.5px] text-slate-600 leading-snug break-words pt-1 border-t border-slate-200 font-mono bg-white p-1 rounded select-all cursor-text">
                      {remarksRaw || 'Tidak ada catatan tambahan.'}
                    </div>
                  </div>

                  {nearestOdp && (
                    <div className="bg-slate-50 p-1.5 rounded border border-slate-200 text-[9px] space-y-0.5">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-0.5">
                        <span className="font-black text-slate-700 text-[8px] uppercase">📍 ODP TERDEKAT</span>
                        <span className="font-bold text-blue-700 text-[8.5px]">
                          {nearestOdp.distanceMeters} m
                        </span>
                      </div>
                      <p className="font-extrabold text-blue-900 truncate" title={nearestOdp.odp_name}>
                        {nearestOdp.odp_name}
                      </p>
                      <div className="flex items-center justify-between pt-0.5">
                        <span>Port: <strong>{nearestOdp.used}/{nearestOdp.is_total}</strong> ({nearestOcc}%)</span>
                        <span className="text-white px-1.5 py-0.2 rounded text-[7.5px] font-black uppercase" style={{ backgroundColor: nearestColor }}>
                          {nearestOdp.status_final}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="text-[8px] text-blue-700 font-black pt-1 border-t border-slate-100 flex justify-between items-center">
                    <span>Tikor: {ord.lat?.toFixed(4)}, {ord.lon?.toFixed(4)}</span>
                    <span>👉 Titik Pusat Radius</span>
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
