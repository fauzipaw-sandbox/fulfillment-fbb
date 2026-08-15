import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Uploader from '../components/Uploader';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
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

  const stats = useMemo(() => {
    let totalPort = 0, usedPort = 0, avaiPort = 0;
    let colorCounts = { BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
    const kabMap = {};
    const wokMap = {};

    data.forEach((item) => {
      const isTotal = item.is_total || 0;
      const used = item.used || 0;
      const avai = item.avai || 0;

      totalPort += isTotal;
      usedPort += used;
      avaiPort += avai;

      const rawStatus = (item.status_final || '').toUpperCase();
      let matchedStatus = 'BLACK';
      if (rawStatus.includes('RED')) matchedStatus = 'RED';
      else if (rawStatus.includes('ORANGE')) matchedStatus = 'ORANGE';
      else if (rawStatus.includes('YELLOW')) matchedStatus = 'YELLOW';
      else if (rawStatus.includes('GREEN')) matchedStatus = 'GREEN';

      colorCounts[matchedStatus] += 1;

      const kab = item.kabupaten || 'LAINNYA';
      if (!kabMap[kab]) kabMap[kab] = { name: kab, BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0, total: 0 };
      kabMap[kab][matchedStatus] += 1;
      kabMap[kab].total += 1;

      const wok = item.wok || 'UNKNOWN';
      const sto = item.sto || 'UNKNOWN';
      if (!wokMap[wok]) wokMap[wok] = { is_total: 0, used: 0, avai: 0, stos: {} };
      if (!wokMap[wok].stos[sto]) wokMap[wok].stos[sto] = { odp_count: 0, is_total: 0, used: 0, avai: 0 };

      wokMap[wok].is_total += isTotal;
      wokMap[wok].used += used;
      wokMap[wok].avai += avai;
      wokMap[wok].stos[sto].odp_count += 1;
      wokMap[wok].stos[sto].is_total += isTotal;
      wokMap[wok].stos[sto].used += used;
      wokMap[wok].stos[sto].avai += avai;
    });

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

    return { totalPort, usedPort, avaiPort, colorCounts, chartData, wokMap };
  }, [data]);

  const totalOdp = data.length;
  const occTotal = stats.totalPort > 0 ? ((stats.usedPort / stats.totalPort) * 100).toFixed(1) : '0.0';
  const avaiTotal = stats.totalPort > 0 ? ((stats.avaiPort / stats.totalPort) * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen p-4 text-gray-800 font-sans text-xs">
      <Head><title>ODP Profile & Utilization</title></Head>
      
      <div className="max-w-[1300px] mx-auto space-y-4">
        {/* HEADER UTAMA */}
        <div className="bg-gradient-to-r from-[#211c47] to-[#3a3575] text-white p-4 flex justify-between items-center border-b-4 border-purple-500">
          <div>
            <h1 className="text-3xl font-extrabold tracking-wide uppercase italic">ODP PROFILE & UTILIZATION</h1>
            <p className="text-xs font-semibold mt-1 opacity-90">*W20 - Cutoff Data 11 May 2026</p>
          </div>
          {/* Logo Telkomsel dihapus sesuai instruksi */}
        </div>

        {/* NARRATIVE TEXT */}
        <div className="bg-white px-4 py-2 text-[13px] border border-gray-200">
          The total <strong className="font-extrabold">number of ODP</strong> in Branch Palangkaraya was <strong className="font-extrabold">{(totalOdp / 1000).toFixed(1)}K</strong> ({(stats.totalPort / 1000).toFixed(1)} K Port) which is Occupancy <strong className="font-extrabold">{(stats.usedPort / 1000).toFixed(1)}K Port ({occTotal}%)</strong> and <strong className="font-extrabold">{(stats.avaiPort / 1000).toFixed(1)}K ({avaiTotal}%)</strong> available ports for <strong className="font-extrabold">new sales.</strong>
        </div>

        <Uploader onUploadSuccess={fetchData} />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          
          {/* ================= KOLOM KIRI ================= */}
          <div className="space-y-4">
            
            {/* OVERVIEW ODP PROFILE */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-sm tracking-wide">
                OVERVIEW ODP PROFILE
              </div>
              <div className="p-3 grid grid-cols-3 gap-3 text-center">
                
                {/* PORT STATS */}
                <div className="col-span-1 space-y-3">
                  <div className="border border-gray-200 bg-gray-50/50 p-2 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-600 mb-1">TOTAL ODP (Port)</p>
                    <p className="text-xl font-black">{totalOdp.toLocaleString()} <span className="text-sm font-bold">({(stats.totalPort / 1000).toFixed(1)} K)</span></p>
                  </div>
                  <div className="border border-gray-200 bg-gray-50/50 p-2 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-600 mb-1">USED PORT</p>
                    <p className="text-xl font-black">{(stats.usedPort / 1000).toFixed(1)} K <span className="text-sm font-bold">({occTotal}%)</span></p>
                  </div>
                  <div className="border border-gray-200 bg-gray-50/50 p-2 shadow-sm">
                    <p className="text-[10px] font-bold text-gray-600 mb-1">AVAI PORT</p>
                    <p className="text-xl font-black">{(stats.avaiPort / 1000).toFixed(1)} K <span className="text-sm font-bold">({avaiTotal}%)</span></p>
                  </div>
                </div>

                {/* BLACK ODP */}
                <div className="col-span-1 border border-gray-400 p-2 shadow-inner flex flex-col justify-center bg-white relative">
                  <div className="bg-black text-white text-[10px] font-bold px-3 py-0.5 w-max mx-auto border border-gray-400 absolute -top-2 left-0 right-0">BLACK ODP</div>
                  <p className="text-4xl font-black mt-4">{stats.colorCounts.BLACK.toLocaleString()}</p>
                  <p className="text-sm font-bold mt-1">{totalOdp > 0 ? ((stats.colorCounts.BLACK / totalOdp) * 100).toFixed(1) : 0}%</p>
                  <p className="text-[10px] text-gray-500 font-bold mt-2">[Not change]</p>
                </div>

                {/* COLOR ODP */}
                <div className="col-span-1 grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <div className="bg-[#facc15] text-black text-[10px] font-bold px-1 py-0.5">YELLOW ODP</div>
                    <p className="text-xl font-black mt-1">{stats.colorCounts.YELLOW.toLocaleString()}</p>
                    <p className="text-xs font-bold">{totalOdp > 0 ? ((stats.colorCounts.YELLOW / totalOdp) * 100).toFixed(1) : 0}%</p>
                  </div>
                  <div className="text-center">
                    <div className="bg-[#16a34a] text-white text-[10px] font-bold px-1 py-0.5">GREEN ODP</div>
                    <p className="text-xl font-black mt-1">{stats.colorCounts.GREEN.toLocaleString()}</p>
                    <p className="text-xs font-bold text-green-600">{totalOdp > 0 ? ((stats.colorCounts.GREEN / totalOdp) * 100).toFixed(1) : 0}%</p>
                  </div>
                  <div className="text-center mt-3">
                    <div className="bg-[#ea580c] text-white text-[10px] font-bold px-1 py-0.5">ORANGE ODP</div>
                    <p className="text-xl font-black mt-1">{stats.colorCounts.ORANGE.toLocaleString()}</p>
                    <p className="text-xs font-bold">{totalOdp > 0 ? ((stats.colorCounts.ORANGE / totalOdp) * 100).toFixed(1) : 0}%</p>
                  </div>
                  <div className="text-center mt-3">
                    <div className="bg-[#ef4444] text-white text-[10px] font-bold px-1 py-0.5">RED ODP</div>
                    <p className="text-xl font-black mt-1">{stats.colorCounts.RED.toLocaleString()}</p>
                    <p className="text-xs font-bold text-red-600">{totalOdp > 0 ? ((stats.colorCounts.RED / totalOdp) * 100).toFixed(1) : 0}%</p>
                  </div>
                </div>
              </div>
              
              {/* LEGEND BAWAH */}
              <div className="flex justify-around items-center bg-gray-100/80 py-2 border-t border-gray-200 text-[11px] font-bold">
                <span className="flex items-center"><div className="w-8 h-3 bg-black mr-2"></div>0%</span>
                <span className="flex items-center"><div className="w-8 h-3 bg-[#16a34a] mr-2"></div>&lt;60%</span>
                <span className="flex items-center"><div className="w-8 h-3 bg-[#facc15] mr-2"></div>&lt;95%</span>
                <span className="flex items-center"><div className="w-8 h-3 bg-[#ef4444] mr-2"></div>100%</span>
              </div>
            </div>

            {/* ODP SHARE KABUPATEN */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="bg-gradient-to-r from-[#4c1d95] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-sm tracking-wide">
                ODP SHARE KABUPATEN LEVEL
              </div>
              <div className="p-4 pt-6">
                <h4 className="text-center font-bold text-gray-500 mb-2">PROFIL ODP BRANCH PALANGKARAYA</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData} margin={{ top: 5, right: 0, left: -25, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 'bold' }} interval={0} angle={-25} textAnchor="end" />
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
                <div className="flex justify-center items-center space-x-4 mt-2 text-[10px] font-bold text-gray-500">
                   <span className="flex items-center"><div className="w-3 h-3 bg-black mr-1"></div>BLACK</span>
                   <span className="flex items-center"><div className="w-3 h-3 bg-[#16a34a] mr-1"></div>GREEN</span>
                   <span className="flex items-center"><div className="w-3 h-3 bg-[#facc15] mr-1"></div>YELLOW</span>
                   <span className="flex items-center"><div className="w-3 h-3 bg-[#ea580c] mr-1"></div>ORANGE</span>
                   <span className="flex items-center"><div className="w-3 h-3 bg-[#ef4444] mr-1"></div>RED</span>
                </div>
              </div>
            </div>
          </div>

          {/* ================= KOLOM KANAN ================= */}
          <div className="space-y-4">
            
            {/* OCCUPANCY TABLE */}
            <div className="bg-white border border-gray-300 shadow-sm">
              <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-sm tracking-wide">
                OCCUPANCY & AVAILABLE PORT
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center border-collapse">
                  <thead className="bg-[#0f172a] text-white text-[10px]">
                    <tr>
                      <th className="p-1.5 border border-gray-400">WOK</th>
                      <th className="p-1.5 border border-gray-400">STO</th>
                      <th className="p-1.5 border border-gray-400"># Odp_name</th>
                      <th className="p-1.5 border border-gray-400"># ls_total</th>
                      <th className="p-1.5 border border-gray-400"># Used</th>
                      <th className="p-1.5 border border-gray-400"># Avail</th>
                      <th className="p-1.5 border border-gray-400">% OCC</th>
                      <th className="p-1.5 border border-gray-400">% Avail</th>
                    </tr>
                  </thead>
                  <tbody className="text-[10px]">
                    {Object.entries(stats.wokMap).map(([wokName, wokData]) => (
                      <React.Fragment key={wokName}>
                        {Object.entries(wokData.stos).map(([stoName, stoData], j) => {
                          const occPercent = stoData.is_total > 0 ? (stoData.used / stoData.is_total) * 100 : 0;
                          const avaiPercent = stoData.is_total > 0 ? (stoData.avai / stoData.is_total) * 100 : 0;

                          let occBg = 'bg-[#86efac] text-green-900'; // Hijau
                          if (occPercent >= 85) occBg = 'bg-[#fca5a5] text-red-900'; // Merah
                          else if (occPercent >= 75) occBg = 'bg-[#fdba74] text-orange-900'; // Orange
                          else if (occPercent >= 65) occBg = 'bg-[#fde047] text-yellow-900'; // Kuning

                          return (
                            <tr key={stoName} className="border-b border-gray-300 bg-white">
                              {j === 0 && (
                                <td rowSpan={Object.keys(wokData.stos).length} className="p-1 border border-gray-300 align-middle font-bold text-gray-600">{wokName}</td>
                              )}
                              <td className="p-1 border border-gray-300 font-bold text-gray-700">{stoName}</td>
                              <td className="p-1 border border-gray-300 text-gray-600">{stoData.odp_count.toLocaleString()}</td>
                              <td className="p-1 border border-gray-300 text-gray-600">{stoData.is_total.toLocaleString()}</td>
                              <td className="p-1 border border-gray-300 text-gray-600">{stoData.used.toLocaleString()}</td>
                              <td className="p-1 border border-gray-300 text-gray-600">{stoData.avai.toLocaleString()}</td>
                              <td className={`p-1 border border-gray-300 font-bold ${occBg}`}>{occPercent.toFixed(1)}%</td>
                              <td className="p-1 border border-gray-300 font-bold bg-gray-100 text-gray-600">{avaiPercent.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                        {/* WOK Subtotal */}
                        <tr className="bg-[#3b82f6] text-white font-bold">
                          <td colSpan={2} className="p-1.5 border border-blue-700">{wokName} Total</td>
                          <td className="p-1.5 border border-blue-700">{Object.values(wokData.stos).reduce((a, b) => a + b.odp_count, 0).toLocaleString()}</td>
                          <td className="p-1.5 border border-blue-700">{wokData.is_total.toLocaleString()}</td>
                          <td className="p-1.5 border border-blue-700">{wokData.used.toLocaleString()}</td>
                          <td className="p-1.5 border border-blue-700">{wokData.avai.toLocaleString()}</td>
                          <td className="p-1.5 border border-blue-700">{wokData.is_total > 0 ? ((wokData.used / wokData.is_total) * 100).toFixed(1) : 0}%</td>
                          <td className="p-1.5 border border-blue-700">{wokData.is_total > 0 ? ((wokData.avai / wokData.is_total) * 100).toFixed(1) : 0}%</td>
                        </tr>
                      </React.Fragment>
                    ))}
                    {/* Grand Total */}
                    <tr className="bg-[#1e3a8a] text-white font-black text-[11px]">
                      <td colSpan={2} className="p-2 border border-blue-900">Grand Total</td>
                      <td className="p-2 border border-blue-900">{totalOdp.toLocaleString()}</td>
                      <td className="p-2 border border-blue-900">{stats.totalPort.toLocaleString()}</td>
                      <td className="p-2 border border-blue-900">{stats.usedPort.toLocaleString()}</td>
                      <td className="p-2 border border-blue-900">{stats.avaiPort.toLocaleString()}</td>
                      <td className="p-2 border border-blue-900">{occTotal}%</td>
                      <td className="p-2 border border-blue-900">{avaiTotal}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* MAPS & GOLIVE */}
            <div className="grid grid-cols-2 gap-4">
               {/* GOLIVE NEW DEPLOYMENT */}
              <div className="bg-white border border-gray-300 shadow-sm col-span-2">
                <div className="bg-gradient-to-r from-[#b91c1c] via-[#6d28d9] to-[#1e3a8a] text-white text-center py-1.5 font-bold text-sm tracking-wide">
                  GOLIVE NEW DEPLOYMENT 2026
                </div>
                <table className="w-full text-center border-collapse text-[10px]">
                  <thead className="bg-[#0f172a] text-white">
                    <tr>
                      <th className="p-1.5 border border-gray-400">BRANCH - WOK</th>
                      <th className="p-1.5 border border-gray-400">Jan</th><th className="p-1.5 border border-gray-400">Feb</th>
                      <th className="p-1.5 border border-gray-400">Mar</th><th className="p-1.5 border border-gray-400">Apr</th>
                      <th className="p-1.5 border border-gray-400">May</th><th className="p-1.5 border border-gray-400">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody className="font-bold text-gray-700">
                    <tr className="bg-[#bfdbfe] border-b border-gray-300">
                      <td className="p-1.5 border border-gray-300 text-left pl-4 text-[#1e3a8a]">PALANGKARAYA</td>
                      <td className="p-1.5 border border-gray-300">0</td><td className="p-1.5 border border-gray-300">22</td>
                      <td className="p-1.5 border border-gray-300">62</td><td className="p-1.5 border border-gray-300">33</td>
                      <td className="p-1.5 border border-gray-300">17</td><td className="p-1.5 border border-gray-300 text-[#1e3a8a]">152</td>
                    </tr>
                    <tr className="bg-white border-b border-gray-300">
                      <td className="p-1.5 border border-gray-300 text-left pl-4 font-normal">BARITO - KAPUAS</td>
                      <td className="p-1.5 border border-gray-300">0</td><td className="p-1.5 border border-gray-300">5</td>
                      <td className="p-1.5 border border-gray-300">31</td><td className="p-1.5 border border-gray-300">10</td>
                      <td className="p-1.5 border border-gray-300">2</td><td className="p-1.5 border border-gray-300">48</td>
                    </tr>
                    <tr className="bg-white">
                      <td className="p-1.5 border border-gray-300 text-left pl-4 font-normal">PALANGKARAYA</td>
                      <td className="p-1.5 border border-gray-300">0</td><td className="p-1.5 border border-gray-300">17</td>
                      <td className="p-1.5 border border-gray-300">31</td><td className="p-1.5 border border-gray-300">23</td>
                      <td className="p-1.5 border border-gray-300">33</td><td className="p-1.5 border border-gray-300">104</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* MAPS */}
              <div className="bg-white border border-gray-300 shadow-sm col-span-2">
                <div className="bg-gradient-to-r from-[#1e3a8a] to-[#3a3575] text-white text-center py-1.5 font-bold text-sm tracking-wide">
                  MAPS LOKASI ODP
                </div>
                <div className="h-60 p-1 bg-gray-100">
                  {loading ? <div className="flex h-full items-center justify-center font-bold text-gray-400">Loading Peta...</div> : <MapComponent data={data} />}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
