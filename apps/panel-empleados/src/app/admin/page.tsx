"use client";

import { useCallback, useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Modal } from "@/components/Modal";
import { RoleGuard } from "@/components/RoleGuard";
import {
  farmaApi,
  type CargoEmpleado,
  type EmpleadoAdmin,
  type EstadoEventoIntegracion,
  type EventoIntegracion,
  type MedicamentoAdmin,
  type Parametro,
  type RolUsuario,
  type SedeAdmin,
} from "@/lib/api/client";
import { puedeAdministrar } from "@/lib/auth/permisos";
import {
  CLASE_ESTADO_OUTBOX,
  ETIQUETA_CARGO,
  ETIQUETA_ESTADO_OUTBOX,
  formatearFechaHora,
  formatearHora,
} from "@/lib/format";

type TabAdmin = "sedes" | "empleados" | "catalogo" | "parametros" | "outbox";

const TABS: Array<{ id: TabAdmin; label: string }> = [
  { id: "sedes", label: "Sedes" },
  { id: "empleados", label: "Empleados" },
  { id: "catalogo", label: "Catálogo" },
  { id: "parametros", label: "Parámetros" },
  { id: "outbox", label: "Outbox de integración" },
];

interface FormSede {
  codigo: string;
  nombre: string;
  direccion: string;
  latitud: string;
  longitud: string;
  horaApertura: string;
  horaCierre: string;
  activa: boolean;
}

const FORM_SEDE_INICIAL: FormSede = {
  codigo: "",
  nombre: "",
  direccion: "",
  latitud: "6.244200",
  longitud: "-75.581200",
  horaApertura: "07:00",
  horaCierre: "19:00",
  activa: true,
};

interface FormEmpleado {
  email: string;
  password: string;
  rol: RolUsuario;
  cargo: CargoEmpleado;
  sedeId: string;
  nombres: string;
  apellidos: string;
  activo: boolean;
}

const FORM_EMPLEADO_INICIAL: FormEmpleado = {
  email: "",
  password: "",
  rol: "EMPLEADO",
  cargo: "AUXILIAR",
  sedeId: "",
  nombres: "",
  apellidos: "",
  activo: true,
};

interface FormMedicamento {
  codigo: string;
  nombre: string;
  principioActivo: string;
  presentacion: string;
  activo: boolean;
}

const FORM_MED_INICIAL: FormMedicamento = {
  codigo: "",
  nombre: "",
  principioActivo: "",
  presentacion: "",
  activo: true,
};

