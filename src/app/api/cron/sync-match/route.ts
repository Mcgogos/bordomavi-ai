import { NextRequest, NextResponse } from "next/server";
import { MatchAutomationEngine, MatchEventParams } from "@/lib/matchday/match-engine";
import { verifyApiAuthorization } from "@/lib/api-auth";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authCheck = await verifyApiAuthorization(request);
  if (!authCheck.authorized) {
    return authCheck.unauthorizedResponse!;
  }

  try {
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
  const authCheck = await verifyApiAuthorization(request);
  if (!authCheck.authorized) {
    return authCheck.unauthorizedResponse!;
  }

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
