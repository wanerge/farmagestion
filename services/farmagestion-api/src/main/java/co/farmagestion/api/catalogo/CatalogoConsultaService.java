package co.farmagestion.api.catalogo;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Interfaz pública de consulta del módulo catalogo para otros módulos (ej. inventario, pedidos).
 */
@Service
public class CatalogoConsultaService {

	private final MedicamentoRepository medicamentoRepository;
	private final SedeRepository sedeRepository;

	public CatalogoConsultaService(
			MedicamentoRepository medicamentoRepository,
			SedeRepository sedeRepository) {
		this.medicamentoRepository = medicamentoRepository;
		this.sedeRepository = sedeRepository;
	}

	@Transactional(readOnly = true)
	public Optional<MedicamentoPublicoResponse> obtenerMedicamentoPorId(UUID medicamentoId) {
		return medicamentoRepository.findById(medicamentoId).map(MedicamentoPublicoResponse::from);
	}

	@Transactional(readOnly = true)
	public Map<UUID, MedicamentoPublicoResponse> obtenerMedicamentosPorIds(Collection<UUID> ids) {
		if (ids == null || ids.isEmpty()) {
			return Collections.emptyMap();
		}
		Map<UUID, MedicamentoPublicoResponse> mapa = new LinkedHashMap<>();
		for (Medicamento m : medicamentoRepository.findAllByIdIn(ids)) {
			mapa.put(m.getId(), MedicamentoPublicoResponse.from(m));
		}
		return mapa;
	}

	@Transactional(readOnly = true)
	public List<UUID> buscarIdsMedicamentosPorTexto(String q) {
		if (q == null || q.isBlank()) {
			return Collections.emptyList();
		}
		return medicamentoRepository.buscarIdsPorTexto(q.trim());
	}

	@Transactional(readOnly = true)
	public Optional<SedePublicaResponse> obtenerSedePorId(UUID sedeId) {
		return sedeRepository.findById(sedeId).map(SedePublicaResponse::from);
	}

	@Transactional(readOnly = true)
	public Map<UUID, SedePublicaResponse> obtenerSedesPorIds(Collection<UUID> ids) {
		if (ids == null || ids.isEmpty()) {
			return Collections.emptyMap();
		}
		Map<UUID, SedePublicaResponse> mapa = new LinkedHashMap<>();
		for (Sede s : sedeRepository.findAllByIdIn(ids)) {
			mapa.put(s.getId(), SedePublicaResponse.from(s));
		}
		return mapa;
	}

	@Transactional(readOnly = true)
	public List<SedePublicaResponse> listarSedesActivas() {
		return sedeRepository.findAllByActivaTrueOrderByNombreAsc().stream()
				.map(SedePublicaResponse::from)
				.toList();
	}
}
