import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "UP",
    servicio: "simulador-eps",
    timestamp: new Date().toISOString(),
  });
}
