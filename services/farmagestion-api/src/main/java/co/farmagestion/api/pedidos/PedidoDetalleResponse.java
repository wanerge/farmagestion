package co.farmagestion.api.pedidos;

import co.farmagestion.api.domicilios.RutaResumenPedidoResponse;
import co.farmagestion.api.turnos.TurnoResponse;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record PedidoDetalleResponse(
		UUID id,
		String codigo,
		EstadoPedido estado,
		ModalidadPedido modalidad,
		boolean esParcial,
		UUID sedeId,
		String sedeCodigo,
		String sedeNombre,
		UUID formulaId,
		String formulaCodigo,
		UUID pacienteId,
		String pacienteNombre,
		String pacienteTipoDocumento,
		String pacienteDocumento,
		String pacienteTelefono,
		String direccionEntrega,
		BigDecimal latitudEntrega,
		BigDecimal longitudEntrega,
		int intentosEntrega,
		UUID asignadoA,
		Instant expiraEn,
		Instant createdAt,
		Instant updatedAt,
		Instant listoEn,
		Instant entregadoEn,
		TurnoResponse turno,
		RutaResumenPedidoResponse ruta,
		List<PedidoItemResponse> items,
		List<PedidoHistorialResponse> historial) {

	public record PedidoItemResponse(
			UUID id,
			UUID medicamentoId,
			String medicamentoCodigo,
			String medicamentoNombre,
			String presentacion,
			int cantidadSolicitada,
			int cantidadReservada,
			int cantidadEntregada,
			EstadoPedidoItem estadoItem) {
	}

	public record PedidoHistorialResponse(
			UUID id,
			String estadoAnterior,
			String estadoNuevo,
			UUID usuarioId,
			String nota,
			Instant createdAt) {

		static PedidoHistorialResponse from(PedidoHistorial h) {
			return new PedidoHistorialResponse(
					h.getId(),
					h.getEstadoAnterior(),
					h.getEstadoNuevo(),
					h.getUsuarioId(),
					h.getNota(),
					h.getCreatedAt());
		}
	}
}
