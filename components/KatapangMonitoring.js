"use client";

import { useEffect, useState } from "react";
import { getYesterdayRow } from "@/lib/dateUtils";
import Gear from "./katapang/gear";
import RadialGauge from "./katapang/RadialGauge";
import Marquee from "./katapang/Marquee";
import HudPanel from "./katapang/HudPanel";
import KpiTile from "./katapang/KpiTile";
import ShipmentChart from "./katapang/ShipmentChart";
import JamKerjaChart from "./katapang/JamKerjaChart";
import HudTheme from "./katapang/HudTheme";

function safeFixed(val, digits = 1) {
  const n = Number(val);
  return Number.isFinite(n) ? n.toFixed(digits) : null;
}

// Achievement status: >=100% memenuhi target, >=90% mendekati, di bawah itu
// perlu perhatian. Warna & label ikut status ini, bukan warna tetap per panel.
function achievementStatus(value) {
  if (!Number.isFinite(value) || value <= 0) return { tone: "dim", color: "#57616b", label: "NO DATA" };
  if (value >= 100) return { tone: "good", color: "#0ca30c", label: "DI ATAS TARGET" };
  if (value >= 90) return { tone: "warning", color: "#fab219", label: "MENDEKATI TARGET" };
  return { tone: "critical", color: "#d03b3b", label: "PERLU PERHATIAN" };
}

