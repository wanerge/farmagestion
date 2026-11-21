package co.farmagestion.api.catalogo;

import java.util.UUID;

public record MedicamentoPublicoResponse(
		UUID id,
		String codigo,
		String nombre,
		String principioActivo,
		String presentacion) {

	static MedicamentoPublicoResponse from(Medicamento m) {
		return new MedicamentoPublicoResponse(
				m.getId(),
				m.getCodigo(),
				m.getNombre(),
				m.getPrincipioActivo(),
				m.getPresentacion());
	}
}
