import React, { useState, useMemo } from 'react';
import Head from 'next/head';
import Papa from 'papaparse';
import Sidebar from '../components/Sidebar';
import Uploader from '../components/Uploader';
import { useData } from '../context/DataContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts';

const ALLOWED_STOS = [
  'BNT', 'PLK', 'KKN', 'MTW', 'PPS', 'PYM', 'TML', 'AMP', 'KKP', 'KRI', 'KSO', 'PRC'
];

const DURATION_ORDER = ['3 HARI', '7 HARI', '30 HARI', '3 BULAN'];

function sortDurationColumns(cols = []) {
  return [...cols].sort((a, b) => {
    const idxA = DURATION_ORDER.indexOf(a);
    const idxB = DURATION_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return String(a).localeCompare(String(b));
  });
}

const DURATION_COLORS = {
  '3 HARI': '#22c55e',
  '7 HARI': '#f97316',
  '30 HARI': '#3b82f6',
  '3 BULAN': '#a855f7',
  DEFAULT: '#64748b',
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const ALLOWED_FUNNELING_SUBGROUPS = ['PROVISION_ISSUED', 'INPROGRESS_PC'];

function formatFullDateTime(d) {
  if (!d || isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${mins}`;
}

const FALLOUT_KEYWORDS = [
  'ODP BELUM GO LIVE', 'ODP FULL', 'ODP JAUH', 'ODP LOSS', 'ODP RETI', 'ODP RUSAK', 'TIDAK ADA ODP',
  'KENDALA JALUR/RUTE TARIKAN', 'KENDALA IKR/IKG', 'KENDALA IZIN', 'KENDALA MATERIAL/NTE', 'KENDALA PERANGKAT',
  'ALAMAT TIDAK DITEMUKAN', 'INDIKASI CABUT PASANG', 'PELANGGAN MASIH RAGU', 'PELANGGAN TIDAK MERASA PASANG',
  'RUMAH KOSONG', 'CROSS JALAN', 'DOUBLE INPUT', 'GANTI PAKET', 'LIMITASI ONU', 'TIANG', 'BATAL',
  'PENDING', 'SYSTEM', 'ACTIVATION', 'DATA', 'RNA', 'ODP', 'LAINNYA',
];

function normalizeFalloutReason(rawVal) {
  if (!rawVal || String(rawVal).trim() === '' || String(rawVal).toLowerCase() === 'nan' || String(rawVal).toLowerCase() === 'null') {
    return null;
  }
  const cleanStr = String(rawVal).toUpperCase().replace(/_/g, ' ');
  for (const kw of FALLOUT_KEYWORDS) {
    const kwClean = kw.toUpperCase().replace(/_/g, ' ');
    const escaped = kwClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?<![A-Z0-9])${escaped}(?![A-Z0-9])`, 'i');
    if (regex.test(cleanStr)) {
      return kwClean;
    }
  }
  return 'LAINNYA';
}

