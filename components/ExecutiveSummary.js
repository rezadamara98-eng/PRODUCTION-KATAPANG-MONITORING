"use client";

import { useEffect, useMemo, useState } from "react";
import KpiCard from "./KpiCard";
import Panel from "./Panel";
import { getYesterdayRow } from "@/lib/dateUtils";

function safeFixed(val, digits = 2) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

export default function ExecutiveSummary() {
  const [paRows, setPaRows] = useState([]);
  const [wipSummary, setWipSummary] = useState(null);
  const [wipLineData, setWipLineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [paRes, wipRes] = await Promise.all([
          fetch("/api/pa", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/wip", { cache: "no-store" }).then((r) => r.json()),
        ]);

        if (paRes.error) throw new Error(paRes.error);
        if (wipRes.error) throw new Error(wipRes.error);

        if (!cancelled) {
          setPaRows(paRes.data);
          setWipSummary(wipRes.summary);
          setWipLineData(wipRes.lineData || []);
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

  const latestPa = useMemo(() => getYesterdayRow(paRows, "tanggal"), [paRows]);

  const maxWipLine = useMemo(
    () => Math.max(1, ...wipLineData.map((l) => l.totalWip)),
    [wipLineData]
  );

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
            background: "rgba(217,83,79,0.12)",
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

      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          letterSpacing: "0.1em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        PA per departemen {latestPa ? `- ${latestPa.tanggal}` : ""}
      </p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard eyebrow="PA Supply" value={latestPa ? safeFixed(latestPa.supply, 2) : "-"} unit="%" />
        <KpiCard eyebrow="PA Sewing" value={latestPa ? safeFixed(latestPa.sewing, 2) : "-"} unit="%" />
        <KpiCard
          eyebrow="PA Gudang Jadi"
          value={latestPa ? safeFixed(latestPa.gudangJadi, 2) : "-"}
          unit="%"
          tone={latestPa && latestPa.gudangJadi >= 100 ? "green" : undefined}
        />
        <KpiCard eyebrow="PA Factory" value={latestPa ? safeFixed(latestPa.factory, 2) : "-"} unit="%" />
      </div>

      <p
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 12,
          letterSpacing: "0.1em",
          color: "var(--text-faint)",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        Total WIP {wipSummary?.distribusi?.tanggal ? `- ${wipSummary.distribusi.tanggal}` : ""}
      </p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard eyebrow="WIP Distribusi" value={(wipSummary?.distribusi?.total ?? 0).toLocaleString("id-ID")} unit="pcs" />
        <KpiCard eyebrow="WIP Cutting Synthetic" value={(wipSummary?.cuttingSynthetic?.total ?? 0).toLocaleString("id-ID")} unit="pcs" />
        <KpiCard eyebrow="WIP Cutting Leather" value={(wipSummary?.cuttingKulit?.total ?? 0).toLocaleString("id-ID")} unit="pcs" />
      </div>

      <Panel title={`WIP Line Sewing per line ${wipLineData.length > 0 ? "- " + wipLineData[0].tanggal : ""}`}>
        {wipLineData.length === 0 ? (
          <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Belum ada data.</div>
        ) : (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140 }}>
            {wipLineData.map((l) => (
              <div key={l.line} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)" }}>
                  {l.totalWip.toLocaleString("id-ID")}
                </span>
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(4, (l.totalWip / maxWipLine) * 100)}px`,
                    background: l.keterangan === "PROBLEM" ? "var(--red)" : "var(--green)",
                    borderRadius: "3px 3px 0 0",
                  }}
                />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{l.line}</span>
              </div>
            ))}
          </div>
        )}
        <p style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 10, marginBottom: 0 }}>
          <span style={{ color: "var(--green)" }}>Hijau</span> = aman, <span style={{ color: "var(--red)" }}>merah</span> = problem (kolom keterangan)
        </p>
      </Panel>
    </div>
  );
}
