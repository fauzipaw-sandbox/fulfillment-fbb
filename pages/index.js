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

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState('ALL');
  const [sortConfig, setSortConfig] = useState({ key: 'occ', direction: 'desc' });

  // State interaktif Status & Search Bar Maps
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [focusedOdp, setFocusedOdp] = useState(null);

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

  // Data per Week
  const weekFilteredData = useMemo(() => {
    return selectedWeek === 'ALL' ? data : data.filter((d) => d.week === selectedWeek);
  }, [data, selectedWeek]);

  // Data Sinkron saat Filter Box Status diklik
  const fullyFilteredData = useMemo(() => {
    return selectedStatus === 'ALL'
      ? weekFilteredData
      : weekFilteredData.filter((d) => d.status_final === selectedStatus);
  }, [weekFilteredData, selectedStatus]);

  // Cutoff date terbaru
  const cutoffDate = useMemo(() => {
    if (weekFilteredData.length === 0) return '-';
    const dates = weekFilteredData
      .map((d) => new Date(d.event_date).getTime())
      .filter((t) => !isNaN(t));
    if (dates.length === 0) return '-';
    return formatDate(new Date(Math.max(...dates)));
  }, [weekFilteredData]);

  // Overview Stats (Tetap hitung semua status pada week aktif)
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

  // Chart & Table Stats
  const statsFiltered = useMemo(() => {
    const kabMap = {};
    const flatStosMap = {};

    fullyFilteredData.forEach((item) => {
      const kab = item.kabupaten || 'LAINNYA';
      if (!kabMap[kab]) {
        kabMap[kab] = { name: kab, BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0, total: 0 };
      }
      kabMap[kab][item.status_final] += 1;
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

    const chartData = Object.values(kabMap).map((k) => ({
      name: k.name,
      BLACK: parseFloat(((k.BLACK / (k.total || 1)) * 100).toFixed(1)),
      GREEN: parseFloat(((k.GREEN / (k.total || 1)) * 100).toFixed(1)),
      YELLOW: parseFloat(((k.YELLOW / (k.total || 1)) * 100).toFixed(1)),
      ORANGE: parseFloat(((k.ORANGE / (k.total || 1)) * 100).toFixed(1)),
      RED: parseFloat(((k.RED / (k.total || 1)) * 100).toFixed(1)),
    }));

    const flatStos = Object.values(flatStosMap).map((row) => ({
      ...row,
      occ: row.is_total > 0 ? (row.used / row.is_total) * 100 : 0,
      avai_perc: row.is_total > 0 ? (row.avai / row.is_total) * 100 : 0,
    }));

    return { chartData, flatStos };
  }, [fullyFilteredData]);

  // Sorting Table
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
        .slice(0, 5);
      setSuggestions(suggs);
    } else {
      setSuggestions([]);
    }
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
    <div className="min-h-screen p-4 text-gray-800 font-sans text-xs bg-[#f1f5f9]">
      <Head>
        <title>ODP Profile & Utilization</title>
      </Head>

      <div className="max-w-[1350px] mx-auto space-y-4">
        {/* HEADER UTAMA & FILTER WEEK */}
        <div className="bg-gradient-to-r from-[#211c47] to-[#3a3575] text-white p-4 flex flex-col md:flex-row justify-between items-start md:items-center border-b-4 border-purple-500 rounded-t-lg shadow-sm">
          <div>
            <h1 className="text-3xl font-extrabold tracking-wide uppercase italic">
              ODP PROFILE & UTILIZATION
            </h1>
            <p className="text-xs font-semibold mt-1 opacity-90">
              *{selectedWeek === 'ALL' ? 'ALL WEEKS' : selectedWeek} - Cutoff Data {cutoffDate}
            </p>
          </div>

          <div className="mt-3 md:mt-0 flex items-center space-x-3 bg-white/10 p-2 rounded border border-white/20">
            <span className="font-semibold text-sm">Filter Week:</span>
            <select
              className="text-gray-900 px-3 py-1 font-bold rounded cursor-pointer outline-none shadow-sm"
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
        <div className="bg-white px-4 py-2 text-[13px] border border-gray-200 shadow-sm rounded">
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

        {/* UPLOADER */}
        <Uploader onUploadSuccess={fetchData} />

        {/* MAIN DASHBOARD */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* ================= KOLOM KIRI ================= */}
          <div className="space-y-4">
            {/* OVERVIEW (INTERAKTIF & KLIK) */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-sm tracking-wide">
                OVERVIEW ODP PROFILE{' '}
                <span className="text-[10px] font-normal text-purple-200">
                  (Klik box untuk filter {selectedStatus !== 'ALL' ? `[Filter: ${selectedStatus}]` : ''})
                </span>
              </div>
              <div className="p-3 grid grid-cols-3 gap-3 text-center">
                {/* Port Summary Cards */}
                <div className="col-span-1 space-y-2">
                  <div className="border border-gray-200 bg-gray-50/50 p-2 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-600 mb-1">TOTAL ODP (Port)</p>
                    <p className="text-xl font-black">
                      {totalOdp.toLocaleString()}{' '}
                      <span className="text-sm font-bold">
                        ({(statsOverview.totalPort / 1000).toFixed(1)} K)
                      </span>
                    </p>
                  </div>
                  <div className="border border-gray-200 bg-gray-50/50 p-2 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-600 mb-1">USED PORT</p>
                    <p className="text-xl font-black">
                      {(statsOverview.usedPort / 1000).toFixed(1)} K{' '}
                      <span className="text-sm font-bold">({occTotal}%)</span>
                    </p>
                  </div>
                  <div className="border border-gray-200 bg-gray-50/50 p-2 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-600 mb-1">AVAI PORT</p>
                    <p className="text-xl font-black">
                      {(statsOverview.avaiPort / 1000).toFixed(1)} K{' '}
                      <span className="text-sm font-bold">({avaiTotal}%)</span>
                    </p>
                  </div>
                </div>

                {/* BLACK ODP */}
                <div
                  onClick={() => handleStatusClick('BLACK')}
                  className={`col-span-1 border border-gray-400 p-2 shadow-inner flex flex-col justify-center cursor-pointer transition-transform hover:scale-105 relative ${
                    selectedStatus === 'BLACK'
                      ? 'ring-4 ring-black bg-gray-100'
                      : 'bg-white'
                  }`}
                >
                  <div className="bg-black text-white text-[10px] font-bold px-3 py-0.5 w-max mx-auto border border-gray-400 absolute -top-2 left-0 right-0">
                    BLACK ODP
                  </div>
                  <p className="text-4xl font-black mt-4">
                    {statsOverview.colorCounts.BLACK.toLocaleString()}
                  </p>
                  <p className="text-sm font-bold mt-1">
                    {totalOdp > 0
                      ? ((statsOverview.colorCounts.BLACK / totalOdp) * 100).toFixed(1)
                      : 0}
                    %
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold mt-2">[Not change]</p>
                </div>

                {/* COLORED ODP */}
                <div className="col-span-1 grid grid-cols-2 gap-2">
                  <div
                    onClick={() => handleStatusClick('YELLOW')}
                    className={`text-center cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'YELLOW' ? 'ring-2 ring-yellow-500 bg-yellow-50 shadow' : ''
                    }`}
                  >
                    <div className="bg-[#facc15] text-black text-[10px] font-bold px-1 py-0.5 shadow">
                      YELLOW ODP
                    </div>
                    <p className="text-xl font-black mt-1">
                      {statsOverview.colorCounts.YELLOW.toLocaleString()}
                    </p>
                    <p className="text-xs font-bold">
                      {totalOdp > 0
                        ? ((statsOverview.colorCounts.YELLOW / totalOdp) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>

                  <div
                    onClick={() => handleStatusClick('GREEN')}
                    className={`text-center cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'GREEN' ? 'ring-2 ring-green-600 bg-green-50 shadow' : ''
                    }`}
                  >
                    <div className="bg-[#16a34a] text-white text-[10px] font-bold px-1 py-0.5 shadow">
                      GREEN ODP
                    </div>
                    <p className="text-xl font-black mt-1">
                      {statsOverview.colorCounts.GREEN.toLocaleString()}
                    </p>
                    <p className="text-xs font-bold text-green-600">
                      {totalOdp > 0
                        ? ((statsOverview.colorCounts.GREEN / totalOdp) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>

                  <div
                    onClick={() => handleStatusClick('ORANGE')}
                    className={`text-center mt-3 cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'ORANGE' ? 'ring-2 ring-orange-500 bg-orange-50 shadow' : ''
                    }`}
                  >
                    <div className="bg-[#ea580c] text-white text-[10px] font-bold px-1 py-0.5 shadow">
                      ORANGE ODP
                    </div>
                    <p className="text-xl font-black mt-1">
                      {statsOverview.colorCounts.ORANGE.toLocaleString()}
                    </p>
                    <p className="text-xs font-bold">
                      {totalOdp > 0
                        ? ((statsOverview.colorCounts.ORANGE / totalOdp) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>

                  <div
                    onClick={() => handleStatusClick('RED')}
                    className={`text-center mt-3 cursor-pointer p-1 rounded transition-transform hover:scale-105 ${
                      selectedStatus === 'RED' ? 'ring-2 ring-red-600 bg-red-50 shadow' : ''
                    }`}
                  >
                    <div className="bg-[#ef4444] text-white text-[10px] font-bold px-1 py-0.5 shadow">
                      RED ODP
                    </div>
                    <p className="text-xl font-black mt-1">
                      {statsOverview.colorCounts.RED.toLocaleString()}
                    </p>
                    <p className="text-xs font-bold text-red-600">
                      {totalOdp > 0
                        ? ((statsOverview.colorCounts.RED / totalOdp) * 100).toFixed(1)
                        : 0}
                      %
                    </p>
                  </div>
                </div>
              </div>

              {/* LEGEND DENGAN RED = 100% */}
              <div className="flex justify-around items-center bg-gray-100/80 py-2 border-t border-gray-200 text-[11px] font-bold">
                <span className="flex items-center">
                  <div className="w-8 h-3 bg-black mr-2"></div>0%
                </span>
                <span className="flex items-center">
                  <div className="w-8 h-3 bg-[#16a34a] mr-2"></div>&lt;60%
                </span>
                <span className="flex items-center">
                  <div className="w-8 h-3 bg-[#facc15] mr-2"></div>&lt;85%
                </span>
                <span className="flex items-center">
                  <div className="w-8 h-3 bg-[#ea580c] mr-2"></div>&lt;99%
                </span>
                <span className="flex items-center">
                  <div className="w-8 h-3 bg-[#ef4444] mr-2"></div>Red = 100%
                </span>
              </div>
            </div>

            {/* ODP SHARE KABUPATEN */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="bg-gradient-to-r from-[#4c1d95] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-sm tracking-wide">
                ODP SHARE KABUPATEN LEVEL
              </div>
              <div className="p-4 pt-6">
                <h4 className="text-center font-bold text-gray-500 mb-2">
                  PROFIL ODP BRANCH PALANGKARAYA
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={statsFiltered.chartData}
                      margin={{ top: 5, right: 0, left: -25, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 9, fontWeight: 'bold' }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} domain={[0, 100]} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="BLACK" stackId="a" fill="#000000" />
                      <Bar dataKey="GREEN" stackId="a" fill="#16a34a" />
                      <Bar dataKey="YELLOW" stackId="a" fill="#facc15" />
                      <Bar dataKey="ORANGE" stackId="a" fill="#ea580c" />
                      <Bar dataKey="RED" stackId="a" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* ================= KOLOM KANAN ================= */}
          <div className="space-y-4">
            {/* OCCUPANCY TABLE SORTABLE */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-sm tracking-wide">
                OCCUPANCY & AVAILABLE PORT
              </div>

              <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="w-full text-center border-collapse">
                  <thead className="bg-[#0f172a] text-white text-[10px] sticky top-0 z-10 shadow-md cursor-pointer">
                    <tr>
                      <th
                        className="p-2 border border-gray-400 hover:bg-gray-800 transition"
                        onClick={() => requestSort('wok')}
                      >
                        WOK {sortConfig.key === 'wok' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th
                        className="p-2 border border-gray-400 hover:bg-gray-800 transition"
                        onClick={() => requestSort('sto')}
                      >
                        STO {sortConfig.key === 'sto' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th
                        className="p-2 border border-gray-400 hover:bg-gray-800 transition"
                        onClick={() => requestSort('odp_count')}
                      >
                        # Odp_name{' '}
                        {sortConfig.key === 'odp_count' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th
                        className="p-2 border border-gray-400 hover:bg-gray-800 transition"
                        onClick={() => requestSort('is_total')}
                      >
                        # ls_total{' '}
                        {sortConfig.key === 'is_total' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th
                        className="p-2 border border-gray-400 hover:bg-gray-800 transition"
                        onClick={() => requestSort('used')}
                      >
                        # Used {sortConfig.key === 'used' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th
                        className="p-2 border border-gray-400 hover:bg-gray-800 transition"
                        onClick={() => requestSort('avai')}
                      >
                        # Avail {sortConfig.key === 'avai' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th
                        className="p-2 border border-gray-400 hover:bg-gray-800 transition bg-[#3b82f6]"
                        onClick={() => requestSort('occ')}
                      >
                        % OCC {sortConfig.key === 'occ' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      <th
                        className="p-2 border border-gray-400 hover:bg-gray-800 transition"
                        onClick={() => requestSort('avai_perc')}
                      >
                        % Avail{' '}
                        {sortConfig.key === 'avai_perc' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px]">
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
                          <td className="p-1 border border-gray-300 text-gray-600">
                            {row.odp_count.toLocaleString()}
                          </td>
                          <td className="p-1 border border-gray-300 text-gray-600">
                            {row.is_total.toLocaleString()}
                          </td>
                          <td className="p-1 border border-gray-300 text-gray-600">
                            {row.used.toLocaleString()}
                          </td>
                          <td className="p-1 border border-gray-300 text-gray-600">
                            {row.avai.toLocaleString()}
                          </td>
                          <td className={`p-1 border border-gray-300 font-bold ${occBg}`}>
                            {row.occ.toFixed(1)}%
                          </td>
                          <td className="p-1 border border-gray-300 font-bold bg-gray-50 text-gray-600">
                            {row.avai_perc.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MAPS WITH SEARCH */}
            <div className="bg-white border border-gray-300 shadow-sm relative">
              <div className="bg-gradient-to-r from-[#1e3a8a] to-[#3a3575] text-white p-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 relative">
                <span className="font-bold text-sm ml-1">MAPS LOKASI ODP</span>

                {/* SEARCH BAR */}
                <div className="relative w-full sm:w-64 z-[9999]">
                  <input
                    type="text"
                    placeholder="Cari ODP, STO, Kab (min 3 huruf)..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="w-full px-2.5 py-1 text-black rounded text-xs outline-none shadow-sm"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full bg-white text-black mt-1 rounded shadow-xl border border-gray-300 overflow-hidden">
                      {suggestions.map((s, i) => (
                        <div
                          key={i}
                          onClick={() => {
                            setFocusedOdp(s);
                            setSuggestions([]);
                            setSearchTerm(s.odp_name);
                          }}
                          className="p-2 border-b border-gray-100 hover:bg-blue-50 cursor-pointer text-[10px]"
                        >
                          <strong className="text-blue-700">{s.odp_name}</strong> - {s.sto} (
                          {s.kabupaten})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="h-[360px] p-1 bg-gray-100">
                {loading ? (
                  <div className="flex h-full items-center justify-center font-bold text-gray-400">
                    Memuat Peta ODP...
                  </div>
                ) : (
                  <MapComponent data={fullyFilteredData} focusLocation={focusedOdp} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
