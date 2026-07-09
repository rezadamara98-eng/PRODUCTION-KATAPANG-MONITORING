"use client";

import { useEffect, useState } from "react";
import KpiCard from "./KpiCard";
import Panel from "./Panel";

function safeFixed(val, digits = 1) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

export default function AchievementPlanning() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/achievement", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal mengambil data");
        if (!cancelled) {
          setData(json);
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

  useEffect(() => {
    let cancelled = false;
    async function loadAnalysis() {
      try {
        setAnalysisLoading(true);
        const res = await fetch("/api/achievement-analysis", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal mendapat analisa");
        if (!cancelled) {
          setAnalysis(json.analysis);
          setAnalysisError(null);
        }
      } catch (err) {
        if (!cancelled) setAnalysisError(err.message);
      } finally {
        if (!cancelled) setAnalysisLoading(false);
      }
    }
    loadAnalysis();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        Mengambil data Achievement Planning dari Google Sheets...
      </div>
    );
  }

  const shipment = data?.shipment || {};

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
        Achievement (data kemarin)
      </p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard
          eyebrow="Achievement Sewing"
          value={data ? safeFixed(data.achievementSewing, 1) : "-"}
          unit="%"
          tone={data && data.achievementSewing >= 100 ? "green" : data && data.achievementSewing < 90 ? "red" : undefined}
        />
        <KpiCard
          eyebrow="Achievement Distribusi"
          value={data ? safeFixed(data.achievementDistribusi, 1) : "-"}
          unit="%"
          tone={data && data.achievementDistribusi >= 100 ? "green" : data && data.achievementDistribusi < 90 ? "red" : undefined}
        />
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
        Monitoring Shipment (akumulasi)
      </p>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
        <KpiCard
          eyebrow="Kekurangan Produksi"
          value={(shipment.totalKekuranganProduksi ?? 0).toLocaleString("id-ID")}
          tone="red"
        />
        <KpiCard
          eyebrow="Kekurangan Envelope"
          value={(shipment.totalKekuranganEnvelope ?? 0).toLocaleString("id-ID")}
          tone="red"
        />
        <KpiCard eyebrow="Qty Shipment" value={(shipment.totalQtyShipment ?? 0).toLocaleString("id-ID")} />
        <KpiCard eyebrow="Qty Shipment Pack" value={(shipment.totalQtyShipmentPack ?? 0).toLocaleString("id-ID")} />
      </div>

      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ color: "var(--teal)", fontSize: 14 }}>&#10022;</span>
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 12,
              letterSpacing: "0.1em",
              color: "var(--text-faint)",
              textTransform: "uppercase",
            }}
          >
            Analisa dan Rekomendasi AI
          </span>
        </div>
        {analysisLoading ? (
          <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0 }}>Menganalisa data...</p>
        ) : analysisError ? (
          <p style={{ fontSize: 13, color: "var(--red)", margin: 0 }}>{analysisError}</p>
        ) : (
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text)", margin: 0, whiteSpace: "pre-wrap" }}>
            {analysis}
          </p>
        )}
      </Panel>
    </div>
  );
}
