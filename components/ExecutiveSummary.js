"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import KpiCard from "./KpiCard";
import Panel from "./Panel";

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
        const res = await fetch("/api/pa", { cache: "no-store" });
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

  const latest = rows.length > 0 ? rows[rows.length - 1] : null;

  const averages = useMemo(() => {
    if (rows.length === 0) return { supply: 0, sewing: 0, gudangJadi: 0, factory: 0 };
    const sum = rows.reduce(
      (acc, r) => {
        acc.supply += r.supply;
        acc.sewing += r.sewing;
        acc.gudangJadi += r.gudangJadi;
        acc.factory += r.factory;
        return acc;
      },
      { supply: 0, sewing: 0, gudangJadi: 0, factory: 0 }
    );
    const n = rows.length;
    return {
      supply: sum.supply / n,
      sewing: sum.sewing / n,
      gudangJadi: sum.gudangJadi / n,
      factory: sum.factory / n,
    };
  }, [rows]);

  // Ambil 30 data terakhir saja untuk grafik tren biar tidak terlalu padat
  const chartData = useMemo(() => rows.slice(-30), [rows]);

  if (loading) {
    return (
      <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        Mengambil data PA dari Google Sheets...
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
        {latest && ` \u00b7 Data terakhir: ${latest.tanggal}`}
      </div>

      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          letterSpacing: "0.1em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        PA Hari Terakhir
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard
          eyebrow="PA Supply"
          value={latest ? latest.supply.toFixed(2) : "-"}
          unit="%"
        />
        <KpiCard
          eyebrow="PA Sewing"
          value={latest ? latest.sewing.toFixed(2) : "-"}
          unit="%"
        />
        <KpiCard
          eyebrow="PA Gudang Jadi"
          value={latest ? latest.gudangJadi.toFixed(2) : "-"}
          unit="%"
        />
        <KpiCard
          eyebrow="PA Factory"
          value={latest ? latest.factory.toFixed(2) : "-"}
          unit="%"
        />
      </div>

      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          letterSpacing: "0.1em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Rata-rata Keseluruhan
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard eyebrow="Rata-rata Supply" value={averages.supply.toFixed(2)} unit="%" />
        <KpiCard eyebrow="Rata-rata Sewing" value={averages.sewing.toFixed(2)} unit="%" />
        <KpiCard eyebrow="Rata-rata Gudang Jadi" value={averages.gudangJadi.toFixed(2)} unit="%" />
        <KpiCard eyebrow="Rata-rata Factory" value={averages.factory.toFixed(2)} unit="%" />
      </div>

      <Panel title="Tren PA per Departemen (30 hari terakhir)">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={chartData}>
            <CartesianGrid stroke="var(--steel)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="tanggal" stroke="var(--text-faint)" fontSize={11} />
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
            <Line type="monotone" dataKey="supply" stroke="var(--amber)" strokeWidth={2} dot={false} name="Supply" />
            <Line type="monotone" dataKey="sewing" stroke="var(--green)" strokeWidth={2} dot={false} name="Sewing" />
            <Line type="monotone" dataKey="gudangJadi" stroke="#4a90d9" strokeWidth={2} dot={false} name="Gudang Jadi" />
            <Line type="monotone" dataKey="factory" stroke="var(--red)" strokeWidth={2} dot={false} name="Factory" />
          </LineChart>
        </ResponsiveContainer>
      </Panel>
    </div>
  );
}
