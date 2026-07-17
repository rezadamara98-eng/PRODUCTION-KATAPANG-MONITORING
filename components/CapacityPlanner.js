"use client";

import { useEffect, useState } from "react";
import Panel from "./Panel";

function safeFixed(val, digits = 1) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function CapacityPlanner() {
  const [styleOptions, setStyleOptions] = useState([]);
  const [style, setStyle] = useState("");
  const [qty, setQty] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
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

  async function handleCalculate() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/capacity-planner/calculate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ style, qty, startDate, finishDate }),
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 14 }}>
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
            <label style={labelStyle}>Total Qty (pasang)</label>
            <input
              type="number"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="12000"
              style={inputStyle}
            />
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
        <button
          onClick={handleCalculate}
          disabled={loading || !style || !qty || !finishDate}
          style={{
            background: "var(--teal)",
            color: "var(--navy)",
            border: "none",
            fontWeight: 700,
            padding: "9px 24px",
            fontSize: 13,
            cursor: loading ? "default" : "pointer",
            opacity: loading || !style || !qty || !finishDate ? 0.6 : 1,
          }}
        >
          {loading ? "Menghitung..." : "Hitung Kebutuhan"}
        </button>
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

      {result && (
        <>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{ flex: "1 1 300px", background: "var(--panel)", border: "1px solid var(--steel)", borderLeft: "4px solid var(--navy)", padding: "18px 20px" }}>
              <p style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                Line Dibutuhkan
              </p>
              <p style={{ fontSize: 34, fontWeight: 700, color: "var(--navy)", margin: 0 }}>
                {result.linesNeeded ?? "-"} <span style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 400 }}>line</span>
              </p>
              {result.refStyle && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
                  Berdasarkan PA PAF rata-rata {safeFixed(result.refStyle.avgPaPaf, 2)}, {result.workingDays} hari kerja efektif
                </p>
              )}
            </div>
            <div style={{ flex: "1 1 300px", background: "var(--panel)", border: "1px solid var(--steel)", borderLeft: "4px solid var(--teal)", padding: "18px 20px" }}>
              <p style={{ fontSize: 11, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 8px" }}>
                Operator Cutting Dibutuhkan
              </p>
              <p style={{ fontSize: 34, fontWeight: 700, color: "var(--navy)", margin: 0 }}>
                {result.operatorsNeeded ?? "-"} <span style={{ fontSize: 15, color: "var(--text-muted)", fontWeight: 400 }}>orang</span>
              </p>
              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "8px 0 0" }}>
                Berdasarkan kapasitas rata-rata {safeFixed(result.avgCuttingCapacityPerDay, 1)} psg/operator/hari
              </p>
            </div>
          </div>

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
