import { NextResponse } from "next/server";

export type ErrorCode =
  | "VALIDACION_ERROR"
  | "API_KEY_INVALIDA"
  | "FORMULA_NO_ENCONTRADA"
  | "FORMULA_NO_DISPENSABLE"
  | "CANTIDAD_EXCEDE_AUTORIZADA"
  | "MEDICAMENTO_NO_EN_FORMULA"
  | "NO_IMPLEMENTADO"
  | "ERROR_INTERNO";

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: ErrorCode;
}

export class DomainProblemError extends Error {
  readonly status: number;
  readonly title: string;
  readonly code: ErrorCode;
  readonly type: string;

  constructor(params: {
    status: number;
    title: string;
    detail: string;
    code: ErrorCode;
    type?: string;
  }) {
    super(params.detail);
    this.status = params.status;
    this.title = params.title;
    this.code = params.code;
    this.type =
      params.type ??
      `https://farmagestion.co/errores/${params.code.toLowerCase().replace(/_/g, "-")}`;
  }
}

export function problemResponse(params: {
  status: number;
  title: string;
  detail: string;
  code: ErrorCode;
  type?: string;
}): NextResponse<ProblemBody> {
  const body: ProblemBody = {
    type:
      params.type ??
      `https://farmagestion.co/errores/${params.code.toLowerCase().replace(/_/g, "-")}`,
    title: params.title,
    status: params.status,
    detail: params.detail,
    code: params.code,
  };

  return NextResponse.json(body, {
    status: params.status,
    headers: {
      "Content-Type": "application/problem+json",
    },
  });
}

export function fromErrorToProblem(error: unknown): NextResponse<ProblemBody> {
  if (error instanceof DomainProblemError) {
    return problemResponse({
      status: error.status,
      title: error.title,
      detail: error.message,
      code: error.code,
      type: error.type,
    });
  }
  return problemResponse({
    status: 500,
    title: "Error interno del servidor",
    detail: "Ocurrió un error inesperado procesando la solicitud.",
    code: "ERROR_INTERNO",
  });
}
