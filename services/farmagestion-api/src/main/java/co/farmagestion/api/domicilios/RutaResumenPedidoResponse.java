package co.farmagestion.api.domicilios;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record RutaResumenPedidoResponse(
		UUID rutaId,
		LocalDate fecha,
		EstadoRuta estadoRuta,
		int orden,
		EstadoRutaParada estadoParada,
		String domiciliarioNombre,
		BigDecimal distanciaKmTotal) {
}
