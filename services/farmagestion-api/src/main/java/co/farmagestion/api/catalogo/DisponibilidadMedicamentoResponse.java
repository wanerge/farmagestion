package co.farmagestion.api.catalogo;

import java.util.List;
import java.util.UUID;

public record DisponibilidadMedicamentoResponse(
		UUID medicamentoId,
		String codigo,
		String nombre,
		String principioActivo,
		String presentacion,
		List<DisponibilidadSedeResponse> sedes) {
}
