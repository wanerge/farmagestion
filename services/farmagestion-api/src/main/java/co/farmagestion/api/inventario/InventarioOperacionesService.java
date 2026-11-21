package co.farmagestion.api.inventario;

import co.farmagestion.api.common.web.ApiException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Servicio interno de operaciones transaccionales de stock (reserva, liberación y dispensación).
 * Aplica bloqueo pesimista SELECT ... FOR UPDATE ordenado por medicamento_id (RN-01),
 * trazabilidad en kárdex (RN-08) y publicación única de StockBajoEvent por cruce (RN-07).
 */
@Service
public class InventarioOperacionesService {

	private final InventarioRepository inventarioRepository;
	private final MovimientoInventarioRepository movimientoRepository;
	private final ApplicationEventPublisher eventPublisher;

	public InventarioOperacionesService(
			InventarioRepository inventarioRepository,
			MovimientoInventarioRepository movimientoRepository,
			ApplicationEventPublisher eventPublisher) {
		this.inventarioRepository = inventarioRepository;
		this.movimientoRepository = movimientoRepository;
		this.eventPublisher = eventPublisher;
	}

	@Transactional
	public ResultadoReserva reservar(
			UUID sedeId,
			List<SolicitudStockItem> items,
			boolean aceptaParcial,
			String referenciaTipo,
			UUID referenciaId,
			UUID usuarioId) {
		Map<UUID, Integer> cantidadesPorMed = consolidarYOrdenar(items);

		List<Inventario> bloqueados = inventarioRepository.findAllBySedeIdAndMedicamentoIdInForUpdate(
				sedeId, cantidadesPorMed.keySet());
		Map<UUID, Inventario> inventarioPorMed = indexarPorMedicamento(bloqueados);

		List<ResultadoReservaItem> resultados = new ArrayList<>();
		boolean esParcial = false;
		boolean todoAgotado = true;

		for (Map.Entry<UUID, Integer> entry : cantidadesPorMed.entrySet()) {
			UUID medicamentoId = entry.getKey();
			int solicitada = entry.getValue();
			Inventario inv = inventarioPorMed.get(medicamentoId);
			int disponible = inv == null ? 0 : inv.getDisponible();
			int aReservar = Math.min(solicitada, disponible);

			EstadoReservaItem estado;
			if (aReservar == solicitada) {
				estado = EstadoReservaItem.COMPLETO;
				todoAgotado = false;
			} else if (aReservar > 0) {
				estado = EstadoReservaItem.PARCIAL;
				esParcial = true;
				todoAgotado = false;
			} else {
				estado = EstadoReservaItem.AGOTADO;
				esParcial = true;
			}

			resultados.add(new ResultadoReservaItem(medicamentoId, solicitada, disponible, aReservar, estado));
		}

		if (todoAgotado) {
			throw new StockInsuficienteException(
					resultados,
					"Ninguno de los medicamentos solicitados tiene stock disponible en la sede.");
		}
		if (esParcial && !aceptaParcial) {
			throw new StockInsuficienteException(
					resultados,
					"No hay stock suficiente para completar todos los ítems solicitados.");
		}

		Instant ahora = Instant.now();
		List<StockBajoEvent> eventos = new ArrayList<>();

		for (ResultadoReservaItem res : resultados) {
			if (res.reservada() <= 0) {
				continue;
			}
			Inventario inv = inventarioPorMed.get(res.medicamentoId());
			int disponibleAntes = inv.getDisponible();
			inv.setCantidadReservada(inv.getCantidadReservada() + res.reservada());
			int disponibleDespues = inv.getDisponible();

			registrarMovimiento(
					sedeId,
					res.medicamentoId(),
					TipoMovimientoInventario.RESERVA,
					res.reservada(),
					inv.getCantidadFisica(),
					referenciaTipo,
					referenciaId,
					usuarioId,
					"Reserva de inventario");

			if (cruzoBajoMinimo(disponibleAntes, disponibleDespues, inv.getStockMinimo())) {
				eventos.add(new StockBajoEvent(
						sedeId, res.medicamentoId(), disponibleDespues, inv.getStockMinimo(), ahora));
			}
		}

		inventarioRepository.saveAllAndFlush(bloqueados);
		eventos.forEach(eventPublisher::publishEvent);

		return new ResultadoReserva(resultados, esParcial, false);
	}

