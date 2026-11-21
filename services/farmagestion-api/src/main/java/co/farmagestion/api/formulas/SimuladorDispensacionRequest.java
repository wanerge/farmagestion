package co.farmagestion.api.formulas;

import java.time.Instant;
import java.util.List;

public record SimuladorDispensacionRequest(
		String pedidoRef,
		String sedeCodigo,
		Instant fecha,
		List<SimuladorDispensacionItemRequest> items) {

	public record SimuladorDispensacionItemRequest(
			String medicamentoCodigo,
			int cantidad) {
	}
}
