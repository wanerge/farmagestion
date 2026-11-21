package co.farmagestion.api.inventario;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Interfaz pública de consulta del módulo inventario para otros módulos (ej. catalogo, formulas).
 */
@Service
public class InventarioConsultaService {

	private final InventarioRepository inventarioRepository;

	public InventarioConsultaService(InventarioRepository inventarioRepository) {
		this.inventarioRepository = inventarioRepository;
	}

	@Transactional(readOnly = true)
	public Map<UUID, NivelDisponibilidad> obtenerNivelesPorMedicamento(UUID medicamentoId) {
		List<Inventario> registros = inventarioRepository.findAllByMedicamentoId(medicamentoId);
		Map<UUID, NivelDisponibilidad> niveles = new HashMap<>();
		for (Inventario registro : registros) {
			niveles.put(
					registro.getSedeId(),
					NivelDisponibilidad.calcular(registro.getDisponible(), registro.getStockMinimo()));
		}
		return niveles;
	}
}
