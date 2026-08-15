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

const formatDate = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getWeekNumber = (dateString) => {
  if (!dateString) return 'Unknown';
  const d = new Date(dateString);
  if (isNaN(d)) return 'Unknown';
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `W${weekNo}`;
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

const renderCustomBarLabel = ({ x, y, width, height, value }) => {
  if (!value || value < 3 || height < 12) return null;
  return (
    <text
      x={x + width / 2}
      y={y + height / 2 + 3}
      fill="#ffffff"
      textAnchor="middle"
      fontSize={8}
      fontWeight="bold"
    >
      {`${value}%`}
    </text>
  );
};

const CustomChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-2.5 rounded shadow-lg border border-slate-300 text-xs font-sans space-y-1 z-50">
        <p className="font-bold text-slate-800 border-b pb-1 text-center">{label}</p>
        <div className="space-y-1">
          {payload.slice().reverse().map((entry, index) => {
            if (!entry.value || entry.value === 0) return null;
            const statusKey = entry.dataKey;
            const count = entry.payload?.rawCounts?.[statusKey] || 0;
            const ports = entry.payload?.rawPorts?.[statusKey] || 0;

            return (
              <div key={`item-${index}`} className="flex items-center justify-between gap-3 text-[11px]">
                <span className="flex items-center font-semibold" style={{ color: entry.fill }}>
                  <span
                    className="w-2.5 h-2.5 inline-block mr-1.5 rounded-sm"
                    style={{ backgroundColor: entry.fill }}
                  ></span>
                  {statusKey}:
                </span>
                <span className="font-medium text-slate-700">
                  <strong>{entry.value}%</strong> ({count.toLocaleString()} ODP | {ports.toLocaleString()} Port)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState('ALL');
  const [sortConfig, setSortConfig] = useState({ key: 'occ', direction: 'desc' });

  const [showUploader, setShowUploader] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [focusedOdp, setFocusedOdp] = useState(null);

  // State Fitur Measurement Jarak Darat
  const [showMeasureModal, setShowMeasureModal] = useState(false);
  const [pointAInput, setPointAInput] = useState('');
  const [pointBInput, setPointBInput] = useState('');
  const [measureResult, setMeasureResult] = useState(null);
  const [manualMeasureLine, setManualMeasureLine] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/odp');
      if (res.ok) {
        const odpData = await res.json();
        const enrichedData = (odpData || []).map((item) => {
          const isTotal = parseInt(item.is_total) || 0;
          const used = parseInt(item.used) || 0;
          const avai = parseInt(item.avai) || Math.max(0, isTotal - used);
          const rsk = isTotal > 0 ? used / isTotal : 0;

          let status = 'BLACK';
          if (rsk === 0) status = 'BLACK';
          else if (rsk > 0 && rsk <= 0.6) status = 'GREEN';
          else if (rsk > 0.6 && rsk <= 0.85) status = 'YELLOW';
          else if (rsk > 0.85 && rsk < 0.99) status = 'ORANGE';
          else if (rsk >= 0.99) status = 'RED';

          return {
            ...item,
            is_total: isTotal,
            used,
            avai,
            rsk,
            status_final: status,
            week: getWeekNumber(item.event_date),
          };
        });
        setData(enrichedData);
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const availableWeeks = useMemo(() => {
    return [...new Set(data.map((d) => d.week).filter((w) => w !== 'Unknown'))].sort();
  }, [data]);

  const weekFilteredData = useMemo(() => {
    return selectedWeek === 'ALL' ? data : data.filter((d) => d.week === selectedWeek);
  }, [data, selectedWeek]);

  const fullyFilteredData = useMemo(() => {
    return selectedStatus === 'ALL'
      ? weekFilteredData
      : weekFilteredData.filter((d) => d.status_final === selectedStatus);
  }, [weekFilteredData, selectedStatus]);

  const cutoffDate = useMemo(() => {
    if (weekFilteredData.length === 0) return '-';
    const dates = weekFilteredData
      .map((d) => new Date(d.event_date).getTime())
      .filter((t) => !isNaN(t));
    if (dates.length === 0) return '-';
    return formatDate(new Date(Math.max(...dates)));
  }, [weekFilteredData]);

  const statsOverview = useMemo(() => {
    let totalPort = 0;
    let usedPort = 0;
    let avaiPort = 0;
    let colorCounts = { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };

    weekFilteredData.forEach((item) => {
      totalPort += item.is_total;
      usedPort += item.used;
      avaiPort += item.avai;
      if (colorCounts[item.status_final] !== undefined) {
        colorCounts[item.status_final] += 1;
      }
    });

    return { totalPort, usedPort, avaiPort, colorCounts };
  }, [weekFilteredData]);

  const statsFiltered = useMemo(() => {
    const kabMap = {};
    const flatStosMap = {};

    fullyFilteredData.forEach((item) => {
      const kab = item.kabupaten || 'LAINNYA';
      if (!kabMap[kab]) {
        kabMap[kab] = {
          name: kab,
          BLACK: 0,
          GREEN: 0,
          YELLOW: 0,
          ORANGE: 0,
          RED: 0,
          rawCounts: { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 },
          rawPorts: { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 },
          total: 0,
        };
      }
      kabMap[kab].rawCounts[item.status_final] += 1;
      kabMap[kab].rawPorts[item.status_final] += item.is_total;
      kabMap[kab].total += 1;

      const wok = item.wok || 'UNKNOWN';
      const sto = item.sto || 'UNKNOWN';
      const key = `${wok}_${sto}`;
      if (!flatStosMap[key]) {
        flatStosMap[key] = { wok, sto, odp_count: 0, is_total: 0, used: 0, avai: 0 };
      }
      flatStosMap[key].odp_count += 1;
      flatStosMap[key].is_total += item.is_total;
      flatStosMap[key].used += item.used;
      flatStosMap[key].avai += item.avai;
    });

    const chartData = Object.values(kabMap).map((k) => {
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
      };
    });

    const flatStos = Object.values(flatStosMap).map((row) => ({
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

  const requestSort = (key) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  const handleStatusClick = (status) => {
    setSelectedStatus((prev) => (prev === status ? 'ALL' : status));
  };

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (val.length >= 3) {
      const lower = val.toLowerCase();
      const suggs = fullyFilteredData
        .filter(
          (d) =>
            (d.odp_name && d.odp_name.toLowerCase().includes(lower)) ||
            (d.kabupaten && d.kabupaten.toLowerCase().includes(lower)) ||
            (d.sto && d.sto.toLowerCase().includes(lower))
        )
        .slice(0, 8);
      setSuggestions(suggs);
    } else {
      setSuggestions([]);
    }
  };

  // Helper Parse Titik (Lat,Long atau ODP Name)
  const parsePoint = (input) => {
    if (!input) return null;
    const clean = input.trim();
    if (clean.includes(',')) {
      const parts = clean.split(',').map((p) => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return { name: clean, lat: parts[0], lon: parts[1] };
      }
    }
    const found = data.find((d) => d.odp_name && d.odp_name.toLowerCase() === clean.toLowerCase());
    if (found && found.latitude && found.longitude) {
      return { name: found.odp_name, lat: found.latitude, lon: found.longitude };
    }
    return null;
  };

  const handleCalculateManualDistance = () => {
    const pA = parsePoint(pointAInput);
    const pB = parsePoint(pointBInput);

    if (!pA) {
      alert('Titik A tidak valid! Masukkan Lat,Long (contoh: -2.21, 113.92) atau nama ODP yang valid.');
      return;
    }
    if (!pB) {
      alert('Titik B tidak valid! Masukkan Lat,Long (contoh: -2.21, 113.92) atau nama ODP yang valid.');
      return;
    }

    const distKm = calculateDistance(pA.lat, pA.lon, pB.lat, pB.lon);
    setMeasureResult({
      from: pA.name,
      to: pB.name,
      km: distKm.toFixed(2),
      meter: Math.round(distKm * 1000).toLocaleString(),
    });
    setManualMeasureLine([[pA.lat, pA.lon], [pB.lat, pB.lon]]);
  };

  const totalOdp = weekFilteredData.length;
  const occTotal =
    statsOverview.totalPort > 0
      ? ((statsOverview.usedPort / statsOverview.totalPort) * 100).toFixed(1)
      : '0.0';
  const avaiTotal =
    statsOverview.totalPort > 0
      ? ((statsOverview.avaiPort / statsOverview.totalPort) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="min-h-screen p-2 sm:p-4 text-gray-800 font-sans text-xs bg-[#f1f5f9]">
      <Head>
        <title>ODP Profile & Utilization</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      </Head>

      <div className="max-w-[1400px] mx-auto space-y-3">
        {/* HEADER UTAMA & FILTER WEEK */}
        <div className="bg-gradient-to-r from-[#211c47] to-[#3a3575] text-white p-3 sm:p-4 flex flex-col md:flex-row justify-between items-start md:items-center border-b-4 border-purple-500 rounded-t-lg shadow-sm gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-wide uppercase italic">
              ODP PROFILE & UTILIZATION
            </h1>
            <p className="text-[10px] sm:text-xs font-semibold mt-0.5 opacity-90">
              *{selectedWeek === 'ALL' ? 'ALL WEEKS' : selectedWeek} - Cutoff Data {cutoffDate}
            </p>
          </div>

          <div className="w-full md:w-auto flex items-center justify-between md:justify-end space-x-2 bg-white/10 p-1.5 sm:p-2 rounded border border-white/20">
            <span className="font-semibold text-xs">Filter Week:</span>
            <select
              className="text-gray-900 px-2 py-1 font-bold rounded cursor-pointer outline-none text-xs"
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(e.target.value)}
            >
              <option value="ALL">Semua Minggu (ALL)</option>
              {availableWeeks.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* NARRATIVE EXECUTIVE SUMMARY */}
        <div className="bg-white px-3 sm:px-4 py-2 text-xs sm:text-[13px] border border-gray-200 shadow-sm rounded leading-relaxed">
          The total <strong className="font-extrabold">number of ODP</strong> in Branch Palangkaraya
          was <strong className="font-extrabold">{(totalOdp / 1000).toFixed(1)}K</strong> (
          {(statsOverview.totalPort / 1000).toFixed(1)} K Port) which is Occupancy{' '}
          <strong className="font-extrabold">
            {(statsOverview.usedPort / 1000).toFixed(1)}K Port ({occTotal}%)
          </strong>{' '}
          and{' '}
          <strong className="font-extrabold">
            {(statsOverview.avaiPort / 1000).toFixed(1)}K ({avaiTotal}%)
          </strong>{' '}
          available ports for <strong className="font-extrabold">new sales.</strong>
        </div>

        {/* TOGGLE TOMBOL UPLOADER */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowUploader(!showUploader)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-900 text-white font-bold text-xs rounded shadow hover:bg-blue-800 transition"
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${showUploader ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            {showUploader ? 'Tutup Upload' : 'Upload Data ODP (CSV / XLSX)'}
          </button>
        </div>

        {showUploader && (
          <div className="transition-all duration-300">
            <Uploader onUploadSuccess={fetchData} />
          </div>
        )}

        {/* GRID UTAMA RESPONSIVE */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
          
          {/* ================= KOLOM KIRI ================= */}
          <div className="space-y-3 sm:space-y-4">
            
            {/* OVERVIEW ODP PROFILE */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-xs sm:text-sm tracking-wide">
                OVERVIEW ODP PROFILE{' '}
                <span className="text-[10px] font-normal text-purple-200">
                  {selectedStatus !== 'ALL' ? `[Filter: ${selectedStatus}]` : '(Klik box status)'}
                </span>
              </div>
              
              <div className="p-2 sm:p-3 grid grid-cols-3 gap-2 sm:gap-3 text-center">
                {/* Summary Port */}
                <div className="col-span-1 space-y-1.5 sm:space-y-2">
                  <div className="border border-gray-200 bg-gray-50/50 p-1.5 sm:p-2 rounded">
                    <p className="text-[8px] sm:text-[9px] font-bold text-gray-500 uppercase">TOTAL ODP (Port)</p>
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                      {totalOdp.toLocaleString()}{' '}
                      <span className="text-[10px] sm:text-xs font-bold text-slate-600">
                        ({(statsOverview.totalPort / 1000).toFixed(1)} K)
                      </span>
                    </p>
                  </div>
                  <div className="border border-gray-200 bg-gray-50/50 p-1.5 sm:p-2 rounded">
                    <p className="text-[8px] sm:text-[9px] font-bold text-gray-500 uppercase">USED PORT</p>
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                      {(statsOverview.usedPort / 1000).toFixed(1)} K{' '}
                      <span className="text-[10px] sm:text-xs font-bold text-slate-600">({occTotal}%)</span>
                    </p>
                  </div>
                  <div className="border border-gray-200 bg-gray-50/50 p-1.5 sm:p-2 rounded">
                    <p className="text-[8px] sm:text-[9px] font-bold text-gray-500 uppercase">AVAI PORT</p>
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                      {(statsOverview.avaiPort / 1000).toFixed(1)} K{' '}
                      <span className="text-[10px] sm:text-xs font-bold text-slate-600">({avaiTotal}%)</span>
                    </p>
                  </div>
                </div>

                {/* BLACK ODP */}
                <div
                  onClick={() => handleStatusClick('BLACK')}
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
                    {totalOdp > 0
                      ? ((statsOverview.colorCounts.BLACK / totalOdp) * 100).toFixed(1)
                      : 0}
                    %
                  </p>
                  <p className="text-[9px] text-gray-400 font-medium mt-1">[Not change]</p>
                </div>

                {/* COLORED ODP */}
                <div className="col-span-1 grid grid-cols-2 gap-1.5 sm:gap-2">
                  <div
                    onClick={() => handleStatusClick('YELLOW')}
                    className={`text-center cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'YELLOW' ? 'ring-2 ring-yellow-500 bg-yellow-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#facc15] text-slate-900 text-[8px] font-bold px-0.5 py-0.5 rounded-sm">
                      YELLOW
                    </div>
                    <p className="text-sm sm:text-base font-extrabold mt-1">
                      {statsOverview.colorCounts.YELLOW.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-slate-600">
                      {totalOdp > 0
                        ? ((statsOverview.colorCounts.YELLOW / totalOdp) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>

                  <div
                    onClick={() => handleStatusClick('GREEN')}
                    className={`text-center cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'GREEN' ? 'ring-2 ring-green-600 bg-green-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#16a34a] text-white text-[8px] font-bold px-0.5 py-0.5 rounded-sm">
                      GREEN
                    </div>
                    <p className="text-sm sm:text-base font-extrabold mt-1">
                      {statsOverview.colorCounts.GREEN.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-700">
                      {totalOdp > 0
                        ? ((statsOverview.colorCounts.GREEN / totalOdp) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>

                  <div
                    onClick={() => handleStatusClick('ORANGE')}
                    className={`text-center cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'ORANGE' ? 'ring-2 ring-orange-500 bg-orange-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#ea580c] text-white text-[8px] font-bold px-0.5 py-0.5 rounded-sm">
                      ORANGE
                    </div>
                    <p className="text-sm sm:text-base font-extrabold mt-1">
                      {statsOverview.colorCounts.ORANGE.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-slate-600">
                      {totalOdp > 0
                        ? ((statsOverview.colorCounts.ORANGE / totalOdp) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>

                  <div
                    onClick={() => handleStatusClick('RED')}
                    className={`text-center cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'RED' ? 'ring-2 ring-red-600 bg-red-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#ef4444] text-white text-[8px] font-bold px-0.5 py-0.5 rounded-sm">
                      RED
                    </div>
                    <p className="text-sm sm:text-base font-extrabold mt-1">
                      {statsOverview.colorCounts.RED.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-red-600">
                      {totalOdp > 0
                        ? ((statsOverview.colorCounts.RED / totalOdp) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </div>

              {/* LEGEND STATUS */}
              <div className="grid grid-cols-5 border-t border-slate-200 bg-[#f8fafc] py-1.5 text-center text-[9px] sm:text-[10px] font-bold text-slate-700">
                <span className="flex items-center justify-center"><div className="w-3.5 sm:w-5 h-2 bg-black mr-1 rounded-sm"></div>0%</span>
                <span className="flex items-center justify-center"><div className="w-3.5 sm:w-5 h-2 bg-[#16a34a] mr-1 rounded-sm"></div>&lt;60%</span>
                <span className="flex items-center justify-center"><div className="w-3.5 sm:w-5 h-2 bg-[#facc15] mr-1 rounded-sm"></div>&lt;85%</span>
                <span className="flex items-center justify-center"><div className="w-3.5 sm:w-5 h-2 bg-[#ea580c] mr-1 rounded-sm"></div>&lt;99%</span>
                <span className="flex items-center justify-center"><div className="w-3.5 sm:w-5 h-2 bg-[#ef4444] mr-1 rounded-sm"></div>100%</span>
              </div>
            </div>

            {/* ODP SHARE KABUPATEN LEVEL */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#4c1d95] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-xs sm:text-sm tracking-wide">
                ODP SHARE KABUPATEN LEVEL
              </div>
              <div className="p-2 sm:p-4 pt-4 sm:pt-6">
                <h4 className="text-center font-bold text-gray-500 text-xs mb-2">
                  PROFIL ODP BRANCH PALANGKARAYA
                </h4>
                <div className="h-60 sm:h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={statsFiltered.chartData}
                      margin={{ top: 5, right: 0, left: -25, bottom: 35 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 8, fontWeight: 'bold' }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} domain={[0, 100]} unit="%" />
                      <Tooltip content={<CustomChartTooltip />} />
                      <Bar dataKey="BLACK" stackId="a" fill="#000000" label={renderCustomBarLabel} />
                      <Bar dataKey="GREEN" stackId="a" fill="#16a34a" label={renderCustomBarLabel} />
                      <Bar dataKey="YELLOW" stackId="a" fill="#facc15" label={renderCustomBarLabel} />
                      <Bar dataKey="ORANGE" stackId="a" fill="#ea580c" label={renderCustomBarLabel} />
                      <Bar dataKey="RED" stackId="a" fill="#ef4444" label={renderCustomBarLabel} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

          </div>

          {/* ================= KOLOM KANAN ================= */}
          <div className="space-y-3 sm:space-y-4">
            
            {/* 1. MAPS LOKASI ODP (PINDAH KE PALING ATAS DI KANAN) */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm relative">
              <div className="bg-gradient-to-r from-[#1e3a8a] to-[#3a3575] text-white p-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm">MAPS LOKASI ODP</span>
                  <button
                    type="button"
                    onClick={() => setShowMeasureModal(!showMeasureModal)}
                    className="px-2 py-0.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-[10px] font-semibold flex items-center gap-1 shadow"
                  >
                    <span>📐</span> Ukur Jarak Input
                  </button>
                </div>

                {/* SEARCH BAR WITH AUTO SUGGESTION */}
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

              {/* Form Input Pengukur Jarak */}
              {showMeasureModal && (
                <div className="bg-slate-50 p-2.5 border-b border-slate-200 text-xs space-y-2">
                  <p className="font-bold text-slate-800 text-[11px]">Hitung Jarak Berdasarkan ODP Name / Koordinat (Lat,Long):</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Titik A (Nama ODP / Lat,Long):</label>
                      <input
                        type="text"
                        placeholder="Contoh: ODP-PLK-FAA/01 atau -2.21, 113.92"
                        value={pointAInput}
                        onChange={(e) => setPointAInput(e.target.value)}
                        className="w-full p-1 border rounded text-xs mt-0.5 bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-semibold">Titik B (Nama ODP / Lat,Long):</label>
                      <input
                        type="text"
                        placeholder="Contoh: ODP-PLK-FAA/05 atau -2.22, 113.93"
                        value={pointBInput}
                        onChange={(e) => setPointBInput(e.target.value)}
                        className="w-full p-1 border rounded text-xs mt-0.5 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={handleCalculateManualDistance}
                      className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-[11px] hover:bg-blue-700 shadow"
                    >
                      Hitung Jarak Darat
                    </button>
                    {measureResult && (
                      <p className="font-bold text-blue-900 text-xs">
                        Hasil: {measureResult.km} km ({measureResult.meter} m)
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="h-[280px] sm:h-[350px] p-1 bg-gray-100">
                {loading ? (
                  <div className="flex h-full items-center justify-center font-bold text-gray-400">
                    Memuat Peta ODP...
                  </div>
                ) : (
                  <MapComponent
                    data={fullyFilteredData}
                    focusLocation={focusedOdp}
                    manualMeasureLine={manualMeasureLine}
                  />
                )}
              </div>
            </div>

            {/* 2. OCCUPANCY & AVAILABLE PORT (DI BAWAH MAPS) */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-xs sm:text-sm tracking-wide">
                OCCUPANCY & AVAILABLE PORT
              </div>

              <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
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

                      return (
                        <tr
                          key={`${row.wok}_${row.sto}_${idx}`}
                          className="border-b border-gray-300 bg-white hover:bg-gray-100"
                        >
                          <td className="p-1 border border-gray-300 font-bold text-gray-600">{row.wok}</td>
                          <td className="p-1 border border-gray-300 font-bold text-gray-700">{row.sto}</td>
                          <td className="p-1 border border-gray-300 text-gray-600">{row.odp_count.toLocaleString()}</td>
                          <td className="p-1 border border-gray-300 text-gray-600">{row.is_total.toLocaleString()}</td>
                          <td className="p-1 border border-gray-300 text-gray-600">{row.used.toLocaleString()}</td>
                          <td className="p-1 border border-gray-300 text-gray-600">{row.avai.toLocaleString()}</td>
                          <td className={`p-1 border border-gray-300 font-bold ${occBg}`}>{row.occ.toFixed(1)}%</td>
                          <td className="p-1 border border-gray-300 font-bold bg-gray-50 text-gray-600">{row.avai_perc.toFixed(1)}%</td>
                        </tr>
                      );
                    })}
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
