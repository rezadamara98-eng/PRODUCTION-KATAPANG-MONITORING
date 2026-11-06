"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Monitoring Memo Material: Permintaan (1) -> Acc 3R (2) -> Acc PPIC (3).
// Pola dan tampilan mengikuti Ganti Pola. Data tersimpan di 2 tab Google
// Spreadsheet (MEMO MATERIAL - PERMINTAAN dan MEMO MATERIAL - KEPUTUSAN).

const SATUAN_OPTIONS = ["SF", "Mtr", "Pcs"];
const REFRESH_MS = 25000;
const LATE_MS = 48 * 60 * 60 * 1000; // lewat 48 jam masih menunggu = merah
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const AREAS = [
  { key: "permintaan", num: "1", short: "Permintaan", title: "Permintaan Memo", desc: "Ajukan memo material: SPO, Style, Qty, dan Satuan." },
  { key: "r3", num: "2", short: "Acc 3R", title: "Acc 3R", desc: "Setujui atau tolak memo yang masuk dari permintaan." },
  { key: "ppic", num: "3", short: "Acc PPIC", title: "Acc PPIC", desc: "Setujui atau tolak memo yang sudah di-Acc 3R." },
];
const SORT_OPTIONS = [
  { value: "tgl_desc", label: "Tanggal masuk: terbaru" },
  { value: "tgl_asc", label: "Tanggal masuk: terlama" },
];
const STATUS_LABEL = {
  MENUNGGU_3R: "Menunggu 3R",
  MENUNGGU_PPIC: "Menunggu PPIC",
  DISETUJUI: "Disetujui",
  DITOLAK_3R: "Ditolak 3R",
  DITOLAK_PPIC: "Ditolak PPIC",
};

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
  return Number(q || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}
// Qty boleh desimal (meter/SF): hanya angka dan satu pemisah desimal, maks 2 digit.
function cleanQtyInput(value) {
  let v = String(value).replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const firstDot = v.indexOf(".");
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  }
  return v;
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
  if (status === "DISETUJUI") return "mm-tag good";
  if (status === "DITOLAK_3R" || status === "DITOLAK_PPIC") return "mm-tag critical";
  return "mm-tag warning";
}
function decisionTagClass(k) {
  return k === "ACC" ? "mm-tag good" : "mm-tag critical";
}
function cmpDate(a, b, dir) {
  const ta = a ? a.getTime() : null;
  const tb = b ? b.getTime() : null;
  if (ta == null && tb == null) return 0;
  if (ta == null) return 1;
  if (tb == null) return -1;
  return (ta - tb) * dir;
}
function applyView(list, search, sortKey, dateOf) {
  const q = normalizeSpo(search);
  const out = q ? list.filter((m) => normalizeSpo(m.spo).includes(q)) : list;
  return [...out].sort((a, b) => cmpDate(dateOf(a), dateOf(b), sortKey === "tgl_asc" ? 1 : -1));
}

// Durasi start->end sebagai tag. Kalau "end" belum ada, tahap itu masih
// menunggu: dihitung sampai sekarang, merah kalau sudah lewat 48 jam.
function DurasiTag({ start, end }) {
  if (!start) return <span className="mm-tag dim">-</span>;
  const endTime = end || new Date();
  const label = fmtDuration(endTime - start);
  if (end) {
    return (
      <span className="mm-tag good" title={`selesai ${fmtDateTime(end)}`}>
        {label}
      </span>
    );
  }
  const late = endTime - start > LATE_MS;
  return (
    <span
      className={late ? "mm-tag critical" : "mm-tag warning"}
      title={`masih menunggu sejak ${fmtDateTime(start)}${late ? " - lebih dari 48 jam" : ""}`}
    >
      {label} (menunggu)
    </span>
  );
}

// Dua baris (tanggal di atas, jam di bawah) supaya kolom Tgl Masuk tidak lebar.
function TglMasukCell({ d }) {
  if (!d) return <td>-</td>;
  return (
    <td style={{ whiteSpace: "nowrap" }}>
      <div>{fmtDate(d)}</div>
      <div style={{ fontSize: 10.5, color: "var(--text-faint)" }}>{fmtJam(d)}</div>
    </td>
  );
}

const newDraftRow = (id) => ({ id, spo: "", qty: "", satuan: "", keterangan: "" });

