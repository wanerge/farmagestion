package co.farmagestion.api.reportes;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ReporteTurnosResponse(
		LocalDate desde,
		LocalDate hasta,
		UUID sedeId,
		long totalTurnos,
		long totalAtendidos,
		long totalVencidos,
		long totalCancelados,
		List<TurnosPorFranjaItem> porFranja) {

	public record TurnosPorFranjaItem(
			String franjaInicio,
			long total,
			long atendidos,
			long enEspera,
			long llamados,
			long vencidos,
			long cancelados) {
	}
}
