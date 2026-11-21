package co.farmagestion.api.domicilios;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Puerto de colaboración entre el módulo domicilios y el módulo pedidos (00 §4.1).
 */
public interface PedidoDomicilioPort {

	void evaluarVencimientoPedidosDeSede(UUID sedeId);

	List<PedidoDomicilioSnapshot> listarPedidosDomicilioListosDeSede(UUID sedeId);

	Map<UUID, PedidoDomicilioSnapshot> obtenerPedidosPorIds(Collection<UUID> pedidoIds);

	void iniciarEntregaPedidosEnRuta(UUID sedeId, List<UUID> pedidoIds, UUID usuarioId, UUID rutaId);

	void entregarPedidoDomicilio(UUID pedidoId, UUID domiciliarioId, String nota);

	ResultadoIntentoFallido registrarEntregaFallida(
			UUID pedidoId,
			UUID domiciliarioId,
			String motivo,
			int maxIntentos);
}
