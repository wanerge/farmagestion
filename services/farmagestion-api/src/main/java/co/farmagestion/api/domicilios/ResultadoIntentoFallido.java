package co.farmagestion.api.domicilios;

public record ResultadoIntentoFallido(
		boolean cancelado,
		int intentosEntrega,
		String nuevoEstadoPedido) {
}
