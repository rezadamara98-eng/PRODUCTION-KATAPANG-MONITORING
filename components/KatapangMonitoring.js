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
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import KpiCard from "./KpiCard";
import Panel from "./Panel";

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

  const latestPa = pa?.data?.length > 0 ? pa.data[pa.data.length - 1] : null;
  const wipSummary = wip?.summary;
  const wipLineData = wip?.lineData || [];
  const wipSewingTotal = wipLineData.reduce((sum, l) => sum + l.totalWip, 0);

  const shipment = achievement?.shipment || {};
  const absensi = manpower?.absensi || [];
  const jamKerja = manpower?.jamKerja;
  const kapasitasCutting = manpower?.kapasitasCutting || [];
  const strongPoint = manpower?.strongPoint || [];

  const shipmentChartData = [
    { name: "Kekurangan Produksi", value: shipment.totalKekuranganProduksi || 0 },
    { name: "Kekurangan Envelope", value: shipment.totalKekuranganEnvelope || 0 },
    { name: "Qty Shipment", value: shipment.totalQtyShipment || 0 },
    { name: "Qty Shipment Pack", value: shipment.totalQtyShipmentPack || 0 },
  ];

  const jamKerjaChartData = jamKerja
    ? [
        { name: "Supply", SM: jamKerja.smSupply, Aktual: jamKerja.actualSupply },
        { name: "Sewing", SM: jamKerja.smSewing, Aktual: jamKerja.actualSewing },
        { name: "Gudang Jadi", SM: jamKerja.smGudangJadi, Aktual: jamKerja.actualGudangJadi },
        { name: "Support", SM: jamKerja.smSupport, Aktual: jamKerja.actualSupport },
      ]
    : [];

  const absensiChartData = absensi.map((a) => ({ name: a.jenisAbsen, value: a.jumlah }));
  const absensiColors = [GRAY, TEAL, AMBER, RED, NAVY];

  const kapasitasChartData = [...kapasitasCutting]
    .sort((a, b) => b.kapasitas - a.kapasitas)
    .map((k) => ({ name: k.nama, value: k.kapasitas }));

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

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14, marginBottom: 24 }}>
        <Panel title="Top 10 Kapasitas Cutting">
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kapasitasChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="var(--steel)" strokeDasharray="2 4" horizontal={false} />
                <XAxis type="number" stroke="var(--text-faint)" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="var(--text-faint)" fontSize={11} width={100} />
                <Tooltip />
                <Bar dataKey="value" fill={NAVY} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Panel title="Monitoring Shipment" style={{ flex: 1 }}>
            <div style={{ height: 100 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={shipmentChartData} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" stroke="var(--text-faint)" fontSize={10} />
                  <YAxis type="category" dataKey="name" stroke="var(--text-faint)" fontSize={10} width={110} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {shipmentChartData.map((d, i) => (
                      <Cell key={i} fill={d.value < 0 ? RED : TEAL} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Jam Kerja: SM vs Aktual" style={{ flex: 1 }}>
            <div style={{ height: 100 }}>
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
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Skill Matrik Cutting (Top 10)" style={{ marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
              <th style={{ padding: "6px 10px" }}>Nama</th>
              <th style={{ padding: "6px 10px" }}>Job</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Lama Kerja</th>
              <th style={{ padding: "6px 10px" }}>Pemahaman Artikel</th>
            </tr>
          </thead>
          <tbody>
            {(manpower?.skillMatrik || []).map((s, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                <td style={{ padding: "6px 10px" }}>{s.nama}</td>
                <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{s.job}</td>
                <td style={{ padding: "6px 10px", textAlign: "right" }}>{safeFixed(s.lamaBekerja, 1)} th</td>
                <td
                  style={{
                    padding: "6px 10px",
                    color:
                      s.pemahamanArtikel.toLowerCase().includes("kurang")
                        ? "var(--red)"
                        : s.pemahamanArtikel.toLowerCase() === "faham"
                        ? "var(--green)"
                        : "var(--text-muted)",
                  }}
                >
                  {s.pemahamanArtikel}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

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
        Strong Point Line - Dikelompokkan per Style
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {strongPoint.map((g) => (
          <Panel key={g.style} title={`${g.style}${g.buyer ? " \u00b7 " + g.buyer : ""}`}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                  <th style={{ padding: "6px 10px" }}>Line</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Target Kanan</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Target Kiri</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Efisiensi Kanan</th>
                  <th style={{ padding: "6px 10px", textAlign: "right" }}>Efisiensi Kiri</th>
                </tr>
              </thead>
              <tbody>
                {g.lines.map((l, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                    <td style={{ padding: "6px 10px" }}>{l.line}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{l.targetKanan}</td>
                    <td style={{ padding: "6px 10px", textAlign: "right" }}>{l.targetKiri}</td>
                    <td
                      style={{
                        padding: "6px 10px",
                        textAlign: "right",
                        color: l.effKanan >= 100 ? "var(--green)" : l.effKanan >= 85 ? "var(--amber, #b3720f)" : "var(--red)",
                      }}
                    >
                      {safeFixed(l.effKanan, 1)}%
                    </td>
                    <td
                      style={{
                        padding: "6px 10px",
                        textAlign: "right",
                        color: l.effKiri >= 100 ? "var(--green)" : l.effKiri >= 85 ? "var(--amber, #b3720f)" : "var(--red)",
                      }}
                    >
                      {safeFixed(l.effKiri, 1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        ))}
        {strongPoint.length === 0 && <div style={{ color: "var(--text-faint)", fontSize: 13 }}>Belum ada data.</div>}
      </div>
    </div>
  );
}
