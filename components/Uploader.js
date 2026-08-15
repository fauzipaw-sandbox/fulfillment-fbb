import { useState, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const ALLOWED_STOS = [
  'BNT', 'PLK', 'KKN', 'MTW', 'PPS', 'PYM', 'TML', 'AMP', 'KKP', 'KRI', 'KSO', 'PRC'
];

const VALID_KABUPATEN = [
  'BARITO SELATAN', 'KOTA PALANGKARAYA', 'GUNUNG MAS', 'BARITO UTARA',
  'BARITO TIMUR', 'KAPUAS', 'KATINGAN', 'PULANG PISAU', 'MURUNG RAYA',
];

const STO_WOK_MAP = {
  AMP: 'BARITO - KAPUAS', BNT: 'BARITO - KAPUAS', KKP: 'BARITO - KAPUAS',
  MTW: 'BARITO - KAPUAS', PPS: 'BARITO - KAPUAS', PRC: 'BARITO - KAPUAS',
  TML: 'BARITO - KAPUAS', KKN: 'PALANGKARAYA', KRI: 'PALANGKARAYA',
  KSO: 'PALANGKARAYA', PLK: 'PALANGKARAYA', PYM: 'PALANGKARAYA',
};

function extractSto(odpName, existingSto) {
  if (existingSto && String(existingSto).trim() !== '' && String(existingSto).toUpperCase() !== 'UNKNOWN') {
    return String(existingSto).trim().toUpperCase();
  }
  if (!odpName) return 'UNKNOWN';
  const match = String(odpName).match(/ODP-([A-Z0-9]{3})/i);
  return match && match[1] ? match[1].toUpperCase() : 'UNKNOWN';
}

function isAllowedOdp(odpName, existingSto) {
  if (!odpName) return false;
  const nameUpper = String(odpName).trim().toUpperCase();
  if (nameUpper.startsWith('OTB-')) return false;

  const sto = extractSto(odpName, existingSto);
  if (!ALLOWED_STOS.includes(sto)) return false;

  const hasAllowedStoInName = ALLOWED_STOS.some((code) => nameUpper.includes(code));
  if (!hasAllowedStoInName) return false;

  return true;
}

function parseCleanFloat(val) {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

function cleanString(val) {
  if (val === undefined || val === null || val === '' || String(val).trim() === '' || String(val).toLowerCase() === 'nan' || String(val).toLowerCase() === 'null') {
    return null;
  }
  return String(val).trim();
}

function cleanNumericString(val) {
  if (val === undefined || val === null || val === '' || String(val).toLowerCase() === 'nan') return null;
  const str = String(val).trim();
  if (str.endsWith('.0')) return str.slice(0, -2);
  return str;
}

export default function Uploader({ onUploadOdpSuccess, onUploadOrderSuccess }) {
  const [activeTab, setActiveTab] = useState('ODP');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  // 1. Process Upload Data ODP
  const processOdpData = async (rawDataInput) => {
    setLoading(true);
    setProgress(0);

    const formattedData = rawDataInput
      .filter((row) => isAllowedOdp(row.odp_name, row.sto))
      .map((row) => {
        const isTotal = parseInt(row.is_total) || 0;
        const used = parseInt(row.used) || 0;
        const avai = parseInt(row.avai) || Math.max(0, isTotal - used);
        const rsk = isTotal > 0 ? used / isTotal : 0;
        let statusFinal = rsk === 0 ? 'BLACK' : rsk <= 0.6 ? 'GREEN' : rsk <= 0.85 ? 'YELLOW' : rsk < 0.99 ? 'ORANGE' : 'RED';

        const finalSto = extractSto(row.odp_name, row.sto);
        const finalWok = (row.wok && row.wok.trim() !== '') ? row.wok.trim().toUpperCase() : (STO_WOK_MAP[finalSto] || 'PALANGKARAYA');
        let rawKab = (row.kabupaten || '').trim().toUpperCase();
        let finalKab = VALID_KABUPATEN.includes(rawKab) ? rawKab : 'LAINNYA';
        const rxVal = parseCleanFloat(row.ont_rx_level);

        return {
          event_date: cleanString(row.event_date),
          noss_id: parseInt(row.noss_id) || null,
          odp_name: cleanString(row.odp_name),
          odp_index: cleanString(row.odp_index),
          witel: cleanString(row.witel) || 'KALTIMTARA',
          datel: cleanString(row.datel),
          sto: finalSto,
          sto_desc: cleanString(row.sto_desc),
          longitude: parseCleanFloat(row.longitude),
          latitude: parseCleanFloat(row.latitude),
          avai: avai,
          used: used,
          rsv: parseInt(row.rsv) || 0,
          rsk: parseCleanFloat(row.rsk) || rsk,
          is_total: isTotal,
          status: cleanString(row.status),
          status_final: statusFinal,
          regional: cleanString(row.regional),
          id_desa: cleanString(row.id_desa),
          desa: cleanString(row.desa),
          id_kec: cleanString(row.id_kec),
          kecamatan: cleanString(row.kecamatan),
          id_kab: cleanString(row.id_kab),
          kabupaten: finalKab,
          distance: parseCleanFloat(row.distance),
          osrm_distance: parseCleanFloat(row.osrm_distance),
          no_speedy_ct0: cleanString(row.no_speedy_ct0),
          branch: cleanString(row.branch) || 'PALANGKARAYA',
          wok: finalWok,
          nop: cleanString(row.nop),
          olt: cleanString(row.olt),
          last_update_valins: cleanString(row.last_update_valins),
          valins_at: cleanString(row.valins_at),
          ont_rx_level: rxVal,
        };
      });

    const totalRecords = formattedData.length;
    if (totalRecords === 0) {
      alert('Tidak ada baris data valid sesuai 12 STO yang diimpor.');
      setLoading(false);
      return;
    }

    const BATCH_SIZE = 300;
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
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP Error ${res.status}`);
        }
        successCount += chunk.length;
        setProgress(Math.round((successCount / totalRecords) * 100));
      }
      alert(`Sukses mengunggah ${totalRecords.toLocaleString()} data ODP ke Database!`);
      if (onUploadOdpSuccess) onUploadOdpSuccess();
    } catch (err) {
      alert('Gagal upload Data ODP: ' + err.message);
    } finally {
      setLoading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 2. Process Upload Data Order (Mengarah ke /api/upload?type=order)
  const processOrderData = async (rawDataInput) => {
    setLoading(true);
    setProgress(0);

    const formattedData = rawDataInput
      .filter((row) => row.order_id && String(row.order_id).trim() !== '' && String(row.order_id).toLowerCase() !== 'nan')
      .map((row) => ({
        order_id: String(row.order_id).trim(),
        package_type: cleanString(row.package_type),
        order_type: cleanString(row.order_type),
        order_mode: cleanString(row.order_mode),
        sto_co: cleanString(row.sto_co)?.toUpperCase() || null,
        branch: cleanString(row.branch),
        wok: cleanString(row.wok),
        region: cleanString(row.region),
        area: cleanString(row.area),
        channel_name: cleanString(row.channel_name),
        service_id: cleanNumericString(row.service_id),
        product_commercial_name: cleanString(row.product_commercial_name),
        package_cat: cleanString(row.package_cat),
        order_status_desc: cleanString(row.order_status_desc),
        price_package: parseCleanFloat(row.price_package),
        payment_method: cleanString(row.payment_method),
        funneling_group: cleanString(row.funneling_group),
        funneling_subgroup: cleanString(row.funneling_subgroup),
        process_state: cleanString(row.process_state),
        provi_ts: cleanString(row.provi_ts),
        order_ts: cleanString(row.order_ts),
        ps_ts: cleanString(row.ps_ts),
        name: cleanString(row.name),
        no_handphone: cleanNumericString(row.no_handphone),
        address: cleanString(row.address),
        segmentation: cleanString(row.segmentation),
        tgl_manja: cleanString(row.tgl_manja),
        detail_manja: cleanString(row.detail_manja),
        prev_state: cleanString(row.prev_state),
        longitude: parseCleanFloat(row.longitude),
        latitude: parseCleanFloat(row.latitude),
        c_amcrew: cleanString(row.c_amcrew),
        c_chief_code: cleanString(row.c_chief_code),
        c_chief_name: cleanString(row.c_chief_name),
        c_wonum: cleanString(row.c_wonum),
        appointment_id: cleanString(row.appointment_id),
        appointment_start: cleanString(row.appointment_start),
        appointment_end: cleanString(row.appointment_end),
        reservation_id_odp: cleanNumericString(row.reservation_id_odp),
        c_actstart: cleanString(row.c_actstart),
        c_actfinish: cleanString(row.c_actfinish),
        c_urlevidence: cleanString(row.c_urlevidence),
        channel_group: cleanString(row.channel_group),
        order_channel: cleanString(row.order_channel),
        provi_duration: parseCleanFloat(row.provi_duration),
        c_engineermemo: cleanString(row.c_engineermemo),
        order_initiator_id: cleanNumericString(row.order_initiator_id),
        order_initiator_id_type: cleanString(row.order_initiator_id_type),
        fallout_source: cleanString(row.fallout_source),
        fallout_category: cleanString(row.fallout_category),
        fallout_reason: cleanString(row.fallout_reason),
        sf_name: cleanString(row.sf_name),
        sf_contact_number: cleanNumericString(row.sf_contact_number),
        sf_code: cleanString(row.sf_code),
        sf_company_name: cleanString(row.sf_company_name),
        completed_ts: cleanString(row.completed_ts),
        re_ts: cleanString(row.re_ts),
        referral_code: cleanString(row.referral_code),
        subchannel: cleanString(row.subchannel),
        odp_name: cleanString(row.odp_name),
        io_ts: cleanString(row.io_ts),
        list_sn_ont: cleanString(row.list_sn_ont),
        list_sn_stb: cleanString(row.list_sn_stb),
        list_sn_orbit: cleanString(row.list_sn_orbit),
        list_msisdn_orbit: cleanString(row.list_msisdn_orbit),
        order_id_prev: cleanString(row.order_id_prev),
        order_id_next: cleanString(row.order_id_next),
        customer_account_id: cleanString(row.customer_account_id),
        fee_psb: parseCleanFloat(row.fee_psb),
        fallout_ts: cleanString(row.fallout_ts),
        unit_type: cleanString(row.unit_type),
        unit_name: cleanString(row.unit_name),
        order_duration_cat: cleanString(row.order_duration_cat),
        region_nop: cleanString(row.region_nop),
        nop: cleanString(row.nop),
        citem_product: cleanString(row.citem_product),
        speed_product: parseCleanFloat(row.speed_product),
        homepass: cleanNumericString(row.homepass),
        no_handphone_mask: cleanString(row.no_handphone_mask),
      }));

    const totalRecords = formattedData.length;
    if (totalRecords === 0) {
      alert('Tidak ada baris data Order valid yang memiliki order_id.');
      setLoading(false);
      return;
    }

    const BATCH_SIZE = 200;
    let successCount = 0;

    try {
      for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
        const chunk = formattedData.slice(i, i + BATCH_SIZE);
        const res = await fetch('/api/upload?type=order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `HTTP Error ${res.status}`);
        }
        successCount += chunk.length;
        setProgress(Math.round((successCount / totalRecords) * 100));
      }
      alert(`Sukses mengunggah ${totalRecords.toLocaleString()} data Order ke Database!`);
      if (onUploadOrderSuccess) onUploadOrderSuccess();
    } catch (err) {
      alert('Gagal upload Data Order: ' + err.message);
    } finally {
      setLoading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFile = (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const callback = activeTab === 'ODP' ? processOdpData : processOrderData;

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => callback(results.data),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        callback(json);
      };
      reader.readAsArrayBuffer(file);
    } else {
      alert('Format tidak didukung! Gunakan .csv atau .xlsx');
    }
  };

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
      alert('Semua isi tabel Database ODP berhasil dikosongkan.');
      setShowDeleteModal(false);
      setConfirmInput('');
      if (onUploadOdpSuccess) onUploadOdpSuccess();
    } catch (err) {
      alert('Gagal mengosongkan database: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white p-3 sm:p-4 rounded shadow-sm border border-slate-200 space-y-3">
      {/* Tab Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ODP')}
            className={`px-3 py-1.5 rounded text-xs font-black transition ${
              activeTab === 'ODP'
                ? 'bg-blue-900 text-white shadow'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📁 1. Upload Data ODP
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ORDER')}
            className={`px-3 py-1.5 rounded text-xs font-black transition ${
              activeTab === 'ORDER'
                ? 'bg-purple-900 text-white shadow'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            📦 2. Upload Data Order (79 Kolom)
          </button>
        </div>
        
        {activeTab === 'ODP' && (
          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="px-2.5 py-1 bg-red-700 hover:bg-red-600 text-white rounded text-[11px] font-bold shadow flex items-center gap-1 transition self-end sm:self-auto"
          >
            <span>🗑️</span> Hapus Semua Data ODP
          </button>
        )}
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
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : activeTab === 'ODP'
            ? 'border-blue-300 bg-blue-50/40 hover:bg-blue-50'
            : 'border-purple-300 bg-purple-50/40 hover:bg-purple-50'
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
            <div className="font-bold text-blue-600 text-xs sm:text-sm">
              Menyimpan Data {activeTab} ({progress}%)...
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs sm:text-sm font-black text-slate-700">
              Drag & Drop file {activeTab === 'ODP' ? 'DATA ODP' : 'DATA ORDER'} di sini, atau klik untuk memilih file
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              {activeTab === 'ODP'
                ? 'Mendukung CSV/XLSX ODP Kalimantan (12 STO Valid)'
                : 'Mendukung CSV/XLSX Data Order Fulfillment (kpro-detail-order)'}
            </p>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-[10000] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl border border-red-200 max-w-md w-full p-5 space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <span className="text-2xl">⚠️</span>
              <h4 className="text-sm font-black uppercase tracking-wider">Konfirmasi Hapus Semua Data ODP</h4>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Tindakan ini akan <strong>menghapus permanen seluruh baris data ODP</strong> di database.
            </p>
            <div className="bg-red-50 p-2.5 rounded border border-red-200 text-[11px] text-red-800">
              Ketik kata <strong className="font-mono bg-red-100 px-1 py-0.5 rounded text-red-900">HAPUS</strong> atau <strong className="font-mono bg-red-100 px-1 py-0.5 rounded text-red-900">DELETE</strong> di bawah ini:
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
