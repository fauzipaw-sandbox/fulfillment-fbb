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

export default function Dashboard() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/odp');
      if (res.ok) {
        const odpData = await res.json();
        setData(odpData || []);
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

  // Aggregation Logic
  const stats = useMemo(() => {
    let totalPort = 0;
    let usedPort = 0;
    let avaiPort = 0;

    let colorCounts = {
      BLACK: 0,
      GREEN: 0,
      YELLOW: 0,
      ORANGE: 0,
      RED: 0,
    };

    const kabMap = {};
    const wokMap = {};
    const deployMap = {};

    data.forEach((item) => {
      const isTotal = item.is_total || 0;
      const used = item.used || 0;
      const avai = item.avai || 0;

      totalPort += isTotal;
      usedPort += used;
      avaiPort += avai;

      // Status Color Matching
      const rawStatus = (item.status_final || '').toUpperCase();
      let matchedStatus = 'BLACK';
      if (rawStatus.includes('RED')) matchedStatus = 'RED';
      else if (rawStatus.includes('ORANGE')) matchedStatus = 'ORANGE';
      else if (rawStatus.includes('YELLOW')) matchedStatus = 'YELLOW';
      else if (rawStatus.includes('GREEN')) matchedStatus = 'GREEN';

      colorCounts[matchedStatus] += 1;

      // Grouping Kabupaten for 100% Stacked Bar Chart
      const kab = item.kabupaten || 'LAINNYA';
      if (!kabMap[kab]) {
        kabMap[kab] = {
          name: kab,
          BLACK: 0,
          GREEN: 0,
          YELLOW: 0,
          ORANGE: 0,
          RED: 0,
          total: 0,
        };
      }
      kabMap[kab][matchedStatus] += 1;
      kabMap[kab].total += 1;

      // Grouping WOK -> STO for Occupancy Table
      const wok = item.wok || 'UNKNOWN';
      const sto = item.sto || 'UNKNOWN';

      if (!wokMap[wok]) {
        wokMap[wok] = { is_total: 0, used: 0, avai: 0, stos: {} };
      }
      if (!wokMap[wok].stos[sto]) {
        wokMap[wok].stos[sto] = { odp_count: 0, is_total: 0, used: 0, avai: 0 };
      }

      wokMap[wok].is_total += isTotal;
      wokMap[wok].used += used;
      wokMap[wok].avai += avai;

      wokMap[wok].stos[sto].odp_count += 1;
      wokMap[wok].stos[sto].is_total += isTotal;
      wokMap[wok].stos[sto].used += used;
      wokMap[wok].stos[sto].avai += avai;

      // Golive Deployment by Month (from event_date if available)
      if (item.event_date) {
        const monthNum = new Date(item.event_date).getMonth(); // 0: Jan, 1: Feb, ...
        if (!deployMap[wok]) deployMap[wok] = { Jan: 0, Feb: 0, Mar: 0, Apr: 0, May: 0, Total: 0 };
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
        if (monthNum >= 0 && monthNum <= 4) {
          deployMap[wok][months[monthNum]] += 1;
          deployMap[wok].Total += 1;
        }
      }
    });

    // Normalize chart data to 100% percentages
    const chartData = Object.values(kabMap).map((k) => {
      const tot = k.total || 1;
      return {
        name: k.name,
        BLACK: parseFloat(((k.BLACK / tot) * 100).toFixed(1)),
        GREEN: parseFloat(((k.GREEN / tot) * 100).toFixed(1)),
        YELLOW: parseFloat(((k.YELLOW / tot) * 100).toFixed(1)),
        ORANGE: parseFloat(((k.ORANGE / tot) * 100).toFixed(1)),
        RED: parseFloat(((k.RED / tot) * 100).toFixed(1)),
      };
    });

    return {
      totalPort,
      usedPort,
      avaiPort,
      colorCounts,
      chartData,
      wokMap,
      deployMap,
    };
  }, [data]);

  const totalOdp = data.length;
  const occTotal = stats.totalPort > 0 ? ((stats.usedPort / stats.totalPort) * 100).toFixed(1) : '0.0';
  const avaiTotal = stats.totalPort > 0 ? ((stats.avaiPort / stats.totalPort) * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen bg-[#eceff4] p-3 text-slate-800 font-sans text-xs">
      <Head>
        <title>ODP Profile & Utilization</title>
      </Head>

      <div className="max-w-[1500px] mx-auto space-y-3">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-[#0d1b4c] via-[#102a71] to-[#1e3a8a] text-white px-6 py-3 rounded shadow-md flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-black tracking-wider uppercase font-sans">
              ODP PROFILE & UTILIZATION
            </h1>
            <p className="text-[10px] text-blue-200 tracking-wide font-medium mt-0.5">
              *Cutoff Data Terkini Dashboard
            </p>
          </div>
        </div>

        {/* NARRATIVE EXECUTIVE SUMMARY */}
        <div className="bg-white px-4 py-2.5 rounded shadow-sm border-l-[6px] border-[#0d1b4c] text-[13px] leading-relaxed text-slate-700">
          The total <strong className="text-slate-900">number of ODP</strong> in Branch Palangkaraya was{' '}
          <strong className="text-slate-900">{(totalOdp / 1000).toFixed(1)}K</strong> (
          {(stats.totalPort / 1000).toFixed(1)} K Port) which is Occupancy{' '}
          <strong className="text-slate-900">
            {(stats.usedPort / 1000).toFixed(1)}K Port ({occTotal}%)
          </strong>{' '}
          and{' '}
          <strong className="text-slate-900">
            {(stats.avaiPort / 1000).toFixed(1)}K ({avaiTotal}%)
          </strong>{' '}
          available ports for <strong className="text-slate-900">new sales.</strong>
        </div>

        {/* CSV UPLOADER */}
        <Uploader onUploadSuccess={fetchData} />

        {/* MAIN DASHBOARD GRID */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
          {/* LEFT COLUMN: OVERVIEW & BAR CHART */}
          <div className="xl:col-span-6 space-y-3">
            {/* OVERVIEW SECTION */}
            <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#8b1528] via-[#581c87] to-[#0d1b4c] text-white text-center py-1.5 font-bold uppercase tracking-wider text-[11px]">
                OVERVIEW ODP PROFILE
              </div>

              <div className="p-3 grid grid-cols-12 gap-2 items-center text-center">
                {/* Port Summary Cards */}
                <div className="col-span-4 space-y-2">
                  <div className="border border-slate-200 rounded p-2 bg-[#f8fafc]">
                    <p className="text-[9px] text-slate-500 font-bold uppercase">TOTAL ODP (Port)</p>
                    <p className="text-base font-extrabold text-slate-900 mt-0.5">
                      {totalOdp.toLocaleString()}{' '}
                      <span className="text-xs font-bold text-slate-600">
                        ({(stats.totalPort / 1000).toFixed(1)} K)
                      </span>
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded p-2 bg-[#f8fafc]">
                    <p className="text-[9px] text-slate-500 font-bold uppercase">USED PORT</p>
                    <p className="text-base font-extrabold text-slate-900 mt-0.5">
                      {(stats.usedPort / 1000).toFixed(1)} K{' '}
                      <span className="text-xs font-bold text-slate-600">({occTotal}%)</span>
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded p-2 bg-[#f8fafc]">
                    <p className="text-[9px] text-slate-500 font-bold uppercase">AVAI PORT</p>
                    <p className="text-base font-extrabold text-slate-900 mt-0.5">
                      {(stats.avaiPort / 1000).toFixed(1)} K{' '}
                      <span className="text-xs font-bold text-slate-600">({avaiTotal}%)</span>
                    </p>
                  </div>
                </div>

                {/* BLACK ODP Box */}
                <div className="col-span-4 border-2 border-slate-800 rounded-lg p-3 bg-white shadow-inner">
                  <div className="bg-black text-white text-[9px] font-bold px-2 py-0.5 rounded mx-auto w-fit">
                    BLACK ODP
                  </div>
                  <p className="text-3xl font-black text-slate-900 mt-2">
                    {stats.colorCounts.BLACK.toLocaleString()}
                  </p>
                  <p className="text-xs font-bold text-slate-600 mt-0.5">
                    {totalOdp > 0 ? ((stats.colorCounts.BLACK / totalOdp) * 100).toFixed(1) : 0}%
                  </p>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">[Not change]</p>
                </div>

                {/* Colored ODP Grid */}
                <div className="col-span-4 grid grid-cols-2 gap-2">
                  <div className="bg-slate-50 border border-slate-200 rounded p-1.5">
                    <div className="bg-[#facc15] text-slate-900 text-[8px] font-bold px-1 py-0.5 rounded">
                      YELLOW ODP
                    </div>
                    <p className="text-base font-extrabold text-slate-900 mt-1">
                      {stats.colorCounts.YELLOW.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-slate-600">
                      {totalOdp > 0 ? ((stats.colorCounts.YELLOW / totalOdp) * 100).toFixed(1) : 0}%
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded p-1.5">
                    <div className="bg-[#15803d] text-white text-[8px] font-bold px-1 py-0.5 rounded">
                      GREEN ODP
                    </div>
                    <p className="text-base font-extrabold text-slate-900 mt-1">
                      {stats.colorCounts.GREEN.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-700">
                      {totalOdp > 0 ? ((stats.colorCounts.GREEN / totalOdp) * 100).toFixed(1) : 0}%
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded p-1.5">
                    <div className="bg-[#ea580c] text-white text-[8px] font-bold px-1 py-0.5 rounded">
                      ORANGE ODP
                    </div>
                    <p className="text-base font-extrabold text-slate-900 mt-1">
                      {stats.colorCounts.ORANGE.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-slate-600">
                      {totalOdp > 0 ? ((stats.colorCounts.ORANGE / totalOdp) * 100).toFixed(1) : 0}%
                    </p>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded p-1.5">
                    <div className="bg-[#dc2626] text-white text-[8px] font-bold px-1 py-0.5 rounded">
                      RED ODP
                    </div>
                    <p className="text-base font-extrabold text-slate-900 mt-1">
                      {stats.colorCounts.RED.toLocaleString()}
                    </p>
                    <p className="text-[10px] font-bold text-red-600">
                      {totalOdp > 0 ? ((stats.colorCounts.RED / totalOdp) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                </div>
              </div>

              {/* Legend Indicator */}
              <div className="grid grid-cols-4 border-t border-slate-200 bg-[#f8fafc] py-1.5 text-center text-[10px] font-bold text-slate-700">
                <div className="flex items-center justify-center space-x-1.5">
                  <span className="w-5 h-2.5 bg-black rounded-sm inline-block"></span>
                  <span>0%</span>
                </div>
                <div className="flex items-center justify-center space-x-1.5">
                  <span className="w-5 h-2.5 bg-[#16a34a] rounded-sm inline-block"></span>
                  <span>&lt;60%</span>
                </div>
                <div className="flex items-center justify-center space-x-1.5">
                  <span className="w-5 h-2.5 bg-[#facc15] rounded-sm inline-block"></span>
                  <span>&lt;95%</span>
                </div>
                <div className="flex items-center justify-center space-x-1.5">
                  <span className="w-5 h-2.5 bg-[#dc2626] rounded-sm inline-block"></span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* STACKED BAR CHART SECTION */}
            <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#581c87] via-[#2e1065] to-[#0d1b4c] text-white text-center py-1.5 font-bold uppercase tracking-wider text-[11px]">
                ODP SHARE KABUPATEN LEVEL
              </div>
              <div className="p-3">
                <h4 className="text-center font-bold text-slate-600 text-xs mb-2">
                  PROFIL ODP BRANCH PALANGKARAYA
                </h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={stats.chartData}
                      margin={{ top: 10, right: 10, left: -25, bottom: 35 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 8, fill: '#475569' }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 9, fill: '#475569' }} domain={[0, 100]} unit="%" />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Bar dataKey="BLACK" stackId="a" fill="#111827" />
                      <Bar dataKey="GREEN" stackId="a" fill="#22c55e" />
                      <Bar dataKey="YELLOW" stackId="a" fill="#fde047" />
                      <Bar dataKey="ORANGE" stackId="a" fill="#fb923c" />
                      <Bar dataKey="RED" stackId="a" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: OCCUPANCY TABLE, GOLIVE TABLE, & MAPS */}
          <div className="xl:col-span-6 space-y-3">
            {/* OCCUPANCY & AVAILABLE PORT TABLE */}
            <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#8b1528] via-[#581c87] to-[#0d1b4c] text-white text-center py-1.5 font-bold uppercase tracking-wider text-[11px]">
                OCCUPANCY & AVAILABLE PORT
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-center border-collapse">
                  <thead className="bg-[#0b2165] text-white uppercase text-[9px]">
                    <tr>
                      <th className="p-1 border border-slate-400">WOK</th>
                      <th className="p-1 border border-slate-400">STO</th>
                      <th className="p-1 border border-slate-400"># Odp_name</th>
                      <th className="p-1 border border-slate-400"># Is_total</th>
                      <th className="p-1 border border-slate-400"># Used</th>
                      <th className="p-1 border border-slate-400"># Avail</th>
                      <th className="p-1 border border-slate-400">% OCC</th>
                      <th className="p-1 border border-slate-400">% Avail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.wokMap).map(([wokName, wokData]) => (
                      <React.Fragment key={wokName}>
                        {Object.entries(wokData.stos).map(([stoName, stoData], j) => {
                          const occPercent =
                            stoData.is_total > 0 ? (stoData.used / stoData.is_total) * 100 : 0;
                          const avaiPercent =
                            stoData.is_total > 0 ? (stoData.avai / stoData.is_total) * 100 : 0;

                          let occBg = 'bg-[#86efac] text-emerald-950 font-semibold'; // Green
                          if (occPercent >= 85) occBg = 'bg-[#f87171] text-red-950 font-semibold'; // Red
                          else if (occPercent >= 75) occBg = 'bg-[#fed7aa] text-orange-950 font-semibold'; // Orange
                          else if (occPercent >= 65) occBg = 'bg-[#fef08a] text-yellow-950 font-semibold'; // Yellow

                          return (
                            <tr key={stoName} className="hover:bg-slate-50 border-b border-slate-200">
                              {j === 0 && (
                                <td
                                  rowSpan={Object.keys(wokData.stos).length}
                                  className="p-1 border border-slate-300 bg-white font-bold align-middle text-slate-800 text-[9px]"
                                >
                                  {wokName}
                                </td>
                              )}
                              <td className="p-1 border border-slate-300 font-medium">{stoName}</td>
                              <td className="p-1 border border-slate-300">{stoData.odp_count.toLocaleString()}</td>
                              <td className="p-1 border border-slate-300">{stoData.is_total.toLocaleString()}</td>
                              <td className="p-1 border border-slate-300">{stoData.used.toLocaleString()}</td>
                              <td className="p-1 border border-slate-300">{stoData.avai.toLocaleString()}</td>
                              <td className={`p-1 border border-slate-300 ${occBg}`}>
                                {occPercent.toFixed(1)}%
                              </td>
                              <td className="p-1 border border-slate-300">{avaiPercent.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                        {/* WOK Subtotal Row */}
                        <tr className="bg-[#3b82f6] text-white font-bold text-center">
                          <td colSpan={2} className="p-1 border border-blue-400 text-[9px]">
                            {wokName} Total
                          </td>
                          <td className="p-1 border border-blue-400">
                            {Object.values(wokData.stos)
                              .reduce((a, b) => a + b.odp_count, 0)
                              .toLocaleString()}
                          </td>
                          <td className="p-1 border border-blue-400">{wokData.is_total.toLocaleString()}</td>
                          <td className="p-1 border border-blue-400">{wokData.used.toLocaleString()}</td>
                          <td className="p-1 border border-blue-400">{wokData.avai.toLocaleString()}</td>
                          <td className="p-1 border border-blue-400">
                            {wokData.is_total > 0
                              ? ((wokData.used / wokData.is_total) * 100).toFixed(1)
                              : 0}
                            %
                          </td>
                          <td className="p-1 border border-blue-400">
                            {wokData.is_total > 0
                              ? ((wokData.avai / wokData.is_total) * 100).toFixed(1)
                              : 0}
                            %
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                    {/* Grand Total Row */}
                    <tr className="bg-[#0b2165] text-white font-extrabold text-center">
                      <td colSpan={2} className="p-1 border border-slate-500 uppercase text-[9px]">
                        Grand Total
                      </td>
                      <td className="p-1 border border-slate-500">{totalOdp.toLocaleString()}</td>
                      <td className="p-1 border border-slate-500">{stats.totalPort.toLocaleString()}</td>
                      <td className="p-1 border border-slate-500">{stats.usedPort.toLocaleString()}</td>
                      <td className="p-1 border border-slate-500">{stats.avaiPort.toLocaleString()}</td>
                      <td className="p-1 border border-slate-500">{occTotal}%</td>
                      <td className="p-1 border border-slate-500">{avaiTotal}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* GOLIVE NEW DEPLOYMENT TABLE */}
            <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#8b1528] via-[#581c87] to-[#0d1b4c] text-white text-center py-1.5 font-bold uppercase tracking-wider text-[11px]">
                GOLIVE NEW DEPLOYMENT 2026
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-center border-collapse">
                  <thead className="bg-[#0b2165] text-white uppercase text-[9px]">
                    <tr>
                      <th className="p-1 border border-slate-400 text-left pl-3">BRANCH - WOK</th>
                      <th className="p-1 border border-slate-400">Jan</th>
                      <th className="p-1 border border-slate-400">Feb</th>
                      <th className="p-1 border border-slate-400">Mar</th>
                      <th className="p-1 border border-slate-400">Apr</th>
                      <th className="p-1 border border-slate-400">May</th>
                      <th className="p-1 border border-slate-400">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-blue-100 font-bold text-slate-900 border-b border-slate-200">
                      <td className="p-1 border border-slate-300 text-left pl-3">PALANGKARAYA</td>
                      <td className="p-1 border border-slate-300">0</td>
                      <td className="p-1 border border-slate-300">22</td>
                      <td className="p-1 border border-slate-300">62</td>
                      <td className="p-1 border border-slate-300">33</td>
                      <td className="p-1 border border-slate-300">17</td>
                      <td className="p-1 border border-slate-300">152</td>
                    </tr>
                    <tr className="hover:bg-slate-50 border-b border-slate-200">
                      <td className="p-1 border border-slate-300 text-left pl-3">BARITO - KAPUAS</td>
                      <td className="p-1 border border-slate-300">0</td>
                      <td className="p-1 border border-slate-300">5</td>
                      <td className="p-1 border border-slate-300">31</td>
                      <td className="p-1 border border-slate-300">10</td>
                      <td className="p-1 border border-slate-300">2</td>
                      <td className="p-1 border border-slate-300">48</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-1 border border-slate-300 text-left pl-3">PALANGKARAYA</td>
                      <td className="p-1 border border-slate-300">0</td>
                      <td className="p-1 border border-slate-300">17</td>
                      <td className="p-1 border border-slate-300">31</td>
                      <td className="p-1 border border-slate-300">23</td>
                      <td className="p-1 border border-slate-300">33</td>
                      <td className="p-1 border border-slate-300">104</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* MAPS LOKASI ODP */}
            <div className="bg-white rounded shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-gradient-to-r from-[#0d1b4c] via-[#102a71] to-[#1e3a8a] text-white text-center py-1.5 font-bold uppercase tracking-wider text-[11px]">
                MAPS LOKASI ODP
              </div>
              <div className="h-64 w-full bg-slate-100 p-1">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-slate-500 font-medium">
                    Memuat Peta ODP...
                  </div>
                ) : (
                  <MapComponent data={data} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
