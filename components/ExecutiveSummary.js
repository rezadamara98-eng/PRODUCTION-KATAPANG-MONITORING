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
} from "recharts";
import KpiCard from "./KpiCard";
import Panel from "./Panel";

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

export default function ExecutiveSummary() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  if (loading) {
    return (
      <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        Mengambil data dari Google Sheets...
      </div>
    );
  }

  return (
    <div>
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

      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: "var(--text-faint)",
          marginBottom: 16,
        }}
      >
        {fetchedAt ? `Diperbarui: ${new Date(fetchedAt).toLocaleString("id-ID")}` : ""}
      </div>

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

      <Panel title="Status Per Lini / Mesin" style={{ marginBottom: 24 }}>
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
      </Panel>

      <Panel title="Output vs Target per Lini">
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
      </Panel>
    </div>
  );
}
