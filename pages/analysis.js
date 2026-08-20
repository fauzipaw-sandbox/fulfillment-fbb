import React, { useState, useMemo, useEffect, useRef } from 'react';
import Head from 'next/head';
import Papa from 'papaparse';
import Sidebar from '../components/Sidebar';
import Uploader from '../components/Uploader';
import { useData } from '../context/DataContext';
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

if (typeof window !== 'undefined') {
  delete L.Icon.Default.prototype._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

const ALLOWED_STOS = [
  'BNT', 'PLK', 'KKN', 'MTW', 'PPS', 'PYM', 'TML', 'AMP', 'KKP', 'KRI', 'KSO', 'PRC'
];

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

function extractOrderCoordinates(order) {
  if (!order) return null;
  const reason = String(order.fallout_reason || '');
  const match = reason.match(/KP:\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
  if (match && match[1] && match[2]) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lon)) return { lat, lon, coordSource: 'KP' };
  }
  const lat = typeof order.latitude === 'number' ? order.latitude : parseFloat(order.latitude);
  const lon = typeof order.longitude === 'number' ? order.longitude : parseFloat(order.longitude);
  if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
    return { lat, lon, coordSource: 'ROW' };
  }
  return null;
}

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

function FullFeaturedAnalysisMap({
  odpData,
  ordersData,
  selectedTarget,
  radiusLimit,
  onSelectTarget,
  selectedOrderState,
  setSelectedOrderState,
  availableProcessStates,
}) {
  const defaultCenter = [-1.7, 114.8];
  const containerRef = useRef(null);

  const [mapType, setMapType] = useState('street');
  const [measureActive, setMeasureActive] = useState(false);
  const [clickPoints, setClickPoints] = useState([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      {/* Control Bar Pojok Kanan Atas (Sama Persis dengan ODP Profile) */}
      <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1.5 flex-wrap justify-end">
        {/* Dropdown Process State Order (Default: FALLOUT) */}
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

        {/* Pilihan Tampilan Peta */}
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

        {/* Ukur Jarak Tool */}
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

        {/* ================= 1. BORDER LINGKARAN RADIUS 250M ================= */}
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

        {/* ================= 2. MARKER ODP (HOVER TOOLTIP & CLICK TO SET RADIUS) ================= */}
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

        {/* ================= 3. MARKER ORDER (KLIK POPUP & KLIK TO SET RADIUS) ================= */}
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

export default function AnalysisPage() {
  const { odpData: rawOdpData, ordersData: rawOrdersData, odpLoaded, ordersLoaded, reloadAll } = useData();
  const [showUploader, setShowUploader] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [selectedSto, setSelectedSto] = useState('ALL');
  const [selectedWok, setSelectedWok] = useState('ALL');
  const [radiusLimit, setRadiusLimit] = useState(250);
  const [selectedOrderState, setSelectedOrderState] = useState('FALLOUT');

  const [searchInput, setSearchInput] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState(null);

  const [tableSearch, setTableSearch] = useState('');
  const [tableSort, setTableSort] = useState({ key: 'distanceMeters', direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const availableProcessStates = useMemo(() => {
    const set = new Set();
    (rawOrdersData || []).forEach((o) => {
      const ps = (o.process_state || '').trim().toUpperCase();
      if (ps) set.add(ps);
    });
    return Array.from(set).sort();
  }, [rawOrdersData]);

  const cleanOdpList = useMemo(() => {
    return (rawOdpData || []).filter((d) => {
      if (!d.latitude || !d.longitude || !d.odp_name) return false;
      const matchSto = selectedSto === 'ALL' || d.sto === selectedSto;
      const matchWok = selectedWok === 'ALL' || d.wok === selectedWok;
      return matchSto && matchWok;
    });
  }, [rawOdpData, selectedSto, selectedWok]);

  const cleanOrderList = useMemo(() => {
    return (rawOrdersData || [])
      .filter((o) => {
        const matchSto = selectedSto === 'ALL' || o.sto_co === selectedSto;
        const matchWok = selectedWok === 'ALL' || o.wok === selectedWok;
        return matchSto && matchWok;
      })
      .map((o) => {
        const coords = extractOrderCoordinates(o);
        return coords ? { ...o, ...coords } : null;
      })
      .filter(Boolean);
  }, [rawOrdersData, selectedSto, selectedWok]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (val.trim().length >= 2) {
      const q = val.toLowerCase();
      const matchedOdps = cleanOdpList
        .filter((d) => (d.odp_name && d.odp_name.toLowerCase().includes(q)) || (d.sto && d.sto.toLowerCase().includes(q)))
        .slice(0, 6)
        .map((d) => ({ ...d, targetType: 'ODP', displayName: d.odp_name, lat: d.latitude, lon: d.longitude }));

      const matchedOrders = cleanOrderList
        .filter((o) => (o.order_id && o.order_id.toLowerCase().includes(q)) || (o.name && o.name.toLowerCase().includes(q)))
        .slice(0, 6)
        .map((o) => ({ ...o, targetType: 'ORDER', displayName: `${o.order_id} - ${o.name || 'Pelanggan'}`, lat: o.lat, lon: o.lon }));

      setSuggestions([...matchedOdps, ...matchedOrders]);
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectTarget = (target) => {
    setSelectedTarget(target);
    setSearchInput(target.displayName || target.odp_name || target.order_id);
    setSuggestions([]);
    setCurrentPage(1);
  };

  const nearbyCombinedData = useMemo(() => {
    if (!selectedTarget || !selectedTarget.lat || !selectedTarget.lon) return [];

    const tLat = selectedTarget.lat;
    const tLon = selectedTarget.lon;
    const results = [];

    cleanOdpList.forEach((odp) => {
      const dist = calculateDistanceMeters(tLat, tLon, odp.latitude, odp.longitude);
      if (dist <= radiusLimit) {
        const isSelf = selectedTarget.targetType === 'ODP' && selectedTarget.odp_name === odp.odp_name;
        results.push({
          rowType: 'ODP',
          id: odp.odp_name,
          name: odp.odp_name,
          sto: odp.sto,
          wok: odp.wok,
          statusLabel: odp.status_final,
          distanceMeters: Math.round(dist),
          isTotal: odp.is_total || 0,
          used: odp.used || 0,
          avai: odp.avai || 0,
          occPerc: odp.is_total > 0 ? ((odp.used / odp.is_total) * 100).toFixed(1) : '0.0',
          rxLevel: odp.ont_rx_level !== null ? `${Number(odp.ont_rx_level).toFixed(2)} dBm` : '-',
          customerName: '-',
          phone: '-',
          address: odp.sto_desc || odp.desa || '-',
          remarks: odp.sto_desc || '-',
          latitude: odp.latitude,
          longitude: odp.longitude,
          isCenterTarget: isSelf,
        });
      }
    });

    cleanOrderList.forEach((ord) => {
      const dist = calculateDistanceMeters(tLat, tLon, ord.lat, ord.lon);
      if (dist <= radiusLimit) {
        const isSelf = selectedTarget.targetType === 'ORDER' && selectedTarget.order_id === ord.order_id;
        results.push({
          rowType: 'ORDER',
          id: ord.order_id,
          name: ord.order_id,
          sto: ord.sto_co,
          wok: ord.wok,
          statusLabel: ord.process_state || 'UNKNOWN',
          distanceMeters: Math.round(dist),
          isTotal: null,
          used: null,
          avai: null,
          occPerc: null,
          rxLevel: null,
          customerName: ord.name || '-',
          phone: ord.no_handphone || ord.no_handphone_mask || '-',
          address: ord.address || '-',
          remarks: ord.fallout_reason_clean || ord.fallout_reason || ord.order_status_desc || '-',
          latitude: ord.lat,
          longitude: ord.lon,
          isCenterTarget: isSelf,
        });
      }
    });

    return results;
  }, [selectedTarget, cleanOdpList, cleanOrderList, radiusLimit]);

  const sortedTableData = useMemo(() => {
    let list = nearbyCombinedData;

    if (tableSearch.trim()) {
      const q = tableSearch.toLowerCase();
      list = list.filter(
        (r) =>
          (r.id && r.id.toLowerCase().includes(q)) ||
          (r.customerName && r.customerName.toLowerCase().includes(q)) ||
          (r.sto && r.sto.toLowerCase().includes(q)) ||
          (r.statusLabel && r.statusLabel.toLowerCase().includes(q)) ||
          (r.remarks && r.remarks.toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      let valA = a[tableSort.key] ?? '';
      let valB = b[tableSort.key] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return tableSort.direction === 'asc' ? valA - valB : valB - valA;
      }
      return tableSort.direction === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [nearbyCombinedData, tableSearch, tableSort]);

  const totalPages = Math.ceil(sortedTableData.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedTableData.slice(start, start + rowsPerPage);
  }, [sortedTableData, currentPage]);

  const requestSort = (key) => {
    let direction = 'asc';
    if (tableSort.key === key && tableSort.direction === 'asc') direction = 'desc';
    setTableSort({ key, direction });
  };

  const handleExportRadiusCSV = () => {
    if (sortedTableData.length === 0) return alert('Tidak ada data radius untuk di-download.');
    const csv = Papa.unparse(sortedTableData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `analysis_radius_${radiusLimit}m_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearTarget = () => {
    setSelectedTarget(null);
    setSearchInput('');
    setSuggestions([]);
  };

  return (
    <Sidebar>
      <Head>
        <title>ODP &amp; Fulfillment Order Analysis</title>
      </Head>

      {(!odpLoaded || !ordersLoaded) && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-center text-white">
          <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs font-black tracking-wider animate-pulse">MEMUAT DATA SPASIAL ODP &amp; ORDERS...</p>
        </div>
      )}

      <div className="max-w-[1450px] mx-auto space-y-3">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#1e3a8a] via-[#3b0764] to-[#0f172a] text-white p-3 sm:p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center shadow gap-2">
          <div>
            <h1 className="text-lg sm:text-2xl font-black uppercase italic tracking-wide">
              ODP &amp; FULFILLMENT ORDER ANALYSIS
            </h1>
            <p className="text-[10px] sm:text-xs font-semibold text-yellow-300 mt-0.5">
              Pemetaan Radius Presisi &bull; Analisis Relasi Titik Order &amp; ODP Terdekat (&lt;{radiusLimit}m)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUploader(!showUploader)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded shadow transition cursor-pointer"
            >
              {showUploader ? 'Tutup Upload' : 'Upload Data'}
            </button>
          </div>
        </div>

        {showUploader && (
          <div className="transition-all duration-300">
            <Uploader onUploadOdpSuccess={reloadAll} onUploadOrderSuccess={reloadAll} />
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="bg-white p-2.5 rounded shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-700 text-[11px]">Radius:</span>
            <select
              value={radiusLimit}
              onChange={(e) => setRadiusLimit(Number(e.target.value))}
              className="p-1 border border-slate-300 rounded font-black text-blue-900 bg-blue-50 text-[11px] outline-none cursor-pointer"
            >
              <option value={100}>100 Meter</option>
              <option value={200}>200 Meter</option>
              <option value={250}>250 Meter (Standar Telkom)</option>
              <option value={300}>300 Meter</option>
              <option value={500}>500 Meter</option>
            </select>

            <select
              value={selectedWok}
              onChange={(e) => setSelectedWok(e.target.value)}
              className="p-1 border border-slate-300 rounded font-semibold text-slate-700 bg-slate-50 text-[11px]"
            >
              <option value="ALL">Semua WOK</option>
              <option value="BARITO - KAPUAS">BARITO - KAPUAS</option>
              <option value="PALANGKARAYA">PALANGKARAYA</option>
            </select>

            <select
              value={selectedSto}
              onChange={(e) => setSelectedSto(e.target.value)}
              className="p-1 border border-slate-300 rounded font-semibold text-slate-700 bg-slate-50 text-[11px]"
            >
              <option value="ALL">Semua STO</option>
              {ALLOWED_STOS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-80">
            <div className="flex items-center gap-1">
              <input
                type="text"
                placeholder="Cari ODP (e.g. ODP-PLK-FAA/01) / Order ID..."
                value={searchInput}
                onChange={handleSearchChange}
                className="w-full px-2.5 py-1.5 text-black border border-slate-300 rounded text-xs outline-none shadow-xs font-semibold focus:border-blue-500"
              />
              {selectedTarget && (
                <button
                  type="button"
                  onClick={clearTarget}
                  className="px-2 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded text-xs font-black cursor-pointer"
                  title="Hapus Target"
                >
                  ✕
                </button>
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="absolute top-full left-0 w-full bg-white text-black mt-1 rounded-lg shadow-2xl border border-slate-300 overflow-hidden max-h-60 overflow-y-auto z-[2000]">
                {suggestions.map((s, idx) => (
                  <div
                    key={`${s.targetType}-${s.id || s.odp_name}-${idx}`}
                    onClick={() => handleSelectTarget(s)}
                    className="p-2 border-b border-slate-100 hover:bg-blue-50 cursor-pointer text-[10.5px] transition flex items-center justify-between"
                  >
                    <div className="truncate">
                      <span className="font-extrabold text-blue-900 block truncate">
                        {s.targetType === 'ODP' ? `📍 ${s.odp_name}` : `🔺 ${s.order_id} (${s.name || 'Pelanggan'})`}
                      </span>
                      <span className="text-[9px] text-slate-500 font-semibold">
                        {s.sto || s.sto_co} &bull; {s.wok} &bull; {s.status_final || s.process_state}
                      </span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                      s.targetType === 'ODP' ? 'bg-blue-100 text-blue-900' : 'bg-rose-100 text-rose-900'
                    }`}>
                      {s.targetType}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Banner Target */}
        {selectedTarget ? (
          <div className="bg-blue-50 border-l-4 border-blue-600 p-2.5 rounded shadow-xs text-xs flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <p className="font-extrabold text-blue-950 flex items-center gap-1.5 text-xs sm:text-[13px]">
                <span>{selectedTarget.targetType === 'ODP' ? '📍 ODP Pusat:' : '🔺 Order Pusat:'}</span>
                <span className="text-purple-900">{selectedTarget.displayName || selectedTarget.odp_name || selectedTarget.order_id}</span>
                <span className="bg-blue-600 text-white text-[9px] font-bold px-2 py-0.2 rounded-full">
                  Radius &lt; {radiusLimit} Meter
                </span>
              </p>
              <p className="text-[10px] text-slate-600 mt-0.5">
                Ditemukan total <strong>{nearbyCombinedData.length}</strong> entitas (
                <strong>{nearbyCombinedData.filter((d) => d.rowType === 'ODP').length} ODP</strong> &amp;{' '}
                <strong>{nearbyCombinedData.filter((d) => d.rowType === 'ORDER').length} Order Pelanggan</strong>) dalam radius {radiusLimit} meter.
              </p>
            </div>
            <button
              type="button"
              onClick={clearTarget}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold self-start sm:self-auto cursor-pointer shadow-xs"
            >
              ✕ Hapus Radius
            </button>
          </div>
        ) : (
          <div className="bg-slate-100 border border-slate-300 p-2 rounded text-[11px] text-slate-600 font-semibold">
            💡 <strong>Tips:</strong> Ketik nama ODP / Order ID di kotak pencarian atau klik titik marker pada peta untuk membuat <strong>lingkaran radius &lt; {radiusLimit}m</strong> dan melihat ODP terdekat serta jaraknya ke pelanggan.
          </div>
        )}

        {/* MAPS LUAS & LENGKAP */}
        <div className="bg-white border border-slate-300 shadow-sm rounded-lg overflow-hidden h-[450px] sm:h-[520px]">
          {isMounted ? (
            <FullFeaturedAnalysisMap
              odpData={cleanOdpList}
              ordersData={cleanOrderList}
              selectedTarget={selectedTarget}
              radiusLimit={radiusLimit}
              onSelectTarget={handleSelectTarget}
              selectedOrderState={selectedOrderState}
              setSelectedOrderState={setSelectedOrderState}
              availableProcessStates={availableProcessStates}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 font-bold">Memuat Peta Spasial...</div>
          )}
        </div>

        {/* TABEL KOMBINASI RADIUS */}
        <div className="bg-white border border-slate-300 shadow-sm rounded-lg overflow-hidden mt-3">
          <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#334155] text-white p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-xs sm:text-sm font-black uppercase tracking-wide flex items-center gap-1.5">
                <span>📍</span> HASIL ANALISIS RADIUS &lt; {radiusLimit}M ({sortedTableData.length} Entitas)
              </h2>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Kombinasi ODP Terdekat &amp; Titik Pelanggan &bull; <em>Diurutkan berdasarkan jarak terdekat</em>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Cari ID, Pelanggan, STO, Status..."
                value={tableSearch}
                onChange={(e) => {
                  setTableSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-black rounded text-xs outline-none w-full sm:w-56"
              />
              <button
                type="button"
                onClick={handleExportRadiusCSV}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
              >
                <span>📥</span> Download Hasil Analisis CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-[10px] whitespace-nowrap">
              <thead className="bg-[#1e293b] text-white uppercase font-bold sticky top-0 z-10 shadow select-none cursor-pointer">
                <tr>
                  <th className="p-2 border border-slate-700 text-center">No</th>
                  <th className="p-2 border border-slate-700 hover:bg-slate-700" onClick={() => requestSort('rowType')}>
                    Tipe {tableSort.key === 'rowType' ? (tableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-slate-700 hover:bg-slate-700" onClick={() => requestSort('name')}>
                    Nama / Order ID {tableSort.key === 'name' ? (tableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-slate-700 hover:bg-slate-700 bg-blue-900" onClick={() => requestSort('distanceMeters')}>
                    Jarak ke Pusat {tableSort.key === 'distanceMeters' ? (tableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-slate-700 hover:bg-slate-700" onClick={() => requestSort('statusLabel')}>
                    Status / State {tableSort.key === 'statusLabel' ? (tableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-slate-700 hover:bg-slate-700" onClick={() => requestSort('sto')}>
                    STO {tableSort.key === 'sto' ? (tableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-slate-700 hover:bg-slate-700" onClick={() => requestSort('wok')}>
                    WOK {tableSort.key === 'wok' ? (tableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-slate-700 text-center">Port ODP (Used/Tot)</th>
                  <th className="p-2 border border-slate-700 text-center">% OCC</th>
                  <th className="p-2 border border-slate-700 text-center">ONT RX Level</th>
                  <th className="p-2 border border-slate-700 hover:bg-slate-700" onClick={() => requestSort('customerName')}>
                    Nama Pelanggan {tableSort.key === 'customerName' ? (tableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-slate-700">No HP</th>
                  <th className="p-2 border border-slate-700">Remarks / Fallout Reason</th>
                  <th className="p-2 border border-slate-700">Alamat / Lokasi</th>
                  <th className="p-2 border border-slate-700">Latitude</th>
                  <th className="p-2 border border-slate-700">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={16} className="p-4 text-center text-slate-400 font-bold">
                      {selectedTarget
                        ? `Tidak ada entitas ODP atau Order lain dalam radius < ${radiusLimit}m.`
                        : 'Silakan cari ODP atau Order pada peta di atas untuk memulai analisis radius.'}
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, idx) => {
                    const rowNumber = (currentPage - 1) * rowsPerPage + idx + 1;
                    const isOdp = row.rowType === 'ODP';

                    return (
                      <tr
                        key={`${row.rowType}-${row.id}-${idx}`}
                        className={`border-b border-slate-200 transition hover:bg-blue-50/70 ${
                          row.isCenterTarget ? 'bg-amber-100 font-black' : isOdp ? 'bg-white' : 'bg-rose-50/40'
                        }`}
                      >
                        <td className="p-1.5 border border-slate-200 text-center font-bold text-slate-500">{rowNumber}</td>
                        <td className="p-1.5 border border-slate-200 text-center">
                          <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase ${
                            isOdp ? 'bg-blue-100 text-blue-900 border border-blue-200' : 'bg-rose-100 text-rose-900 border border-rose-200'
                          }`}>
                            {isOdp ? '📍 ODP' : '🔺 ORDER'}
                          </span>
                        </td>
                        <td
                          className="p-1.5 border border-slate-200 font-black text-blue-900 cursor-pointer hover:underline"
                          onClick={() =>
                            handleSelectTarget({
                              ...row,
                              targetType: row.rowType,
                              odp_name: row.name,
                              order_id: row.name,
                              lat: row.latitude,
                              lon: row.longitude,
                              displayName: row.name,
                            })
                          }
                          title="Klik untuk jadikan pusat radius"
                        >
                          {row.name} {row.isCenterTarget && <span className="text-[8.5px] text-amber-700 font-bold">(TITIK PUSAT)</span>}
                        </td>
                        <td className="p-1.5 border border-slate-200 font-black text-center text-blue-800 bg-blue-50/60">
                          {row.distanceMeters === 0 ? '0 m (Pusat)' : `${row.distanceMeters} meter`}
                        </td>
                        <td className="p-1.5 border border-slate-200 font-bold">
                          <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-black ${
                            row.statusLabel === 'GREEN' || row.statusLabel === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                            row.statusLabel === 'RED' || row.statusLabel === 'FALLOUT' ? 'bg-red-100 text-red-800' :
                            row.statusLabel === 'YELLOW' || row.statusLabel === 'ORANGE' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {row.statusLabel}
                          </span>
                        </td>
                        <td className="p-1.5 border border-slate-200 font-bold">{row.sto || '-'}</td>
                        <td className="p-1.5 border border-slate-200">{row.wok || '-'}</td>
                        <td className="p-1.5 border border-slate-200 text-center font-bold">
                          {isOdp ? `${row.used}/${row.isTotal} (Avai: ${row.avai})` : '-'}
                        </td>
                        <td className="p-1.5 border border-slate-200 text-center font-bold">
                          {isOdp ? `${row.occPerc}%` : '-'}
                        </td>
                        <td className="p-1.5 border border-slate-200 text-center font-mono font-bold text-slate-700">
                          {row.rxLevel || '-'}
                        </td>
                        <td className="p-1.5 border border-slate-200 font-semibold">{row.customerName}</td>
                        <td className="p-1.5 border border-slate-200 font-mono text-[9px]">{row.phone}</td>
                        <td className="p-1.5 border border-slate-200 max-w-[220px] truncate text-slate-700" title={row.remarks}>
                          {row.remarks}
                        </td>
                        <td className="p-1.5 border border-slate-200 max-w-[180px] truncate text-slate-600" title={row.address}>
                          {row.address}
                        </td>
                        <td className="p-1.5 border border-slate-200 font-mono text-[9px]">{row.latitude?.toFixed(5)}</td>
                        <td className="p-1.5 border border-slate-200 font-mono text-[9px]">{row.longitude?.toFixed(5)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-slate-50 p-2.5 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs font-semibold">
              <span className="text-slate-600">
                Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> (Total <strong>{sortedTableData.length}</strong> entitas radius)
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                >
                  &laquo; Pertama
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                >
                  &lsaquo; Prev
                </button>
                <span className="px-2 font-bold text-slate-700">{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                >
                  Next &rsaquo;
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                >
                  Terakhir &raquo;
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
