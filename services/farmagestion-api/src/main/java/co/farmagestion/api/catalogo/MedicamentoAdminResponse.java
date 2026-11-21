package co.farmagestion.api.catalogo;

import java.util.UUID;

public record MedicamentoAdminResponse(
		UUID id,
		String codigo,
		String nombre,
		String principioActivo,
		String presentacion,
		boolean activo) {

	public static MedicamentoAdminResponse from(Medicamento medicamento) {
		return new MedicamentoAdminResponse(
				medicamento.getId(),
				medicamento.getCodigo(),
				medicamento.getNombre(),
				medicamento.getPrincipioActivo(),
				medicamento.getPresentacion(),
				medicamento.isActivo());
	}
}
