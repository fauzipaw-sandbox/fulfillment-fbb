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
        // Format dan kalkulasi otomatis per baris data
        const formattedData = results.data
          .map((row) => {
            const isTotal = parseInt(row.is_total) || 0;
            const used = parseInt(row.used) || 0;
            const avai = parseInt(row.avai) || Math.max(0, isTotal - used);

            // 1. Hitung rasio okupansi (rsk = OCC)
            const rsk = isTotal > 0 ? used / isTotal : 0;

            // 2. Formula Status Warna:
            // =IF(rsk=0,"BLACK",IF(AND(rsk>0,rsk<0.6),"GREEN",IF(AND(rsk>0.6,rsk<0.85),"YELLOW",IF(AND(rsk>0.85,rsk<0.99),"ORANGE","RED"))))
            let statusFinal = 'BLACK';
            if (rsk === 0) {
              statusFinal = 'BLACK';
            } else if (rsk < 0.6) {
              statusFinal = 'GREEN';
            } else if (rsk < 0.85) {
              statusFinal = 'YELLOW';
            } else if (rsk < 0.99) {
              statusFinal = 'ORANGE';
            } else {
              statusFinal = 'RED';
            }

            return {
              odp_name: row.odp_name,
              event_date: row.event_date || null,
              noss_id: parseInt(row.noss_id) || null,
              witel: row.witel || null,
              sto: row.sto || null,
              longitude: parseFloat(row.longitude) || null,
              latitude: parseFloat(row.latitude) || null,
              avai: avai,
              used: used,
              is_total: isTotal,
              status_final: statusFinal,
              kabupaten: row.kabupaten || null,
              branch: row.branch || null,
              wok: row.wok || null,
            };
          })
          .filter((item) => item.odp_name);

        const totalRecords = formattedData.length;
        if (totalRecords === 0) {
          alert('Tidak ada baris data ODP yang valid pada file CSV.');
          setLoading(false);
          return;
        }

        // Kirim data secara bertahap (batching 500 baris) ke backend API
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
          e.target.value = ''; // Reset file input
        }
      },
    });
  };

  return (
    <div className="bg-white p-3.5 rounded shadow-sm border border-slate-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
          Update Data ODP via CSV
        </h3>
        {loading && (
          <span className="text-[11px] font-semibold text-blue-600 animate-pulse">
            Mengunggah ({progress}%)...
          </span>
        )}
      </div>

      <input
        type="file"
        accept=".csv"
        onChange={handleFileUpload}
        disabled={loading}
        className="block w-full text-xs text-slate-500 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      />

      {loading && (
        <div className="mt-3 space-y-1">
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div
              className="bg-blue-600 h-2 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-[10px] text-slate-500 text-right">
            Menyimpan data secara bertahap ke Supabase...
          </p>
        </div>
      )}
    </div>
  );
}
