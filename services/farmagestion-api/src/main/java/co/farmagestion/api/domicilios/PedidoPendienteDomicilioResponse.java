package co.farmagestion.api.domicilios;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record PedidoPendienteDomicilioResponse(
		UUID id,
		String codigo,
		String pacienteNombre,
		String pacienteDocumento,
		String pacienteTelefono,
		String direccionEntrega,
		BigDecimal latitudEntrega,
		BigDecimal longitudEntrega,
		int intentosEntrega,
		boolean esParcial,
		Instant expiraEn,
		Instant listoEn) {

	static PedidoPendienteDomicilioResponse from(PedidoDomicilioSnapshot p) {
		return new PedidoPendienteDomicilioResponse(
				p.id(),
				p.codigo(),
				p.pacienteNombre(),
				p.pacienteDocumento(),
				p.pacienteTelefono(),
				p.direccionEntrega(),
				p.latitudEntrega(),
				p.longitudEntrega(),
				p.intentosEntrega(),
				p.esParcial(),
				p.expiraEn(),
				p.listoEn());
	}
}
