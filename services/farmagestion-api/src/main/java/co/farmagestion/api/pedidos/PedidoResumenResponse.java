package co.farmagestion.api.pedidos;

import co.farmagestion.api.turnos.TurnoResponse;
import java.time.Instant;
import java.util.UUID;

public record PedidoResumenResponse(
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
		String pacienteDocumento,
		UUID asignadoA,
		Instant expiraEn,
		Instant createdAt,
		Instant updatedAt,
		Instant listoEn,
		Instant entregadoEn,
		TurnoResponse turno) {
}
