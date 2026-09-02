"use client";

import { useMemo, useState } from "react";
import Gear from "./katapang/gear";
import HudPanel from "./katapang/HudPanel";
import KpiTile from "./katapang/KpiTile";
import CycleTimeChart from "./katapang/CycleTimeChart";
import HudTheme from "./katapang/HudTheme";
import { computeSummary, buildSuggestions } from "@/lib/lineBalancing";

// ---------------------------------------------------------------------------
// Kalkulator interaktif, bukan dashboard yang baca Google Sheets: leader
// input cycle time hasil pengamatan langsung di sini, sesuai keputusan
// (tujuannya membantu leader menghitung target line dari kondisi aktual di
// lapangan). Tidak ada penyimpanan otomatis - semua state hilang saat
// halaman di-refresh, seperti kalkulator kertas biasa.
//
// Tabel sengaja dimulai KOSONG - leader yang isi Line, Style, dan baris
// cycle time-nya sendiri sesuai kondisi line yang sedang diukur.
//
// Hasil (KPI/chart/saran/tabel detail) HANYA dihitung ulang saat leader
// menekan tombol "Hitung" - input tabel di atas tetap live (kolom CT/SMV
// per baris langsung terhitung), tapi bagian hasil di bawah baru diperbarui
// on-demand supaya leader tidak melihat angka "melompat-lompat" saat masih
// mengetik.
// ---------------------------------------------------------------------------
const SEED_ROWS = [];

const LINE_OPTIONS = Array.from({ length: 60 }, (_, i) => `K${String(i + 1).padStart(2, "0")}`);
const NO_PROSES_OPTIONS = Array.from({ length: 20 }, (_, i) => `S-${i + 1}`);
const PROSES_PRESETS = [
  "SUPPLY SET",
  "J. ELASTIC TAB + J. ELASTIC KNUCKLE",
  "J. IBU JARI",
  "J. TUTUP IBU JARI",
  "J. MACHI",
  "CARAHA",
  "J. LIPAT",
  "J. PASANG TERRYBAND",
  "J. ELASTIC WRIST",
  "J. PULLER",
  "J. MAJIK HALUS",
  "J. PITA LOV",
  "TRIMMING BODY BENANG",
];
const RUNNING_TEXT = "LINE BALANCING BUKAN SEKEDAR TEKNIK, TAPI KUNCI PRODUKTIVITAS TANPA HENTI";

const fmt1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : "-");
const fmt0 = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString("id-ID") : "-");
const fmt2 = (n) => (Number.isFinite(n) ? n.toFixed(2) : "-");
const truncate = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + "…" : String(s));

// Hanya izinkan angka & satu titik desimal - dibersihkan di tempat (tanpa
// parseFloat) supaya nilai yang tersimpan persis sama dengan yang diketik,
// sehingga kursor tidak "melompat" saat leader mengetik cycle time/allowance.
function cleanNumericInput(value) {
  return String(value).replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
}

