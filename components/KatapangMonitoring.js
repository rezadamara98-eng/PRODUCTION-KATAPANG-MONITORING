"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import KpiCard from "./KpiCard";
import Panel from "./Panel";
import { getYesterdayRow } from "@/lib/dateUtils";

function safeFixed(val, digits = 1) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : "-";
}

const NAVY = "#0a2647";
const TEAL = "#3ab7c4";
const GREEN = "#1a7a4c";
const RED = "#c0392b";
const AMBER = "#b3720f";
const GRAY = "#c3cddc";

function AchievementDonut({ value, color }) {
  const v = Number.isFinite(value) ? Math.max(0, value) : 0;
  const gap = Math.max(0, 100 - v);
  const data = [
    { name: "Tercapai", value: v },
    { name: "Gap", value: gap },
  ];
  return (
    <div style={{ position: "relative", height: 140 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" innerRadius="65%" outerRadius="90%" startAngle={90} endAngle={-270}>
            <Cell fill={color} />
            <Cell fill={GRAY} />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: 22,
          fontWeight: 700,
          color: "var(--navy)",
          fontFamily: "var(--font-mono)",
        }}
      >
        {safeFixed(v, 1)}%
      </div>
    </div>
  );
}

export default function KatapangMonitoring() {
  const [pa, setPa] = useState(null);
  const [wip, setWip] = useState(null);
  const [achievement, setAchievement] = useState(null);
  const [manpower, setManpower] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const [paRes, wipRes, achRes, mpRes] = await Promise.all([
          fetch("/api/pa", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/wip", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/achievement", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/manpower", { cache: "no-store" }).then((r) => r.json()),
        ]);
        if (paRes.error) throw new Error(paRes.error);
        if (wipRes.error) throw new Error(wipRes.error);
        if (achRes.error) throw new Error(achRes.error);
        if (mpRes.error) throw new Error(mpRes.error);
        if (!cancelled) {
          setPa(paRes);
          setWip(wipRes);
          setAchievement(achRes);
          setManpower(mpRes);
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

  if (loading) {
    return (
      <div style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
        Mengambil data dari Google Sheets...
      </div>
    );
  }

  const latestPa = getYesterdayRow(pa?.data || [], "tanggal");
  const wipSummary = wip?.summary;
  const wipLineData = wip?.lineData || [];
  const wipSewingTotal = wipLineData.reduce((sum, l) => sum + l.totalWip, 0);

  const shipment = achievement?.shipment || {};
  const absensi = manpower?.absensi || [];
  const jamKerja = manpower?.jamKerja;

  const shipmentChartData = [
    { name: "Kekurangan Produksi", value: shipment.totalKekuranganProduksi || 0 },
    { name: "Kekurangan Envelope", value: shipment.totalKekuranganEnvelope || 0 },
    { name: "Qty Shipment", value: shipment.totalQtyShipment || 0 },
    { name: "Qty Shipment Pack", value: shipment.totalQtyShipmentPack || 0 },
  ];
  const hasShipmentData = shipmentChartData.some((d) => d.value !== 0);

  const jamKerjaChartData = jamKerja
    ? [
        { name: "Supply", SM: jamKerja.smSupply, Aktual: jamKerja.actualSupply },
        { name: "Sewing", SM: jamKerja.smSewing, Aktual: jamKerja.actualSewing },
        { name: "Gudang Jadi", SM: jamKerja.smGudangJadi, Aktual: jamKerja.actualGudangJadi },
        { name: "Support", SM: jamKerja.smSupport, Aktual: jamKerja.actualSupport },
      ]
    : [];
  const hasJamKerjaData = jamKerjaChartData.some((d) => d.SM || d.Aktual);

  const absensiChartData = absensi.map((a) => ({ name: a.jenisAbsen, value: a.jumlah }));
  const absensiColors = [GRAY, TEAL, AMBER, RED, NAVY];

  return (
    <div>
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
        PA per Departemen &amp; Total WIP {latestPa ? `- ${latestPa.tanggal}` : ""}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, marginBottom: 24 }}>
        <KpiCard eyebrow="PA Supply" value={latestPa ? safeFixed(latestPa.supply, 2) : "-"} />
        <KpiCard eyebrow="PA Sewing" value={latestPa ? safeFixed(latestPa.sewing, 2) : "-"} />
        <KpiCard
          eyebrow="PA Gudang Jadi"
          value={latestPa ? safeFixed(latestPa.gudangJadi, 2) : "-"}
          tone={latestPa && latestPa.gudangJadi >= 100 ? "green" : undefined}
        />
        <KpiCard eyebrow="PA Factory" value={latestPa ? safeFixed(latestPa.factory, 2) : "-"} />
        <KpiCard eyebrow="WIP Sewing" value={wipSewingTotal.toLocaleString("id-ID")} unit="pcs" tone="green" />
        <KpiCard eyebrow="WIP Distribusi" value={(wipSummary?.distribusi?.total ?? 0).toLocaleString("id-ID")} unit="pcs" />
        <KpiCard eyebrow="WIP Cutting Synthetic" value={(wipSummary?.cuttingSynthetic?.total ?? 0).toLocaleString("id-ID")} unit="pcs" />
        <KpiCard eyebrow="WIP Cutting Leather" value={(wipSummary?.cuttingKulit?.total ?? 0).toLocaleString("id-ID")} unit="pcs" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
        <Panel title="Achievement Sewing">
          <AchievementDonut value={achievement?.achievementSewing} color={AMBER} />
        </Panel>
        <Panel title="Achievement Distribusi">
          <AchievementDonut value={achievement?.achievementDistribusi} color={GREEN} />
        </Panel>
        <Panel title="Absensi Kemarin">
          <div style={{ height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={absensiChartData} dataKey="value" nameKey="name" outerRadius="80%" label={{ fontSize: 11 }}>
                  {absensiChartData.map((_, i) => (
                    <Cell key={i} fill={absensiColors[i % absensiColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Panel title="Monitoring Shipment">
          <div style={{ height: 200 }}>
            {hasShipmentData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shipmentChartData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" stroke="var(--text-faint)" fontSize={10} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-faint)" fontSize={10} width={120} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {shipmentChartData.map((d, i) => (
                      <Cell key={i} fill={d.value < 0 ? RED : TEAL} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Belum ada data.</p>
            )}
          </div>
        </Panel>
        <Panel title="Jam Kerja: SM vs Aktual">
          <div style={{ height: 200 }}>
            {hasJamKerjaData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={jamKerjaChartData}>
                  <XAxis dataKey="name" stroke="var(--text-faint)" fontSize={10} />
                  <YAxis stroke="var(--text-faint)" fontSize={10} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Bar dataKey="SM" fill={GRAY} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Aktual" fill={TEAL} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p style={{ color: "var(--text-faint)", fontSize: 13 }}>Belum ada data.</p>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Detail SPO Kekurangan Produksi &amp; Envelope">
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
              <th style={{ padding: "6px 10px" }}>SPO</th>
              <th style={{ padding: "6px 10px" }}>Product</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Kekurangan Produksi</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Kekurangan Envelope</th>
            </tr>
          </thead>
          <tbody>
            {(achievement?.shipmentDetail || []).map((d, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                <td style={{ padding: "6px 10px" }}>{d.spo}</td>
                <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{d.style}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: d.kekuranganProduksi < 0 ? "var(--red)" : "var(--text)" }}>
                  {d.kekuranganProduksi.toLocaleString("id-ID")}
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right", color: d.kekuranganEnvelope < 0 ? "var(--red)" : "var(--text)" }}>
                  {d.kekuranganEnvelope.toLocaleString("id-ID")}
                </td>
              </tr>
            ))}
            {(achievement?.shipmentDetail || []).length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: "12px 10px", color: "var(--text-faint)" }}>
                  Tidak ada SPO yang kekurangan produksi/envelope saat ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
