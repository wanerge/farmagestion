package co.farmagestion.api.pedidos;

import java.util.UUID;

public record PedidoEstadoCambiadoEvent(
		UUID pedidoId,
		String codigoPedido,
		UUID pacienteId,
		UUID sedeId,
		EstadoPedido estadoAnterior,
		EstadoPedido estadoNuevo,
		String nota) {
}
