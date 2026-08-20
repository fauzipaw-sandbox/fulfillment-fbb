import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

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

function normalizeOrderKeys(row) {
  const normalized = {};
  for (const [k, v] of Object.entries(row)) {
    const cleanKey = k.trim().toLowerCase().replace(/[\s\-\/\.]+/g, '_');
    normalized[cleanKey] = v;
  }

  const orderId = normalized.order_id || normalized.orderid || normalized.order_no || normalized.id;
  if (!orderId) return null;

  // Handle LongLat string format "lon, lat" or "lat, lon"
  let lat = normalized.latitude || normalized.lat;
  let lon = normalized.longitude || normalized.lon || normalized.long;

  if ((!lat || !lon) && normalized.longlat) {
    const parts = String(normalized.longlat).split(',').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      if (parts[0] > 90) {
        lon = parts[0];
        lat = parts[1];
      } else {
        lat = parts[0];
        lon = parts[1];
      }
    }
  }

  return {
    order_id: String(orderId).trim(),
    new_order_id: normalized.new_order_id || null,
    process_state: normalized.process_state || normalized.order_status || 'FALLOUT',
    funneling_subgroup: normalized.funneling_subgroup || normalized.subgroup || 'FALLOUT',
    name: normalized.name || normalized.customer_name || normalized.nama_pelanggan || null,
    no_handphone: normalized.no_handphone || normalized.no_hp || normalized.telepon || null,
    sto_co: normalized.sto_co || normalized.sto || null,
    wok: normalized.wok || null,
    odp_name: normalized.odp_name || normalized.odp || null,
    product_commercial_name: normalized.product_commercial_name || normalized.product_name || null,
    order_duration_cat: normalized.order_duration_cat || normalized.aging_fallout || '3 HARI',
    fallout_category: normalized.fallout_category || null,
    fallout_reason: normalized.fallout_reason || normalized.remark || null,
    symptom: normalized.symptom || null,
    category_hk: normalized.category_hk || null,
    status_hk: normalized.status_hk || null,
    tanggal_hk: normalized.tanggal_hk || null,
    pic_dept: normalized.pic_dept || null,
    remark: normalized.remark || null,
    price_package: normalized.price_package || normalized.price || null,
    order_ts: normalized.order_ts || normalized.order_date || normalized.provi || null,
    ps_ts: normalized.ps_ts || normalized.ps_date || null,
    sf_name: normalized.sf_name || null,
    address: normalized.address || normalized.alamat || null,
    latitude: lat ? parseFloat(lat) : null,
    longitude: lon ? parseFloat(lon) : null,
  };
}

