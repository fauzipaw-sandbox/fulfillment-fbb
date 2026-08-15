import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Uploader from '../components/Uploader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const MapComponent = dynamic(() => import('../components/Map'), { ssr: false });

const ALLOWED_STOS = [
  'BNT', 'PLK', 'KKN', 'MTW', 'PPS', 'PYM', 'TML', 'AMP', 'KKP', 'KRI', 'KSO', 'PRC'
];

const VALID_KABUPATEN = [
  'BARITO SELATAN', 'KOTA PALANGKARAYA', 'GUNUNG MAS', 'BARITO UTARA',
  'BARITO TIMUR', 'KAPUAS', 'KATINGAN', 'PULANG PISAU', 'MURUNG RAYA',
];

const STO_WOK_MAP = {
  AMP: 'BARITO - KAPUAS', BNT: 'BARITO - KAPUAS', KKP: 'BARITO - KAPUAS',
  MTW: 'BARITO - KAPUAS', PPS: 'BARITO - KAPUAS', PRC: 'BARITO - KAPUAS',
  TML: 'BARITO - KAPUAS', KKN: 'PALANGKARAYA', KRI: 'PALANGKARAYA',
  KSO: 'PALANGKARAYA', PLK: 'PALANGKARAYA', PYM: 'PALANGKARAYA',
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function extractSto(odpName, existingSto) {
  if (existingSto && String(existingSto).trim() !== '' && String(existingSto).toUpperCase() !== 'UNKNOWN') {
    return String(existingSto).trim().toUpperCase();
  }
  if (!odpName) return 'UNKNOWN';
  const match = String(odpName).match(/ODP-([A-Z0-9]{3})/i);
  return match && match[1] ? match[1].toUpperCase() : 'UNKNOWN';
}

function isAllowedOdp(odpName, existingSto) {
  if (!odpName) return false;
  const nameUpper = String(odpName).trim().toUpperCase();
  if (nameUpper.startsWith('OTB-')) return false;

  const sto = extractSto(odpName, existingSto);
  if (!ALLOWED_STOS.includes(sto)) return false;

  const hasAllowedStoInName = ALLOWED_STOS.some((code) => nameUpper.includes(code));
  if (!hasAllowedStoInName) return false;

  return true;
}

function parseDateRobust(raw) {
  if (!raw) return null;
  if (typeof raw === 'number' || (!isNaN(raw) && !String(raw).includes('-') && !String(raw).includes('/'))) {
    const num = parseFloat(raw);
    if (num > 30000 && num < 60000) return new Date(Math.round((num - 25569) * 86400 * 1000));
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateFormatted(d) {
  if (!d) return '-';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
}

function parseCleanFloat(val) {
  if (val === undefined || val === null || val === '') return null;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

const renderExactSegmentLabel = (key) => (props) => {
  const { x, y, width, height, payload } = props;
  const val = payload ? payload[key] : null;

  if (val === undefined || val === null || val < 3.5 || height < 13) return null;

  return (
    <text
      x={x + width / 2}
      y={y + height / 2 + 3}
      fill="#ffffff"
      textAnchor="middle"
      fontSize={8.5}
      fontWeight="bold"
    >
      {`${val}%`}
    </text>
  );
};

// Custom X-Axis Tick Highlight Bersih untuk LAINNYA
const CustomXAxisTick = ({ x, y, payload }) => {
  const isLainnya = payload.value === 'LAINNYA';
  return (
    <g transform={`translate(${x},${y})`}>
      <text
        x={0}
        y={0}
        dy={10}
        textAnchor="end"
        fill={isLainnya ? '#ea580c' : '#334155'}
        fontWeight={isLainnya ? '900' : '700'}
        fontSize={8}
        fontStyle={isLainnya ? 'italic' : 'normal'}
        transform="rotate(-25)"
      >
        {isLainnya ? 'LAINNYA*' : payload.value}
      </text>
    </g>
  );
};

const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const totalOdpKab = payload[0]?.payload?.total || 0;
    const totalPortKab = Object.values(payload[0]?.payload?.rawPorts || {}).reduce((a, b) => a + b, 0);

    return (
      <div className="bg-white p-2.5 rounded shadow-xl border border-slate-300 text-xs font-sans space-y-1.5 z-50 min-w-[220px]">
        <p className="font-extrabold text-slate-800 border-b pb-1 text-center">
          {label === 'LAINNYA' ? 'LAINNYA (Di Luar 9 Kabupaten)' : label}
        </p>
        <div className="space-y-1">
          {payload.slice().reverse().map((entry, index) => {
            if (!entry.value || entry.value === 0) return null;
            const count = entry.payload?.rawCounts?.[entry.dataKey] || 0;
            const ports = entry.payload?.rawPorts?.[entry.dataKey] || 0;
            return (
              <div key={index} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="flex items-center font-bold" style={{ color: entry.fill }}>
                  <span className="w-2.5 h-2.5 inline-block mr-1.5 rounded-sm shadow-sm" style={{ backgroundColor: entry.fill }}></span>
                  {entry.dataKey}:
                </span>
                <span className="font-semibold text-slate-700">
                  <strong className="text-slate-900">{entry.value}%</strong> ({count.toLocaleString()} ODP | {ports.toLocaleString()} Port)
                </span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-slate-200 pt-1 mt-1 flex justify-between items-center text-[10px] font-black text-slate-800 bg-slate-50 p-1 rounded">
          <span>GRAND TOTAL:</span>
          <span>{totalOdpKab.toLocaleString()} ODP | {totalPortKab.toLocaleString()} Port</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortConfig, setSortConfig] = useState({ key: 'occ', direction: 'desc' });
  const [showUploader, setShowUploader] = useState(false);
  
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedRx, setSelectedRx] = useState('ALL');
  const [selectedKabupaten, setSelectedKabupaten] = useState('ALL');
  const [selectedPortFilter, setSelectedPortFilter] = useState('ALL');
  const [selectedStoFilter, setSelectedStoFilter] = useState('ALL');
  const [selectedWokFilter, setSelectedWokFilter] = useState('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [focusedOdp, setFocusedOdp] = useState(null);

  const [showMeasureModal, setShowMeasureModal] = useState(false);
  const [pointAInput, setPointAInput] = useState('');
  const [pointBInput, setPointBInput] = useState('');
  const [isRouting, setIsRouting] = useState(false);
  const [measureResult, setMeasureResult] = useState(null);
  const [manualMeasureLine, setManualMeasureLine] = useState(null);
  const [roadRouteCoordinates, setRoadRouteCoordinates] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/odp');
      if (res.ok) {
        const odpData = await res.json();
        const enrichedData = odpData
          .filter((item) => isAllowedOdp(item.odp_name, item.sto))
          .map((item) => {
            const isTotal = parseInt(item.is_total) || 0;
            const used = parseInt(item.used) || 0;
            const avai = parseInt(item.avai) || Math.max(0, isTotal - used);
            const rsk = isTotal > 0 ? used / isTotal : 0;
            let status = rsk === 0 ? 'BLACK' : rsk <= 0.6 ? 'GREEN' : rsk <= 0.85 ? 'YELLOW' : rsk < 0.99 ? 'ORANGE' : 'RED';
            
            let sto = extractSto(item.odp_name, item.sto);
            let wok = (item.wok || '').trim().toUpperCase();
            if (!wok || wok === 'UNKNOWN') wok = STO_WOK_MAP[sto] || 'PALANGKARAYA';

            let kab = (item.kabupaten || '').trim().toUpperCase();
            let finalKab = VALID_KABUPATEN.includes(kab) ? kab : 'LAINNYA';

            const rxVal = parseCleanFloat(item.ont_rx_level);
            const rxCategory = rxVal === null ? 'NO_DATA' : rxVal > -18 ? 'GREEN' : rxVal >= -21 ? 'YELLOW' : rxVal >= -25 ? 'ORANGE' : 'RED';

            const parsedDate = parseDateRobust(item.event_date);
            return {
              ...item,
              sto,
              wok,
              kabupaten: finalKab,
              is_total: isTotal,
              used,
              avai,
              rsk,
              parsed_date: parsedDate,
              ont_rx_level: rxVal,
              rx_category: rxCategory,
              status_final: status,
            };
          });

        setData(enrichedData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const fullyFilteredData = useMemo(() => {
    return data.filter((d) => {
      const matchStatus = selectedStatus === 'ALL' || d.status_final === selectedStatus;
      const matchRx = selectedRx === 'ALL' || d.rx_category === selectedRx;
      const matchKab = selectedKabupaten === 'ALL' || d.kabupaten === selectedKabupaten;
      const matchSto = selectedStoFilter === 'ALL' || d.sto === selectedStoFilter;
      const matchWok = selectedWokFilter === 'ALL' || d.wok === selectedWokFilter;
      const matchPort = selectedPortFilter === 'ALL' || (selectedPortFilter === 'USED' && d.used > 0) || (selectedPortFilter === 'AVAI' && d.avai > 0);
      
      return matchStatus && matchRx && matchKab && matchSto && matchWok && matchPort;
    });
  }, [data, selectedStatus, selectedRx, selectedKabupaten, selectedStoFilter, selectedWokFilter, selectedPortFilter]);

  const headerCutoffText = useMemo(() => {
    if (data.length === 0) return '*Cut Off Data until -';
    const dates = data.map((d) => d.parsed_date?.getTime()).filter((t) => t && !isNaN(t));
    if (dates.length === 0) return '*Cut Off Data';
    const latestDate = new Date(Math.max(...dates));
    return `*Cut Off Data until ${formatDateFormatted(latestDate)}`;
  }, [data]);

  const statsOverview = useMemo(() => {
    let totalPort = 0, usedPort = 0, avaiPort = 0;
    let colorCounts = { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    let colorPorts = { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    let rxCounts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0, NO_DATA: 0 };
    let rxPorts = { GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0, NO_DATA: 0 };

    fullyFilteredData.forEach(item => {
      totalPort += item.is_total;
      usedPort += item.used;
      avaiPort += item.avai;
      if (colorCounts[item.status_final] !== undefined) {
        colorCounts[item.status_final]++;
        colorPorts[item.status_final] += item.is_total;
      }
      if (rxCounts[item.rx_category] !== undefined) {
        rxCounts[item.rx_category]++;
        rxPorts[item.rx_category] += item.is_total;
      }
    });

    return { totalPort, usedPort, avaiPort, colorCounts, colorPorts, rxCounts, rxPorts };
  }, [fullyFilteredData]);

  const statsFiltered = useMemo(() => {
    const kabMap = {}, flatStosMap = {};
    VALID_KABUPATEN.concat(['LAINNYA']).forEach(k => {
      kabMap[k] = { name: k, rawCounts: { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 }, rawPorts: { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 }, total: 0 };
    });

    fullyFilteredData.forEach(item => {
      const kab = item.kabupaten;
      if (!kabMap[kab]) {
        kabMap[kab] = { name: kab, rawCounts: { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 }, rawPorts: { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 }, total: 0 };
      }
      kabMap[kab].rawCounts[item.status_final]++;
      kabMap[kab].rawPorts[item.status_final] += item.is_total;
      kabMap[kab].total++;

      const key = `${item.wok}_${item.sto}`;
      if (!flatStosMap[key]) flatStosMap[key] = { wok: item.wok, sto: item.sto, odp_count: 0, is_total: 0, used: 0, avai: 0 };
      flatStosMap[key].odp_count++;
      flatStosMap[key].is_total += item.is_total;
      flatStosMap[key].used += item.used;
      flatStosMap[key].avai += item.avai;
    });

    const chartData = Object.values(kabMap).filter(k => k.total > 0 || VALID_KABUPATEN.includes(k.name)).map(k => {
      const tot = k.total || 1;
      return {
        name: k.name,
        BLACK: parseFloat(((k.rawCounts.BLACK / tot) * 100).toFixed(1)),
        GREEN: parseFloat(((k.rawCounts.GREEN / tot) * 100).toFixed(1)),
        YELLOW: parseFloat(((k.rawCounts.YELLOW / tot) * 100).toFixed(1)),
        ORANGE: parseFloat(((k.rawCounts.ORANGE / tot) * 100).toFixed(1)),
        RED: parseFloat(((k.rawCounts.RED / tot) * 100).toFixed(1)),
        rawCounts: k.rawCounts,
        rawPorts: k.rawPorts,
        total: k.total,
      };
    });

    const flatStos = Object.values(flatStosMap).map(row => ({
      ...row,
      occ: row.is_total > 0 ? (row.used / row.is_total) * 100 : 0,
      avai_perc: row.is_total > 0 ? (row.avai / row.is_total) * 100 : 0,
    }));

    return { chartData, flatStos };
  }, [fullyFilteredData]);

  const sortedTableData = useMemo(() => {
    let sortableItems = [...statsFiltered.flatStos];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
        if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [statsFiltered.flatStos, sortConfig]);

  const tableTotals = useMemo(() => {
    let odp = 0, is_total = 0, used = 0, avai = 0;
    statsFiltered.flatStos.forEach((r) => {
      odp += r.odp_count;
      is_total += r.is_total;
      used += r.used;
      avai += r.avai;
    });
    const occ = is_total > 0 ? (used / is_total) * 100 : 0;
    const avai_perc = is_total > 0 ? (avai / is_total) * 100 : 0;
    return { odp, is_total, used, avai, occ, avai_perc };
  }, [statsFiltered.flatStos]);

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'asc';
    setSortConfig({ key, direction });
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (val.length >= 3) {
      const lower = val.toLowerCase();
      const suggs = fullyFilteredData.filter(d => (d.odp_name && d.odp_name.toLowerCase().includes(lower)) || (d.kabupaten && d.kabupaten.toLowerCase().includes(lower)) || (d.sto && d.sto.toLowerCase().includes(lower))).slice(0, 8);
      setSuggestions(suggs);
    } else {
      setSuggestions([]);
    }
  };

  const parsePoint = (input) => {
    if (!input) return null;
    const clean = input.trim();
    if (clean.includes(',')) {
      const parts = clean.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { name: clean, lat: parts[0], lon: parts[1] };
    }
    const found = data.find((d) => d.odp_name && d.odp_name.toLowerCase() === clean.toLowerCase());
    if (found && found.latitude && found.longitude) return { name: found.odp_name, lat: found.latitude, lon: found.longitude };
    return null;
  };

  const handleCalculateRoadDistance = async () => {
    const pA = parsePoint(pointAInput);
    const pB = parsePoint(pointBInput);
    if (!pA || !pB) {
      alert('Masukkan Titik A dan B yang valid!');
      return;
    }
    setIsRouting(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${pA.lon},${pA.lat};${pB.lon},${pB.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.code === 'Ok' && json.routes && json.routes.length > 0) {
        const route = json.routes[0];
        const distanceMeters = route.distance;
        const distanceKm = distanceMeters / 1000;
        const latlngs = route.geometry.coordinates.map((c) => [c[1], c[0]]);
        setRoadRouteCoordinates(latlngs);
        setManualMeasureLine([[pA.lat, pA.lon], [pB.lat, pB.lon]]);
        setMeasureResult({ from: pA.name, to: pB.name, km: distanceKm.toFixed(2), meter: Math.round(distanceMeters).toLocaleString() });
      } else {
        throw new Error('Rute tidak ditemukan');
      }
    } catch (err) {
      setManualMeasureLine([[pA.lat, pA.lon], [pB.lat, pB.lon]]);
      setRoadRouteCoordinates([[pA.lat, pA.lon], [pB.lat, pB.lon]]);
    } finally {
      setIsRouting(false);
    }
  };

  const resetAllFilters = () => {
    setSelectedStatus('ALL');
    setSelectedRx('ALL');
    setSelectedKabupaten('ALL');
    setSelectedPortFilter('ALL');
    setSelectedStoFilter('ALL');
    setSelectedWokFilter('ALL');
  };

  const totalOdp = fullyFilteredData.length;
  const occTotal = statsOverview.totalPort > 0 ? ((statsOverview.usedPort / statsOverview.totalPort) * 100).toFixed(1) : '0.0';
  const avaiTotal = statsOverview.totalPort > 0 ? ((statsOverview.avaiPort / statsOverview.totalPort) * 100).toFixed(1) : '0.0';
  const totalRxValid = totalOdp - statsOverview.rxCounts.NO_DATA;

  const getAvailBg = (availPerc) => {
    if (availPerc <= 1) return 'bg-[#fca5a5] text-red-950 font-bold';
    if (availPerc <= 15) return 'bg-[#fed7aa] text-orange-950 font-bold';
    if (availPerc <= 40) return 'bg-[#fef08a] text-yellow-950 font-bold';
    return 'bg-[#86efac] text-emerald-950 font-bold';
  };

  return (
    <div className="min-h-screen p-2 sm:p-4 text-gray-800 font-sans text-xs bg-[#f1f5f9] relative">
      <Head>
        <title>ODP Profile & Utilization</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      </Head>

      {loading && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-sm flex flex-col items-center justify-center text-white">
          <div className="relative flex items-center justify-center mb-4">
            <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <div className="w-8 h-8 border-4 border-indigo-200 border-b-transparent rounded-full animate-spin absolute"></div>
          </div>
          <p className="text-base font-extrabold tracking-wider animate-pulse">MEMUAT DATA...</p>
        </div>
      )}

      <div className="max-w-[1450px] mx-auto space-y-3">
        {/* HEADER UTAMA */}
        <div className="bg-gradient-to-r from-[#211c47] to-[#3a3575] text-white p-3 sm:p-4 flex flex-col md:flex-row justify-between items-start md:items-center border-b-4 border-purple-500 rounded-t-lg shadow-sm gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-wide uppercase italic">
              ODP PROFILE & UTILIZATION
            </h1>
            <p className="text-[10px] sm:text-xs font-semibold mt-0.5 opacity-90 text-yellow-300">
              {headerCutoffText}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUploader(!showUploader)}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded shadow transition"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${showUploader ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showUploader ? 'Tutup Upload' : 'Upload Data ODP'}
            </button>
          </div>
        </div>

        {/* NARASI SUMMARY */}
        <div className="bg-white px-3 sm:px-4 py-2 text-xs sm:text-[13px] border border-gray-200 shadow-sm rounded flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            Total <strong className="font-extrabold">jumlah ODP</strong> di Branch Palangkaraya adalah{' '}
            <strong className="font-extrabold">{(totalOdp / 1000).toFixed(1)}K</strong> (
            {(statsOverview.totalPort / 1000).toFixed(1)} K Port) dengan Occupancy{' '}
            <strong className="font-extrabold">
              {(statsOverview.usedPort / 1000).toFixed(1)}K Port ({occTotal}%)
            </strong>{' '}
            dan{' '}
            <strong className="font-extrabold">
              {(statsOverview.avaiPort / 1000).toFixed(1)}K ({avaiTotal}%)
            </strong>{' '}
            port tersedia untuk <strong className="font-extrabold">penjualan baru.</strong>
          </div>
          {(selectedStatus !== 'ALL' || selectedRx !== 'ALL' || selectedKabupaten !== 'ALL' || selectedPortFilter !== 'ALL' || selectedStoFilter !== 'ALL' || selectedWokFilter !== 'ALL') && (
            <button
              onClick={resetAllFilters}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold whitespace-nowrap self-start sm:self-auto shadow"
            >
              ✕ Reset Semua Filter ({selectedStoFilter !== 'ALL' ? `STO: ${selectedStoFilter}` : selectedWokFilter !== 'ALL' ? `WOK: ${selectedWokFilter}` : 'Aktif'})
            </button>
          )}
        </div>

        {showUploader && (
          <div className="transition-all duration-300">
            <Uploader onUploadSuccess={fetchData} rawData={data} />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
          {/* ================= KOLOM KIRI ================= */}
          <div className="space-y-3 sm:space-y-4">
            {/* OVERVIEW ODP PROFILE */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-xs sm:text-sm tracking-wide">
                OVERVIEW ODP PROFILE{' '}
                <span className="text-[10px] font-normal text-purple-200">
                  {selectedStatus !== 'ALL' ? `[Filter: ${selectedStatus}]` : '(Klik box untuk filter)'}
                </span>
              </div>

              <div className="p-2 sm:p-3 grid grid-cols-3 gap-2 sm:gap-3 text-center">
                <div className="col-span-1 space-y-1.5 sm:space-y-2">
                  <div
                    onClick={() => setSelectedPortFilter('ALL')}
                    className={`border p-1.5 sm:p-2 rounded cursor-pointer transition-transform hover:scale-105 ${
                      selectedPortFilter === 'ALL' ? 'border-blue-300 bg-blue-50/70 shadow-sm' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <p className="text-[8px] sm:text-[9px] font-bold text-blue-800 uppercase">TOTAL ODP (Port)</p>
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                      {totalOdp.toLocaleString()}{' '}
                      <span className="text-[10px] sm:text-xs font-bold text-slate-600">({(statsOverview.totalPort / 1000).toFixed(1)} K)</span>
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedPortFilter('USED')}
                    className={`border p-1.5 sm:p-2 rounded cursor-pointer transition-transform hover:scale-105 ${
                      selectedPortFilter === 'USED' ? 'border-emerald-600 bg-emerald-100 ring-2 ring-emerald-500 shadow' : 'border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100'
                    }`}
                  >
                    <p className="text-[8px] sm:text-[9px] font-black text-emerald-800 uppercase">USED PORT (Active)</p>
                    <p className="text-sm sm:text-base font-extrabold text-emerald-950 mt-0.5">
                      {(statsOverview.usedPort / 1000).toFixed(1)} K{' '}
                      <span className="text-[10px] sm:text-xs font-bold text-emerald-800">({occTotal}%)</span>
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedPortFilter('AVAI')}
                    className={`border p-1.5 sm:p-2 rounded cursor-pointer transition-transform hover:scale-105 ${
                      selectedPortFilter === 'AVAI' ? 'border-red-600 bg-red-100 ring-2 ring-red-500 shadow' : 'border-red-300 bg-red-50/80 hover:bg-red-100'
                    }`}
                  >
                    <p className="text-[8px] sm:text-[9px] font-black text-red-800 uppercase">AVAI PORT (Non Active)</p>
                    <p className="text-sm sm:text-base font-extrabold text-red-950 mt-0.5">
                      {(statsOverview.avaiPort / 1000).toFixed(1)} K{' '}
                      <span className="text-[10px] sm:text-xs font-bold text-red-800">({avaiTotal}%)</span>
                    </p>
                  </div>
                </div>

                {/* BLACK ODP */}
                <div
                  onClick={() => setSelectedStatus((p) => (p === 'BLACK' ? 'ALL' : 'BLACK'))}
                  className={`col-span-1 border border-gray-400 p-2 shadow-inner flex flex-col justify-center cursor-pointer transition-transform hover:scale-105 rounded relative ${
                    selectedStatus === 'BLACK' ? 'ring-3 ring-black bg-gray-100' : 'bg-white'
                  }`}
                >
                  <div className="bg-black text-white text-[9px] font-bold px-2 py-0.5 w-max mx-auto border border-gray-400 absolute -top-2 left-0 right-0 rounded-sm">
                    BLACK ODP
                  </div>
                  <p className="text-2xl sm:text-3xl font-black mt-3">
                    {statsOverview.colorCounts.BLACK.toLocaleString()}
                  </p>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">
                    {totalOdp > 0 ? ((statsOverview.colorCounts.BLACK / totalOdp) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[10px] font-bold text-slate-700 mt-1">
                    {(statsOverview.colorPorts.BLACK / 1000).toFixed(1)} K Port ({statsOverview.colorPorts.BLACK.toLocaleString()})
                  </p>
                </div>

                {/* Colored ODP */}
                <div className="col-span-1 grid grid-cols-2 gap-1.5 sm:gap-2">
                  <div
                    onClick={() => setSelectedStatus((p) => (p === 'YELLOW' ? 'ALL' : 'YELLOW'))}
                    className={`text-center cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'YELLOW' ? 'ring-2 ring-yellow-500 bg-yellow-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#facc15] text-slate-900 text-[8px] font-bold px-0.5 py-0.5 rounded-sm">YELLOW</div>
                    <p className="text-sm sm:text-base font-extrabold mt-0.5">{statsOverview.colorCounts.YELLOW.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-600">
                      {totalOdp > 0 ? ((statsOverview.colorCounts.YELLOW / totalOdp) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-[9px] font-bold text-yellow-800">
                      {(statsOverview.colorPorts.YELLOW / 1000).toFixed(1)}K Port
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedStatus((p) => (p === 'GREEN' ? 'ALL' : 'GREEN'))}
                    className={`text-center cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'GREEN' ? 'ring-2 ring-green-600 bg-green-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#16a34a] text-white text-[8px] font-bold px-0.5 py-0.5 rounded-sm">GREEN</div>
                    <p className="text-sm sm:text-base font-extrabold mt-0.5">{statsOverview.colorCounts.GREEN.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-emerald-700">
                      {totalOdp > 0 ? ((statsOverview.colorCounts.GREEN / totalOdp) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-[9px] font-bold text-emerald-800">
                      {(statsOverview.colorPorts.GREEN / 1000).toFixed(1)}K Port
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedStatus((p) => (p === 'ORANGE' ? 'ALL' : 'ORANGE'))}
                    className={`text-center cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'ORANGE' ? 'ring-2 ring-orange-500 bg-orange-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#ea580c] text-white text-[8px] font-bold px-0.5 py-0.5 rounded-sm">ORANGE</div>
                    <p className="text-sm sm:text-base font-extrabold mt-0.5">{statsOverview.colorCounts.ORANGE.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-600">
                      {totalOdp > 0 ? ((statsOverview.colorCounts.ORANGE / totalOdp) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-[9px] font-bold text-orange-800">
                      {(statsOverview.colorPorts.ORANGE / 1000).toFixed(1)}K Port
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedStatus((p) => (p === 'RED' ? 'ALL' : 'RED'))}
                    className={`text-center cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'RED' ? 'ring-2 ring-red-600 bg-red-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#ef4444] text-white text-[8px] font-bold px-0.5 py-0.5 rounded-sm">RED</div>
                    <p className="text-sm sm:text-base font-extrabold mt-0.5">{statsOverview.colorCounts.RED.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-red-600">
                      {totalOdp > 0 ? ((statsOverview.colorCounts.RED / totalOdp) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-[9px] font-bold text-red-800">
                      {(statsOverview.colorPorts.RED / 1000).toFixed(1)}K Port
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-5 border-t border-slate-200 bg-[#f8fafc] py-1.5 text-center text-[9px] sm:text-[10px] font-bold text-slate-700">
                <span className="flex items-center justify-center"><div className="w-3.5 sm:w-5 h-2 bg-black mr-1 rounded-sm"></div>0%</span>
                <span className="flex items-center justify-center"><div className="w-3.5 sm:w-5 h-2 bg-[#16a34a] mr-1 rounded-sm"></div>&lt;60%</span>
                <span className="flex items-center justify-center"><div className="w-3.5 sm:w-5 h-2 bg-[#facc15] mr-1 rounded-sm"></div>&lt;85%</span>
                <span className="flex items-center justify-center"><div className="w-3.5 sm:w-5 h-2 bg-[#ea580c] mr-1 rounded-sm"></div>&lt;99%</span>
                <span className="flex items-center justify-center"><div className="w-3.5 sm:w-5 h-2 bg-[#ef4444] mr-1 rounded-sm"></div>100%</span>
              </div>
            </div>

            {/* KUALITAS REDAMAN (ONT RX LEVEL) */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#059669] via-[#0d9488] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-xs sm:text-sm tracking-wide">
                KUALITAS REDAMAN (ONT RX LEVEL){' '}
                <span className="text-[10px] font-normal text-emerald-200">
                  {selectedRx !== 'ALL' ? `[Filter: ${selectedRx}]` : '(Klik box untuk filter)'}
                </span>
              </div>

              <div className="p-2 sm:p-3 grid grid-cols-4 gap-2 text-center">
                <div
                  onClick={() => setSelectedRx((p) => (p === 'GREEN' ? 'ALL' : 'GREEN'))}
                  className={`p-2 rounded border cursor-pointer transition-transform hover:scale-105 ${
                    selectedRx === 'GREEN' ? 'ring-2 ring-emerald-600 bg-emerald-100 shadow' : 'bg-emerald-50 border-emerald-200'
                  }`}
                >
                  <div className="bg-emerald-600 text-white text-[9px] font-bold py-0.5 rounded-sm">&gt; -18 dBm</div>
                  <p className="text-base sm:text-lg font-black text-emerald-900 mt-1">{statsOverview.rxCounts.GREEN.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-emerald-700">
                    {totalRxValid > 0 ? ((statsOverview.rxCounts.GREEN / totalRxValid) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[9px] font-bold text-emerald-800 mt-0.5">
                    {(statsOverview.rxPorts.GREEN / 1000).toFixed(1)}K Port
                  </p>
                </div>

                <div
                  onClick={() => setSelectedRx((p) => (p === 'YELLOW' ? 'ALL' : 'YELLOW'))}
                  className={`p-2 rounded border cursor-pointer transition-transform hover:scale-105 ${
                    selectedRx === 'YELLOW' ? 'ring-2 ring-yellow-500 bg-yellow-100 shadow' : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="bg-yellow-400 text-black text-[9px] font-bold py-0.5 rounded-sm">-19 s/d -21</div>
                  <p className="text-base sm:text-lg font-black text-yellow-950 mt-1">{statsOverview.rxCounts.YELLOW.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-yellow-800">
                    {totalRxValid > 0 ? ((statsOverview.rxCounts.YELLOW / totalRxValid) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[9px] font-bold text-yellow-800 mt-0.5">
                    {(statsOverview.rxPorts.YELLOW / 1000).toFixed(1)}K Port
                  </p>
                </div>

                <div
                  onClick={() => setSelectedRx((p) => (p === 'ORANGE' ? 'ALL' : 'ORANGE'))}
                  className={`p-2 rounded border cursor-pointer transition-transform hover:scale-105 ${
                    selectedRx === 'ORANGE' ? 'ring-2 ring-orange-500 bg-orange-100 shadow' : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className="bg-orange-500 text-white text-[9px] font-bold py-0.5 rounded-sm">-21 s/d -25</div>
                  <p className="text-base sm:text-lg font-black text-orange-950 mt-1">{statsOverview.rxCounts.ORANGE.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-orange-800">
                    {totalRxValid > 0 ? ((statsOverview.rxCounts.ORANGE / totalRxValid) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[9px] font-bold text-orange-800 mt-0.5">
                    {(statsOverview.rxPorts.ORANGE / 1000).toFixed(1)}K Port
                  </p>
                </div>

                <div
                  onClick={() => setSelectedRx((p) => (p === 'RED' ? 'ALL' : 'RED'))}
                  className={`p-2 rounded border cursor-pointer transition-transform hover:scale-105 ${
                    selectedRx === 'RED' ? 'ring-2 ring-red-600 bg-red-100 shadow' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="bg-red-600 text-white text-[9px] font-bold py-0.5 rounded-sm">&lt; -25 dBm</div>
                  <p className="text-base sm:text-lg font-black text-red-950 mt-1">{statsOverview.rxCounts.RED.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-red-700">
                    {totalRxValid > 0 ? ((statsOverview.rxCounts.RED / totalRxValid) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[9px] font-bold text-red-800 mt-0.5">
                    {(statsOverview.rxPorts.RED / 1000).toFixed(1)}K Port
                  </p>
                </div>
              </div>
            </div>

            {/* ODP SHARE KABUPATEN LEVEL */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#4c1d95] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-xs sm:text-sm tracking-wide">
                ODP SHARE KABUPATEN LEVEL{' '}
                <span className="text-[10px] font-normal text-purple-200">
                  {selectedKabupaten !== 'ALL' ? `[Filter: ${selectedKabupaten}]` : '(Klik batang untuk filter)'}
                </span>
              </div>
              <div className="p-2 sm:p-4 pt-4 sm:pt-6">
                <h4 className="text-center font-bold text-gray-500 text-xs mb-2">
                  PROFIL ODP BRANCH PALANGKARAYA
                </h4>
                <div className="h-64 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={statsFiltered.chartData}
                      margin={{ top: 5, right: 0, left: -25, bottom: 40 }}
                      onClick={(e) => {
                        if (e && e.activeLabel) {
                          setSelectedKabupaten((prev) => (prev === e.activeLabel ? 'ALL' : e.activeLabel));
                        }
                      }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        interval={0}
                        tick={<CustomXAxisTick />}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fontWeight: 'bold' }}
                        domain={[0, 100]}
                        ticks={[0, 25, 50, 75, 100]}
                        tickFormatter={(val) => `${Math.round(val)}%`}
                      />
                      <Tooltip content={<CustomChartTooltip />} />
                      
                      <Bar dataKey="BLACK" stackId="a" fill="#000000" label={renderExactSegmentLabel('BLACK')} />
                      <Bar dataKey="GREEN" stackId="a" fill="#16a34a" label={renderExactSegmentLabel('GREEN')} />
                      <Bar dataKey="YELLOW" stackId="a" fill="#facc15" label={renderExactSegmentLabel('YELLOW')} />
                      <Bar dataKey="ORANGE" stackId="a" fill="#ea580c" label={renderExactSegmentLabel('ORANGE')} />
                      <Bar dataKey="RED" stackId="a" fill="#ef4444" label={renderExactSegmentLabel('RED')} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* ================= KOLOM KANAN ================= */}
          <div className="space-y-3 sm:space-y-4">
            {/* MAPS LOKASI ODP */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm relative">
              <div className="bg-gradient-to-r from-[#1e3a8a] to-[#3a3575] text-white p-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm">MAPS LOKASI ODP</span>
                  <button
                    type="button"
                    onClick={() => setShowMeasureModal(!showMeasureModal)}
                    className="px-2 py-0.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-[10px] font-semibold flex items-center gap-1 shadow"
                  >
                    <span>🚗</span> Ukur Jarak Rute Darat
                  </button>
                </div>

                <div className="relative w-full sm:w-64 z-[1001]">
                  <input
                    type="text"
                    placeholder="Cari ODP / STO / Kab..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full px-2.5 py-1 text-black rounded text-xs outline-none shadow-sm"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full bg-white text-black mt-1 rounded shadow-xl border border-gray-300 overflow-hidden max-h-52 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setFocusedOdp(s);
                            setSuggestions([]);
                            setSearchTerm(s.odp_name);
                          }}
                          className="p-2 border-b border-gray-100 hover:bg-blue-50 cursor-pointer text-[10px] transition"
                        >
                          <strong className="text-blue-700">{s.odp_name}</strong> - {s.sto} ({s.kabupaten})
                          <span className="ml-1 text-gray-500">[{s.status_final}]</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {showMeasureModal && (
                <div className="bg-slate-50 p-2.5 border-b border-slate-200 text-xs space-y-2">
                  <p className="font-bold text-slate-800 text-[11px]">Hitung Jarak Darat (Jalan Raya) Berdasarkan ODP Name / Koordinat:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Titik A:</label>
                      <input
                        type="text"
                        placeholder="Contoh: ODP-PLK-FAA/01"
                        value={pointAInput}
                        onChange={(e) => setPointAInput(e.target.value)}
                        className="w-full p-1 border rounded text-xs mt-0.5 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Titik B:</label>
                      <input
                        type="text"
                        placeholder="Contoh: ODP-PLK-FAA/05"
                        value={pointBInput}
                        onChange={(e) => setPointBInput(e.target.value)}
                        className="w-full p-1 border rounded text-xs mt-0.5 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      disabled={isRouting}
                      onClick={handleCalculateRoadDistance}
                      className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-[11px] hover:bg-blue-700 shadow disabled:opacity-50"
                    >
                      {isRouting ? 'Menghitung Rute...' : '🚗 Hitung Jarak Jalan & Gambar di Peta'}
                    </button>
                    {measureResult && (
                      <p className="font-bold text-blue-900 text-xs">
                        Jarak: <span className="text-emerald-700 font-black">{measureResult.km} km</span> ({measureResult.meter} m)
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="h-[280px] sm:h-[350px] p-1 bg-gray-100">
                <MapComponent
                  data={fullyFilteredData}
                  focusLocation={focusedOdp}
                  manualMeasureLine={manualMeasureLine}
                  manualMeasureInfo={measureResult}
                  roadRouteCoordinates={roadRouteCoordinates}
                />
              </div>
            </div>

            {/* OCCUPANCY & AVAILABLE PORT */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-xs sm:text-sm tracking-wide">
                OCCUPANCY & AVAILABLE PORT{' '}
                <span className="text-[10px] font-normal text-purple-200">
                  (Klik STO / WOK untuk filter)
                </span>
              </div>

              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full text-center border-collapse min-w-[500px]">
                  <thead className="bg-[#0f172a] text-white text-[9px] sm:text-[10px] sticky top-0 z-10 shadow-md cursor-pointer">
                    <tr>
                      <th className="p-1.5 border border-gray-400 hover:bg-gray-800" onClick={() => requestSort('wok')}>
                        WOK {sortConfig.key === 'wok' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th className="p-1.5 border border-gray-400 hover:bg-gray-800" onClick={() => requestSort('sto')}>
                        STO {sortConfig.key === 'sto' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th className="p-1.5 border border-gray-400 hover:bg-gray-800" onClick={() => requestSort('odp_count')}>
                        # Odp {sortConfig.key === 'odp_count' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th className="p-1.5 border border-gray-400 hover:bg-gray-800" onClick={() => requestSort('is_total')}>
                        # Port {sortConfig.key === 'is_total' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th className="p-1.5 border border-gray-400 hover:bg-gray-800" onClick={() => requestSort('used')}>
                        # Used {sortConfig.key === 'used' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th className="p-1.5 border border-gray-400 hover:bg-gray-800" onClick={() => requestSort('avai')}>
                        # Avail {sortConfig.key === 'avai' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th className="p-1.5 border border-gray-400 hover:bg-gray-800 bg-[#3b82f6]" onClick={() => requestSort('occ')}>
                        % OCC {sortConfig.key === 'occ' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th className="p-1.5 border border-gray-400 hover:bg-gray-800" onClick={() => requestSort('avai_perc')}>
                        % Avail {sortConfig.key === 'avai_perc' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[9px] sm:text-[10px]">
                    {sortedTableData.map((row, idx) => {
                      let occBg = 'bg-[#86efac] text-green-900';
                      if (row.occ === 0) occBg = 'bg-gray-200 text-gray-800';
                      else if (row.occ >= 99) occBg = 'bg-[#fca5a5] text-red-900';
                      else if (row.occ >= 85) occBg = 'bg-[#fdba74] text-orange-900';
                      else if (row.occ >= 60) occBg = 'bg-[#fde047] text-yellow-900';

                      const availBg = getAvailBg(row.avai_perc);
                      const isStoSelected = selectedStoFilter === row.sto;
                      const isWokSelected = selectedWokFilter === row.wok;

                      return (
                        <tr
                          key={`${row.wok}_${row.sto}_${idx}`}
                          className={`border-b border-gray-300 transition ${
                            isStoSelected || isWokSelected ? 'bg-blue-100 ring-1 ring-blue-500' : 'bg-white hover:bg-slate-100'
                          }`}
                        >
                          <td
                            onClick={() => setSelectedWokFilter((prev) => (prev === row.wok ? 'ALL' : row.wok))}
                            className="p-1 border border-gray-300 font-bold text-gray-600 cursor-pointer hover:text-blue-700 hover:underline"
                            title="Klik untuk filter WOK"
                          >
                            {row.wok}
                          </td>

                          <td
                            onClick={() => setSelectedStoFilter((prev) => (prev === row.sto ? 'ALL' : row.sto))}
                            className="p-1 border border-gray-300 font-bold text-gray-700 cursor-pointer hover:text-blue-700 hover:underline"
                            title="Klik untuk filter STO"
                          >
                            {row.sto}
                          </td>

                          <td className="p-1 border border-gray-300 text-gray-600">{row.odp_count.toLocaleString()}</td>
                          <td className="p-1 border border-gray-300 text-gray-600">{row.is_total.toLocaleString()}</td>
                          <td className="p-1 border border-gray-300 text-gray-600">{row.used.toLocaleString()}</td>
                          <td className="p-1 border border-gray-300 text-gray-600">{row.avai.toLocaleString()}</td>
                          <td className={`p-1 border border-gray-300 font-bold ${occBg}`}>{row.occ.toFixed(1)}%</td>
                          <td className={`p-1 border border-gray-300 ${availBg}`}>{row.avai_perc.toFixed(1)}%</td>
                        </tr>
                      );
                    })}

                    <tr className="bg-[#0f172a] text-white font-extrabold sticky bottom-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.2)]">
                      <td colSpan={2} className="p-2 border border-slate-700 text-left pl-3 uppercase">
                        Grand Total
                      </td>
                      <td className="p-2 border border-slate-700">{tableTotals.odp.toLocaleString()}</td>
                      <td className="p-2 border border-slate-700">{tableTotals.is_total.toLocaleString()}</td>
                      <td className="p-2 border border-slate-700">{tableTotals.used.toLocaleString()}</td>
                      <td className="p-2 border border-slate-700">{tableTotals.avai.toLocaleString()}</td>
                      <td className="p-2 border border-slate-700 text-white font-bold">
                        {tableTotals.occ.toFixed(1)}%
                      </td>
                      <td className="p-2 border border-slate-700 text-white font-bold">
                        {tableTotals.avai_perc.toFixed(1)}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
