"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Monitoring WIP Accessories: In Material (1) -> Proses Persiapan (2) -> Proses
// Sewing (3) -> Output (4) -> Alokasi Line (5), per SPO + Style + Size. Pola dan
// tampilan mengikuti Ganti Pola / Memo Material. Data tersimpan di 2 tab Google
// Spreadsheet (WIP ACCESSORIES - PERMINTAAN dan WIP ACCESSORIES - PROGRES).

const SIZE_OPTIONS = ["Man Left", "Man Right", "Women Left", "Women Right", "Junior Left", "Junior Right"];
const LINE_OPTIONS = ["Quality Area", ...Array.from({ length: 60 }, (_, i) => "K" + String(i + 1).padStart(2, "0"))];
const REFRESH_MS = 25000;
const LATE_MS = 48 * 60 * 60 * 1000; // lewat 48 jam masih menunggu = merah
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const AREAS = [
  { key: "in", num: "1", short: "In Material", title: "In Material", desc: "Catat material accessories yang masuk: SPO, Style, Size, dan Qty." },
  { key: "persiapan", num: "2", short: "Proses Persiapan", title: "Proses Persiapan", desc: "Catat qty yang selesai di proses persiapan." },
  { key: "sewing", num: "3", short: "Proses Sewing", title: "Proses Sewing", desc: "Catat qty yang selesai di proses sewing." },
  { key: "output", num: "4", short: "Output", title: "Output", desc: "Catat qty yang sudah menjadi output." },
  { key: "alokasi", num: "5", short: "Alokasi Line", title: "Alokasi Line", desc: "Alokasikan qty output ke Line tujuan." },
];
// Tiap tahap (selain In Material) mengerjakan qty yang sudah selesai di tahap sebelumnya.
const STAGES = {
  persiapan: { tahap: "PERSIAPAN", label: "Proses Persiapan", prevLabel: "In Material", prev: "qtyIn", cur: "qtyPersiapan", start: (t) => t.tglMasuk },
  sewing: { tahap: "SEWING", label: "Proses Sewing", prevLabel: "Persiapan", prev: "qtyPersiapan", cur: "qtySewing", start: (t) => t.tglMulaiPersiapan },
  output: { tahap: "OUTPUT", label: "Output", prevLabel: "Sewing", prev: "qtySewing", cur: "qtyOutput", start: (t) => t.tglMulaiSewing },
  alokasi: { tahap: "ALOKASI", label: "Alokasi Line", prevLabel: "Output", prev: "qtyOutput", cur: "qtyAlokasi", start: (t) => t.tglMulaiOutput },
};
const SORT_OPTIONS = [
  { value: "tgl_desc", label: "Tanggal masuk: terbaru" },
  { value: "tgl_asc", label: "Tanggal masuk: terlama" },
];
const REKAP_SORT_OPTIONS = [
  ...SORT_OPTIONS,
  { value: "spo_asc", label: "SPO A-Z (kecil ke besar)" },
  { value: "spo_desc", label: "SPO Z-A (besar ke kecil)" },
];
const STATUS_LABEL = { BARU: "Baru", BERJALAN: "Berjalan", SELESAI: "Selesai" };

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function fmtDate(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtJam(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtDateTime(d) {
  if (!d) return "-";
  return `${fmtDate(d)}, ${fmtJam(d)}`;
}
// Format durasi ringkas: "1h 4j" (hari/jam), "3j 20m" (jam/menit), atau "15m".
function fmtDuration(ms) {
  if (ms == null || ms < 0) return "-";
  const totalMinutes = Math.floor(ms / 60000);
  const hari = Math.floor(totalMinutes / (60 * 24));
  const jam = Math.floor((totalMinutes % (60 * 24)) / 60);
  const menit = totalMinutes % 60;
  if (hari > 0) return `${hari}h ${jam}j`;
  if (jam > 0) return `${jam}j ${menit}m`;
  return `${menit}m`;
}
function fmtQty(q) {
  return Number(q || 0).toLocaleString("id-ID");
}
function cleanIntInput(value) {
  return String(value).replace(/[^0-9]/g, "");
}
// Harus identik dengan normalisasi di lib/sheets.js supaya hasil lookup Style konsisten.
function normalizeSpo(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/SPO[-\s]*/g, "")
    .replace(/[^0-9/]/g, "")
    .trim();
}
function statusTagClass(status) {
  if (status === "SELESAI") return "wa-tag good";
  if (status === "BERJALAN") return "wa-tag warning";
  return "wa-tag dim";
}
function cmpDate(a, b, dir) {
  const ta = a ? a.getTime() : null;
  const tb = b ? b.getTime() : null;
  if (ta == null && tb == null) return 0;
  if (ta == null) return 1;
  if (tb == null) return -1;
  return (ta - tb) * dir;
}
// Filter Size + cari SPO + urutan (tanggal atau SPO). Urutan SPO dipecah dulu
// berdasar tanggal (terbaru di atas) supaya rapi di dalam satu SPO.
function applyView(list, { size = "", line = "", search = "", sortKey = "tgl_desc" }, dateOf) {
  let out = size ? list.filter((t) => t.size === size) : list;
  if (line) out = out.filter((t) => t.alokasi.some((a) => a.line === line));
  const q = normalizeSpo(search);
  if (q) out = out.filter((t) => normalizeSpo(t.spo).includes(q));
  return [...out].sort((a, b) => {
    if (sortKey === "tgl_asc") return cmpDate(dateOf(a), dateOf(b), 1);
    if (sortKey === "tgl_desc") return cmpDate(dateOf(a), dateOf(b), -1);
    const dir = sortKey === "spo_desc" ? -1 : 1;
    const c = String(a.spo || "").localeCompare(String(b.spo || ""), undefined, { numeric: true }) * dir;
    return c !== 0 ? c : cmpDate(dateOf(a), dateOf(b), -1);
  });
}
function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

// Durasi start->end sebagai tag. Kalau "end" belum ada, tahap itu masih
// berjalan: dihitung sampai sekarang, merah kalau sudah lewat 48 jam.
function DurasiTag({ start, end }) {
  if (!start) return <span className="wa-tag dim">-</span>;
  const endTime = end || new Date();
  const label = fmtDuration(endTime - start);
  if (end) {
    return (
      <span className="wa-tag good" title={`selesai ${fmtDateTime(end)}`}>
        {label}
      </span>
    );
  }
  const late = endTime - start > LATE_MS;
  return (
    <span
      className={late ? "wa-tag critical" : "wa-tag warning"}
      title={`masih berjalan sejak ${fmtDateTime(start)}${late ? " - lebih dari 48 jam" : ""}`}
    >
      {label} (berjalan)
    </span>
  );
}

// Dua baris (tanggal di atas, jam di bawah) supaya kolom tanggal tidak lebar.
function TglMasukCell({ d }) {
  if (!d) return <td>-</td>;
  return (
    <td style={{ whiteSpace: "nowrap" }}>
      <div>{fmtDate(d)}</div>
      <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{fmtJam(d)}</div>
    </td>
  );
}

function ProgressCell({ done, total }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const full = done >= total && total > 0;
  return (
    <div className="wa-progress-cell">
      <div className="wa-progress-label">
        {fmtQty(done)} / {fmtQty(total)} pcs
      </div>
      <div className="wa-progress-bar">
        <div className={`wa-progress-fill ${full ? "full" : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function LineChips({ alokasi }) {
  if (!alokasi || alokasi.length === 0) return <span className="wa-tag dim">-</span>;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {alokasi.map((a) => (
        <span key={a.line} className="wa-tag info">
          {a.line}: {fmtQty(a.qty)}
        </span>
      ))}
    </div>
  );
}

const newDraftRow = (id) => ({ id, spo: "", size: "", qty: "" });

export default function WipAccessories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const [view, setView] = useState("input");
  const [filter, setFilter] = useState("semua");
  const [area, setArea] = useState(null); // null = layar pilih area

  const [draftState, setDraftState] = useState({ nextId: 2, rows: [newDraftRow(1)] });
  const [qtyInputs, setQtyInputs] = useState({});
  const [lineInputs, setLineInputs] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [okMsg, setOkMsg] = useState("");
  const [actionError, setActionError] = useState("");

  // Filter/cari/urut per area tahap (Persiapan, Sewing, Output, Alokasi) dan untuk rekap.
  const [stageView, setStageView] = useState({});
  const [rekapView, setRekapView] = useState({ size: "", line: "", search: "", sortKey: "tgl_desc" });

  // Peta SPO -> Style (read-only, dari tab "data base SPO & STYLE"), dipakai
  // untuk mengisi kolom Style otomatis begitu SPO diketik. Gagal memuat tidak
  // fatal: form tetap bisa dipakai, server mencari Style lagi saat menyimpan.
  const [styleBySpo, setStyleBySpo] = useState({});
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ganti-pola/style-lookup", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data && !data.error) setStyleBySpo(data.styleBySpo || {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchItems = useCallback(async (opts = {}) => {
    const silent = !!opts.silent;
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/wip-accessories", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Gagal mengambil data WIP Accessories.");
      setItems(
        (data.items || []).map((t) => ({
          ...t,
          tglMasuk: toDate(t.tglMasuk),
          tglMulaiPersiapan: toDate(t.tglMulaiPersiapan),
          tglMulaiSewing: toDate(t.tglMulaiSewing),
          tglMulaiOutput: toDate(t.tglMulaiOutput),
          tglSelesaiPersiapan: toDate(t.tglSelesaiPersiapan),
          tglSelesaiSewing: toDate(t.tglSelesaiSewing),
          tglSelesaiOutput: toDate(t.tglSelesaiOutput),
          tglSelesaiAlokasi: toDate(t.tglSelesaiAlokasi),
          alokasi: t.alokasi || [],
        }))
      );
      setError(null);
      setLastFetched(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    // Tab browser yang tidak sedang dilihat tidak ikut menarik data (menghemat
    // kuota baca Google Sheets); begitu tab dibuka lagi, data langsung disegarkan.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") fetchItems({ silent: true });
    }, REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") fetchItems({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchItems]);

  function addDraftRow() {
    setDraftState((s) => ({ nextId: s.nextId + 1, rows: [...s.rows, newDraftRow(s.nextId)] }));
  }
  function removeDraftRow(id) {
    setDraftState((s) => {
      const rows = s.rows.filter((r) => r.id !== id);
      return rows.length === 0 ? { nextId: s.nextId + 1, rows: [newDraftRow(s.nextId)] } : { ...s, rows };
    });
  }
  function updateDraftRow(id, field, value) {
    setDraftState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)) }));
  }

  async function submitIn() {
    setActionError("");
    const filled = draftState.rows.filter((r) => r.spo.trim() || r.size || r.qty);
    if (filled.length === 0) {
      setActionError("Isi minimal satu baris SPO, Size, dan Qty dulu.");
      return;
    }
    const invalid = filled.find((r) => !r.spo.trim() || !r.size || !(parseInt(r.qty, 10) > 0));
    if (invalid) {
      setActionError("Ada baris yang belum lengkap - pastikan SPO, Size, dan Qty (lebih dari 0) semua terisi.");
      return;
    }
    setSubmittingId("__batch__");
    try {
      const res = await fetch("/api/wip-accessories/in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: filled.map((r) => ({ spo: r.spo.trim(), size: r.size, qty: r.qty })) }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Gagal mencatat In Material.");
      const baru = (data.results || []).filter((x) => x.baru).length;
      const tambah = (data.results || []).length - baru;
      setOkMsg(
        `In Material tercatat: ${baru} catatan baru${tambah ? `, ${tambah} qty ditambahkan ke catatan yang sudah ada` : ""} (${(data.results || [])
          .map((x) => x.id)
          .join(", ")}).`
      );
      setTimeout(() => setOkMsg(""), 5000);
      setDraftState({ nextId: 2, rows: [newDraftRow(1)] });
      await fetchItems({ silent: true });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmittingId(null);
    }
  }

  async function logStage(item, stageKey) {
    setActionError("");
    const cfg = STAGES[stageKey];
    const qty = parseInt(qtyInputs[item.id], 10);
    const sisa = item[cfg.prev] - item[cfg.cur];
    const line = lineInputs[item.id] || "";
    if (!qty || qty <= 0) {
      setActionError(`Isi qty ${cfg.label} dulu untuk ${item.id}.`);
      return;
    }
    if (qty > sisa) {
      setActionError(`Qty ${item.id} melebihi sisa (${fmtQty(sisa)} pcs).`);
      return;
    }
    if (stageKey === "alokasi" && !line) {
      setActionError(`Pilih Line tujuan dulu untuk ${item.id}.`);
      return;
    }
    setSubmittingId(item.id);
    try {
      const res = await fetch("/api/wip-accessories/progres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, tahap: cfg.tahap, qty, line }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Gagal mencatat qty.");
      setQtyInputs((s) => ({ ...s, [item.id]: "" }));
      setOkMsg(`${cfg.label} ${item.id}: ${fmtQty(qty)} pcs tercatat${stageKey === "alokasi" ? ` ke ${line}` : ""}.`);
      setTimeout(() => setOkMsg(""), 4000);
      await fetchItems({ silent: true });
    } catch (err) {
      setActionError(err.message);
      await fetchItems({ silent: true });
    } finally {
      setSubmittingId(null);
    }
  }

  // Qty yang masih menunggu di tiap tahap (sudah selesai di tahap sebelumnya,
  // belum dicatat di tahap itu).
  const waitingBy = useMemo(() => {
    const out = {};
    for (const [key, cfg] of Object.entries(STAGES)) out[key] = items.filter((t) => t[cfg.prev] > t[cfg.cur]);
    return out;
  }, [items]);
  const pcsWaiting = (key) => waitingBy[key].reduce((s, t) => s + (t[STAGES[key].prev] - t[STAGES[key].cur]), 0);

  const kpiData = useMemo(() => {
    const totalIn = items.reduce((s, t) => s + t.qtyIn, 0);
    const selesai = items.filter((t) => t.status === "SELESAI");
    const alokasiPcs = items.reduce((s, t) => s + t.qtyAlokasi, 0);
    return [
      { label: "Total Catatan", value: items.length, unit: "catatan", foot: `${fmtQty(totalIn)} pcs masuk (In Material)`, tone: "" },
      { label: "Menunggu Persiapan", value: pcsWaiting("persiapan"), unit: "pcs", foot: `${waitingBy.persiapan.length} catatan`, tone: "amber" },
      { label: "Menunggu Sewing", value: pcsWaiting("sewing"), unit: "pcs", foot: `${waitingBy.sewing.length} catatan`, tone: "amber" },
      { label: "Menunggu Output", value: pcsWaiting("output"), unit: "pcs", foot: `${waitingBy.output.length} catatan`, tone: "amber" },
      { label: "Menunggu Alokasi Line", value: pcsWaiting("alokasi"), unit: "pcs", foot: `${waitingBy.alokasi.length} catatan`, tone: "red" },
      { label: "Sudah Teralokasi", value: alokasiPcs, unit: "pcs", foot: `${selesai.length} catatan selesai penuh`, tone: "green" },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, waitingBy]);

  // Ringkasan qty yang sudah dialokasikan per Line tujuan.
  const alokasiPerLine = useMemo(() => {
    const m = new Map();
    for (const t of items) for (const a of t.alokasi) m.set(a.line, (m.get(a.line) || 0) + a.qty);
    return Array.from(m, ([line, qty]) => ({ line, qty })).sort((a, b) => a.line.localeCompare(b.line, undefined, { numeric: true }));
  }, [items]);

  const rekapByStatus = useMemo(() => {
    if (filter === "outstanding") return items.filter((t) => t.status !== "SELESAI");
    if (filter === "selesai") return items.filter((t) => t.status === "SELESAI");
    return items;
  }, [items, filter]);
  const rekapLineOptions = useMemo(() => uniqueSorted(rekapByStatus.flatMap((t) => t.alokasi.map((a) => a.line))), [rekapByStatus]);
  const effRekapLine = rekapLineOptions.includes(rekapView.line) ? rekapView.line : "";
  const rekapRows = useMemo(
    () => applyView(rekapByStatus, { ...rekapView, line: effRekapLine }, (t) => t.tglMasuk),
    [rekapByStatus, rekapView, effRekapLine]
  );

  const setStage = (key, patch) => setStageView((s) => ({ ...s, [key]: { size: "", search: "", sortKey: "tgl_desc", ...(s[key] || {}), ...patch } }));
  const stageOf = (key) => ({ size: "", search: "", sortKey: "tgl_desc", ...(stageView[key] || {}) });

  // Catatan In Material yang SPO + Size-nya sudah ada: qty akan ditambahkan ke catatan itu.
  const existingByKey = useMemo(() => new Map(items.map((t) => [`${normalizeSpo(t.spo)}|${t.size}`, t])), [items]);

  return (
    <div className="wa-root">
      <div className="wa-topbar">
        <div className="wa-brand">
          <div className="wa-brand-mark">WA</div>
          <div className="wa-brand-text">
            <div className="t1">Monitoring WIP Accessories</div>
            <div className="t2">In Material &rarr; Proses Persiapan &rarr; Proses Sewing &rarr; Output &rarr; Alokasi Line</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {lastFetched && !error && <span className="wa-badge wa-badge-dim">DIPERBARUI {fmtDateTime(lastFetched)}</span>}
          <button className="wa-btn-small" onClick={() => fetchItems()} disabled={loading}>
            &#x21bb; Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="wa-panel-note wa-note-error">
          Gagal memuat data WIP Accessories: <b>{error}</b>. Pastikan <code>GOOGLE_CLIENT_EMAIL</code>,{" "}
          <code>GOOGLE_PRIVATE_KEY</code>, dan <code>GOOGLE_SHEET_ID</code> sudah diisi, dan spreadsheet-nya sudah di-share ke
          service account tersebut dengan akses <b>Editor</b>.
        </div>
      )}

      <div className="wa-view-switch">
        <button className={`wa-view-btn ${view === "input" ? "active" : ""}`} onClick={() => setView("input")}>
          Input WIP Accessories
        </button>
        <button className={`wa-view-btn ${view === "rekap" ? "active" : ""}`} onClick={() => setView("rekap")}>
          Rekap &amp; Status
        </button>
      </div>

      {loading && items.length === 0 && !error && <div className="wa-empty-note">Memuat data WIP Accessories...</div>}

      {view === "input" && (
        <div>
          <div className="wa-panel-note">
            Alur: <b>In Material</b> mencatat material masuk &rarr; <b>Persiapan</b> &rarr; <b>Sewing</b> &rarr; <b>Output</b> &rarr;{" "}
            <b>Alokasi Line</b>. Setiap catatan per <b>SPO + Style + Size</b>. Qty di tiap tahap boleh dicicil, dan tidak boleh
            melebihi qty yang sudah selesai di tahap sebelumnya.
          </div>

          {area === null ? (
            <div>
              <div className="wa-area-heading">Pilih area kerja Anda</div>
              <div className="wa-area-grid">
                {AREAS.map((a) => (
                  <button key={a.key} className="wa-area-card" onClick={() => setArea(a.key)}>
                    <span className={`wa-area-num ${a.key === "in" ? "" : "teal"}`}>{a.num}</span>
                    <span className="wa-area-title">{a.title}</span>
                    <span className="wa-area-desc">{a.desc}</span>
                    <span className="wa-area-badge">
                      {a.key === "in" ? "Catat material masuk" : `${pcsWaiting(a.key)} pcs menunggu`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="wa-area-switch">
              <button className="wa-btn-small" onClick={() => setArea(null)}>
                &larr; Pilih Area
              </button>
              {AREAS.map((a) => (
                <button key={a.key} className={`wa-filter-btn ${area === a.key ? "active" : ""}`} onClick={() => setArea(a.key)}>
                  {a.num}. {a.short}
                </button>
              ))}
            </div>
          )}

          {okMsg && <div className="wa-msg-success" style={{ margin: "10px 0" }}>{okMsg}</div>}
          {actionError && <div className="wa-msg-error" style={{ margin: "10px 0" }}>{actionError}</div>}

          {area === "in" && (
            <div>
              <div className="wa-section-title">
                <h2>
                  <span className="wa-step-num">1</span>
                  In Material &mdash; Catat Material Masuk
                  <span className="sub">PER SPO + SIZE</span>
                </h2>
              </div>
              <div className="wa-panel">
                <div className="wa-panel-body">
                  <div className="wa-panel-note">
                    Isi <b>No. SPO</b>, nama <b>Style</b> terisi otomatis dari data SPO. Pilih <b>Size</b> dan isi <b>Qty</b>. Satu SPO
                    dengan beberapa Size: tambah baris per Size. Kalau SPO + Size itu sudah punya catatan, qty ditambahkan ke catatan
                    yang ada (material boleh datang dicicil).
                  </div>
                  <div className="wa-table-scroll">
                    <table className="wa-table">
                      <thead>
                        <tr>
                          <th style={{ width: "20%" }}>No. SPO</th>
                          <th style={{ width: "30%" }}>Style (otomatis)</th>
                          <th style={{ width: "18%" }}>Size</th>
                          <th style={{ width: "14%" }}>Qty (pcs)</th>
                          <th>Keterangan</th>
                          <th style={{ width: "6%" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftState.rows.map((r) => {
                          const key = normalizeSpo(r.spo);
                          const style = key ? styleBySpo[key] : "";
                          const existing = key && r.size ? existingByKey.get(`${key}|${r.size}`) : null;
                          return (
                            <tr key={r.id}>
                              <td>
                                <input
                                  className="wa-input"
                                  type="text"
                                  placeholder="mis. SPO-2011/26"
                                  value={r.spo}
                                  onChange={(e) => updateDraftRow(r.id, "spo", e.target.value)}
                                />
                              </td>
                              <td>
                                {!r.spo.trim() ? (
                                  <div className="wa-style-auto dim">terisi otomatis setelah SPO diketik</div>
                                ) : style ? (
                                  <div className="wa-style-auto">{style}</div>
                                ) : (
                                  <div className="wa-style-auto dim">Style tidak ditemukan</div>
                                )}
                              </td>
                              <td>
                                <select className="wa-input" value={r.size} onChange={(e) => updateDraftRow(r.id, "size", e.target.value)}>
                                  <option value="">Pilih Size</option>
                                  {SIZE_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  className="wa-input"
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="0"
                                  value={r.qty}
                                  onChange={(e) => updateDraftRow(r.id, "qty", cleanIntInput(e.target.value))}
                                />
                              </td>
                              <td>
                                {existing ? (
                                  <div className="wa-style-auto" style={{ color: "var(--amber)" }}>
                                    {existing.id} sudah ada ({fmtQty(existing.qtyIn)} pcs) &mdash; qty ditambahkan
                                  </div>
                                ) : r.spo.trim() && r.size ? (
                                  <div className="wa-style-auto dim">catatan baru</div>
                                ) : null}
                              </td>
                              <td>
                                <button className="wa-icon-x" onClick={() => removeDraftRow(r.id)} title="Hapus baris">
                                  &#x2715;
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button className="wa-btn-small" style={{ marginTop: 10 }} onClick={addDraftRow}>
                    + Tambah Baris
                  </button>
                  <div style={{ marginTop: 16 }}>
                    <button className="wa-btn-primary" disabled={submittingId === "__batch__"} onClick={submitIn}>
                      {submittingId === "__batch__" ? "Mencatat..." : "+ Catat Semua Material Masuk"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {STAGES[area] &&
            (() => {
              const cfg = STAGES[area];
              const isAlokasi = area === "alokasi";
              const total = waitingBy[area];
              const sv = stageOf(area);
              const rows = applyView(total, sv, cfg.start);
              const num = AREAS.find((a) => a.key === area).num;
              const sizeOptions = uniqueSorted(total.map((t) => t.size));
              return (
                <div>
                  <div className="wa-section-title sub2">
                    <h2>
                      <span className="wa-step-num teal">{num}</span>
                      {cfg.label} &mdash; {isAlokasi ? "Alokasikan Output ke Line Tujuan" : `Catat Qty Selesai ${cfg.label}`}
                      <span className="sub">{total.length} CATATAN MENUNGGU</span>
                    </h2>
                  </div>
                  <div className="wa-panel">
                    <div className="wa-panel-body">
                      <div className="wa-panel-note">
                        Daftar di bawah adalah catatan yang <b>masih ada sisa qty</b> dari tahap {cfg.prevLabel}.{" "}
                        {isAlokasi
                          ? "Pilih Line tujuan dan isi qty yang dialokasikan; satu catatan boleh dibagi ke beberapa Line. "
                          : "Isi qty yang selesai sekarang, boleh dicicil. "}
                        <b>Tgl Masuk</b> = kapan qty pertama sampai di tahap ini. Usia berwarna{" "}
                        <b style={{ color: "var(--red)" }}>merah</b> berarti sudah lebih dari 48 jam.
                      </div>
                      {total.length > 0 && (
                        <div className="wa-line-bar">
                          <div className="wa-field">
                            <label>Filter Size</label>
                            <select className="wa-input" style={{ width: 160 }} value={sv.size} onChange={(e) => setStage(area, { size: e.target.value })}>
                              <option value="">Semua Size</option>
                              {sizeOptions.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="wa-field">
                            <label>Cari SPO</label>
                            <input
                              className="wa-input"
                              style={{ width: 160 }}
                              type="text"
                              placeholder="mis. 2011/26"
                              value={sv.search}
                              onChange={(e) => setStage(area, { search: e.target.value })}
                            />
                          </div>
                          <div className="wa-field">
                            <label>Urutkan</label>
                            <select className="wa-input" style={{ width: 210 }} value={sv.sortKey} onChange={(e) => setStage(area, { sortKey: e.target.value })}>
                              {SORT_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <span className="wa-line-count">
                            Menampilkan {rows.length} dari {total.length} catatan
                          </span>
                        </div>
                      )}
                      <div className="wa-table-scroll">
                        <table className="wa-table">
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Tgl Masuk</th>
                              <th>SPO</th>
                              <th>Style</th>
                              <th>Size</th>
                              <th style={{ textAlign: "right" }}>Selesai di {cfg.prevLabel}</th>
                              <th style={{ textAlign: "right" }}>Progress {cfg.label}</th>
                              <th style={{ textAlign: "right" }}>Sisa</th>
                              {isAlokasi && <th>Sudah Dialokasi</th>}
                              <th>Usia</th>
                              {isAlokasi && <th>Line Tujuan</th>}
                              <th>Qty Sekarang</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((t) => {
                              const sisa = t[cfg.prev] - t[cfg.cur];
                              return (
                                <tr key={t.id}>
                                  <td>{t.id}</td>
                                  <TglMasukCell d={cfg.start(t)} />
                                  <td>{t.spo}</td>
                                  <td>{t.style || <span className="wa-tag dim">-</span>}</td>
                                  <td>
                                    <span className="wa-tag info">{t.size}</span>
                                  </td>
                                  <td className="wa-num">{fmtQty(t[cfg.prev])}</td>
                                  <td className="wa-num">
                                    <ProgressCell done={t[cfg.cur]} total={t[cfg.prev]} />
                                  </td>
                                  <td className="wa-num" style={{ color: "var(--amber)" }}>
                                    {fmtQty(sisa)}
                                  </td>
                                  {isAlokasi && (
                                    <td>
                                      <LineChips alokasi={t.alokasi} />
                                    </td>
                                  )}
                                  <td>
                                    <DurasiTag start={cfg.start(t)} end={null} />
                                  </td>
                                  {isAlokasi && (
                                    <td>
                                      <select
                                        className="wa-input"
                                        style={{ width: 130 }}
                                        value={lineInputs[t.id] || ""}
                                        onChange={(e) => setLineInputs((s) => ({ ...s, [t.id]: e.target.value }))}
                                      >
                                        <option value="">Pilih Line</option>
                                        {LINE_OPTIONS.map((l) => (
                                          <option key={l} value={l}>
                                            {l}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                  )}
                                  <td>
                                    <input
                                      className="wa-input wa-qty-input"
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="0"
                                      value={qtyInputs[t.id] || ""}
                                      onChange={(e) => setQtyInputs((s) => ({ ...s, [t.id]: cleanIntInput(e.target.value) }))}
                                    />
                                  </td>
                                  <td>
                                    <button className="wa-btn-ok" disabled={submittingId === t.id} onClick={() => logStage(t, area)}>
                                      {isAlokasi ? "Alokasikan" : "Catat"}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {total.length === 0 && <div className="wa-empty-note">Tidak ada qty yang menunggu di {cfg.label} saat ini.</div>}
                      {total.length > 0 && rows.length === 0 && <div className="wa-empty-note">Tidak ada catatan yang cocok dengan filter.</div>}
                    </div>
                  </div>
                </div>
              );
            })()}
        </div>
      )}

      {view === "rekap" && (
        <div>
          <div className="wa-kpi-grid">
            {kpiData.map((k) => (
              <div key={k.label} className={`wa-kpi ${k.tone}`}>
                <div className="label">{k.label}</div>
                <div className="value">
                  {fmtQty(k.value)}
                  {k.unit && <span className="unit">{k.unit}</span>}
                </div>
                <div className="foot">{k.foot}</div>
              </div>
            ))}
          </div>

          {alokasiPerLine.length > 0 && (
            <div className="wa-panel" style={{ marginBottom: 16 }}>
              <div className="wa-panel-body">
                <div className="wa-area-heading" style={{ marginBottom: 8 }}>Qty teralokasi per Line</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {alokasiPerLine.map((a) => (
                    <span key={a.line} className="wa-tag info">
                      {a.line}: {fmtQty(a.qty)} pcs
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="wa-section-title">
            <h2>
              Rekap Seluruh WIP Accessories<span className="sub">{rekapRows.length} CATATAN</span>
            </h2>
          </div>
          <div className="wa-panel">
            <div className="wa-panel-body">
              <div className="wa-filter-row">
                {[
                  ["semua", "Semua"],
                  ["outstanding", "Outstanding"],
                  ["selesai", "Selesai"],
                ].map(([val, label]) => (
                  <button key={val} className={`wa-filter-btn ${filter === val ? "active" : ""}`} onClick={() => setFilter(val)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="wa-line-bar">
                <div className="wa-field">
                  <label>Filter Size</label>
                  <select className="wa-input" style={{ width: 160 }} value={rekapView.size} onChange={(e) => setRekapView((s) => ({ ...s, size: e.target.value }))}>
                    <option value="">Semua Size</option>
                    {SIZE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="wa-field">
                  <label>Filter Line Tujuan</label>
                  <select className="wa-input" style={{ width: 160 }} value={effRekapLine} onChange={(e) => setRekapView((s) => ({ ...s, line: e.target.value }))}>
                    <option value="">Semua Line</option>
                    {rekapLineOptions.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="wa-field">
                  <label>Cari SPO</label>
                  <input
                    className="wa-input"
                    style={{ width: 160 }}
                    type="text"
                    placeholder="mis. 2011/26"
                    value={rekapView.search}
                    onChange={(e) => setRekapView((s) => ({ ...s, search: e.target.value }))}
                  />
                </div>
                <div className="wa-field">
                  <label>Urutkan</label>
                  <select className="wa-input" style={{ width: 230 }} value={rekapView.sortKey} onChange={(e) => setRekapView((s) => ({ ...s, sortKey: e.target.value }))}>
                    {REKAP_SORT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <span className="wa-line-count">
                  Menampilkan {rekapRows.length} dari {rekapByStatus.length} catatan
                </span>
              </div>
              <div className="wa-table-scroll">
                <table className="wa-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tgl Masuk</th>
                      <th>SPO</th>
                      <th>Style</th>
                      <th>Size</th>
                      <th style={{ textAlign: "right" }}>In Material</th>
                      <th style={{ textAlign: "right" }}>Persiapan</th>
                      <th style={{ textAlign: "right" }}>Sewing</th>
                      <th style={{ textAlign: "right" }}>Output</th>
                      <th style={{ textAlign: "right" }}>Alokasi</th>
                      <th>Line Tujuan</th>
                      <th>Durasi Persiapan</th>
                      <th>Durasi Sewing</th>
                      <th>Durasi Output</th>
                      <th>Durasi Alokasi</th>
                      <th>Total Durasi</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapRows.map((t) => (
                      <tr key={t.id}>
                        <td>{t.id}</td>
                        <TglMasukCell d={t.tglMasuk} />
                        <td>{t.spo}</td>
                        <td>{t.style || <span className="wa-tag dim">-</span>}</td>
                        <td>
                          <span className="wa-tag info">{t.size}</span>
                        </td>
                        <td className="wa-num">{fmtQty(t.qtyIn)}</td>
                        <td className="wa-num">
                          <ProgressCell done={t.qtyPersiapan} total={t.qtyIn} />
                        </td>
                        <td className="wa-num">
                          <ProgressCell done={t.qtySewing} total={t.qtyIn} />
                        </td>
                        <td className="wa-num">
                          <ProgressCell done={t.qtyOutput} total={t.qtyIn} />
                        </td>
                        <td className="wa-num">
                          <ProgressCell done={t.qtyAlokasi} total={t.qtyIn} />
                        </td>
                        <td>
                          <LineChips alokasi={t.alokasi} />
                        </td>
                        <td>
                          <DurasiTag start={t.tglMasuk} end={t.tglSelesaiPersiapan} />
                        </td>
                        <td>
                          <DurasiTag start={t.tglMulaiPersiapan} end={t.tglSelesaiSewing} />
                        </td>
                        <td>
                          <DurasiTag start={t.tglMulaiSewing} end={t.tglSelesaiOutput} />
                        </td>
                        <td>
                          <DurasiTag start={t.tglMulaiOutput} end={t.tglSelesaiAlokasi} />
                        </td>
                        <td>
                          <DurasiTag start={t.tglMasuk} end={t.tglSelesaiAlokasi} />
                        </td>
                        <td>
                          <span className={statusTagClass(t.status)}>{STATUS_LABEL[t.status]}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rekapRows.length === 0 && <div className="wa-empty-note">Belum ada data untuk filter ini.</div>}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .wa-root {
          font-family: var(--font-body);
        }
        .wa-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          flex-wrap: wrap;
          padding: 14px 18px;
          margin-bottom: 16px;
          background: var(--panel);
          border: 1px solid var(--steel);
          border-radius: 4px;
        }
        .wa-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .wa-brand-mark {
          width: 34px;
          height: 34px;
          border: 1px solid var(--navy);
          border-radius: 3px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--navy);
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 12px;
          flex: none;
        }
        .wa-brand-text .t1 {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 18px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--navy);
        }
        .wa-brand-text .t2 {
          font-family: var(--font-mono);
          font-size: 10.5px;
          color: var(--text-faint);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .wa-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px 9px;
          border-radius: 2px;
          white-space: nowrap;
        }
        .wa-badge-dim {
          color: var(--text-faint);
          border: 1px solid var(--steel);
        }

        .wa-view-switch {
          display: flex;
          gap: 8px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .wa-view-btn {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 12.5px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          padding: 10px 18px;
          border-radius: 3px;
          border: 1px solid var(--steel);
          background: var(--panel);
          color: var(--text-muted);
          cursor: pointer;
        }
        .wa-view-btn.active {
          background: var(--navy);
          color: #fff;
          border-color: var(--navy);
        }

        .wa-section-title {
          margin: 22px 0 12px;
        }
        .wa-section-title h2 {
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          background: var(--navy);
          color: #ffffff;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 9px 18px;
          clip-path: polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%);
        }
        .wa-section-title h2 .sub {
          font-family: var(--font-mono);
          font-weight: 400;
          font-size: 10.5px;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.65);
          text-transform: uppercase;
        }
        .wa-section-title.sub2 h2 {
          background: var(--teal-dim);
        }
        .wa-area-heading {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--navy);
          margin: 18px 0 12px;
        }
        .wa-area-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }
        @media (max-width: 1180px) {
          .wa-area-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }
        @media (max-width: 760px) {
          .wa-area-grid {
            grid-template-columns: 1fr;
          }
        }
        .wa-area-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 8px;
          text-align: left;
          background: var(--panel);
          border: 1px solid var(--steel);
          border-top: 4px solid var(--navy);
          border-radius: 3px;
          padding: 18px 18px 16px;
          cursor: pointer;
          font-family: var(--font-body);
        }
        .wa-area-card:hover {
          border-color: var(--teal);
          box-shadow: 0 0 0 2px rgba(58, 183, 196, 0.2);
        }
        .wa-area-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--navy);
          color: #fff;
          font-family: var(--font-mono);
          font-size: 13px;
          font-weight: 600;
        }
        .wa-area-num.teal {
          background: var(--teal-dim);
        }
        .wa-area-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 17px;
          color: var(--navy);
        }
        .wa-area-desc {
          font-size: 12.5px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .wa-area-badge {
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--teal-dim);
          border: 1px solid currentColor;
          border-radius: 2px;
          padding: 2px 8px;
        }
        .wa-line-bar {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: flex-end;
          margin-bottom: 12px;
        }
        .wa-line-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-faint);
          padding-bottom: 9px;
        }
        .wa-area-switch {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 4px;
        }

        .wa-panel {
          background: var(--panel);
          border: 1px solid var(--steel);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .wa-panel-body {
          padding: 18px 20px;
        }
        .wa-panel-note {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--text-muted);
          line-height: 1.6;
          padding: 10px 14px;
          background: var(--panel-raised);
          border: 1px solid var(--steel);
          border-radius: 3px;
          margin-bottom: 14px;
        }
        .wa-panel-note b {
          color: var(--text);
        }
        .wa-note-error {
          border-color: var(--red);
          color: var(--red);
        }
        .wa-note-error code {
          font-family: var(--font-mono);
          background: rgba(192, 57, 43, 0.08);
          padding: 1px 5px;
          border-radius: 2px;
        }

        /* .wa-tag dipakai juga oleh DurasiTag/ProgressCell (komponen anak terpisah),
           jadi harus :global - styled-jsx cuma otomatis men-scope elemen yang
           ditulis langsung di JSX komponen pemilik <style jsx> ini. */
        :global(.wa-tag) {
          font-family: var(--font-mono);
          font-size: 9.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 2px 7px;
          border-radius: 2px;
          border: 1px solid currentColor;
          white-space: nowrap;
        }
        :global(.wa-tag.good) {
          color: var(--green);
        }
        :global(.wa-tag.warning) {
          color: var(--amber);
        }
        :global(.wa-tag.critical) {
          color: var(--red);
        }
        :global(.wa-tag.dim) {
          color: var(--text-faint);
        }
        :global(.wa-tag.info) {
          color: var(--teal-dim);
        }

        .wa-param-row {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          align-items: flex-end;
        }
        .wa-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .wa-field label {
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .wa-field .hint {
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--text-faint);
        }
        .wa-style-hint {
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--teal-dim);
          margin-top: 4px;
        }
        .wa-style-hint.dim {
          color: var(--text-faint);
          font-style: italic;
        }
        :global(.wa-input) {
          background: var(--panel);
          border: 1px solid var(--steel);
          border-radius: 3px;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 14px;
          padding: 8px 10px;
          width: 180px;
        }
        :global(.wa-input:focus) {
          outline: none;
          border-color: var(--teal);
          box-shadow: 0 0 0 2px rgba(58, 183, 196, 0.25);
        }
        .wa-btn-primary {
          background: var(--teal);
          color: var(--navy);
          border: none;
          border-radius: 3px;
          padding: 10px 20px;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 13px;
          letter-spacing: 0.04em;
          cursor: pointer;
          height: 38px;
        }
        .wa-btn-primary:hover {
          opacity: 0.88;
        }
        .wa-btn-primary:disabled {
          background: var(--steel);
          color: var(--text-faint);
          cursor: not-allowed;
        }
        .wa-btn-small {
          background: var(--panel);
          border: 1px solid var(--teal);
          color: var(--teal-dim);
          border-radius: 3px;
          padding: 7px 12px;
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 11.5px;
          cursor: pointer;
          white-space: nowrap;
        }
        .wa-btn-small:hover {
          background: rgba(58, 183, 196, 0.1);
        }
        .wa-btn-small:disabled {
          border-color: var(--steel);
          color: var(--text-faint);
          cursor: not-allowed;
          background: transparent;
        }
        .wa-icon-x {
          background: transparent;
          border: 1px solid var(--steel);
          color: var(--text-muted);
          border-radius: 3px;
          width: 26px;
          height: 26px;
          cursor: pointer;
        }
        .wa-msg-success {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--green);
        }
        .wa-msg-error {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--red);
        }

        .wa-table-scroll {
          overflow-x: auto;
        }
        :global(table.wa-table) {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-mono);
          font-size: 12px;
        }
        :global(table.wa-table th) {
          text-align: left;
          color: var(--text-faint);
          padding: 8px 7px;
          font-weight: 500;
          text-transform: uppercase;
          font-size: 9.5px;
          letter-spacing: 0.03em;
          border-bottom: 1px solid var(--steel);
          white-space: nowrap;
        }
        :global(table.wa-table td) {
          padding: 8px 7px;
          border-top: 1px solid var(--steel);
          vertical-align: middle;
        }
        :global(.wa-num) {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        :global(.wa-qty-input) {
          width: 70px;
          text-align: right;
        }
        /* ProgressCell juga komponen anak terpisah - sama alasannya, harus :global. */
        :global(.wa-progress-cell) {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 90px;
        }
        :global(.wa-progress-bar) {
          height: 6px;
          border-radius: 3px;
          background: var(--steel);
          overflow: hidden;
        }
        :global(.wa-progress-fill) {
          height: 100%;
          background: var(--teal);
          border-radius: 3px;
        }
        :global(.wa-progress-fill.full) {
          background: var(--green);
        }
        :global(.wa-progress-label) {
          font-size: 10.5px;
          color: var(--text-muted);
        }
        .wa-empty-note {
          color: var(--text-faint);
          font-family: var(--font-body);
          font-size: 12.5px;
          padding: 16px 4px;
        }

        .wa-kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        @media (max-width: 760px) {
          .wa-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .wa-kpi {
          position: relative;
          background: var(--panel);
          border: 1px solid var(--steel);
          border-left: 4px solid var(--teal);
          border-radius: 2px;
          padding: 14px 14px 12px;
          min-height: 88px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .wa-kpi.amber {
          border-left-color: var(--amber);
        }
        .wa-kpi.red {
          border-left-color: var(--red);
        }
        .wa-kpi.green {
          border-left-color: var(--green);
        }
        .wa-kpi .label {
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 10.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .wa-kpi .value {
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 22px;
          color: var(--navy);
          font-variant-numeric: tabular-nums;
          line-height: 1.18;
        }
        .wa-kpi .value .unit {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 400;
          margin-left: 4px;
        }
        .wa-kpi .foot {
          font-family: var(--font-body);
          font-size: 10.5px;
          color: var(--text-muted);
        }

        .wa-filter-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .wa-filter-btn {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          padding: 6px 13px;
          border-radius: 3px;
          border: 1px solid var(--steel);
          background: var(--panel-raised);
          color: var(--text-muted);
          cursor: pointer;
        }
        .wa-filter-btn.active {
          background: var(--teal-dim);
          color: #fff;
          border-color: var(--teal-dim);
        }

        .wa-step-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--navy);
          color: #fff;
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 600;
          flex: none;
          margin-right: 8px;
        }
        .wa-step-num.teal {
          background: var(--teal-dim);
        }
      
        .wa-btn-ok {
          background: var(--green);
          color: #fff;
          border: 1px solid var(--green);
          border-radius: 3px;
          padding: 7px 14px;
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 11.5px;
          cursor: pointer;
          white-space: nowrap;
        }
        .wa-btn-ok:hover {
          opacity: 0.88;
        }
        .wa-btn-no {
          background: var(--panel);
          color: var(--red);
          border: 1px solid var(--red);
          border-radius: 3px;
          padding: 7px 14px;
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 11.5px;
          cursor: pointer;
          white-space: nowrap;
        }
        .wa-btn-no:hover {
          background: rgba(192, 57, 43, 0.08);
        }
        .wa-btn-ok:disabled,
        .wa-btn-no:disabled {
          border-color: var(--steel);
          color: var(--text-faint);
          background: transparent;
          cursor: not-allowed;
        }
        .wa-style-auto {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--teal-dim);
          min-height: 20px;
        }
        .wa-style-auto.dim {
          color: var(--text-faint);
          font-style: italic;
        }
        :global(.wa-alasan-input) {
          width: 200px;
        }
        .wa-decision-btns {
          display: flex;
          gap: 8px;
        }
`}</style>
    </div>
  );
}
