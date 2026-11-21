package co.farmagestion.api.inventario;

import java.util.UUID;

public record InventarioItemResponse(
		UUID id,
		UUID sedeId,
		String sedeCodigo,
		String sedeNombre,
		UUID medicamentoId,
		String medicamentoCodigo,
		String medicamentoNombre,
		String principioActivo,
		String presentacion,
		int cantidadFisica,
		int cantidadReservada,
		int disponible,
		int stockMinimo,
		NivelDisponibilidad nivel) {
}
