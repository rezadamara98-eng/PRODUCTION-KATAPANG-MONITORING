import { NextResponse } from "next/server";
import { getPlanSewData, getPlanDistData, getGudangJadiData, getGudangJadiSummary } from "@/lib/sheets";
import { getLastCompleteGroupRows } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [planSewRows, planDistRows, gudangSummary] = await Promise.all([
      getPlanSewData(),
      getPlanDistData(),
      getGudangJadiSummary(),
    ]);

    const sewYesterday = getLastCompleteGroupRows(planSewRows, "tanggal", "achievement");
    const validSew = sewYesterday.filter((r) => Number.isFinite(r.achievement) && r.actualSew > 0);
    const achievementSewing =
      validSew.length > 0 ? validSew.reduce((sum, r) => sum + r.achievement, 0) / validSew.length : 0;

    const distYesterday = getLastCompleteGroupRows(planDistRows, "tanggal", "achievement");
    const validDist = distYesterday.filter((r) => Number.isFinite(r.achievement) && r.actual > 0);
    const achievementDistribusi =
      validDist.length > 0 ? validDist.reduce((sum, r) => sum + r.achievement, 0) / validDist.length : 0;

    return NextResponse.json({
      achievementSewing,
      achievementDistribusi,
      sewYesterday,
      distYesterday,
      shipment: gudangSummary,
      fetchedAt: new Date().toISOString(),
      debug: {
        totalPlanSewRows: planSewRows.length,
        totalPlanDistRows: planDistRows.length,
        samplePlanSewRow: planSewRows[0] || null,
        samplePlanDistRow: planDistRows[0] || null,
        lastPlanSewRow: planSewRows[planSewRows.length - 1] || null,
        lastPlanDistRow: planDistRows[planDistRows.length - 1] || null,
      },
    });
  } catch (err) {
    console.error("Gagal mengambil data Achievement Planning:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data Achievement Planning" },
      { status: 500 }
    );
  }
}
