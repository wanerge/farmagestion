package co.farmagestion.api.domicilios;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PedidoDomicilioSnapshot(
		UUID id,
		String codigo,
		UUID sedeId,
		UUID pacienteId,
		String pacienteNombre,
		String pacienteDocumento,
		String pacienteTelefono,
		String modalidad,
		String estado,
		boolean esParcial,
		String direccionEntrega,
		BigDecimal latitudEntrega,
		BigDecimal longitudEntrega,
		int intentosEntrega,
		Instant expiraEn,
		Instant listoEn) {
}
