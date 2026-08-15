import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Uploader from '../components/Uploader';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Panggil Map secara dinamis agar tidak error saat SSR di Next.js
const MapComponent = dynamic(() => import('../components/Map'), { ssr: false });

export default function Dashboard() {
  const [data, setData] = useState([]);

  const fetchData = async () => {
    const { data: odpData, error } = await supabase
      .from('odp_kalimantan')
      .select('*');
    if (!error) setData(odpData);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* Header Tanpa Logo Spesifik */}
      <div className="bg-blue-900 text-white p-6 rounded-t-xl flex justify-between items-center shadow-lg">
        <div>
          <h1 className="text-3xl font-bold">ODP PROFILE & UTILIZATION</h1>
          <p className="text-sm opacity-80">Dashboard Area Kalimantan</p>
        </div>
      </div>

      <div className="mt-6">
        {/* Fitur Upload File */}
        <Uploader onUploadSuccess={fetchData} />

        {/* Grid Layout mirip desain */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Kolom Kiri: Overview & Bar Chart */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-indigo-700">
              <h2 className="text-xl font-bold text-center text-indigo-900 mb-4">OVERVIEW ODP PROFILE</h2>
              {/* Tempat naro KPI Cards (Total, Used, Avai, Green/Red/Yellow) */}
              <div className="grid grid-cols-2 gap-4 text-center">
                 <div className="p-4 border rounded">
                   <p className="text-gray-500 text-sm">TOTAL ODP (Port)</p>
                   <p className="text-2xl font-bold">{data.reduce((acc, curr) => acc + curr.is_total, 0).toLocaleString()}</p>
                 </div>
                 <div className="p-4 border rounded border-red-500">
                   <p className="text-gray-500 text-sm">RED ODP</p>
                   <p className="text-2xl font-bold text-red-600">
                     {data.filter(d => d.status_final === 'RED').length}
                   </p>
                 </div>
                 {/* Tambahin card lain di sini */}
              </div>
            </div>

            {/* Tempat naro Recharts Bar Chart ODP Share */}
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-indigo-700">
               <h2 className="text-xl font-bold text-center text-indigo-900 mb-4">ODP SHARE KABUPATEN LEVEL</h2>
               <div className="h-64 flex items-center justify-center bg-gray-50 border border-dashed text-gray-400">
                 [Recharts Bar Chart Component Di Sini]
               </div>
            </div>
          </div>

          {/* Kolom Kanan: Tabel & Maps */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-red-700">
              <h2 className="text-xl font-bold text-center text-red-900 mb-4">OCCUPANCY & AVAILABLE PORT</h2>
              {/* Tempat naro Tabel WOK / STO */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-indigo-900 text-white">
                    <tr>
                      <th className="px-4 py-2">WOK</th>
                      <th className="px-4 py-2">STO</th>
                      <th className="px-4 py-2">TOTAL</th>
                      <th className="px-4 py-2">USED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Looping data tabel grouping di sini */}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Peta Lokasi ODP */}
            <div className="bg-white p-6 rounded-lg shadow-md border-t-4 border-blue-500">
              <h2 className="text-xl font-bold text-center text-blue-900 mb-4">MAPS LOKASI ODP</h2>
              <div className="h-72 rounded overflow-hidden">
                <MapComponent data={data} />
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
