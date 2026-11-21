"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/Modal";
import { PacienteGuard } from "@/components/PacienteGuard";
import {
  portalApi,
  type FormulaDetalle,
  type FormulaResumen,
  type FranjasDisponibles,
  type SedePublica,
} from "@/lib/api/client";
import { isApiError, type StockInsuficienteItem } from "@/lib/api/problem";
import {
  CLASE_ESTADO_ITEM,
  CLASE_NIVEL_DISPONIBILIDAD,
  ETIQUETA_ESTADO_ITEM,
  ETIQUETA_NIVEL_DISPONIBILIDAD,
  fechaHoyBogota,
  fechaMananaBogota,
  formatearFecha,
  formatearHora,
  type ModalidadPedido,
  type NivelDisponibilidad,
} from "@/lib/format";

const MapaSeleccionUbicacionLeaflet = dynamic(
  () => import("@/components/MapaSeleccionUbicacionLeaflet"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-72 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-xs text-slate-500 sm:h-80">
        Cargando mapa para ubicar tu domicilio…
      </div>
    ),
  }
);

interface ItemSeleccionado {
  seleccionado: boolean;
  cantidad: number;
}

function ContenidoNuevoPedido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formulaIdParam = searchParams.get("formulaId") ?? "";
  const sedeIdParam = searchParams.get("sedeId") ?? "";

  const { sesion, sedes: sedesCtx, refrescarNotificaciones, mostrarExito } =
    useApp();
  const token = sesion?.accessToken ?? "";

  const [formulas, setFormulas] = useState<FormulaResumen[]>([]);
  const [sedes, setSedes] = useState<SedePublica[]>(sedesCtx);
  const [cargandoInicial, setCargandoInicial] = useState(true);

  const [formulaId, setFormulaId] = useState<string>(formulaIdParam);
  const [formulaDetalle, setFormulaDetalle] = useState<FormulaDetalle | null>(
    null
  );
  const [cargandoFormula, setCargandoFormula] = useState(false);

  const [sedeId, setSedeId] = useState<string>(sedeIdParam);
  const [modalidad, setModalidad] = useState<ModalidadPedido>("RECOGER");
  const [seleccionItems, setSeleccionItems] = useState<
    Record<string, ItemSeleccionado>
  >({});

  // Campos exclusivos de modalidad DOMICILIO (RF-PAC-12)
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [latitudEntrega, setLatitudEntrega] = useState<number | null>(null);
  const [longitudEntrega, setLongitudEntrega] = useState<number | null>(null);

  const fechaHoy = useMemo(() => fechaHoyBogota(), []);
  const fechaManana = useMemo(() => fechaMananaBogota(), []);
  const [fechaTurno, setFechaTurno] = useState<string>(fechaHoy);

  const [franjasData, setFranjasData] = useState<FranjasDisponibles | null>(
    null
  );
  const [cargandoFranjas, setCargandoFranjas] = useState(false);
  const [franjaInicio, setFranjaInicio] = useState<string>("");

  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  // Estado para modal de 409 STOCK_INSUFICIENTE (RF-PAC-13, CA-PAC-05, CA-PAC-06)
  const [modalFaltanteAbierto, setModalFaltanteAbierto] = useState(false);
  const [faltanteDetalleMsg, setFaltanteDetalleMsg] = useState("");
  const [faltanteItems, setFaltanteItems] = useState<StockInsuficienteItem[]>(
    []
  );

  // Cargar fórmulas vigentes y sedes
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      setCargandoInicial(true);
      Promise.all([
        portalApi.listarFormulas({ token }),
        sedesCtx.length > 0 ? Promise.resolve(sedesCtx) : portalApi.listarSedes(),
      ])
        .then(([listaFormulas, listaSedes]) => {
          if (cancelled) return;
          const disponibles = listaFormulas.filter(
            (f) =>
              f.vigente &&
              (f.items ?? []).some((it) => (it.cantidadPendiente ?? 0) > 0)
          );
          setFormulas(disponibles);
          setSedes(listaSedes);

          setFormulaId((prev) => {
            if (prev && disponibles.some((f) => f.id === prev)) return prev;
            return disponibles[0]?.id ?? "";
          });

          setSedeId((prev) => {
            if (prev && listaSedes.some((s) => s.id === prev)) return prev;
            return listaSedes[0]?.id ?? "";
          });
        })
        .catch(() => {
          // Error global notificado
        })
        .finally(() => {
          if (!cancelled) setCargandoInicial(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, sedesCtx]);

  // Cargar detalle de la fórmula seleccionada (incluye matriz de disponibilidad y saldos)
  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (!token || !formulaId) {
        setFormulaDetalle(null);
        setSeleccionItems({});
        return;
      }
      setCargandoFormula(true);
      setErrorForm(null);

      portalApi
        .obtenerDetalleFormula(formulaId, { token })
        .then((detalle) => {
          if (cancelled) return;
          setFormulaDetalle(detalle);
          const init: Record<string, ItemSeleccionado> = {};
          for (const item of detalle.items ?? []) {
            if (!item.medicamentoId) continue;
            const pendiente = item.cantidadPendiente ?? 0;
            init[item.medicamentoId] = {
              seleccionado: pendiente > 0,
              cantidad: pendiente > 0 ? pendiente : 0,
            };
          }
          setSeleccionItems(init);
        })
        .catch(() => {
          if (!cancelled) setFormulaDetalle(null);
        })
        .finally(() => {
          if (!cancelled) setCargandoFormula(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, formulaId]);

  // Cargar franjas horarias con cupo para la sede y fecha elegidas (RF-PAC-11, RN-PAC-05)
  const cargarFranjas = useCallback(async () => {
    if (modalidad !== "RECOGER" || !token || !sedeId || !fechaTurno) {
      setFranjasData(null);
      setFranjaInicio("");
      return;
    }
    setCargandoFranjas(true);
    try {
      const data = await portalApi.consultarFranjas(sedeId, fechaTurno, {
        token,
      });
      setFranjasData(data);
      const primeraDisponible = (data.franjas ?? []).find(
        (f) => f.disponible && f.franjaInicio
      );
      setFranjaInicio((prev) => {
        if (
          prev &&
          (data.franjas ?? []).some(
            (f) => f.franjaInicio === prev && f.disponible
          )
        ) {
          return prev;
        }
        return primeraDisponible?.franjaInicio ?? "";
      });
    } catch {
      setFranjasData(null);
      setFranjaInicio("");
    } finally {
      setCargandoFranjas(false);
    }
  }, [modalidad, token, sedeId, fechaTurno]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarFranjas();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarFranjas]);

  const itemsParaEnviar = useMemo(() => {
    const lista: Array<{ medicamentoId: string; cantidad: number }> = [];
    for (const item of formulaDetalle?.items ?? []) {
      const medId = item.medicamentoId;
      if (!medId) continue;
      const sel = seleccionItems[medId];
      if (sel?.seleccionado && sel.cantidad > 0) {
        lista.push({ medicamentoId: medId, cantidad: sel.cantidad });
      }
    }
    return lista;
  }, [formulaDetalle, seleccionItems]);

  const nombrePorMedId = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const item of formulaDetalle?.items ?? []) {
      if (item.medicamentoId) {
        mapa.set(
          item.medicamentoId,
          item.medicamentoNombre ?? item.medicamentoCodigo ?? item.medicamentoId
        );
      }
    }
    return mapa;
  }, [formulaDetalle]);

  const nivelEnSede = (
    medicamentoId: string,
    targetSedeId: string
  ): NivelDisponibilidad | null => {
    const item = formulaDetalle?.items?.find(
      (i) => i.medicamentoId === medicamentoId
    );
    const disp = item?.disponibilidadPorSede?.find(
      (d) => d.sedeId === targetSedeId
    );
    return (disp?.nivel as NivelDisponibilidad) ?? null;
  };

  const sedeSeleccionada = useMemo(
    () => sedes.find((s) => s.id === sedeId) ?? null,
    [sedes, sedeId]
  );

  const manejarSeleccionUbicacion = useCallback((lat: number, lon: number) => {
    setLatitudEntrega(lat);
    setLongitudEntrega(lon);
    setErrorForm(null);
  }, []);

  const enviarPedido = async (aceptaParcial: boolean) => {
    if (!token) return;
    setErrorForm(null);

    if (!formulaId) {
      setErrorForm("Selecciona una fórmula médica vigente.");
      return;
    }
    if (!sedeId) {
      setErrorForm("Selecciona una sede para tu pedido.");
      return;
    }
    if (itemsParaEnviar.length === 0) {
      setErrorForm("Selecciona al menos un medicamento con cantidad mayor a cero.");
      return;
    }
    if (modalidad === "RECOGER" && !franjaInicio) {
      setErrorForm(
        "Selecciona una franja horaria con cupo disponible (hoy o mañana)."
      );
      return;
    }
    if (modalidad === "DOMICILIO") {
      if (!direccionEntrega.trim()) {
        setErrorForm("Ingresa la dirección de entrega en texto.");
        return;
      }
      if (latitudEntrega === null || longitudEntrega === null) {
        setErrorForm(
          "Marca tu ubicación de entrega haciendo clic en el mapa."
        );
        return;
      }
    }

    setEnviando(true);
    try {
      const payload =
        modalidad === "RECOGER"
          ? {
              formulaId,
              sedeId,
              modalidad: "RECOGER" as const,
              franjaInicio,
              aceptaParcial,
              items: itemsParaEnviar,
            }
          : {
              formulaId,
              sedeId,
              modalidad: "DOMICILIO" as const,
              direccionEntrega: direccionEntrega.trim(),
              latitudEntrega: latitudEntrega!,
              longitudEntrega: longitudEntrega!,
              aceptaParcial,
              items: itemsParaEnviar,
            };

      const creado = await portalApi.crearPedido(payload, {
        token,
        notifyGlobalError: false,
      });
      setModalFaltanteAbierto(false);
      await refrescarNotificaciones();
      mostrarExito(
        creado.esParcial ? "Pedido parcial reservado" : "Pedido reservado",
        creado.modalidad === "DOMICILIO"
          ? `Código ${creado.codigo} · Envío a domicilio registrado correctamente.`
          : creado.turno?.codigo
            ? `Código ${creado.codigo} · Turno asignado: ${creado.turno.codigo}.`
            : `Código ${creado.codigo} creado correctamente.`
      );
      router.replace(`/pedidos/${creado.id}`);
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "STOCK_INSUFICIENTE") {
          setFaltanteDetalleMsg(err.mensajeUsuario);
          setFaltanteItems(err.stockInsuficienteItems ?? []);
          setModalFaltanteAbierto(true);
        } else {
          setErrorForm(err.mensajeUsuario);
          if (err.code === "FRANJA_SIN_CUPO") {
            void cargarFranjas();
          }
        }
      } else {
        setErrorForm("No fue posible crear el pedido. Intenta nuevamente.");
      }
    } finally {
      setEnviando(false);
    }
  };

  const puedeAceptarParcial = useMemo(
    () => faltanteItems.some((item) => item.disponible > 0),
    [faltanteItems]
  );

  if (cargandoInicial) {
    return (
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        <div className="h-64 animate-pulse rounded-2xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (formulas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <h1 className="text-lg font-bold text-slate-900">
          No tienes fórmulas disponibles para pedir
        </h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">
          Para crear un pedido necesitas al menos una fórmula vinculada vigente
          con saldo pendiente por reclamar.
        </p>
        <Link
          href="/formulas"
          className="mt-4 inline-flex rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Ir a mis fórmulas
        </Link>
      </div>
    );
  }

  const franjas = franjasData?.franjas ?? [];
  const hayFranjasDisponibles = franjas.some((f) => f.disponible);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link
            href="/pedidos"
            className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800"
          >
            ← Volver a mis pedidos
          </Link>
          <h1 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">
            {modalidad === "RECOGER"
              ? "Nuevo pedido · Recoger en sede"
              : "Nuevo pedido · Envío a domicilio"}
          </h1>
          <p className="mt-0.5 text-sm text-slate-600">
            {modalidad === "RECOGER"
              ? "Reserva tus medicamentos y agenda una franja horaria con turno sin hacer filas."
              : "Reserva tus medicamentos e indica tu dirección y ubicación en el mapa para recibirlos a domicilio."}
          </p>
        </div>
      </div>

      {errorForm && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-900 sm:text-sm"
        >
          {errorForm}
        </div>
      )}

      {/* Paso 1: Fórmula */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">
          1. Selecciona la fórmula médica
        </h2>
        <select
          aria-label="Fórmula médica"
          value={formulaId}
          onChange={(e) => setFormulaId(e.target.value)}
          className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        >
          {formulas.map((f) => (
            <option key={f.id} value={f.id}>
              {f.codigoExterno} · Vigente hasta {formatearFecha(f.fechaVencimiento)}
            </option>
          ))}
        </select>
      </section>

      {/* Paso 2: Sede y modalidad (RF-PAC-10, RF-PAC-11, RF-PAC-12) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">
          2. Elige la sede y la modalidad de entrega
        </h2>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setModalidad("RECOGER");
              setErrorForm(null);
            }}
            className={`rounded-xl border p-3.5 text-left transition ${
              modalidad === "RECOGER"
                ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20"
                : "border-slate-200 bg-white hover:border-teal-300"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">
                Recoger en sede
              </span>
              {modalidad === "RECOGER" && (
                <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white">
                  Activa
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Agenda una franja horaria hoy o mañana y recibe tu código de turno.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalidad("DOMICILIO");
              setErrorForm(null);
            }}
            className={`rounded-xl border p-3.5 text-left transition ${
              modalidad === "DOMICILIO"
                ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20"
                : "border-slate-200 bg-white hover:border-indigo-300"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-slate-900">
                Envío a domicilio
              </span>
              {modalidad === "DOMICILIO" && (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">
                  Activa
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Indica tu dirección y marca el punto de entrega en el mapa.
            </p>
          </button>
        </div>

        <p className="mt-4 text-xs font-semibold text-slate-700">
          Sede que atenderá tu pedido:
        </p>

        <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {sedes.map((sede) => {
            const seleccionada = sede.id === sedeId;
            return (
              <button
                key={sede.id}
                type="button"
                onClick={() => sede.id && setSedeId(sede.id)}
                className={`rounded-xl border p-3.5 text-left transition ${
                  seleccionada
                    ? "border-teal-600 bg-teal-50/70 ring-2 ring-teal-500/20"
                    : "border-slate-200 bg-white hover:border-teal-300"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-slate-900">
                    {sede.nombre}
                  </span>
                  {seleccionada && (
                    <span className="rounded-full bg-teal-700 px-2 py-0.5 text-[10px] font-bold text-white">
                      Elegida
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-600">{sede.direccion}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {formatearHora(sede.horaApertura)} –{" "}
                  {formatearHora(sede.horaCierre)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Paso 3: Ítems y cantidades (RN-03) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">
          3. Medicamentos y cantidades a solicitar
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Puedes pedir hasta el saldo pendiente autorizado en tu fórmula.
        </p>

        {cargandoFormula ? (
          <div className="mt-3 h-28 animate-pulse rounded-xl bg-slate-100" />
        ) : (
          <div className="mt-3 space-y-2.5">
            {(formulaDetalle?.items ?? []).map((item) => {
              const medId = item.medicamentoId ?? "";
              const pendiente = item.cantidadPendiente ?? 0;
              const sel = seleccionItems[medId] ?? {
                seleccionado: false,
                cantidad: 0,
              };
              const nivel = sedeId ? nivelEnSede(medId, sedeId) : null;
              const deshabilitado = pendiente <= 0;

              return (
                <div
                  key={item.id ?? medId}
                  className={`flex flex-col gap-3 rounded-xl border p-3.5 sm:flex-row sm:items-center sm:justify-between ${
                    deshabilitado
                      ? "border-slate-100 bg-slate-50 opacity-60"
                      : sel.seleccionado
                        ? "border-teal-300 bg-teal-50/30"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <label className="flex flex-1 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      disabled={deshabilitado}
                      checked={sel.seleccionado}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSeleccionItems((prev) => ({
                          ...prev,
                          [medId]: {
                            seleccionado: checked,
                            cantidad: checked
                              ? Math.max(1, prev[medId]?.cantidad || pendiente)
                              : prev[medId]?.cantidad || pendiente,
                          },
                        }));
                      }}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {item.medicamentoNombre}
                        </span>
                        {nivel && (
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${CLASE_NIVEL_DISPONIBILIDAD[nivel]}`}
                          >
                            {ETIQUETA_NIVEL_DISPONIBILIDAD[nivel]} en sede
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {item.presentacion} · Pendiente disponible para pedir:{" "}
                        <strong>{pendiente}</strong>
                      </p>
                    </div>
                  </label>

                  {!deshabilitado && (
                    <div className="flex items-center gap-2 self-end sm:self-center">
                      <span className="text-xs font-medium text-slate-600">
                        Cantidad:
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={pendiente}
                        disabled={!sel.seleccionado}
                        aria-label={`Cantidad para ${item.medicamentoNombre}`}
                        value={sel.cantidad}
                        onChange={(e) => {
                          const raw = Number.parseInt(e.target.value, 10);
                          const clamped = Number.isNaN(raw)
                            ? 1
                            : Math.min(pendiente, Math.max(1, raw));
                          setSeleccionItems((prev) => ({
                            ...prev,
                            [medId]: {
                              ...sel,
                              cantidad: clamped,
                            },
                          }));
                        }}
                        className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-center text-sm font-semibold text-slate-900 focus:border-teal-600 focus:outline-none disabled:bg-slate-100"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Paso 4: Franja horaria (RECOGER) o Dirección y mapa (DOMICILIO) */}
      {modalidad === "RECOGER" ? (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">
              4. Franja horaria para recoger
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Agenda hoy o mañana con al menos 60 minutos de anticipación.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
            <button
              type="button"
              onClick={() => setFechaTurno(fechaHoy)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                fechaTurno === fechaHoy
                  ? "bg-teal-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hoy ({formatearFecha(fechaHoy)})
            </button>
            <button
              type="button"
              onClick={() => setFechaTurno(fechaManana)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                fechaTurno === fechaManana
                  ? "bg-teal-700 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Mañana ({formatearFecha(fechaManana)})
            </button>
          </div>
        </div>

        <div className="mt-4">
          {cargandoFranjas ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          ) : !hayFranjasDisponibles ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <p className="font-semibold">
                No hay franjas disponibles para esta fecha en la sede elegida.
              </p>
              <p className="mt-1">
                {fechaTurno === fechaHoy
                  ? "Recuerda que los turnos requieren 60 minutos de anticipación dentro del horario de la sede. Prueba seleccionando Mañana."
                  : "Intenta seleccionando otra sede con cupos disponibles."}
              </p>
              {fechaTurno === fechaHoy && (
                <button
                  type="button"
                  onClick={() => setFechaTurno(fechaManana)}
                  className="mt-2.5 rounded-lg bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-800"
                >
                  Ver franjas de mañana
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {franjas.map((franja) => {
                const valor = franja.franjaInicio ?? "";
                const elegida = valor !== "" && valor === franjaInicio;
                const disponible = Boolean(franja.disponible);
                return (
                  <button
                    key={valor || franja.horaInicio}
                    type="button"
                    disabled={!disponible}
                    onClick={() => disponible && setFranjaInicio(valor)}
                    className={`flex flex-col items-center justify-center rounded-xl border px-3 py-2.5 text-center transition ${
                      !disponible
                        ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400"
                        : elegida
                          ? "border-teal-600 bg-teal-700 text-white shadow-xs"
                          : "border-slate-200 bg-white text-slate-800 hover:border-teal-400"
                    }`}
                  >
                    <span className="text-xs font-bold sm:text-sm">
                      {formatearHora(franja.horaInicio)} –{" "}
                      {formatearHora(franja.horaFin)}
                    </span>
                    <span
                      className={`mt-0.5 text-[10px] ${
                        elegida ? "text-teal-100" : "text-slate-500"
                      }`}
                    >
                      {disponible
                        ? `${franja.cuposDisponibles ?? 0} cupo${
                            franja.cuposDisponibles === 1 ? "" : "s"
                          }`
                        : "Sin cupo / cerrada"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>
      ) : (
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">
          4. Dirección y ubicación de entrega
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Escribe tu dirección completa y haz clic en el mapa para marcar el
          punto exacto de entrega (sin geocodificación automática).
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="direccion-entrega"
              className="block text-xs font-semibold text-slate-700"
            >
              Dirección de entrega (obligatoria)
            </label>
            <input
              id="direccion-entrega"
              type="text"
              maxLength={255}
              value={direccionEntrega}
              onChange={(e) => setDireccionEntrega(e.target.value)}
              placeholder="Ej. Carrera 43A # 10-25, Apto 402, Medellín"
              className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-700">
                Ubicación en el mapa (haz clic o arrastra el marcador ★)
              </span>
              {latitudEntrega !== null && longitudEntrega !== null ? (
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-indigo-800">
                  {latitudEntrega.toFixed(6)}, {longitudEntrega.toFixed(6)}
                </span>
              ) : (
                <span className="text-[11px] text-amber-800">
                  Pendiente de marcar en el mapa
                </span>
              )}
            </div>

            <MapaSeleccionUbicacionLeaflet
              sede={sedeSeleccionada}
              latitud={latitudEntrega}
              longitud={longitudEntrega}
              onSeleccionarUbicacion={manejarSeleccionUbicacion}
            />

            <p className="text-[11px] text-slate-500">
              El marcador verde (S) indica la sede elegida. Haz clic sobre tu
              ubicación en el mapa para fijar las coordenadas de entrega.
            </p>
          </div>
        </div>
      </section>
      )}

      {/* Confirmación */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href={`/formulas/${formulaId}`}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Cancelar
        </Link>

        <button
          type="button"
          disabled={
            enviando ||
            itemsParaEnviar.length === 0 ||
            !sedeId ||
            (modalidad === "RECOGER"
              ? !franjaInicio
              : !direccionEntrega.trim() ||
                latitudEntrega === null ||
                longitudEntrega === null)
          }
          onClick={() => void enviarPedido(false)}
          className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando
            ? modalidad === "RECOGER"
              ? "Reservando stock y generando turno…"
              : "Reservando stock para domicilio…"
            : modalidad === "RECOGER"
              ? "Confirmar pedido y generar turno"
              : "Confirmar pedido a domicilio"}
        </button>
      </div>

      {/* Modal 409 STOCK_INSUFICIENTE (RF-PAC-13, RN-02, CA-PAC-05, CA-PAC-06) */}
      <Modal
        abierto={modalFaltanteAbierto}
        titulo="Disponibilidad parcial en la sede"
        descripcion={
          faltanteDetalleMsg ||
          "Algunos medicamentos no tienen inventario suficiente para tu solicitud completa."
        }
        onCerrar={() => setModalFaltanteAbierto(false)}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
            <strong>Aún no se ha reservado ningún medicamento.</strong> Revisa
            el detalle por ítem y decide si deseas continuar con lo disponible o
            cancelar.
          </div>

          {faltanteItems.length > 0 && (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {faltanteItems.map((it) => (
                <div
                  key={it.medicamentoId}
                  className="flex items-center justify-between gap-3 p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {nombrePorMedId.get(it.medicamentoId) ?? it.medicamentoId}
                    </p>
                    <p className="mt-0.5 text-slate-600">
                      Solicitado: <strong>{it.solicitada}</strong> · Se puede
                      reservar: <strong>{it.disponible}</strong>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                      CLASE_ESTADO_ITEM[it.estadoItem]
                    }`}
                  >
                    {ETIQUETA_ESTADO_ITEM[it.estadoItem]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!puedeAceptarParcial && (
            <p className="text-xs text-rose-700">
              Ninguno de los medicamentos solicitados cuenta con unidades
              disponibles en esta sede. Elige otra sede o intenta más tarde.
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={enviando}
              onClick={() => setModalFaltanteAbierto(false)}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {puedeAceptarParcial ? "Cancelar sin reservar" : "Entendido"}
            </button>

            {puedeAceptarParcial && (
              <button
                type="button"
                disabled={enviando}
                onClick={() => void enviarPedido(true)}
                className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
              >
                {enviando
                  ? "Creando pedido parcial…"
                  : "Aceptar pedido parcial"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function NuevoPedidoPage() {
  return (
    <PacienteGuard>
      <Suspense
        fallback={
          <div className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        }
      >
        <ContenidoNuevoPedido />
      </Suspense>
    </PacienteGuard>
  );
}
