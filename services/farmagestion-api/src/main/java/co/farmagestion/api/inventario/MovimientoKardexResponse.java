package co.farmagestion.api.inventario;

import java.time.Instant;
import java.util.UUID;

public record MovimientoKardexResponse(
		UUID id,
		UUID sedeId,
		UUID medicamentoId,
		TipoMovimientoInventario tipo,
		int cantidad,
		int saldoFisico,
		String referenciaTipo,
		UUID referenciaId,
		UUID usuarioId,
		String motivo,
		Instant createdAt) {

	static MovimientoKardexResponse from(MovimientoInventario mov) {
		return new MovimientoKardexResponse(
				mov.getId(),
				mov.getSedeId(),
				mov.getMedicamentoId(),
				mov.getTipo(),
				mov.getCantidad(),
				mov.getSaldoFisico(),
				mov.getReferenciaTipo(),
				mov.getReferenciaId(),
				mov.getUsuarioId(),
				mov.getMotivo(),
				mov.getCreatedAt());
	}
}
