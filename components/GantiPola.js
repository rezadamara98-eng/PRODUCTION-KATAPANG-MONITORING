"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const LINE_OPTIONS = Array.from({ length: 60 }, (_, i) => `K${String(i + 1).padStart(2, "0")}`);
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];
const KETERANGAN_OPTIONS = ["Bolong", "Benang Putus", "Jahitan Miring/Dobel", "Warna Belang", "Ukuran Tidak Sesuai", "Noda/Kotor"];
const JENIS_OPTIONS = ["Part", "Pola Full"];
const REFRESH_MS = 25000;
const AREAS = [
  { key: "sewing", num: "1", short: "Sewing", title: "Production Sewing", desc: "Ajukan permintaan ganti pola untuk part yang reject." },
  { key: "prep", num: "2", short: "Preparation", title: "Preparation", desc: "Proses cutting ganti pola dan kirim ke Presub." },
  { key: "presub", num: "3", short: "Presub", title: "Presub", desc: "Jahit persiapan dan selesaikan, kirim balik ke Sewing." },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function toDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function fmtDate(d) {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
function fmtDateTime(d) {
  if (!d) return "-";
  const jam = String(d.getHours()).padStart(2, "0");
  const menit = String(d.getMinutes()).padStart(2, "0");
  return `${fmtDate(d)}, ${jam}:${menit}`;
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
function cleanIntInput(value) {
  return String(value).replace(/[^0-9]/g, "");
}
// Dipakai supaya "SPO-1250/26", "spo 1250/26", dan "1250/26" semua cocok ke
// baris yang sama di database SPO & Style - harus identik dengan normalisasi
// yang dipakai di lib/sheets.js (getSpoStyleMap) biar hasilnya konsisten.
function normalizeSpo(s) {
  return String(s || "")
    .toUpperCase()
    .replace(/SPO[-\s]*/g, "")
    .replace(/[^0-9/]/g, "")
    .trim();
}
function statusOf(t) {
  if (t.qtyPresub >= t.qtyReject) return "SELESAI";
  if (t.qtyPrep === 0) return "BARU";
  return "BERJALAN";
}
function statusTagClass(s) {
  if (s === "SELESAI") return "gp-tag good";
  if (s === "BERJALAN") return "gp-tag warning";
  return "gp-tag dim";
}
// "Pola Full" ditandai beda (amber) karena biasanya beban kerjanya jauh lebih
// besar daripada ganti 1 part reject biasa - supaya Preparation/Presub bisa
// langsung lihat sekilas tanpa perlu buka detail.
function jenisTagClass(j) {
  return j === "Pola Full" ? "gp-tag warning" : "gp-tag dim";
}

// Durasi start->end sebagai tag: kalau "end" belum ada, tahap itu masih
// berjalan - durasi dihitung sampai sekarang dan ditandai "(berjalan)". Kalau
// "start" belum ada sama sekali, tahap itu belum mulai.
function DurasiTag({ start, end }) {
  if (!start) return <span className="gp-tag dim">-</span>;
  const endTime = end || new Date();
  const label = fmtDuration(endTime - start);
  if (end) {
    return (
      <span className="gp-tag good" title={`selesai ${fmtDateTime(end)}`}>
        {label}
      </span>
    );
  }
  return (
    <span className="gp-tag warning" title={`masih berjalan sejak ${fmtDateTime(start)}`}>
      {label} (berjalan)
    </span>
  );
}

function ProgressCell({ done, total, fullWhenComplete }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  const full = done >= total && total > 0;
  return (
    <div className="gp-progress-cell">
      <div className="gp-progress-label">
        {done} / {total} pcs
      </div>
      <div className="gp-progress-bar">
        <div className={`gp-progress-fill ${full && fullWhenComplete ? "full" : ""}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function GantiPola() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const [view, setView] = useState("input");
  const [filter, setFilter] = useState("semua");

  const [inLine, setInLine] = useState("");
  const [draftState, setDraftState] = useState({
    nextId: 2,
    rows: [{ id: 1, spo: "", size: "", jenis: "Part", qty: "", keterangan: "" }],
  });

  const [prepQtyInputs, setPrepQtyInputs] = useState({});
  const [presubQtyInputs, setPresubQtyInputs] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [ajukanMsg, setAjukanMsg] = useState("");
  const [actionError, setActionError] = useState("");

  // Layar depan menampilkan 3 pilihan area (Sewing / Preparation / Presub).
  // Form/tabel baru muncul untuk area yang dipilih saja, supaya tiap stasiun
  // hanya melihat bagian kerjanya sendiri.
  const [area, setArea] = useState(null); // null = layar pilih area; "sewing" | "prep" | "presub"

  // Peta SPO -> Style (read-only, dari tab "data base SPO & STYLE") - dimuat
  // sekali di awal, lalu dipakai untuk auto-tampil nama Style begitu Sewing
  // mengetik No. SPO di form. Gagal/belum ada datanya tidak dianggap error
  // besar - form tetap bisa dipakai normal, cuma hint Style-nya tidak muncul.
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

  const fetchTickets = useCallback(async (opts = {}) => {
    const silent = !!opts.silent;
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/ganti-pola", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Gagal mengambil data Ganti Pola.");
      const parsed = (data.tickets || []).map((t) => ({
        ...t,
        tglRequest: toDate(t.tglRequest),
        tglSelesaiPrep: toDate(t.tglSelesaiPrep),
        tglMulaiPresub: toDate(t.tglMulaiPresub),
        tglSelesaiPresub: toDate(t.tglSelesaiPresub),
      }));
      setTickets(parsed);
      setError(null);
      setLastFetched(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    const id = setInterval(() => fetchTickets({ silent: true }), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchTickets]);

  function addDraftRow() {
    setDraftState((s) => ({
      nextId: s.nextId + 1,
      rows: [...s.rows, { id: s.nextId, spo: "", size: "", jenis: "Part", qty: "", keterangan: "" }],
    }));
  }
  function removeDraftRow(id) {
    setDraftState((s) => {
      const rows = s.rows.filter((r) => r.id !== id);
      if (rows.length === 0) {
        return { nextId: s.nextId + 1, rows: [{ id: s.nextId, spo: "", size: "", jenis: "Part", qty: "", keterangan: "" }] };
      }
      return { ...s, rows };
    });
  }
  function updateDraftRow(id, field, value) {
    setDraftState((s) => ({ ...s, rows: s.rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)) }));
  }

  async function submitDraftRows() {
    setActionError("");
    if (!inLine) {
      setActionError("Pilih Line dulu - berlaku untuk semua baris di bawah.");
      return;
    }
    const filled = draftState.rows.filter((r) => r.spo.trim() || r.size.trim() || r.qty || r.keterangan.trim());
    if (filled.length === 0) {
      setActionError("Isi minimal satu baris SPO/Size/Qty/Keterangan dulu.");
      return;
    }
    const invalid = filled.find(
      (r) => !r.spo.trim() || !r.size.trim() || !r.qty || parseInt(r.qty, 10) <= 0 || !r.keterangan.trim()
    );
    if (invalid) {
      setActionError("Ada baris yang belum lengkap - pastikan SPO, Size, Qty Reject, dan Keterangan semua terisi.");
      return;
    }

    setSubmittingId("__batch__");
    try {
      const res = await fetch("/api/ganti-pola/permintaan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line: inLine,
          rows: filled.map((r) => ({
            spo: r.spo.trim(),
            size: r.size.trim(),
            jenis: r.jenis || "Part",
            qty: r.qty,
            keterangan: r.keterangan.trim(),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Gagal mengajukan permintaan.");

      setAjukanMsg(
        `${filled.length} permintaan ganti pola untuk Line ${inLine} berhasil diajukan sekaligus - sudah muncul di daftar Preparation di bawah.`
      );
      setTimeout(() => setAjukanMsg(""), 4000);
      setDraftState({ nextId: 2, rows: [{ id: 1, spo: "", size: "", jenis: "Part", qty: "", keterangan: "" }] });
      setInLine("");
      await fetchTickets({ silent: true });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmittingId(null);
    }
  }

  async function logProgress(ticketId, station, qtyRaw, clearInput) {
    const qty = parseInt(qtyRaw, 10);
    if (!qty || qty <= 0) {
      setActionError("Isi qty selesai dulu.");
      return;
    }
    setActionError("");
    setSubmittingId(ticketId);
    try {
      const res = await fetch("/api/ganti-pola/progres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, station, qty }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Gagal mencatat progres.");
      clearInput();
      await fetchTickets({ silent: true });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmittingId(null);
    }
  }

  const logPrep = (ticketId) =>
    logProgress(ticketId, "PREPARATION", prepQtyInputs[ticketId], () =>
      setPrepQtyInputs((s) => ({ ...s, [ticketId]: "" }))
    );
  const logPresub = (ticketId) =>
    logProgress(ticketId, "PRESUB", presubQtyInputs[ticketId], () =>
      setPresubQtyInputs((s) => ({ ...s, [ticketId]: "" }))
    );

  const outstandingPrep = useMemo(() => tickets.filter((t) => t.qtyPrep < t.qtyReject), [tickets]);
  const outstandingPresub = useMemo(() => tickets.filter((t) => t.qtyPrep > t.qtyPresub), [tickets]);

  const kpiData = useMemo(() => {
    const totalTiket = tickets.length;
    const totalQtyReject = tickets.reduce((s, t) => s + t.qtyReject, 0);
    const qtyOPrep = outstandingPrep.reduce((s, t) => s + (t.qtyReject - t.qtyPrep), 0);
    const qtyOPresub = outstandingPresub.reduce((s, t) => s + (t.qtyPrep - t.qtyPresub), 0);
    const selesai = tickets.filter((t) => t.qtyPresub >= t.qtyReject && t.qtyReject > 0);
    const qtySelesai = selesai.reduce((s, t) => s + t.qtyReject, 0);

    const selesaiPrep = tickets.filter((t) => t.tglSelesaiPrep);
    const avgPrep = selesaiPrep.length
      ? selesaiPrep.reduce((s, t) => s + (t.tglSelesaiPrep - t.tglRequest), 0) / selesaiPrep.length
      : null;
    const selesaiPresub = tickets.filter((t) => t.tglSelesaiPresub && t.tglMulaiPresub);
    const avgPresub = selesaiPresub.length
      ? selesaiPresub.reduce((s, t) => s + (t.tglSelesaiPresub - t.tglMulaiPresub), 0) / selesaiPresub.length
      : null;

    return [
      { label: "Total Permintaan Masuk", value: totalTiket, unit: "tiket", foot: `${totalQtyReject} pcs qty reject`, tone: "" },
      { label: "Outstanding di Preparation", value: outstandingPrep.length, unit: "tiket", foot: `${qtyOPrep} pcs belum dikerjakan`, tone: "amber" },
      { label: "Outstanding di Presub", value: outstandingPresub.length, unit: "tiket", foot: `${qtyOPresub} pcs menunggu jahit persiapan`, tone: "red" },
      { label: "Selesai (Kembali ke Sewing)", value: selesai.length, unit: "tiket", foot: `${qtySelesai} pcs tuntas`, tone: "green" },
      { label: "Rata-rata Durasi Preparation", value: avgPrep != null ? fmtDuration(avgPrep) : "-", unit: "", foot: `dari ${selesaiPrep.length} tiket selesai cutting`, tone: "" },
      { label: "Rata-rata Durasi Presub", value: avgPresub != null ? fmtDuration(avgPresub) : "-", unit: "", foot: `dari ${selesaiPresub.length} tiket selesai jahit persiapan`, tone: "" },
    ];
  }, [tickets, outstandingPrep, outstandingPresub]);

  const rekapRows = useMemo(() => {
    if (filter === "outstanding") return tickets.filter((t) => t.qtyPresub < t.qtyReject);
    if (filter === "selesai") return tickets.filter((t) => t.qtyPresub >= t.qtyReject);
    return tickets;
  }, [tickets, filter]);

  return (
    <div className="gp-root">
      <div className="gp-topbar">
        <div className="gp-brand">
          <div className="gp-brand-mark">GP</div>
          <div className="gp-brand-text">
            <div className="t1">Monitoring Ganti Pola</div>
            <div className="t2">Pelacakan ganti part reject: Sewing &rarr; Preparation &rarr; Presub</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {lastFetched && !error && (
            <span className="gp-badge gp-badge-dim">DIPERBARUI {fmtDateTime(lastFetched)}</span>
          )}
          <button className="gp-btn-small" onClick={() => fetchTickets()} disabled={loading}>
            &#x21bb; Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="gp-panel-note gp-note-error">
          Gagal memuat data Ganti Pola: <b>{error}</b>. Pastikan <code>GOOGLE_CLIENT_EMAIL</code>, <code>GOOGLE_PRIVATE_KEY</code>,
          dan <code>GOOGLE_SHEET_ID</code> sudah diisi di <code>.env.local</code>, dan spreadsheet-nya sudah di-share ke
          service account tersebut dengan akses <b>Editor</b> (bukan cuma Viewer).
        </div>
      )}

      <div className="gp-view-switch">
        <button className={`gp-view-btn ${view === "input" ? "active" : ""}`} onClick={() => setView("input")}>
          Input Ganti Pola
        </button>
        <button
          className={`gp-view-btn ${view === "rekap" ? "active" : ""}`}
          onClick={() => setView("rekap")}
        >
          Rekap &amp; Outstanding
        </button>
      </div>

      {loading && tickets.length === 0 && !error && <div className="gp-empty-note">Memuat data Ganti Pola...</div>}

      {view === "input" && (
        <div>
          <div className="gp-panel-note">
            Alur: <b>Production Sewing</b> melaporkan part reject &rarr; beban kerja masuk ke <b>Preparation</b> (proses cutting
            ganti pola) &rarr; setelah selesai (bisa dicicil), diteruskan ke <b>Presub</b> (proses jahit persiapan) &rarr; setelah
            Presub selesai, dikirim balik ke Sewing dan permintaan ditutup.
          </div>

          {area === null ? (
            <div>
              <div className="gp-area-heading">Pilih area kerja Anda</div>
              <div className="gp-area-grid">
                {AREAS.map((a) => (
                  <button key={a.key} className="gp-area-card" onClick={() => setArea(a.key)}>
                    <span className={`gp-area-num ${a.key === "sewing" ? "" : "teal"}`}>{a.num}</span>
                    <span className="gp-area-title">{a.title}</span>
                    <span className="gp-area-desc">{a.desc}</span>
                    <span className="gp-area-badge">
                      {a.key === "sewing"
                        ? "Lapor part reject"
                        : `${a.key === "prep" ? outstandingPrep.length : outstandingPresub.length} outstanding`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="gp-area-switch">
              <button className="gp-btn-small" onClick={() => setArea(null)}>
                &larr; Pilih Area
              </button>
              {AREAS.map((a) => (
                <button
                  key={a.key}
                  className={`gp-filter-btn ${area === a.key ? "active" : ""}`}
                  onClick={() => setArea(a.key)}
                >
                  {a.num}. {a.short}
                </button>
              ))}
            </div>
          )}

          {area === "sewing" && (
          <div className="gp-section-title">
            <h2>
              <span className="gp-step-num">1</span>
              Production Sewing &mdash; Ajukan Permintaan Ganti Pola
              <span className="sub">LAPOR REJECT</span>
            </h2>
          </div>
          )}
          {area === "sewing" && (
          <div className="gp-panel">
            <div className="gp-panel-body">
              <div className="gp-panel-note">
                Satu Line bisa sekaligus lapor <b>beberapa SPO</b>, dan satu SPO bisa punya <b>beberapa Size</b> dengan qty &amp;
                alasan reject yang beda-beda &mdash; tambah baris sebanyak yang dibutuhkan, lalu ajukan semuanya sekaligus dalam
                satu kali klik.
              </div>
              <div className="gp-param-row" style={{ marginBottom: 14 }}>
                <div className="gp-field">
                  <label>Line (Peminta)</label>
                  <select className="gp-input" style={{ width: 110 }} value={inLine} onChange={(e) => setInLine(e.target.value)}>
                    <option value="">&mdash; Pilih &mdash;</option>
                    {LINE_OPTIONS.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <span className="hint">berlaku untuk semua baris di bawah</span>
                </div>
              </div>
              <div className="gp-table-scroll">
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th style={{ width: "20%" }}>No. SPO</th>
                      <th style={{ width: "9%" }}>Size</th>
                      <th style={{ width: "13%" }}>Jenis</th>
                      <th style={{ width: "13%" }}>Qty Reject (pcs)</th>
                      <th>Keterangan Reject</th>
                      <th style={{ width: "6%" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftState.rows.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <input
                            className="gp-input"
                            type="text"
                            placeholder="mis. SPO-1250/26"
                            value={r.spo}
                            onChange={(e) => updateDraftRow(r.id, "spo", e.target.value)}
                          />
                          {r.spo.trim() &&
                            (styleBySpo[normalizeSpo(r.spo)] ? (
                              <div className="gp-style-hint">{styleBySpo[normalizeSpo(r.spo)]}</div>
                            ) : (
                              <div className="gp-style-hint dim">Style tidak ditemukan</div>
                            ))}
                        </td>
                        <td>
                          <input
                            className="gp-input"
                            type="text"
                            list="gp-size-list"
                            placeholder="mis. L"
                            value={r.size}
                            onChange={(e) => updateDraftRow(r.id, "size", e.target.value)}
                          />
                        </td>
                        <td>
                          <select
                            className="gp-input"
                            value={r.jenis}
                            onChange={(e) => updateDraftRow(r.id, "jenis", e.target.value)}
                          >
                            {JENIS_OPTIONS.map((j) => (
                              <option key={j} value={j}>
                                {j}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="gp-input"
                            type="text"
                            inputMode="numeric"
                            placeholder="0"
                            value={r.qty}
                            onChange={(e) => updateDraftRow(r.id, "qty", cleanIntInput(e.target.value))}
                          />
                        </td>
                        <td>
                          <input
                            className="gp-input"
                            type="text"
                            list="gp-reject-list"
                            placeholder="Pilih atau ketik alasan reject"
                            value={r.keterangan}
                            onChange={(e) => updateDraftRow(r.id, "keterangan", e.target.value)}
                          />
                        </td>
                        <td>
                          <button className="gp-icon-x" onClick={() => removeDraftRow(r.id)} title="Hapus baris">
                            &#x2715;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <datalist id="gp-size-list">
                {SIZE_OPTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
              <datalist id="gp-reject-list">
                {KETERANGAN_OPTIONS.map((k) => (
                  <option key={k} value={k} />
                ))}
              </datalist>

              <button className="gp-btn-small" style={{ marginTop: 10 }} onClick={addDraftRow}>
                + Tambah Baris
              </button>

              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                <button className="gp-btn-primary" disabled={submittingId === "__batch__"} onClick={submitDraftRows}>
                  {submittingId === "__batch__" ? "Mengajukan..." : "+ Ajukan Semua Permintaan"}
                </button>
                {ajukanMsg && <div className="gp-msg-success">{ajukanMsg}</div>}
              </div>
              {actionError && <div className="gp-msg-error" style={{ marginTop: 10 }}>{actionError}</div>}
            </div>
          </div>
          )}

          {area === "prep" && (
          <div className="gp-section-title sub2">
            <h2>
              <span className="gp-step-num teal">2</span>
              Preparation &mdash; Proses &amp; Kirim ke Presub
              <span className="sub">{outstandingPrep.length} OUTSTANDING</span>
            </h2>
          </div>
          )}
          {area === "prep" && (
          <div className="gp-panel">
            <div className="gp-panel-body">
              <div className="gp-panel-note">
                Daftar di bawah adalah permintaan yang <b>masih ada sisa qty</b> untuk dikerjakan Preparation. Qty yang dicatat
                selesai otomatis diteruskan sebagai beban Presub. Boleh dicicil (tidak harus sekaligus).
              </div>
              <div className="gp-table-scroll">
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Line</th>
                      <th>SPO</th>
                      <th>Size</th>
                      <th>Jenis</th>
                      <th>Style</th>
                      <th>Keterangan</th>
                      <th style={{ textAlign: "right" }}>Qty Reject</th>
                      <th style={{ textAlign: "right" }}>Progress Preparation</th>
                      <th style={{ textAlign: "right" }}>Sisa</th>
                      <th>Usia (sejak diajukan)</th>
                      <th>Qty Selesai Sekarang</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingPrep.map((t) => {
                      const sisa = t.qtyReject - t.qtyPrep;
                      return (
                        <tr key={t.id}>
                          <td>{t.id}</td>
                          <td>
                            <span className="gp-tag info">{t.line}</span>
                          </td>
                          <td>{t.spo}</td>
                          <td>{t.size}</td>
                          <td>
                            <span className={jenisTagClass(t.jenis)}>{t.jenis}</span>
                          </td>
                          <td>{t.style || <span className="gp-tag dim">-</span>}</td>
                          <td>{t.keterangan}</td>
                          <td className="gp-num">{t.qtyReject}</td>
                          <td className="gp-num">
                            <ProgressCell done={t.qtyPrep} total={t.qtyReject} />
                          </td>
                          <td className="gp-num" style={{ color: "var(--amber)" }}>
                            {sisa}
                          </td>
                          <td>
                            <DurasiTag start={t.tglRequest} end={null} />
                          </td>
                          <td>
                            <input
                              className="gp-input gp-qty-input"
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={prepQtyInputs[t.id] || ""}
                              onChange={(e) => setPrepQtyInputs((s) => ({ ...s, [t.id]: cleanIntInput(e.target.value) }))}
                            />
                          </td>
                          <td>
                            <button className="gp-btn-small" disabled={submittingId === t.id} onClick={() => logPrep(t.id)}>
                              Catat &amp; Kirim
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {outstandingPrep.length === 0 && (
                <div className="gp-empty-note">Tidak ada permintaan outstanding di Preparation saat ini.</div>
              )}
            </div>
          </div>
          )}

          {area === "presub" && (
          <div className="gp-section-title sub2">
            <h2>
              <span className="gp-step-num teal">3</span>
              Presub &mdash; Proses Jahit Persiapan &amp; Selesaikan
              <span className="sub">{outstandingPresub.length} OUTSTANDING</span>
            </h2>
          </div>
          )}
          {area === "presub" && (
          <div className="gp-panel">
            <div className="gp-panel-body">
              <div className="gp-panel-note">
                Daftar di bawah adalah qty yang <b>sudah dikirim Preparation</b> tapi belum selesai dikerjakan Presub. Kalau qty
                selesai sudah sama dengan qty reject, permintaan otomatis ditutup dan dianggap selesai dikirim balik ke Sewing.
              </div>
              <div className="gp-table-scroll">
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Line</th>
                      <th>SPO</th>
                      <th>Size</th>
                      <th>Jenis</th>
                      <th>Style</th>
                      <th>Keterangan</th>
                      <th style={{ textAlign: "right" }}>Diterima dari Preparation</th>
                      <th style={{ textAlign: "right" }}>Progress Presub</th>
                      <th style={{ textAlign: "right" }}>Sisa</th>
                      <th>Usia (sejak diterima)</th>
                      <th>Qty Selesai Sekarang</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingPresub.map((t) => {
                      const sisa = t.qtyPrep - t.qtyPresub;
                      return (
                        <tr key={t.id}>
                          <td>{t.id}</td>
                          <td>
                            <span className="gp-tag info">{t.line}</span>
                          </td>
                          <td>{t.spo}</td>
                          <td>{t.size}</td>
                          <td>
                            <span className={jenisTagClass(t.jenis)}>{t.jenis}</span>
                          </td>
                          <td>{t.style || <span className="gp-tag dim">-</span>}</td>
                          <td>{t.keterangan}</td>
                          <td className="gp-num">{t.qtyPrep}</td>
                          <td className="gp-num">
                            <ProgressCell done={t.qtyPresub} total={t.qtyPrep} />
                          </td>
                          <td className="gp-num" style={{ color: "var(--amber)" }}>
                            {sisa}
                          </td>
                          <td>
                            <DurasiTag start={t.tglMulaiPresub} end={null} />
                          </td>
                          <td>
                            <input
                              className="gp-input gp-qty-input"
                              type="text"
                              inputMode="numeric"
                              placeholder="0"
                              value={presubQtyInputs[t.id] || ""}
                              onChange={(e) => setPresubQtyInputs((s) => ({ ...s, [t.id]: cleanIntInput(e.target.value) }))}
                            />
                          </td>
                          <td>
                            <button className="gp-btn-small" disabled={submittingId === t.id} onClick={() => logPresub(t.id)}>
                              Catat Selesai
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {outstandingPresub.length === 0 && (
                <div className="gp-empty-note">Tidak ada beban outstanding di Presub saat ini.</div>
              )}
            </div>
          </div>
          )}
        </div>
      )}

      {view === "rekap" && (
        <div>
          <div className="gp-kpi-grid">
            {kpiData.map((k) => (
              <div key={k.label} className={`gp-kpi ${k.tone}`}>
                <div className="label">{k.label}</div>
                <div className="value">
                  {k.value}
                  {k.unit && <span className="unit">{k.unit}</span>}
                </div>
                <div className="foot">{k.foot}</div>
              </div>
            ))}
          </div>

          <div className="gp-section-title">
            <h2>
              Rekap Seluruh Permintaan Ganti Pola<span className="sub">{rekapRows.length} TIKET</span>
            </h2>
          </div>
          <div className="gp-panel">
            <div className="gp-panel-body">
              <div className="gp-filter-row">
                <button className={`gp-filter-btn ${filter === "semua" ? "active" : ""}`} onClick={() => setFilter("semua")}>
                  Semua
                </button>
                <button
                  className={`gp-filter-btn ${filter === "outstanding" ? "active" : ""}`}
                  onClick={() => setFilter("outstanding")}
                >
                  Outstanding
                </button>
                <button className={`gp-filter-btn ${filter === "selesai" ? "active" : ""}`} onClick={() => setFilter("selesai")}>
                  Selesai
                </button>
              </div>
              <div className="gp-table-scroll">
                <table className="gp-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Line</th>
                      <th>SPO</th>
                      <th>Size</th>
                      <th>Jenis</th>
                      <th>Style</th>
                      <th>Keterangan</th>
                      <th>Tgl Request</th>
                      <th style={{ textAlign: "right" }}>Qty Reject</th>
                      <th style={{ textAlign: "right" }}>Progress Preparation</th>
                      <th style={{ textAlign: "right" }}>Progress Presub</th>
                      <th>Durasi Preparation</th>
                      <th>Durasi Presub</th>
                      <th>Total Durasi</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapRows.map((t) => {
                      const s = statusOf(t);
                      return (
                        <tr key={t.id}>
                          <td>{t.id}</td>
                          <td>
                            <span className="gp-tag info">{t.line}</span>
                          </td>
                          <td>{t.spo}</td>
                          <td>{t.size}</td>
                          <td>
                            <span className={jenisTagClass(t.jenis)}>{t.jenis}</span>
                          </td>
                          <td>{t.style || <span className="gp-tag dim">-</span>}</td>
                          <td>{t.keterangan}</td>
                          <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(t.tglRequest)}</td>
                          <td className="gp-num">{t.qtyReject}</td>
                          <td className="gp-num">
                            <ProgressCell done={t.qtyPrep} total={t.qtyReject} fullWhenComplete />
                          </td>
                          <td className="gp-num">
                            <ProgressCell done={t.qtyPresub} total={t.qtyReject} fullWhenComplete />
                          </td>
                          <td>
                            <DurasiTag start={t.tglRequest} end={t.tglSelesaiPrep} />
                          </td>
                          <td>
                            <DurasiTag start={t.tglMulaiPresub} end={t.tglSelesaiPresub} />
                          </td>
                          <td>
                            <DurasiTag start={t.tglRequest} end={t.tglSelesaiPresub} />
                          </td>
                          <td>
                            <span className={statusTagClass(s)}>{s}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rekapRows.length === 0 && <div className="gp-empty-note">Belum ada data untuk filter ini.</div>}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .gp-root {
          font-family: var(--font-body);
        }
        .gp-topbar {
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
        .gp-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .gp-brand-mark {
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
        .gp-brand-text .t1 {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 18px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--navy);
        }
        .gp-brand-text .t2 {
          font-family: var(--font-mono);
          font-size: 10.5px;
          color: var(--text-faint);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .gp-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px 9px;
          border-radius: 2px;
          white-space: nowrap;
        }
        .gp-badge-dim {
          color: var(--text-faint);
          border: 1px solid var(--steel);
        }

        .gp-view-switch {
          display: flex;
          gap: 8px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .gp-view-btn {
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
        .gp-view-btn.active {
          background: var(--navy);
          color: #fff;
          border-color: var(--navy);
        }

        .gp-section-title {
          margin: 22px 0 12px;
        }
        .gp-section-title h2 {
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
        .gp-section-title h2 .sub {
          font-family: var(--font-mono);
          font-weight: 400;
          font-size: 10.5px;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.65);
          text-transform: uppercase;
        }
        .gp-section-title.sub2 h2 {
          background: var(--teal-dim);
        }
        .gp-area-heading {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--navy);
          margin: 18px 0 12px;
        }
        .gp-area-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }
        @media (max-width: 760px) {
          .gp-area-grid {
            grid-template-columns: 1fr;
          }
        }
        .gp-area-card {
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
        .gp-area-card:hover {
          border-color: var(--teal);
          box-shadow: 0 0 0 2px rgba(58, 183, 196, 0.2);
        }
        .gp-area-num {
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
        .gp-area-num.teal {
          background: var(--teal-dim);
        }
        .gp-area-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 17px;
          color: var(--navy);
        }
        .gp-area-desc {
          font-size: 12.5px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .gp-area-badge {
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--teal-dim);
          border: 1px solid currentColor;
          border-radius: 2px;
          padding: 2px 8px;
        }
        .gp-area-switch {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 4px;
        }

        .gp-panel {
          background: var(--panel);
          border: 1px solid var(--steel);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .gp-panel-body {
          padding: 18px 20px;
        }
        .gp-panel-note {
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
        .gp-panel-note b {
          color: var(--text);
        }
        .gp-note-error {
          border-color: var(--red);
          color: var(--red);
        }
        .gp-note-error code {
          font-family: var(--font-mono);
          background: rgba(192, 57, 43, 0.08);
          padding: 1px 5px;
          border-radius: 2px;
        }

        /* .gp-tag dipakai juga oleh DurasiTag/ProgressCell (komponen anak terpisah),
           jadi harus :global - styled-jsx cuma otomatis men-scope elemen yang
           ditulis langsung di JSX komponen pemilik <style jsx> ini. */
        :global(.gp-tag) {
          font-family: var(--font-mono);
          font-size: 9.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 2px 7px;
          border-radius: 2px;
          border: 1px solid currentColor;
          white-space: nowrap;
        }
        :global(.gp-tag.good) {
          color: var(--green);
        }
        :global(.gp-tag.warning) {
          color: var(--amber);
        }
        :global(.gp-tag.critical) {
          color: var(--red);
        }
        :global(.gp-tag.dim) {
          color: var(--text-faint);
        }
        :global(.gp-tag.info) {
          color: var(--teal-dim);
        }

        .gp-param-row {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          align-items: flex-end;
        }
        .gp-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .gp-field label {
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .gp-field .hint {
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--text-faint);
        }
        .gp-style-hint {
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--teal-dim);
          margin-top: 4px;
        }
        .gp-style-hint.dim {
          color: var(--text-faint);
          font-style: italic;
        }
        :global(.gp-input) {
          background: var(--panel);
          border: 1px solid var(--steel);
          border-radius: 3px;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 14px;
          padding: 8px 10px;
          width: 180px;
        }
        :global(.gp-input:focus) {
          outline: none;
          border-color: var(--teal);
          box-shadow: 0 0 0 2px rgba(58, 183, 196, 0.25);
        }
        .gp-btn-primary {
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
        .gp-btn-primary:hover {
          opacity: 0.88;
        }
        .gp-btn-primary:disabled {
          background: var(--steel);
          color: var(--text-faint);
          cursor: not-allowed;
        }
        .gp-btn-small {
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
        .gp-btn-small:hover {
          background: rgba(58, 183, 196, 0.1);
        }
        .gp-btn-small:disabled {
          border-color: var(--steel);
          color: var(--text-faint);
          cursor: not-allowed;
          background: transparent;
        }
        .gp-icon-x {
          background: transparent;
          border: 1px solid var(--steel);
          color: var(--text-muted);
          border-radius: 3px;
          width: 26px;
          height: 26px;
          cursor: pointer;
        }
        .gp-msg-success {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--green);
        }
        .gp-msg-error {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--red);
        }

        .gp-table-scroll {
          overflow-x: auto;
        }
        :global(table.gp-table) {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-mono);
          font-size: 12px;
        }
        :global(table.gp-table th) {
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
        :global(table.gp-table td) {
          padding: 8px 7px;
          border-top: 1px solid var(--steel);
          vertical-align: middle;
        }
        :global(.gp-num) {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        :global(.gp-qty-input) {
          width: 70px;
          text-align: right;
        }
        /* ProgressCell juga komponen anak terpisah - sama alasannya, harus :global. */
        :global(.gp-progress-cell) {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 90px;
        }
        :global(.gp-progress-bar) {
          height: 6px;
          border-radius: 3px;
          background: var(--steel);
          overflow: hidden;
        }
        :global(.gp-progress-fill) {
          height: 100%;
          background: var(--teal);
          border-radius: 3px;
        }
        :global(.gp-progress-fill.full) {
          background: var(--green);
        }
        :global(.gp-progress-label) {
          font-size: 10.5px;
          color: var(--text-muted);
        }
        .gp-empty-note {
          color: var(--text-faint);
          font-family: var(--font-body);
          font-size: 12.5px;
          padding: 16px 4px;
        }

        .gp-kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        @media (max-width: 760px) {
          .gp-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .gp-kpi {
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
        .gp-kpi.amber {
          border-left-color: var(--amber);
        }
        .gp-kpi.red {
          border-left-color: var(--red);
        }
        .gp-kpi.green {
          border-left-color: var(--green);
        }
        .gp-kpi .label {
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 10.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .gp-kpi .value {
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 22px;
          color: var(--navy);
          font-variant-numeric: tabular-nums;
          line-height: 1.18;
        }
        .gp-kpi .value .unit {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 400;
          margin-left: 4px;
        }
        .gp-kpi .foot {
          font-family: var(--font-body);
          font-size: 10.5px;
          color: var(--text-muted);
        }

        .gp-filter-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .gp-filter-btn {
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
        .gp-filter-btn.active {
          background: var(--teal-dim);
          color: #fff;
          border-color: var(--teal-dim);
        }

        .gp-step-num {
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
        .gp-step-num.teal {
          background: var(--teal-dim);
        }
      `}</style>
    </div>
  );
}
