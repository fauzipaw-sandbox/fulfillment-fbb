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

// Parser Tanggal Universal (Mendukung Objek Date, String YYYY-MM-DD, DD/MM/YYYY, dan Excel Serial Number)
function parseUniversalDate(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;

  // Jika berupa Excel Serial Number (misal: 46011)
  if (typeof val === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    return new Date(excelEpoch.getTime() + val * 86400000);
  }

  const str = String(val).trim();
  if (!str) return null;

  // Format DD/MM/YYYY atau DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Standar ISO YYYY-MM-DD
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

function formatDateToISO(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return null;
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Hitung Durasi Saklek (Today - Provi Date)
function calculateDurationFromProvi(proviRaw, fallbackRaw) {
  const proviDate = parseUniversalDate(proviRaw);
  if (proviDate) {
    const today = new Date();
    // Normalize ke jam 00:00:00 untuk perbandingan hari yang presisi
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfProvi = new Date(proviDate.getFullYear(), proviDate.getMonth(), proviDate.getDate());
    
    const diffTime = startOfToday.getTime() - startOfProvi.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 3) return '3 HARI';
    if (diffDays <= 7) return '7 HARI';
    if (diffDays <= 30) return '30 HARI';
    return '3 BULAN';
  }

  if (fallbackRaw) {
    const s = String(fallbackRaw).toUpperCase().trim();
    if (s.includes('1 HARI') || s.includes('2-3') || s.includes('3 HARI')) return '3 HARI';
    if (s.includes('4-7') || s.includes('7 HARI')) return '7 HARI';
    if (s.includes('30 HARI') || s.includes('30')) return '30 HARI';
    if (s.includes('>7') || s.includes('BULAN') || s.includes('3 BULAN')) return '3 BULAN';
  }

  return '3 HARI';
}

function normalizeOrderKeys(row) {
  const normalized = {};
  for (const [k, v] of Object.entries(row)) {
    const cleanKey = k.trim().toLowerCase().replace(/[\s\-\/\.]+/g, '_');
    normalized[cleanKey] = v;
  }

  const orderId = normalized.order_id || normalized.orderid || normalized.order_no || normalized.id;
  if (!orderId) return null;

  let lat = normalized.latitude || normalized.lat;
  let lon = normalized.longitude || normalized.lon || normalized.long;

  if ((!lat || !lon) && normalized.longlat) {
    const parts = String(normalized.longlat).split(',').map((s) => parseFloat(s.trim()));
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

  // 1. Provi Date sebagai sumber utama Order Date
  const rawProvi = normalized.provi || normalized.order_ts || normalized.order_date || null;
  const parsedProviDate = parseUniversalDate(rawProvi);
  const formattedOrderDate = parsedProviDate ? formatDateToISO(parsedProviDate) : (rawProvi ? String(rawProvi) : null);

  // 2. Hitung Duration Category Saklek
  const rawAging = normalized.aging_fallout || normalized.order_duration_cat || null;
  const finalDurationCat = calculateDurationFromProvi(parsedProviDate || rawProvi, rawAging);

  return {
    order_id: String(orderId).trim(),
    new_order_id: normalized.new_order_id ? String(normalized.new_order_id).trim() : null,
    process_state: normalized.process_state || normalized.order_status || 'FALLOUT',
    funneling_subgroup: normalized.funneling_subgroup || normalized.subgroup || 'FALLOUT',
    name: normalized.name || normalized.customer_name || normalized.nama_pelanggan || null,
    no_handphone: normalized.no_handphone || normalized.no_hp || normalized.telepon || null,
    sto_co: normalized.sto_co || normalized.sto || null,
    wok: normalized.wok || null,
    odp_name: normalized.odp_name || normalized.odp || null,
    product_commercial_name: normalized.product_commercial_name || normalized.product_name || null,
    order_duration_cat: finalDurationCat,
    fallout_category: normalized.fallout_category || null,
    fallout_reason: normalized.fallout_reason || normalized.remark || null,
    symptom: normalized.symptom || null,
    category_hk: normalized.category_hk || null,
    status_hk: normalized.status_hk || null,
    tanggal_hk: normalized.tanggal_hk ? formatDateToISO(parseUniversalDate(normalized.tanggal_hk)) || String(normalized.tanggal_hk) : null,
    pic_dept: normalized.pic_dept || null,
    remark: normalized.remark || null,
    price_package: normalized.price_package || normalized.price || null,
    order_ts: formattedOrderDate,
    ps_ts: normalized.ps_ts ? formatDateToISO(parseUniversalDate(normalized.ps_ts)) || String(normalized.ps_ts) : null,
    sf_name: normalized.sf_name || null,
    address: normalized.address || normalized.alamat || null,
    latitude: lat ? parseFloat(lat) : null,
    longitude: lon ? parseFloat(lon) : null,
  };
}

function normalizeOdpKeys(row) {
  const normalized = {};
  for (const [k, v] of Object.entries(row)) {
    const cleanKey = k.trim().toLowerCase().replace(/[\s\-\/\.]+/g, '_');
    normalized[cleanKey] = v;
  }

  const odpName = normalized.odp_name || normalized.odp || normalized.name;
  if (!odpName) return null;

  return {
    odp_name: String(odpName).trim(),
    sto: normalized.sto || null,
    sto_desc: normalized.sto_desc || null,
    wok: normalized.wok || null,
    witel: normalized.witel || null,
    datel: normalized.datel || null,
    regional: normalized.regional || null,
    kabupaten: normalized.kabupaten || null,
    kecamatan: normalized.kecamatan || null,
    desa: normalized.desa || null,
    latitude: normalized.latitude ? parseFloat(normalized.latitude) : null,
    longitude: normalized.longitude ? parseFloat(normalized.longitude) : null,
    avai: normalized.avai !== undefined && normalized.avai !== null ? parseInt(normalized.avai, 10) : 0,
    used: normalized.used !== undefined && normalized.used !== null ? parseInt(normalized.used, 10) : 0,
    rsv: normalized.rsv !== undefined && normalized.rsv !== null ? parseInt(normalized.rsv, 10) : 0,
    rsk: normalized.rsk !== undefined && normalized.rsk !== null ? parseInt(normalized.rsk, 10) : 0,
    is_total: normalized.is_total !== undefined && normalized.is_total !== null ? parseInt(normalized.is_total, 10) : 0,
    status: normalized.status || null,
    status_final: normalized.status_final || 'BLACK',
    ont_rx_level: normalized.ont_rx_level !== undefined && normalized.ont_rx_level !== null && normalized.ont_rx_level !== '' ? parseFloat(normalized.ont_rx_level) : null,
    event_date: normalized.event_date || null,
  };
}

export default function Uploader({ onUploadOdpSuccess, onUploadOrderSuccess }) {
  const [uploadingOdp, setUploadingOdp] = useState(false);
  const [uploadingOrder, setUploadingOrder] = useState(false);
  const [odpProgress, setOdpProgress] = useState('');
  const [orderProgress, setOrderProgress] = useState('');
  const [isDragOverOdp, setIsDragOverOdp] = useState(false);
  const [isDragOverOrder, setIsDragOverOrder] = useState(false);

  const uploadInBatches = async (endpoint, rows, setProgressMessage, label) => {
    const chunkSize = 500;
    const totalChunks = Math.ceil(rows.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const chunk = rows.slice(start, start + chunkSize);
      setProgressMessage(`Mengunggah ${label} batch ${i + 1} dari ${totalChunks} (${Math.min(start + chunkSize, rows.length)}/${rows.length})...`);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: chunk }),
      });

      const contentType = res.headers.get('content-type') || '';
      let json = {};
      if (contentType.includes('application/json')) {
        json = await res.json();
      } else {
        const textError = await res.text();
        throw new Error(`Server error (${res.status}): ${textError.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(json.error || `Gagal upload pada batch ${i + 1}`);
      }
    }
  };

  const processOdpFile = async (file) => {
    if (!file) return;
    setUploadingOdp(true);
    setOdpProgress('Membaca file ODP...');

    try {
      let rawRows = [];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(ws, { defval: null });
      } else {
        const text = await file.text();
        const firstLine = text.split('\n')[0];
        const autoDelimiter = detectDelimiter(firstLine);

        const parsed = Papa.parse(text, {
          header: true,
          delimiter: autoDelimiter,
          skipEmptyLines: true,
        });
        rawRows = parsed.data || [];
      }

      const cleaned = rawRows.map(normalizeOdpKeys).filter(Boolean);
      if (cleaned.length === 0) {
        alert('File ODP kosong atau format tidak sesuai!');
        setUploadingOdp(false);
        return;
      }

      await uploadInBatches('/api/upload-odp', cleaned, setOdpProgress, 'ODP');
      setOdpProgress(`✅ Sukses mengunggah ${cleaned.length.toLocaleString()} data ODP!`);
      if (onUploadOdpSuccess) onUploadOdpSuccess();
    } catch (err) {
      alert(`Gagal upload ODP: ${err.message}`);
      setOdpProgress(`❌ Gagal: ${err.message}`);
    } finally {
      setUploadingOdp(false);
    }
  };

  const processOrderFile = async (file) => {
    if (!file) return;
    setUploadingOrder(true);
    setOrderProgress('Membaca file Order...');

    try {
      let rawRows = [];
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rawRows = XLSX.utils.sheet_to_json(ws, { defval: null });
      } else {
        const text = await file.text();
        const firstLine = text.split('\n')[0];
        const autoDelimiter = detectDelimiter(firstLine);

        const parsed = Papa.parse(text, {
          header: true,
          delimiter: autoDelimiter,
          skipEmptyLines: true,
        });
        rawRows = parsed.data || [];
      }

      const cleaned = rawRows.map(normalizeOrderKeys).filter(Boolean);
      if (cleaned.length === 0) {
        alert('Tidak ada baris data Order yang valid!');
        setUploadingOrder(false);
        return;
      }

      await uploadInBatches('/api/upload-orders', cleaned, setOrderProgress, 'Order');
      setOrderProgress(`✅ Sukses mengunggah ${cleaned.length.toLocaleString()} data Order!`);
      if (onUploadOrderSuccess) onUploadOrderSuccess();
    } catch (err) {
      alert(`Gagal upload Order: ${err.message}`);
      setOrderProgress(`❌ Gagal: ${err.message}`);
    } finally {
      setUploadingOrder(false);
    }
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
          <span className="text-[9px] text-slate-500 mt-0.5 font-semibold">Provi &rarr; Order Date &amp; Auto Durasi (3 HARI, 7 HARI, 30 HARI, 3 BULAN)</span>
          {uploadingOrder && <p className="text-[10px] text-purple-700 font-bold animate-pulse mt-1.5">{orderProgress}</p>}
          {!uploadingOrder && orderProgress && <p className="text-[10px] text-emerald-700 font-bold mt-1.5">{orderProgress}</p>}
        </div>
      </div>
    </div>
  );
}
