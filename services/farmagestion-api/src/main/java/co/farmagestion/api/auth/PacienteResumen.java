package co.farmagestion.api.auth;

import java.util.UUID;

public record PacienteResumen(
		UUID usuarioId,
		String tipoDocumento,
		String documento,
		String nombres,
		String apellidos,
		String telefono) {

	static PacienteResumen from(Paciente p) {
		return new PacienteResumen(
				p.getUsuarioId(),
				p.getTipoDocumento(),
				p.getDocumento(),
				p.getNombres(),
				p.getApellidos(),
				p.getTelefono());
	}
}
