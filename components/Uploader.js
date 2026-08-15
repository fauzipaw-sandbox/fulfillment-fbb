import { useState } from 'react';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase Client (Pastikan lo isi URL dan KEY di .env.local)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function Uploader({ onUploadSuccess }) {
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rawData = results.data;
        
        // Mapping data sesuai kolom Supabase
        const formattedData = rawData.map(row => ({
          odp_name: row.odp_name,
          event_date: row.event_date,
          noss_id: parseInt(row.noss_id) || null,
          witel: row.witel,
          sto: row.sto,
          longitude: parseFloat(row.longitude) || null,
          latitude: parseFloat(row.latitude) || null,
          avai: parseInt(row.avai) || 0,
          used: parseInt(row.used) || 0,
          is_total: parseInt(row.is_total) || 0,
          status_final: row.status_final,
          kabupaten: row.kabupaten,
          branch: row.branch,
          wok: row.wok
        }));

        // Insert/Update ke Supabase
        const { error } = await supabase
          .from('odp_kalimantan')
          .upsert(formattedData, { onConflict: 'odp_name' });

        if (error) {
          alert('Gagal upload: ' + error.message);
        } else {
          alert('Data berhasil di-update!');
          if(onUploadSuccess) onUploadSuccess();
        }
        setLoading(false);
      }
    });
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow-md mb-6">
      <h3 className="text-lg font-bold mb-2 text-slate-800">Update Data ODP</h3>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload} 
        disabled={loading}
        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />
      {loading && <p className="text-sm mt-2 text-blue-600">Sedang memproses dan menyimpan ke database...</p>}
    </div>
  );
}
