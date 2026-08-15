import { useState } from 'react';
import Papa from 'papaparse';

export default function Uploader({ onUploadSuccess }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    setProgress(0);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const formattedData = results.data
          .map((row) => ({
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
            wok: row.wok,
          }))
          .filter((item) => item.odp_name);

        const totalRecords = formattedData.length;
        if (totalRecords === 0) {
          alert('Tidak ada data valid yang ditemukan pada CSV.');
          setLoading(false);
          return;
        }

        // Pecah data per 500 baris (chunk/batch)
        const BATCH_SIZE = 500;
        let successCount = 0;

        try {
          for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
            const chunk = formattedData.slice(i, i + BATCH_SIZE);

            const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(chunk),
            });

            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || `HTTP Error ${res.status}`);
            }

            successCount += chunk.length;
            setProgress(Math.round((successCount / totalRecords) * 100));
          }

          alert(`Sukses mengunggah ${totalRecords.toLocaleString()} data ODP ke database!`);
          if (onUploadSuccess) onUploadSuccess();
        } catch (err) {
          alert('Gagal upload: ' + err.message);
        } finally {
          setLoading(false);
          setProgress(0);
        }
      },
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

      {loading && (
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-blue-600 font-medium mb-1">
            <span>Mengunggah data ke Supabase...</span>
            <span>{progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 transition-all duration-200"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}
