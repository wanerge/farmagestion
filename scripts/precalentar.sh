#!/usr/bin/env bash
# Despierta y verifica /api/v1/health de farmagestion-api y simulador-eps
# antes de una demo o de ejecutar el E2E (Render free tarda ~1 min en frío).
#
# Uso:
#   ./scripts/precalentar.sh              # Producción (URLs de docs/entorno.md)
#   ./scripts/precalentar.sh --local      # Entorno local (localhost:8080 y localhost:3000)
#   PRECALENTAR_API_URL=... PRECALENTAR_SIMULADOR_URL=... ./scripts/precalentar.sh

set -euo pipefail

PROD_API_URL="https://farmagestion-api.onrender.com"
PROD_SIMULADOR_URL="https://farmagestion-simulador-eps.vercel.app"
LOCAL_API_URL="http://localhost:8080"
LOCAL_SIMULADOR_URL="http://localhost:3000"

MODO="prod"
for arg in "$@"; do
  case "$arg" in
    --local)
      MODO="local"
      ;;
    --prod)
      MODO="prod"
      ;;
    -h|--help)
      echo "Uso: $0 [--prod | --local]"
      echo ""
      echo "Variables opcionales:"
      echo "  PRECALENTAR_API_URL (o E2E_API_URL)             URL base de farmagestion-api"
      echo "  PRECALENTAR_SIMULADOR_URL (o E2E_SIMULADOR_URL) URL base de simulador-eps"
      echo "  MAX_REINTENTOS                                  Reintentos por servicio (default: 30)"
      echo "  ESPERA_SEGUNDOS                                 Espera entre intentos (default: 5)"
      echo "  TIMEOUT_SEGUNDOS                                Timeout por petición curl (default: 15)"
      exit 0
      ;;
    *)
      echo "Opción desconocida: $arg (usa --help para ver opciones)" >&2
      exit 2
      ;;
  esac
done

if [ "$MODO" = "local" ]; then
  DEFAULT_API_URL="$LOCAL_API_URL"
  DEFAULT_SIMULADOR_URL="$LOCAL_SIMULADOR_URL"
else
  DEFAULT_API_URL="$PROD_API_URL"
  DEFAULT_SIMULADOR_URL="$PROD_SIMULADOR_URL"
fi

API_URL="${PRECALENTAR_API_URL:-${E2E_API_URL:-$DEFAULT_API_URL}}"
SIMULADOR_URL="${PRECALENTAR_SIMULADOR_URL:-${E2E_SIMULADOR_URL:-$DEFAULT_SIMULADOR_URL}}"
API_URL="${API_URL%/}"
SIMULADOR_URL="${SIMULADOR_URL%/}"

MAX_REINTENTOS="${MAX_REINTENTOS:-30}"
ESPERA_SEGUNDOS="${ESPERA_SEGUNDOS:-5}"
TIMEOUT_SEGUNDOS="${TIMEOUT_SEGUNDOS:-15}"

verificar_servicio() {
  local nombre="$1"
  local url="$2"
  local inicio
  inicio="$(date +%s)"

  echo "==> Precalentando ${nombre}: ${url}"

  local intento=1
  while [ "$intento" -le "$MAX_REINTENTOS" ]; do
    local codigo="000"
    codigo="$(curl -sS -o /dev/null -w '%{http_code}' --max-time "$TIMEOUT_SEGUNDOS" "$url" || true)"

    if [ "$codigo" = "200" ]; then
      local ahora duracion
      ahora="$(date +%s)"
      duracion=$((ahora - inicio))
      echo "    [OK] ${nombre} respondió HTTP 200 (intento ${intento}/${MAX_REINTENTOS}, ${duracion}s)."
      return 0
    fi

    echo "    [esperando] ${nombre} respondió HTTP ${codigo} (intento ${intento}/${MAX_REINTENTOS}); reintentando en ${ESPERA_SEGUNDOS}s..."
    if [ "$intento" -lt "$MAX_REINTENTOS" ]; then
      sleep "$ESPERA_SEGUNDOS"
    fi
    intento=$((intento + 1))
  done

  echo "    [ERROR] ${nombre} no respondió HTTP 200 tras ${MAX_REINTENTOS} intentos (${url})." >&2
  return 1
}

verificar_servicio "simulador-eps" "${SIMULADOR_URL}/api/v1/health"
verificar_servicio "farmagestion-api" "${API_URL}/api/v1/health"

echo "==> Todos los servicios están listos."
