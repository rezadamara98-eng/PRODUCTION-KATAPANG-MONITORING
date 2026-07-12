"use client";

import { useState } from "react";
import Panel from "./Panel";
import KpiCard from "./KpiCard";

export default function GloveTracking() {
  const [serial1, setSerial1] = useState("");
  const [serial2, setSerial2] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSearch() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/glove-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serial1, serial2 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal mencari data.");
      setResult(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Panel title="Pencarian Nomor Seri Glove" style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 0, marginBottom: 14 }}>
          Masukkan 2 nomor seri yang tertera di glove (masing-masing 8 digit, boleh pakai spasi).
        </p>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ flex: "1 1 220px" }}>
            <label style={{ fontSize: 12, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>
              Nomor seri 1 (Tahun-SPO-Proses)
            </label>
            <input
              type="text"
              value={serial1}
              onChange={(e) => setSerial1(e.target.value)}
              placeholder="7 0639 435"
              style={{
                width: "100%",
                background: "var(--panel-raised)",
                border: "1px solid var(--steel)",
                borderRadius: 4,
                color: "var(--text)",
                padding: "10px 12px",
                fontSize: 14,
                fontFamily: "var(--font-mono)",
              }}
            />
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <label style={{ fontSize: 12, color: "var(--text-faint)", display: "block", marginBottom: 4 }}>
              Nomor seri 2 (Urut-Bulan-Operator)
            </label>
            <input
              type="text"
              value={serial2}
              onChange={(e) => setSerial2(e.target.value)}
              placeholder="136 07 070"
              style={{
                width: "100%",
                background: "var(--panel-raised)",
                border: "1px solid var(--steel)",
                borderRadius: 4,
                color: "var(--text)",
                padding: "10px 12px",
                fontSize: 14,
                fontFamily: "var(--font-mono)",
              }}
            />
          </div>
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !serial1 || !serial2}
          style={{
            background: "var(--teal)",
            color: "#12181c",
            border: "none",
            borderRadius: 4,
            padding: "10px 24px",
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading || !serial1 || !serial2 ? 0.6 : 1,
          }}
        >
          {loading ? "Mencari..." : "Cari"}
        </button>
      </Panel>

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
          <strong style={{ color: "var(--red)" }}>Gagal mencari.</strong> {error}
        </div>
      )}

      {result && (
        <>
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
            Hasil Decode
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
            <KpiCard eyebrow="No SPO" value={result.decoded.noSpo} />
            <KpiCard eyebrow="No Proses" value={result.decoded.noProses} />
            <KpiCard eyebrow="Tahun" value={result.decoded.tahun} />
            <KpiCard eyebrow="No Urut Seri" value={result.decoded.noUrutSeri} />
            <KpiCard eyebrow="Bulan" value={result.decoded.bulan} />
            <KpiCard eyebrow="Kode Operator" value={result.decoded.kodeOperator} />
          </div>

          <Panel title="Operator Cutting" style={{ marginBottom: 24 }}>
            {result.operatorCutting ? (
              <p style={{ fontSize: 14, margin: 0 }}>
                <strong style={{ color: "var(--text)" }}>{result.operatorCutting.nama}</strong>{" "}
                <span style={{ color: "var(--text-muted)" }}>(kode {result.operatorCutting.kode})</span>
              </p>
            ) : (
              <p style={{ fontSize: 13, color: "var(--text-faint)", margin: 0 }}>
                Kode operator {result.decoded.kodeOperator} tidak ditemukan di daftar.
              </p>
            )}
          </Panel>

          {result.lines.length > 0 && (
            <>
              {result.lines.map((line) => (
                <Panel key={line} title={`Operator Sewing di Line ${line}`} style={{ marginBottom: 16 }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                        <th style={{ padding: "6px 10px" }}>Nama</th>
                        <th style={{ padding: "6px 10px" }}>Skill</th>
                        <th style={{ padding: "6px 10px" }}>Style</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result.sewingOperatorsByLine[line] || []).map((op, i) => (
                        <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                          <td style={{ padding: "6px 10px" }}>{op.nama}</td>
                          <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{op.skill}</td>
                          <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{op.style}</td>
                        </tr>
                      ))}
                      {(result.sewingOperatorsByLine[line] || []).length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ padding: "10px", color: "var(--text-faint)" }}>
                            Belum ada data operator sewing untuk line ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </Panel>
              ))}
            </>
          )}

          <Panel title="Hasil Pencarian di SPO TRACK">
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-faint)" }}>
                  <th style={{ padding: "6px 10px" }}>Line</th>
                  <th style={{ padding: "6px 10px" }}>Box</th>
                  <th style={{ padding: "6px 10px" }}>Product</th>
                </tr>
              </thead>
              <tbody>
                {result.matchedBoxes.slice(0, 50).map((b, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--steel)" }}>
                    <td style={{ padding: "6px 10px" }}>{b.line}</td>
                    <td style={{ padding: "6px 10px" }}>{b.box}</td>
                    <td style={{ padding: "6px 10px", color: "var(--text-muted)" }}>{b.product}</td>
                  </tr>
                ))}
                {result.matchedBoxes.length === 0 && (
                  <tr>
                    <td colSpan={3} style={{ padding: "10px", color: "var(--text-faint)" }}>
                      Tidak ada box yang cocok dengan SPO {result.decoded.noSpo}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {result.matchedBoxes.length > 50 && (
              <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 10, marginBottom: 0 }}>
                Menampilkan 50 dari {result.matchedBoxes.length} box yang cocok.
              </p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