function ContenidoAdmin() {
  const { sesion, mostrarExito, refrescarSedes } = useApp();
  const token = sesion?.accessToken;
  const adminActualId = sesion?.usuario?.id;

  const [tab, setTab] = useState<TabAdmin>("sedes");

  // --- Sedes ---
  const [sedes, setSedes] = useState<SedeAdmin[]>([]);
  const [cargandoSedes, setCargandoSedes] = useState(false);
  const [modalSedeAbierto, setModalSedeAbierto] = useState(false);
  const [sedeEditando, setSedeEditando] = useState<SedeAdmin | null>(null);
  const [formSede, setFormSede] = useState<FormSede>(FORM_SEDE_INICIAL);
  const [guardandoSede, setGuardandoSede] = useState(false);

  // --- Empleados ---
  const [empleados, setEmpleados] = useState<EmpleadoAdmin[]>([]);
  const [cargandoEmpleados, setCargandoEmpleados] = useState(false);
  const [modalEmpleadoAbierto, setModalEmpleadoAbierto] = useState(false);
  const [empleadoEditando, setEmpleadoEditando] = useState<EmpleadoAdmin | null>(null);
  const [formEmpleado, setFormEmpleado] = useState<FormEmpleado>(FORM_EMPLEADO_INICIAL);
  const [guardandoEmpleado, setGuardandoEmpleado] = useState(false);

  // --- Catálogo ---
  const [medicamentos, setMedicamentos] = useState<MedicamentoAdmin[]>([]);
  const [medTotal, setMedTotal] = useState(0);
  const [medPage, setMedPage] = useState(0);
  const [medBusqueda, setMedBusqueda] = useState("");
  const [medFiltroActivo, setMedFiltroActivo] = useState<"todos" | "activos" | "inactivos">("todos");
  const [cargandoMeds, setCargandoMeds] = useState(false);
  const [modalMedAbierto, setModalMedAbierto] = useState(false);
  const [medEditando, setMedEditando] = useState<MedicamentoAdmin | null>(null);
  const [formMed, setFormMed] = useState<FormMedicamento>(FORM_MED_INICIAL);
  const [guardandoMed, setGuardandoMed] = useState(false);

  // --- Parámetros ---
  const [parametros, setParametros] = useState<Parametro[]>([]);
  const [valoresParametros, setValoresParametros] = useState<Record<string, string>>({});
  const [cargandoParams, setCargandoParams] = useState(false);
  const [guardandoParams, setGuardandoParams] = useState(false);

  // --- Outbox ---
  const [eventos, setEventos] = useState<EventoIntegracion[]>([]);
  const [eventosTotal, setEventosTotal] = useState(0);
  const [eventosPage, setEventosPage] = useState(0);
  const [filtroEstadoOutbox, setFiltroEstadoOutbox] = useState<EstadoEventoIntegracion | "">("");
  const [cargandoOutbox, setCargandoOutbox] = useState(false);
  const [reintentandoId, setReintentandoId] = useState<string | null>(null);
  const [eventoDetalle, setEventoDetalle] = useState<EventoIntegracion | null>(null);

  const cargarSedes = useCallback(async () => {
    if (!token) return;
    setCargandoSedes(true);
    try {
      const lista = await farmaApi.listarSedesAdmin({ token });
      setSedes(lista);
    } catch {
      // Manejado globalmente
    } finally {
      setCargandoSedes(false);
    }
  }, [token]);

  const cargarEmpleados = useCallback(async () => {
    if (!token) return;
    setCargandoEmpleados(true);
    try {
      const lista = await farmaApi.listarEmpleadosAdmin({ token });
      setEmpleados(lista);
    } catch {
      // Manejado globalmente
    } finally {
      setCargandoEmpleados(false);
    }
  }, [token]);

  const cargarMedicamentos = useCallback(async () => {
    if (!token) return;
    setCargandoMeds(true);
    try {
      const activo =
        medFiltroActivo === "todos" ? undefined : medFiltroActivo === "activos";
      const pagina = await farmaApi.listarMedicamentosAdmin(
        { q: medBusqueda.trim() || undefined, activo, page: medPage, size: 20 },
        { token }
      );
      setMedicamentos(pagina.content ?? []);
      setMedTotal(pagina.totalElements ?? 0);
    } catch {
      // Manejado globalmente
    } finally {
      setCargandoMeds(false);
    }
  }, [token, medBusqueda, medFiltroActivo, medPage]);

  const cargarParametros = useCallback(async () => {
    if (!token) return;
    setCargandoParams(true);
    try {
      const lista = await farmaApi.listarParametrosAdmin({ token });
      setParametros(lista);
      const mapa: Record<string, string> = {};
      for (const p of lista) {
        if (p.clave) mapa[p.clave] = p.valor ?? "";
      }
      setValoresParametros(mapa);
    } catch {
      // Manejado globalmente
    } finally {
      setCargandoParams(false);
    }
  }, [token]);

  const cargarOutbox = useCallback(async () => {
    if (!token) return;
    setCargandoOutbox(true);
    try {
      const pagina = await farmaApi.listarEventosIntegracionAdmin(
        {
          estado: filtroEstadoOutbox || undefined,
          page: eventosPage,
          size: 20,
        },
        { token }
      );
      setEventos(pagina.content ?? []);
      setEventosTotal(pagina.totalElements ?? 0);
    } catch {
      // Manejado globalmente
    } finally {
      setCargandoOutbox(false);
    }
  }, [token, filtroEstadoOutbox, eventosPage]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void cargarSedes();
    }, 0);
    return () => window.clearTimeout(id);
  }, [cargarSedes]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (tab === "empleados") void cargarEmpleados();
      else if (tab === "catalogo") void cargarMedicamentos();
      else if (tab === "parametros") void cargarParametros();
      else if (tab === "outbox") void cargarOutbox();
    }, 0);
    return () => window.clearTimeout(id);
  }, [tab, cargarEmpleados, cargarMedicamentos, cargarParametros, cargarOutbox]);

  // --- Handlers Sedes ---
  const abrirCrearSede = () => {
    setSedeEditando(null);
    setFormSede(FORM_SEDE_INICIAL);
    setModalSedeAbierto(true);
  };

  const abrirEditarSede = (sede: SedeAdmin) => {
    setSedeEditando(sede);
    setFormSede({
      codigo: sede.codigo ?? "",
      nombre: sede.nombre ?? "",
      direccion: sede.direccion ?? "",
      latitud: sede.latitud !== undefined ? String(sede.latitud) : "",
      longitud: sede.longitud !== undefined ? String(sede.longitud) : "",
      horaApertura: formatearHora(sede.horaApertura),
      horaCierre: formatearHora(sede.horaCierre),
      activa: sede.activa ?? true,
    });
    setModalSedeAbierto(true);
  };

  const guardarSede = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setGuardandoSede(true);
    try {
      const payload = {
        codigo: formSede.codigo.trim(),
        nombre: formSede.nombre.trim(),
        direccion: formSede.direccion.trim(),
        latitud: Number(formSede.latitud),
        longitud: Number(formSede.longitud),
        horaApertura: formSede.horaApertura,
        horaCierre: formSede.horaCierre,
        activa: formSede.activa,
      };
      if (sedeEditando?.id) {
        await farmaApi.actualizarSedeAdmin(sedeEditando.id, payload, { token });
        mostrarExito("Sede actualizada", `Se guardaron los cambios en ${payload.nombre}.`);
      } else {
        await farmaApi.crearSedeAdmin(payload, { token });
        mostrarExito("Sede creada", `Se registró la sede ${payload.nombre}.`);
      }
      setModalSedeAbierto(false);
      await Promise.all([cargarSedes(), refrescarSedes()]);
    } catch {
      // Error manejado por gestor global
    } finally {
      setGuardandoSede(false);
    }
  };

  const alternarActivaSede = async (sede: SedeAdmin) => {
    if (!token || !sede.id) return;
    try {
      await farmaApi.actualizarSedeAdmin(
        sede.id,
        {
          codigo: sede.codigo ?? "",
          nombre: sede.nombre ?? "",
          direccion: sede.direccion ?? "",
          latitud: sede.latitud ?? 0,
          longitud: sede.longitud ?? 0,
          horaApertura: formatearHora(sede.horaApertura),
          horaCierre: formatearHora(sede.horaCierre),
          activa: !sede.activa,
        },
        { token }
      );
      mostrarExito(
        sede.activa ? "Sede desactivada" : "Sede activada",
        `${sede.nombre} ahora está ${sede.activa ? "inactiva" : "activa"}.`
      );
      await Promise.all([cargarSedes(), refrescarSedes()]);
    } catch {
      // Manejado globalmente
    }
  };

  // --- Handlers Empleados ---
  const abrirCrearEmpleado = () => {
    setEmpleadoEditando(null);
    setFormEmpleado({
      ...FORM_EMPLEADO_INICIAL,
      sedeId: sedes.find((s) => s.activa)?.id ?? sedes[0]?.id ?? "",
    });
    setModalEmpleadoAbierto(true);
  };

  const abrirEditarEmpleado = (emp: EmpleadoAdmin) => {
    setEmpleadoEditando(emp);
    setFormEmpleado({
      email: emp.email ?? "",
      password: "",
      rol: emp.rol ?? "EMPLEADO",
      cargo: emp.cargo ?? "AUXILIAR",
      sedeId: emp.sedeId ?? "",
      nombres: emp.nombres ?? "",
      apellidos: emp.apellidos ?? "",
      activo: emp.activo ?? true,
    });
    setModalEmpleadoAbierto(true);
  };

  const guardarEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setGuardandoEmpleado(true);
    try {
      if (empleadoEditando?.id) {
        await farmaApi.actualizarEmpleadoAdmin(
          empleadoEditando.id,
          {
            email: formEmpleado.email.trim(),
            password: formEmpleado.password.trim() || undefined,
            rol: formEmpleado.rol,
            cargo: formEmpleado.cargo,
            sedeId: formEmpleado.rol === "ADMIN" ? undefined : formEmpleado.sedeId || undefined,
            nombres: formEmpleado.nombres.trim(),
            apellidos: formEmpleado.apellidos.trim(),
            activo: formEmpleado.activo,
          },
          { token }
        );
        mostrarExito("Empleado actualizado", `${formEmpleado.nombres} ${formEmpleado.apellidos}`);
      } else {
        await farmaApi.crearEmpleadoAdmin(
          {
            email: formEmpleado.email.trim(),
            password: formEmpleado.password,
            rol: formEmpleado.rol,
            cargo: formEmpleado.cargo,
            sedeId: formEmpleado.rol === "ADMIN" ? undefined : formEmpleado.sedeId || undefined,
            nombres: formEmpleado.nombres.trim(),
            apellidos: formEmpleado.apellidos.trim(),
            activo: formEmpleado.activo,
          },
          { token }
        );
        mostrarExito("Empleado creado", `Se creó la cuenta ${formEmpleado.email.trim()}.`);
      }
      setModalEmpleadoAbierto(false);
      await cargarEmpleados();
    } catch {
      // Manejado globalmente
    } finally {
      setGuardandoEmpleado(false);
    }
  };

  const alternarActivoEmpleado = async (emp: EmpleadoAdmin) => {
    if (!token || !emp.id) return;
    try {
      await farmaApi.actualizarEmpleadoAdmin(
        emp.id,
        {
          email: emp.email ?? "",
          rol: emp.rol ?? "EMPLEADO",
          cargo: emp.cargo ?? "AUXILIAR",
          sedeId: emp.rol === "ADMIN" ? undefined : emp.sedeId ?? undefined,
          nombres: emp.nombres ?? "",
          apellidos: emp.apellidos ?? "",
          activo: !emp.activo,
        },
        { token }
      );
      mostrarExito(
        emp.activo ? "Empleado desactivado" : "Empleado activado",
        `${emp.nombres} ${emp.apellidos}`
      );
      await cargarEmpleados();
    } catch {
      // Manejado globalmente
    }
  };

  // --- Handlers Catálogo ---
  const abrirCrearMed = () => {
    setMedEditando(null);
    setFormMed(FORM_MED_INICIAL);
    setModalMedAbierto(true);
  };

  const abrirEditarMed = (med: MedicamentoAdmin) => {
    setMedEditando(med);
    setFormMed({
      codigo: med.codigo ?? "",
      nombre: med.nombre ?? "",
      principioActivo: med.principioActivo ?? "",
      presentacion: med.presentacion ?? "",
      activo: med.activo ?? true,
    });
    setModalMedAbierto(true);
  };

  const guardarMedicamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setGuardandoMed(true);
    try {
      const payload = {
        codigo: formMed.codigo.trim(),
        nombre: formMed.nombre.trim(),
        principioActivo: formMed.principioActivo.trim(),
        presentacion: formMed.presentacion.trim(),
        activo: formMed.activo,
      };
      if (medEditando?.id) {
        await farmaApi.actualizarMedicamentoAdmin(medEditando.id, payload, { token });
        mostrarExito("Medicamento actualizado", `${payload.codigo} · ${payload.nombre}`);
      } else {
        await farmaApi.crearMedicamentoAdmin(payload, { token });
        mostrarExito(
          "Medicamento creado",
          "Se inicializó el inventario en cero para cada sede activa."
        );
      }
      setModalMedAbierto(false);
      await cargarMedicamentos();
    } catch {
      // Manejado globalmente
    } finally {
      setGuardandoMed(false);
    }
  };

  const alternarActivoMed = async (med: MedicamentoAdmin) => {
    if (!token || !med.id) return;
    try {
      await farmaApi.actualizarMedicamentoAdmin(
        med.id,
        {
          codigo: med.codigo ?? "",
          nombre: med.nombre ?? "",
          principioActivo: med.principioActivo ?? "",
          presentacion: med.presentacion ?? "",
          activo: !med.activo,
        },
        { token }
      );
      mostrarExito(
        med.activo ? "Medicamento desactivado" : "Medicamento activado",
        `${med.codigo} · ${med.nombre}`
      );
      await cargarMedicamentos();
    } catch {
      // Manejado globalmente
    }
  };

  // --- Handlers Parámetros ---
  const hayCambiosParametros = parametros.some(
    (p) => p.clave && valoresParametros[p.clave] !== (p.valor ?? "")
  );

  const guardarParametros = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const cambios = parametros
      .filter((p) => p.clave && valoresParametros[p.clave] !== (p.valor ?? ""))
      .map((p) => ({
        clave: p.clave!,
        valor: valoresParametros[p.clave!] ?? "",
      }));
    if (cambios.length === 0) return;

    setGuardandoParams(true);
    try {
      const actualizados = await farmaApi.actualizarParametrosAdmin(
        { parametros: cambios },
        { token }
      );
      setParametros(actualizados);
      const mapa: Record<string, string> = {};
      for (const p of actualizados) {
        if (p.clave) mapa[p.clave] = p.valor ?? "";
      }
      setValoresParametros(mapa);
      mostrarExito("Parámetros guardados", `Se actualizaron ${cambios.length} parámetro(s).`);
    } catch {
      // Manejado globalmente
    } finally {
      setGuardandoParams(false);
    }
  };

  // --- Handlers Outbox ---
  const reintentarEvento = async (evento: EventoIntegracion) => {
    if (!token || !evento.id) return;
    setReintentandoId(evento.id);
    try {
      const actualizado = await farmaApi.reintentarEventoIntegracionAdmin(evento.id, { token });
      mostrarExito(
        actualizado.estado === "ENVIADO"
          ? "Evento enviado al simulador"
          : "Reintento ejecutado",
        `Estado actual: ${actualizado.estado ?? "—"} (intentos: ${actualizado.intentos ?? 0}).`
      );
      await cargarOutbox();
    } catch {
      // Manejado globalmente
    } finally {
      setReintentandoId(null);
    }
  };

  const totalPaginasMed = Math.max(1, Math.ceil(medTotal / 20));
  const totalPaginasOutbox = Math.max(1, Math.ceil(eventosTotal / 20));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Administración</h1>
        <p className="mt-1 text-sm text-slate-600">
          Gestión exclusiva para administradores: sedes, empleados, catálogo de medicamentos,
          parámetros operativos y outbox de integración.
        </p>
      </div>

      {/* Pestañas */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex flex-wrap gap-2" aria-label="Secciones administrativas">
          {TABS.map((item) => {
            const activo = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
                  activo
                    ? "border-emerald-700 text-emerald-800"
                    : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 1. SEDES (RF-EMP-30) */}
      {tab === "sedes" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {sedes.length} sede(s) registrada(s), incluyendo horario y coordenadas geográficas.
            </p>
            <button
              type="button"
              onClick={abrirCrearSede}
              className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              + Nueva sede
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {cargandoSedes ? (
              <p className="p-6 text-center text-sm text-slate-500">Cargando sedes…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Nombre y dirección</th>
                      <th className="px-4 py-3">Horario</th>
                      <th className="px-4 py-3">Coordenadas</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sedes.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                          {s.codigo}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-900">{s.nombre}</p>
                          <p className="text-xs text-slate-500">{s.direccion}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">
                          {formatearHora(s.horaApertura)} – {formatearHora(s.horaCierre)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {s.latitud?.toFixed(5)}, {s.longitud?.toFixed(5)}
                        </td>
                        <td className="px-4 py-3">
                          <EstadoBadge activo={Boolean(s.activa)} etiquetaActiva="Activa" etiquetaInactiva="Inactiva" />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEditarSede(s)}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void alternarActivaSede(s)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                                s.activa
                                  ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              {s.activa ? "Desactivar" : "Activar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2. EMPLEADOS (RF-EMP-31) */}
      {tab === "empleados" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {empleados.length} cuenta(s) de personal y administración.
            </p>
            <button
              type="button"
              onClick={abrirCrearEmpleado}
              className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              + Nuevo empleado
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {cargandoEmpleados ? (
              <p className="p-6 text-center text-sm text-slate-500">Cargando empleados…</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Nombre y correo</th>
                      <th className="px-4 py-3">Rol / Cargo</th>
                      <th className="px-4 py-3">Sede</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {empleados.map((emp) => {
                      const esMismoAdmin = emp.id === adminActualId;
                      return (
                        <tr key={emp.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">
                              {emp.nombres} {emp.apellidos}
                              {esMismoAdmin && (
                                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                  Tú
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500">{emp.email}</p>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className="font-semibold text-slate-800">
                              {emp.rol === "ADMIN" ? "Administrador" : "Empleado"}
                            </span>
                            {emp.cargo && (
                              <span className="ml-1.5 text-slate-500">
                                · {ETIQUETA_CARGO[emp.cargo]}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700">
                            {emp.rol === "ADMIN"
                              ? "Todas las sedes"
                              : emp.sedeNombre
                                ? `${emp.sedeNombre} (${emp.sedeCodigo})`
                                : "Sin sede"}
                          </td>
                          <td className="px-4 py-3">
                            <EstadoBadge activo={Boolean(emp.activo)} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => abrirEditarEmpleado(emp)}
                                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={esMismoAdmin && Boolean(emp.activo)}
                                onClick={() => void alternarActivoEmpleado(emp)}
                                className={`rounded-lg border px-2.5 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                                  emp.activo
                                    ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                                    : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                }`}
                              >
                                {emp.activo ? "Desactivar" : "Activar"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 3. CATÁLOGO DE MEDICAMENTOS (RF-EMP-32) */}
      {tab === "catalogo" && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={medBusqueda}
                onChange={(e) => {
                  setMedBusqueda(e.target.value);
                  setMedPage(0);
                }}
                placeholder="Buscar por código, nombre o principio activo…"
                className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
              />
              <select
                aria-label="Filtrar medicamentos por estado"
                value={medFiltroActivo}
                onChange={(e) => {
                  setMedFiltroActivo(e.target.value as "todos" | "activos" | "inactivos");
                  setMedPage(0);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
              >
                <option value="todos">Todos</option>
                <option value="activos">Solo activos</option>
                <option value="inactivos">Solo inactivos</option>
              </select>
            </div>

            <button
              type="button"
              onClick={abrirCrearMed}
              className="rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              + Nuevo medicamento
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {cargandoMeds ? (
              <p className="p-6 text-center text-sm text-slate-500">Cargando catálogo…</p>
            ) : medicamentos.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                No se encontraron medicamentos con esos filtros.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Código</th>
                      <th className="px-4 py-3">Nombre</th>
                      <th className="px-4 py-3">Principio activo</th>
                      <th className="px-4 py-3">Presentación</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medicamentos.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                          {m.codigo}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">{m.nombre}</td>
                        <td className="px-4 py-3 text-slate-600">{m.principioActivo}</td>
                        <td className="px-4 py-3 text-slate-600">{m.presentacion}</td>
                        <td className="px-4 py-3">
                          <EstadoBadge activo={Boolean(m.activo)} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEditarMed(m)}
                              className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => void alternarActivoMed(m)}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                                m.activo
                                  ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                                  : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              }`}
                            >
                              {m.activo ? "Desactivar" : "Activar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Mostrando página {medPage + 1} de {totalPaginasMed} ({medTotal} medicamentos)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={medPage === 0}
                onClick={() => setMedPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={medPage + 1 >= totalPaginasMed}
                onClick={() => setMedPage((p) => p + 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 4. PARÁMETROS (RF-EMP-33) */}
      {tab === "parametros" && (
        <section className="space-y-4">
          <form onSubmit={guardarParametros} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                Parámetros operativos definidos en la arquitectura del sistema (00 §6.3).
              </p>
              <button
                type="submit"
                disabled={!hayCambiosParametros || guardandoParams}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
              >
                {guardandoParams ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {cargandoParams ? (
                <p className="p-6 text-center text-sm text-slate-500">Cargando parámetros…</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                      <tr>
                        <th className="px-4 py-3">Clave</th>
                        <th className="px-4 py-3">Descripción</th>
                        <th className="px-4 py-3 w-44">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parametros.map((p) => {
                        const clave = p.clave ?? "";
                        const valorActual = valoresParametros[clave] ?? "";
                        const modificado = valorActual !== (p.valor ?? "");
                        return (
                          <tr key={clave} className={modificado ? "bg-amber-50/50" : ""}>
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-800">
                              {clave}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{p.descripcion}</td>
                            <td className="px-4 py-3">
                              <input
                                aria-label={`Valor de ${clave}`}
                                type="text"
                                value={valorActual}
                                onChange={(e) =>
                                  setValoresParametros((prev) => ({
                                    ...prev,
                                    [clave]: e.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-sm text-slate-900"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </form>
        </section>
      )}

      {/* 5. OUTBOX DE INTEGRACIÓN (RF-EMP-34, RF-EMP-27) */}
      {tab === "outbox" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filtrar eventos por estado"
                value={filtroEstadoOutbox}
                onChange={(e) => {
                  setFiltroEstadoOutbox(e.target.value as EstadoEventoIntegracion | "");
                  setEventosPage(0);
                }}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800"
              >
                <option value="">Todos los estados</option>
                <option value="ERROR">Solo con ERROR</option>
                <option value="PENDIENTE">Solo PENDIENTE</option>
                <option value="ENVIADO">Solo ENVIADO</option>
              </select>
              <button
                type="button"
                onClick={() => void cargarOutbox()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Actualizar
              </button>
            </div>
            <p className="text-xs text-slate-500">{eventosTotal} evento(s) en total</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {cargandoOutbox ? (
              <p className="p-6 text-center text-sm text-slate-500">Cargando outbox…</p>
            ) : eventos.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-500">
                No hay eventos de integración para el filtro seleccionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Fecha</th>
                      <th className="px-4 py-3">Tipo / Clave idempotencia</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Intentos</th>
                      <th className="px-4 py-3">Último error / Envío</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eventos.map((ev) => {
                      const puedeReintentar = ev.estado === "ERROR" || ev.estado === "PENDIENTE";
                      return (
                        <tr key={ev.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {formatearFechaHora(ev.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs font-semibold text-slate-800">
                              {ev.tipo}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500">
                              {ev.idempotencyKey}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            {ev.estado && (
                              <span
                                className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${CLASE_ESTADO_OUTBOX[ev.estado]}`}
                              >
                                {ETIQUETA_ESTADO_OUTBOX[ev.estado]}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs">
                            {ev.intentos ?? 0}
                          </td>
                          <td className="max-w-xs px-4 py-3 text-xs">
                            {ev.ultimoError ? (
                              <p className="truncate text-rose-700" title={ev.ultimoError}>
                                {ev.ultimoError}
                              </p>
                            ) : ev.enviadoEn ? (
                              <p className="text-emerald-700">
                                Enviado: {formatearFechaHora(ev.enviadoEn)}
                              </p>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEventoDetalle(ev)}
                                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Payload
                              </button>
                              {puedeReintentar && (
                                <button
                                  type="button"
                                  disabled={reintentandoId === ev.id}
                                  onClick={() => void reintentarEvento(ev)}
                                  className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                                >
                                  {reintentandoId === ev.id ? "Reintentando…" : "Reintentar"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Página {eventosPage + 1} de {totalPaginasOutbox}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={eventosPage === 0}
                onClick={() => setEventosPage((p) => Math.max(0, p - 1))}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={eventosPage + 1 >= totalPaginasOutbox}
                onClick={() => setEventosPage((p) => p + 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </div>
        </section>
      )}

      {/* MODAL SEDE */}
      <Modal
        abierto={modalSedeAbierto}
        titulo={sedeEditando ? "Editar sede" : "Nueva sede"}
        descripcion="Define el horario de atención y las coordenadas geográficas de la sede."
        onCerrar={() => setModalSedeAbierto(false)}
      >
        <form onSubmit={guardarSede} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Código</label>
              <input
                required
                type="text"
                value={formSede.codigo}
                onChange={(e) => setFormSede((f) => ({ ...f, codigo: e.target.value }))}
                placeholder="SEDE-ENVIGADO"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Nombre</label>
              <input
                required
                type="text"
                value={formSede.nombre}
                onChange={(e) => setFormSede((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="FarmaGestión Envigado"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Dirección</label>
            <input
              required
              type="text"
              value={formSede.direccion}
              onChange={(e) => setFormSede((f) => ({ ...f, direccion: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Latitud</label>
              <input
                required
                type="number"
                step="0.000001"
                value={formSede.latitud}
                onChange={(e) => setFormSede((f) => ({ ...f, latitud: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Longitud</label>
              <input
                required
                type="number"
                step="0.000001"
                value={formSede.longitud}
                onChange={(e) => setFormSede((f) => ({ ...f, longitud: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Hora apertura</label>
              <input
                required
                type="time"
                value={formSede.horaApertura}
                onChange={(e) => setFormSede((f) => ({ ...f, horaApertura: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Hora cierre</label>
              <input
                required
                type="time"
                value={formSede.horaCierre}
                onChange={(e) => setFormSede((f) => ({ ...f, horaCierre: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formSede.activa}
              onChange={(e) => setFormSede((f) => ({ ...f, activa: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Sede activa
          </label>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setModalSedeAbierto(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardandoSede}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {guardandoSede ? "Guardando…" : "Guardar sede"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL EMPLEADO */}
      <Modal
        abierto={modalEmpleadoAbierto}
        titulo={empleadoEditando ? "Editar empleado" : "Nuevo empleado"}
        descripcion="Asigna rol, cargo y sede operativa."
        onCerrar={() => setModalEmpleadoAbierto(false)}
      >
        <form onSubmit={guardarEmpleado} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700">Nombres</label>
              <input
                required
                type="text"
                value={formEmpleado.nombres}
                onChange={(e) => setFormEmpleado((f) => ({ ...f, nombres: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Apellidos</label>
              <input
                required
                type="text"
                value={formEmpleado.apellidos}
                onChange={(e) => setFormEmpleado((f) => ({ ...f, apellidos: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">Correo electrónico</label>
            <input
              required
              type="email"
              value={formEmpleado.email}
              onChange={(e) => setFormEmpleado((f) => ({ ...f, email: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700">
              {empleadoEditando ? "Nueva contraseña (opcional)" : "Contraseña inicial (mín. 8 caracteres)"}
            </label>
            <input
              required={!empleadoEditando}
              minLength={8}
              type="password"
              value={formEmpleado.password}
              onChange={(e) => setFormEmpleado((f) => ({ ...f, password: e.target.value }))}
              placeholder={empleadoEditando ? "Dejar vacío para mantener la actual" : ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700">Rol</label>
              <select
                value={formEmpleado.rol}
                onChange={(e) => setFormEmpleado((f) => ({ ...f, rol: e.target.value as RolUsuario }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="EMPLEADO">EMPLEADO</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">Cargo</label>
              <select
                value={formEmpleado.cargo}
                onChange={(e) =>
                  setFormEmpleado((f) => ({ ...f, cargo: e.target.value as CargoEmpleado }))
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="FARMACEUTICO">Farmacéutico</option>
                <option value="AUXILIAR">Auxiliar</option>
                <option value="DOMICILIARIO">Domiciliario</option>
              </select>
            </div>
          </div>

          {formEmpleado.rol === "EMPLEADO" && (
            <div>
              <label className="block text-xs font-medium text-slate-700">Sede asignada</label>
              <select
                required
                value={formEmpleado.sedeId}
                onChange={(e) => setFormEmpleado((f) => ({ ...f, sedeId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Selecciona una sede…</option>
                {sedes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.codigo}){s.activa ? "" : " [Inactiva]"}
                  </option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formEmpleado.activo}
              disabled={empleadoEditando?.id === adminActualId}
              onChange={(e) => setFormEmpleado((f) => ({ ...f, activo: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Cuenta activa
          </label>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setModalEmpleadoAbierto(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardandoEmpleado}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {guardandoEmpleado ? "Guardando…" : "Guardar empleado"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL MEDICAMENTO */}
      <Modal
        abierto={modalMedAbierto}
        titulo={medEditando ? "Editar medicamento" : "Nuevo medicamento"}
        descripcion={
          medEditando
            ? "Actualiza los datos del catálogo."
            : "Al crear un medicamento se generan automáticamente los registros de inventario en cero para cada sede activa."
        }
        onCerrar={() => setModalMedAbierto(false)}
      >
        <form onSubmit={guardarMedicamento} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-700">Código</label>
            <input
              required
              type="text"
              value={formMed.codigo}
              onChange={(e) => setFormMed((f) => ({ ...f, codigo: e.target.value }))}
              placeholder="MED-0031"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Nombre comercial / genérico</label>
            <input
              required
              type="text"
              value={formMed.nombre}
              onChange={(e) => setFormMed((f) => ({ ...f, nombre: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Principio activo</label>
            <input
              required
              type="text"
              value={formMed.principioActivo}
              onChange={(e) => setFormMed((f) => ({ ...f, principioActivo: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">Presentación</label>
            <input
              required
              type="text"
              value={formMed.presentacion}
              onChange={(e) => setFormMed((f) => ({ ...f, presentacion: e.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={formMed.activo}
              onChange={(e) => setFormMed((f) => ({ ...f, activo: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300"
            />
            Medicamento activo en catálogo
          </label>

          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={() => setModalMedAbierto(false)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardandoMed}
              className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {guardandoMed ? "Guardando…" : "Guardar medicamento"}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL DETALLE PAYLOAD OUTBOX */}
      <Modal
        abierto={Boolean(eventoDetalle)}
        titulo="Detalle del evento de integración"
        descripcion={eventoDetalle ? `${eventoDetalle.tipo} · ${eventoDetalle.idempotencyKey}` : ""}
        onCerrar={() => setEventoDetalle(null)}
      >
        {eventoDetalle && (
          <div className="space-y-3 text-xs">
            {eventoDetalle.ultimoError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800">
                <p className="font-semibold">Último error registrado:</p>
                <p className="mt-1 break-words">{eventoDetalle.ultimoError}</p>
              </div>
            )}
            <div>
              <p className="mb-1 font-semibold text-slate-700">Payload JSON:</p>
              <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-[11px] text-slate-100">
                {formatearJsonSeguro(eventoDetalle.payload)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function EstadoBadge({
  activo,
  etiquetaActiva = "Activo",
  etiquetaInactiva = "Inactivo",
}: {
  activo: boolean;
  etiquetaActiva?: string;
  etiquetaInactiva?: string;
}) {
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${
        activo
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-300 bg-slate-100 text-slate-600"
      }`}
    >
      {activo ? etiquetaActiva : etiquetaInactiva}
    </span>
  );
}

function formatearJsonSeguro(raw?: string | null): string {
  if (!raw) return "{}";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export default function AdminPage() {
  return (
    <RoleGuard
      permitido={puedeAdministrar}
      mensajeDenegado="La sección de administración es exclusiva para cuentas con rol ADMIN."
    >
      <ContenidoAdmin />
    </RoleGuard>
  );
}