	@Transactional
	public void liberar(
			UUID sedeId,
			List<SolicitudStockItem> items,
			String referenciaTipo,
			UUID referenciaId,
			UUID usuarioId,
			String motivo) {
		Map<UUID, Integer> cantidadesPorMed = consolidarYOrdenar(items);

		List<Inventario> bloqueados = inventarioRepository.findAllBySedeIdAndMedicamentoIdInForUpdate(
				sedeId, cantidadesPorMed.keySet());
		Map<UUID, Inventario> inventarioPorMed = indexarPorMedicamento(bloqueados);

		for (Map.Entry<UUID, Integer> entry : cantidadesPorMed.entrySet()) {
			UUID medicamentoId = entry.getKey();
			int cantidad = entry.getValue();
			Inventario inv = inventarioPorMed.get(medicamentoId);
			if (inv == null) {
				throw ApiException.notFound(
						"INVENTARIO_NO_ENCONTRADO",
						"Inventario no encontrado",
						"No existe registro de inventario para el medicamento en la sede.");
			}
			if (inv.getCantidadReservada() < cantidad) {
				throw ApiException.conflict(
						"LIBERACION_EXCEDE_RESERVA",
						"Liberación inválida",
						"La cantidad a liberar excede el stock reservado actual.");
			}

			inv.setCantidadReservada(inv.getCantidadReservada() - cantidad);
			registrarMovimiento(
					sedeId,
					medicamentoId,
					TipoMovimientoInventario.LIBERACION,
					cantidad,
					inv.getCantidadFisica(),
					referenciaTipo,
					referenciaId,
					usuarioId,
					motivo == null || motivo.isBlank() ? "Liberación de reserva" : motivo);
		}

		inventarioRepository.saveAllAndFlush(bloqueados);
	}

	@Transactional
	public void dispensar(
			UUID sedeId,
			List<SolicitudStockItem> items,
			String referenciaTipo,
			UUID referenciaId,
			UUID usuarioId,
			String motivo) {
		Map<UUID, Integer> cantidadesPorMed = consolidarYOrdenar(items);

		List<Inventario> bloqueados = inventarioRepository.findAllBySedeIdAndMedicamentoIdInForUpdate(
				sedeId, cantidadesPorMed.keySet());
		Map<UUID, Inventario> inventarioPorMed = indexarPorMedicamento(bloqueados);

		for (Map.Entry<UUID, Integer> entry : cantidadesPorMed.entrySet()) {
			UUID medicamentoId = entry.getKey();
			int cantidad = entry.getValue();
			Inventario inv = inventarioPorMed.get(medicamentoId);
			if (inv == null) {
				throw ApiException.notFound(
						"INVENTARIO_NO_ENCONTRADO",
						"Inventario no encontrado",
						"No existe registro de inventario para el medicamento en la sede.");
			}
			if (inv.getCantidadReservada() < cantidad || inv.getCantidadFisica() < cantidad) {
				throw ApiException.conflict(
						"DISPENSACION_INVALIDA",
						"Dispensación inválida",
						"No hay suficiente stock físico o reservado para dispensar la cantidad indicada.");
			}

			inv.setCantidadReservada(inv.getCantidadReservada() - cantidad);
			inv.setCantidadFisica(inv.getCantidadFisica() - cantidad);
			registrarMovimiento(
					sedeId,
					medicamentoId,
					TipoMovimientoInventario.DISPENSACION,
					cantidad,
					inv.getCantidadFisica(),
					referenciaTipo,
					referenciaId,
					usuarioId,
					motivo == null || motivo.isBlank() ? "Dispensación de pedido" : motivo);
		}

		inventarioRepository.saveAllAndFlush(bloqueados);
	}

	static boolean cruzoBajoMinimo(int disponibleAntes, int disponibleDespues, int stockMinimo) {
		return disponibleAntes > stockMinimo && disponibleDespues <= stockMinimo;
	}

	private Map<UUID, Integer> consolidarYOrdenar(List<SolicitudStockItem> items) {
		if (items == null || items.isEmpty()) {
			throw ApiException.badRequest(
					"ITEMS_REQUERIDOS",
					"Ítems requeridos",
					"Debe incluir al menos un medicamento en la operación de stock.");
		}

		Map<UUID, Integer> acumulado = new LinkedHashMap<>();
		items.stream()
				.sorted(Comparator.comparing(SolicitudStockItem::medicamentoId))
				.forEach(item -> acumulado.merge(item.medicamentoId(), item.cantidad(), Integer::sum));
		return acumulado;
	}

	private Map<UUID, Inventario> indexarPorMedicamento(List<Inventario> registros) {
		Map<UUID, Inventario> mapa = new LinkedHashMap<>();
		for (Inventario registro : registros) {
			mapa.put(registro.getMedicamentoId(), registro);
		}
		return mapa;
	}

	private void registrarMovimiento(
			UUID sedeId,
			UUID medicamentoId,
			TipoMovimientoInventario tipo,
			int cantidad,
			int saldoFisico,
			String referenciaTipo,
			UUID referenciaId,
			UUID usuarioId,
			String motivo) {
		MovimientoInventario mov = new MovimientoInventario();
		mov.setSedeId(sedeId);
		mov.setMedicamentoId(medicamentoId);
		mov.setTipo(tipo);
		mov.setCantidad(cantidad);
		mov.setSaldoFisico(saldoFisico);
		mov.setReferenciaTipo(referenciaTipo);
		mov.setReferenciaId(referenciaId);
		mov.setUsuarioId(usuarioId);
		mov.setMotivo(motivo);
		movimientoRepository.save(mov);
	}
}
