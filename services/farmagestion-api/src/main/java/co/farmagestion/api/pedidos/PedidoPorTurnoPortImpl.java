package co.farmagestion.api.pedidos;

import co.farmagestion.api.turnos.PedidoPorTurnoPort;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

@Component
class PedidoPorTurnoPortImpl implements PedidoPorTurnoPort {

	private final PedidoRepository pedidoRepository;
	private final ObjectProvider<PedidoService> pedidoServiceProvider;

	PedidoPorTurnoPortImpl(
			PedidoRepository pedidoRepository,
			ObjectProvider<PedidoService> pedidoServiceProvider) {
		this.pedidoRepository = pedidoRepository;
		this.pedidoServiceProvider = pedidoServiceProvider;
	}

	@Override
	public Optional<UUID> obtenerPacienteIdPorPedido(UUID pedidoId) {
		return pedidoRepository.findById(pedidoId).map(Pedido::getPacienteId);
	}

	@Override
	public void vencerPedidoPorTurno(UUID pedidoId, UUID usuarioId, String motivo) {
		PedidoService service = pedidoServiceProvider.getIfAvailable();
		if (service != null) {
			service.vencerPedidoPorTurno(pedidoId, usuarioId, motivo);
		}
	}

	@Override
	public void evaluarVencimientoPedidosDeSede(UUID sedeId) {
		PedidoService service = pedidoServiceProvider.getIfAvailable();
		if (service != null) {
			service.expirarReservasVencidasDeSede(sedeId);
		}
	}
}
