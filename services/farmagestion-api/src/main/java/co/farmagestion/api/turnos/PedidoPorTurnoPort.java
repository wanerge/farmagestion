package co.farmagestion.api.turnos;

import java.util.Optional;
import java.util.UUID;

/**
 * Puerto de colaboración desde turnos hacia pedidos sin acoplamiento circular.
 */
public interface PedidoPorTurnoPort {

	Optional<UUID> obtenerPacienteIdPorPedido(UUID pedidoId);

	void vencerPedidoPorTurno(UUID pedidoId, UUID usuarioId, String motivo);

	void evaluarVencimientoPedidosDeSede(UUID sedeId);
}
