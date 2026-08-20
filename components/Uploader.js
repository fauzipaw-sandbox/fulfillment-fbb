import React, { useState } from 'react';
import Papa from 'papaparse';

// Fungsi Cerdas Deteksi Delimiter Otomatis (| ; \t ,)
function detectDelimiter(firstLine) {
  if (!firstLine) return ',';
  const pipeCount = (firstLine.match(/\|/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;

  if (pipeCount > commaCount && pipeCount > semiCount) return '|';
  if (semiCount > commaCount && semiCount > pipeCount) return ';';
  if (tabCount > commaCount && tabCount > semiCount) return '\t';
  return ',';
}

export default function Uploader({ onUploadOdpSuccess, onUploadOrderSuccess }) {
  const [uploadingOdp, setUploadingOdp] = useState(false);
  const [uploadingOrder, setUploadingOrder] = useState(false);
  const [odpProgress, setOdpProgress] = useState('');
  const [orderProgress, setOrderProgress] = useState('');

  // 1. Upload Raw Data ODP (Auto Text to Columns)
  const handleOdpUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingOdp(true);
    setOdpProgress('Mendeteksi format file & Text-to-Columns...');

    try {
      const sampleText = await file.slice(0, 4096).text();
      const firstLine = sampleText.split('\n')[0];
      const autoDelimiter = detectDelimiter(firstLine);

      Papa.parse(file, {
        header: true,
        delimiter: autoDelimiter,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: async (results) => {
          const rows = results.data;
          if (!rows || rows.length === 0) {
            alert('File CSV kosong atau format tidak sesuai.');
            setUploadingOdp(false);
            return;
          }

          setOdpProgress(`Mengunggah ${rows.length.toLocaleString()} baris ODP ke database...`);
          const res = await fetch('/api/upload-odp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: rows }),
          });

          const json = await res.json();
          if (res.ok) {
            setOdpProgress(`✅ Berhasil mengunggah ${rows.length.toLocaleString()} data ODP!`);
            if (onUploadOdpSuccess) onUploadOdpSuccess();
          } else {
            alert('Gagal upload ODP: ' + (json.error || 'Terjadi kesalahan'));
          }
          setUploadingOdp(false);
        },
        error: (err) => {
          alert('Error parsing CSV: ' + err.message);
          setUploadingOdp(false);
        },
      });
    } catch (err) {
      alert('Error membaca file: ' + err.message);
      setUploadingOdp(false);
    }
  };

  // 2. Upload Raw Data Order (Auto Text to Columns + Upsert)
  const handleOrderUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingOrder(true);
    setOrderProgress('Mendeteksi format file & Text-to-Columns...');

    try {
      const sampleText = await file.slice(0, 4096).text();
      const firstLine = sampleText.split('\n')[0];
      const autoDelimiter = detectDelimiter(firstLine);

      Papa.parse(file, {
        header: true,
        delimiter: autoDelimiter,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: async (results) => {
          const rows = results.data;
          if (!rows || rows.length === 0) {
            alert('File CSV kosong atau format tidak sesuai.');
            setUploadingOrder(false);
            return;
          }

          setOrderProgress(`Mengunggah & menimpa duplikat ${rows.length.toLocaleString()} baris Order...`);
          const res = await fetch('/api/upload-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: rows }),
          });

          const json = await res.json();
          if (res.ok) {
            setOrderProgress(`✅ Berhasil mengunggah ${rows.length.toLocaleString()} data Order!`);
            if (onUploadOrderSuccess) onUploadOrderSuccess();
          } else {
            alert('Gagal upload Order: ' + (json.error || 'Terjadi kesalahan'));
          }
          setUploadingOrder(false);
        },
        error: (err) => {
          alert('Error parsing CSV: ' + err.message);
          setUploadingOrder(false);
        },
      });
    } catch (err) {
      alert('Error membaca file: ' + err.message);
      setUploadingOrder(false);
    }
  };

  return (
    <div className="bg-white p-3 rounded-lg border border-slate-300 shadow-sm space-y-3">
      <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">
        Upload Data Mentah (Auto Text-to-Columns & Upsert Database)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Upload ODP */}
        <div className="p-2.5 bg-blue-50/60 rounded border border-blue-200 space-y-1.5">
          <p className="font-bold text-blue-900 flex items-center justify-between">
            <span>📁 Upload File Data ODP</span>
            <span className="text-[9px] font-normal text-slate-500">Auto Pipe `|`, Comma `,`, Semicolon `;`</span>
          </p>
          <input
            type="file"
            accept=".csv"
            disabled={uploadingOdp}
            onChange={handleOdpUpload}
            className="w-full text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
          {uploadingOdp && <p className="text-[10px] text-blue-700 font-bold animate-pulse">{odpProgress}</p>}
          {!uploadingOdp && odpProgress && <p className="text-[10px] text-emerald-700 font-bold">{odpProgress}</p>}
        </div>

        {/* Upload Order */}
        <div className="p-2.5 bg-purple-50/60 rounded border border-purple-200 space-y-1.5">
          <p className="font-bold text-purple-900 flex items-center justify-between">
            <span>📦 Upload File Data Order</span>
            <span className="text-[9px] font-normal text-slate-500">Auto Timpa Duplikat ID</span>
          </p>
          <input
            type="file"
            accept=".csv"
            disabled={uploadingOrder}
            onChange={handleOrderUpload}
            className="w-full text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:font-bold file:bg-purple-600 file:text-white hover:file:bg-purple-700 cursor-pointer"
          />
          {uploadingOrder && <p className="text-[10px] text-purple-700 font-bold animate-pulse">{orderProgress}</p>}
          {!uploadingOrder && orderProgress && <p className="text-[10px] text-emerald-700 font-bold">{orderProgress}</p>}
        </div>
      </div>
    </div>
  );
}