function LiveClock() {
  const [time, setTime] = useState(null);
  useEffect(() => {
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const d = new Date();
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <span id="k-clock">{time || "--:--:--"}</span>;
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
      <div className="k-root">
        <KHudChrome />
        <div style={{ position: "relative", zIndex: 2, padding: 40, fontFamily: "IBM Plex Mono, monospace", color: "#8b98a3" }}>
          Mengambil data dari Google Sheets...
        </div>
        <HudTheme />
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
        { name: "Supply", sm: jamKerja.smSupply ?? null, aktual: jamKerja.actualSupply || 0 },
        { name: "Sewing", sm: jamKerja.smSewing ?? null, aktual: jamKerja.actualSewing || 0 },
        { name: "Gudang Jadi", sm: jamKerja.smGudangJadi ?? null, aktual: jamKerja.actualGudangJadi || 0 },
        { name: "Support", sm: jamKerja.smSupport ?? null, aktual: jamKerja.actualSupport || 0 },
      ]
    : [];
  const hasJamKerjaData = jamKerjaChartData.some((d) => d.sm || d.aktual);
  const noTargetCount = jamKerjaChartData.filter((d) => !d.sm).length;

  const hasAbsensi = absensi.some((a) => a.jumlah > 0);
  const totalAbsen = absensi.reduce((sum, a) => sum + (a.jumlah || 0), 0);

  const sewStatus = achievementStatus(achievement?.achievementSewing);
  const distStatus = achievementStatus(achievement?.achievementDistribusi);
  const shortageCount = shipmentChartData.filter((d) => d.value < 0).length;

  const paKpis = [
    { label: "PA Supply", value: latestPa ? safeFixed(latestPa.supply, 2) : null },
    { label: "PA Sewing", value: latestPa ? safeFixed(latestPa.sewing, 2) : null },
    { label: "PA Gudang Jadi", value: latestPa ? safeFixed(latestPa.gudangJadi, 2) : null },
    { label: "PA Factory", value: latestPa ? safeFixed(latestPa.factory, 2) : null },
  ];
  const wipKpis = [
    { label: "WIP Sewing", value: wipSewingTotal.toLocaleString("id-ID"), unit: "pcs" },
    { label: "WIP Distribusi", value: (wipSummary?.distribusi?.total ?? 0).toLocaleString("id-ID"), unit: "pcs" },
    { label: "WIP Cutting Synthetic", value: (wipSummary?.cuttingSynthetic?.total ?? 0).toLocaleString("id-ID"), unit: "pcs" },
    { label: "WIP Cutting Leather", value: (wipSummary?.cuttingKulit?.total ?? 0).toLocaleString("id-ID"), unit: "pcs" },
  ];

  return (
    <div className="k-root">
      <KHudChrome />

      <div style={{ position: "relative", zIndex: 2 }}>
        <div className="k-topbar">
          <div className="k-brand">
            <div className="k-brand-mark">AS</div>
            <div className="k-brand-gears">
              <div style={{ position: "relative", width: 34, height: 30 }}>
                <div style={{ position: "absolute", left: -3, top: 2 }}>
                  <Gear teeth={10} rOuter={11} rBase={9} rBore={2.6} mode="fill" color="#2dd4bf" opacity={0.95} spin="cw" duration={6} />
                </div>
                <div style={{ position: "absolute", left: 15, top: 11 }}>
                  <Gear teeth={8} rOuter={7.5} rBase={6} rBore={1.8} mode="fill" color="#57616b" opacity={0.9} spin="ccw" duration={4.8} />
                </div>
              </div>
            </div>
            <div className="k-brand-text">
              <Marquee text="Katapang Monitoring" />
              <div className="k-t2">Asiglove · Production Control</div>
            </div>
          </div>
          <div className="k-sys-status">
            <span>
              <span className="k-dot-live" />
              SYSTEM NOMINAL
            </span>
            <LiveClock />
          </div>
        </div>

        {error && (
          <div className="k-error">
            <strong>Gagal memuat data.</strong> {error}
          </div>
        )}

        <div className="k-section-title k-section-title-wrap">
          <div className="k-section-gear">
            <Gear teeth={16} rOuter={70} rBase={61} rBore={16} mode="stroke" color="#2dd4bf" strokeWidth={1.6} opacity={0.12} spin="cw" duration={90} />
          </div>
          <h2>PA per Departemen &amp; Total WIP</h2>
          <div className="k-sub">{latestPa ? `READOUT — ${latestPa.tanggal}` : "READOUT"}</div>
        </div>

        <div className="k-kpi-grid">
          {paKpis.map((k) => (
            <KpiTile key={k.label} label={k.label} value={k.value} hasData={k.value !== null} foot="belum ada input hari ini" />
          ))}
          {wipKpis.map((k) => (
            <KpiTile key={k.label} label={k.label} value={k.value} unit={k.unit} hasData foot="work in process" />
          ))}
        </div>

        <div className="k-row k-row-three">
          <HudPanel title="Achievement Sewing" tag={sewStatus.label} tagTone={sewStatus.tone}>
            <div className="k-gauge-wrap">
              <RadialGauge pct={achievement?.achievementSewing} color={sewStatus.color} />
              <div className="k-gauge-figures">
                <div className="k-gauge-pct">{safeFixed(achievement?.achievementSewing, 1) ?? "-"}%</div>
                <div className="k-gauge-target">vs target 100%</div>
              </div>
            </div>
          </HudPanel>
          <HudPanel title="Achievement Distribusi" tag={distStatus.label} tagTone={distStatus.tone}>
            <div className="k-gauge-wrap">
              <RadialGauge pct={achievement?.achievementDistribusi} color={distStatus.color} />
              <div className="k-gauge-figures">
                <div className="k-gauge-pct">{safeFixed(achievement?.achievementDistribusi, 1) ?? "-"}%</div>
                <div className="k-gauge-target">vs target 100%</div>
              </div>
            </div>
          </HudPanel>
          <HudPanel title="Absensi Kemarin" tag={hasAbsensi ? `${totalAbsen} ABSEN` : "NIHIL"} tagTone={hasAbsensi ? "warning" : "good"}>
            {hasAbsensi ? (
              <div className="k-absensi-list">
                {absensi.filter((a) => a.jumlah > 0).map((a) => (
                  <div key={a.jenisAbsen} className="k-absensi-row">
                    <span>{a.jenisAbsen}</span>
                    <span className="k-absensi-count">{a.jumlah}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="k-absensi-body">
                <div className="k-absensi-icon">OK</div>
                <div className="k-absensi-text">
                  <div className="k-l1">Semua hadir</div>
                  <div className="k-l2">Tidak ada yang absen kemarin</div>
                </div>
              </div>
            )}
          </HudPanel>
        </div>

        <div className="k-row k-row-two">
          <HudPanel
            title="Monitoring Shipment"
            tag={hasShipmentData ? (shortageCount > 0 ? `${shortageCount} KEKURANGAN` : "AMAN") : "BELUM ADA DATA"}
            tagTone={hasShipmentData ? (shortageCount > 0 ? "critical" : "good") : "dim"}
          >
            {hasShipmentData ? <ShipmentChart data={shipmentChartData} /> : <p className="k-empty">Belum ada data.</p>}
          </HudPanel>
          <HudPanel
            title="Jam Kerja: SM vs Aktual"
            tag={hasJamKerjaData ? (noTargetCount > 0 ? `${noTargetCount} TANPA TARGET` : "LENGKAP") : "BELUM ADA DATA"}
            tagTone={hasJamKerjaData ? (noTargetCount > 0 ? "warning" : "good") : "dim"}
          >
            {hasJamKerjaData ? (
              <>
                <JamKerjaChart data={jamKerjaChartData} />
                <div className="k-legend">
                  <span>
                    <i className="k-legend-ghost" />
                    SM (target)
                  </span>
                  <span>
                    <i style={{ background: "#3987e5" }} />
                    Supply
                  </span>
                  <span>
                    <i style={{ background: "#d95926" }} />
                    Sewing
                  </span>
                  <span>
                    <i style={{ background: "#199e70" }} />
                    Gudang Jadi
                  </span>
                  <span>
                    <i style={{ background: "#d55181" }} />
                    Support
                  </span>
                </div>
              </>
            ) : (
              <p className="k-empty">Belum ada data.</p>
            )}
          </HudPanel>
        </div>

        <HudPanel title="Detail SPO Kekurangan Produksi & Envelope" tag={`${(achievement?.shipmentDetail || []).length} SPO`} tagTone="warning">
          <div className="k-table-wrap">
            <table className="k-table">
              <thead>
                <tr>
                  <th>SPO</th>
                  <th>Product</th>
                  <th className="k-num">Kekurangan Produksi</th>
                  <th className="k-num">Kekurangan Envelope</th>
                </tr>
              </thead>
              <tbody>
                {(achievement?.shipmentDetail || []).map((d, i) => (
                  <tr key={i}>
                    <td>{d.spo}</td>
                    <td className="k-muted">{d.style}</td>
                    <td className={`k-num ${d.kekuranganProduksi < 0 ? "k-neg" : ""}`}>{d.kekuranganProduksi.toLocaleString("id-ID")}</td>
                    <td className={`k-num ${d.kekuranganEnvelope < 0 ? "k-neg" : ""}`}>{d.kekuranganEnvelope.toLocaleString("id-ID")}</td>
                  </tr>
                ))}
                {(achievement?.shipmentDetail || []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="k-empty-row">
                      Tidak ada SPO yang kekurangan produksi/envelope saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </HudPanel>

        <footer className="k-footer">
          <span className="k-footer-brand">
            <Gear teeth={8} rOuter={8} rBase={6.4} rBore={2} mode="stroke" color="#57616b" strokeWidth={1.4} opacity={0.8} />
            ASIK CONTROL LAYER
          </span>
          <span>READOUT REFRESH ON LOAD</span>
        </footer>
      </div>

      <HudTheme />
    </div>
  );
}

function KHudChrome() {
  return (
    <>
      <div className="k-scanlines" />
      <div className="k-bg-gears">
        <div style={{ position: "absolute", top: -90, right: -70 }}>
          <Gear teeth={20} rOuter={210} rBase={186} rBore={46} mode="stroke" color="#2dd4bf" strokeWidth={2} opacity={0.05} spin="cw" duration={150} />
        </div>
        <div style={{ position: "absolute", top: 120, right: 220 }}>
          <Gear teeth={13} rOuter={120} rBase={104} rBore={26} mode="stroke" color="#d95926" strokeWidth={2} opacity={0.045} spin="ccw" duration={100} />
        </div>
      </div>
    </>
  );
}

