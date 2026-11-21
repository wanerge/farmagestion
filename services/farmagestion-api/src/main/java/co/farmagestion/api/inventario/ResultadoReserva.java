package co.farmagestion.api.inventario;

import java.util.List;

public record ResultadoReserva(
		List<ResultadoReservaItem> items,
		boolean esParcial,
		boolean todoAgotado) {
}
