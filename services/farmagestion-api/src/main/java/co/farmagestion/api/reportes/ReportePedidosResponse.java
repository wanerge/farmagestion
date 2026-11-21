package co.farmagestion.api.reportes;

import co.farmagestion.api.pedidos.EstadoPedido;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record ReportePedidosResponse(
		LocalDate desde,
		LocalDate hasta,
		UUID sedeId,
		long totalPedidos,
		long totalEntregados,
		long totalCancelados,
		long totalVencidos,
		List<PedidosPorEstadoItem> porEstado,
		List<PedidosPorDiaItem> porDia) {

	public record PedidosPorEstadoItem(
			EstadoPedido estado,
			long cantidad) {
	}

	public record PedidosPorDiaItem(
			LocalDate fecha,
			long total,
			long entregados,
			long cancelados,
			long vencidos) {
	}
}
