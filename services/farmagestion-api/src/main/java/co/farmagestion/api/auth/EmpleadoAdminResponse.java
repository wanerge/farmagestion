package co.farmagestion.api.auth;

import java.time.Instant;
import java.util.UUID;

public record EmpleadoAdminResponse(
		UUID id,
		String email,
		RolUsuario rol,
		CargoEmpleado cargo,
		UUID sedeId,
		String sedeCodigo,
		String sedeNombre,
		String nombres,
		String apellidos,
		boolean activo,
		Instant createdAt) {
}
