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

export default function Uploader({ onUploadOdpSuccess, onUploadOrderSuccess }) {
  const [activeTab, setActiveTab] = useState('ODP'); // 'ODP' | 'ORDER'
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
      alert('Tidak ada baris data valid sesuai 12 STO yang diimpor.');
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
      if (onUploadOdpSuccess) onUploadOdpSuccess();
    } catch (err) {
      alert('Gagal upload Data ODP: ' + err.message);
    } finally {
      setLoading(false);
      setProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 2. Process Upload Data Order (Tabel orders_kalimantan)
  const processOrderData = async (rawDataInput) => {
    setLoading(true);
    setProgress(0);

    const formattedData = rawDataInput
      .filter((row) => row.order_id && String(row.order_id).trim() !== '')
      .map((row) => ({
        order_id: String(row.order_id).trim(),
        package_type: row.package_type ? String(row.package_type) : null,
        order_type: row.order_type ? String(row.order_type) : null,
        order_mode: row.order_mode ? String(row.order_mode) : null,
        sto_co: row.sto_co ? String(row.sto_co).trim().toUpperCase() : null,
        branch: row.branch ? String(row.branch) : null,
        wok: row.wok ? String(row.wok) : null,
        region: row.region ? String(row.region) : null,
        area: row.area ? String(row.area) : null,
        channel_name: row.channel_name ? String(row.channel_name) : null,
        service_id: row.service_id ? String(row.service_id) : null,
        product_commercial_name: row.product_commercial_name ? String(row.product_commercial_name) : null,
        package_cat: row.package_cat ? String(row.package_cat) : null,
        order_status_desc: row.order_status_desc ? String(row.order_status_desc) : null,
        price_package: parseCleanFloat(row.price_package),
        payment_method: row.payment_method ? String(row.payment_method) : null,
        funneling_group: row.funneling_group ? String(row.funneling_group) : null,
        funneling_subgroup: row.funneling_subgroup ? String(row.funneling_subgroup) : null,
        process_state: row.process_state ? String(row.process_state) : null,
        provi_ts: row.provi_ts ? String(row.provi_ts) : null,
        order_ts: row.order_ts ? String(row.order_ts) : null,
        ps_ts: row.ps_ts ? String(row.ps_ts) : null,
        name: row.name ? String(row.name) : null,
        no_handphone: row.no_handphone ? String(row.no_handphone) : null,
        address: row.address ? String(row.address) : null,
        segmentation: row.segmentation ? String(row.segmentation) : null,
        tgl_manja: row.tgl_manja ? String(row.tgl_manja) : null,
        detail_manja: row.detail_manja ? String(row.detail_manja) : null,
        prev_state: row.prev_state ? String(row.prev_state) : null,
        longitude: parseCleanFloat(row.longitude),
        latitude: parseCleanFloat(row.latitude),
        c_amcrew: row.c_amcrew ? String(row.c_amcrew) : null,
        c_chief_code: row.c_chief_code ? String(row.c_chief_code) : null,
        c_chief_name: row.c_chief_name ? String(row.c_chief_name) : null,
        c_wonum: row.c_wonum ? String(row.c_wonum) : null,
        appointment_id: row.appointment_id ? String(row.appointment_id) : null,
        appointment_start: row.appointment_start ? String(row.appointment_start) : null,
        appointment_end: row.appointment_end ? String(row.appointment_end) : null,
        reservation_id_odp: row.reservation_id_odp ? String(row.reservation_id_odp) : null,
        c_actstart: row.c_actstart ? String(row.c_actstart) : null,
        c_actfinish: row.c_actfinish ? String(row.c_actfinish) : null,
        c_urlevidence: row.c_urlevidence ? String(row.c_urlevidence) : null,
        channel_group: row.channel_group ? String(row.channel_group) : null,
        order_channel: row.order_channel ? String(row.order_channel) : null,
        provi_duration: parseCleanFloat(row.provi_duration),
        c_engineermemo: row.c_engineermemo ? String(row.c_engineermemo) : null,
        order_initiator_id: row.order_initiator_id ? String(row.order_initiator_id) : null,
        order_initiator_id_type: row.order_initiator_id_type ? String(row.order_initiator_id_type) : null,
        fallout_source: row.fallout_source ? String(row.fallout_source) : null,
        fallout_category: row.fallout_category ? String(row.fallout_category) : null,
        fallout_reason: row.fallout_reason ? String(row.fallout_reason) : null,
        sf_name: row.sf_name ? String(row.sf_name) : null,
        sf_contact_number: row.sf_contact_number ? String(row.sf_contact_number) : null,
        sf_code: row.sf_code ? String(row.sf_code) : null,
        sf_company_name: row.sf_company_name ? String(row.sf_company_name) : null,
        completed_ts: row.completed_ts ? String(row.completed_ts) : null,
        re_ts: row.re_ts ? String(row.re_ts) : null,
        referral_code: row.referral_code ? String(row.referral_code) : null,
        subchannel: row.subchannel ? String(row.subchannel) : null,
        odp_name: row.odp_name ? String(row.odp_name).trim() : null,
        io_ts: row.io_ts ? String(row.io_ts) : null,
        list_sn_ont: row.list_sn_ont ? String(row.list_sn_ont) : null,
        list_sn_stb: row.list_sn_stb ? String(row.list_sn_stb) : null,
        list_sn_orbit: row.list_sn_orbit ? String(row.list_sn_orbit) : null,
        list_msisdn_orbit: row.list_msisdn_orbit ? String(row.list_msisdn_orbit) : null,
        order_id_prev: row.order_id_prev ? String(row.order_id_prev) : null,
        order_id_next: row.order_id_next ? String(row.order_id_next) : null,
        customer_account_id: row.customer_account_id ? String(row.customer_account_id) : null,
        fee_psb: parseCleanFloat(row.fee_psb),
        fallout_ts: row.fallout_ts ? String(row.fallout_ts) : null,
        unit_type: row.unit_type ? String(row.unit_type) : null,
        unit_name: row.unit_name ? String(row.unit_name) : null,
        order_duration_cat: row.order_duration_cat ? String(row.order_duration_cat) : null,
        region_nop: row.region_nop ? String(row.region_nop) : null,
        nop: row.nop ? String(row.nop) : null,
        citem_product: row.citem_product ? String(row.citem_product) : null,
        speed_product: row.speed_product ? String(row.speed_product) : null,
        homepass: row.homepass ? String(row.homepass) : null,
        no_handphone_mask: row.no_handphone_mask ? String(row.no_handphone_mask) : null,
      }));

    const totalRecords = formattedData.length;
    if (totalRecords === 0) {
      alert('Tidak ada baris data Order valid yang memiliki order_id.');
      setLoading(false);
      return;
    }

    const BATCH_SIZE = 500;
    let successCount = 0;

    try {
      for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
        const chunk = formattedData.slice(i, i + BATCH_SIZE);
        const res = await fetch('/api/upload-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk),
        });

        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
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
      {/* Poin 3: Tab Selector Upload Data ODP & Upload Data Order */}
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
            📦 2. Upload Data Order (78 Kolom)
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
                : 'Mendukung CSV/XLSX Data Order Fulfillment (78 Kolom Otomatis Masuk Tabel Order)'}
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
