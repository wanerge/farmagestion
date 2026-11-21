package co.farmagestion.api.domicilios;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record DomiciliosPendientesResponse(
		UUID sedeId,
		String sedeCodigo,
		String sedeNombre,
		String sedeDireccion,
		BigDecimal sedeLatitud,
		BigDecimal sedeLongitud,
		int maxParadas,
		int maxIntentos,
		List<DomiciliarioResumenResponse> domiciliarios,
		List<PedidoPendienteDomicilioResponse> pedidos) {
}
