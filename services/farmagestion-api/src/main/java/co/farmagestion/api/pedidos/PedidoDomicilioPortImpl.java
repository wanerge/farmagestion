package co.farmagestion.api.pedidos;

import co.farmagestion.api.auth.AuthService;
import co.farmagestion.api.auth.PacienteResumen;
import co.farmagestion.api.domicilios.PedidoDomicilioPort;
import co.farmagestion.api.domicilios.PedidoDomicilioSnapshot;
import co.farmagestion.api.domicilios.ResultadoIntentoFallido;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class PedidoDomicilioPortImpl implements PedidoDomicilioPort {

	private final PedidoRepository pedidoRepository;
	private final AuthService authService;
	private final ObjectProvider<PedidoService> pedidoServiceProvider;

	PedidoDomicilioPortImpl(
			PedidoRepository pedidoRepository,
			AuthService authService,
			ObjectProvider<PedidoService> pedidoServiceProvider) {
		this.pedidoRepository = pedidoRepository;
		this.authService = authService;
		this.pedidoServiceProvider = pedidoServiceProvider;
	}

	@Override
	public void evaluarVencimientoPedidosDeSede(UUID sedeId) {
		PedidoService service = pedidoServiceProvider.getIfAvailable();
		if (service != null) {
			service.expirarReservasVencidasDeSede(sedeId);
		}
	}

	@Override
	@Transactional(readOnly = true)
	public List<PedidoDomicilioSnapshot> listarPedidosDomicilioListosDeSede(UUID sedeId) {
		List<Pedido> pedidos = pedidoRepository.findAllBySedeIdAndModalidadAndEstadoOrderByExpiraEnAsc(
				sedeId, ModalidadPedido.DOMICILIO, EstadoPedido.LISTO);
		return mapearSnapshots(pedidos);
	}

	@Override
	@Transactional(readOnly = true)
	public Map<UUID, PedidoDomicilioSnapshot> obtenerPedidosPorIds(Collection<UUID> pedidoIds) {
		if (pedidoIds == null || pedidoIds.isEmpty()) {
			return Collections.emptyMap();
		}
		List<Pedido> pedidos = pedidoRepository.findAllById(pedidoIds);
		Map<UUID, PedidoDomicilioSnapshot> mapa = new LinkedHashMap<>();
		for (PedidoDomicilioSnapshot s : mapearSnapshots(pedidos)) {
			mapa.put(s.id(), s);
		}
		return mapa;
	}

	@Override
	public void iniciarEntregaPedidosEnRuta(UUID sedeId, List<UUID> pedidoIds, UUID usuarioId, UUID rutaId) {
		pedidoServiceProvider.getObject().iniciarEntregaPedidosEnRuta(sedeId, pedidoIds, usuarioId, rutaId);
	}

	@Override
	public void entregarPedidoDomicilio(UUID pedidoId, UUID domiciliarioId, String nota) {
		pedidoServiceProvider.getObject().entregarPedidoDomicilio(pedidoId, domiciliarioId, nota);
	}

	@Override
	public ResultadoIntentoFallido registrarEntregaFallida(
			UUID pedidoId,
			UUID domiciliarioId,
			String motivo,
			int maxIntentos) {
		return pedidoServiceProvider.getObject()
				.registrarEntregaFallidaDomicilio(pedidoId, domiciliarioId, motivo, maxIntentos);
	}

	private List<PedidoDomicilioSnapshot> mapearSnapshots(List<Pedido> pedidos) {
		if (pedidos.isEmpty()) {
			return List.of();
		}
		Set<UUID> pacienteIds = pedidos.stream().map(Pedido::getPacienteId).collect(Collectors.toSet());
		Map<UUID, PacienteResumen> pacientes = authService.obtenerPacientesPorIds(pacienteIds);

		return pedidos.stream()
				.map(p -> {
					PacienteResumen pac = pacientes.get(p.getPacienteId());
					return new PedidoDomicilioSnapshot(
							p.getId(),
							p.getCodigo(),
							p.getSedeId(),
							p.getPacienteId(),
							pac != null ? pac.nombres() + " " + pac.apellidos() : null,
							pac != null ? pac.documento() : null,
							pac != null ? pac.telefono() : null,
							p.getModalidad().name(),
							p.getEstado().name(),
							p.isEsParcial(),
							p.getDireccionEntrega(),
							p.getLatitudEntrega(),
							p.getLongitudEntrega(),
							p.getIntentosEntrega(),
							p.getExpiraEn(),
							p.getListoEn());
				})
				.toList();
	}
}
