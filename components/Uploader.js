import { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const VALID_KABUPATEN = [
  'BARITO SELATAN',
  'KOTA PALANGKARAYA',
  'GUNUNG MAS',
  'BARITO UTARA',
  'BARITO TIMUR',
  'KAPUAS',
  'KATINGAN',
  'PULANG PISAU',
  'MURUNG RAYA',
];

const STO_WOK_MAP = {
  AMP: 'BARITO - KAPUAS',
  BNT: 'BARITO - KAPUAS',
  KKP: 'BARITO - KAPUAS',
  MTW: 'BARITO - KAPUAS',
  PPS: 'BARITO - KAPUAS',
  PRC: 'BARITO - KAPUAS',
  TML: 'BARITO - KAPUAS',
  KKN: 'PALANGKARAYA',
  KRI: 'PALANGKARAYA',
  KSO: 'PALANGKARAYA',
  PLK: 'PALANGKARAYA',
  PYM: 'PALANGKARAYA',
};

function extractSto(odpName, existingSto) {
  if (existingSto && String(existingSto).trim() !== '' && String(existingSto).toUpperCase() !== 'UNKNOWN') {
    return String(existingSto).trim().toUpperCase();
  }
  if (!odpName) return 'UNKNOWN';
  const match = String(odpName).match(/ODP-([A-Z0-9]{3})/i);
  return match && match[1] ? match[1].toUpperCase() : 'UNKNOWN';
}

function extractWok(existingWok, sto) {
  if (existingWok && String(existingWok).trim() !== '' && String(existingWok).toUpperCase() !== 'UNKNOWN') {
    return String(existingWok).trim().toUpperCase();
  }
  if (sto && STO_WOK_MAP[sto.toUpperCase()]) {
    return STO_WOK_MAP[sto.toUpperCase()];
  }
  return 'PALANGKARAYA';
}

function parseCleanFloat(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export default function Uploader({ onUploadSuccess, rawData = [] }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // Modal State Delete
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const processData = async (rawDataInput) => {
    setLoading(true);
    setProgress(0);

    const formattedData = rawDataInput
      .filter((row) => {
        if (!row.odp_name) return false;
        // Poin 4: Format OTB- diabaikan
        return !String(row.odp_name).trim().toUpperCase().startsWith('OTB-');
      })
      .map((row) => {
        const isTotal = parseInt(row.is_total) || 0;
        const used = parseInt(row.used) || 0;
        const avai = parseInt(row.avai) || Math.max(0, isTotal - used);

        const rsk = isTotal > 0 ? used / isTotal : 0;
        let statusFinal = 'BLACK';
        if (rsk === 0) statusFinal = 'BLACK';
        else if (rsk > 0 && rsk <= 0.6) statusFinal = 'GREEN';
        else if (rsk > 0.6 && rsk <= 0.85) statusFinal = 'YELLOW';
        else if (rsk > 0.85 && rsk < 0.99) statusFinal = 'ORANGE';
        else if (rsk >= 0.99) statusFinal = 'RED';

        const finalSto = extractSto(row.odp_name, row.sto);
        const finalWok = extractWok(row.wok, finalSto);

        let rawKab = (row.kabupaten || '').trim().toUpperCase();
        let finalKab = VALID_KABUPATEN.includes(rawKab) ? rawKab : 'LAINNYA';

        const rxVal = parseCleanFloat(row.ont_rx_level);

        return {
          event_date: row.event_date ? String(row.event_date) : null,
          noss_id: parseInt(row.noss_id) || null,
          odp_name: row.odp_name ? String(row.odp_name).trim() : null,
          odp_index: row.odp_index ? String(row.odp_index) : null,
          witel: row.witel ? String(row.witel) : 'KALTIMTARA',
          datel: row.datel ? String(row.datel) : null,
          sto: finalSto,
          sto_desc: row.sto_desc ? String(row.sto_desc) : null,
          longitude: parseCleanFloat(row.longitude),
          latitude: parseCleanFloat(row.latitude),
          avai: avai,
          used: used,
          rsv: parseInt(row.rsv) || 0,
          rsk: parseCleanFloat(row.rsk) || rsk,
          is_total: isTotal,
          status: row.status ? String(row.status) : null,
          status_final: statusFinal,
          regional: row.regional ? String(row.regional) : null,
          id_desa: row.id_desa ? String(row.id_desa) : null,
          desa: row.desa ? String(row.desa) : null,
          id_kec: row.id_kec ? String(row.id_kec) : null,
          kecamatan: row.kecamatan ? String(row.kecamatan) : null,
          id_kab: row.id_kab ? String(row.id_kab) : null,
          kabupaten: finalKab,
          distance: parseCleanFloat(row.distance),
          osrm_distance: parseCleanFloat(row.osrm_distance),
          no_speedy_ct0: row.no_speedy_ct0 ? String(row.no_speedy_ct0) : null,
          branch: row.branch ? String(row.branch) : 'PALANGKARAYA',
          wok: finalWok,
          nop: row.nop ? String(row.nop) : null,
          olt: row.olt ? String(row.olt) : null,
          last_update_valins: row.last_update_valins ? String(row.last_update_valins) : null,
          valins_at: row.valins_at ? String(row.valins_at) : null,
          ont_rx_level: rxVal,
        };
      });

    const totalRecords = formattedData.length;
    if (totalRecords === 0) {
      alert('Tidak ada baris data valid yang diimpor.');
      setLoading(false);
      return;
    }

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

        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        successCount += chunk.length;
        setProgress(Math.round((successCount / totalRecords) * 100));
      }
      alert(`Sukses mengunggah ${totalRecords.toLocaleString()} data ODP ke Database!`);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      alert('Gagal upload: ' + err.message);
    } finally {
      setLoading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processData(results.data),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        processData(json);
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Format tidak didukung! Gunakan .csv atau .xlsx');
    }
  };

  // Export Raw Data ke CSV
  const handleExportCSV = () => {
    if (!rawData || rawData.length === 0) {
      alert('Tidak ada data untuk di-export.');
      return;
    }
    const csv = Papa.unparse(rawData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `raw_odp_data_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Hapus Semua Data Database
  const handleDeleteAll = async () => {
    const inputUpper = confirmInput.trim().toUpperCase();
    if (inputUpper !== 'HAPUS' && inputUpper !== 'DELETE') {
      alert('Ketik kata "HAPUS" atau "DELETE" untuk mengonfirmasi!');
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch('/api/clear-db', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      alert('Semua isi tabel Database berhasil dikosongkan.');
      setShowDeleteModal(false);
      setConfirmInput('');
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      alert('Gagal mengosongkan database: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white p-3 sm:p-4 rounded shadow-sm border border-slate-200 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
        <h3 className="text-xs font-bold uppercase text-slate-800">Panel Manajemen Data ODP</h3>
        
        <div className="flex items-center gap-2">
          {/* Tombol Export Raw Data */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-600 text-white rounded text-[11px] font-bold shadow flex items-center gap-1 transition"
          >
            <span>📥</span> Export Raw CSV ({rawData.length.toLocaleString()})
          </button>

          {/* Tombol Hapus Database */}
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-2.5 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-[11px] font-bold shadow flex items-center gap-1 transition"
          >
            <span>🗑️</span> Hapus Semua Data
          </button>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileInputRef.current.click()}
        className={`border-2 border-dashed rounded-lg p-5 sm:p-6 text-center cursor-pointer transition-colors ${
          isDragging ? 'border-blue-500 bg-blue-50' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'
        }`}
      >
        <input
          type="file"
          accept=".csv, .xlsx, .xls"
          onChange={(e) => handleFile(e.target.files[0])}
          ref={fileInputRef}
          className="hidden"
        />
        {loading ? (
          <div className="space-y-2">
            <div className="font-bold text-blue-600 text-xs sm:text-sm">Menyimpan Data ({progress}%)...</div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs sm:text-sm font-bold text-slate-700">Drag & Drop file di sini, atau klik untuk memilih file</p>
            <p className="text-[10px] text-slate-400 mt-1">Mendukung format .CSV dan .XLSX (Data OTB- otomatis diabaikan)</p>
          </div>
        )}
      </div>

      {/* Modal Konfirmasi Hapus Data */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-red-200 max-w-md w-full p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <span className="text-2xl">⚠️</span>
              <h4 className="text-sm font-black uppercase tracking-wider">Konfirmasi Hapus Semua Data</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan <strong>menghapus permanen seluruh baris data ODP</strong> di database untuk kebutuhan perbaikan data.
            </p>
            <div className="bg-red-50 p-2.5 rounded border border-red-200 text-[11px] text-red-800">
              Ketik kata <strong className="font-mono bg-red-100 px-1 py-0.5 rounded text-red-900">HAPUS</strong> atau <strong className="font-mono bg-red-100 px-1 py-0.5 rounded text-red-900">DELETE</strong> di bawah ini untuk melanjutkan:
            </div>
            <input
              type="text"
              placeholder="Ketik HAPUS atau DELETE"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded text-xs font-bold outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmInput('');
                }}
                disabled={deleting}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-bold transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={deleting || (confirmInput.trim().toUpperCase() !== 'HAPUS' && confirmInput.trim().toUpperCase() !== 'DELETE')}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded text-xs font-bold shadow transition"
              >
                {deleting ? 'Menghapus...' : 'Hapus Sekarang'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
