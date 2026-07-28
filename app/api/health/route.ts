import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "ok", service: "tlamatiloyan-dashboard" }, { headers: { "Cache-Control": "no-store" } });
}

