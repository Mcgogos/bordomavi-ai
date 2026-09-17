import { NextRequest, NextResponse } from "next/server";
import { MatchAutomationEngine, MatchEventParams } from "@/lib/matchday/match-engine";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret") || request.headers.get("authorization")?.replace("Bearer ", "");
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret || secret !== expectedSecret) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Cron ping: Can trigger autonomous match state check
    return NextResponse.json({
      success: true,
      message: "Canlı Maç Otonom Robotu Aktif.",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: MatchEventParams = await request.json();

    if (!body.type || !body.opponent) {
      return NextResponse.json({ success: false, error: "Eksik maç parametreleri" }, { status: 400 });
    }

    const result = await MatchAutomationEngine.publishMatchEventDirectly(body);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}