export default function MemoMaterial() {
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const [view, setView] = useState("input");
  const [filter, setFilter] = useState("semua");
  const [area, setArea] = useState(null); // null = layar pilih area

  const [draftState, setDraftState] = useState({ nextId: 2, rows: [newDraftRow(1)] });
  const [alasanInputs, setAlasanInputs] = useState({});
  const [submittingId, setSubmittingId] = useState(null);
  const [okMsg, setOkMsg] = useState("");
  const [actionError, setActionError] = useState("");

  const [search, setSearch] = useState({ r3: "", ppic: "" });
  const [sortBy, setSortBy] = useState({ r3: "tgl_desc", ppic: "tgl_desc" });

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

  const fetchMemos = useCallback(async (opts = {}) => {
    const silent = !!opts.silent;
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/memo-material", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Gagal mengambil data Memo Material.");
      setMemos(
        (data.memos || []).map((m) => ({
          ...m,
          tglRequest: toDate(m.tglRequest),
          tgl3R: toDate(m.tgl3R),
          tglPPIC: toDate(m.tglPPIC),
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
    fetchMemos();
    const id = setInterval(() => fetchMemos({ silent: true }), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchMemos]);

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

  async function submitDraftRows() {
    setActionError("");
    const filled = draftState.rows.filter((r) => r.spo.trim() || r.qty || r.satuan || r.keterangan.trim());
    if (filled.length === 0) {
      setActionError("Isi minimal satu baris SPO, Qty, dan Satuan dulu.");
      return;
    }
    const invalid = filled.find((r) => !r.spo.trim() || !(parseFloat(r.qty) > 0) || !r.satuan);
    if (invalid) {
      setActionError("Ada baris yang belum lengkap - pastikan SPO, Qty (lebih dari 0), dan Satuan semua terisi.");
      return;
    }

    setSubmittingId("__batch__");
    try {
      const res = await fetch("/api/memo-material/permintaan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: filled.map((r) => ({
            spo: r.spo.trim(),
            qty: r.qty,
            satuan: r.satuan,
            keterangan: r.keterangan.trim(),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Gagal mengajukan memo.");
      setOkMsg(`${filled.length} memo berhasil diajukan (${(data.ids || []).join(", ")}) - sekarang menunggu Acc 3R.`);
      setTimeout(() => setOkMsg(""), 5000);
      setDraftState({ nextId: 2, rows: [newDraftRow(1)] });
      await fetchMemos({ silent: true });
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSubmittingId(null);
    }
  }

  async function decide(memo, tahap, keputusan) {
    setActionError("");
    const alasan = (alasanInputs[memo.id] || "").trim();
    if (keputusan === "TOLAK" && !alasan) {
      setActionError(`Isi alasan penolakan dulu untuk memo ${memo.id}.`);
      return;
    }
    const verb = keputusan === "ACC" ? "Acc" : "Tolak";
    if (!window.confirm(`${verb} memo ${memo.id} (SPO ${memo.spo}, ${fmtQty(memo.qty)} ${memo.satuan}) sebagai ${tahap === "3R" ? "3R" : "PPIC"}?`)) {
      return;
    }
    setSubmittingId(memo.id);
    try {
      const res = await fetch("/api/memo-material/keputusan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoId: memo.id, tahap, keputusan, alasan }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Gagal mencatat keputusan.");
      setAlasanInputs((s) => ({ ...s, [memo.id]: "" }));
      setOkMsg(`Memo ${memo.id} ${keputusan === "ACC" ? "di-Acc" : "ditolak"} oleh ${tahap}.`);
      setTimeout(() => setOkMsg(""), 4000);
      await fetchMemos({ silent: true });
    } catch (err) {
      setActionError(err.message);
      await fetchMemos({ silent: true });
    } finally {
      setSubmittingId(null);
    }
  }

  const waiting3R = useMemo(() => memos.filter((m) => m.status === "MENUNGGU_3R"), [memos]);
  const waitingPpic = useMemo(() => memos.filter((m) => m.status === "MENUNGGU_PPIC"), [memos]);
  const visible3R = useMemo(
    () => applyView(waiting3R, search.r3, sortBy.r3, (m) => m.tglRequest),
    [waiting3R, search.r3, sortBy.r3]
  );
  const visiblePpic = useMemo(
    () => applyView(waitingPpic, search.ppic, sortBy.ppic, (m) => m.tgl3R),
    [waitingPpic, search.ppic, sortBy.ppic]
  );

  const kpiData = useMemo(() => {
    const disetujui = memos.filter((m) => m.status === "DISETUJUI");
    const ditolak = memos.filter((m) => m.status === "DITOLAK_3R" || m.status === "DITOLAK_PPIC");
    const done = disetujui.filter((m) => m.tglRequest && m.tglPPIC);
    const avg = done.length ? done.reduce((s, m) => s + (m.tglPPIC - m.tglRequest), 0) / done.length : null;
    return [
      { label: "Total Memo Masuk", value: memos.length, unit: "memo", foot: "sejak awal pencatatan", tone: "" },
      { label: "Menunggu Acc 3R", value: waiting3R.length, unit: "memo", foot: "belum diputuskan 3R", tone: "amber" },
      { label: "Menunggu Acc PPIC", value: waitingPpic.length, unit: "memo", foot: "sudah Acc 3R, belum PPIC", tone: "amber" },
      { label: "Disetujui", value: disetujui.length, unit: "memo", foot: "Acc 3R dan Acc PPIC", tone: "green" },
      { label: "Ditolak", value: ditolak.length, unit: "memo", foot: "ditolak 3R atau PPIC", tone: "red" },
      { label: "Rata-rata Sampai Disetujui", value: avg != null ? fmtDuration(avg) : "-", unit: "", foot: `dari ${done.length} memo disetujui`, tone: "" },
    ];
  }, [memos, waiting3R, waitingPpic]);

  const rekapRows = useMemo(() => {
    if (filter === "menunggu") return memos.filter((m) => m.status === "MENUNGGU_3R" || m.status === "MENUNGGU_PPIC");
    if (filter === "disetujui") return memos.filter((m) => m.status === "DISETUJUI");
    if (filter === "ditolak") return memos.filter((m) => m.status === "DITOLAK_3R" || m.status === "DITOLAK_PPIC");
    return memos;
  }, [memos, filter]);

  return (
    <div className="mm-root">
      <div className="mm-topbar">
        <div className="mm-brand">
          <div className="mm-brand-mark">MM</div>
          <div className="mm-brand-text">
            <div className="t1">Monitoring Memo Material</div>
            <div className="t2">Pelacakan memo material: Permintaan &rarr; Acc 3R &rarr; Acc PPIC</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {lastFetched && !error && <span className="mm-badge mm-badge-dim">DIPERBARUI {fmtDateTime(lastFetched)}</span>}
          <button className="mm-btn-small" onClick={() => fetchMemos()} disabled={loading}>
            &#x21bb; Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mm-panel-note mm-note-error">
          Gagal memuat data Memo Material: <b>{error}</b>. Pastikan <code>GOOGLE_CLIENT_EMAIL</code>,{" "}
          <code>GOOGLE_PRIVATE_KEY</code>, dan <code>GOOGLE_SHEET_ID</code> sudah diisi, dan spreadsheet-nya sudah di-share ke
          service account tersebut dengan akses <b>Editor</b>.
        </div>
      )}

      <div className="mm-view-switch">
        <button className={`mm-view-btn ${view === "input" ? "active" : ""}`} onClick={() => setView("input")}>
          Input Memo Material
        </button>
        <button className={`mm-view-btn ${view === "rekap" ? "active" : ""}`} onClick={() => setView("rekap")}>
          Rekap &amp; Status
        </button>
      </div>

      {loading && memos.length === 0 && !error && <div className="mm-empty-note">Memuat data Memo Material...</div>}

      {view === "input" && (
        <div>
          <div className="mm-panel-note">
            Alur: <b>Permintaan</b> mengajukan memo material &rarr; <b>3R</b> meng-Acc atau menolak &rarr; kalau di-Acc, memo
            masuk ke <b>PPIC</b> untuk di-Acc atau ditolak. Memo yang ditolak di salah satu tahap dianggap selesai.
          </div>

          {area === null ? (
            <div>
              <div className="mm-area-heading">Pilih area kerja Anda</div>
              <div className="mm-area-grid">
                {AREAS.map((a) => (
                  <button key={a.key} className="mm-area-card" onClick={() => setArea(a.key)}>
                    <span className={`mm-area-num ${a.key === "permintaan" ? "" : "teal"}`}>{a.num}</span>
                    <span className="mm-area-title">{a.title}</span>
                    <span className="mm-area-desc">{a.desc}</span>
                    <span className="mm-area-badge">
                      {a.key === "permintaan"
                        ? "Ajukan memo"
                        : `${a.key === "r3" ? waiting3R.length : waitingPpic.length} menunggu`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mm-area-switch">
              <button className="mm-btn-small" onClick={() => setArea(null)}>
                &larr; Pilih Area
              </button>
              {AREAS.map((a) => (
                <button
                  key={a.key}
                  className={`mm-filter-btn ${area === a.key ? "active" : ""}`}
                  onClick={() => setArea(a.key)}
                >
                  {a.num}. {a.short}
                </button>
              ))}
            </div>
          )}

          {okMsg && <div className="mm-msg-success" style={{ margin: "10px 0" }}>{okMsg}</div>}
          {actionError && <div className="mm-msg-error" style={{ margin: "10px 0" }}>{actionError}</div>}

          {area === "permintaan" && (
            <div>
              <div className="mm-section-title">
                <h2>
                  <span className="mm-step-num">1</span>
                  Permintaan &mdash; Ajukan Memo Material
                  <span className="sub">MEMO BARU</span>
                </h2>
              </div>
              <div className="mm-panel">
                <div className="mm-panel-body">
                  <div className="mm-panel-note">
                    Isi <b>No. SPO</b>, nama <b>Style</b> akan terisi otomatis dari data SPO. Lalu isi <b>Qty</b> dan pilih{" "}
                    <b>Satuan</b>. Tambah baris kalau memo lebih dari satu SPO, lalu ajukan semuanya sekaligus.
                  </div>
                  <div className="mm-table-scroll">
                    <table className="mm-table">
                      <thead>
                        <tr>
                          <th style={{ width: "18%" }}>No. SPO</th>
                          <th style={{ width: "27%" }}>Style (otomatis)</th>
                          <th style={{ width: "13%" }}>Qty</th>
                          <th style={{ width: "12%" }}>Satuan</th>
                          <th>Keterangan (opsional)</th>
                          <th style={{ width: "6%" }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {draftState.rows.map((r) => {
                          const key = normalizeSpo(r.spo);
                          const style = key ? styleBySpo[key] : "";
                          return (
                            <tr key={r.id}>
                              <td>
                                <input
                                  className="mm-input"
                                  type="text"
                                  placeholder="mis. SPO-1250/26"
                                  value={r.spo}
                                  onChange={(e) => updateDraftRow(r.id, "spo", e.target.value)}
                                />
                              </td>
                              <td>
                                {!r.spo.trim() ? (
                                  <div className="mm-style-auto dim">terisi otomatis setelah SPO diketik</div>
                                ) : style ? (
                                  <div className="mm-style-auto">{style}</div>
                                ) : (
                                  <div className="mm-style-auto dim">Style tidak ditemukan</div>
                                )}
                              </td>
                              <td>
                                <input
                                  className="mm-input"
                                  type="text"
                                  inputMode="decimal"
                                  placeholder="0"
                                  value={r.qty}
                                  onChange={(e) => updateDraftRow(r.id, "qty", cleanQtyInput(e.target.value))}
                                />
                              </td>
                              <td>
                                <select
                                  className="mm-input"
                                  value={r.satuan}
                                  onChange={(e) => updateDraftRow(r.id, "satuan", e.target.value)}
                                >
                                  <option value="">Pilih</option>
                                  {SATUAN_OPTIONS.map((s) => (
                                    <option key={s} value={s}>
                                      {s}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td>
                                <input
                                  className="mm-input"
                                  type="text"
                                  placeholder="mis. nama material"
                                  value={r.keterangan}
                                  onChange={(e) => updateDraftRow(r.id, "keterangan", e.target.value)}
                                />
                              </td>
                              <td>
                                <button className="mm-icon-x" onClick={() => removeDraftRow(r.id)} title="Hapus baris">
                                  &#x2715;
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <button className="mm-btn-small" style={{ marginTop: 10 }} onClick={addDraftRow}>
                    + Tambah Baris
                  </button>
                  <div style={{ marginTop: 16 }}>
                    <button className="mm-btn-primary" disabled={submittingId === "__batch__"} onClick={submitDraftRows}>
                      {submittingId === "__batch__" ? "Mengajukan..." : "+ Ajukan Semua Memo"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(area === "r3" || area === "ppic") && (
            <div>
              {(() => {
                const is3R = area === "r3";
                const key = is3R ? "r3" : "ppic";
                const rows = is3R ? visible3R : visiblePpic;
                const total = is3R ? waiting3R : waitingPpic;
                const tahap = is3R ? "3R" : "PPIC";
                return (
                  <div>
                    <div className="mm-section-title sub2">
                      <h2>
                        <span className="mm-step-num teal">{is3R ? "2" : "3"}</span>
                        {is3R ? "Acc 3R" : "Acc PPIC"} &mdash; {is3R ? "Setujui atau Tolak Memo Masuk" : "Setujui atau Tolak Memo dari 3R"}
                        <span className="sub">{total.length} MENUNGGU</span>
                      </h2>
                    </div>
                    <div className="mm-panel">
                      <div className="mm-panel-body">
                        <div className="mm-panel-note">
                          {is3R
                            ? "Daftar di bawah adalah memo yang menunggu keputusan 3R. "
                            : "Daftar di bawah adalah memo yang sudah di-Acc 3R dan menunggu keputusan PPIC. "}
                          Tekan <b>Acc</b> untuk menyetujui, atau isi alasan lalu tekan <b>Tolak</b>. <b>Tgl Masuk</b> ={" "}
                          {is3R ? "kapan memo diajukan." : "kapan memo di-Acc 3R."} Usia berwarna{" "}
                          <b style={{ color: "var(--red)" }}>merah</b> berarti sudah lebih dari 48 jam.
                        </div>
                        {total.length > 0 && (
                          <div className="mm-line-bar">
                            <div className="mm-field">
                              <label>Cari SPO</label>
                              <input
                                className="mm-input"
                                style={{ width: 160 }}
                                type="text"
                                placeholder="mis. 1248/26"
                                value={search[key]}
                                onChange={(e) => setSearch((s) => ({ ...s, [key]: e.target.value }))}
                              />
                            </div>
                            <div className="mm-field">
                              <label>Urutkan</label>
                              <select
                                className="mm-input"
                                style={{ width: 210 }}
                                value={sortBy[key]}
                                onChange={(e) => setSortBy((s) => ({ ...s, [key]: e.target.value }))}
                              >
                                {SORT_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <span className="mm-line-count">
                              Menampilkan {rows.length} dari {total.length} memo
                            </span>
                          </div>
                        )}
                        <div className="mm-table-scroll">
                          <table className="mm-table">
                            <thead>
                              <tr>
                                <th>ID</th>
                                <th>Tgl Masuk</th>
                                <th>SPO</th>
                                <th>Style</th>
                                <th style={{ textAlign: "right" }}>Qty</th>
                                <th>Keterangan</th>
                                <th>{is3R ? "Usia (sejak diajukan)" : "Usia (sejak Acc 3R)"}</th>
                                <th>Alasan (wajib jika Tolak)</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((m) => (
                                <tr key={m.id}>
                                  <td>{m.id}</td>
                                  <TglMasukCell d={is3R ? m.tglRequest : m.tgl3R} />
                                  <td>{m.spo}</td>
                                  <td>{m.style || <span className="mm-tag dim">-</span>}</td>
                                  <td className="mm-num">
                                    {fmtQty(m.qty)} {m.satuan}
                                  </td>
                                  <td>{m.keterangan || <span className="mm-tag dim">-</span>}</td>
                                  <td>
                                    <DurasiTag start={is3R ? m.tglRequest : m.tgl3R} end={null} />
                                  </td>
                                  <td>
                                    <input
                                      className="mm-input mm-alasan-input"
                                      type="text"
                                      placeholder="alasan penolakan"
                                      value={alasanInputs[m.id] || ""}
                                      onChange={(e) => setAlasanInputs((s) => ({ ...s, [m.id]: e.target.value }))}
                                    />
                                  </td>
                                  <td>
                                    <div className="mm-decision-btns">
                                      <button className="mm-btn-ok" disabled={submittingId === m.id} onClick={() => decide(m, tahap, "ACC")}>
                                        Acc
                                      </button>
                                      <button className="mm-btn-no" disabled={submittingId === m.id} onClick={() => decide(m, tahap, "TOLAK")}>
                                        Tolak
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {total.length === 0 && (
                          <div className="mm-empty-note">
                            {is3R ? "Tidak ada memo yang menunggu Acc 3R saat ini." : "Tidak ada memo yang menunggu Acc PPIC saat ini."}
                          </div>
                        )}
                        {total.length > 0 && rows.length === 0 && (
                          <div className="mm-empty-note">Tidak ada memo yang cocok dengan pencarian.</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {view === "rekap" && (
        <div>
          <div className="mm-kpi-grid">
            {kpiData.map((k) => (
              <div key={k.label} className={`mm-kpi ${k.tone}`}>
                <div className="label">{k.label}</div>
                <div className="value">
                  {k.value}
                  {k.unit && <span className="unit">{k.unit}</span>}
                </div>
                <div className="foot">{k.foot}</div>
              </div>
            ))}
          </div>

          <div className="mm-section-title">
            <h2>
              Rekap Seluruh Memo Material<span className="sub">{rekapRows.length} MEMO</span>
            </h2>
          </div>
          <div className="mm-panel">
            <div className="mm-panel-body">
              <div className="mm-filter-row">
                {[
                  ["semua", "Semua"],
                  ["menunggu", "Menunggu"],
                  ["disetujui", "Disetujui"],
                  ["ditolak", "Ditolak"],
                ].map(([val, label]) => (
                  <button key={val} className={`mm-filter-btn ${filter === val ? "active" : ""}`} onClick={() => setFilter(val)}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="mm-table-scroll">
                <table className="mm-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Tgl Request</th>
                      <th>SPO</th>
                      <th>Style</th>
                      <th style={{ textAlign: "right" }}>Qty</th>
                      <th>Keterangan</th>
                      <th>Status</th>
                      <th>Keputusan 3R</th>
                      <th>Keputusan PPIC</th>
                      <th>Alasan Tolak</th>
                      <th>Waktu di 3R</th>
                      <th>Waktu di PPIC</th>
                      <th>Total Durasi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapRows.map((m) => {
                      const alasan = m.status === "DITOLAK_3R" ? m.alasan3R : m.status === "DITOLAK_PPIC" ? m.alasanPPIC : "";
                      const akhir = m.tglPPIC || (m.status === "DITOLAK_3R" ? m.tgl3R : null);
                      return (
                        <tr key={m.id}>
                          <td>{m.id}</td>
                          <TglMasukCell d={m.tglRequest} />
                          <td>{m.spo}</td>
                          <td>{m.style || <span className="mm-tag dim">-</span>}</td>
                          <td className="mm-num">
                            {fmtQty(m.qty)} {m.satuan}
                          </td>
                          <td>{m.keterangan || <span className="mm-tag dim">-</span>}</td>
                          <td>
                            <span className={statusTagClass(m.status)}>{STATUS_LABEL[m.status]}</span>
                          </td>
                          <td>
                            {m.keputusan3R ? (
                              <div>
                                <span className={decisionTagClass(m.keputusan3R)}>{m.keputusan3R}</span>
                                <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 3 }}>{fmtDateTime(m.tgl3R)}</div>
                              </div>
                            ) : (
                              <span className="mm-tag dim">-</span>
                            )}
                          </td>
                          <td>
                            {m.keputusanPPIC ? (
                              <div>
                                <span className={decisionTagClass(m.keputusanPPIC)}>{m.keputusanPPIC}</span>
                                <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 3 }}>{fmtDateTime(m.tglPPIC)}</div>
                              </div>
                            ) : (
                              <span className="mm-tag dim">-</span>
                            )}
                          </td>
                          <td style={{ maxWidth: 200 }}>{alasan || <span className="mm-tag dim">-</span>}</td>
                          <td>
                            <DurasiTag start={m.tglRequest} end={m.tgl3R} />
                          </td>
                          <td>
                            <DurasiTag start={m.keputusan3R === "ACC" ? m.tgl3R : null} end={m.tglPPIC} />
                          </td>
                          <td>
                            <DurasiTag start={m.tglRequest} end={akhir} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {rekapRows.length === 0 && <div className="mm-empty-note">Belum ada data untuk filter ini.</div>}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .mm-root {
          font-family: var(--font-body);
        }
        .mm-topbar {
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
        .mm-brand {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .mm-brand-mark {
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
        .mm-brand-text .t1 {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 18px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--navy);
        }
        .mm-brand-text .t2 {
          font-family: var(--font-mono);
          font-size: 10.5px;
          color: var(--text-faint);
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-top: 2px;
        }
        .mm-badge {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          padding: 4px 9px;
          border-radius: 2px;
          white-space: nowrap;
        }
        .mm-badge-dim {
          color: var(--text-faint);
          border: 1px solid var(--steel);
        }

        .mm-view-switch {
          display: flex;
          gap: 8px;
          margin-bottom: 18px;
          flex-wrap: wrap;
        }
        .mm-view-btn {
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
        .mm-view-btn.active {
          background: var(--navy);
          color: #fff;
          border-color: var(--navy);
        }

        .mm-section-title {
          margin: 22px 0 12px;
        }
        .mm-section-title h2 {
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
        .mm-section-title h2 .sub {
          font-family: var(--font-mono);
          font-weight: 400;
          font-size: 10.5px;
          letter-spacing: 0.04em;
          color: rgba(255, 255, 255, 0.65);
          text-transform: uppercase;
        }
        .mm-section-title.sub2 h2 {
          background: var(--teal-dim);
        }
        .mm-area-heading {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--navy);
          margin: 18px 0 12px;
        }
        .mm-area-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          margin-bottom: 18px;
        }
        @media (max-width: 760px) {
          .mm-area-grid {
            grid-template-columns: 1fr;
          }
        }
        .mm-area-card {
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
        .mm-area-card:hover {
          border-color: var(--teal);
          box-shadow: 0 0 0 2px rgba(58, 183, 196, 0.2);
        }
        .mm-area-num {
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
        .mm-area-num.teal {
          background: var(--teal-dim);
        }
        .mm-area-title {
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 17px;
          color: var(--navy);
        }
        .mm-area-desc {
          font-size: 12.5px;
          color: var(--text-muted);
          line-height: 1.5;
        }
        .mm-area-badge {
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--teal-dim);
          border: 1px solid currentColor;
          border-radius: 2px;
          padding: 2px 8px;
        }
        .mm-line-bar {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          align-items: flex-end;
          margin-bottom: 12px;
        }
        .mm-line-count {
          font-family: var(--font-mono);
          font-size: 11px;
          color: var(--text-faint);
          padding-bottom: 9px;
        }
        .mm-area-switch {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
          margin-bottom: 4px;
        }

        .mm-panel {
          background: var(--panel);
          border: 1px solid var(--steel);
          border-radius: 3px;
          overflow: hidden;
          margin-bottom: 16px;
        }
        .mm-panel-body {
          padding: 18px 20px;
        }
        .mm-panel-note {
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
        .mm-panel-note b {
          color: var(--text);
        }
        .mm-note-error {
          border-color: var(--red);
          color: var(--red);
        }
        .mm-note-error code {
          font-family: var(--font-mono);
          background: rgba(192, 57, 43, 0.08);
          padding: 1px 5px;
          border-radius: 2px;
        }

        /* .mm-tag dipakai juga oleh DurasiTag/ProgressCell (komponen anak terpisah),
           jadi harus :global - styled-jsx cuma otomatis men-scope elemen yang
           ditulis langsung di JSX komponen pemilik <style jsx> ini. */
        :global(.mm-tag) {
          font-family: var(--font-mono);
          font-size: 9.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          padding: 2px 7px;
          border-radius: 2px;
          border: 1px solid currentColor;
          white-space: nowrap;
        }
        :global(.mm-tag.good) {
          color: var(--green);
        }
        :global(.mm-tag.warning) {
          color: var(--amber);
        }
        :global(.mm-tag.critical) {
          color: var(--red);
        }
        :global(.mm-tag.dim) {
          color: var(--text-faint);
        }
        :global(.mm-tag.info) {
          color: var(--teal-dim);
        }

        .mm-param-row {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          align-items: flex-end;
        }
        .mm-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .mm-field label {
          font-family: var(--font-mono);
          font-size: 10.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .mm-field .hint {
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--text-faint);
        }
        .mm-style-hint {
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--teal-dim);
          margin-top: 4px;
        }
        .mm-style-hint.dim {
          color: var(--text-faint);
          font-style: italic;
        }
        :global(.mm-input) {
          background: var(--panel);
          border: 1px solid var(--steel);
          border-radius: 3px;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 14px;
          padding: 8px 10px;
          width: 180px;
        }
        :global(.mm-input:focus) {
          outline: none;
          border-color: var(--teal);
          box-shadow: 0 0 0 2px rgba(58, 183, 196, 0.25);
        }
        .mm-btn-primary {
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
        .mm-btn-primary:hover {
          opacity: 0.88;
        }
        .mm-btn-primary:disabled {
          background: var(--steel);
          color: var(--text-faint);
          cursor: not-allowed;
        }
        .mm-btn-small {
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
        .mm-btn-small:hover {
          background: rgba(58, 183, 196, 0.1);
        }
        .mm-btn-small:disabled {
          border-color: var(--steel);
          color: var(--text-faint);
          cursor: not-allowed;
          background: transparent;
        }
        .mm-icon-x {
          background: transparent;
          border: 1px solid var(--steel);
          color: var(--text-muted);
          border-radius: 3px;
          width: 26px;
          height: 26px;
          cursor: pointer;
        }
        .mm-msg-success {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--green);
        }
        .mm-msg-error {
          font-family: var(--font-mono);
          font-size: 11.5px;
          color: var(--red);
        }

        .mm-table-scroll {
          overflow-x: auto;
        }
        :global(table.mm-table) {
          width: 100%;
          border-collapse: collapse;
          font-family: var(--font-mono);
          font-size: 12px;
        }
        :global(table.mm-table th) {
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
        :global(table.mm-table td) {
          padding: 8px 7px;
          border-top: 1px solid var(--steel);
          vertical-align: middle;
        }
        :global(.mm-num) {
          text-align: right;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        :global(.mm-qty-input) {
          width: 70px;
          text-align: right;
        }
        /* ProgressCell juga komponen anak terpisah - sama alasannya, harus :global. */
        :global(.mm-progress-cell) {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 90px;
        }
        :global(.mm-progress-bar) {
          height: 6px;
          border-radius: 3px;
          background: var(--steel);
          overflow: hidden;
        }
        :global(.mm-progress-fill) {
          height: 100%;
          background: var(--teal);
          border-radius: 3px;
        }
        :global(.mm-progress-fill.full) {
          background: var(--green);
        }
        :global(.mm-progress-label) {
          font-size: 10.5px;
          color: var(--text-muted);
        }
        .mm-empty-note {
          color: var(--text-faint);
          font-family: var(--font-body);
          font-size: 12.5px;
          padding: 16px 4px;
        }

        .mm-kpi-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-bottom: 16px;
        }
        @media (max-width: 760px) {
          .mm-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .mm-kpi {
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
        .mm-kpi.amber {
          border-left-color: var(--amber);
        }
        .mm-kpi.red {
          border-left-color: var(--red);
        }
        .mm-kpi.green {
          border-left-color: var(--green);
        }
        .mm-kpi .label {
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 10.5px;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-faint);
        }
        .mm-kpi .value {
          font-family: var(--font-mono);
          font-weight: 600;
          font-size: 22px;
          color: var(--navy);
          font-variant-numeric: tabular-nums;
          line-height: 1.18;
        }
        .mm-kpi .value .unit {
          font-size: 12px;
          color: var(--text-muted);
          font-weight: 400;
          margin-left: 4px;
        }
        .mm-kpi .foot {
          font-family: var(--font-body);
          font-size: 10.5px;
          color: var(--text-muted);
        }

        .mm-filter-row {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .mm-filter-btn {
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
        .mm-filter-btn.active {
          background: var(--teal-dim);
          color: #fff;
          border-color: var(--teal-dim);
        }

        .mm-step-num {
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
        .mm-step-num.teal {
          background: var(--teal-dim);
        }
      
        .mm-btn-ok {
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
        .mm-btn-ok:hover {
          opacity: 0.88;
        }
        .mm-btn-no {
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
        .mm-btn-no:hover {
          background: rgba(192, 57, 43, 0.08);
        }
        .mm-btn-ok:disabled,
        .mm-btn-no:disabled {
          border-color: var(--steel);
          color: var(--text-faint);
          background: transparent;
          cursor: not-allowed;
        }
        .mm-style-auto {
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--teal-dim);
          min-height: 20px;
        }
        .mm-style-auto.dim {
          color: var(--text-faint);
          font-style: italic;
        }
        :global(.mm-alasan-input) {
          width: 200px;
        }
        .mm-decision-btns {
          display: flex;
          gap: 8px;
        }
`}</style>
    </div>
  );
}