export default function OrdersPage() {
  const dataContext = useData() || {};
  const orders = dataContext.ordersData || [];
  const ordersLoaded = dataContext.ordersLoaded || false;
  const reloadOrders = dataContext.reloadOrders || (() => {});
  const reloadAll = dataContext.reloadAll || (() => {});

  const [showUploader, setShowUploader] = useState(false);

  // Filter States
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedWok, setSelectedWok] = useState('ALL');
  const [selectedSto, setSelectedSto] = useState('ALL');
  const [selectedDuration, setSelectedDuration] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedSubgroup, setSelectedSubgroup] = useState('ALL'); // 'ALL' | 'PI_INPROGRESS' | specific
  const [selectedFallout, setSelectedFallout] = useState('ALL');

  // Pivot Sorting States
  const [pivot1Sort, setPivot1Sort] = useState({ key: 'total', direction: 'desc' });
  const [pivot2Sort, setPivot2Sort] = useState({ key: 'total', direction: 'desc' });
  const [pivotFalloutSort, setPivotFalloutSort] = useState({ key: 'count', direction: 'desc' });

  // Bottom Table States
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'order_ts', direction: 'desc' });
  const rowsPerPage = 50;

  // List Bulan Dinamis
  const availableMonths = useMemo(() => {
    const set = new Set();
    orders.forEach((o) => {
      if (o && o.order_ts) {
        const d = new Date(o.order_ts);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
          set.add(JSON.stringify({ key, label }));
        }
      }
    });
    return Array.from(set)
      .map((str) => JSON.parse(str))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [orders]);

  // Header Cut-Off Date Range
  const headerCutoffText = useMemo(() => {
    if (!orders || orders.length === 0) return '*Cut Off Data -';
    const dates = orders
      .map((o) => (o && o.order_ts ? new Date(o.order_ts).getTime() : null))
      .filter((t) => t && !isNaN(t));

    if (dates.length === 0) return '*Cut Off Data';
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));

    return `*Cut Off Data (${formatFullDateTime(earliest)} - ${formatFullDateTime(latest)})`;
  }, [orders]);

  // Filter Sinkron Seluruh Komponen
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!o) return false;

      let matchMonth = true;
      if (selectedMonth !== 'ALL') {
        if (!o.order_ts) {
          matchMonth = false;
        } else {
          const d = new Date(o.order_ts);
          if (isNaN(d.getTime())) {
            matchMonth = false;
          } else {
            const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            matchMonth = mKey === selectedMonth;
          }
        }
      }

      const matchWok = selectedWok === 'ALL' || o.wok === selectedWok;
      const matchSto = selectedSto === 'ALL' || o.sto_co === selectedSto;
      const matchDur = selectedDuration === 'ALL' || o.order_duration_cat === selectedDuration;
      
      const processState = (o.process_state || 'UNKNOWN').trim().toUpperCase();
      const matchStat = selectedStatus === 'ALL' || processState === selectedStatus;

      const subGroup = (o.funneling_subgroup || '').trim().toUpperCase();
      let matchSubgroup = true;
      if (selectedSubgroup === 'PI_INPROGRESS') {
        matchSubgroup = ALLOWED_FUNNELING_SUBGROUPS.includes(subGroup);
      } else if (selectedSubgroup !== 'ALL') {
        matchSubgroup = subGroup === selectedSubgroup;
      }
      
      const matchFallout = selectedFallout === 'ALL' || o.fallout_reason_clean === selectedFallout;
      return matchMonth && matchWok && matchSto && matchDur && matchStat && matchSubgroup && matchFallout;
    });
  }, [orders, selectedMonth, selectedWok, selectedSto, selectedDuration, selectedStatus, selectedSubgroup, selectedFallout]);

  // Data Basis Khusus untuk Pivot 1 & Pivot 2 (Mengabaikan filter status/fallout saat membentuk matriks pivot)
  const pivotBaseOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!o) return false;

      let matchMonth = true;
      if (selectedMonth !== 'ALL' && o.order_ts) {
        const d = new Date(o.order_ts);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        matchMonth = mKey === selectedMonth;
      }

      const matchWok = selectedWok === 'ALL' || o.wok === selectedWok;
      const matchSto = selectedSto === 'ALL' || o.sto_co === selectedSto;
      const sub = (o.funneling_subgroup || '').trim().toUpperCase();
      const matchSub = ALLOWED_FUNNELING_SUBGROUPS.includes(sub);

      return matchMonth && matchWok && matchSto && matchSub;
    });
  }, [orders, selectedMonth, selectedWok, selectedSto]);

  // Pivot 1: WOK & STO vs Duration (Khusus PROVISION_ISSUED & INPROGRESS_PC)
  const pivotDuration = useMemo(() => {
    const durColumnsSet = new Set();
    const map = {};

    pivotBaseOrders.forEach((o) => {
      const wok = o.wok || 'PALANGKARAYA';
      const sto = o.sto_co || 'UNKNOWN';
      const dur = o.order_duration_cat || 'LAINNYA';
      durColumnsSet.add(dur);

      if (!map[wok]) map[wok] = { name: wok, total: 0, stos: {}, colCounts: {} };
      if (!map[wok].stos[sto]) map[wok].stos[sto] = { name: sto, total: 0, colCounts: {} };

      map[wok].total++;
      map[wok].colCounts[dur] = (map[wok].colCounts[dur] || 0) + 1;

      map[wok].stos[sto].total++;
      map[wok].stos[sto].colCounts[dur] = (map[wok].stos[sto].colCounts[dur] || 0) + 1;
    });

    const columns = sortDurationColumns(Array.from(durColumnsSet));
    const grandColTotals = {};
    columns.forEach((c) => (grandColTotals[c] = 0));
    let totalAll = 0;

    Object.values(map).forEach((w) => {
      totalAll += w.total;
      columns.forEach((c) => {
        grandColTotals[c] += w.colCounts[c] || 0;
      });
    });

    const sortedWoks = Object.values(map).sort((a, b) => {
      let valA = pivot1Sort.key === 'total' ? a.total : (a.colCounts[pivot1Sort.key] || 0);
      let valB = pivot1Sort.key === 'total' ? b.total : (b.colCounts[pivot1Sort.key] || 0);
      if (pivot1Sort.key === 'name') {
        return pivot1Sort.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      return pivot1Sort.direction === 'asc' ? valA - valB : valB - valA;
    });

    return { sortedWoks, columns, grandColTotals, totalAll };
  }, [pivotBaseOrders, pivot1Sort]);

  // Pivot 2: WOK & STO vs Process State (Khusus PROVISION_ISSUED & INPROGRESS_PC)
  const pivotStatus = useMemo(() => {
    const statusSet = new Set();
    const map = {};

    pivotBaseOrders.forEach((o) => {
      const wok = o.wok || 'PALANGKARAYA';
      const sto = o.sto_co || 'UNKNOWN';
      const st = (o.process_state || 'UNKNOWN').trim().toUpperCase();
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

    const sortedWoks = Object.values(map).sort((a, b) => {
      let valA = pivot2Sort.key === 'total' ? a.total : (a.colCounts[pivot2Sort.key] || 0);
      let valB = pivot2Sort.key === 'total' ? b.total : (b.colCounts[pivot2Sort.key] || 0);
      if (pivot2Sort.key === 'name') {
        return pivot2Sort.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      return pivot2Sort.direction === 'asc' ? valA - valB : valB - valA;
    });

    return { sortedWoks, columns, grandColTotals, totalAll };
  }, [pivotBaseOrders, pivot2Sort]);

  // Pivot 3: Duration vs Fallout (Khusus process_state === 'FALLOUT')
  const pivotFallout = useMemo(() => {
    const tree = {};
    let totalAll = 0;

    const baseOrders = orders.filter((o) => {
      if (!o) return false;
      let matchMonth = true;
      if (selectedMonth !== 'ALL' && o.order_ts) {
        const d = new Date(o.order_ts);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        matchMonth = mKey === selectedMonth;
      }
      const matchWok = selectedWok === 'ALL' || o.wok === selectedWok;
      const matchSto = selectedSto === 'ALL' || o.sto_co === selectedSto;
      const pState = (o.process_state || '').trim().toUpperCase();
      return matchMonth && matchWok && matchSto && pState === 'FALLOUT';
    });

    baseOrders.forEach((o) => {
      const dur = o.order_duration_cat || 'LAINNYA';
      const r = o.fallout_reason_clean || 'LAINNYA';

      if (!tree[dur]) tree[dur] = { name: dur, total: 0, reasons: {} };
      tree[dur].total++;
      tree[dur].reasons[r] = (tree[dur].reasons[r] || 0) + 1;
      totalAll++;
    });

    return { tree, totalAll };
  }, [orders, selectedMonth, selectedWok, selectedSto]);

  // Chart Data (Duration Fallout)
  const { chartData, dividerIndices } = useMemo(() => {
    const list = [];
    const dividers = [];
    
    const durKeys = selectedDuration !== 'ALL' 
      ? [selectedDuration].filter(k => pivotFallout.tree[k]) 
      : Object.keys(pivotFallout.tree);
    
    const sortedDurKeys = sortDurationColumns(durKeys);

    let currentIndex = 0;
    sortedDurKeys.forEach((durKey, idx) => {
      const reasonsObj = pivotFallout.tree[durKey]?.reasons || {};
      const sortedReasons = Object.entries(reasonsObj).sort((a, b) => a[1] - b[1]);

      sortedReasons.forEach(([reason, count]) => {
        list.push({
          index: currentIndex,
          duration: durKey,
          reason: reason,
          count: count,
          fillColor: DURATION_COLORS[durKey] || DURATION_COLORS.DEFAULT,
          fullLabel: `${reason} (${durKey})`,
        });
        currentIndex++;
      });

      if (idx < sortedDurKeys.length - 1 && sortedReasons.length > 0 && list.length > 0) {
        dividers.push(list[list.length - 1].reason);
      }
    });

    return { chartData: list, dividerIndices: dividers };
  }, [pivotFallout, selectedDuration]);

  // Sorting Handlers
  const handlePivot1Sort = (key) => {
    let direction = 'desc';
    if (pivot1Sort.key === key && pivot1Sort.direction === 'desc') direction = 'asc';
    setPivot1Sort({ key, direction });
  };

  const handlePivot2Sort = (key) => {
    let direction = 'desc';
    if (pivot2Sort.key === key && pivot2Sort.direction === 'desc') direction = 'asc';
    setPivot2Sort({ key, direction });
  };

  const handlePivotFalloutSort = (key) => {
    let direction = 'desc';
    if (pivotFalloutSort.key === key && pivotFalloutSort.direction === 'desc') direction = 'asc';
    setPivotFalloutSort({ key, direction });
  };

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedBottomTableData = useMemo(() => {
    let filtered = filteredOrders;
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          (o.order_id && o.order_id.toLowerCase().includes(s)) ||
          (o.name && o.name.toLowerCase().includes(s)) ||
          (o.odp_name && o.odp_name.toLowerCase().includes(s)) ||
          (o.sto_co && o.sto_co.toLowerCase().includes(s)) ||
          (o.process_state && o.process_state.toLowerCase().includes(s)) ||
          (o.funneling_subgroup && o.funneling_subgroup.toLowerCase().includes(s)) ||
          (o.fallout_reason_clean && o.fallout_reason_clean.toLowerCase().includes(s))
      );
    }

    return [...filtered].sort((a, b) => {
      let valA = a[sortConfig.key] ?? '';
      let valB = b[sortConfig.key] ?? '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
      }
      return sortConfig.direction === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredOrders, searchTerm, sortConfig]);

  const totalPages = Math.ceil(sortedBottomTableData.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedBottomTableData.slice(start, start + rowsPerPage);
  }, [sortedBottomTableData, currentPage]);

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
    setSelectedMonth('ALL');
    setSelectedWok('ALL');
    setSelectedSto('ALL');
    setSelectedDuration('ALL');
    setSelectedStatus('ALL');
    setSelectedSubgroup('ALL');
    setSelectedFallout('ALL');
  };

  return (
    <Sidebar>
      <Head>
        <title>Trend Order & Fallout Analysis</title>
      </Head>

      {!ordersLoaded && (
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
              {headerCutoffText}
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
            <span className="font-bold text-slate-600 text-[11px]">Filter:</span>

            {/* Filter Bulan */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[11px]"
            >
              <option value="ALL">Semua Bulan</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>

            {/* Filter WOK */}
            <select
              value={selectedWok}
              onChange={(e) => setSelectedWok(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[11px]"
            >
              <option value="ALL">Semua WOK</option>
              <option value="BARITO - KAPUAS">BARITO - KAPUAS</option>
              <option value="PALANGKARAYA">PALANGKARAYA</option>
            </select>

            {/* Filter STO */}
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

            {/* Filter Durasi */}
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

            {/* Filter Status (process_state) */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[11px]"
            >
              <option value="ALL">Semua Status (Process State)</option>
              {pivotStatus.columns.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          {(selectedMonth !== 'ALL' || selectedWok !== 'ALL' || selectedSto !== 'ALL' || selectedDuration !== 'ALL' || selectedStatus !== 'ALL' || selectedSubgroup !== 'ALL' || selectedFallout !== 'ALL') && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[10px] shadow"
            >
              ✕ Reset Semua Filter
            </button>
          )}
        </div>

        {showUploader && (
          <div className="transition-all duration-300">
            <Uploader
              onUploadOdpSuccess={reloadAll}
              onUploadOrderSuccess={reloadOrders}
            />
          </div>
        )}

        {/* ================= SECTION ATAS: 2 PIVOT TABLE (SINKRON PI_INPROGRESS) ================= */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
          
          {/* PIVOT 1: DURATION */}
          <div className="bg-white border border-slate-300 shadow-xs rounded overflow-hidden">
            <div className="bg-[#0f172a] text-white p-2 flex justify-between items-center text-xs font-black uppercase flex-wrap gap-1">
              <span>Count of order_id &bull; Duration SLA</span>
              <span className="text-[9.5px] text-emerald-300 font-semibold bg-white/10 px-1.5 py-0.5 rounded">
                Subgroup: PROVISION_ISSUED & INPROGRESS_PC
              </span>
            </div>
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-center border-collapse text-[10.5px]">
                <thead className="bg-[#1e293b] text-white sticky top-0 z-10 shadow-xs select-none">
                  <tr>
                    <th
                      className="p-1.5 border border-slate-600 text-left pl-3 cursor-pointer hover:bg-slate-700"
                      onClick={() => handlePivot1Sort('name')}
                    >
                      Row Labels {pivot1Sort.key === 'name' ? (pivot1Sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    {pivotDuration.columns.map((c) => (
                      <th
                        key={c}
                        className={`p-1.5 border border-slate-600 cursor-pointer hover:opacity-80 ${
                          c === '3 HARI' ? 'bg-[#bbf7d0] text-emerald-950 font-black' :
                          c === '7 HARI' ? 'bg-[#fed7aa] text-orange-950 font-black' :
                          c === '30 HARI' ? 'bg-[#bfdbfe] text-blue-950 font-black' :
                          c === '3 BULAN' ? 'bg-[#e9d5ff] text-purple-950 font-black' : 'bg-slate-700'
                        }`}
                        onClick={() => {
                          setSelectedSubgroup('PI_INPROGRESS');
                          setSelectedStatus('ALL');
                          setSelectedFallout('ALL');
                          setSelectedDuration(c);
                        }}
                        title="Klik untuk filter kolom durasi ini"
                      >
                        {c} {pivot1Sort.key === c ? (pivot1Sort.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    ))}
                    <th
                      className="p-1.5 border border-slate-600 bg-[#0f172a] text-yellow-300 font-black cursor-pointer hover:bg-slate-800"
                      onClick={() => handlePivot1Sort('total')}
                      title="Klik untuk sort Grand Total"
                    >
                      Grand Total {pivot1Sort.key === 'total' ? (pivot1Sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pivotDuration.sortedWoks.length === 0 ? (
                    <tr>
                      <td colSpan={pivotDuration.columns.length + 2} className="p-4 text-slate-400 font-bold text-center">
                        Tidak ada data dengan subgroup PROVISION_ISSUED / INPROGRESS_PC pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    pivotDuration.sortedWoks.map((wok) => {
                      const sortedStos = Object.values(wok.stos).sort((a, b) => {
                        let valA = pivot1Sort.key === 'total' ? a.total : (a.colCounts[pivot1Sort.key] || 0);
                        let valB = pivot1Sort.key === 'total' ? b.total : (b.colCounts[pivot1Sort.key] || 0);
                        if (pivot1Sort.key === 'name') {
                          return pivot1Sort.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                        }
                        return pivot1Sort.direction === 'asc' ? valA - valB : valB - valA;
                      });

                      return (
                        <React.Fragment key={wok.name}>
                          <tr className="bg-slate-100 font-black text-slate-800 border-b border-slate-300">
                            <td
                              className="p-1.5 border border-slate-300 text-left pl-2 cursor-pointer hover:text-blue-700"
                              onClick={() => {
                                setSelectedSubgroup('PI_INPROGRESS');
                                setSelectedStatus('ALL');
                                setSelectedFallout('ALL');
                                setSelectedWok((prev) => (prev === wok.name ? 'ALL' : wok.name));
                              }}
                            >
                              &oplus; {wok.name}
                            </td>
                            {pivotDuration.columns.map((c) => (
                              <td
                                key={c}
                                className="p-1.5 border border-slate-300 cursor-pointer hover:bg-emerald-100 font-semibold"
                                onClick={() => {
                                  setSelectedSubgroup('PI_INPROGRESS');
                                  setSelectedStatus('ALL');
                                  setSelectedFallout('ALL');
                                  setSelectedWok(wok.name);
                                  setSelectedDuration(c);
                                }}
                                title={`Klik untuk filter WOK ${wok.name} - Durasi ${c}`}
                              >
                                {wok.colCounts[c] || ''}
                              </td>
                            ))}
                            <td
                              className="p-1.5 border border-slate-300 font-extrabold bg-slate-200 cursor-pointer hover:bg-yellow-100"
                              onClick={() => {
                                setSelectedSubgroup('PI_INPROGRESS');
                                setSelectedStatus('ALL');
                                setSelectedFallout('ALL');
                                setSelectedWok(wok.name);
                                setSelectedDuration('ALL');
                              }}
                              title="Klik Grand Total WOK"
                            >
                              {wok.total}
                            </td>
                          </tr>

                          {sortedStos.map((sto) => (
                            <tr
                              key={sto.name}
                              className="border-b border-slate-200 hover:bg-blue-50/70 transition bg-white"
                            >
                              <td
                                className="p-1 border border-slate-200 text-left pl-6 font-semibold text-slate-700 cursor-pointer hover:text-blue-700"
                                onClick={() => {
                                  setSelectedSubgroup('PI_INPROGRESS');
                                  setSelectedStatus('ALL');
                                  setSelectedFallout('ALL');
                                  setSelectedSto((prev) => (prev === sto.name ? 'ALL' : sto.name));
                                }}
                              >
                                {sto.name}
                              </td>
                              {pivotDuration.columns.map((c) => (
                                <td
                                  key={c}
                                  className="p-1 border border-slate-200 text-slate-600 cursor-pointer hover:bg-blue-100 font-semibold"
                                  onClick={() => {
                                    setSelectedSubgroup('PI_INPROGRESS');
                                    setSelectedStatus('ALL');
                                    setSelectedFallout('ALL');
                                    setSelectedSto(sto.name);
                                    setSelectedDuration(c);
                                  }}
                                  title={`Klik untuk filter STO ${sto.name} - Durasi ${c}`}
                                >
                                  {sto.colCounts[c] || ''}
                                </td>
                              ))}
                              <td
                                className="p-1 border border-slate-200 font-bold text-slate-800 bg-slate-50 cursor-pointer hover:bg-yellow-100"
                                onClick={() => {
                                  setSelectedSubgroup('PI_INPROGRESS');
                                  setSelectedStatus('ALL');
                                  setSelectedFallout('ALL');
                                  setSelectedSto(sto.name);
                                  setSelectedDuration('ALL');
                                }}
                                title="Klik Grand Total STO"
                              >
                                {sto.total}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}

                  <tr className="bg-[#0f172a] text-white font-black sticky bottom-0 z-10 shadow cursor-pointer">
                    <td
                      className="p-2 border border-slate-700 text-left pl-3 uppercase hover:text-yellow-300"
                      onClick={() => {
                        setSelectedSubgroup('PI_INPROGRESS');
                        setSelectedStatus('ALL');
                        setSelectedFallout('ALL');
                        setSelectedWok('ALL');
                        setSelectedSto('ALL');
                      }}
                      title="Klik untuk filter semua data WOK & STO (PI/Inprogress)"
                    >
                      Grand Total
                    </td>
                    {pivotDuration.columns.map((c) => (
                      <td
                        key={c}
                        className="p-2 border border-slate-700 hover:bg-slate-800"
                        onClick={() => {
                          setSelectedSubgroup('PI_INPROGRESS');
                          setSelectedStatus('ALL');
                          setSelectedFallout('ALL');
                          setSelectedDuration(c);
                        }}
                        title={`Klik untuk filter durasi ${c} (PI/Inprogress)`}
                      >
                        {pivotDuration.grandColTotals[c] || 0}
                      </td>
                    ))}
                    <td
                      className="p-2 border border-slate-700 text-yellow-300 font-black hover:bg-yellow-600 hover:text-slate-900"
                      onClick={() => {
                        setSelectedSubgroup('PI_INPROGRESS');
                        setSelectedStatus('ALL');
                        setSelectedFallout('ALL');
                        setSelectedWok('ALL');
                        setSelectedSto('ALL');
                        setSelectedDuration('ALL');
                      }}
                      title="Klik untuk filter total data PROVISION_ISSUED & INPROGRESS_PC"
                    >
                      {pivotDuration.totalAll}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* PIVOT 2: PROCESS_STATE */}
          <div className="bg-white border border-slate-300 shadow-xs rounded overflow-hidden">
            <div className="bg-[#0f172a] text-white p-2 flex justify-between items-center text-xs font-black uppercase flex-wrap gap-1">
              <span>Count of order_id &bull; Process State</span>
              <span className="text-[9.5px] text-blue-300 font-semibold bg-white/10 px-1.5 py-0.5 rounded">
                Subgroup: PROVISION_ISSUED & INPROGRESS_PC
              </span>
            </div>
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="w-full text-center border-collapse text-[10.5px]">
                <thead className="bg-[#1e293b] text-white sticky top-0 z-10 shadow-xs select-none">
                  <tr>
                    <th
                      className="p-1.5 border border-slate-600 text-left pl-3 cursor-pointer hover:bg-slate-700 min-w-[120px]"
                      onClick={() => handlePivot2Sort('name')}
                    >
                      Row Labels {pivot2Sort.key === 'name' ? (pivot2Sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    {pivotStatus.columns.map((st) => (
                      <th
                        key={st}
                        className="p-1.5 border border-slate-600 font-bold bg-[#e0f2fe] text-blue-950 cursor-pointer hover:opacity-80 min-w-[100px] max-w-[140px] whitespace-normal break-words leading-tight"
                        title={st}
                        onClick={() => {
                          setSelectedSubgroup('PI_INPROGRESS');
                          setSelectedFallout('ALL');
                          setSelectedStatus(st);
                        }}
                      >
                        {st} {pivot2Sort.key === st ? (pivot2Sort.direction === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    ))}
                    <th
                      className="p-1.5 border border-slate-600 bg-[#0f172a] text-yellow-300 font-black cursor-pointer hover:bg-slate-800 min-w-[90px]"
                      onClick={() => handlePivot2Sort('total')}
                      title="Klik untuk sort Grand Total"
                    >
                      Grand Total {pivot2Sort.key === 'total' ? (pivot2Sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pivotStatus.sortedWoks.length === 0 ? (
                    <tr>
                      <td colSpan={pivotStatus.columns.length + 2} className="p-4 text-slate-400 font-bold text-center">
                        Tidak ada data dengan subgroup PROVISION_ISSUED / INPROGRESS_PC pada filter ini.
                      </td>
                    </tr>
                  ) : (
                    pivotStatus.sortedWoks.map((wok) => {
                      const sortedStos = Object.values(wok.stos).sort((a, b) => {
                        let valA = pivot2Sort.key === 'total' ? a.total : (a.colCounts[pivot2Sort.key] || 0);
                        let valB = pivot2Sort.key === 'total' ? b.total : (b.colCounts[pivot2Sort.key] || 0);
                        if (pivot2Sort.key === 'name') {
                          return pivot2Sort.direction === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
                        }
                        return pivot2Sort.direction === 'asc' ? valA - valB : valB - valA;
                      });

                      return (
                        <React.Fragment key={wok.name}>
                          <tr className="bg-slate-100 font-black text-slate-800 border-b border-slate-300">
                            <td
                              className="p-1.5 border border-slate-300 text-left pl-2 cursor-pointer hover:text-blue-700"
                              onClick={() => {
                                setSelectedSubgroup('PI_INPROGRESS');
                                setSelectedFallout('ALL');
                                setSelectedWok((prev) => (prev === wok.name ? 'ALL' : wok.name));
                              }}
                            >
                              &oplus; {wok.name}
                            </td>
                            {pivotStatus.columns.map((st) => (
                              <td
                                key={st}
                                className="p-1.5 border border-slate-300 cursor-pointer hover:bg-blue-100 font-semibold"
                                onClick={() => {
                                  setSelectedSubgroup('PI_INPROGRESS');
                                  setSelectedFallout('ALL');
                                  setSelectedWok(wok.name);
                                  setSelectedStatus(st);
                                }}
                                title={`Klik untuk filter WOK ${wok.name} - Status ${st}`}
                              >
                                {wok.colCounts[st] || ''}
                              </td>
                            ))}
                            <td
                              className="p-1.5 border border-slate-300 font-extrabold bg-slate-200 cursor-pointer hover:bg-yellow-100"
                              onClick={() => {
                                setSelectedSubgroup('PI_INPROGRESS');
                                setSelectedFallout('ALL');
                                setSelectedWok(wok.name);
                                setSelectedStatus('ALL');
                              }}
                              title="Klik Grand Total WOK"
                            >
                              {wok.total}
                            </td>
                          </tr>

                          {sortedStos.map((sto) => (
                            <tr
                              key={sto.name}
                              className="border-b border-slate-200 hover:bg-blue-50/70 transition bg-white"
                            >
                              <td
                                className="p-1 border border-slate-200 text-left pl-6 font-semibold text-slate-700 cursor-pointer hover:text-blue-700"
                                onClick={() => {
                                  setSelectedSubgroup('PI_INPROGRESS');
                                  setSelectedFallout('ALL');
                                  setSelectedSto((prev) => (prev === sto.name ? 'ALL' : sto.name));
                                }}
                              >
                                {sto.name}
                              </td>
                              {pivotStatus.columns.map((st) => (
                                <td
                                  key={st}
                                  className="p-1 border border-slate-200 text-slate-600 cursor-pointer hover:bg-blue-100 font-semibold"
                                  onClick={() => {
                                    setSelectedSubgroup('PI_INPROGRESS');
                                    setSelectedFallout('ALL');
                                    setSelectedSto(sto.name);
                                    setSelectedStatus(st);
                                  }}
                                  title={`Klik untuk filter STO ${sto.name} - Status ${st}`}
                                >
                                  {sto.colCounts[st] || ''}
                                </td>
                              ))}
                              <td
                                className="p-1 border border-slate-200 font-bold text-slate-800 bg-slate-50 cursor-pointer hover:bg-yellow-100"
                                onClick={() => {
                                  setSelectedSubgroup('PI_INPROGRESS');
                                  setSelectedFallout('ALL');
                                  setSelectedSto(sto.name);
                                  setSelectedStatus('ALL');
                                }}
                                title="Klik Grand Total STO"
                              >
                                {sto.total}
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}

                  <tr className="bg-[#0f172a] text-white font-black sticky bottom-0 z-10 shadow cursor-pointer">
                    <td
                      className="p-2 border border-slate-700 text-left pl-3 uppercase hover:text-yellow-300"
                      onClick={() => {
                        setSelectedSubgroup('PI_INPROGRESS');
                        setSelectedFallout('ALL');
                        setSelectedWok('ALL');
                        setSelectedSto('ALL');
                      }}
                      title="Klik untuk filter semua data WOK & STO (PI/Inprogress)"
                    >
                      Grand Total
                    </td>
                    {pivotStatus.columns.map((st) => (
                      <td
                        key={st}
                        className="p-2 border border-slate-700 hover:bg-slate-800"
                        onClick={() => {
                          setSelectedSubgroup('PI_INPROGRESS');
                          setSelectedFallout('ALL');
                          setSelectedStatus(st);
                        }}
                        title={`Klik untuk filter status ${st} (PI/Inprogress)`}
                      >
                        {pivotStatus.grandColTotals[st] || 0}
                      </td>
                    ))}
                    <td
                      className="p-2 border border-slate-700 text-yellow-300 font-black hover:bg-yellow-600 hover:text-slate-900"
                      onClick={() => {
                        setSelectedSubgroup('PI_INPROGRESS');
                        setSelectedFallout('ALL');
                        setSelectedWok('ALL');
                        setSelectedSto('ALL');
                        setSelectedStatus('ALL');
                      }}
                      title="Klik untuk filter total data PROVISION_ISSUED & INPROGRESS_PC"
                    >
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
          
          {/* PIVOT 3: FALLOUT */}
          <div className="xl:col-span-1 bg-white border border-slate-300 shadow-xs rounded overflow-hidden">
            <div className="bg-[#0f172a] text-white p-2 flex justify-between items-center text-xs font-black uppercase">
              <span>Row Labels &bull; Fallout Reason</span>
              <span className="text-[10px] text-yellow-300">[Status: FALLOUT]</span>
            </div>
            <div className="overflow-x-auto max-h-[340px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-[10.5px]">
                <thead className="bg-[#1e293b] text-white sticky top-0 z-10 shadow-xs select-none">
                  <tr>
                    <th
                      className="p-2 border border-slate-600 cursor-pointer hover:bg-slate-700"
                      onClick={() => handlePivotFalloutSort('reason')}
                    >
                      Row Labels {pivotFalloutSort.key === 'reason' ? (pivotFalloutSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th
                      className="p-2 border border-slate-600 text-right pr-4 cursor-pointer hover:bg-slate-700"
                      onClick={() => handlePivotFalloutSort('count')}
                    >
                      Count of order_id {pivotFalloutSort.key === 'count' ? (pivotFalloutSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortDurationColumns(Object.keys(pivotFallout.tree)).map((durKey, durIdx) => {
                    const dur = pivotFallout.tree[durKey];
                    
                    const sortedReasons = Object.entries(dur.reasons).sort((a, b) => {
                      if (pivotFalloutSort.key === 'reason') {
                        return pivotFalloutSort.direction === 'asc'
                          ? a[0].localeCompare(b[0])
                          : b[0].localeCompare(a[0]);
                      }
                      return pivotFalloutSort.direction === 'asc'
                        ? a[1] - b[1]
                        : b[1] - a[1];
                    });

                    return (
                      <React.Fragment key={dur.name}>
                        <tr
                          className={`font-black text-slate-900 border-b border-slate-300 cursor-pointer ${
                            durIdx > 0 ? 'border-t-2 border-t-slate-400' : ''
                          } ${
                            dur.name === '3 HARI' ? 'bg-emerald-100 hover:bg-emerald-200' :
                            dur.name === '7 HARI' ? 'bg-orange-100 hover:bg-orange-200' :
                            dur.name === '30 HARI' ? 'bg-blue-100 hover:bg-blue-200' : 'bg-purple-100 hover:bg-purple-200'
                          }`}
                          onClick={() => {
                            setSelectedStatus('FALLOUT');
                            setSelectedSubgroup('ALL');
                            setSelectedDuration((prev) => (prev === dur.name ? 'ALL' : dur.name));
                            setSelectedFallout('ALL');
                          }}
                          title="Klik untuk filter semua fallout durasi ini"
                        >
                          <td className="p-1.5 border border-slate-300 pl-2">
                            &oplus; {dur.name}
                          </td>
                          <td className="p-1.5 border border-slate-300 text-right pr-4 font-black">
                            {dur.total}
                          </td>
                        </tr>

                        {sortedReasons.map(([reason, cnt]) => (
                          <tr
                            key={reason}
                            className="border-b border-slate-200 hover:bg-red-50/70 cursor-pointer transition bg-white"
                            onClick={() => {
                              setSelectedStatus('FALLOUT');
                              setSelectedSubgroup('ALL');
                              setSelectedDuration(dur.name);
                              setSelectedFallout((prev) => (prev === reason ? 'ALL' : reason));
                            }}
                            title={`Klik untuk filter fallout ${reason} (${dur.name})`}
                          >
                            <td className="p-1 border border-slate-200 pl-6 font-semibold text-slate-700">
                              {reason}
                            </td>
                            <td className="p-1 border border-slate-200 text-right pr-4 text-slate-800 font-bold">
                              {cnt}
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}

                  <tr className="bg-[#0f172a] text-white font-black sticky bottom-0 z-10 shadow cursor-pointer">
                    <td
                      className="p-2 border border-slate-700 uppercase hover:text-yellow-300"
                      onClick={() => {
                        setSelectedStatus('FALLOUT');
                        setSelectedSubgroup('ALL');
                        setSelectedDuration('ALL');
                        setSelectedFallout('ALL');
                      }}
                      title="Klik untuk filter semua data status FALLOUT"
                    >
                      Grand Total
                    </td>
                    <td
                      className="p-2 border border-slate-700 text-right pr-4 text-yellow-300 font-black hover:bg-yellow-600 hover:text-slate-900"
                      onClick={() => {
                        setSelectedStatus('FALLOUT');
                        setSelectedSubgroup('ALL');
                        setSelectedDuration('ALL');
                        setSelectedFallout('ALL');
                      }}
                      title="Klik untuk filter semua data status FALLOUT"
                    >
                      {pivotFallout.totalAll}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* DIAGRAM BATANG DURATION FALLOUT */}
          <div className="xl:col-span-2 bg-white border border-slate-300 shadow-xs rounded p-3">
            <div className="flex items-center justify-between border-b pb-1.5 mb-2">
              <h4 className="font-extrabold text-slate-800 text-xs sm:text-sm tracking-wide uppercase">
                DURATION FALLOUT
              </h4>
              <span className="text-[10px] text-red-600 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-200">
                Filter: process_state = FALLOUT
              </span>
            </div>

            <div className="h-72 w-full">
              {chartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 font-bold text-xs">
                  Tidak ada data Fallout pada filter yang dipilih.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 10, left: -20, bottom: 55 }}
                    onClick={(e) => {
                      if (e && e.activePayload && e.activePayload.length) {
                        const payload = e.activePayload[0].payload;
                        setSelectedStatus('FALLOUT');
                        setSelectedSubgroup('ALL');
                        setSelectedDuration(payload.duration);
                        setSelectedFallout((prev) => (prev === payload.reason ? 'ALL' : payload.reason));
                      }
                    }}
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
                              <p className="text-[11px] font-bold text-slate-600">Kategori Durasi: {d.duration}</p>
                              <p className="text-xs font-black text-blue-700 mt-1">Total: {d.count} Order</p>
                              <p className="text-[9px] text-slate-400 mt-0.5">(Klik batang untuk filter)</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />

                    {dividerIndices.map((xVal, dIdx) => (
                      <ReferenceLine
                        key={`div-${dIdx}`}
                        x={xVal}
                        stroke="#94a3b8"
                        strokeDasharray="4 4"
                        strokeWidth={1.5}
                      />
                    ))}

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

            <div className="flex flex-wrap items-center justify-center gap-4 text-[10px] font-bold text-slate-600 mt-2 border-t pt-1.5">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-[#22c55e] rounded-xs inline-block"></span> 3 HARI
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-[#f97316] rounded-xs inline-block"></span> 7 HARI
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-[#3b82f6] rounded-xs inline-block"></span> 30 HARI
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-[#a855f7] rounded-xs inline-block"></span> 3 BULAN
              </span>
            </div>
          </div>
        </div>

        {/* BOTTOM RAW DATA TABLE */}
        <div className="bg-white border border-slate-300 shadow-xs rounded overflow-hidden mt-4">
          <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#334155] text-white p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-sm font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                <span>📦</span> DATA DETAIL ORDER FULFILLMENT
              </h2>
              <p className="text-[10px] text-slate-300 mt-0.5">
                Menampilkan <strong>{sortedBottomTableData.length.toLocaleString()}</strong> dari{' '}
                <strong>{orders.length.toLocaleString()}</strong> total order &bull; <em>Klik header kolom untuk sort, klik isi sel untuk filter</em>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Cari Order ID, Nama, ODP, STO, Fallout..."
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
              <thead className="bg-[#3b0764] text-white uppercase font-bold sticky top-0 z-10 shadow cursor-pointer select-none">
                <tr>
                  <th className="p-2 border border-purple-800 text-center">No</th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('order_id')}>
                    Order ID {sortConfig.key === 'order_id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('process_state')}>
                    Process State {sortConfig.key === 'process_state' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('funneling_subgroup')}>
                    Subgroup {sortConfig.key === 'funneling_subgroup' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('name')}>
                    Nama Pelanggan {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('no_handphone')}>
                    No HP {sortConfig.key === 'no_handphone' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('sto_co')}>
                    STO {sortConfig.key === 'sto_co' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('wok')}>
                    WOK {sortConfig.key === 'wok' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('odp_name')}>
                    ODP Name {sortConfig.key === 'odp_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('product_commercial_name')}>
                    Product Name {sortConfig.key === 'product_commercial_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('order_duration_cat')}>
                    Duration Cat {sortConfig.key === 'order_duration_cat' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('fallout_reason_clean')}>
                    Fallout Reason {sortConfig.key === 'fallout_reason_clean' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('price_package')}>
                    Price {sortConfig.key === 'price_package' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('order_ts')}>
                    Order Date {sortConfig.key === 'order_ts' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('ps_ts')}>
                    PS Date {sortConfig.key === 'ps_ts' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestSort('sf_name')}>
                    SF Name {sortConfig.key === 'sf_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-2 border border-purple-800">Alamat</th>
                  <th className="p-2 border border-purple-800">Latitude</th>
                  <th className="p-2 border border-purple-800">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={19} className="p-4 text-center text-slate-400 font-bold">
                      Tidak ada data Order yang cocok dengan filter atau pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, idx) => {
                    const rowNumber = (currentPage - 1) * rowsPerPage + idx + 1;
                    const pState = (row.process_state || 'UNKNOWN').trim().toUpperCase();

                    return (
                      <tr
                        key={`${row.order_id}-${idx}`}
                        className="border-b border-slate-200 hover:bg-purple-50/60 transition"
                      >
                        <td className="p-1.5 border border-slate-200 text-center font-bold text-slate-500">{rowNumber}</td>
                        <td className="p-1.5 border border-slate-200 font-black text-purple-900">{row.order_id}</td>
                        <td
                          className="p-1.5 border border-slate-200 font-bold text-slate-800 cursor-pointer hover:text-blue-700 hover:underline"
                          onClick={() => setSelectedStatus((p) => (p === pState ? 'ALL' : pState))}
                          title="Klik untuk filter Process State ini"
                        >
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                              pState === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                              pState === 'FALLOUT' ? 'bg-red-100 text-red-800' :
                              pState.includes('CANCEL') ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {pState}
                          </span>
                        </td>
                        <td
                          className="p-1.5 border border-slate-200 font-bold text-slate-700 cursor-pointer hover:text-blue-700 hover:underline"
                          onClick={() => setSelectedSubgroup((p) => (p === row.funneling_subgroup ? 'ALL' : row.funneling_subgroup))}
                          title="Klik untuk filter Subgroup ini"
                        >
                          {row.funneling_subgroup || '-'}
                        </td>
                        <td className="p-1.5 border border-slate-200 font-semibold">{row.name || '-'}</td>
                        <td className="p-1.5 border border-slate-200 font-mono text-[9px]">{row.no_handphone || row.no_handphone_mask || '-'}</td>
                        <td
                          className="p-1.5 border border-slate-200 font-bold text-slate-800 cursor-pointer hover:text-blue-700 hover:underline"
                          onClick={() => setSelectedSto((p) => (p === row.sto_co ? 'ALL' : row.sto_co))}
                          title="Klik untuk filter STO ini"
                        >
                          {row.sto_co || '-'}
                        </td>
                        <td
                          className="p-1.5 border border-slate-200 cursor-pointer hover:text-blue-700 hover:underline"
                          onClick={() => setSelectedWok((p) => (p === row.wok ? 'ALL' : row.wok))}
                          title="Klik untuk filter WOK ini"
                        >
                          {row.wok || '-'}
                        </td>
                        <td className="p-1.5 border border-slate-200 font-bold text-blue-800">{row.odp_name || '-'}</td>
                        <td className="p-1.5 border border-slate-200">{row.product_commercial_name || '-'}</td>
                        <td
                          className="p-1.5 border border-slate-200 font-bold text-emerald-800 cursor-pointer hover:text-blue-700 hover:underline"
                          onClick={() => setSelectedDuration((p) => (p === row.order_duration_cat ? 'ALL' : row.order_duration_cat))}
                          title="Klik untuk filter durasi ini"
                        >
                          {row.order_duration_cat || '-'}
                        </td>
                        <td
                          className="p-1.5 border border-slate-200 text-red-600 font-bold cursor-pointer hover:underline"
                          onClick={() => {
                            setSelectedStatus('FALLOUT');
                            setSelectedSubgroup('ALL');
                            row.fallout_reason_clean && setSelectedFallout((p) => (p === row.fallout_reason_clean ? 'ALL' : row.fallout_reason_clean));
                          }}
                          title="Klik untuk filter fallout ini"
                        >
                          {row.fallout_reason_clean ? (
                            <span className="bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                              {row.fallout_reason_clean}
                            </span>
                          ) : '-'}
                        </td>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-slate-50 p-2.5 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs font-semibold">
              <span className="text-slate-600">
                Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> (Total <strong>{sortedBottomTableData.length.toLocaleString()}</strong> data)
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
