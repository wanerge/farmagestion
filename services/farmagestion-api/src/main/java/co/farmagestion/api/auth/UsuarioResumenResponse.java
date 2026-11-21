package co.farmagestion.api.auth;

import java.util.UUID;

public record UsuarioResumenResponse(
		UUID id,
		String email,
		RolUsuario rol,
		CargoEmpleado cargo,
		UUID sedeId,
		String nombres,
		String apellidos) {
}
