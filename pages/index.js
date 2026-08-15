import React, { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Uploader from '../components/Uploader';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
        setData(odpData);
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

    data.forEach(item => {
      totalPort += item.is_total || 0;
      usedPort += item.used || 0;
      avaiPort += item.avai || 0;

      const status = (item.status_final || '').toUpperCase();
      if (status.includes('BLACK')) colorCounts.BLACK += 1;
      else if (status.includes('GREEN')) colorCounts.GREEN += 1;
      else if (status.includes('YELLOW')) colorCounts.YELLOW += 1;
      else if (status.includes('ORANGE')) colorCounts.ORANGE += 1;
      else if (status.includes('RED')) colorCounts.RED += 1;

      const kab = item.kabupaten || 'UNKNOWN';
      if (!kabMap[kab]) kabMap[kab] = { name: kab, BLACK: 0, GREEN: 0, YELLOW: 0, ORANGE: 0, RED: 0 };
      if (kabMap[kab][status] !== undefined) kabMap[kab][status] += 1;

      const wok = item.wok || 'UNKNOWN';
      const sto = item.sto || 'UNKNOWN';
      if (!wokMap[wok]) wokMap[wok] = { is_total: 0, used: 0, avai: 0, stos: {} };
      if (!wokMap[wok].stos[sto]) wokMap[wok].stos[sto] = { odp_count: 0, is_total: 0, used: 0, avai: 0 };
      
      wokMap[wok].is_total += (item.is_total || 0);
      wokMap[wok].used += (item.used || 0);
      wokMap[wok].avai += (item.avai || 0);
      
      wokMap[wok].stos[sto].odp_count += 1;
      wokMap[wok].stos[sto].is_total += (item.is_total || 0);
      wokMap[wok].stos[sto].used += (item.used || 0);
      wokMap[wok].stos[sto].avai += (item.avai || 0);
    });

    return { totalPort, usedPort, avaiPort, colorCounts, chartData: Object.values(kabMap), wokMap };
  }, [data]);

  const occTotal = stats.totalPort > 0 ? ((stats.usedPort / stats.totalPort) * 100).toFixed(1) : 0;
  const avaiTotal = stats.totalPort > 0 ? ((stats.avaiPort / stats.totalPort) * 100).toFixed(1) : 0;
  const totalOdp = data.length;

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-4 text-xs font-sans text-gray-800">
      <Head>
        <title>ODP Profile & Utilization</title>
      </Head>

      <div className="max-w-[1400px] mx-auto space-y-4">
        {/* HEADER */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-4 rounded flex justify-between items-center shadow">
          <div>
            <h1 className="text-2xl font-bold italic tracking-wider">ODP PROFILE & UTILIZATION</h1>
            <p className="text-[10px] mt-1">*W20 - Cutoff Data 11 May 2026</p>
          </div>
        </div>

        {/* NARRATIVE SUMMARY */}
        <div className="bg-white px-4 py-2 rounded border-l-4 border-blue-900 shadow-sm text-sm">
          The total <strong>number of ODP</strong> in Branch Palangkaraya was <strong>{(totalOdp/1000).toFixed(1)}K</strong> ({(stats.totalPort/1000).toFixed(1)} K Port) which is Occupancy <strong>{(stats.usedPort/1000).toFixed(1)}K Port ({occTotal}%)</strong> and <strong>{(stats.avaiPort/1000).toFixed(1)}K ({avaiTotal}%)</strong> available ports for <strong>new sales.</strong>
        </div>

        {/* UPLOADER */}
        <Uploader onUploadSuccess={fetchData} />

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* KOLOM KIRI */}
          <div className="lg:col-span-6 space-y-4">
            
            {/* OVERVIEW SECTION */}
            <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-red-700 via-purple-800 to-blue-900 text-white text-center py-1 font-bold">
                OVERVIEW ODP PROFILE
              </div>
              <div className="p-4 grid grid-cols-3 gap-2 text-center items-center">
                <div className="col-span-1 space-y-2">
                  <div className="border rounded bg-gray-50 p-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">TOTAL ODP (Port)</p>
                    <p className="text-base font-bold">{totalOdp.toLocaleString()} ({(stats.totalPort/1000).toFixed(1)} K)</p>
                  </div>
                  <div className="border rounded bg-gray-50 p-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">USED PORT</p>
                    <p className="text-base font-bold">{(stats.usedPort/1000).toFixed(1)} K ({occTotal}%)</p>
                  </div>
                  <div className="border rounded bg-gray-50 p-2">
                    <p className="text-[10px] text-gray-500 font-bold uppercase">AVAI PORT</p>
                    <p className="text-base font-bold">{(stats.avaiPort/1000).toFixed(1)} K ({avaiTotal}%)</p>
                  </div>
                </div>

                <div className="col-span-1 border-2 border-gray-800 rounded p-3 mx-1">
                  <div className="bg-black text-white text-[10px] font-bold mx-auto w-max px-2 py-0.5 rounded-sm">BLACK ODP</div>
                  <p className="text-2xl font-bold mt-2">{stats.colorCounts.BLACK.toLocaleString()}</p>
                  <p className="text-xs text-gray-600 mt-1">{totalOdp > 0 ? ((stats.colorCounts.BLACK/totalOdp)*100).toFixed(1) : 0}%</p>
                  <p className="text-[10px] text-gray-500 mt-1">[Not change]</p>
                </div>

                <div className="col-span-1 grid grid-cols-2 gap-2">
                  <div>
                    <div className="bg-yellow-400 text-black text-[10px] font-bold mx-auto w-max px-1.5 py-0.5 rounded-sm">YELLOW ODP</div>
                    <p className="text-base font-bold mt-1">{stats.colorCounts.YELLOW.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600">{totalOdp > 0 ? ((stats.colorCounts.YELLOW/totalOdp)*100).toFixed(1) : 0}%</p>
                  </div>
                  <div>
                    <div className="bg-green-600 text-white text-[10px] font-bold mx-auto w-max px-1.5 py-0.5 rounded-sm">GREEN ODP</div>
                    <p className="text-base font-bold mt-1">{stats.colorCounts.GREEN.toLocaleString()}</p>
                    <p className="text-[10px] text-green-700">{totalOdp > 0 ? ((stats.colorCounts.GREEN/totalOdp)*100).toFixed(1) : 0}%</p>
                  </div>
                  <div className="mt-1">
                    <div className="bg-orange-500 text-white text-[10px] font-bold mx-auto w-max px-1.5 py-0.5 rounded-sm">ORANGE ODP</div>
                    <p className="text-base font-bold mt-1">{stats.colorCounts.ORANGE.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600">{totalOdp > 0 ? ((stats.colorCounts.ORANGE/totalOdp)*100).toFixed(1) : 0}%</p>
                  </div>
                  <div className="mt-1">
                    <div className="bg-red-600 text-white text-[10px] font-bold mx-auto w-max px-1.5 py-0.5 rounded-sm">RED ODP</div>
                    <p className="text-base font-bold mt-1">{stats.colorCounts.RED.toLocaleString()}</p>
                    <p className="text-[10px] text-red-600">{totalOdp > 0 ? ((stats.colorCounts.RED/totalOdp)*100).toFixed(1) : 0}%</p>
                  </div>
                </div>
              </div>
              <div className="flex justify-around items-center p-2 bg-gray-50 border-t text-[10px] font-bold">
                <span className="flex items-center"><div className="w-5 h-2.5 bg-black mr-1.5"></div>0%</span>
                <span className="flex items-center"><div className="w-5 h-2.5 bg-green-500 mr-1.5"></div>&lt;60%</span>
                <span className="flex items-center"><div className="w-5 h-2.5 bg-yellow-400 mr-1.5"></div>&lt;95%</span>
                <span className="flex items-center"><div className="w-5 h-2.5 bg-red-600 mr-1.5"></div>100%</span>
              </div>
            </div>

            {/* CHART SECTION */}
            <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-800 to-blue-900 text-white text-center py-1 font-bold">
                ODP SHARE KABUPATEN LEVEL
              </div>
              <div className="p-4">
                <h3 className="text-center font-bold text-gray-600 mb-2">PROFIL ODP BRANCH PALANGKARAYA</h3>
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.chartData} margin={{ top: 10, right: 20, left: -20, bottom: 25 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{fontSize: 8}} interval={0} angle={-25} textAnchor="end" />
                      <YAxis tick={{fontSize: 9}} />
                      <Tooltip />
                      <Bar dataKey="BLACK" stackId="a" fill="#1f2937" />
                      <Bar dataKey="GREEN" stackId="a" fill="#22c55e" />
                      <Bar dataKey="YELLOW" stackId="a" fill="#facc15" />
                      <Bar dataKey="ORANGE" stackId="a" fill="#f97316" />
                      <Bar dataKey="RED" stackId="a" fill="#dc2626" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* KOLOM KANAN */}
          <div className="lg:col-span-6 space-y-4">
            
            {/* OCCUPANCY TABLE */}
            <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-red-700 to-purple-800 text-white text-center py-1 font-bold">
                OCCUPANCY & AVAILABLE PORT
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] text-right border-collapse">
                  <thead className="bg-[#0b2165] text-white text-center">
                    <tr>
                      <th className="p-1 border border-gray-400">WOK</th>
                      <th className="p-1 border border-gray-400">STO</th>
                      <th className="p-1 border border-gray-400"># Odp_name</th>
                      <th className="p-1 border border-gray-400"># ls_total</th>
                      <th className="p-1 border border-gray-400"># Used</th>
                      <th className="p-1 border border-gray-400"># Avail</th>
                      <th className="p-1 border border-gray-400">% OCC</th>
                      <th className="p-1 border border-gray-400">% Avail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(stats.wokMap).map(([wokName, wokData]) => (
                      <React.Fragment key={wokName}>
                        {Object.entries(wokData.stos).map(([stoName, stoData], j) => {
                          const occPercent = stoData.is_total > 0 ? (stoData.used / stoData.is_total) * 100 : 0;
                          const avaiPercent = stoData.is_total > 0 ? (stoData.avai / stoData.is_total) * 100 : 0;
                          
                          let occColor = '';
                          if (occPercent >= 85) occColor = 'bg-red-300';
                          else if (occPercent >= 75) occColor = 'bg-orange-200';
                          else if (occPercent >= 65) occColor = 'bg-yellow-200';
                          else if (occPercent >= 60) occColor = 'bg-yellow-100';
                          else occColor = 'bg-green-200';

                          return (
                            <tr key={stoName} className="border-b hover:bg-gray-50 text-center">
                              {j === 0 && <td rowSpan={Object.keys(wokData.stos).length} className="p-1 border border-gray-300 bg-white align-middle font-medium">{wokName}</td>}
                              <td className="p-1 border border-gray-300">{stoName}</td>
                              <td className="p-1 border border-gray-300">{stoData.odp_count.toLocaleString()}</td>
                              <td className="p-1 border border-gray-300">{stoData.is_total.toLocaleString()}</td>
                              <td className="p-1 border border-gray-300">{stoData.used.toLocaleString()}</td>
                              <td className="p-1 border border-gray-300">{stoData.avai.toLocaleString()}</td>
                              <td className={`p-1 border border-gray-300 ${occColor}`}>{occPercent.toFixed(1)}%</td>
                              <td className="p-1 border border-gray-300">{avaiPercent.toFixed(1)}%</td>
                            </tr>
                          );
                        })}
                        <tr className="bg-[#4b85c5] text-white font-bold text-center">
                          <td colSpan={2} className="p-1 border border-gray-300">{wokName} Total</td>
                          <td className="p-1 border border-gray-300">
                            {Object.values(wokData.stos).reduce((a,b) => a+b.odp_count, 0).toLocaleString()}
                          </td>
                          <td className="p-1 border border-gray-300">{wokData.is_total.toLocaleString()}</td>
                          <td className="p-1 border border-gray-300">{wokData.used.toLocaleString()}</td>
                          <td className="p-1 border border-gray-300">{wokData.avai.toLocaleString()}</td>
                          <td className="p-1 border border-gray-300">{wokData.is_total > 0 ? ((wokData.used / wokData.is_total)*100).toFixed(1) : 0}%</td>
                          <td className="p-1 border border-gray-300">{wokData.is_total > 0 ? ((wokData.avai / wokData.is_total)*100).toFixed(1) : 0}%</td>
                        </tr>
                      </React.Fragment>
                    ))}
                    <tr className="bg-[#0b2165] text-white font-bold text-center">
                      <td colSpan={2} className="p-1 border border-gray-400">Grand Total</td>
                      <td className="p-1 border border-gray-400">{totalOdp.toLocaleString()}</td>
                      <td className="p-1 border border-gray-400">{stats.totalPort.toLocaleString()}</td>
                      <td className="p-1 border border-gray-400">{stats.usedPort.toLocaleString()}</td>
                      <td className="p-1 border border-gray-400">{stats.avaiPort.toLocaleString()}</td>
                      <td className="p-1 border border-gray-400">{occTotal}%</td>
                      <td className="p-1 border border-gray-400">{avaiTotal}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* MAPS LOKASI ODP */}
            <div className="bg-white rounded shadow-sm border border-gray-200 overflow-hidden">
               <div className="bg-gradient-to-r from-purple-800 to-blue-900 text-white text-center py-1 font-bold">
                 MAPS LOKASI ODP
               </div>
               <div className="h-72 w-full bg-gray-100">
                 {loading ? (
                   <div className="h-full flex items-center justify-center text-gray-500 font-medium">Memuat Peta...</div>
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
