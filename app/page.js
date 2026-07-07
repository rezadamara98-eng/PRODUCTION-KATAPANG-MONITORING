"use client";

import { useState } from "react";
import ExecutiveSummary from "@/components/ExecutiveSummary";
import DashboardProduction from "@/components/DashboardProduction";
import AchievementPlanning from "@/components/AchievementPlanning";
import AsikSolution from "@/components/AsikSolution";

const TABS = [
  { key: "exec", label: "Executive Summary" },
  { key: "prod", label: "Dashboard Production" },
  { key: "plan", label: "Achievement Planning" },
  { key: "asik", label: "ASIK Solution" },
];

export default function Home() {
  const [active, setActive] = useState("exec");

  return (
    <main style={{ minHeight: "100vh", padding: "28px 32px 60px" }}>
      <div
        style={{
          marginBottom: 24,
          paddingBottom: 16,
          borderBottom: "1px solid var(--steel)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: "var(--amber)",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Status Lini &middot; Real-time
        </div>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 34,
            fontWeight: 700,
            margin: 0,
            letterSpacing: "0.01em",
          }}
        >
          PANEL PRODUKSI KATAPANG
        </h1>
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
              borderBottom: active === tab.key ? "2px solid var(--amber)" : "2px solid transparent",
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
      {active === "asik" && <AsikSolution />}
    </main>
  );
}
