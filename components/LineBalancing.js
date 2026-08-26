"use client";

import Gear from "./katapang/gear";
import HudPanel from "./katapang/HudPanel";
import KpiTile from "./katapang/KpiTile";
import CycleTimeChart from "./katapang/CycleTimeChart";
import HudTheme from "./katapang/HudTheme";

// ---------------------------------------------------------------------------
// CONTOH DATA — belum terhubung ke Google Sheets.
// Tab "Line Balancing" di spreadsheet sumber belum di-export/dipelajari
// strukturnya (nama tab, nama kolom persis) sehingga fungsi pengambilan data
// (lib/sheets.js) sengaja belum ditulis di sini - risikonya sama seperti kasus
// header "prosesditemukan" sebelumnya: menebak nama kolom akan mudah salah dan
// diam-diam mengembalikan data kosong. Begitu file CSV/Excel tab ini dikirim,
// bagian ini tinggal diganti dengan fetch("/api/line-balancing").
// ---------------------------------------------------------------------------
const SAMPLE_STATIONS = [
  { station: "Cutting Prep", operator: "OP-01", cycleTime: 38 },
  { station: "Jahit Palm", operator: "OP-02", cycleTime: 45 },
  { station: "Jahit Back", operator: "OP-03", cycleTime: 41 },
  { station: "Jahit Thumb", operator: "OP-04", cycleTime: 52 },
  { station: "Fourchette", operator: "OP-05", cycleTime: 47 },
  { station: "Overlock", operator: "OP-06", cycleTime: 39 },
  { station: "Welting", operator: "OP-07", cycleTime: 36 },
  { station: "Trimming & QC", operator: "OP-08", cycleTime: 33 },
];
const SAMPLE_TAKT_TIME = 42;

export default function LineBalancing() {
  const stations = SAMPLE_STATIONS;
  const taktTime = SAMPLE_TAKT_TIME;

  const totalCycle = stations.reduce((sum, s) => sum + s.cycleTime, 0);
  const avgCycle = totalCycle / stations.length;
  const bottleneck = stations.reduce((max, s) => (s.cycleTime > max.cycleTime ? s : max), stations[0]);
  const lineEfficiency = (totalCycle / (stations.length * bottleneck.cycleTime)) * 100;
  const bottleneckCount = stations.filter((s) => s.cycleTime > taktTime).length;

  return (
    <div className="k-root">
      <div className="k-scanlines" />
      <div className="k-bg-gears">
        <div style={{ position: "absolute", top: -90, right: -70 }}>
          <Gear teeth={20} rOuter={210} rBase={186} rBore={46} mode="stroke" color="#2dd4bf" strokeWidth={2} opacity={0.05} spin="cw" duration={150} />
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 2 }}>
        <div className="k-topbar">
          <div className="k-brand">
            <div className="k-brand-mark" style={{ borderColor: "#fab219", color: "#fab219", boxShadow: "0 0 14px rgba(250,178,25,.3) inset" }}>
              LB
            </div>
            <div className="k-brand-text">
              <div style={{ fontFamily: "Rajdhani, sans-serif", fontWeight: 700, fontSize: 18, letterSpacing: ".06em", textTransform: "uppercase" }}>
                Line Balancing
              </div>
              <div className="k-t2">Cycle Time per Station · Sewing Line</div>
            </div>
          </div>
          <div className="k-sys-status">
            <span className="k-sample-badge">CONTOH DATA — MENUNGGU STRUKTUR SHEET ASLI</span>
          </div>
        </div>

        <div className="k-section-title">
          <h2>Ringkasan Line Balancing</h2>
          <div className="k-sub">ILUSTRASI · 8 STATION</div>
        </div>

        <div className="k-kpi-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          <KpiTile label="Takt Time" value={taktTime} unit="detik" hasData foot="target waktu per unit" />
          <KpiTile label="Rata-rata Cycle Time" value={avgCycle.toFixed(1)} unit="detik" hasData foot={`dari ${stations.length} station`} />
          <KpiTile label="Bottleneck Station" value={bottleneck.station} hasData foot={`${bottleneck.cycleTime} detik · ${bottleneck.operator}`} />
          <KpiTile label="Line Efficiency" value={lineEfficiency.toFixed(1)} unit="%" hasData foot="ΣCT ÷ (N × CT maks)" />
        </div>

        <div className="k-row k-row-two" style={{ gridTemplateColumns: "1fr" }}>
          <HudPanel
            title="Cycle Time per Station"
            tag={bottleneckCount > 0 ? `${bottleneckCount} DI ATAS TAKT TIME` : "SEIMBANG"}
            tagTone={bottleneckCount > 0 ? "critical" : "good"}
          >
            <CycleTimeChart data={stations} taktTime={taktTime} />
          </HudPanel>
        </div>

        <HudPanel title="Detail Station" tag={`${stations.length} STATION`} tagTone="dim">
          <div className="k-table-wrap">
            <table className="k-table">
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Operator</th>
                  <th className="k-num">Cycle Time (detik)</th>
                  <th className="k-num">Selisih vs Takt</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {stations.map((s) => {
                  const diff = s.cycleTime - taktTime;
                  const isBottleneck = s.cycleTime > taktTime;
                  return (
                    <tr key={s.station}>
                      <td>{s.station}</td>
                      <td className="k-muted">{s.operator}</td>
                      <td className="k-num">{s.cycleTime}</td>
                      <td className={`k-num ${isBottleneck ? "k-neg" : ""}`}>
                        {diff > 0 ? "+" : ""}
                        {diff}
                      </td>
                      <td>
                        <span className={`k-tag ${isBottleneck ? "k-tag-critical" : "k-tag-good"}`}>
                          {isBottleneck ? "BOTTLENECK" : "OK"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </HudPanel>

        <footer className="k-footer">
          <span className="k-footer-brand">
            <Gear teeth={8} rOuter={8} rBase={6.4} rBore={2} mode="stroke" color="#57616b" strokeWidth={1.4} opacity={0.8} />
            ASIK CONTROL LAYER
          </span>
          <span>DATA ILUSTRASI — BELUM TERHUBUNG SPREADSHEET</span>
        </footer>
      </div>

      <HudTheme />
      <style jsx>{`
        .k-sample-badge {
          font-family: "IBM Plex Mono", monospace;
          font-size: 10px;
          letter-spacing: 0.04em;
          color: #fab219;
          border: 1px solid #fab219;
          padding: 4px 9px;
          border-radius: 2px;
          text-transform: uppercase;
        }
      `}</style>
    </div>
  );
}
