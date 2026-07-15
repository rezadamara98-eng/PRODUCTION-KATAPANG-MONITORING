"use client";

import { useState } from "react";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import DashboardProduction from "@/components/DashboardProduction";
import AchievementPlanning from "@/components/AchievementPlanning";
import ManpowerKapasitas from "@/components/ManpowerKapasitas";
import GloveTracking from "@/components/GloveTracking";
import AsikSolution from "@/components/AsikSolution";
import Logo from "@/components/Logo";

const TABS = [
  { key: "exec", label: "Executive Summary" },
  { key: "prod", label: "Dashboard Production" },
  { key: "plan", label: "Achievement Planning" },
  { key: "mp", label: "Manpower dan Kapasitas" },
  { key: "glove", label: "Glove Tracking" },
  { key: "asik", label: "ASIK Solution" },
];

export default function Home() {
  const [active, setActive] = useState("exec");

  return (
    <main style={{ minHeight: "100vh", padding: "28px 32px 60px", position: "relative" }}>
      <svg
        width="70"
        height="60"
        viewBox="0 0 70 60"
        style={{ position: "absolute", top: 24, right: 28, opacity: 0.5 }}
      >
        <path
          d="M28 6 L31 6 L32 11 L36 12.5 L40 9.5 L42.5 12 L39.5 16 L41 20 L46 21 L46 24 L41 25 L39.5 29 L42.5 33 L40 35.5 L36 32.5 L32 34 L31 39 L28 39 L27 34 L23 32.5 L19 35.5 L16.5 33 L19.5 29 L18 25 L13 24 L13 21 L18 20 L19.5 16 L16.5 12 L19 9.5 L23 12.5 L27 11 Z"
          fill="none"
          stroke="var(--navy)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <circle cx="29.5" cy="22.5" r="6" fill="none" stroke="var(--navy)" strokeWidth="1.6" />
      </svg>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "2px solid var(--navy)",
        }}
      >
        <Logo size={48} />
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 28,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "0.02em",
              lineHeight: 1.1,
              color: "var(--navy)",
            }}
          >
            ASIK_AI
          </h1>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)", margin: "3px 0 0" }}>
            Monitoring Produksi Katapang
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--steel)",
          marginBottom: 24,
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            style={{
              padding: "10px 18px",
              background: "none",
              border: "none",
              borderBottom: active === tab.key ? "2px solid var(--navy)" : "2px solid transparent",
              color: active === tab.key ? "var(--navy)" : "var(--text-muted)",
              fontWeight: active === tab.key ? 700 : 400,
              fontSize: 14,
              cursor: "pointer",
              whiteSpace: "nowrap",
              fontFamily: "var(--font-body)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {active === "exec" && <ExecutiveSummary />}
      {active === "prod" && <DashboardProduction />}
      {active === "plan" && <AchievementPlanning />}
      {active === "mp" && <ManpowerKapasitas />}
      {active === "glove" && <GloveTracking />}
      {active === "asik" && <AsikSolution />}

      <div
        style={{
          marginTop: 32,
          background: "var(--navy)",
          padding: "8px 16px",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 10,
        }}
      >
        <p style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, color: "#ffffff", letterSpacing: "0.08em", margin: 0 }}>
          ASIK_AI &middot; MONITORING PRODUKSI KATAPANG
        </p>
        <svg width="40" height="12">
          <polygon points="0,0 10,0 4,12 -6,12" fill="var(--teal)" />
          <polygon points="14,0 24,0 18,12 8,12" fill="var(--teal)" opacity="0.6" />
          <polygon points="28,0 38,0 32,12 22,12" fill="var(--teal)" opacity="0.3" />
        </svg>
      </div>
    </main>
  );
}
