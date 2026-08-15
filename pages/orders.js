import React, { useEffect, useState, useMemo } from 'react';
import Head from 'next/head';
import Papa from 'papaparse';
import Sidebar from '../components/Sidebar';
import Uploader from '../components/Uploader';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const ALLOWED_STOS = [
  'BNT', 'PLK', 'KKN', 'MTW', 'PPS', 'PYM', 'TML', 'AMP', 'KKP', 'KRI', 'KSO', 'PRC'
];

const WOK_GROUP_MAP = {
  AMP: 'BARITO - KAPUAS',
  BNT: 'BARITO - KAPUAS',
  KKP: 'BARITO - KAPUAS',
  MTW: 'BARITO - KAPUAS',
  PPS: 'BARITO - KAPUAS',
  PRC: 'BARITO - KAPUAS',
  TML: 'BARITO - KAPUAS',
  KKN: 'PALANGKARAYA',
  KRI: 'PALANGKARAYA',
  KSO: 'PALANGKARAYA',
  PLK: 'PALANGKARAYA',
  PYM: 'PALANGKARAYA',
};

const DURATION_COLORS = {
  '3 HARI': '#22c55e', // Green
  '7 HARI': '#f97316', // Orange
  DEFAULT: '#3b82f6',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);

  // Filter States
  const [selectedWok, setSelectedWok] = useState('ALL');
  const [selectedSto, setSelectedSto] = useState('ALL');
  const [selectedDuration, setSelectedDuration] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Bottom Table State
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        const enriched = (data || []).map((row) => {
          const sto = (row.sto_co || '').trim().toUpperCase();
          const wok = (row.wok && row.wok.trim() !== '') ? row.wok.trim().toUpperCase() : (WOK_GROUP_MAP[sto] || 'PALANGKARAYA');
          const dur = (row.order_duration_cat && row.order_duration_cat.trim() !== '') ? row.order_duration_cat.trim().toUpperCase() : 'LAINNYA';
          const status = (row.order_status_desc || row.process_state || 'UNKNOWN').trim().toUpperCase();
          const falloutReason = (row.fallout_reason && row.fallout_reason.trim() !== '') ? row.fallout_reason.trim().toUpperCase() : (row.fallout_category || 'LAIN-LAIN');

          return {
            ...row,
            sto_co: sto,
            wok,
            order_duration_cat: dur,
            order_status_clean: status,
            fallout_reason_clean: falloutReason,
          };
        });
        setOrders(enriched);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Filter Sinkron Seluruh Komponen
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchWok = selectedWok === 'ALL' || o.wok === selectedWok;
      const matchSto = selectedSto === 'ALL' || o.sto_co === selectedSto;
      const matchDur = selectedDuration === 'ALL' || o.order_duration_cat === selectedDuration;
      const matchStat = selectedStatus === 'ALL' || o.order_status_clean === selectedStatus;
      return matchWok && matchSto && matchDur && matchStat;
    });
  }, [orders, selectedWok, selectedSto, selectedDuration, selectedStatus]);

  // ================= 1. PIVOT 1: WOK & STO vs ORDER DURATION (3 HARI, 7 HARI, etc.) =================
  const pivotDuration = useMemo(() => {
    const durColumnsSet = new Set();
    const map = {};

    filteredOrders.forEach((o) => {
      const wok = o.wok || 'PALANGKARAYA';
      const sto = o.sto_co || 'UNKNOWN';
      const dur = o.order_duration_cat;
      durColumnsSet.add(dur);

      if (!map[wok]) map[wok] = { name: wok, total: 0, stos: {}, colCounts: {} };
      if (!map[wok].stos[sto]) map[wok].stos[sto] = { name: sto, total: 0, colCounts: {} };

      map[wok].total++;
      map[wok].colCounts[dur] = (map[wok].colCounts[dur] || 0) + 1;

      map[wok].stos[sto].total++;
      map[wok].stos[sto].colCounts[dur] = (map[wok].stos[sto].colCounts[dur] || 0) + 1;
    });

    const columns = Array.from(durColumnsSet).sort();
    const grandColTotals = {};
    columns.forEach((c) => (grandColTotals[c] = 0));
    let totalAll = 0;

    Object.values(map).forEach((w) => {
      totalAll += w.total;
      columns.forEach((c) => {
        grandColTotals[c] += w.colCounts[c] || 0;
      });
    });

    return { tree: map, columns, grandColTotals, totalAll };
  }, [filteredOrders]);

  // ================= 2. PIVOT 2: WOK & STO vs ORDER STATUS =================
  const pivotStatus = useMemo(() => {
    const statusSet = new Set();
    const map = {};

    filteredOrders.forEach((o) => {
      const wok = o.wok || 'PALANGKARAYA';
      const sto = o.sto_co || 'UNKNOWN';
      const st = o.order_status_clean;
      statusSet.add(st);

      if (!map[wok]) map[wok] = { name: wok, total: 0, stos: {}, colCounts: {} };
      if (!map[wok].stos[sto]) map[wok].stos[sto] = { name: sto, total: 0, colCounts: {} };

      map[wok].total++;
      map[wok].colCounts[st] = (map[wok].colCounts[st] || 0) + 1;

      map[wok].stos[sto].total++;
      map[wok].stos[sto].colCounts[st] = (map[wok].stos[sto].colCounts[st] || 0) + 1;
    });

    const columns = Array.from(statusSet).sort();
    const grandColTotals = {};
    columns.forEach((c) => (grandColTotals[c] = 0));
    let totalAll = 0;

    Object.values(map).forEach((w) => {
      totalAll += w.total;
      columns.forEach((c) => {
        grandColTotals[c] += w.colCounts[c] || 0;
      });
    });

    return { tree: map, columns, grandColTotals, totalAll };
  }, [filteredOrders]);

  // ================= 3. PIVOT 3: DURATION -> FALLOUT REASONS =================
  const pivotFallout = useMemo(() => {
    const tree = {};
    let totalAll = 0;

    filteredOrders.forEach((o) => {
      const dur = o.order_duration_cat;
      const r = o.fallout_reason_clean;

      if (!tree[dur]) tree[dur] = { name: dur, total: 0, reasons: {} };
      tree[dur].total++;
      tree[dur].reasons[r] = (tree[dur].reasons[r] || 0) + 1;
      totalAll++;
    });

    return { tree, totalAll };
  }, [filteredOrders]);

  // ================= 4. CHART: DURATION FALLOUT (GROUPED BARS) =================
  const chartData = useMemo(() => {
    const list = [];
    const durKeys = Object.keys(pivotFallout.tree).sort();

    durKeys.forEach((durKey) => {
      const reasonsObj = pivotFallout.tree[durKey].reasons;
      Object.entries(reasonsObj).forEach(([reason, count]) => {
        list.push({
          duration: durKey,
          reason: reason,
          count: count,
          fillColor: DURATION_COLORS[durKey] || DURATION_COLORS.DEFAULT,
          fullLabel: `${reason} (${durKey})`,
        });
      });
    });

    return list;
  }, [pivotFallout]);

  // Bottom Table Data
  const bottomTableData = useMemo(() => {
    if (!searchTerm.trim()) return filteredOrders;
    const s = searchTerm.toLowerCase();
    return filteredOrders.filter(
      (o) =>
        (o.order_id && o.order_id.toLowerCase().includes(s)) ||
        (o.name && o.name.toLowerCase().includes(s)) ||
        (o.odp_name && o.odp_name.toLowerCase().includes(s)) ||
        (o.sto_co && o.sto_co.toLowerCase().includes(s)) ||
        (o.fallout_reason_clean && o.fallout_reason_clean.toLowerCase().includes(s))
    );
  }, [filteredOrders, searchTerm]);

  const totalPages = Math.ceil(bottomTableData.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return bottomTableData.slice(start, start + rowsPerPage);
  }, [bottomTableData, currentPage]);

  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return alert('Tidak ada data untuk di-download.');
    const csv = Papa.unparse(filteredOrders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orders_fallout_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetFilters = () => {
    setSelectedWok('ALL');
    setSelectedSto('ALL');
    setSelectedDuration('ALL');
    setSelectedStatus('ALL');
  };

  return (
    <Sidebar>
      <Head>
        <title>Trend Order & Fallout Analysis</title>
      </Head>

      {loading && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-center text-white">
          <div className="w-12 h-12 border-4 border-purple-400 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs font-black tracking-wider animate-pulse">MEMUAT DATA ORDERS...</p>
        </div>
      )}

      <div className="max-w-[1450px] mx-auto space-y-3">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#211c47] to-[#4c1d95] text-white p-3 sm:p-4 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center shadow gap-2">
          <div>
            <h1 className="text-lg sm:text-2xl font-black uppercase italic tracking-wide">
              TREND ORDER & FALLOUT FULFILLMENT
            </h1>
            <p className="text-[10px] sm:text-xs font-semibold text-yellow-300 mt-0.5">
              Cabang Palangkaraya &bull; Total Terfilter: {filteredOrders.length.toLocaleString()} Orders
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUploader(!showUploader)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded shadow transition"
            >
              {showUploader ? 'Tutup Upload' : 'Upload Data Baru'}
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-2.5 rounded shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-600 text-[11px]">Filter Cepat:</span>
            
            <select
              value={selectedWok}
              onChange={(e) => setSelectedWok(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[11px]"
            >
              <option value="ALL">Semua WOK</option>
              <option value="BARITO - KAPUAS">BARITO - KAPUAS</option>
              <option value="PALANGKARAYA">PALANGKARAYA</option>
            </select>

            <select
              value={selectedSto}
              onChange={(e) => setSelectedSto(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[11px]"
            >
              <option value="ALL">Semua STO</option>
              {ALLOWED_STOS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[11px]"
            >
              <option value="ALL">Semua Durasi</option>
              {pivotDuration.columns.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {(selectedWok !== 'ALL' || selectedSto !== 'ALL' || selectedDuration !== 'ALL' || selectedStatus !== 'ALL') && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[10px] shadow"
            >
              ✕ Reset Filter
            </button>
          )}
        </div>

        {showUploader && (
          <div className="transition-all duration-300">
            <Uploader
              onUploadOdpSuccess={() => {}}
              onUploadOrderSuccess={fetchOrders}
            />
          </div>
        )}

        {/* ================= SECTION ATAS: 2 PIVOT TABLE MATRIKS ================= */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
          
          {/* PIVOT 1: WOK & STO vs DURATION (3 HARI, 7 HARI) */}
          <div className="bg-white border border-slate-300 shadow-xs rounded overflow-hidden">
            <div className="bg-[#0f172a] text-white p-2 flex justify-between items-center text-xs font-black uppercase">
              <span>Count of order_id &bull; Duration SLA</span>
              <span className="text-[10px] text-emerald-400 font-semibold">Row: WOK / STO</span>
            </div>
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-center border-collapse text-[10.5px]">
                <thead className="bg-[#1e293b] text-white sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="p-1.5 border border-slate-600 text-left pl-3">Row Labels</th>
                    {pivotDuration.columns.map((c) => (
                      <th
                        key={c}
                        className={`p-1.5 border border-slate-600 cursor-pointer ${
                          c === '3 HARI' ? 'bg-[#bbf7d0] text-emerald-950 font-black' : c === '7 HARI' ? 'bg-[#fed7aa] text-orange-950 font-black' : ''
                        }`}
                        onClick={() => setSelectedDuration((prev) => (prev === c ? 'ALL' : c))}
                        title="Klik untuk filter durasi"
                      >
                        {c}
                      </th>
                    ))}
                    <th className="p-1.5 border border-slate-600 bg-[#0f172a] text-yellow-300 font-black">Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(pivotDuration.tree).map((wok) => (
                    <React.Fragment key={wok.name}>
                      {/* Baris WOK Header */}
                      <tr className="bg-slate-100 font-black text-slate-800 border-b border-slate-300">
                        <td
                          className="p-1.5 border border-slate-300 text-left pl-2 cursor-pointer hover:text-blue-700"
                          onClick={() => setSelectedWok((prev) => (prev === wok.name ? 'ALL' : wok.name))}
                        >
                          &oplus; {wok.name}
                        </td>
                        {pivotDuration.columns.map((c) => (
                          <td key={c} className="p-1.5 border border-slate-300">
                            {wok.colCounts[c] || ''}
                          </td>
                        ))}
                        <td className="p-1.5 border border-slate-300 font-extrabold bg-slate-200">
                          {wok.total}
                        </td>
                      </tr>

                      {/* Baris STO Sub-items */}
                      {Object.values(wok.stos).map((sto) => (
                        <tr
                          key={sto.name}
                          className="border-b border-slate-200 hover:bg-blue-50/70 transition bg-white"
                        >
                          <td
                            className="p-1 border border-slate-200 text-left pl-6 font-semibold text-slate-700 cursor-pointer hover:text-blue-700"
                            onClick={() => setSelectedSto((prev) => (prev === sto.name ? 'ALL' : sto.name))}
                          >
                            {sto.name}
                          </td>
                          {pivotDuration.columns.map((c) => (
                            <td key={c} className="p-1 border border-slate-200 text-slate-600">
                              {sto.colCounts[c] || ''}
                            </td>
                          ))}
                          <td className="p-1 border border-slate-200 font-bold text-slate-800 bg-slate-50">
                            {sto.total}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}

                  {/* Baris Grand Total */}
                  <tr className="bg-[#0f172a] text-white font-black sticky bottom-0 z-10 shadow">
                    <td className="p-2 border border-slate-700 text-left pl-3 uppercase">Grand Total</td>
                    {pivotDuration.columns.map((c) => (
                      <td key={c} className="p-2 border border-slate-700">
                        {pivotDuration.grandColTotals[c] || 0}
                      </td>
                    ))}
                    <td className="p-2 border border-slate-700 text-yellow-300 font-black">
                      {pivotDuration.totalAll}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* PIVOT 2: WOK & STO vs ORDER STATUS / PROCESS STATE */}
          <div className="bg-white border border-slate-300 shadow-xs rounded overflow-hidden">
            <div className="bg-[#0f172a] text-white p-2 flex justify-between items-center text-xs font-black uppercase">
              <span>Count of order_id &bull; Order Status</span>
              <span className="text-[10px] text-blue-400 font-semibold">Row: WOK / STO</span>
            </div>
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-center border-collapse text-[10.5px]">
                <thead className="bg-[#1e293b] text-white sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="p-1.5 border border-slate-600 text-left pl-3">Row Labels</th>
                    {pivotStatus.columns.map((st) => (
                      <th
                        key={st}
                        className="p-1.5 border border-slate-600 font-bold bg-[#e0f2fe] text-blue-950 cursor-pointer max-w-[110px] truncate"
                        title={st}
                        onClick={() => setSelectedStatus((prev) => (prev === st ? 'ALL' : st))}
                      >
                        {st}
                      </th>
                    ))}
                    <th className="p-1.5 border border-slate-600 bg-[#0f172a] text-yellow-300 font-black">Grand Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(pivotStatus.tree).map((wok) => (
                    <React.Fragment key={wok.name}>
                      <tr className="bg-slate-100 font-black text-slate-800 border-b border-slate-300">
                        <td
                          className="p-1.5 border border-slate-300 text-left pl-2 cursor-pointer hover:text-blue-700"
                          onClick={() => setSelectedWok((prev) => (prev === wok.name ? 'ALL' : wok.name))}
                        >
                          &oplus; {wok.name}
                        </td>
                        {pivotStatus.columns.map((st) => (
                          <td key={st} className="p-1.5 border border-slate-300">
                            {wok.colCounts[st] || ''}
                          </td>
                        ))}
                        <td className="p-1.5 border border-slate-300 font-extrabold bg-slate-200">
                          {wok.total}
                        </td>
                      </tr>

                      {Object.values(wok.stos).map((sto) => (
                        <tr
                          key={sto.name}
                          className="border-b border-slate-200 hover:bg-blue-50/70 transition bg-white"
                        >
                          <td
                            className="p-1 border border-slate-200 text-left pl-6 font-semibold text-slate-700 cursor-pointer hover:text-blue-700"
                            onClick={() => setSelectedSto((prev) => (prev === sto.name ? 'ALL' : sto.name))}
                          >
                            {sto.name}
                          </td>
                          {pivotStatus.columns.map((st) => (
                            <td key={st} className="p-1 border border-slate-200 text-slate-600">
                              {sto.colCounts[st] || ''}
                            </td>
                          ))}
                          <td className="p-1 border border-slate-200 font-bold text-slate-800 bg-slate-50">
                            {sto.total}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}

                  <tr className="bg-[#0f172a] text-white font-black sticky bottom-0 z-10 shadow">
                    <td className="p-2 border border-slate-700 text-left pl-3 uppercase">Grand Total</td>
                    {pivotStatus.columns.map((st) => (
                      <td key={st} className="p-2 border border-slate-700">
                        {pivotStatus.grandColTotals[st] || 0}
                      </td>
                    ))}
                    <td className="p-2 border border-slate-700 text-yellow-300 font-black">
                      {pivotStatus.totalAll}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ================= SECTION TENGAH: PIVOT FALLOUT & DURATION FALLOUT CHART ================= */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 sm:gap-4">
          
          {/* PIVOT 3: DURATION -> FALLOUT REASON */}
          <div className="xl:col-span-1 bg-white border border-slate-300 shadow-xs rounded overflow-hidden">
            <div className="bg-[#0f172a] text-white p-2 flex justify-between items-center text-xs font-black uppercase">
              <span>Row Labels &bull; Fallout Reason</span>
              <span className="text-[10px] text-yellow-300">Count of order_id</span>
            </div>
            <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead className="bg-[#1e293b] text-white sticky top-0 z-10 shadow-xs">
                  <tr>
                    <th className="p-2 border border-slate-600">Row Labels</th>
                    <th className="p-2 border border-slate-600 text-right pr-4">Count of order_id</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(pivotFallout.tree).map((dur) => (
                    <React.Fragment key={dur.name}>
                      <tr className="bg-slate-100 font-black text-slate-900 border-b border-slate-300">
                        <td className="p-1.5 border border-slate-300 pl-2">
                          &oplus; {dur.name}
                        </td>
                        <td className="p-1.5 border border-slate-300 text-right pr-4 font-black">
                          {dur.total}
                        </td>
                      </tr>

                      {Object.entries(dur.reasons).map(([reason, cnt]) => (
                        <tr key={reason} className="border-b border-slate-200 hover:bg-slate-50 bg-white">
                          <td className="p-1 border border-slate-200 pl-6 font-semibold text-slate-700">
                            {reason}
                          </td>
                          <td className="p-1 border border-slate-200 text-right pr-4 text-slate-800 font-bold">
                            {cnt}
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}

                  <tr className="bg-[#0f172a] text-white font-black sticky bottom-0 z-10 shadow">
                    <td className="p-2 border border-slate-700 uppercase">Grand Total</td>
                    <td className="p-2 border border-slate-700 text-right pr-4 text-yellow-300 font-black">
                      {pivotFallout.totalAll}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* DIAGRAM BATANG DURATION FALLOUT */}
          <div className="xl:col-span-2 bg-white border border-slate-300 shadow-xs rounded p-3">
            <h4 className="text-center font-extrabold text-slate-800 text-xs sm:text-sm tracking-wide uppercase mb-2">
              DURATION FALLOUT
            </h4>
            <div className="h-72 w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold text-xs">
                  Tidak ada data Fallout pada filter yang dipilih.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 10, left: -20, bottom: 50 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="reason"
                      interval={0}
                      tick={({ x, y, payload }) => (
                        <g transform={`translate(${x},${y})`}>
                          <text
                            x={0}
                            y={0}
                            dy={10}
                            textAnchor="end"
                            fill="#334155"
                            fontWeight="bold"
                            fontSize={8}
                            transform="rotate(-30)"
                          >
                            {payload.value}
                          </text>
                        </g>
                      )}
                    />
                    <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white p-2 rounded shadow-lg border border-slate-300 text-xs font-sans">
                              <p className="font-black text-slate-900">{d.reason}</p>
                              <p className="text-[11px] font-bold text-slate-600">Durasi: {d.duration}</p>
                              <p className="text-xs font-black text-blue-700 mt-1">Total: {d.count} Order</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar
                      dataKey="count"
                      label={({ x, y, width, value }) => (
                        <text
                          x={x + width / 2}
                          y={y - 6}
                          fill="#0f172a"
                          textAnchor="middle"
                          fontSize={9}
                          fontWeight="bold"
                        >
                          {value}
                        </text>
                      )}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fillColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="flex items-center justify-center gap-4 text-[10px] font-bold text-slate-600 mt-2 border-t pt-1.5">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-[#22c55e] rounded-xs inline-block"></span> 3 HARI
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-[#f97316] rounded-xs inline-block"></span> 7 HARI
              </span>
            </div>
          </div>
        </div>

        {/* ================= SECTION BAWAH: RAW DATA ORDER FULFILLMENT ================= */}
        <div className="bg-white border border-slate-300 shadow-xs rounded overflow-hidden mt-4">
          <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#334155] text-white p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                <span>📦</span> DATA DETAIL ORDER FULFILLMENT
              </h2>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Menampilkan <strong>{bottomTableData.length.toLocaleString()}</strong> dari{' '}
                <strong>{orders.length.toLocaleString()}</strong> total order
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Cari Order ID, Nama, ODP, STO..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 text-black rounded text-xs outline-none w-full sm:w-56"
              />
              <button
                type="button"
                onClick={handleExportCSV}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold shadow flex items-center gap-1 whitespace-nowrap transition"
              >
                <span>📥</span> Download CSV ({filteredOrders.length.toLocaleString()})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-[10px] whitespace-nowrap">
              <thead className="bg-[#3b0764] text-white uppercase font-bold sticky top-0 z-10 shadow">
                <tr>
                  <th className="p-2 border border-purple-800">No</th>
                  <th className="p-2 border border-purple-800">Order ID</th>
                  <th className="p-2 border border-purple-800">Order Status</th>
                  <th className="p-2 border border-purple-800">Nama Pelanggan</th>
                  <th className="p-2 border border-purple-800">No HP</th>
                  <th className="p-2 border border-purple-800">STO</th>
                  <th className="p-2 border border-purple-800">WOK</th>
                  <th className="p-2 border border-purple-800">ODP Name</th>
                  <th className="p-2 border border-purple-800">Product Name</th>
                  <th className="p-2 border border-purple-800">Duration Cat</th>
                  <th className="p-2 border border-purple-800">Fallout Reason</th>
                  <th className="p-2 border border-purple-800">Price</th>
                  <th className="p-2 border border-purple-800">Order Date</th>
                  <th className="p-2 border border-purple-800">PS Date</th>
                  <th className="p-2 border border-purple-800">SF Name</th>
                  <th className="p-2 border border-purple-800">Alamat</th>
                  <th className="p-2 border border-purple-800">Latitude</th>
                  <th className="p-2 border border-purple-800">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={18} className="p-4 text-center text-slate-400 font-bold">
                      Tidak ada data Order yang cocok dengan filter atau pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, idx) => {
                    const rowNumber = (currentPage - 1) * rowsPerPage + idx + 1;
                    return (
                      <tr
                        key={`${row.order_id}-${idx}`}
                        className="border-b border-slate-200 hover:bg-purple-50/60 transition"
                      >
                        <td className="p-1.5 border border-slate-200 text-center font-bold text-slate-500">{rowNumber}</td>
                        <td className="p-1.5 border border-slate-200 font-black text-purple-900">{row.order_id}</td>
                        <td className="p-1.5 border border-slate-200 font-bold">{row.order_status_clean}</td>
                        <td className="p-1.5 border border-slate-200 font-semibold">{row.name || '-'}</td>
                        <td className="p-1.5 border border-slate-200 font-mono text-[9px]">{row.no_handphone || row.no_handphone_mask || '-'}</td>
                        <td className="p-1.5 border border-slate-200 font-bold">{row.sto_co || '-'}</td>
                        <td className="p-1.5 border border-slate-200">{row.wok || '-'}</td>
                        <td className="p-1.5 border border-slate-200 font-bold text-blue-800">{row.odp_name || '-'}</td>
                        <td className="p-1.5 border border-slate-200">{row.product_commercial_name || '-'}</td>
                        <td className="p-1.5 border border-slate-200 font-bold text-emerald-800">{row.order_duration_cat || '-'}</td>
                        <td className="p-1.5 border border-slate-200 text-red-600 font-semibold max-w-[200px] truncate" title={row.fallout_reason_clean}>{row.fallout_reason_clean || '-'}</td>
                        <td className="p-1.5 border border-slate-200 text-right">{row.price_package ? Number(row.price_package).toLocaleString() : '-'}</td>
                        <td className="p-1.5 border border-slate-200">{row.order_ts || '-'}</td>
                        <td className="p-1.5 border border-slate-200">{row.ps_ts || '-'}</td>
                        <td className="p-1.5 border border-slate-200">{row.sf_name || '-'}</td>
                        <td className="p-1.5 border border-slate-200 max-w-[200px] truncate" title={row.address}>{row.address || '-'}</td>
                        <td className="p-1.5 border border-slate-200 font-mono text-[9px]">{row.latitude || '-'}</td>
                        <td className="p-1.5 border border-slate-200 font-mono text-[9px]">{row.longitude || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="bg-slate-50 p-2.5 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs font-semibold">
              <span className="text-slate-600">
                Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> (Total <strong>{bottomTableData.length.toLocaleString()}</strong> data)
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs"
                >
                  &laquo; Pertama
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs"
                >
                  &lsaquo; Prev
                </button>
                <span className="px-2 font-bold text-slate-700">{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs"
                >
                  Next &rsaquo;
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs"
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