export default function LineBalancing() {
  const [rows, setRows] = useState(SEED_ROWS);
  const [nextId, setNextId] = useState(1);
  const [lineName, setLineName] = useState("");
  const [styleName, setStyleName] = useState("");
  const [workPerHour, setWorkPerHour] = useState(60);
  const [targetOutput, setTargetOutput] = useState("");

  // Penanda "kotor" (ada perubahan input sejak terakhir dihitung) tanpa perlu
  // deep-compare - setiap perubahan yang memengaruhi hasil menaikkan
  // editVersion; saat "Hitung" ditekan, calculatedVersion disamakan dengan
  // editVersion saat itu. Kalau keduanya beda lagi, berarti sudah ada
  // perubahan baru.
  const [editVersion, setEditVersion] = useState(0);
  const [calculatedVersion, setCalculatedVersion] = useState(null);
  const [calcSnapshot, setCalcSnapshot] = useState(null);

  const hasCalculated = calculatedVersion !== null;
  const isDirty = hasCalculated && calculatedVersion !== editVersion;

  function markEdited() {
    setEditVersion((v) => v + 1);
  }

  const summary = useMemo(() => (calcSnapshot ? computeSummary(calcSnapshot) : null), [calcSnapshot]);
  const suggestions = summary ? buildSuggestions(summary.groups, summary.referenceTakt) : [];

  const hasValidRows = rows.some((r) => (r.proses || "").trim() && Number(r.cycleTime) > 0);

  function updateRow(id, field, value) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === "cycleTime" || field === "allowance") {
          return { ...r, [field]: cleanNumericInput(value) };
        }
        return { ...r, [field]: value };
      })
    );
    markEdited();
  }
  function removeRow(id) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    markEdited();
  }
  function addRow() {
    setRows((prev) => [...prev, { id: nextId, noProses: "", proses: "", nik: "", operator: "", cycleTime: 0, allowance: 11 }]);
    setNextId((n) => n + 1);
    markEdited();
  }
  function handleCalculate() {
    if (!hasValidRows) return;
    setCalcSnapshot({
      rows,
      workPerHour: parseFloat(workPerHour) || 60,
      targetOutput: targetOutput === "" ? null : parseFloat(targetOutput),
    });
    setCalculatedVersion(editVersion);
  }

  let calcStatusText;
  let calcStatusClass = "k-calc-status";
  let calcHintText;
  let calcBtnText;
  let calcBtnClass = "k-play-btn";
  if (!hasCalculated) {
    calcStatusText = "BELUM DIHITUNG";
    calcHintText = hasValidRows
      ? "Data sudah siap — tekan tombol untuk menampilkan hasil perhitungan."
      : "Isi data cycle time di atas, lalu tekan tombol ini untuk menampilkan hasil.";
    calcBtnText = "▶  HITUNG SEKARANG";
  } else if (isDirty) {
    calcStatusText = "ADA PERUBAHAN — BELUM DIHITUNG ULANG";
    calcStatusClass = "k-calc-status k-calc-dirty";
    calcHintText = "Data sudah diubah sejak terakhir dihitung. Tekan tombol untuk memperbarui hasil.";
    calcBtnText = "⟳  HITUNG ULANG";
    calcBtnClass = "k-play-btn k-recalc";
  } else {
    calcStatusText = "HASIL TERKINI";
    calcStatusClass = "k-calc-status k-calc-done";
    calcHintText = "Hasil di bawah sesuai data saat tombol ini terakhir ditekan.";
    calcBtnText = "✓  HASIL TERKINI";
  }

  return (
    <div className="k-root">
      <div className="k-scanlines" />
      <div className="k-bg-gears">
        <div style={{ position: "absolute", top: -90, right: -70 }}>
          <Gear teeth={20} rOuter={210} rBase={186} rBore={46} mode="stroke" color="#2dd4bf" strokeWidth={2} opacity={0.05} spin="cw" duration={150} />
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 2 }}>
        <div className="k-topbar">
          <div className="k-brand">
            <div className="k-brand-mark" style={{ borderColor: "#fab219", color: "#fab219", boxShadow: "0 0 14px rgba(250,178,25,.3) inset" }}>
              LB
            </div>
            <div className="k-brand-text">
              <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: ".06em", textTransform: "uppercase" }}>
                Line Balancing Calculator
              </div>
              <div className="k-t2">Bantu leader hitung target line dari kondisi aktual</div>
            </div>
          </div>
          <div className="k-sys-status">
            <span className="k-tag k-tag-good">KALKULATOR INTERAKTIF · TIDAK TERSIMPAN OTOMATIS</span>
          </div>

          <div className="k-lb-gear-row" aria-hidden="true">
            <Gear teeth={8} rOuter={13} rBase={10.2} rBore={4.5} mode="fill" color="#fab219" spin="cw" duration={6} />
            <Gear teeth={6} rOuter={9} rBase={7} rBore={3.2} mode="fill" color="#2dd4bf" spin="ccw" duration={4.2} style={{ marginLeft: -6 }} />
            <span className="k-lb-gear-label">SISTEM BERJALAN</span>
          </div>

          <div className="k-lb-ticker-wrap">
            <div className="k-lb-ticker-track">
              <span className="k-lb-ticker-item">{RUNNING_TEXT}</span>
              <span className="k-lb-ticker-sep">◆</span>
              <span className="k-lb-ticker-item">{RUNNING_TEXT}</span>
              <span className="k-lb-ticker-sep">◆</span>
            </div>
          </div>
        </div>

        <div className="k-section-title">
          <h2>Parameter Line</h2>
          <div className="k-sub">DIISI LEADER</div>
        </div>
        <div className="k-panel">
          <div className="k-panel-body k-param-row">
            <div className="k-field" style={{ width: 110 }}>
              <label>Line</label>
              <select className="k-input k-select" value={lineName} onChange={(e) => setLineName(e.target.value)}>
                <option value="">— Pilih —</option>
                {LINE_OPTIONS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="k-field" style={{ width: 210 }}>
              <label>Style</label>
              <input className="k-input" type="text" placeholder="mis. Tour Authentic 2025" value={styleName} onChange={(e) => setStyleName(e.target.value)} />
            </div>
            <div className="k-field" style={{ width: 150 }}>
              <label>Waktu Kerja ( Jam )</label>
              <input
                className="k-input"
                type="number"
                min="1"
                value={workPerHour}
                onChange={(e) => {
                  setWorkPerHour(e.target.value);
                  markEdited();
                }}
              />
              <span className="k-hint">menit kerja bersih per jam — basis semua hitungan waktu</span>
            </div>
            <div className="k-field" style={{ width: 170 }}>
              <label>Target Output / Jam (opsional)</label>
              <input
                className="k-input"
                type="number"
                min="0"
                placeholder="mis. 68"
                value={targetOutput}
                onChange={(e) => {
                  setTargetOutput(e.target.value);
                  markEdited();
                }}
              />
              <span className="k-hint">pcs / jam — kosongkan jika belum ada target</span>
            </div>
          </div>
        </div>

        <div className="k-section-title">
          <h2>Data Cycle Time per Proses</h2>
          <div className="k-sub">{rows.length} BARIS</div>
        </div>
        <div className="k-panel">
          <div className="k-panel-body">
            <div className="k-panel-note">
              <b>No. Proses</b> = urutan alur kerja yang wajib diikuti (tidak boleh dilewati/dibalik). Jika ada &ge;2 baris
              dengan <b>No. Proses yang sama</b>, itu berarti proses tersebut dikerjakan oleh &gt;1 operator paralel untuk
              memenuhi kapasitas — baris-baris itu otomatis <b>digabung jadi satu station</b> di bawah. Kolom{" "}
              <b>CT (menit)</b> dan <b>SMV (menit)</b> dihitung otomatis dari Cycle Time × (1 + Allowance%), tidak perlu
              diisi manual.
            </div>
            <div className="k-table-wrap">
              <table className="k-table k-lb-table">
                <thead>
                  <tr>
                    <th style={{ width: "8%" }}>No. Proses</th>
                    <th style={{ width: "19%" }}>Proses</th>
                    <th style={{ width: "10%" }}>NIK</th>
                    <th style={{ width: "15%" }}>Operator</th>
                    <th style={{ width: "10%" }}>Cycle Time (detik)</th>
                    <th style={{ width: "8%" }}>Allowance (%)</th>
                    <th style={{ width: "9%" }}>CT (menit)</th>
                    <th style={{ width: "9%" }}>SMV (menit)</th>
                    <th style={{ width: "6%" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const workPerHourNum = parseFloat(workPerHour) || 60;
                    const adjCT = (parseFloat(r.cycleTime) || 0) * (1 + (parseFloat(r.allowance) || 0) / 100);
                    const ctMin = workPerHourNum > 0 ? adjCT / workPerHourNum : 0;
                    const smv = Math.ceil(ctMin * 100) / 100;
                    return (
                      <tr key={r.id}>
                        <td>
                          <select className="k-input k-narrow k-select" value={r.noProses} onChange={(e) => updateRow(r.id, "noProses", e.target.value)}>
                            <option value="">— Pilih —</option>
                            {NO_PROSES_OPTIONS.map((code) => (
                              <option key={code} value={code}>
                                {code}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            className="k-input"
                            type="text"
                            list="k-lb-proses-list"
                            placeholder="Pilih atau ketik nama proses"
                            value={r.proses}
                            onChange={(e) => updateRow(r.id, "proses", e.target.value)}
                          />
                        </td>
                        <td>
                          <input className="k-input" type="text" placeholder="NIK" value={r.nik} onChange={(e) => updateRow(r.id, "nik", e.target.value)} />
                        </td>
                        <td>
                          <input className="k-input" type="text" placeholder="Operator" value={r.operator} onChange={(e) => updateRow(r.id, "operator", e.target.value)} />
                        </td>
                        <td>
                          <input
                            className="k-input k-narrow"
                            type="text"
                            inputMode="decimal"
                            value={r.cycleTime}
                            onChange={(e) => updateRow(r.id, "cycleTime", e.target.value)}
                            onFocus={(e) => e.target.select()}
                          />
                        </td>
                        <td>
                          <input
                            className="k-input k-narrow"
                            type="text"
                            inputMode="decimal"
                            value={r.allowance}
                            onChange={(e) => updateRow(r.id, "allowance", e.target.value)}
                            onFocus={(e) => e.target.select()}
                          />
                        </td>
                        <td className="k-computed">{fmt2(ctMin)}</td>
                        <td className="k-computed">{fmt2(smv)}</td>
                        <td className="k-row-actions">
                          <button className="k-icon-btn" title="Hapus baris" onClick={() => removeRow(r.id)}>
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <datalist id="k-lb-proses-list">
                {PROSES_PRESETS.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </div>
            <button className="k-add-row-btn" onClick={addRow}>
              + Tambah Baris
            </button>
          </div>
        </div>

        <div className="k-calc-bar">
          <div>
            <div className={calcStatusClass}>{calcStatusText}</div>
            <div className="k-calc-hint">{calcHintText}</div>
          </div>
          <button className={calcBtnClass} disabled={!hasValidRows} onClick={handleCalculate}>
            {calcBtnText}
          </button>
        </div>

        {!summary ? (
          <div className="k-empty" style={{ padding: "22px 4px" }}>
            Belum ada hasil — isi data di atas lalu tekan &quot;Hitung Sekarang&quot;.
          </div>
        ) : (
          <>
            <div className="k-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              <KpiTile
                label="Bottleneck Station"
                value={`${summary.bottleneck.noProses} · ${truncate(summary.bottleneck.proses, 16)}`}
                hasData
                foot={`${fmt1(summary.bottleneck.effectiveCT)} detik efektif · ${summary.bottleneck.operatorCount} operator (${truncate(summary.bottleneck.operatorNames.join(", "), 22)})`}
              />
              <KpiTile
                label="Line Efficiency (saat ini)"
                value={fmt1(summary.lineEfficiency)}
                unit="%"
                hasData
                foot="ΣCT efektif ÷ (N × CT maks)"
              />
              <KpiTile
                label="Output Tercapai"
                value={fmt1(summary.currentOutputHour)}
                unit="pcs/jam"
                hasData
                foot="Waktu Kerja (Jam) ÷ CT efektif bottleneck"
              />
              <KpiTile
                label="Jumlah Station"
                value={fmt0(summary.n)}
                unit="proses"
                hasData
                foot={`total ${summary.totalOperatorsAssigned} operator terisi`}
              />
              {summary.requiredTakt ? (
                <>
                  <KpiTile
                    label="Takt Time Dibutuhkan"
                    value={fmt1(summary.requiredTakt)}
                    unit="detik"
                    hasData
                    foot={`untuk capai ${fmt0(calcSnapshot.targetOutput)} pcs/jam`}
                  />
                  <KpiTile
                    label="Total Operator Dibutuhkan"
                    value={fmt0(summary.totalOperatorsNeeded)}
                    unit="orang"
                    hasData
                    foot={`saat ini ${summary.totalOperatorsAssigned} operator`}
                  />
                </>
              ) : (
                <KpiTile label="Rata-rata CT Efektif" value={fmt1(summary.avgCT)} unit="detik" hasData foot={`dari ${summary.n} station`} />
              )}
            </div>

            <div className="k-row k-row-two" style={{ gridTemplateColumns: "1fr" }}>
              <HudPanel
                title="Cycle Time Efektif per Station"
                tag={
                  summary.groups.filter(summary.isOverTakt).length > 0
                    ? `${summary.groups.filter(summary.isOverTakt).length} DI ATAS TAKT`
                    : "SEIMBANG"
                }
                tagTone={summary.groups.filter(summary.isOverTakt).length > 0 ? "critical" : "good"}
              >
                <CycleTimeChart groups={summary.groups} taktTime={summary.referenceTakt} isOverTakt={summary.isOverTakt} />
                <div className="k-legend">
                  <span>
                    <i style={{ background: "#2dd4bf" }} />
                    Dalam takt
                  </span>
                  <span>
                    <i style={{ background: "#d03b3b" }} />
                    Di atas takt (bottleneck)
                  </span>
                  <span>
                    <i className="k-legend-ghost" />
                    Garis takt time acuan
                  </span>
                </div>
              </HudPanel>
            </div>

            <HudPanel title="Saran Redistribusi Kerja" tag="ESTIMASI OTOMATIS" tagTone="warning">
              <div className="k-panel-note">
                No. Proses menandakan urutan alur yang wajib diikuti — saran di bawah hanya menambah/mengurangi{" "}
                <b>jumlah operator</b> di proses yang sama, bukan mengubah urutan proses.
              </div>
              {suggestions.length === 0 ? (
                <div className="k-empty">Line sudah cukup seimbang — tidak ada station yang jauh di atas atau di bawah acuan takt time saat ini.</div>
              ) : (
                suggestions.map((it) => (
                  <div className="k-suggestion" key={it.key}>
                    <span className={`k-suggestion-dot ${it.type}`} />
                    <span className="k-suggestion-txt">
                      <span dangerouslySetInnerHTML={{ __html: it.html }} />
                      <span className="k-suggestion-caveat">
                        Estimasi otomatis dari angka cycle time — leader tetap perlu cek kelayakan teknis (skill, mesin, tata letak) sebelum diterapkan.
                      </span>
                    </span>
                  </div>
                ))
              )}
            </HudPanel>

            <HudPanel title="Ringkasan per Station (No. Proses)" tag={`${summary.n} STATION`} tagTone="dim">
              <div className="k-table-wrap">
                <table className="k-table k-lb-table">
                  <thead>
                    <tr>
                      <th>No. Proses</th>
                      <th>Proses</th>
                      <th>Operator</th>
                      <th className="k-num">Jml Operator</th>
                      <th className="k-num">CT Efektif</th>
                      <th className="k-num">Selisih vs Takt</th>
                      <th className="k-num">Operator: Saat Ini → Dibutuhkan</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.groups.map((g) => {
                      const diff = g.effectiveCT - summary.referenceTakt;
                      const isBottleneck = summary.isOverTakt(g);
                      const needed = summary.requiredTakt ? Math.max(1, Math.ceil(g.avgIndividualAdjCT / summary.requiredTakt)) : null;
                      return (
                        <tr key={g.key}>
                          <td>{g.noProses}</td>
                          <td>{truncate(g.proses, 26)}</td>
                          <td className="k-muted">{truncate(g.operatorNames.join(", "), 30)}</td>
                          <td className="k-num">{g.operatorCount}</td>
                          <td className="k-num">{fmt1(g.effectiveCT)}s</td>
                          <td className={`k-num ${isBottleneck ? "k-neg" : ""}`}>
                            {diff > 0 ? "+" : ""}
                            {fmt1(diff)}s
                          </td>
                          <td className="k-num">
                            {needed == null ? (
                              g.operatorCount
                            ) : (
                              <>
                                {g.operatorCount} → <b style={{ color: needed > g.operatorCount ? "#ff8080" : needed < g.operatorCount ? "#2dd4bf" : "inherit" }}>{needed}</b>
                              </>
                            )}
                          </td>
                          <td>
                            <span className={`k-tag ${isBottleneck ? "k-tag-critical" : "k-tag-good"}`}>{isBottleneck ? "BOTTLENECK" : "OK"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </HudPanel>
          </>
        )}

        <footer className="k-footer">
          <span className="k-footer-brand">
            <Gear teeth={8} rOuter={8} rBase={6.4} rBore={2} mode="stroke" color="#57616b" strokeWidth={1.4} opacity={0.8} />
            ASIK CONTROL LAYER
          </span>
          <span>KALKULATOR LINE BALANCING · SEMUA ANGKA DIHITUNG LIVE DI BROWSER ANDA</span>
        </footer>
      </div>

      <HudTheme />
    </div>
  );
}
