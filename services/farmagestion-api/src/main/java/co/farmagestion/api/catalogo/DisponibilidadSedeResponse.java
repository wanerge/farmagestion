package co.farmagestion.api.catalogo;

import co.farmagestion.api.inventario.NivelDisponibilidad;
import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.UUID;

public record DisponibilidadSedeResponse(
		UUID sedeId,
		String codigo,
		String nombre,
		String direccion,
		BigDecimal latitud,
		BigDecimal longitud,
		LocalTime horaApertura,
		LocalTime horaCierre,
		NivelDisponibilidad nivel) {
}
