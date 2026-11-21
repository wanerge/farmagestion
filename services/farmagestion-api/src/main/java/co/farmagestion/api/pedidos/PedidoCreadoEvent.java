package co.farmagestion.api.pedidos;

import java.util.UUID;

public record PedidoCreadoEvent(
		UUID pedidoId,
		String codigoPedido,
		UUID pacienteId,
		UUID sedeId,
		ModalidadPedido modalidad,
		boolean esParcial,
		String codigoTurno) {
}
