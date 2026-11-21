package co.farmagestion.api.domicilios;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record RutaDetalleResponse(
		UUID id,
		UUID sedeId,
		String sedeCodigo,
		String sedeNombre,
		String sedeDireccion,
		BigDecimal sedeLatitud,
		BigDecimal sedeLongitud,
		UUID domiciliarioId,
		String domiciliarioNombre,
		LocalDate fecha,
		EstadoRuta estado,
		BigDecimal distanciaKm,
		Instant createdAt,
		List<RutaParadaResponse> paradas) {
}
