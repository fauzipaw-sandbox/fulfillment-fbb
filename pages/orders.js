import React, { useState, useMemo, useRef, useEffect } from 'react';
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

const DURATION_ORDER = ['> 0 HARI', '> 3 HARI', '> 7 HARI', '> 1 BULAN', '> 3 BULAN'];

function sortDurationColumns(cols = []) {
  return [...cols].sort((a, b) => {
    const idxA = DURATION_ORDER.indexOf(a);
    const idxB = DURATION_ORDER.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return String(a || '').localeCompare(String(b || ''));
  });
}

// Warna Kontras Tinggi & Modern
const DURATION_COLORS = {
  '> 0 HARI': '#06b6d4', // Cyan
  '> 3 HARI': '#10b981', // Emerald Green
  '> 7 HARI': '#f59e0b', // Amber
  '> 1 BULAN': '#3b82f6', // Royal Blue
  '> 3 BULAN': '#8b5cf6', // Violet Purple
  DEFAULT: '#64748b',
};

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatFullDateTime(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year} ${hours}:${mins}`;
}

function extractPureDateString(val) {
  if (!val) return null;
  const str = String(val).trim();

  const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(parseInt(ymdMatch[2], 10)).padStart(2, '0');
    const d = String(parseInt(ymdMatch[3], 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const d = String(parseInt(dmyMatch[1], 10)).padStart(2, '0');
    const m = String(parseInt(dmyMatch[2], 10)).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  if (val instanceof Date && !isNaN(val.getTime())) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return str.length >= 10 ? str.slice(0, 10) : str;
}

function safeFormatDisplayDate(val) {
  if (!val) return '-';
  const pure = extractPureDateString(val);
  if (!pure || pure.length < 10) return String(val);
  const parts = pure.split('-');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return String(val);
}

function safeFormatNumber(val) {
  if (val === null || val === undefined || val === '') return '-';
  const num = Number(val);
  return isNaN(num) ? String(val) : num.toLocaleString();
}

function safeFormatCoord(val) {
  if (val === null || val === undefined || val === '') return '-';
  const num = Number(val);
  return isNaN(num) ? String(val) : num.toFixed(5);
}

// Helper: Ambil Fallout Reason yang sudah disederhanakan dari Symptom
function getSimplifiedFalloutReason(order) {
  if (!order) return 'LAINNYA';
  
  const symptomVal = (order.symptom || '').trim();
  if (symptomVal && symptomVal !== '-' && symptomVal !== 'null' && symptomVal !== 'undefined') {
    return symptomVal;
  }

  const cleanVal = (order.fallout_reason_clean || '').trim();
  if (cleanVal && cleanVal !== '-' && cleanVal !== 'null' && cleanVal !== 'undefined') {
    return cleanVal;
  }

  const catVal = (order.fallout_category || '').trim();
  if (
    catVal &&
    catVal !== '-' &&
    !catVal.includes('KENDALA SISTEM') &&
    !catVal.includes('KENDALA TEKNIK') &&
    !catVal.includes('KENDALA PELANGGAN') &&
    catVal !== 'OTHERS'
  ) {
    return catVal;
  }

  return 'LAINNYA';
}

function getExactDurationCategory(order) {
  if (!order) return '> 0 HARI';
  const dateStr = extractPureDateString(order.provi || order.order_ts || order.order_date);

  if (dateStr && dateStr.length >= 10) {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const proviY = parseInt(parts[0], 10);
      const proviM = parseInt(parts[1], 10) - 1;
      const proviD = parseInt(parts[2], 10);

      const proviDate = new Date(proviY, proviM, proviD);
      const now = new Date();
      const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      if (!isNaN(proviDate.getTime())) {
        const diffTime = todayDate.getTime() - proviDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays <= 3) return '> 0 HARI';
        if (diffDays <= 7) return '> 3 HARI';
        if (diffDays <= 30) return '> 7 HARI';
        if (diffDays <= 90) return '> 1 BULAN';
        return '> 3 BULAN';
      }
    }
  }

  const raw = String(order.order_duration_cat || order.aging_fallout || '').toUpperCase().trim();
  if (raw.includes('1 HARI') || raw.includes('2-3') || raw.includes('0 HARI')) return '> 0 HARI';
  if (raw.includes('4-7') || raw.includes('3 HARI')) return '> 3 HARI';
  if (raw.includes('7 HARI')) return '> 7 HARI';
  if (raw.includes('1 BULAN') || raw.includes('30 HARI')) return '> 1 BULAN';
  return '> 3 BULAN';
}

function MultiSelectDropdown({ options = [], selected = [], onChange, badgeColor = 'bg-slate-800 text-emerald-300' }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (val) => {
    if (selected.includes(val)) {
      onChange(selected.filter((item) => item !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const selectAll = () => {
    onChange(options.map((o) => (typeof o === 'string' ? o : o.value)));
  };

  const clearAll = () => {
    onChange([]);
  };

  const displayText = useMemo(() => {
    if (selected.length === 0) return '0 Dipilih';
    if (selected.length === options.length) return 'Semua';
    if (selected.length <= 2) return selected.join(', ');
    return `${selected.length} Item`;
  }, [selected, options]);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`${badgeColor} border border-slate-600 rounded px-1.5 py-0.5 text-[8.5px] font-bold flex items-center gap-1 shadow-xs hover:opacity-90 transition cursor-pointer`}
      >
        <span className="truncate max-w-[120px]">{displayText}</span>
        <span className="text-[7px] text-slate-400">▼</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-56 max-h-64 overflow-y-auto bg-slate-900 text-white rounded-lg shadow-2xl border border-slate-700 p-2 z-[2000] text-[10px] space-y-1.5 animate-fadeIn">
          <div className="flex items-center justify-between pb-1 border-b border-slate-700 text-[9px] font-bold">
            <button
              type="button"
              onClick={selectAll}
              className="text-blue-400 hover:underline cursor-pointer"
            >
              Pilih Semua
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-red-400 hover:underline cursor-pointer"
            >
              Kosongkan
            </button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {options.map((opt) => {
              const val = typeof opt === 'string' ? opt : opt.value;
              const count = typeof opt === 'object' ? opt.count : null;
              const isChecked = selected.includes(val);
              return (
                <label
                  key={val}
                  className="flex items-center justify-between gap-2 p-1 rounded hover:bg-slate-800 cursor-pointer transition select-none"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(val)}
                      className="rounded accent-blue-500 cursor-pointer"
                    />
                    <span className="font-semibold truncate">{val}</span>
                  </div>
                  {count !== null && (
                    <span className="text-[8.5px] text-slate-400 font-mono">({count})</span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrdersPage() {
  const dataContext = useData() || {};
  const rawOrders = dataContext.ordersData || [];
  const ordersLoaded = dataContext.ordersLoaded || false;
  const reloadOrders = dataContext.reloadOrders || (() => {});
  const reloadAll = dataContext.reloadAll || (() => {});

  const [showUploader, setShowUploader] = useState(false);

  // Normalisasi Data Orders Secara Real-time
  const orders = useMemo(() => {
    return (rawOrders || []).map((o) => {
      if (!o) return {};
      const pureProvi = extractPureDateString(o.provi || o.order_ts || o.order_date);
      const calculatedDur = getExactDurationCategory(o);
      return {
        ...o,
        order_ts: pureProvi,
        order_duration_cat: calculatedDur,
      };
    });
  }, [rawOrders]);

  // Global Filter Bar States
  const [selectedMonth, setSelectedMonth] = useState('ALL');
  const [selectedWok, setSelectedWok] = useState('ALL');
  const [selectedSto, setSelectedSto] = useState('ALL');
  const [selectedDuration, setSelectedDuration] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedFallout, setSelectedFallout] = useState('ALL');
  const [activeSubgroupScope, setActiveSubgroupScope] = useState('ALL');

  const [selectedPivotSubgroups, setSelectedPivotSubgroups] = useState([
    'PROVISION_ISSUED',
    'INPROGRESS_PC'
  ]);
  const [selectedFalloutStates, setSelectedFalloutStates] = useState(['FALLOUT']);

  const [pivot1Sort, setPivot1Sort] = useState({ key: 'total', direction: 'desc' });
  const [pivot2Sort, setPivot2Sort] = useState({ key: 'total', direction: 'desc' });
  const [pivotFalloutSort, setPivotFalloutSort] = useState({ key: 'count', direction: 'desc' });

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'order_ts', direction: 'desc' });
  const rowsPerPage = 50;

  const availableSubgroupOptions = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const sub = (o.funneling_subgroup || '').trim().toUpperCase();
      if (sub) map[sub] = (map[sub] || 0) + 1;
    });
    return Object.keys(map)
      .sort()
      .map((k) => ({ value: k, count: map[k] }));
  }, [orders]);

  const availableProcessStateOptions = useMemo(() => {
    const map = {};
    orders.forEach((o) => {
      const ps = (o.process_state || '').trim().toUpperCase();
      if (ps) map[ps] = (map[ps] || 0) + 1;
    });
    return Object.keys(map)
      .sort()
      .map((k) => ({ value: k, count: map[k] }));
  }, [orders]);

  const availableMonths = useMemo(() => {
    const set = new Set();
    orders.forEach((o) => {
      const dateVal = o.order_ts;
      if (dateVal && dateVal.length >= 7) {
        const parts = dateVal.split('-');
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
          const key = `${y}-${String(m).padStart(2, '0')}`;
          const label = `${MONTH_NAMES[m - 1]} ${y}`;
          set.add(JSON.stringify({ key, label }));
        }
      }
    });
    return Array.from(set)
      .map((str) => JSON.parse(str))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [orders]);

  const headerCutoffText = useMemo(() => {
    if (!orders || orders.length === 0) return '*Cut Off Data -';
    const dates = orders
      .map((o) => {
        const dateVal = o.order_ts;
        if (dateVal && dateVal.length >= 10) {
          const parts = dateVal.split('-');
          return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
        }
        return null;
      })
      .filter((t) => t && !isNaN(t));

    if (dates.length === 0) return '*Cut Off Data';
    const earliest = new Date(Math.min(...dates));
    const latest = new Date(Math.max(...dates));

    return `*Cut Off Data (${safeFormatDisplayDate(earliest)} s/d ${safeFormatDisplayDate(latest)})`;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!o) return false;

      let matchMonth = true;
      if (selectedMonth !== 'ALL') {
        const dateVal = o.order_ts;
        if (!dateVal || dateVal.length < 7) {
          matchMonth = false;
        } else {
          const mKey = dateVal.slice(0, 7);
          matchMonth = mKey === selectedMonth;
        }
      }

      const matchWok = selectedWok === 'ALL' || o.wok === selectedWok;
      const matchSto = selectedSto === 'ALL' || o.sto_co === selectedSto;
      const saklekDur = o.order_duration_cat;
      const matchDur = selectedDuration === 'ALL' || saklekDur === selectedDuration;
      
      const processState = (o.process_state || 'UNKNOWN').trim().toUpperCase();
      const matchStat = selectedStatus === 'ALL' || processState === selectedStatus;

      const subGroup = (o.funneling_subgroup || '').trim().toUpperCase();
      let matchSubgroup = true;
      if (Array.isArray(activeSubgroupScope)) {
        matchSubgroup = activeSubgroupScope.includes(subGroup);
      } else if (activeSubgroupScope !== 'ALL') {
        matchSubgroup = subGroup === activeSubgroupScope;
      }
      
      const rVal = getSimplifiedFalloutReason(o);
      const matchFallout = selectedFallout === 'ALL' || rVal === selectedFallout;
      return matchMonth && matchWok && matchSto && matchDur && matchStat && matchSubgroup && matchFallout;
    });
  }, [orders, selectedMonth, selectedWok, selectedSto, selectedDuration, selectedStatus, activeSubgroupScope, selectedFallout]);

  const pivotBaseOrders = useMemo(() => {
    return orders.filter((o) => {
      if (!o) return false;

      let matchMonth = true;
      if (selectedMonth !== 'ALL') {
        const dateVal = o.order_ts;
        if (dateVal && dateVal.length >= 7) {
          const mKey = dateVal.slice(0, 7);
          matchMonth = mKey === selectedMonth;
        }
      }

      const matchWok = selectedWok === 'ALL' || o.wok === selectedWok;
      const matchSto = selectedSto === 'ALL' || o.sto_co === selectedSto;
      const sub = (o.funneling_subgroup || '').trim().toUpperCase();

      const matchSub =
        selectedPivotSubgroups.length === 0 || selectedPivotSubgroups.includes(sub);

      return matchMonth && matchWok && matchSto && matchSub;
    });
  }, [orders, selectedMonth, selectedWok, selectedSto, selectedPivotSubgroups]);

  // Pivot 1: WOK & STO vs Duration
  const pivotDuration = useMemo(() => {
    const columns = [...DURATION_ORDER];
    const map = {};

    pivotBaseOrders.forEach((o) => {
      const wok = o.wok || 'PALANGKARAYA';
      const sto = o.sto_co || 'UNKNOWN';
      const dur = o.order_duration_cat;

      if (!map[wok]) map[wok] = { name: wok, total: 0, stos: {}, colCounts: {} };
      if (!map[wok].stos[sto]) map[wok].stos[sto] = { name: sto, total: 0, colCounts: {} };

      map[wok].total++;
      map[wok].colCounts[dur] = (map[wok].colCounts[dur] || 0) + 1;

      map[wok].stos[sto].total++;
      map[wok].stos[sto].colCounts[dur] = (map[wok].stos[sto].colCounts[dur] || 0) + 1;
    });

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

  // Pivot 2: WOK & STO vs Process State
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

  // Pivot 3: Duration vs Fallout
  const pivotFallout = useMemo(() => {
    const tree = {};
    DURATION_ORDER.forEach((k) => {
      tree[k] = { name: k, total: 0, reasons: {} };
    });
    let totalAll = 0;

    const baseOrders = orders.filter((o) => {
      if (!o) return false;
      let matchMonth = true;
      if (selectedMonth !== 'ALL') {
        const dateVal = o.order_ts;
        if (dateVal && dateVal.length >= 7) {
          const mKey = dateVal.slice(0, 7);
          matchMonth = mKey === selectedMonth;
        }
      }
      const matchWok = selectedWok === 'ALL' || o.wok === selectedWok;
      const matchSto = selectedSto === 'ALL' || o.sto_co === selectedSto;
      const pState = (o.process_state || '').trim().toUpperCase();
      const matchState =
        selectedFalloutStates.length === 0 || selectedFalloutStates.includes(pState);

      return matchMonth && matchWok && matchSto && matchState;
    });

    baseOrders.forEach((o) => {
      const dur = o.order_duration_cat;
      const r = getSimplifiedFalloutReason(o);

      if (!tree[dur]) tree[dur] = { name: dur, total: 0, reasons: {} };
      tree[dur].total++;
      tree[dur].reasons[r] = (tree[dur].reasons[r] || 0) + 1;
      totalAll++;
    });

    return { tree, totalAll };
  }, [orders, selectedMonth, selectedWok, selectedSto, selectedFalloutStates]);

  const { chartData, dividerIndices } = useMemo(() => {
    const list = [];
    const dividers = [];
    
    const durKeys = selectedDuration !== 'ALL' 
      ? [selectedDuration].filter((k) => pivotFallout.tree[k]) 
      : DURATION_ORDER.filter((k) => pivotFallout.tree[k] && pivotFallout.tree[k].total > 0);
    
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
    if (sortConfig.key === key && sortConfig.direction === 'desc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedBottomTableData = useMemo(() => {
    let filtered = filteredOrders;
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          (o.order_id && String(o.order_id).toLowerCase().includes(s)) ||
          (o.name && String(o.name).toLowerCase().includes(s)) ||
          (o.odp_name && String(o.odp_name).toLowerCase().includes(s)) ||
          (o.sto_co && String(o.sto_co).toLowerCase().includes(s)) ||
          (o.process_state && String(o.process_state).toLowerCase().includes(s)) ||
          (o.funneling_subgroup && String(o.funneling_subgroup).toLowerCase().includes(s)) ||
          (o.symptom && String(o.symptom).toLowerCase().includes(s)) ||
          (o.fallout_category && String(o.fallout_category).toLowerCase().includes(s)) ||
          (o.fallout_reason && String(o.fallout_reason).toLowerCase().includes(s)) ||
          (o.fallout_reason_clean && String(o.fallout_reason_clean).toLowerCase().includes(s))
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

  const handleExportFilteredCSV = () => {
    if (filteredOrders.length === 0) return alert('Tidak ada data terfilter untuk di-download.');
    const csv = Papa.unparse(filteredOrders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orders_filtered_${filteredOrders.length}_rows_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAllCSV = () => {
    if (orders.length === 0) return alert('Database order kosong.');
    const csv = Papa.unparse(orders);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orders_all_${orders.length}_rows_${new Date().toISOString().slice(0, 10)}.csv`);
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
    setSelectedFallout('ALL');
    setActiveSubgroupScope('ALL');
    setSelectedPivotSubgroups(['PROVISION_ISSUED', 'INPROGRESS_PC']);
    setSelectedFalloutStates(['FALLOUT']);
  };

  const isAnyFilterActive =
    selectedMonth !== 'ALL' ||
    selectedWok !== 'ALL' ||
    selectedSto !== 'ALL' ||
    selectedDuration !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    selectedFallout !== 'ALL' ||
    activeSubgroupScope !== 'ALL';

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

      <div className="max-w-[1550px] mx-auto space-y-2.5">
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-[#211c47] to-[#4c1d95] text-white p-2.5 sm:p-3 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center shadow gap-2">
          <div>
            <h1 className="text-base sm:text-xl font-black uppercase italic tracking-wide">
              TREND ORDER & FALLOUT FULFILLMENT
            </h1>
            <p className="text-[9.5px] sm:text-xs font-semibold text-yellow-300 mt-0.5">
              {headerCutoffText}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUploader(!showUploader)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded shadow transition cursor-pointer"
            >
              {showUploader ? 'Tutup Upload' : 'Upload Data'}
            </button>
          </div>
        </div>

        {/* Global Filter Bar */}
        <div className="bg-white p-2 rounded shadow-xs border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-600 text-[11px]">Filter:</span>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[10.5px]"
            >
              <option value="ALL">Semua Bulan</option>
              {availableMonths.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>

            <select
              value={selectedWok}
              onChange={(e) => setSelectedWok(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[10.5px]"
            >
              <option value="ALL">Semua WOK</option>
              <option value="BARITO - KAPUAS">BARITO - KAPUAS</option>
              <option value="PALANGKARAYA">PALANGKARAYA</option>
            </select>

            <select
              value={selectedSto}
              onChange={(e) => setSelectedSto(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[10.5px]"
            >
              <option value="ALL">Semua STO</option>
              {ALLOWED_STOS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={selectedDuration}
              onChange={(e) => setSelectedDuration(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[10.5px]"
            >
              <option value="ALL">Semua Durasi</option>
              {DURATION_ORDER.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="p-1 border rounded font-semibold text-slate-700 bg-slate-50 text-[10.5px]"
            >
              <option value="ALL">Semua Status (Process State)</option>
              {availableProcessStateOptions.map((st) => (
                <option key={st.value} value={st.value}>{st.value}</option>
              ))}
            </select>
          </div>

          {isAnyFilterActive && (
            <button
              type="button"
              onClick={resetFilters}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded font-bold text-[10px] shadow cursor-pointer"
            >
              ✕ Reset Filter
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

        {/* 4 Komponen Atas Presisi Screenshot 2x2 Grid */}
        <div id="broadcast-report-container" className="space-y-3 bg-slate-100/60 p-2 rounded-lg border border-slate-200">
          
          {/* BARIS 1: DURATION SLA & PROCESS STATE */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
            
            {/* 1.1. Duration SLA Table */}
            <div className="bg-white border-2 border-slate-400 shadow-sm rounded overflow-hidden">
              <div className="bg-[#0f172a] text-white p-1.5 px-2.5 flex justify-between items-center text-[11px] font-black uppercase flex-wrap gap-1 border-b-2 border-slate-800">
                <span className="tracking-wide flex items-center gap-1">
                  <span>⏱️</span> Count of order_id &bull; Duration SLA
                </span>
                
                <div className="flex items-center gap-1">
                  <span className="text-[8.5px] text-slate-300 font-bold">Subgroup:</span>
                  <MultiSelectDropdown
                    options={availableSubgroupOptions}
                    selected={selectedPivotSubgroups}
                    onChange={setSelectedPivotSubgroups}
                    badgeColor="bg-slate-800 text-emerald-300"
                  />
                </div>
              </div>

              <div className="w-full">
                <table className="w-full table-auto text-center border-collapse text-[9.5px]">
                  <thead className="bg-[#1e293b] text-white select-none">
                    <tr>
                      <th
                        className="p-1 border border-slate-600 text-left pl-2.5 cursor-pointer hover:bg-slate-700 font-extrabold w-[130px]"
                        onClick={() => handlePivot1Sort('name')}
                      >
                        Row Labels {pivot1Sort.key === 'name' ? (pivot1Sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      {pivotDuration.columns.map((c) => (
                        <th
                          key={c}
                          className={`p-1 border border-slate-600 cursor-pointer hover:opacity-80 font-black text-[8.5px] ${
                            c === '> 0 HARI' ? 'bg-[#06b6d4] text-slate-950' :
                            c === '> 3 HARI' ? 'bg-[#10b981] text-slate-950' :
                            c === '> 7 HARI' ? 'bg-[#f59e0b] text-slate-950' :
                            c === '> 1 BULAN' ? 'bg-[#3b82f6] text-white' :
                            c === '> 3 BULAN' ? 'bg-[#8b5cf6] text-white' : 'bg-slate-700'
                          }`}
                          onClick={() => {
                            setActiveSubgroupScope(selectedPivotSubgroups);
                            setSelectedStatus('ALL');
                            setSelectedFallout('ALL');
                            setSelectedDuration(c);
                          }}
                        >
                          {c} {pivot1Sort.key === c ? (pivot1Sort.direction === 'asc' ? '↑' : '↓') : ''}
                        </th>
                      ))}
                      <th
                        className="p-1 border border-slate-600 bg-[#0f172a] text-yellow-300 font-black cursor-pointer hover:bg-slate-800 w-[70px]"
                        onClick={() => handlePivot1Sort('total')}
                      >
                        Grand Total {pivot1Sort.key === 'total' ? (pivot1Sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotDuration.sortedWoks.length === 0 ? (
                      <tr>
                        <td colSpan={pivotDuration.columns.length + 2} className="p-3 text-slate-400 font-bold text-center">
                          Tidak ada data.
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
                                className="p-0.5 border border-slate-300 text-left pl-2 cursor-pointer hover:text-blue-700"
                                onClick={() => {
                                  setActiveSubgroupScope(selectedPivotSubgroups);
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
                                  className="p-0.5 border border-slate-300 cursor-pointer hover:bg-emerald-100 font-semibold"
                                  onClick={() => {
                                    setActiveSubgroupScope(selectedPivotSubgroups);
                                    setSelectedStatus('ALL');
                                    setSelectedFallout('ALL');
                                    setSelectedWok(wok.name);
                                    setSelectedDuration(c);
                                  }}
                                >
                                  {wok.colCounts[c] || ''}
                                </td>
                              ))}
                              <td
                                className="p-0.5 border border-slate-300 font-extrabold bg-slate-200 cursor-pointer hover:bg-yellow-100"
                                onClick={() => {
                                  setActiveSubgroupScope(selectedPivotSubgroups);
                                  setSelectedStatus('ALL');
                                  setSelectedFallout('ALL');
                                  setSelectedWok(wok.name);
                                  setSelectedDuration('ALL');
                                }}
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
                                  className="p-0.5 border border-slate-200 text-left pl-5 font-semibold text-slate-700 cursor-pointer hover:text-blue-700"
                                  onClick={() => {
                                    setActiveSubgroupScope(selectedPivotSubgroups);
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
                                    className="p-0.5 border border-slate-200 text-slate-600 cursor-pointer hover:bg-blue-100 font-semibold"
                                    onClick={() => {
                                      setActiveSubgroupScope(selectedPivotSubgroups);
                                      setSelectedStatus('ALL');
                                      setSelectedFallout('ALL');
                                      setSelectedSto(sto.name);
                                      setSelectedDuration(c);
                                    }}
                                  >
                                    {sto.colCounts[c] || ''}
                                  </td>
                                ))}
                                <td
                                  className="p-0.5 border border-slate-200 font-bold text-slate-800 bg-slate-50 cursor-pointer hover:bg-yellow-100"
                                  onClick={() => {
                                    setActiveSubgroupScope(selectedPivotSubgroups);
                                    setSelectedStatus('ALL');
                                    setSelectedFallout('ALL');
                                    setSelectedSto(sto.name);
                                    setSelectedDuration('ALL');
                                  }}
                                >
                                  {sto.total}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })
                    )}

                    <tr className="bg-[#0f172a] text-white font-black border-t-2 border-slate-700 cursor-pointer">
                      <td
                        className="p-1 border border-slate-700 text-left pl-2.5 uppercase hover:text-yellow-300"
                        onClick={() => {
                          setActiveSubgroupScope(selectedPivotSubgroups);
                          setSelectedStatus('ALL');
                          setSelectedFallout('ALL');
                          setSelectedWok('ALL');
                          setSelectedSto('ALL');
                        }}
                      >
                        Grand Total
                      </td>
                      {pivotDuration.columns.map((c) => (
                        <td
                          key={c}
                          className="p-1 border border-slate-700 hover:bg-slate-800"
                          onClick={() => {
                            setActiveSubgroupScope(selectedPivotSubgroups);
                            setSelectedStatus('ALL');
                            setSelectedFallout('ALL');
                            setSelectedDuration(c);
                          }}
                        >
                          {pivotDuration.grandColTotals[c] || 0}
                        </td>
                      ))}
                      <td
                        className="p-1 border border-slate-700 text-yellow-300 font-black hover:bg-yellow-600 hover:text-slate-900"
                        onClick={() => {
                          setActiveSubgroupScope(selectedPivotSubgroups);
                          setSelectedStatus('ALL');
                          setSelectedFallout('ALL');
                          setSelectedWok('ALL');
                          setSelectedSto('ALL');
                          setSelectedDuration('ALL');
                        }}
                      >
                        {pivotDuration.totalAll}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 1.2. Process State Table */}
            <div className="bg-white border-2 border-slate-400 shadow-sm rounded overflow-hidden">
              <div className="bg-[#0f172a] text-white p-1.5 px-2.5 flex justify-between items-center text-[11px] font-black uppercase flex-wrap gap-1 border-b-2 border-slate-800">
                <span className="tracking-wide flex items-center gap-1">
                  <span>📊</span> Count of order_id &bull; Process State
                </span>
                <span className="text-[8.5px] text-blue-300 font-semibold bg-white/10 px-1.5 py-0.2 rounded">
                  Sinkron Subgroup
                </span>
              </div>

              <div className="w-full">
                <table className="w-full table-auto text-center border-collapse text-[9.5px]">
                  <thead className="bg-[#1e293b] text-white select-none">
                    <tr>
                      <th
                        className="p-1 border border-slate-600 text-left pl-2.5 cursor-pointer hover:bg-slate-700 font-extrabold w-[130px]"
                        onClick={() => handlePivot2Sort('name')}
                      >
                        Row Labels {pivot2Sort.key === 'name' ? (pivot2Sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                      {pivotStatus.columns.map((st) => (
                        <th
                          key={st}
                          className="p-1 border border-slate-600 font-bold bg-[#e0f2fe] text-blue-950 cursor-pointer hover:opacity-80 leading-tight break-words text-[8.5px]"
                          onClick={() => {
                            setActiveSubgroupScope(selectedPivotSubgroups);
                            setSelectedFallout('ALL');
                            setSelectedStatus(st);
                          }}
                        >
                          {st} {pivot2Sort.key === st ? (pivot2Sort.direction === 'asc' ? '↑' : '↓') : ''}
                        </th>
                      ))}
                      <th
                        className="p-1 border border-slate-600 bg-[#0f172a] text-yellow-300 font-black cursor-pointer hover:bg-slate-800 w-[70px]"
                        onClick={() => handlePivot2Sort('total')}
                      >
                        Grand Total {pivot2Sort.key === 'total' ? (pivot2Sort.direction === 'asc' ? '↑' : '↓') : '↕'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotStatus.sortedWoks.length === 0 ? (
                      <tr>
                        <td colSpan={pivotStatus.columns.length + 2} className="p-3 text-slate-400 font-bold text-center">
                          Tidak ada data.
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
                                className="p-0.5 border border-slate-300 text-left pl-2 cursor-pointer hover:text-blue-700"
                                onClick={() => {
                                  setActiveSubgroupScope(selectedPivotSubgroups);
                                  setSelectedFallout('ALL');
                                  setSelectedWok((prev) => (prev === wok.name ? 'ALL' : wok.name));
                                }}
                              >
                                &oplus; {wok.name}
                              </td>
                              {pivotStatus.columns.map((st) => (
                                <td
                                  key={st}
                                  className="p-0.5 border border-slate-300 cursor-pointer hover:bg-blue-100 font-semibold"
                                  onClick={() => {
                                    setActiveSubgroupScope(selectedPivotSubgroups);
                                    setSelectedFallout('ALL');
                                    setSelectedWok(wok.name);
                                    setSelectedStatus(st);
                                  }}
                                >
                                  {wok.colCounts[st] || ''}
                                </td>
                              ))}
                              <td
                                className="p-0.5 border border-slate-300 font-extrabold bg-slate-200 cursor-pointer hover:bg-yellow-100"
                                onClick={() => {
                                  setActiveSubgroupScope(selectedPivotSubgroups);
                                  setSelectedFallout('ALL');
                                  setSelectedWok(wok.name);
                                  setSelectedStatus('ALL');
                                }}
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
                                  className="p-0.5 border border-slate-200 text-left pl-5 font-semibold text-slate-700 cursor-pointer hover:text-blue-700"
                                  onClick={() => {
                                    setActiveSubgroupScope(selectedPivotSubgroups);
                                    setSelectedFallout('ALL');
                                    setSelectedSto((prev) => (prev === sto.name ? 'ALL' : sto.name));
                                  }}
                                >
                                  {sto.name}
                                </td>
                                {pivotStatus.columns.map((st) => (
                                  <td
                                    key={st}
                                    className="p-0.5 border border-slate-200 text-slate-600 cursor-pointer hover:bg-blue-100 font-semibold"
                                    onClick={() => {
                                      setActiveSubgroupScope(selectedPivotSubgroups);
                                      setSelectedFallout('ALL');
                                      setSelectedSto(sto.name);
                                      setSelectedStatus(st);
                                    }}
                                  >
                                    {sto.colCounts[st] || ''}
                                  </td>
                                ))}
                                <td
                                  className="p-0.5 border border-slate-200 font-bold text-slate-800 bg-slate-50 cursor-pointer hover:bg-yellow-100"
                                  onClick={() => {
                                    setActiveSubgroupScope(selectedPivotSubgroups);
                                    setSelectedFallout('ALL');
                                    setSelectedSto(sto.name);
                                    setSelectedStatus('ALL');
                                  }}
                                >
                                  {sto.total}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })
                    )}

                    <tr className="bg-[#0f172a] text-white font-black border-t-2 border-slate-700 cursor-pointer">
                      <td
                        className="p-1 border border-slate-700 text-left pl-2.5 uppercase hover:text-yellow-300"
                        onClick={() => {
                          setActiveSubgroupScope(selectedPivotSubgroups);
                          setSelectedFallout('ALL');
                          setSelectedWok('ALL');
                          setSelectedSto('ALL');
                        }}
                      >
                        Grand Total
                      </td>
                      {pivotStatus.columns.map((st) => (
                        <td
                          key={st}
                          className="p-1 border border-slate-700 hover:bg-slate-800"
                          onClick={() => {
                            setActiveSubgroupScope(selectedPivotSubgroups);
                            setSelectedFallout('ALL');
                            setSelectedStatus(st);
                          }}
                        >
                          {pivotStatus.grandColTotals[st] || 0}
                        </td>
                      ))}
                      <td
                        className="p-1 border border-slate-700 text-yellow-300 font-black hover:bg-yellow-600 hover:text-slate-900"
                        onClick={() => {
                          setActiveSubgroupScope(selectedPivotSubgroups);
                          setSelectedFallout('ALL');
                          setSelectedWok('ALL');
                          setSelectedSto('ALL');
                          setSelectedStatus('ALL');
                        }}
                      >
                        {pivotStatus.totalAll}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* BARIS 2: PIVOT FALLOUT & DURATION FALLOUT CHART DENGAN TINGGI FULL MENYESUAIKAN SECARA OTOMATIS */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3 items-stretch">
            
            {/* 2.1. Pivot Fallout Table */}
            <div className="xl:col-span-4 bg-white border-2 border-slate-400 shadow-sm rounded overflow-hidden flex flex-col justify-between">
              <div>
                <div className="bg-[#0f172a] text-white p-1.5 px-2.5 flex justify-between items-center text-[11px] font-black uppercase flex-wrap gap-1 border-b-2 border-slate-800">
                  <span className="tracking-wide">Fallout</span>
                  
                  <div className="flex items-center gap-1">
                    <span className="text-[8.5px] text-slate-300 font-bold">Status:</span>
                    <MultiSelectDropdown
                      options={availableProcessStateOptions}
                      selected={selectedFalloutStates}
                      onChange={setSelectedFalloutStates}
                      badgeColor="bg-slate-800 text-yellow-300"
                    />
                  </div>
                </div>

                <div className="w-full">
                  <table className="w-full table-auto text-left border-collapse text-[9.5px]">
                    <thead className="bg-[#1e293b] text-white select-none">
                      <tr>
                        <th
                          className="p-1 border border-slate-600 cursor-pointer hover:bg-slate-700 font-extrabold pl-2"
                          onClick={() => handlePivotFalloutSort('reason')}
                        >
                          Row Labels {pivotFalloutSort.key === 'reason' ? (pivotFalloutSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                        </th>
                        <th
                          className="p-1 border border-slate-600 text-right pr-2.5 cursor-pointer hover:bg-slate-700 font-extrabold w-[110px]"
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
                                dur.name === '> 0 HARI' ? 'bg-[#cffafe] hover:bg-[#a5f3fc]' :
                                dur.name === '> 3 HARI' ? 'bg-[#dcfce7] hover:bg-[#bbf7d0]' :
                                dur.name === '> 7 HARI' ? 'bg-[#fef3c7] hover:bg-[#fde68a]' :
                                dur.name === '> 1 BULAN' ? 'bg-[#dbeafe] hover:bg-[#bfdbfe]' : 'bg-[#f3e8ff] hover:bg-[#e9d5ff]'
                              }`}
                              onClick={() => {
                                setActiveSubgroupScope('ALL');
                                if (selectedFalloutStates.length === 1) {
                                  setSelectedStatus(selectedFalloutStates[0]);
                                }
                                setSelectedDuration((prev) => (prev === dur.name ? 'ALL' : dur.name));
                                setSelectedFallout('ALL');
                              }}
                            >
                              <td className="p-0.5 border border-slate-300 pl-2">
                                &oplus; {dur.name}
                              </td>
                              <td className="p-0.5 border border-slate-300 text-right pr-2.5 font-black">
                                {dur.total}
                              </td>
                            </tr>

                            {sortedReasons.map(([reason, cnt]) => (
                              <tr
                                key={reason}
                                className="border-b border-slate-200 hover:bg-red-50/70 cursor-pointer transition bg-white"
                                onClick={() => {
                                  setActiveSubgroupScope('ALL');
                                  if (selectedFalloutStates.length === 1) {
                                    setSelectedStatus(selectedFalloutStates[0]);
                                  }
                                  setSelectedDuration(dur.name);
                                  setSelectedFallout((prev) => (prev === reason ? 'ALL' : reason));
                                }}
                              >
                                <td className="p-0.5 border border-slate-200 pl-5 font-semibold text-slate-700 truncate max-w-[180px]" title={reason}>
                                  {reason}
                                </td>
                                <td className="p-0.5 border border-slate-200 text-right pr-2.5 text-slate-800 font-bold">
                                  {cnt}
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                className="bg-[#0f172a] text-white font-black border-t-2 border-slate-700 cursor-pointer flex justify-between items-center p-1 px-2.5 text-[9.5px]"
                onClick={() => {
                  setActiveSubgroupScope('ALL');
                  if (selectedFalloutStates.length === 1) {
                    setSelectedStatus(selectedFalloutStates[0]);
                  }
                  setSelectedDuration('ALL');
                  setSelectedFallout('ALL');
                }}
              >
                <span className="uppercase text-yellow-300">Grand Total</span>
                <span className="text-yellow-300 font-black">{pivotFallout.totalAll}</span>
              </div>
            </div>

            {/* 2.2. DURATION FALLOUT CHART - FULL DYNAMIC HEIGHT (MENYESUAIKAN TINGGI TABEL KIRI SECARA OTOMATIS) */}
            <div className="xl:col-span-8 bg-gradient-to-b from-white to-slate-50 border-2 border-slate-400 shadow-sm rounded-lg p-3 flex flex-col justify-between h-full min-h-[380px]">
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2 flex-wrap gap-1">
                  <div className="flex items-center gap-2">
                    <span className="p-1 bg-purple-100 text-purple-900 rounded font-black text-xs">📊</span>
                    <h4 className="font-extrabold text-slate-900 text-xs sm:text-sm tracking-wide uppercase">
                      DURATION FALLOUT
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9.5px] font-extrabold text-blue-900 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200">
                      Total: {chartData.reduce((acc, curr) => acc + curr.count, 0)} Kasus
                    </span>
                    <span className="text-[9.5px] text-purple-700 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      Filter: {selectedFalloutStates.length === availableProcessStateOptions.length ? 'Semua Status' : selectedFalloutStates.join(', ')}
                    </span>
                  </div>
                </div>

                {/* Container Recharts Mengisi 100% Sisa Tinggi Card */}
                <div className="flex-1 w-full min-h-[280px]">
                  {chartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 font-bold text-xs">
                      Tidak ada data Fallout pada filter yang dipilih.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 20, right: 15, left: -20, bottom: 60 }}
                        onClick={(e) => {
                          if (e && e.activePayload && e.activePayload.length) {
                            const payload = e.activePayload[0].payload;
                            setActiveSubgroupScope('ALL');
                            if (selectedFalloutStates.length === 1) {
                              setSelectedStatus(selectedFalloutStates[0]);
                            }
                            setSelectedDuration(payload.duration);
                            setSelectedFallout((prev) => (prev === payload.reason ? 'ALL' : payload.reason));
                          }
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="reason"
                          interval={0}
                          tick={({ x, y, payload }) => (
                            <g transform={`translate(${x},${y})`}>
                              <text
                                x={0}
                                y={0}
                                dy={12}
                                textAnchor="end"
                                fill="#1e293b"
                                fontWeight="700"
                                fontSize={8.5}
                                transform="rotate(-30)"
                              >
                                {payload.value}
                              </text>
                            </g>
                          )}
                        />
                        <YAxis tick={{ fontSize: 9, fontWeight: 'bold', fill: '#475569' }} allowDecimals={false} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-slate-900/95 text-white p-2.5 rounded-lg shadow-2xl border border-slate-700 text-xs font-sans space-y-1">
                                  <p className="font-extrabold text-yellow-300 border-b border-slate-700 pb-1">{d.reason}</p>
                                  <p className="text-[11px] font-semibold text-slate-300">
                                    Durasi: <strong className="text-white">{d.duration}</strong>
                                  </p>
                                  <p className="text-xs font-black text-emerald-400 pt-0.5">Jumlah: {d.count} Order</p>
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
                            stroke="#cbd5e1"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                          />
                        ))}

                        <Bar
                          dataKey="count"
                          maxBarSize={45}
                          radius={[6, 6, 0, 0]}
                          label={({ x, y, width, value }) => (
                            <text
                              x={x + width / 2}
                              y={y - 6}
                              fill="#0f172a"
                              textAnchor="middle"
                              fontSize={9.5}
                              fontWeight="900"
                            >
                              {value}
                            </text>
                          )}
                        >
                          {chartData.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.fillColor}
                              className="transition-all duration-200 hover:opacity-80 cursor-pointer"
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Legend Modern Pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-[9.5px] font-extrabold text-slate-700 mt-2 border-t border-slate-200 pt-2 bg-white/80 p-1.5 rounded-md">
                <span className="flex items-center gap-1.5 bg-cyan-50 border border-cyan-300 px-2 py-0.5 rounded-full text-cyan-950">
                  <span className="w-2.5 h-2.5 bg-[#06b6d4] rounded-full inline-block shadow-xs"></span> &gt; 0 HARI
                </span>
                <span className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 px-2 py-0.5 rounded-full text-emerald-950">
                  <span className="w-2.5 h-2.5 bg-[#10b981] rounded-full inline-block shadow-xs"></span> &gt; 3 HARI
                </span>
                <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full text-amber-950">
                  <span className="w-2.5 h-2.5 bg-[#f59e0b] rounded-full inline-block shadow-xs"></span> &gt; 7 HARI
                </span>
                <span className="flex items-center gap-1.5 bg-blue-50 border border-blue-300 px-2 py-0.5 rounded-full text-blue-950">
                  <span className="w-2.5 h-2.5 bg-[#3b82f6] rounded-full inline-block shadow-xs"></span> &gt; 1 BULAN
                </span>
                <span className="flex items-center gap-1.5 bg-purple-50 border border-purple-300 px-2 py-0.5 rounded-full text-purple-950">
                  <span className="w-2.5 h-2.5 bg-[#8b5cf6] rounded-full inline-block shadow-xs"></span> &gt; 3 BULAN
                </span>
              </div>
            </div>

          </div>

        </div>

        {/* ========================================================================= */}
        {/* TABEL PALING BAWAH: MENAMPILKAN SELURUH KOLOM DENGAN SAFE RENDERING       */}
        {/* ========================================================================= */}
        <div className="bg-white border border-slate-300 shadow-xs rounded overflow-hidden mt-4">
          <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#334155] text-white p-2.5 px-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                <span>📦</span> DATA DETAIL ORDER FULFILLMENT (SEMUA KOLOM)
              </h2>
              <p className="text-[9.5px] text-slate-300 mt-0.5">
                Menampilkan <strong>{sortedBottomTableData.length.toLocaleString()}</strong> dari{' '}
                <strong>{orders.length.toLocaleString()}</strong> total order &bull; <em>Klik header kolom untuk sort, klik isi sel untuk filter</em>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Cari ID, Pelanggan, STO, Fallout, Reason..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2 py-1 text-black rounded text-xs outline-none w-full sm:w-60 bg-white font-semibold"
              />
              
              <button
                type="button"
                onClick={handleExportFilteredCSV}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold shadow flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
              >
                <span>📥</span> Terfilter ({filteredOrders.length.toLocaleString()})
              </button>

              <button
                type="button"
                onClick={handleExportAllCSV}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold shadow flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
              >
                <span>📥</span> Semua ({orders.length.toLocaleString()})
              </button>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-[9.5px] whitespace-nowrap">
              <thead className="bg-[#3b0764] text-white uppercase font-bold sticky top-0 z-10 shadow cursor-pointer select-none">
                <tr>
                  <th className="p-1.5 border border-purple-800 text-center">No</th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('order_id')}>
                    Order ID {sortConfig.key === 'order_id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('new_order_id')}>
                    New Order ID {sortConfig.key === 'new_order_id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('process_state')}>
                    Process State {sortConfig.key === 'process_state' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('funneling_subgroup')}>
                    Subgroup {sortConfig.key === 'funneling_subgroup' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('name')}>
                    Nama Pelanggan {sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('no_handphone')}>
                    No HP {sortConfig.key === 'no_handphone' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('sto_co')}>
                    STO {sortConfig.key === 'sto_co' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('wok')}>
                    WOK {sortConfig.key === 'wok' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('odp_name')}>
                    ODP Name {sortConfig.key === 'odp_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('product_commercial_name')}>
                    Product Name {sortConfig.key === 'product_commercial_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800 bg-purple-900" onClick={() => requestOrderSort('order_duration_cat')}>
                    Duration Cat {sortConfig.key === 'order_duration_cat' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('fallout_category')}>
                    Fallout Category {sortConfig.key === 'fallout_category' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('symptom')}>
                    Symptom {sortConfig.key === 'symptom' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('fallout_reason_clean')}>
                    Fallout Reason {sortConfig.key === 'fallout_reason_clean' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('category_hk')}>
                    Category HK {sortConfig.key === 'category_hk' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('status_hk')}>
                    Status HK {sortConfig.key === 'status_hk' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('tanggal_hk')}>
                    Tanggal HK {sortConfig.key === 'tanggal_hk' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('pic_dept')}>
                    PIC Dept {sortConfig.key === 'pic_dept' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('price_package')}>
                    Price {sortConfig.key === 'price_package' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800 bg-purple-900" onClick={() => requestOrderSort('order_ts')}>
                    Order Date (Provi) {sortConfig.key === 'order_ts' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('ps_ts')}>
                    PS Date {sortConfig.key === 'ps_ts' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('sf_name')}>
                    SF Name {sortConfig.key === 'sf_name' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : '↕'}
                  </th>
                  <th className="p-1.5 border border-purple-800">Remark</th>
                  <th className="p-1.5 border border-purple-800">Alamat</th>
                  <th className="p-1.5 border border-purple-800">Latitude</th>
                  <th className="p-1.5 border border-purple-800">Longitude</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={27} className="p-4 text-center text-slate-400 font-bold">
                      Tidak ada data Order yang cocok dengan filter atau pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((row, idx) => {
                    const rowNumber = (currentPage - 1) * rowsPerPage + idx + 1;
                    const pState = String(row.process_state || 'UNKNOWN').trim().toUpperCase();
                    const saklekDur = row.order_duration_cat || '> 0 HARI';
                    const displayOrderDate = safeFormatDisplayDate(row.order_ts || row.provi);

                    return (
                      <tr
                        key={`${row.order_id || idx}-${idx}`}
                        className="border-b border-slate-200 hover:bg-purple-50/60 transition"
                      >
                        <td className="p-1 border border-slate-200 text-center font-bold text-slate-500">{rowNumber}</td>
                        <td className="p-1 border border-slate-200 font-black text-purple-900">{row.order_id || '-'}</td>
                        <td className="p-1 border border-slate-200 font-mono text-slate-600">{row.new_order_id || '-'}</td>
                        <td
                          className="p-1 border border-slate-200 font-bold text-slate-800 cursor-pointer hover:text-blue-700 hover:underline"
                          onClick={() => setSelectedStatus((p) => (p === pState ? 'ALL' : pState))}
                          title="Klik filter status ini"
                        >
                          <span
                            className={`px-1.5 py-0.5 rounded text-[8.5px] font-black ${
                              pState === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' :
                              pState === 'FALLOUT' ? 'bg-red-100 text-red-800' :
                              pState.includes('CANCEL') ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {pState}
                          </span>
                        </td>
                        <td
                          className="p-1 border border-slate-200 font-bold text-slate-700 cursor-pointer hover:text-blue-700 hover:underline"
                          onClick={() => setActiveSubgroupScope((p) => (p === row.funneling_subgroup ? 'ALL' : row.funneling_subgroup))}
                          title="Klik filter Subgroup ini"
                        >
                          {row.funneling_subgroup || '-'}
                        </td>
                        <td className="p-1 border border-slate-200 font-semibold">{row.name || '-'}</td>
                        <td className="p-1 border border-slate-200 font-mono text-[9px]">{row.no_handphone || row.no_handphone_mask || '-'}</td>
                        <td
                          className="p-1 border border-slate-200 font-bold text-slate-800 cursor-pointer hover:text-blue-700 hover:underline"
                          onClick={() => setSelectedSto((p) => (p === row.sto_co ? 'ALL' : row.sto_co))}
                          title="Klik filter STO ini"
                        >
                          {row.sto_co || '-'}
                        </td>
                        <td
                          className="p-1 border border-slate-200 cursor-pointer hover:text-blue-700 hover:underline"
                          onClick={() => setSelectedWok((p) => (p === row.wok ? 'ALL' : row.wok))}
                          title="Klik filter WOK ini"
                        >
                          {row.wok || '-'}
                        </td>
                        <td className="p-1 border border-slate-200 font-bold text-blue-800">{row.odp_name || '-'}</td>
                        <td className="p-1 border border-slate-200">{row.product_commercial_name || '-'}</td>
                        <td
                          className="p-1 border border-slate-200 font-bold text-emerald-800 cursor-pointer hover:text-blue-700 hover:underline"
                          onClick={() => setSelectedDuration((p) => (p === saklekDur ? 'ALL' : saklekDur))}
                          title="Klik filter durasi ini"
                        >
                          {saklekDur}
                        </td>
                        <td className="p-1 border border-slate-200 font-semibold text-slate-700">{row.fallout_category || '-'}</td>
                        <td
                          className="p-1 border border-slate-200 text-red-700 font-bold cursor-pointer hover:underline"
                          onClick={() => {
                            const r = getSimplifiedFalloutReason(row);
                            if (selectedFalloutStates.length === 1) {
                              setSelectedStatus(selectedFalloutStates[0]);
                            }
                            r && setSelectedFallout((p) => (p === r ? 'ALL' : r));
                          }}
                          title="Klik filter fallout ini"
                        >
                          {row.symptom || row.fallout_category || '-'}
                        </td>
                        <td className="p-1 border border-slate-200 text-red-600 max-w-[200px] truncate" title={row.fallout_reason || row.fallout_reason_clean}>
                          {row.fallout_reason || row.fallout_reason_clean || '-'}
                        </td>
                        <td className="p-1 border border-slate-200">{row.category_hk || '-'}</td>
                        <td className="p-1 border border-slate-200">{row.status_hk || '-'}</td>
                        <td className="p-1 border border-slate-200">{safeFormatDisplayDate(row.tanggal_hk)}</td>
                        <td className="p-1 border border-slate-200">{row.pic_dept || '-'}</td>
                        <td className="p-1 border border-slate-200 text-right">{safeFormatNumber(row.price_package)}</td>
                        <td className="p-1 border border-slate-200 font-mono text-[9px] font-bold text-slate-800">{displayOrderDate}</td>
                        <td className="p-1 border border-slate-200">{safeFormatDisplayDate(row.ps_ts)}</td>
                        <td className="p-1 border border-slate-200">{row.sf_name || '-'}</td>
                        <td className="p-1 border border-slate-200 max-w-[150px] truncate" title={row.remark}>{row.remark || '-'}</td>
                        <td className="p-1 border border-slate-200 max-w-[180px] truncate" title={row.address}>{row.address || '-'}</td>
                        <td className="p-1 border border-slate-200 font-mono text-[8.5px]">{safeFormatCoord(row.latitude)}</td>
                        <td className="p-1 border border-slate-200 font-mono text-[8.5px]">{safeFormatCoord(row.longitude)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-slate-50 p-2 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs font-semibold">
              <span className="text-slate-600">
                Halaman <strong>{currentPage}</strong> dari <strong>{totalPages}</strong> (Total <strong>{sortedBottomTableData.length.toLocaleString()}</strong> data)
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                >
                  &laquo; Pertama
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                >
                  &lsaquo; Prev
                </button>
                <span className="px-2 font-bold text-slate-700">{currentPage} / {totalPages}</span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalOdpPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                >
                  Next &rsaquo;
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-0.5 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
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
