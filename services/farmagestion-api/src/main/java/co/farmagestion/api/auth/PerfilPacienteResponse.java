package co.farmagestion.api.auth;

import java.util.UUID;

public record PerfilPacienteResponse(
		UUID id,
		String email,
		String tipoDocumento,
		String documento,
		String nombres,
		String apellidos,
		String telefono) {
}
