import type { PedidoDetalle, PedidoResumen, UsuarioResumen } from "../api/client";

export function esPersonalAutorizado(usuario?: UsuarioResumen | null): boolean {
  return usuario?.rol === "ADMIN" || usuario?.rol === "EMPLEADO";
}

export function esAdmin(usuario?: UsuarioResumen | null): boolean {
  return usuario?.rol === "ADMIN";
}

export function esFarmaceutico(usuario?: UsuarioResumen | null): boolean {
  return usuario?.rol === "EMPLEADO" && usuario?.cargo === "FARMACEUTICO";
}

export function esAuxiliar(usuario?: UsuarioResumen | null): boolean {
  return usuario?.rol === "EMPLEADO" && usuario?.cargo === "AUXILIAR";
}

export function esDomiciliario(usuario?: UsuarioResumen | null): boolean {
  return usuario?.rol === "EMPLEADO" && usuario?.cargo === "DOMICILIARIO";
}

/** Matriz de permisos 03 §3 */
export function puedeVerInventario(usuario?: UsuarioResumen | null): boolean {
  return esAdmin(usuario) || esFarmaceutico(usuario) || esAuxiliar(usuario);
}

export function puedeEditarInventario(usuario?: UsuarioResumen | null): boolean {
  return esAdmin(usuario) || esFarmaceutico(usuario);
}

export function puedeGestionarPedidosYTurnos(usuario?: UsuarioResumen | null): boolean {
  return esAdmin(usuario) || esFarmaceutico(usuario) || esAuxiliar(usuario);
}

export function puedeArmarRutas(usuario?: UsuarioResumen | null): boolean {
  return esAdmin(usuario) || esFarmaceutico(usuario);
}

export function puedeEjecutarRutas(usuario?: UsuarioResumen | null): boolean {
  return esDomiciliario(usuario);
}

export function etiquetaRolUsuario(usuario?: UsuarioResumen | null): string {
  if (!usuario) return "";
  if (usuario.rol === "ADMIN") return "Administrador";
  if (usuario.cargo === "FARMACEUTICO") return "Farmacéutico";
  if (usuario.cargo === "AUXILIAR") return "Auxiliar";
  if (usuario.cargo === "DOMICILIARIO") return "Domiciliario";
  return usuario.rol ?? "Empleado";
}

export interface AccionesPedidoPermitidas {
  puedeTomar: boolean;
  puedeMarcarListo: boolean;
  puedeEntregar: boolean;
  puedeCancelar: boolean;
  puedeAjustarFaltante: boolean;
  bloqueadoPorOtroEmpleado: boolean;
}

/**
 * Determina qué acciones puede ejecutar el usuario autenticado sobre un pedido,
 * aplicando 03 §3, 00 §7.1, RN-EMP-01, RN-EMP-04 y RF-EMP-10 a RF-EMP-13.
 */
export function calcularAccionesPedido(
  usuario: UsuarioResumen | null | undefined,
  pedido: Pick<PedidoDetalle | PedidoResumen, "estado" | "modalidad" | "asignadoA">
): AccionesPedidoPermitidas {
  const sinAcciones: AccionesPedidoPermitidas = {
    puedeTomar: false,
    puedeMarcarListo: false,
    puedeEntregar: false,
    puedeCancelar: false,
    puedeAjustarFaltante: false,
    bloqueadoPorOtroEmpleado: false,
  };

  if (!usuario || !puedeGestionarPedidosYTurnos(usuario)) {
    return sinAcciones;
  }

  const estado = pedido.estado;
  if (estado === "RESERVADO") {
    return {
      ...sinAcciones,
      puedeTomar: true,
      puedeCancelar: true,
    };
  }

  if (estado === "EN_PREPARACION") {
    const esPropietarioOAdmin =
      esAdmin(usuario) || (Boolean(pedido.asignadoA) && pedido.asignadoA === usuario.id);
    return {
      ...sinAcciones,
      puedeMarcarListo: esPropietarioOAdmin,
      puedeCancelar: esPropietarioOAdmin,
      puedeAjustarFaltante: esPropietarioOAdmin && puedeEditarInventario(usuario),
      bloqueadoPorOtroEmpleado: !esPropietarioOAdmin,
    };
  }

  if (estado === "LISTO") {
    return {
      ...sinAcciones,
      puedeEntregar: pedido.modalidad === "RECOGER",
      puedeCancelar: true,
    };
  }

  return sinAcciones;
}
