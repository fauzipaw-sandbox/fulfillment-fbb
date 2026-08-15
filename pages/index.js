import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Uploader from '../components/Uploader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MapComponent = dynamic(() => import('../components/Map'), { ssr: false });
const getWeekNumber = (dateString) => { ... }; // (Sama seperti kode sebelumnya)
const formatDate = (dateString) => { ... }; // (Sama seperti kode sebelumnya)

// Copy kembali fungsi Helper tanggal dari kode sebelumnya kesini (formatDate & getWeekNumber)
const formatDateHelper = (dateString) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d)) return '-';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const getWeekNumberHelper = (dateString) => {
  if (!dateString) return 'Unknown';
  const d = new Date(dateString);
  if (isNaN(d)) return 'Unknown';
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return `W${Math.ceil((((d - yearStart) / 86400000) + 1) / 7)}`;
};

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState('ALL');
  const [sortConfig, setSortConfig] = useState({ key: 'occ', direction: 'desc' });
  
  // NEW: State untuk klik Status & Search Maps
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

          return { ...item, is_total: isTotal, used, avai, rsk, status_final: status, week: getWeekNumberHelper(item.event_date) };
        });
        setData(enrichedData);
      }
    } catch (err) {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const availableWeeks = useMemo(() => [...new Set(data.map(d => d.week).filter(w => w !== 'Unknown'))].sort(), [data]);
  
  // Data Filtered by WEEK (Untuk Overview Card agar jumlah total tidak berubah saat di klik)
  const weekFilteredData = useMemo(() => selectedWeek === 'ALL' ? data : data.filter(d => d.week === selectedWeek), [data, selectedWeek]);
  
  // Data Filtered by STATUS (Untuk Chart, Tabel, dan Maps)
  const fullyFilteredData = useMemo(() => selectedStatus === 'ALL' ? weekFilteredData : weekFilteredData.filter(d => d.status_final === selectedStatus), [weekFilteredData, selectedStatus]);

  // Statistik Overview (Tetap menghitung semua status di minggu tersebut)
  const statsOverview = useMemo(() => {
    let totalPort = 0, usedPort = 0, avaiPort = 0;
    let colorCounts = { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    weekFilteredData.forEach(item => {
      totalPort += item.is_total; usedPort += item.used; avaiPort += item.avai;
      if (colorCounts[item.status_final] !== undefined) colorCounts[item.status_final] += 1;
    });
    return { totalPort, usedPort, avaiPort, colorCounts };
  }, [weekFilteredData]);

  // Statistik Tabel & Chart (Mengikuti filter klik status)
  const statsFiltered = useMemo(() => {
    const kabMap = {}; const flatStosMap = {};
    fullyFilteredData.forEach(item => {
      const kab = item.kabupaten || 'LAINNYA';
      if (!kabMap[kab]) kabMap[kab] = { name: kab, BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0, total: 0 };
      kabMap[kab][item.status_final] += 1; kabMap[kab].total += 1;

      const wok = item.wok || 'UNKNOWN', sto = item.sto || 'UNKNOWN', key = `${wok}_${sto}`;
      if (!flatStosMap[key]) flatStosMap[key] = { wok, sto, odp_count: 0, is_total: 0, used: 0, avai: 0 };
      flatStosMap[key].odp_count += 1; flatStosMap[key].is_total += item.is_total; flatStosMap[key].used += item.used; flatStosMap[key].avai += item.avai;
    });

    const chartData = Object.values(kabMap).map(k => ({
      name: k.name, BLACK: parseFloat(((k.BLACK / (k.total || 1)) * 100).toFixed(1)), GREEN: parseFloat(((k.GREEN / (k.total || 1)) * 100).toFixed(1)),
      YELLOW: parseFloat(((k.YELLOW / (k.total || 1)) * 100).toFixed(1)), ORANGE: parseFloat(((k.ORANGE / (k.total || 1)) * 100).toFixed(1)), RED: parseFloat(((k.RED / (k.total || 1)) * 100).toFixed(1))
    }));

    let flatStos = Object.values(flatStosMap).map(row => ({ ...row, occ: row.is_total > 0 ? (row.used / row.is_total) * 100 : 0, avai_perc: row.is_total > 0 ? (row.avai / row.is_total) * 100 : 0 }));
    return { chartData, flatStos };
  }, [fullyFilteredData]);

  const sortedTableData = useMemo(() => {
    let sortableItems = [...statsFiltered.flatStos];
    if (sortConfig) sortableItems.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [statsFiltered.flatStos, sortConfig]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (val.length >= 3) {
      const lower = val.toLowerCase();
      const suggs = fullyFilteredData.filter(d => 
        (d.odp_name && d.odp_name.toLowerCase().includes(lower)) ||
        (d.kabupaten && d.kabupaten.toLowerCase().includes(lower)) ||
        (d.sto && d.sto.toLowerCase().includes(lower))
      ).slice(0, 5);
      setSuggestions(suggs);
    } else setSuggestions([]);
  };

  const handleStatusClick = (status) => setSelectedStatus(prev => prev === status ? 'ALL' : status);

  const totalOdp = weekFilteredData.length;
  const occTotal = statsOverview.totalPort > 0 ? ((statsOverview.usedPort / statsOverview.totalPort) * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen p-4 text-gray-800 font-sans text-xs">
      <Head><title>ODP Profile & Utilization</title></Head>
      <div className="max-w-[1300px] mx-auto space-y-4">
        
        {/* HEADER */}
        <div className="bg-gradient-to-r from-[#211c47] to-[#3a3575] text-white p-4 flex flex-col md:flex-row justify-between items-center border-b-4 border-purple-500 rounded-t-lg shadow">
          <h1 className="text-3xl font-extrabold italic">ODP PROFILE & UTILIZATION</h1>
          <select className="text-gray-900 px-3 py-1 font-bold rounded" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
            <option value="ALL">ALL WEEKS</option>
            {availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <Uploader onUploadSuccess={fetchData} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* KOLOM KIRI */}
          <div className="space-y-4">
            
            {/* OVERVIEW (INTERAKTIF) */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-sm tracking-wide">OVERVIEW ODP PROFILE <span className="text-[10px] font-normal">(Klik box untuk filter)</span></div>
              <div className="p-3 grid grid-cols-3 gap-3 text-center">
                <div className="col-span-1 space-y-2">
                  <div className="border bg-gray-50 p-2"><p className="text-[10px] font-bold">TOTAL ODP</p><p className="text-xl font-black">{totalOdp}</p></div>
                  <div className="border bg-gray-50 p-2"><p className="text-[10px] font-bold">USED PORT</p><p className="text-xl font-black">{occTotal}%</p></div>
                </div>

                <div onClick={() => handleStatusClick('BLACK')} className={`col-span-1 border p-2 cursor-pointer transition-transform hover:scale-105 ${selectedStatus === 'BLACK' ? 'ring-4 ring-black shadow-lg bg-gray-100' : 'bg-white'}`}>
                  <div className="bg-black text-white text-[10px] font-bold px-3 py-0.5 w-max mx-auto">BLACK ODP</div>
                  <p className="text-4xl font-black mt-4">{statsOverview.colorCounts.BLACK}</p>
                </div>

                <div className="col-span-1 grid grid-cols-2 gap-2">
                  <div onClick={() => handleStatusClick('YELLOW')} className={`cursor-pointer transition-transform hover:scale-105 ${selectedStatus === 'YELLOW' ? 'ring-2 ring-yellow-500 shadow bg-yellow-50' : ''}`}><div className="bg-[#facc15] text-black text-[9px] font-bold">YELLOW</div><p className="text-lg font-black mt-1">{statsOverview.colorCounts.YELLOW}</p></div>
                  <div onClick={() => handleStatusClick('GREEN')} className={`cursor-pointer transition-transform hover:scale-105 ${selectedStatus === 'GREEN' ? 'ring-2 ring-green-500 shadow bg-green-50' : ''}`}><div className="bg-[#16a34a] text-white text-[9px] font-bold">GREEN</div><p className="text-lg font-black mt-1">{statsOverview.colorCounts.GREEN}</p></div>
                  <div onClick={() => handleStatusClick('ORANGE')} className={`mt-2 cursor-pointer transition-transform hover:scale-105 ${selectedStatus === 'ORANGE' ? 'ring-2 ring-orange-500 shadow bg-orange-50' : ''}`}><div className="bg-[#ea580c] text-white text-[9px] font-bold">ORANGE</div><p className="text-lg font-black mt-1">{statsOverview.colorCounts.ORANGE}</p></div>
                  <div onClick={() => handleStatusClick('RED')} className={`mt-2 cursor-pointer transition-transform hover:scale-105 ${selectedStatus === 'RED' ? 'ring-2 ring-red-500 shadow bg-red-50' : ''}`}><div className="bg-[#ef4444] text-white text-[9px] font-bold">RED</div><p className="text-lg font-black mt-1">{statsOverview.colorCounts.RED}</p></div>
                </div>
              </div>
              <div className="flex justify-around items-center bg-gray-100 py-2 border-t font-bold text-[10px]">
                <span><span className="inline-block w-4 h-2 bg-black mr-1"></span>0%</span>
                <span><span className="inline-block w-4 h-2 bg-[#16a34a] mr-1"></span>&lt;60%</span>
                <span><span className="inline-block w-4 h-2 bg-[#facc15] mr-1"></span>&lt;85%</span>
                <span><span className="inline-block w-4 h-2 bg-[#ea580c] mr-1"></span>&lt;99%</span>
                <span><span className="inline-block w-4 h-2 bg-[#ef4444] mr-1"></span>Red = 100%</span>
              </div>
            </div>

            {/* CHART */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="bg-gradient-to-r from-[#4c1d95] to-[#1e3a8a] text-white text-center py-1.5 font-bold">ODP SHARE KABUPATEN</div>
              <div className="h-64 p-2"><ResponsiveContainer><BarChart data={statsFiltered.chartData}><XAxis dataKey="name" tick={{fontSize: 8}}/><YAxis/><Tooltip/><Bar dataKey="BLACK" stackId="a" fill="#000"/><Bar dataKey="GREEN" stackId="a" fill="#16a34a"/><Bar dataKey="YELLOW" stackId="a" fill="#facc15"/><Bar dataKey="ORANGE" stackId="a" fill="#ea580c"/><Bar dataKey="RED" stackId="a" fill="#ef4444"/></BarChart></ResponsiveContainer></div>
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="space-y-4">
            
            {/* TABLE */}
            <div className="bg-white border border-gray-300 shadow-sm max-h-[300px] overflow-auto">
              <table className="w-full text-center">
                <thead className="bg-[#0f172a] text-white sticky top-0"><tr className="text-[9px]">
                  <th className="p-1">WOK</th><th className="p-1">STO</th><th className="p-1">ODP</th><th className="p-1">% OCC</th>
                </tr></thead>
                <tbody>
                  {sortedTableData.map((r, i) => (
                    <tr key={i} className="border-b"><td className="p-1 font-bold">{r.wok}</td><td className="p-1">{r.sto}</td><td className="p-1">{r.odp_count}</td><td className="p-1 font-bold">{r.occ.toFixed(1)}%</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* MAPS WITH SEARCH */}
            <div className="bg-white border border-gray-300 shadow-sm relative col-span-2">
              <div className="bg-gradient-to-r from-[#1e3a8a] to-[#3a3575] text-white p-1.5 flex justify-between items-center relative">
                <span className="font-bold text-sm ml-2">MAPS LOKASI ODP</span>
                
                {/* SEARCH BAR */}
                <div className="relative w-64 z-[9999]">
                  <input type="text" placeholder="Cari ODP, STO, Kab..." value={searchTerm} onChange={handleSearchChange} className="w-full px-2 py-1 text-black rounded text-xs outline-none" />
                  {suggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full bg-white text-black mt-1 rounded shadow-xl border border-gray-300">
                      {suggestions.map((s, i) => (
                        <div key={i} onClick={() => { setFocusedOdp(s); setSuggestions([]); setSearchTerm(s.odp_name); }} className="p-2 border-b hover:bg-blue-100 cursor-pointer text-[10px]">
                          <strong>{s.odp_name}</strong> - {s.kabupaten} ({s.status_final})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="h-[350px] p-1 bg-gray-100">
                {loading ? <div>Loading...</div> : <MapComponent data={fullyFilteredData} focusLocation={focusedOdp} />}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
