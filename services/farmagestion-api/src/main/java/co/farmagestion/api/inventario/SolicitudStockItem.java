package co.farmagestion.api.inventario;

import java.util.UUID;

public record SolicitudStockItem(UUID medicamentoId, int cantidad) {

	public SolicitudStockItem {
		if (medicamentoId == null) {
			throw new IllegalArgumentException("El medicamentoId es obligatorio.");
		}
		if (cantidad <= 0) {
			throw new IllegalArgumentException("La cantidad debe ser mayor que cero.");
		}
	}
}
