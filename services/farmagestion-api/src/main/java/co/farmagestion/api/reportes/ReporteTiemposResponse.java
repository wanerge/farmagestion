package co.farmagestion.api.reportes;

import co.farmagestion.api.pedidos.ModalidadPedido;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ReporteTiemposResponse(
		LocalDate desde,
		LocalDate hasta,
		UUID sedeId,
		long cantidadPedidosEntregados,
		double promedioPreparacionMin,
		double promedioEntregaMin,
		double promedioTotalMin,
		List<TiemposPorDiaItem> porDia,
		List<TiemposPorModalidadItem> porModalidad) {

	public record TiemposPorDiaItem(
			LocalDate fecha,
			long cantidadEntregados,
			double promedioPreparacionMin,
			double promedioEntregaMin,
			double promedioTotalMin) {
	}

	public record TiemposPorModalidadItem(
			ModalidadPedido modalidad,
			long cantidadEntregados,
			double promedioPreparacionMin,
			double promedioEntregaMin,
			double promedioTotalMin) {
	}
}
