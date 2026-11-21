package co.farmagestion.api.catalogo;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

public record SedePublicaResponse(
		UUID id,
		String codigo,
		String nombre,
		String direccion,
		BigDecimal latitud,
		BigDecimal longitud,
		LocalTime horaApertura,
		LocalTime horaCierre) {

	static SedePublicaResponse from(Sede s) {
		return new SedePublicaResponse(
				s.getId(),
				s.getCodigo(),
				s.getNombre(),
				s.getDireccion(),
				s.getLatitud(),
				s.getLongitud(),
				s.getHoraApertura(),
				s.getHoraCierre());
	}
}
