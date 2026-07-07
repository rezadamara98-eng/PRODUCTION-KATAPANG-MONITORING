"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";

function parseGroupKey(tanggal, mode) {
  // Coba parse tanggal, kalau gagal pakai string mentah sebagai key.
  const d = new Date(tanggal);
  if (isNaN(d.getTime())) return tanggal;
  if (mode === "bulanan") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function StatusDot({ status }) {
  const color =
    status === "hijau" ? "var(--green)" : status === "kuning" ? "var(--amber)" : "var(--red)";
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 8px ${color}`,
        flexShrink: 0,
      }}
    />
  );
}

function KpiCard({ eyebrow, value, unit, tone }) {
  const toneColor =
    tone === "green" ? "var(--green)" : tone === "red" ? "var(--red)" : "var(--amber)";
  return (
    <div
      style={{
        background: "var(--panel)",
        border: "1px solid var(--steel)",
        borderTop: `3px solid ${toneColor}`,
        borderRadius: 4,
        padding: "18px 20px",
        flex: "1 1 160px",
        minWidth: 160,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 11,
          letterSpacing: "0.12em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 30,
          fontWeight: 600,
          color: "var(--text)",
          lineHeight: 1,
        }}
      >
        {value}
        {unit && (
          <span style={{ fontSize: 15, color: "var(--text-muted)", marginLeft: 4 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mode, setMode] = useState("harian"); // "harian" | "bulanan"
  const [fetchedAt, setFetchedAt] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/production", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal mengambil data");
        if (!cancelled) {
          setRows(json.data);
          setFetchedAt(json.fetchedAt);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.output += r.output;
        acc.target += r.target;
        acc.reject += r.reject;
        return acc;
      },
      { output: 0, target: 0, reject: 0 }
    );
  }, [rows]);

  const efisiensi = totals.target > 0 ? (totals.output / totals.target) * 100 : 0;
  const rejectRate = totals.output > 0 ? (totals.reject / totals.output) * 100 : 0;

  // Ringkasan per Lini/Mesin - untuk bar chart & status strip
  const perLini = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      if (!map.has(r.lini)) map.set(r.lini, { lini: r.lini, output: 0, target: 0, reject: 0 });
      const entry = map.get(r.lini);
      entry.output += r.output;
      entry.target += r.target;
      entry.reject += r.reject;
    }
    return Array.from(map.values())
      .map((e) => {
        const eff = e.target > 0 ? (e.output / e.target) * 100 : 0;
        const status = eff >= 100 ? "hijau" : eff >= 85 ? "kuning" : "merah";
        return { ...e, eff, status };
      })
      .sort((a, b) => b.output - a.output);
  }, [rows]);

  // Ringkasan per periode (harian/bulanan) - untuk trend chart
  const perPeriode = useMemo(() => {
    const map = new Map();
    for (const r of rows) {
      const key = parseGroupKey(r.tanggal, mode);
      if (!map.has(key)) map.set(key, { periode: key, output: 0, target: 0, reject: 0 });
      const entry = map.get(key);
      entry.output += r.output;
      entry.target += r.target;
      entry.reject += r.reject;
    }
    return Array.from(map.values()).sort((a, b) => (a.periode > b.periode ? 1 : -1));
  }, [rows, mode]);

  return (
    <main style={{ minHeight: "100vh", padding: "28px 32px 60px" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 28,
          paddingBottom: 20,
          borderBottom: "1px solid var(--steel)",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "var(--amber)",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            Status Lini &middot; Real-time
          </div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 34,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "0.01em",
            }}
          >
            PANEL PRODUKSI
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text-faint)",
            }}
          >
            {fetchedAt
              ? `Diperbarui: ${new Date(fetchedAt).toLocaleString("id-ID")}`
              : "Memuat..."}
          </div>
          <div
            style={{
              display: "flex",
              border: "1px solid var(--steel)",
              borderRadius: 4,
              overflow: "hidden",
            }}
          >
            {["harian", "bulanan"].map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                style={{
                  padding: "8px 16px",
                  background: mode === m ? "var(--amber)" : "var(--panel)",
                  color: mode === m ? "#1b1e20" : "var(--text-muted)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(193,68,14,0.12)",
            border: "1px solid var(--red)",
            color: "var(--text)",
            borderRadius: 4,
            padding: "14px 18px",
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          <strong style={{ color: "var(--red)" }}>Gagal memuat data.</strong> {error}
        </div>
      )}

      {loading ? (
        <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
          Mengambil data dari Google Sheets...
        </div>
      ) : (
        <>
          {/* KPI Row */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
            <KpiCard eyebrow="Total Output" value={totals.output.toLocaleString("id-ID")} unit="unit" />
            <KpiCard eyebrow="Total Target" value={totals.target.toLocaleString("id-ID")} unit="unit" />
            <KpiCard
              eyebrow="Total Reject"
              value={totals.reject.toLocaleString("id-ID")}
              unit="unit"
              tone="red"
            />
            <KpiCard
              eyebrow="Efisiensi"
              value={efisiensi.toFixed(1)}
              unit="%"
              tone={efisiensi >= 100 ? "green" : efisiensi >= 85 ? undefined : "red"}
            />
            <KpiCard
              eyebrow="Reject Rate"
              value={rejectRate.toFixed(1)}
              unit="%"
              tone={rejectRate <= 2 ? "green" : rejectRate <= 5 ? undefined : "red"}
            />
          </div>

          {/* Status strip per lini */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--steel)",
              borderRadius: 4,
              padding: "16px 20px",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 12,
                letterSpacing: "0.1em",
                color: "var(--text-faint)",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Status Per Lini / Mesin
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
              {perLini.map((l) => (
                <div key={l.lini} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusDot status={l.status} />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>{l.lini}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-faint)" }}>
                    {l.eff.toFixed(0)}%
                  </span>
                </div>
              ))}
              {perLini.length === 0 && (
                <span style={{ color: "var(--text-faint)", fontSize: 13 }}>Belum ada data.</span>
              )}
            </div>
          </div>

          {/* Charts */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
            <div
              style={{
                flex: "1 1 420px",
                background: "var(--panel)",
                border: "1px solid var(--steel)",
                borderRadius: 4,
                padding: "16px 20px 8px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  color: "var(--text-faint)",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Output vs Target per Lini
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={perLini}>
                  <CartesianGrid stroke="var(--steel)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="lini" stroke="var(--text-faint)" fontSize={12} />
                  <YAxis stroke="var(--text-faint)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel-raised)",
                      border: "1px solid var(--steel)",
                      color: "var(--text)",
                      fontSize: 13,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-muted)" }} />
                  <Bar dataKey="target" fill="var(--steel-light)" name="Target" />
                  <Bar dataKey="output" fill="var(--amber)" name="Output" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div
              style={{
                flex: "1 1 420px",
                background: "var(--panel)",
                border: "1px solid var(--steel)",
                borderRadius: 4,
                padding: "16px 20px 8px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  letterSpacing: "0.1em",
                  color: "var(--text-faint)",
                  textTransform: "uppercase",
                  marginBottom: 14,
                }}
              >
                Tren Output ({mode === "harian" ? "Harian" : "Bulanan"})
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={perPeriode}>
                  <CartesianGrid stroke="var(--steel)" strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="periode" stroke="var(--text-faint)" fontSize={12} />
                  <YAxis stroke="var(--text-faint)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--panel-raised)",
                      border: "1px solid var(--steel)",
                      color: "var(--text)",
                      fontSize: 13,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-muted)" }} />
                  <Line type="monotone" dataKey="target" stroke="var(--steel-light)" strokeWidth={2} dot={false} name="Target" />
                  <Line type="monotone" dataKey="output" stroke="var(--amber)" strokeWidth={2} dot={false} name="Output" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Log table */}
          <div
            style={{
              background: "var(--panel)",
              border: "1px solid var(--steel)",
              borderRadius: 4,
              padding: "16px 20px",
              overflowX: "auto",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 12,
                letterSpacing: "0.1em",
                color: "var(--text-faint)",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Log Data Mentah
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
              }}
            >
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--steel)" }}>Tanggal</th>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--steel)" }}>Lini/Mesin</th>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--steel)", textAlign: "right" }}>Output</th>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--steel)", textAlign: "right" }}>Target</th>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--steel)", textAlign: "right" }}>Reject</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                    <td style={{ padding: "8px 12px" }}>{r.tanggal}</td>
                    <td style={{ padding: "8px 12px" }}>{r.lini}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>{r.output.toLocaleString("id-ID")}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>{r.target.toLocaleString("id-ID")}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right", color: r.reject > 0 ? "var(--red)" : "inherit" }}>
                      {r.reject.toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "16px 12px", color: "var(--text-faint)" }}>
                      Belum ada data di Google Sheets.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
