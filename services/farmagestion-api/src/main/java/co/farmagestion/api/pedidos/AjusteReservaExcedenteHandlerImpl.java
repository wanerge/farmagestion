package co.farmagestion.api.pedidos;

import co.farmagestion.api.inventario.AjusteReservaExcedenteHandler;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Implementación de RN-EMP-07 (RF-EMP-13):
 * cuando un ajuste negativo deja físico menor que reservado, libera la diferencia
 * del pedido más reciente primero, lo marca es_parcial y notifica al paciente.
 */
@Component
class AjusteReservaExcedenteHandlerImpl implements AjusteReservaExcedenteHandler {

	private final PedidoRepository pedidoRepository;
	private final PedidoItemRepository pedidoItemRepository;
	private final PedidoHistorialRepository pedidoHistorialRepository;
	private final ApplicationEventPublisher eventPublisher;
	private final Clock clock;

	AjusteReservaExcedenteHandlerImpl(
			PedidoRepository pedidoRepository,
			PedidoItemRepository pedidoItemRepository,
			PedidoHistorialRepository pedidoHistorialRepository,
			ApplicationEventPublisher eventPublisher,
			Clock clock) {
		this.pedidoRepository = pedidoRepository;
		this.pedidoItemRepository = pedidoItemRepository;
		this.pedidoHistorialRepository = pedidoHistorialRepository;
		this.eventPublisher = eventPublisher;
		this.clock = clock;
	}

	@Override
	@Transactional
	public int liberarReservaExcedente(
			UUID sedeId,
			UUID medicamentoId,
			int cantidadExcedente,
			UUID usuarioId,
			String motivo) {
		if (cantidadExcedente <= 0) {
			return 0;
		}
		List<PedidoItem> candidatos = pedidoItemRepository.findReduciblesMasRecientesPrimeroForUpdate(
				sedeId, medicamentoId, PedidoService.ESTADOS_EXPIRABLES);

		int restante = cantidadExcedente;
		int totalLiberado = 0;
		Instant ahora = Instant.now(clock);

		for (PedidoItem item : candidatos) {
			if (restante <= 0) {
				break;
			}
			int reducir = Math.min(restante, item.getCantidadReservada());
			if (reducir <= 0) {
				continue;
			}

			int nuevaReserva = item.getCantidadReservada() - reducir;
			item.setCantidadReservada(nuevaReserva);
			if (nuevaReserva == 0) {
				item.setEstadoItem(EstadoPedidoItem.AGOTADO);
			} else if (nuevaReserva < item.getCantidadSolicitada()) {
				item.setEstadoItem(EstadoPedidoItem.PARCIAL);
			}
			pedidoItemRepository.save(item);

			Pedido pedido = pedidoRepository.findByIdForUpdate(item.getPedidoId()).orElse(null);
			if (pedido != null) {
				pedido.setEsParcial(true);
				pedido.setUpdatedAt(ahora);
				pedidoRepository.save(pedido);

				PedidoHistorial historial = new PedidoHistorial();
				historial.setPedidoId(pedido.getId());
				historial.setEstadoAnterior(pedido.getEstado().name());
				historial.setEstadoNuevo(pedido.getEstado().name());
				historial.setUsuarioId(usuarioId);
				historial.setNota("Reducción de reserva por ajuste negativo (" + reducir + " u.): " + motivo);
				pedidoHistorialRepository.save(historial);

				eventPublisher.publishEvent(new PedidoFaltanteDetectadoEvent(
						pedido.getId(),
						pedido.getCodigo(),
						pedido.getPacienteId(),
						pedido.getSedeId(),
						medicamentoId,
						reducir,
						motivo));
			}

			restante -= reducir;
			totalLiberado += reducir;
		}

		return totalLiberado;
	}
}
