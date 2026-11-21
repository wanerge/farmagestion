package co.farmagestion.api.pedidos;

import co.farmagestion.api.formulas.ReservasFormulaConsulta;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
class ReservasFormulaConsultaImpl implements ReservasFormulaConsulta {

	private final PedidoItemRepository pedidoItemRepository;

	ReservasFormulaConsultaImpl(PedidoItemRepository pedidoItemRepository) {
		this.pedidoItemRepository = pedidoItemRepository;
	}

	@Override
	@Transactional(readOnly = true)
	public Map<UUID, Integer> obtenerCantidadReservadaActivaPorMedicamento(UUID formulaRefId) {
		Map<UUID, Integer> mapa = new HashMap<>();
		for (Object[] row : pedidoItemRepository.sumarReservadoActivoPorFormula(
				formulaRefId, PedidoService.ESTADOS_ACTIVOS)) {
			mapa.put((UUID) row[0], ((Number) row[1]).intValue());
		}
		return mapa;
	}

	@Override
	@Transactional(readOnly = true)
	public Map<UUID, Map<UUID, Integer>> obtenerCantidadReservadaActivaPorFormulas(Collection<UUID> formulaRefIds) {
		if (formulaRefIds == null || formulaRefIds.isEmpty()) {
			return Collections.emptyMap();
		}
		Map<UUID, Map<UUID, Integer>> mapa = new HashMap<>();
		for (Object[] row : pedidoItemRepository.sumarReservadoActivoPorFormulas(
				formulaRefIds, PedidoService.ESTADOS_ACTIVOS)) {
			UUID formulaId = (UUID) row[0];
			UUID medId = (UUID) row[1];
			int total = ((Number) row[2]).intValue();
			mapa.computeIfAbsent(formulaId, k -> new HashMap<>()).put(medId, total);
		}
		return mapa;
	}
}