export default function Uploader({ onUploadOdpSuccess, onUploadOrderSuccess }) {
  const [uploadingOdp, setUploadingOdp] = useState(false);
  const [uploadingOrder, setUploadingOrder] = useState(false);
  const [odpProgress, setOdpProgress] = useState('');
  const [orderProgress, setOrderProgress] = useState('');
  const [isDragOverOdp, setIsDragOverOdp] = useState(false);
  const [isDragOverOrder, setIsDragOverOrder] = useState(false);

  const processOdpFile = async (file) => {
    if (!file) return;
    setUploadingOdp(true);
    setOdpProgress('Membaca file ODP...');

    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: null });
        await sendOdpData(rows);
      } else {
        const sampleText = await file.slice(0, 4096).text();
        const firstLine = sampleText.split('\n')[0];
        const autoDelimiter = detectDelimiter(firstLine);

        Papa.parse(file, {
          header: true,
          delimiter: autoDelimiter,
          skipEmptyLines: true,
          complete: async (results) => {
            await sendOdpData(results.data);
          },
          error: (err) => {
            alert('Error parsing CSV: ' + err.message);
            setUploadingOdp(false);
          },
        });
      }
    } catch (err) {
      alert('Error membaca file: ' + err.message);
      setUploadingOdp(false);
    }
  };

  const sendOdpData = async (rows) => {
    if (!rows || rows.length === 0) {
      alert('Data kosong!');
      setUploadingOdp(false);
      return;
    }
    setOdpProgress(`Mengunggah ${rows.length.toLocaleString()} data ODP ke database...`);
    const res = await fetch('/api/upload-odp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: rows }),
    });
    if (res.ok) {
      setOdpProgress(`✅ Sukses mengunggah ${rows.length.toLocaleString()} data ODP!`);
      if (onUploadOdpSuccess) onUploadOdpSuccess();
    } else {
      const json = await res.json();
      alert('Gagal upload ODP: ' + (json.error || 'Terjadi kesalahan'));
    }
    setUploadingOdp(false);
  };

  const processOrderFile = async (file) => {
    if (!file) return;
    setUploadingOrder(true);
    setOrderProgress('Membaca file Order...');

    try {
      let rawRows = [];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(ws, { defval: null });
        await sendOrderData(rawRows);
      } else {
        const sampleText = await file.slice(0, 4096).text();
        const firstLine = sampleText.split('\n')[0];
        const autoDelimiter = detectDelimiter(firstLine);

        Papa.parse(file, {
          header: true,
          delimiter: autoDelimiter,
          skipEmptyLines: true,
          complete: async (results) => {
            await sendOrderData(results.data);
          },
          error: (err) => {
            alert('Error parsing CSV: ' + err.message);
            setUploadingOrder(false);
          },
        });
      }
    } catch (err) {
      alert('Error membaca file: ' + err.message);
      setUploadingOrder(false);
    }
  };

  const sendOrderData = async (rawRows) => {
    const cleaned = rawRows.map(normalizeOrderKeys).filter(Boolean);
    if (cleaned.length === 0) {
      alert('Tidak ada baris data Order yang valid!');
      setUploadingOrder(false);
      return;
    }

    setOrderProgress(`Mengunggah & upsert ${cleaned.length.toLocaleString()} data Order...`);
    const res = await fetch('/api/upload-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: cleaned }),
    });

    if (res.ok) {
      setOrderProgress(`✅ Sukses mengunggah ${cleaned.length.toLocaleString()} data Order!`);
      if (onUploadOrderSuccess) onUploadOrderSuccess();
    } else {
      const json = await res.json();
      alert('Gagal upload Order: ' + (json.error || 'Terjadi kesalahan'));
    }
    setUploadingOrder(false);
  };

  return (
    <div className="bg-white p-3 rounded-lg border border-slate-300 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Drag & Drop ODP */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOverOdp(true); }}
          onDragLeave={() => setIsDragOverOdp(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOverOdp(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              processOdpFile(e.dataTransfer.files[0]);
            }
          }}
          className={`border-2 border-dashed rounded-lg p-5 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[110px] ${
            isDragOverOdp ? 'border-blue-600 bg-blue-100/70' : 'border-blue-300 bg-blue-50/50 hover:bg-blue-50'
          }`}
          onClick={() => document.getElementById('odp-file-input').click()}
        >
          <input
            id="odp-file-input"
            type="file"
            accept=".csv, .xlsx, .xls"
            disabled={uploadingOdp}
            onChange={(e) => processOdpFile(e.target.files[0])}
            className="hidden"
          />
          <span className="text-2xl mb-1">📁</span>
          <p className="font-extrabold text-blue-950 text-[11px]">
            Drag &amp; Drop file ODP di sini atau <span className="text-blue-600 underline">klik untuk browse</span>
          </p>
          <span className="text-[9px] text-slate-500 mt-0.5 font-semibold">Support CSV (Pipe/Comma) &amp; Excel (.xlsx)</span>
          {uploadingOdp && <p className="text-[10px] text-blue-700 font-bold animate-pulse mt-1.5">{odpProgress}</p>}
          {!uploadingOdp && odpProgress && <p className="text-[10px] text-emerald-700 font-bold mt-1.5">{odpProgress}</p>}
        </div>

        {/* Drag & Drop Orders */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragOverOrder(true); }}
          onDragLeave={() => setIsDragOverOrder(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOverOrder(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              processOrderFile(e.dataTransfer.files[0]);
            }
          }}
          className={`border-2 border-dashed rounded-lg p-5 text-center transition cursor-pointer flex flex-col items-center justify-center min-h-[110px] ${
            isDragOverOrder ? 'border-purple-600 bg-purple-100/70' : 'border-purple-300 bg-purple-50/50 hover:bg-purple-50'
          }`}
          onClick={() => document.getElementById('order-file-input').click()}
        >
          <input
            id="order-file-input"
            type="file"
            accept=".csv, .xlsx, .xls"
            disabled={uploadingOrder}
            onChange={(e) => processOrderFile(e.target.files[0])}
            className="hidden"
          />
          <span className="text-2xl mb-1">📦</span>
          <p className="font-extrabold text-purple-950 text-[11px]">
            Drag &amp; Drop file Order di sini atau <span className="text-purple-600 underline">klik untuk browse</span>
          </p>
          <span className="text-[9px] text-slate-500 mt-0.5 font-semibold">Support CSV &amp; Excel Fallout (.xlsx) Auto Upsert</span>
          {uploadingOrder && <p className="text-[10px] text-purple-700 font-bold animate-pulse mt-1.5">{orderProgress}</p>}
          {!uploadingOrder && orderProgress && <p className="text-[10px] text-emerald-700 font-bold mt-1.5">{orderProgress}</p>}
        </div>
      </div>
    </div>
  );
}
