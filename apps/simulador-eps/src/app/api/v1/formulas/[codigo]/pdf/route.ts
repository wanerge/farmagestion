import { NextRequest } from "next/server";
import { validarApiKey } from "@/lib/api-key";
import { problemResponse } from "@/lib/problem";

export async function GET(request: NextRequest) {
  const authError = validarApiKey(request);
  if (authError) return authError;

  return problemResponse({
    status: 501,
    title: "No implementado",
    detail: "La generación de PDF se implementa en la siguiente fase (P4).",
    code: "NO_IMPLEMENTADO",
  });
}
