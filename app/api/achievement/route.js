import { NextResponse } from "next/server";
import { getPlanSewData, getPlanDistData, getGudangJadiData, getGudangJadiSummary } from "@/lib/sheets";
import { getYesterdayGroupRows } from "@/lib/dateUtils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [planSewRows, planDistRows, gudangSummary] = await Promise.all([
      getPlanSewData(),
      getPlanDistData(),
      getGudangJadiSummary(),
    ]);

    const sewYesterday = getYesterdayGroupRows(planSewRows, "tanggal");
    const achievementSewing =
      sewYesterday.length > 0
        ? sewYesterday.reduce((sum, r) => sum + r.achv, 0) / sewYesterday.length
        : 0;

    const distYesterday = getYesterdayGroupRows(planDistRows, "tanggal");
    const achievementDistribusi =
      distYesterday.length > 0
        ? distYesterday.reduce((sum, r) => sum + r.achievement, 0) / distYesterday.length
        : 0;

    return NextResponse.json({
      achievementSewing,
      achievementDistribusi,
      sewYesterday,
      distYesterday,
      shipment: gudangSummary,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("Gagal mengambil data Achievement Planning:", err);
    return NextResponse.json(
      { error: err.message || "Gagal mengambil data Achievement Planning" },
      { status: 500 }
    );
  }
}
