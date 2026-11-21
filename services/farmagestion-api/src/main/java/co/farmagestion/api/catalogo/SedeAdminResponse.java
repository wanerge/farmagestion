package co.farmagestion.api.catalogo;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

public record SedeAdminResponse(
		UUID id,
		String codigo,
		String nombre,
		String direccion,
		BigDecimal latitud,
		BigDecimal longitud,
		LocalTime horaApertura,
		LocalTime horaCierre,
		boolean activa) {

	public static SedeAdminResponse from(Sede sede) {
		return new SedeAdminResponse(
				sede.getId(),
				sede.getCodigo(),
				sede.getNombre(),
				sede.getDireccion(),
				sede.getLatitud(),
				sede.getLongitud(),
				sede.getHoraApertura(),
				sede.getHoraCierre(),
				sede.isActiva());
	}
}
