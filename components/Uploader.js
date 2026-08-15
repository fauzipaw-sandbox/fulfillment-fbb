import { useState } from 'react';
import Papa from 'papaparse';

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
        const formattedData = results.data.map(row => ({
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
        })).filter(item => item.odp_name);

        try {
          const res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formattedData)
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Upload failed');
          }

          alert('Data berhasil di-update ke database!');
          if (onUploadSuccess) onUploadSuccess();
        } catch (err) {
          alert('Gagal upload: ' + err.message);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <div className="p-4 bg-white rounded shadow-sm border border-gray-200 mb-4">
      <h3 className="text-xs font-bold uppercase mb-2 text-gray-700">Update Data ODP via CSV</h3>
      <input 
        type="file" 
        accept=".csv" 
        onChange={handleFileUpload} 
        disabled={loading}
        className="block w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
      />
      {loading && <p className="text-[11px] mt-2 text-blue-600 font-medium">Sedang memproses dan menyimpan ke database...</p>}
    </div>
  );
}
