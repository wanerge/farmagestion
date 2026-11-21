package co.farmagestion.api.formulas;

import java.util.Collection;
import java.util.Map;
import java.util.UUID;

/**
 * Puerto de consulta hacia el módulo pedidos para calcular el saldo pendiente de RN-03
 * sin acoplar el módulo formulas a las tablas de pedidos.
 */
public interface ReservasFormulaConsulta {

	Map<UUID, Integer> obtenerCantidadReservadaActivaPorMedicamento(UUID formulaRefId);

	Map<UUID, Map<UUID, Integer>> obtenerCantidadReservadaActivaPorFormulas(Collection<UUID> formulaRefIds);
}
