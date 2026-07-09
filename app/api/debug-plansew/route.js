import { NextResponse } from "next/server";
import { getPlanSewDebugInfo } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const info = await getPlanSewDebugInfo();
    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
