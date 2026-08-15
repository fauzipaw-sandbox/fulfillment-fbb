import { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

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

        return {
          odp_name: row.odp_name,
          event_date: row.event_date || null,
          noss_id: parseInt(row.noss_id) || null,
          witel: row.witel || null,
          sto: row.sto || null,
          longitude: parseFloat(row.longitude) || null,
          latitude: parseFloat(row.latitude) || null,
          avai,
          used,
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
      alert(`Sukses mengunggah ${totalRecords.toLocaleString()} data!`);
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
    <div className="bg-white p-4 rounded shadow-sm border border-slate-200">
      <h3 className="text-xs font-bold uppercase mb-2 text-slate-800">Update Data ODP</h3>
      
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => fileInputRef.current.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
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
            <div className="font-bold text-blue-600">Mengunggah ({progress}%)...</div>
            <div className="w-full bg-slate-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all" style={{width: `${progress}%`}}></div></div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-bold text-slate-600">Drag & Drop file di sini, atau klik untuk memilih file</p>
            <p className="text-[10px] text-slate-400 mt-1">Mendukung format .CSV dan .XLSX</p>
          </div>
        )}
      </div>
    </div>
  );
}
