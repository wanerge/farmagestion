package co.farmagestion.api.reportes;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ReporteFaltantesResponse(
		LocalDate desde,
		LocalDate hasta,
		UUID sedeId,
		List<FaltanteMedicamentoItem> items) {

	public record FaltanteMedicamentoItem(
			UUID medicamentoId,
			String medicamentoCodigo,
			String medicamentoNombre,
			long vecesFaltante,
			long vecesAgotado,
			long unidadesFaltantes,
			long sedesAgotado,
			long sedesBajoMinimo) {
	}
}
