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
    <main style={{ minHeight: "100vh", padding: "28px 32px 60px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: "1px solid var(--steel)",
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
              borderBottom: active === tab.key ? "2px solid var(--teal)" : "2px solid transparent",
              color: active === tab.key ? "var(--text)" : "var(--text-muted)",
              fontWeight: active === tab.key ? 600 : 400,
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
    </main>
  );
}
