package co.farmagestion.api.integracion;

import java.time.Instant;
import java.util.List;

public record DispensacionOutboxPayload(
		String formulaCodigo,
		String pedidoRef,
		String sedeCodigo,
		Instant fecha,
		List<DispensacionOutboxItem> items) {

	public record DispensacionOutboxItem(
			String medicamentoCodigo,
			int cantidad) {
	}
}
