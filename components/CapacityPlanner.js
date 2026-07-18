"use client";

import { useEffect, useState } from "react";
import Panel from "./Panel";

function safeFixed(val, digits = 1) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

function GroupHeader({ children }) {
  return (
    <div
      style={{
        background: "var(--navy)",
        color: "#ffffff",
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 13,
        letterSpacing: "0.04em",
        padding: "9px 20px",
        marginBottom: 12,
        clipPath: "polygon(0 0, 100% 0, calc(100% - 14px) 100%, 0 100%)",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

function MpCard({ label, value, unit, note, accent = "var(--teal)" }) {
  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--steel)", borderLeft: `4px solid ${accent}`, padding: "16px 18px" }}>
      <p style={{ fontSize: 10, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 700, color: "var(--navy)", margin: 0 }}>
        {value} <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 400 }}>{unit}</span>
      </p>
      {note && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0" }}>{note}</p>}
    </div>
  );
}

function CriticalPointsSection({ points }) {
  if (!points) return null;
  const { cutting = [], produksi = [] } = points;
  if (cutting.length === 0 && produksi.length === 0) return null;

  return (
    <Panel title="Poin Kritis untuk Style Ini" style={{ marginBottom: 24 }}>
      {cutting.length > 0 && (
        <div style={{ marginBottom: produksi.length > 0 ? 18 : 0 }}>
          <p style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
            Poin Kritis Cutting (Material)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {cutting.map((c, i) => (
              <div key={i} style={{ background: "var(--panel-raised, #f4f6f9)", borderLeft: "3px solid var(--amber, #b3720f)", padding: "8px 12px" }}>
                <p style={{ fontSize: 13, color: "var(--text)", margin: 0 }}>
                  <strong>{c.karakterMaterial}</strong>
                  {c.penyelesaianMasalah ? ` \u2014 ${c.penyelesaianMasalah}` : ""}
                </p>
                {c.poinPenting && (
                  <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>{c.poinPenting}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {produksi.length > 0 && (
        <div>
          <p style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
            Poin Kritis Produksi (Sewing)
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {produksi.map((p, i) => (
              <div key={i} style={{ background: "var(--panel-raised, #f4f6f9)", borderLeft: "3px solid var(--teal)", padding: "8px 12px" }}>
                <p style={{ fontSize: 13, color: "var(--text)", margin: 0 }}>
                  <strong>{p.area}</strong> ({p.section}) &mdash; {p.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

export default function CapacityPlanner() {
  const [styleOptions, setStyleOptions] = useState([]);
  const [style, setStyle] = useState("");
  const [qtyKanan, setQtyKanan] = useState("");
  const [qtyKiri, setQtyKiri] = useState("");
  const [qtyWomen, setQtyWomen] = useState("");
  const [startDate, setStartDate] = useState("");
  const [finishDate, setFinishDate] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function loadStyles() {
      try {
        const res = await fetch("/api/capacity-planner/styles", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled && res.ok) setStyleOptions(json.styles || []);
      } catch {
        // biarkan kosong, user masih bisa ketik manual
      }
    }
    loadStyles();
    return () => {
      cancelled = true;
    };
  }, []);

  const hasAnyQty = Number(qtyKanan) > 0 || Number(qtyKiri) > 0 || Number(qtyWomen) > 0;

  async function handleCalculate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/capacity-planner/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ style, qtyKanan, qtyKiri, qtyWomen, startDate, finishDate }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menghitung.");
      setResult(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    width: "100%",
    marginTop: 4,
    border: "1px solid var(--steel)",
    padding: "8px 10px",
    fontSize: 13,
    fontFamily: "var(--font-body)",
    background: "var(--panel)",
    color: "var(--text)",
  };
  const labelStyle = {
    fontSize: 11,
    color: "var(--text-faint)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div>
      <Panel title="Masukkan Detail Order" style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Style</label>
            <input
              list="style-options"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="Tour Authentic 2025"
              style={inputStyle}
            />
            <datalist id="style-options">
              {styleOptions.map((s) => (
                <option key={s.style} value={s.style} />
              ))}
            </datalist>
          </div>
          <div>
            <label style={labelStyle}>Tanggal Mulai</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Target Selesai</label>
            <input type="date" value={finishDate} onChange={(e) => setFinishDate(e.target.value)} style={inputStyle} />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Qty Kanan (pcs)</label>
            <input type="number" value={qtyKanan} onChange={(e) => setQtyKanan(e.target.value)} placeholder="4000" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Qty Kiri (pcs)</label>
            <input type="number" value={qtyKiri} onChange={(e) => setQtyKiri(e.target.value)} placeholder="4000" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Qty Women (pcs)</label>
            <input type="number" value={qtyWomen} onChange={(e) => setQtyWomen(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
        </div>

        <button
          onClick={handleCalculate}
          disabled={loading || !style || !hasAnyQty}
          style={{
            background: "var(--teal)",
            color: "var(--navy)",
            border: "none",
            fontWeight: 700,
            padding: "9px 24px",
            fontSize: 13,
            cursor: loading ? "default" : "pointer",
            opacity: loading || !style || !hasAnyQty ? 0.6 : 1,
          }}
        >
          {loading ? "Menghitung..." : "Hitung Kebutuhan"}
        </button>
        <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 10, marginBottom: 0 }}>
          Kosongkan Tanggal Mulai/Selesai untuk lihat simulasi jam kerja per opsi jumlah line (tanpa target deadline).
        </p>
      </Panel>

      {error && (
        <div
          style={{
            background: "rgba(192,57,43,0.1)",
            border: "1px solid var(--red)",
            color: "var(--text)",
            padding: "14px 18px",
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          <strong style={{ color: "var(--red)" }}>Gagal menghitung.</strong> {error}
        </div>
      )}

      {result && result.mode === "no-deadline" && (
        <>
          {(result.optionsKananWomen?.length > 0 || result.optionsKiri?.length > 0) && (
            <Panel title="Opsi Jumlah Line (Tanpa Target Waktu)" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {result.optionsKananWomen?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                      Kanan + Women ({result.qtyKananWomen.toLocaleString("id-ID")} pcs)
                    </p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                          <th style={{ padding: "6px 10px" }}>Jika Pakai</th>
                          <th style={{ padding: "6px 10px", textAlign: "right" }}>Total Jam Dibutuhkan</th>
                          <th style={{ padding: "6px 10px" }}>Line yang Disarankan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.optionsKananWomen.map((o, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                            <td style={{ padding: "6px 10px" }}>{o.lines} line</td>
                            <td style={{ padding: "6px 10px", textAlign: "right" }}>{safeFixed(o.totalHoursNeeded, 1)} jam</td>
                            <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                              {o.suggestedLines.map((l) => l.line).join(", ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {result.optionsKiri?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                      Kiri ({result.qtyKiri.toLocaleString("id-ID")} pcs)
                    </p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                          <th style={{ padding: "6px 10px" }}>Jika Pakai</th>
                          <th style={{ padding: "6px 10px", textAlign: "right" }}>Total Jam Dibutuhkan</th>
                          <th style={{ padding: "6px 10px" }}>Line yang Disarankan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.optionsKiri.map((o, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                            <td style={{ padding: "6px 10px" }}>{o.lines} line</td>
                            <td style={{ padding: "6px 10px", textAlign: "right" }}>{safeFixed(o.totalHoursNeeded, 1)} jam</td>
                            <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                              {o.suggestedLines.map((l) => l.line).join(", ")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {result.optionsOperators?.length > 0 && (
            <Panel title="Opsi Jumlah Operator Cutting (Tanpa Target Waktu)" style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                Total {result.totalQty.toLocaleString("id-ID")} pcs &middot; Kategori {result.skillCategory}
              </p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                    <th style={{ padding: "6px 10px" }}>Jika Pakai</th>
                    <th style={{ padding: "6px 10px", textAlign: "right" }}>Total Jam Dibutuhkan</th>
                    <th style={{ padding: "6px 10px" }}>Operator yang Disarankan</th>
                  </tr>
                </thead>
                <tbody>
                  {result.optionsOperators.map((o, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                      <td style={{ padding: "6px 10px" }}>{o.operators} orang</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>{safeFixed(o.totalHoursNeeded, 1)} jam</td>
                      <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>
                        {o.suggestedOperators.map((op) => op.nama).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          <CriticalPointsSection points={result.criticalPoints} />

          <Panel title="Aspek yang Perlu Diperhatikan">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.considerations.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: c.type === "warning" ? "var(--amber, #b3720f)" : c.type === "ok" ? "var(--green)" : "var(--text-faint)",
                    }}
                  >
                    {c.type === "warning" ? "\u26A0" : c.type === "ok" ? "\u2713" : "\u2139"}
                  </span>
                  <p style={{ fontSize: 13, color: "var(--text)", margin: 0 }}>{c.text}</p>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}

      {result && result.mode !== "no-deadline" && (
        <>
          <GroupHeader>1. Kebutuhan Manpower Sewing</GroupHeader>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 24 }}>
            {result.qtyKananWomen > 0 && (
              <MpCard
                label="Line Kanan + Women"
                value={result.linesKananWomen ?? "-"}
                unit="line"
                accent="var(--navy)"
                note={
                  result.lineCapacityRangeKanan
                    ? `Rata-rata ${safeFixed(result.lineCapacityRangeKanan.average, 0)} \u00b7 tertinggi ${result.lineCapacityRangeKanan.highest} \u00b7 terendah ${result.lineCapacityRangeKanan.lowest} pcs/jam`
                    : "Kapasitas line tidak tersedia"
                }
              />
            )}
            {result.qtyKiri > 0 && (
              <MpCard
                label="Line Kiri"
                value={result.linesKiri ?? "-"}
                unit="line"
                accent="var(--navy)"
                note={
                  result.lineCapacityRangeKiri
                    ? `Rata-rata ${safeFixed(result.lineCapacityRangeKiri.average, 0)} \u00b7 tertinggi ${result.lineCapacityRangeKiri.highest} \u00b7 terendah ${result.lineCapacityRangeKiri.lowest} pcs/jam`
                    : "Kapasitas line tidak tersedia"
                }
              />
            )}
          </div>

          <GroupHeader>2. Kebutuhan Manpower Supply</GroupHeader>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 24 }}>
            <MpCard
              label="Cutting (Leather)"
              value={result.operatorsNeeded ?? "-"}
              unit="org"
              note={`${result.skillCategory || "?"} \u00b7 rata-rata ${safeFixed(result.avgCuttingCapacityPerHour, 1)}${
                result.operatorCapacityRange ? ` \u00b7 tinggi ${result.operatorCapacityRange.highest} \u00b7 rendah ${result.operatorCapacityRange.lowest}` : ""
              } pcs/jam`}
            />
            {result.supplyMp && (
              <>
                <MpCard label="Cutting Synthetic" value={result.supplyMp.cuttingSynthetic} unit="org" />
                <MpCard label="Accessories" value={result.supplyMp.accessories} unit="org" />
                <MpCard label="M4" value={result.supplyMp.m4} unit="org" />
                <MpCard label="Distribusi" value={result.supplyMp.distribusi} unit="org" />
                <MpCard label="Presub" value={result.supplyMp.presub} unit="org" />
              </>
            )}
          </div>

          {result.gudangJadiMp && (
            <>
              <GroupHeader>3. Kebutuhan Manpower Gudang Jadi</GroupHeader>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
                <MpCard label="Persiapan" value={result.gudangJadiMp.persiapan} unit="orang" accent="var(--green)" />
                <MpCard label="Packing Envelope" value={result.gudangJadiMp.packingEnvelope} unit="orang" accent="var(--green)" />
                <MpCard label="Packing Inner Carton" value={result.gudangJadiMp.packingInnerCarton} unit="orang" accent="var(--green)" />
              </div>
            </>
          )}

          {(result.simulationKananWomen?.length > 0 || result.simulationKiri?.length > 0) && (
            <Panel title="Simulasi Opsi Jumlah Line" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {result.simulationKananWomen?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                      Kanan + Women (baseline {result.linesKananWomen} line)
                    </p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                          <th style={{ padding: "6px 10px" }}>Jika Pakai</th>
                          <th style={{ padding: "6px 10px", textAlign: "right" }}>Tambahan Jam/Hari</th>
                          <th style={{ padding: "6px 10px", textAlign: "right" }}>Total Jam Tambahan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.simulationKananWomen.map((s, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                            <td style={{ padding: "6px 10px" }}>{s.lines} line</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: s.additionalHoursPerDay > 0 ? "var(--red)" : "var(--green)" }}>
                              +{safeFixed(s.additionalHoursPerDay, 1)} jam
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--text-muted)" }}>
                              {safeFixed(s.additionalTotalHours, 1)} jam
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {result.simulationKiri?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                      Kiri (baseline {result.linesKiri} line)
                    </p>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                      <thead>
                        <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                          <th style={{ padding: "6px 10px" }}>Jika Pakai</th>
                          <th style={{ padding: "6px 10px", textAlign: "right" }}>Tambahan Jam/Hari</th>
                          <th style={{ padding: "6px 10px", textAlign: "right" }}>Total Jam Tambahan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.simulationKiri.map((s, i) => (
                          <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                            <td style={{ padding: "6px 10px" }}>{s.lines} line</td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: s.additionalHoursPerDay > 0 ? "var(--red)" : "var(--green)" }}>
                              +{safeFixed(s.additionalHoursPerDay, 1)} jam
                            </td>
                            <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--text-muted)" }}>
                              {safeFixed(s.additionalTotalHours, 1)} jam
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {(result.suggestedLinesKananWomen?.length > 0 || result.suggestedLinesKiri?.length > 0) && (
            <Panel title="Line yang Disarankan (Baseline)" style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {result.suggestedLinesKananWomen?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                      Untuk Kanan + Women
                    </p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {result.suggestedLinesKananWomen.map((l, i) => (
                        <div key={i} style={{ border: "1px solid var(--steel)", padding: "6px 12px", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                          <strong>{l.line}</strong> &middot; {l.capacity} pcs/jam &middot; eff {safeFixed(l.efficiency, 1)}%
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.suggestedLinesKiri?.length > 0 && (
                  <div>
                    <p style={{ fontSize: 12, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 6px" }}>
                      Untuk Kiri
                    </p>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {result.suggestedLinesKiri.map((l, i) => (
                        <div key={i} style={{ border: "1px solid var(--steel)", padding: "6px 12px", fontSize: 13, fontFamily: "var(--font-mono)" }}>
                          <strong>{l.line}</strong> &middot; {l.capacity} pcs/jam &middot; eff {safeFixed(l.efficiency, 1)}%
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {result.suggestedOperators?.length > 0 && (
            <Panel title="Operator Cutting yang Disarankan" style={{ marginBottom: 24 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                    <th style={{ padding: "6px 10px" }}>Nama</th>
                    <th style={{ padding: "6px 10px", textAlign: "right" }}>Kapasitas ({result.skillCategory})</th>
                  </tr>
                </thead>
                <tbody>
                  {result.suggestedOperators.map((o, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                      <td style={{ padding: "6px 10px" }}>{o.nama}</td>
                      <td style={{ padding: "6px 10px", textAlign: "right" }}>{o.kapasitas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}

          <CriticalPointsSection points={result.criticalPoints} />

          <Panel title="Aspek yang Perlu Diperhatikan">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.considerations.map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: c.type === "warning" ? "var(--amber, #b3720f)" : c.type === "ok" ? "var(--green)" : "var(--text-faint)",
                    }}
                  >
                    {c.type === "warning" ? "\u26A0" : c.type === "ok" ? "\u2713" : "\u2139"}
                  </span>
                  <p style={{ fontSize: 13, color: "var(--text)", margin: 0 }}>{c.text}</p>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
