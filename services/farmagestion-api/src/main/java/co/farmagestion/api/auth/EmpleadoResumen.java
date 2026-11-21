package co.farmagestion.api.auth;

import java.util.UUID;

public record EmpleadoResumen(
		UUID usuarioId,
		UUID sedeId,
		CargoEmpleado cargo,
		String nombres,
		String apellidos) {

	static EmpleadoResumen from(Empleado e) {
		return new EmpleadoResumen(
				e.getUsuarioId(),
				e.getSedeId(),
				e.getCargo(),
				e.getNombres(),
				e.getApellidos());
	}
}
