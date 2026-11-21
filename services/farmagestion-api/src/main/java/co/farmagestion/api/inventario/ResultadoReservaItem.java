package co.farmagestion.api.inventario;

import java.util.UUID;

public record ResultadoReservaItem(
		UUID medicamentoId,
		int solicitada,
		int disponible,
		int reservada,
		EstadoReservaItem estadoItem) {
}
