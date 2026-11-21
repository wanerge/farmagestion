package co.farmagestion.api.domicilios;

import java.util.Optional;
import java.util.UUID;

public interface RutaPorPedidoConsulta {

	Optional<RutaResumenPedidoResponse> obtenerResumenPorPedido(UUID pedidoId);
}
