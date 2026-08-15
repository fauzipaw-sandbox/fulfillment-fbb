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

export default function Uploader({ onUploadSuccess }) {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const processData = async (rawData) => {
    setLoading(true);
    setProgress(0);

    const formattedData = rawData
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
      })
      .filter((item) => item.odp_name);

    const totalRecords = formattedData.length;
    if (totalRecords === 0) {
      alert('Tidak ada baris data valid.');
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
      alert(`Sukses mengunggah ${totalRecords.toLocaleString()} data ke Supabase!`);
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

  return (
    <div className="bg-white p-3 sm:p-4 rounded shadow-sm border border-slate-200">
      <h3 className="text-xs font-bold uppercase mb-2 text-slate-800">Upload / Update Data ODP</h3>
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
            <div className="font-bold text-blue-600 text-xs sm:text-sm">Menyimpan Semua Kolom ({progress}%)...</div>
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
            <p className="text-[10px] text-slate-400 mt-1">Mendukung format .CSV dan .XLSX (Semua 34 Kolom Terpetakan)</p>
          </div>
        )}
      </div>
    </div>
  );
}
