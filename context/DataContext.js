import React, { createContext, useContext, useState, useEffect } from 'react';

const DataContext = createContext();

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

const FALLOUT_KEYWORDS = [
  'ODP BELUM GO LIVE', 'ODP FULL', 'ODP JAUH', 'ODP LOSS', 'ODP RETI', 'ODP RUSAK', 'TIDAK ADA ODP',
  'KENDALA JALUR/RUTE TARIKAN', 'KENDALA IKR/IKG', 'KENDALA IZIN', 'KENDALA MATERIAL/NTE', 'KENDALA PERANGKAT',
  'ALAMAT TIDAK DITEMUKAN', 'INDIKASI CABUT PASANG', 'PELANGGAN MASIH RAGU', 'PELANGGAN TIDAK MERASA PASANG',
  'RUMAH KOSONG', 'CROSS JALAN', 'DOUBLE INPUT', 'GANTI PAKET', 'LIMITASI ONU', 'TIANG', 'BATAL',
  'PENDING', 'SYSTEM', 'ACTIVATION', 'DATA', 'RNA', 'ODP', 'LAINNYA',
];

function normalizeFalloutReason(rawVal) {
  if (!rawVal || String(rawVal).trim() === '' || String(rawVal).toLowerCase() === 'nan' || String(rawVal).toLowerCase() === 'null') {
    return null;
  }
  const cleanStr = String(rawVal).toUpperCase().replace(/_/g, ' ');
  for (const kw of FALLOUT_KEYWORDS) {
    const kwClean = kw.toUpperCase().replace(/_/g, ' ');
    const escaped = kwClean.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(?<![A-Z0-9])${escaped}(?![A-Z0-9])`, 'i');
    if (regex.test(cleanStr)) {
      return kwClean;
    }
  }
  return 'LAINNYA';
}

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
  return hasAllowedStoInName;
}

function parseDateRobust(raw) {
  if (!raw) return null;
  if (typeof raw === 'number' || (!isNaN(raw) && !String(raw).includes('-') && !String(raw).includes('/'))) {
    const num = parseFloat(raw);
    if (num > 30000 && num < 60000) return new Date(Math.round((num - 25569) * 86400 * 1000));
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function parseCleanFloat(val) {
  if (val === undefined || val === null || val === '') return null;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export function DataProvider({ children }) {
  const [odpData, setOdpData] = useState([]);
  const [ordersData, setOrdersData] = useState([]);
  const [odpLoaded, setOdpLoaded] = useState(false);
  const [ordersLoaded, setOrdersLoaded] = useState(false);

  const fetchOdp = async (force = false) => {
    if (odpLoaded && !force) return;
    try {
      const res = await fetch('/api/odp');
      if (res.ok) {
        const raw = await res.json();
        const enriched = raw
          .filter((item) => isAllowedOdp(item.odp_name, item.sto))
          .map((item) => {
            const isTotal = parseInt(item.is_total) || 0;
            const used = parseInt(item.used) || 0;
            const avai = parseInt(item.avai) || Math.max(0, isTotal - used);
            const rsk = isTotal > 0 ? used / isTotal : 0;
            let status = rsk === 0 ? 'BLACK' : rsk <= 0.6 ? 'GREEN' : rsk <= 0.85 ? 'YELLOW' : rsk < 0.99 ? 'ORANGE' : 'RED';

            let sto = extractSto(item.odp_name, item.sto);
            let wok = (item.wok || '').trim().toUpperCase();
            if (!wok || wok === 'UNKNOWN') wok = STO_WOK_MAP[sto] || 'PALANGKARAYA';

            let kab = (item.kabupaten || '').trim().toUpperCase();
            let finalKab = VALID_KABUPATEN.includes(kab) ? kab : 'LAINNYA';

            const rxVal = parseCleanFloat(item.ont_rx_level);
            let rxCategory = 'NO_DATA';
            if (rxVal !== null) {
              if (rxVal > -18) rxCategory = 'GREEN';
              else if (rxVal >= -21 && rxVal <= -18) rxCategory = 'YELLOW';
              else if (rxVal >= -25 && rxVal < -21) rxCategory = 'ORANGE';
              else if (rxVal < -25) rxCategory = 'RED';
            }

            return {
              ...item,
              sto,
              wok,
              kabupaten: finalKab,
              is_total: isTotal,
              used,
              avai,
              rsk,
              parsed_date: parseDateRobust(item.event_date),
              ont_rx_level: rxVal,
              rx_category: rxCategory,
              status_final: status,
            };
          });
        setOdpData(enriched);
        setOdpLoaded(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOrders = async (force = false) => {
    if (ordersLoaded && !force) return;
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const raw = await res.json();
        const enriched = (raw || []).map((row) => {
          const sto = (row.sto_co || '').trim().toUpperCase();
          const wok = (row.wok && row.wok.trim() !== '') ? row.wok.trim().toUpperCase() : (STO_WOK_MAP[sto] || 'PALANGKARAYA');
          const dur = (row.order_duration_cat && row.order_duration_cat.trim() !== '') ? row.order_duration_cat.trim().toUpperCase() : 'LAINNYA';
          const status = (row.order_status_desc || row.process_state || 'UNKNOWN').trim().toUpperCase();
          const falloutClean = normalizeFalloutReason(row.fallout_reason || row.fallout_category);

          return {
            ...row,
            sto_co: sto,
            wok,
            order_duration_cat: dur,
            order_status_clean: status,
            fallout_reason_clean: falloutClean,
          };
        });
        setOrdersData(enriched);
        setOrdersLoaded(true);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOdp();
    fetchOrders();
  }, []);

  return (
    <DataContext.Provider
      value={{
        odpData,
        ordersData,
        odpLoaded,
        ordersLoaded,
        reloadOdp: () => fetchOdp(true),
        reloadOrders: () => fetchOrders(true),
        reloadAll: () => {
          fetchOdp(true);
          fetchOrders(true);
        },
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
