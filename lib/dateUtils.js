const BULAN_ID = {
  januari: 0, jan: 0,
  februari: 1, feb: 1,
  maret: 2, mar: 2,
  april: 3, apr: 3,
  mei: 4,
  juni: 5, jun: 5,
  juli: 6, jul: 6,
  agustus: 7, agu: 7, ags: 7,
  september: 8, sep: 8,
  oktober: 9, okt: 9,
  november: 10, nov: 10,
  desember: 11, des: 11,
};

// Parse berbagai format tanggal yang dipakai di spreadsheet ini:
// "14 Juli 2026", "14/07/2026", "14-07-2026", "02-Jan" (tanpa tahun), "2026-07-14"
export function parseTanggalFleksibel(str) {
  if (!str) return null;
  const s = String(str).trim();

  // "14 Juli 2026"
  let m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const month = BULAN_ID[m[2].toLowerCase()];
    if (month !== undefined) return new Date(parseInt(m[3], 10), month, parseInt(m[1], 10));
  }

  // "14/07/2026" atau "14-07-2026"
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
  }

  // "06-Jul-26" atau "06 Jul 26" (dengan tahun 2 digit)
  m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]+)[\s\-](\d{2,4})$/);
  if (m) {
    const month = BULAN_ID[m[2].toLowerCase()];
    if (month !== undefined) {
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      return new Date(year, month, parseInt(m[1], 10));
    }
  }

  // "02-Jan" atau "02 Jan" (tanpa tahun) - asumsikan tahun berjalan,
  // mundur 1 tahun kalau hasilnya jadi tanggal di masa depan
  m = s.match(/^(\d{1,2})[\s\-]([A-Za-z]+)$/);
  if (m) {
    const month = BULAN_ID[m[2].toLowerCase()];
    if (month !== undefined) {
      const now = new Date();
      let year = now.getFullYear();
      let d = new Date(year, month, parseInt(m[1], 10));
      if (d > now) d = new Date(year - 1, month, parseInt(m[1], 10));
      return d;
    }
  }

  // ISO "2026-07-14"
  const iso = new Date(s);
  if (!isNaN(iso.getTime())) return iso;

  return null;
}

export function getYesterday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
}

// Ambil baris terakhir yang tanggalnya <= kemarin (skip baris kosong/placeholder
// yang tanggalnya di masa depan atau hari ini tapi datanya belum terisi).
// dateField: nama properti tanggal di tiap object row.
export function getYesterdayRow(rows, dateField = "tanggal") {
  if (!rows || rows.length === 0) return null;
  const yesterday = getYesterday();

  for (let i = rows.length - 1; i >= 0; i--) {
    const d = parseTanggalFleksibel(rows[i][dateField]);
    if (d && d <= yesterday) return rows[i];
  }
  return rows[rows.length - 1];
}

// Ambil semua baris yang tanggalnya persis sama dengan tanggal baris "kemarin"
// yang ditemukan (berguna kalau satu tanggal punya banyak baris, misal per Fact/Line).
export function getYesterdayGroupRows(rows, dateField = "tanggal") {
  const anchor = getYesterdayRow(rows, dateField);
  if (!anchor) return [];
  const anchorDate = parseTanggalFleksibel(anchor[dateField]);
  if (!anchorDate) return [anchor];

  return rows.filter((r) => {
    const d = parseTanggalFleksibel(r[dateField]);
    return d && d.getTime() === anchorDate.getTime();
  });
}
