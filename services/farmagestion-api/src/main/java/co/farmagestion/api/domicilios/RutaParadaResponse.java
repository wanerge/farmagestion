package co.farmagestion.api.domicilios;

import java.math.BigDecimal;
import java.util.UUID;

public record RutaParadaResponse(
		UUID id,
		UUID pedidoId,
		String pedidoCodigo,
		int orden,
		EstadoRutaParada estado,
		BigDecimal distanciaKmDesdeAnterior,
		String estadoPedido,
		int intentosEntrega,
		String pacienteNombre,
		String pacienteDocumento,
		String pacienteTelefono,
		String direccionEntrega,
		BigDecimal latitudEntrega,
		BigDecimal longitudEntrega,
		boolean esParcial) {
}
