package co.farmagestion.api.pedidos;

import java.util.UUID;

public record PedidoFaltanteDetectadoEvent(
		UUID pedidoId,
		String codigoPedido,
		UUID pacienteId,
		UUID sedeId,
		UUID medicamentoId,
		int cantidadReducida,
		String motivo) {
}
