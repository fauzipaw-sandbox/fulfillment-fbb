import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
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
} from 'recharts';

const MapComponent = dynamic(() => import('../components/Map'), { ssr: false });

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

function formatDateFormatted(d) {
  if (!d) return '-';
  return `${String(d.getDate()).padStart(2, '0')}-${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
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

function extractOrderCoordinates(order) {
  if (!order) return null;
  const reason = String(order.fallout_reason || '');

  const match = reason.match(/KP:\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/i);
  if (match && match[1] && match[2]) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lon)) {
      return { lat, lon, coordSource: 'KP' };
    }
  }

  const lat = typeof order.latitude === 'number' ? order.latitude : parseFloat(order.latitude);
  const lon = typeof order.longitude === 'number' ? order.longitude : parseFloat(order.longitude);
  if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
    return { lat, lon, coordSource: 'ROW' };
  }

  return null;
}

export default function Dashboard() {
  const { odpData: data, ordersData, odpLoaded, reloadOdp, reloadOrders } = useData();
  const [sortConfig, setSortConfig] = useState({ key: 'occ', direction: 'desc' });
  const [showUploader, setShowUploader] = useState(false);
  
  // Filter States
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedRx, setSelectedRx] = useState('ALL');
  const [selectedKabupaten, setSelectedKabupaten] = useState('ALL');
  const [selectedPortFilter, setSelectedPortFilter] = useState('ALL');
  const [selectedStoFilter, setSelectedStoFilter] = useState('ALL');
  const [selectedWokFilter, setSelectedWokFilter] = useState('ALL');

  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [focusedOdp, setFocusedOdp] = useState(null);

  // Measure Jarak
  const [showMeasureModal, setShowMeasureModal] = useState(false);
  const [pointAInput, setPointAInput] = useState('');
  const [pointBInput, setPointBInput] = useState('');
  const [isRouting, setIsRouting] = useState(false);
  const [measureResult, setMeasureResult] = useState(null);
  const [manualMeasureLine, setManualMeasureLine] = useState(null);
  const [roadRouteCoordinates, setRoadRouteCoordinates] = useState([]);

  // Tab & Table States Bagian Bawah
  const [bottomActiveTab, setBottomActiveTab] = useState('ODP');
  const [tableSearch, setTableSearch] = useState('');
  const [orderTableSearch, setOrderTableSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentOrderPage, setCurrentOrderPage] = useState(1);
  const [odpTableSort, setOdpTableSort] = useState({ key: 'odp_name', direction: 'asc' });
  const [orderTableSort, setOrderTableSort] = useState({ key: 'order_ts', direction: 'desc' });
  const rowsPerPage = 50;

  const fullyFilteredData = useMemo(() => {
    return (data || []).filter((d) => {
      const matchStatus = selectedStatus === 'ALL' || d.status_final === selectedStatus;
      const matchRx = selectedRx === 'ALL' || d.rx_category === selectedRx;
      const matchKab = selectedKabupaten === 'ALL' || d.kabupaten === selectedKabupaten;
      const matchSto = selectedStoFilter === 'ALL' || d.sto === selectedStoFilter;
      const matchWok = selectedWokFilter === 'ALL' || d.wok === selectedWokFilter;
      const matchPort = selectedPortFilter === 'ALL' || (selectedPortFilter === 'USED' && d.used > 0) || (selectedPortFilter === 'AVAI' && d.avai > 0);
      
      return matchStatus && matchRx && matchKab && matchSto && matchWok && matchPort;
    });
  }, [data, selectedStatus, selectedRx, selectedKabupaten, selectedStoFilter, selectedWokFilter, selectedPortFilter]);

  const falloutMapMarkers = useMemo(() => {
    return (ordersData || [])
      .filter((o) => {
        const fg = (o.funneling_group || o.process_state || '').trim().toUpperCase();
        const isFallout = fg === 'FALLOUT';
        const matchSto = selectedStoFilter === 'ALL' || o.sto_co === selectedStoFilter;
        const matchWok = selectedWokFilter === 'ALL' || o.wok === selectedWokFilter;
        return isFallout && matchSto && matchWok;
      })
      .map((o) => {
        const coords = extractOrderCoordinates(o);
        return coords ? { ...o, ...coords } : null;
      })
      .filter(Boolean);
  }, [ordersData, selectedStoFilter, selectedWokFilter]);

  const filteredOrders = useMemo(() => {
    return (ordersData || []).filter((o) => {
      const matchSto = selectedStoFilter === 'ALL' || o.sto_co === selectedStoFilter;
      const matchWok = selectedWokFilter === 'ALL' || o.wok === selectedWokFilter;
      const s = orderTableSearch.toLowerCase();
      const matchSearch =
        !s ||
        (o.order_id && o.order_id.toLowerCase().includes(s)) ||
        (o.name && o.name.toLowerCase().includes(s)) ||
        (o.odp_name && o.odp_name.toLowerCase().includes(s)) ||
        (o.sto_co && o.sto_co.toLowerCase().includes(s)) ||
        (o.fallout_reason_clean && o.fallout_reason_clean.toLowerCase().includes(s));

      return matchSto && matchWok && matchSearch;
    });
  }, [ordersData, selectedStoFilter, selectedWokFilter, orderTableSearch]);

  const headerCutoffText = useMemo(() => {
    if (!data || data.length === 0) return '*Cut Off Data until -';
    const dates = data.map((d) => d.parsed_date?.getTime()).filter((t) => t && !isNaN(t));
    if (dates.length === 0) return '*Cut Off Data';
    const latestDate = new Date(Math.max(...dates));
    return `*Cut Off Data until ${formatDateFormatted(latestDate)}`;
  }, [data]);

  // STATS OVERVIEW GLOBAL DI-FREEZE ANGKANYA
  const statsOverview = useMemo(() => {
    let totalPort = 0, usedPort = 0, avaiPort = 0;
    let colorCounts = { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    let colorPorts = { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    let rxCounts = { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0, NO_DATA: 0 };
    let rxPorts = { RED: 0, ORANGE: 0, YELLOW: 0, GREEN: 0, NO_DATA: 0 };

    (data || []).forEach(item => {
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
  }, [data]);

  const statsFiltered = useMemo(() => {
    const kabMap = {}, flatStosMap = {};
    const VALID_KABS = [
      'BARITO SELATAN', 'KOTA PALANGKARAYA', 'GUNUNG MAS', 'BARITO UTARA',
      'BARITO TIMUR', 'KAPUAS', 'KATINGAN', 'PULANG PISAU', 'MURUNG RAYA',
    ];
    VALID_KABS.concat(['LAINNYA']).forEach(k => {
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

    const chartData = Object.values(kabMap).filter(k => k.total > 0 || VALID_KABS.includes(k.name)).map(k => {
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

  const requestOdpSort = (key) => {
    let direction = 'asc';
    if (odpTableSort.key === key && odpTableSort.direction === 'asc') direction = 'desc';
    setOdpTableSort({ key, direction });
  };

  const requestOrderSort = (key) => {
    let direction = 'asc';
    if (orderTableSort.key === key && orderTableSort.direction === 'asc') direction = 'desc';
    setOrderTableSort({ key, direction });
  };

  const sortedBottomOdpData = useMemo(() => {
    let filtered = fullyFilteredData;
    if (tableSearch.trim()) {
      const s = tableSearch.toLowerCase();
      filtered = filtered.filter((d) =>
        (d.odp_name && d.odp_name.toLowerCase().includes(s)) ||
        (d.sto && d.sto.toLowerCase().includes(s)) ||
        (d.wok && d.wok.toLowerCase().includes(s)) ||
        (d.kabupaten && d.kabupaten.toLowerCase().includes(s)) ||
        (d.desa && d.desa.toLowerCase().includes(s))
      );
    }

    return [...filtered].sort((a, b) => {
      let valA = a[odpTableSort.key] ?? '';
      let valB = b[odpTableSort.key] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return odpTableSort.direction === 'asc' ? valA - valB : valB - valA;
      }
      return odpTableSort.direction === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [fullyFilteredData, tableSearch, odpTableSort]);

  const sortedBottomOrderData = useMemo(() => {
    return [...filteredOrders].sort((a, b) => {
      let valA = a[orderTableSort.key] ?? '';
      let valB = b[orderTableSort.key] ?? '';
      if (typeof valA === 'number' && typeof valB === 'number') {
        return orderTableSort.direction === 'asc' ? valA - valB : valB - valA;
      }
      return orderTableSort.direction === 'asc'
        ? String(valA).localeCompare(String(valB))
        : String(valB).localeCompare(String(valA));
    });
  }, [filteredOrders, orderTableSort]);

  const totalOdpPages = Math.ceil(sortedBottomOdpData.length / rowsPerPage) || 1;
  const paginatedOdpData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return sortedBottomOdpData.slice(start, start + rowsPerPage);
  }, [sortedBottomOdpData, currentPage]);

  const totalOrderPages = Math.ceil(sortedBottomOrderData.length / rowsPerPage) || 1;
  const paginatedOrderData = useMemo(() => {
    const start = (currentOrderPage - 1) * rowsPerPage;
    return sortedBottomOrderData.slice(start, start + rowsPerPage);
  }, [sortedBottomOrderData, currentOrderPage]);

  // Export ODP Terfilter
  const handleExportFilteredOdpCSV = () => {
    if (fullyFilteredData.length === 0) return alert('Tidak ada data ODP terfilter.');
    const clean = fullyFilteredData.map(({ parsed_date, ...rest }) => rest);
    const csv = Papa.unparse(clean);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `odp_filtered_${fullyFilteredData.length}_rows_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Semua ODP
  const handleExportAllOdpCSV = () => {
    if (!data || data.length === 0) return alert('Data ODP kosong.');
    const clean = data.map(({ parsed_date, ...rest }) => rest);
    const csv = Papa.unparse(clean);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `odp_all_${data.length}_rows_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export Orders Terfilter
  const handleExportFilteredOrderCSV = () => {
    if (filteredOrders.length === 0) return alert('Tidak ada data Order.');
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

  // Export Semua Orders
  const handleExportAllOrderCSV = () => {
    if (!ordersData || ordersData.length === 0) return alert('Data Order kosong.');
    const csv = Papa.unparse(ordersData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `orders_all_${ordersData.length}_rows_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
    const found = (data || []).find((d) => d.odp_name && d.odp_name.toLowerCase() === clean.toLowerCase());
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

  const totalOdpGlobal = (data || []).length;
  const totalPortGlobal = statsOverview.totalPort;
  const occGlobal = totalPortGlobal > 0 ? ((statsOverview.usedPort / totalPortGlobal) * 100).toFixed(1) : '0.0';
  const avaiGlobal = totalPortGlobal > 0 ? ((statsOverview.avaiPort / totalPortGlobal) * 100).toFixed(1) : '0.0';
  const totalRxValid = totalOdpGlobal - statsOverview.rxCounts.NO_DATA;

  const getAvailBg = (availPerc) => {
    if (availPerc <= 1) return 'bg-[#fca5a5] text-red-950 font-bold';
    if (availPerc <= 15) return 'bg-[#fed7aa] text-orange-950 font-bold';
    if (availPerc <= 40) return 'bg-[#fef08a] text-yellow-950 font-bold';
    return 'bg-[#86efac] text-emerald-950 font-bold';
  };

  return (
    <Sidebar>
      <Head>
        <title>ODP Profile &amp; Utilization</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
      </Head>

      {!odpLoaded && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/70 backdrop-blur-xs flex flex-col items-center justify-center text-white">
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
              ODP PROFILE &amp; UTILIZATION
            </h1>
            <p className="text-[10px] sm:text-xs font-semibold mt-0.5 opacity-90 text-yellow-300">
              {headerCutoffText}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowUploader(!showUploader)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded shadow transition cursor-pointer"
            >
              <svg
                className={`w-4 h-4 transition-transform ${showUploader ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showUploader ? 'Tutup Upload' : 'Upload Data (ODP &amp; Order)'}
            </button>
          </div>
        </div>

        {/* NARASI SUMMARY */}
        <div className="bg-white px-3 sm:px-4 py-2 text-xs sm:text-[13px] border border-gray-200 shadow-sm rounded flex flex-col sm:flex-row justify-between sm:items-center gap-2">
          <div>
            Total <strong className="font-extrabold">jumlah ODP</strong> di Branch Palangkaraya adalah{' '}
            <strong className="font-extrabold">{(totalOdpGlobal / 1000).toFixed(1)}K</strong> (
            {(statsOverview.totalPort / 1000).toFixed(1)} K Port) dengan Occupancy{' '}
            <strong className="font-extrabold">
              {(statsOverview.usedPort / 1000).toFixed(1)}K Port ({occGlobal}%)
            </strong>{' '}
            dan{' '}
            <strong className="font-extrabold">
              {(statsOverview.avaiPort / 1000).toFixed(1)}K ({avaiGlobal}%)
            </strong>{' '}
            port tersedia untuk <strong className="font-extrabold">penjualan baru.</strong>
          </div>
          {(selectedStatus !== 'ALL' || selectedRx !== 'ALL' || selectedKabupaten !== 'ALL' || selectedPortFilter !== 'ALL' || selectedStoFilter !== 'ALL' || selectedWokFilter !== 'ALL') && (
            <button
              onClick={resetAllFilters}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold whitespace-nowrap self-start sm:self-auto shadow cursor-pointer"
            >
              ✕ Reset Semua Filter
            </button>
          )}
        </div>

        {showUploader && (
          <div className="transition-all duration-300">
            <Uploader
              onUploadOdpSuccess={reloadOdp}
              onUploadOrderSuccess={reloadOrders}
            />
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 sm:gap-4">
          {/* ================= KOLOM KIRI ================= */}
          <div className="space-y-3 sm:space-y-4">
            
            {/* 1. OVERVIEW ODP PROFILE (BERSIH & BISA DIKLIK UNTUK FILTER) */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white px-3 py-1.5 flex justify-between items-center flex-wrap gap-1 shadow-sm">
                <span className="font-extrabold text-xs sm:text-sm tracking-wide">OVERVIEW ODP PROFILE</span>
                <span className="text-white text-[9.5px] font-semibold opacity-90">
                  {selectedStatus !== 'ALL' ? `Filter Status: ${selectedStatus}` : selectedPortFilter !== 'ALL' ? `Filter Port: ${selectedPortFilter}` : 'Klik box untuk filter'}
                </span>
              </div>

              <div className="p-2 sm:p-3 grid grid-cols-3 gap-2 sm:gap-3 text-center">
                <div className="col-span-1 space-y-1.5 sm:space-y-2">
                  <div
                    onClick={() => setSelectedPortFilter('ALL')}
                    className={`border p-1.5 sm:p-2 rounded cursor-pointer transition-transform hover:scale-105 ${
                      selectedPortFilter === 'ALL' ? 'border-blue-500 bg-blue-100/70 shadow-xs' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <p className="text-[8px] sm:text-[9px] font-bold text-blue-800 uppercase">TOTAL ODP (Port)</p>
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-0.5">
                      {totalOdpGlobal.toLocaleString()}{' '}
                      <span className="text-[10px] sm:text-xs font-bold text-slate-600">({(statsOverview.totalPort / 1000).toFixed(1)} K)</span>
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedPortFilter((p) => (p === 'USED' ? 'ALL' : 'USED'))}
                    className={`border p-1.5 sm:p-2 rounded cursor-pointer transition-transform hover:scale-105 ${
                      selectedPortFilter === 'USED' ? 'border-emerald-600 bg-emerald-100 ring-2 ring-emerald-500 shadow' : 'border-emerald-300 bg-emerald-50/80 hover:bg-emerald-100'
                    }`}
                  >
                    <p className="text-[8px] sm:text-[9px] font-black text-emerald-800 uppercase">USED PORT (Active)</p>
                    <p className="text-sm sm:text-base font-extrabold text-emerald-950 mt-0.5">
                      {(statsOverview.usedPort / 1000).toFixed(1)} K{' '}
                      <span className="text-[10px] sm:text-xs font-bold text-emerald-800">({occGlobal}%)</span>
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedPortFilter((p) => (p === 'AVAI' ? 'ALL' : 'AVAI'))}
                    className={`border p-1.5 sm:p-2 rounded cursor-pointer transition-transform hover:scale-105 ${
                      selectedPortFilter === 'AVAI' ? 'border-red-600 bg-red-100 ring-2 ring-red-500 shadow' : 'border-red-300 bg-red-50/80 hover:bg-red-100'
                    }`}
                  >
                    <p className="text-[8px] sm:text-[9px] font-black text-red-800 uppercase">AVAI PORT (Non Active)</p>
                    <p className="text-sm sm:text-base font-extrabold text-red-950 mt-0.5">
                      {(statsOverview.avaiPort / 1000).toFixed(1)} K{' '}
                      <span className="text-[10px] sm:text-xs font-bold text-red-800">({avaiGlobal}%)</span>
                    </p>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedStatus((p) => (p === 'BLACK' ? 'ALL' : 'BLACK'))}
                  className={`col-span-1 border border-gray-400 p-2 shadow-inner flex flex-col justify-center rounded relative bg-white cursor-pointer transition-transform hover:scale-105 ${
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
                    {totalOdpGlobal > 0 ? ((statsOverview.colorCounts.BLACK / totalOdpGlobal) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[10px] font-bold text-slate-700 mt-1">
                    {(statsOverview.colorPorts.BLACK / 1000).toFixed(1)} K Port ({statsOverview.colorPorts.BLACK.toLocaleString()})
                  </p>
                </div>

                <div className="col-span-1 grid grid-cols-2 gap-1.5 sm:gap-2">
                  <div
                    onClick={() => setSelectedStatus((p) => (p === 'YELLOW' ? 'ALL' : 'YELLOW'))}
                    className={`text-center p-1 rounded cursor-pointer transition-transform hover:scale-105 ${
                      selectedStatus === 'YELLOW' ? 'ring-2 ring-yellow-500 bg-yellow-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#facc15] text-slate-900 text-[8px] font-bold px-0.5 py-0.5 rounded-sm">YELLOW</div>
                    <p className="text-sm sm:text-base font-extrabold mt-0.5">{statsOverview.colorCounts.YELLOW.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-600">
                      {totalOdpGlobal > 0 ? ((statsOverview.colorCounts.YELLOW / totalOdpGlobal) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-[9px] font-bold text-yellow-800">
                      {(statsOverview.colorPorts.YELLOW / 1000).toFixed(1)}K Port
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedStatus((p) => (p === 'GREEN' ? 'ALL' : 'GREEN'))}
                    className={`text-center p-1 rounded cursor-pointer transition-transform hover:scale-105 ${
                      selectedStatus === 'GREEN' ? 'ring-2 ring-green-600 bg-green-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#16a34a] text-white text-[8px] font-bold px-0.5 py-0.5 rounded-sm">GREEN</div>
                    <p className="text-sm sm:text-base font-extrabold mt-0.5">{statsOverview.colorCounts.GREEN.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-emerald-700">
                      {totalOdpGlobal > 0 ? ((statsOverview.colorCounts.GREEN / totalOdpGlobal) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-[9px] font-bold text-emerald-800">
                      {(statsOverview.colorPorts.GREEN / 1000).toFixed(1)}K Port
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedStatus((p) => (p === 'ORANGE' ? 'ALL' : 'ORANGE'))}
                    className={`text-center p-1 rounded cursor-pointer transition-transform hover:scale-105 ${
                      selectedStatus === 'ORANGE' ? 'ring-2 ring-orange-500 bg-orange-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#ea580c] text-white text-[8px] font-bold px-0.5 py-0.5 rounded-sm">ORANGE</div>
                    <p className="text-sm sm:text-base font-extrabold mt-0.5">{statsOverview.colorCounts.ORANGE.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-slate-600">
                      {totalOdpGlobal > 0 ? ((statsOverview.colorCounts.ORANGE / totalOdpGlobal) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-[9px] font-bold text-orange-800">
                      {(statsOverview.colorPorts.ORANGE / 1000).toFixed(1)}K Port
                    </p>
                  </div>

                  <div
                    onClick={() => setSelectedStatus((p) => (p === 'RED' ? 'ALL' : 'RED'))}
                    className={`text-center p-1 rounded cursor-pointer transition-transform hover:scale-105 ${
                      selectedStatus === 'RED' ? 'ring-2 ring-red-600 bg-red-50 shadow' : 'bg-slate-50 border border-slate-200'
                    }`}
                  >
                    <div className="bg-[#ef4444] text-white text-[8px] font-bold px-0.5 py-0.5 rounded-sm">RED</div>
                    <p className="text-sm sm:text-base font-extrabold mt-0.5">{statsOverview.colorCounts.RED.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-red-600">
                      {totalOdpGlobal > 0 ? ((statsOverview.colorCounts.RED / totalOdpGlobal) * 100).toFixed(1) : 0}%
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

            {/* 2. KUALITAS REDAMAN */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#059669] via-[#0d9488] to-[#1e3a8a] text-white px-3 py-1.5 flex justify-between items-center flex-wrap gap-1 shadow-sm">
                <span className="font-extrabold text-xs sm:text-sm tracking-wide">KUALITAS REDAMAN (ONT RX LEVEL)</span>
                <span className="bg-white/20 hover:bg-white/30 text-white text-[9.5px] font-semibold px-2 py-0.5 rounded-full border border-white/20 backdrop-blur-sm">
                  {selectedRx !== 'ALL' ? `Filter: ${selectedRx}` : 'Klik box untuk filter'}
                </span>
              </div>

              <div className="p-2 sm:p-3 grid grid-cols-4 gap-2 text-center">
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

                <div
                  onClick={() => setSelectedRx((p) => (p === 'ORANGE' ? 'ALL' : 'ORANGE'))}
                  className={`p-2 rounded border cursor-pointer transition-transform hover:scale-105 ${
                    selectedRx === 'ORANGE' ? 'ring-2 ring-orange-500 bg-orange-100 shadow' : 'bg-orange-50 border-orange-200'
                  }`}
                >
                  <div className="bg-orange-500 text-white text-[9px] font-bold py-0.5 rounded-sm">-25 s/d -21</div>
                  <p className="text-base sm:text-lg font-black text-orange-950 mt-1">{statsOverview.rxCounts.ORANGE.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-orange-800">
                    {totalRxValid > 0 ? ((statsOverview.rxCounts.ORANGE / totalRxValid) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[9px] font-bold text-orange-800 mt-0.5">
                    {(statsOverview.rxPorts.ORANGE / 1000).toFixed(1)}K Port
                  </p>
                </div>

                <div
                  onClick={() => setSelectedRx((p) => (p === 'YELLOW' ? 'ALL' : 'YELLOW'))}
                  className={`p-2 rounded border cursor-pointer transition-transform hover:scale-105 ${
                    selectedRx === 'YELLOW' ? 'ring-2 ring-yellow-500 bg-yellow-100 shadow' : 'bg-yellow-50 border-yellow-200'
                  }`}
                >
                  <div className="bg-yellow-400 text-black text-[9px] font-bold py-0.5 rounded-sm">-21 s/d -18</div>
                  <p className="text-base sm:text-lg font-black text-yellow-950 mt-1">{statsOverview.rxCounts.YELLOW.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-yellow-800">
                    {totalRxValid > 0 ? ((statsOverview.rxCounts.YELLOW / totalRxValid) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[9px] font-bold text-yellow-800 mt-0.5">
                    {(statsOverview.rxPorts.YELLOW / 1000).toFixed(1)}K Port
                  </p>
                </div>

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
              </div>
            </div>

            {/* 3. ODP SHARE KABUPATEN LEVEL */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#4c1d95] to-[#1e3a8a] text-white px-3 py-1.5 flex justify-between items-center flex-wrap gap-1 shadow-sm">
                <span className="font-extrabold text-xs sm:text-sm tracking-wide">ODP SHARE KABUPATEN LEVEL</span>
                <span className="bg-white/20 hover:bg-white/30 text-white text-[9.5px] font-semibold px-2 py-0.5 rounded-full border border-white/20 backdrop-blur-sm">
                  {selectedKabupaten !== 'ALL' ? `Filter: ${selectedKabupaten}` : 'Klik batang untuk filter'}
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
            {/* MAPS LOKASI ODP & FALLOUT ORDER */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm relative">
              <div className="bg-gradient-to-r from-[#1e3a8a] to-[#3a3575] text-white p-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-xs sm:text-sm">MAPS LOKASI ODP &amp; FALLOUT</span>
                  <button
                    type="button"
                    onClick={() => setShowMeasureModal(!showMeasureModal)}
                    className="px-2 py-0.5 bg-blue-700 hover:bg-blue-600 text-white rounded text-[10px] font-semibold flex items-center gap-1 shadow cursor-pointer"
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
                    className="w-full px-2.5 py-1 text-black rounded text-xs outline-none shadow-sm bg-white"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full bg-white text-black mt-1 rounded shadow-xl border border-gray-300 overflow-hidden max-h-52 overflow-y-auto z-[2000]">
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
                      className="px-3 py-1 bg-blue-600 text-white font-bold rounded text-[11px] hover:bg-blue-700 shadow disabled:opacity-50 cursor-pointer"
                    >
                      {isRouting ? 'Menghitung Rute...' : '🚗 Hitung Jarak Jalan &amp; Gambar di Peta'}
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
                  falloutOrders={falloutMapMarkers}
                  focusLocation={focusedOdp}
                  manualMeasureLine={manualMeasureLine}
                  manualMeasureInfo={measureResult}
                  roadRouteCoordinates={roadRouteCoordinates}
                />
              </div>
            </div>

            {/* OCCUPANCY & AVAILABLE PORT */}
            <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white px-3 py-1.5 flex justify-between items-center flex-wrap gap-1 shadow-sm">
                <span className="font-extrabold text-xs sm:text-sm tracking-wide">OCCUPANCY &amp; AVAILABLE PORT</span>
                <span className="bg-white/20 hover:bg-white/30 text-white text-[9.5px] font-semibold px-2 py-0.5 rounded-full border border-white/20 backdrop-blur-sm">
                  {selectedStoFilter !== 'ALL' ? `STO: ${selectedStoFilter}` : selectedWokFilter !== 'ALL' ? `WOK: ${selectedWokFilter}` : 'Klik STO / WOK untuk filter'}
                </span>
              </div>

              <div className="overflow-x-auto max-h-[350px] overflow-y-auto">
                <table className="w-full text-center border-collapse min-w-[500px]">
                  <thead className="bg-[#0f172a] text-white text-[9px] sm:text-[10px] sticky top-0 z-10 shadow-md cursor-pointer select-none">
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

        {/* ================= SECTION BAWAH: TABEL DETAIL RAW DATA ================= */}
        <div className="bg-white border border-gray-300 shadow-sm rounded-sm overflow-hidden mt-4">
          <div className="bg-gradient-to-r from-[#0f172a] via-[#1e293b] to-[#334155] text-white p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBottomActiveTab('ODP')}
                className={`px-3 py-1 rounded text-xs font-black transition cursor-pointer ${
                  bottomActiveTab === 'ODP'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                }`}
              >
                📋 Tabel Data ODP ({sortedBottomOdpData.length.toLocaleString()})
              </button>
              <button
                type="button"
                onClick={() => setBottomActiveTab('ORDER')}
                className={`px-3 py-1 rounded text-xs font-black transition cursor-pointer ${
                  bottomActiveTab === 'ORDER'
                    ? 'bg-purple-600 text-white shadow'
                    : 'bg-slate-700/60 text-slate-300 hover:bg-slate-700'
                }`}
              >
                📦 Tabel Data Order ({sortedBottomOrderData.length.toLocaleString()})
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
              {bottomActiveTab === 'ODP' ? (
                <>
                  <input
                    type="text"
                    placeholder="Cari ODP, STO, Desa..."
                    value={tableSearch}
                    onChange={(e) => {
                      setTableSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="px-2.5 py-1 text-black rounded text-xs outline-none w-full sm:w-44 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleExportFilteredOdpCSV}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold shadow flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
                  >
                    <span>📥</span> Terfilter ({fullyFilteredData.length.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAllOdpCSV}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold shadow flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
                  >
                    <span>📥</span> Semua ({totalOdpGlobal.toLocaleString()})
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Cari Order ID, Pelanggan, Fallout..."
                    value={orderTableSearch}
                    onChange={(e) => {
                      setOrderTableSearch(e.target.value);
                      setCurrentOrderPage(1);
                    }}
                    className="px-2.5 py-1 text-black rounded text-xs outline-none w-full sm:w-44 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleExportFilteredOrderCSV}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold shadow flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
                  >
                    <span>📥</span> Terfilter ({filteredOrders.length.toLocaleString()})
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAllOrderCSV}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-bold shadow flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
                  >
                    <span>📥</span> Semua ({ordersData.length.toLocaleString()})
                  </button>
                </>
              )}
            </div>
          </div>

          {/* TAB 1: TABEL DETAIL ODP */}
          {bottomActiveTab === 'ODP' && (
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-[10px] whitespace-nowrap">
                <thead className="bg-[#1e293b] text-white uppercase font-bold sticky top-0 z-10 shadow select-none cursor-pointer">
                  <tr>
                    <th className="p-2 border border-slate-600 text-center">No</th>
                    <th className="p-2 border border-slate-600 hover:bg-slate-700" onClick={() => requestOdpSort('odp_name')}>
                      ODP Name {odpTableSort.key === 'odp_name' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 hover:bg-slate-700" onClick={() => requestOdpSort('sto')}>
                      STO {odpTableSort.key === 'sto' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 hover:bg-slate-700" onClick={() => requestOdpSort('wok')}>
                      WOK {odpTableSort.key === 'wok' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 hover:bg-slate-700" onClick={() => requestOdpSort('kabupaten')}>
                      Kabupaten {odpTableSort.key === 'kabupaten' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 hover:bg-slate-700" onClick={() => requestOdpSort('kecamatan')}>
                      Kecamatan {odpTableSort.key === 'kecamatan' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 hover:bg-slate-700" onClick={() => requestOdpSort('desa')}>
                      Desa {odpTableSort.key === 'desa' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 text-center hover:bg-slate-700" onClick={() => requestOdpSort('status_final')}>
                      Status {odpTableSort.key === 'status_final' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 text-center hover:bg-slate-700" onClick={() => requestOdpSort('is_total')}>
                      Total Port {odpTableSort.key === 'is_total' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 text-center hover:bg-slate-700" onClick={() => requestOdpSort('used')}>
                      Used {odpTableSort.key === 'used' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 text-center hover:bg-slate-700" onClick={() => requestOdpSort('avai')}>
                      Avail {odpTableSort.key === 'avai' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 text-center hover:bg-slate-700" onClick={() => requestOdpSort('rsk')}>
                      % OCC {odpTableSort.key === 'rsk' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600 text-center hover:bg-slate-700" onClick={() => requestOdpSort('ont_rx_level')}>
                      ONT RX Level {odpTableSort.key === 'ont_rx_level' ? (odpTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-slate-600">Latitude</th>
                    <th className="p-2 border border-slate-600">Longitude</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOdpData.length === 0 ? (
                    <tr>
                      <td colSpan={15} className="p-4 text-center text-slate-400 font-bold">
                        Tidak ada data ODP yang sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedOdpData.map((row, idx) => {
                      const rowNumber = (currentPage - 1) * rowsPerPage + idx + 1;
                      const occ = row.is_total > 0 ? (row.used / row.is_total) * 100 : 0;
                      
                      let statusColor = '#111827';
                      if (row.status_final === 'RED') statusColor = '#dc2626';
                      else if (row.status_final === 'ORANGE') statusColor = '#ea580c';
                      else if (row.status_final === 'YELLOW') statusColor = '#ca8a04';
                      else if (row.status_final === 'GREEN') statusColor = '#16a34a';

                      let rxColor = '#64748b';
                      if (row.ont_rx_level !== null) {
                        if (row.ont_rx_level > -18) rxColor = '#16a34a';
                        else if (row.ont_rx_level >= -21) rxColor = '#ca8a04';
                        else if (row.ont_rx_level >= -25) rxColor = '#ea580c';
                        else rxColor = '#dc2626';
                      }

                      return (
                        <tr key={`${row.odp_name}-${idx}`} className="border-b border-slate-200 hover:bg-blue-50/60 transition">
                          <td className="p-1.5 border border-slate-200 text-center font-bold text-slate-500">{rowNumber}</td>
                          <td className="p-1.5 border border-slate-200 font-black text-blue-900">{row.odp_name}</td>
                          <td
                            className="p-1.5 border border-slate-200 font-bold cursor-pointer hover:text-blue-700 hover:underline"
                            onClick={() => setSelectedStoFilter((p) => (p === row.sto ? 'ALL' : row.sto))}
                            title="Klik untuk filter STO ini"
                          >
                            {row.sto || '-'}
                          </td>
                          <td
                            className="p-1.5 border border-slate-200 cursor-pointer hover:text-blue-700 hover:underline"
                            onClick={() => setSelectedWokFilter((p) => (p === row.wok ? 'ALL' : row.wok))}
                            title="Klik untuk filter WOK ini"
                          >
                            {row.wok || '-'}
                          </td>
                          <td
                            className="p-1.5 border border-slate-200 cursor-pointer hover:text-blue-700 hover:underline"
                            onClick={() => setSelectedKabupaten((p) => (p === row.kabupaten ? 'ALL' : row.kabupaten))}
                            title="Klik untuk filter Kabupaten ini"
                          >
                            {row.kabupaten || '-'}
                          </td>
                          <td className="p-1.5 border border-slate-200">{row.kecamatan || '-'}</td>
                          <td className="p-1.5 border border-slate-200">{row.desa || '-'}</td>
                          <td
                            className="p-1.5 border border-slate-200 text-center cursor-pointer"
                            onClick={() => setSelectedStatus((p) => (p === row.status_final ? 'ALL' : row.status_final))}
                            title="Klik untuk filter Status ini"
                          >
                            <span
                              className="px-1.5 py-0.5 rounded text-[8.5px] font-bold text-white uppercase"
                              style={{ backgroundColor: statusColor }}
                            >
                              {row.status_final}
                            </span>
                          </td>
                          <td className="p-1.5 border border-slate-200 text-center font-bold">{row.is_total || 0}</td>
                          <td className="p-1.5 border border-slate-200 text-center text-emerald-800 font-bold">{row.used || 0}</td>
                          <td className="p-1.5 border border-slate-200 text-center text-red-800 font-bold">{row.avai || 0}</td>
                          <td className="p-1.5 border border-slate-200 text-center font-extrabold">{occ.toFixed(1)}%</td>
                          <td
                            className="p-1.5 border border-slate-200 text-center font-bold cursor-pointer hover:underline"
                            style={{ color: rxColor }}
                            onClick={() => setSelectedRx((p) => (p === row.rx_category ? 'ALL' : row.rx_category))}
                            title="Klik untuk filter Kategori RX ini"
                          >
                            {row.ont_rx_level !== null ? `${Number(row.ont_rx_level).toFixed(2)} dBm` : '-'}
                          </td>
                          <td className="p-1.5 border border-slate-200 font-mono text-[9px] text-slate-500">{row.latitude || '-'}</td>
                          <td className="p-1.5 border border-slate-200 font-mono text-[9px] text-slate-500">{row.longitude || '-'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: TABEL DETAIL ORDER FULFILLMENT */}
          {bottomActiveTab === 'ORDER' && (
            <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-[10px] whitespace-nowrap">
                <thead className="bg-[#3b0764] text-white uppercase font-bold sticky top-0 z-10 shadow select-none cursor-pointer">
                  <tr>
                    <th className="p-2 border border-purple-800 text-center">No</th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('order_id')}>
                      Order ID {orderTableSort.key === 'order_id' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('process_state')}>
                      Process State {orderTableSort.key === 'process_state' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('funneling_subgroup')}>
                      Subgroup {orderTableSort.key === 'funneling_subgroup' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('name')}>
                      Nama Pelanggan {orderTableSort.key === 'name' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('no_handphone')}>
                      No HP {orderTableSort.key === 'no_handphone' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('sto_co')}>
                      STO {orderTableSort.key === 'sto_co' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('wok')}>
                      WOK {orderTableSort.key === 'wok' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('odp_name')}>
                      ODP Name {orderTableSort.key === 'odp_name' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('product_commercial_name')}>
                      Product Name {orderTableSort.key === 'product_commercial_name' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('order_duration_cat')}>
                      Duration Cat {orderTableSort.key === 'order_duration_cat' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('fallout_reason_clean')}>
                      Fallout Reason {orderTableSort.key === 'fallout_reason_clean' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('price_package')}>
                      Price {orderTableSort.key === 'price_package' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('order_ts')}>
                      Order Date {orderTableSort.key === 'order_ts' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('ps_ts')}>
                      PS Date {orderTableSort.key === 'ps_ts' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800 hover:bg-purple-800" onClick={() => requestOrderSort('sf_name')}>
                      SF Name {orderTableSort.key === 'sf_name' ? (orderTableSort.direction === 'asc' ? '↑' : '↓') : '↕'}
                    </th>
                    <th className="p-2 border border-purple-800">Alamat</th>
                    <th className="p-2 border border-purple-800">Latitude</th>
                    <th className="p-2 border border-purple-800">Longitude</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrderData.length === 0 ? (
                    <tr>
                      <td colSpan={19} className="p-4 text-center text-slate-400 font-bold">
                        Belum ada data Order yang diunggah atau tidak sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    paginatedOrderData.map((row, idx) => {
                      const rowNumber = (currentOrderPage - 1) * rowsPerPage + idx + 1;
                      const pState = (row.process_state || 'UNKNOWN').trim().toUpperCase();

                      return (
                        <tr
                          key={`${row.order_id}-${idx}`}
                          className="border-b border-slate-200 hover:bg-purple-50/60 transition"
                        >
                          <td className="p-1.5 border border-slate-200 text-center font-bold text-slate-500">{rowNumber}</td>
                          <td className="p-1.5 border border-slate-200 font-black text-purple-900">{row.order_id}</td>
                          <td className="p-1.5 border border-slate-200 font-bold text-slate-800">
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
                          <td className="p-1.5 border border-slate-200 font-bold text-slate-700">
                            {row.funneling_subgroup || '-'}
                          </td>
                          <td className="p-1.5 border border-slate-200 font-semibold">{row.name || '-'}</td>
                          <td className="p-1.5 border border-slate-200 font-mono text-[9px]">{row.no_handphone || row.no_handphone_mask || '-'}</td>
                          <td className="p-1.5 border border-slate-200 font-bold text-slate-800">{row.sto_co || '-'}</td>
                          <td className="p-1.5 border border-slate-200">{row.wok || '-'}</td>
                          <td className="p-1.5 border border-slate-200 font-bold text-blue-800">{row.odp_name || '-'}</td>
                          <td className="p-1.5 border border-slate-200">{row.product_commercial_name || '-'}</td>
                          <td className="p-1.5 border border-slate-200 font-bold text-emerald-800">{row.order_duration_cat || '-'}</td>
                          <td className="p-1.5 border border-slate-200 text-red-600 font-bold">
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
          )}

          {/* Pagination */}
          <div className="bg-slate-50 p-2.5 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-2 text-xs font-semibold">
            {bottomActiveTab === 'ODP' ? (
              <>
                <span className="text-slate-600">
                  Halaman <strong>{currentPage}</strong> dari <strong>{totalOdpPages}</strong> (Total <strong>{sortedBottomOdpData.length.toLocaleString()}</strong> ODP)
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
                  <span className="px-2 font-bold text-slate-700">{currentPage} / {totalOdpPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalOdpPages, p + 1))}
                    disabled={currentPage === totalOdpPages}
                    className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                  >
                    Next &rsaquo;
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalOdpPages)}
                    disabled={currentPage === totalPages}
                    className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                  >
                    Terakhir &raquo;
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="text-slate-600">
                  Halaman <strong>{currentOrderPage}</strong> dari <strong>{totalOrderPages}</strong> (Total <strong>{sortedBottomOrderData.length.toLocaleString()}</strong> Order)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setCurrentOrderPage(1)}
                    disabled={currentOrderPage === 1}
                    className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                  >
                    &laquo; Pertama
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentOrderPage((p) => Math.max(1, p - 1))}
                    disabled={currentOrderPage === 1}
                    className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                  >
                    &lsaquo; Prev
                  </button>
                  <span className="px-2 font-bold text-slate-700">{currentOrderPage} / {totalOrderPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentOrderPage((p) => Math.min(totalOrderPages, p + 1))}
                    disabled={currentOrderPage === totalOrderPages}
                    className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                  >
                    Next &rsaquo;
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentOrderPage(totalOrderPages)}
                    disabled={currentOrderPage === totalOrderPages}
                    className="px-2 py-1 bg-white border border-slate-300 rounded disabled:opacity-40 hover:bg-slate-100 text-xs cursor-pointer"
                  >
                    Terakhir &raquo;
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Sidebar>
  );
}
