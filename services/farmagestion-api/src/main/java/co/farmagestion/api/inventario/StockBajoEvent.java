package co.farmagestion.api.inventario;

import java.time.Instant;
import java.util.UUID;

public record StockBajoEvent(
		UUID sedeId,
		UUID medicamentoId,
		int disponibleActual,
		int stockMinimo,
		Instant ocurridoEn) {
}
