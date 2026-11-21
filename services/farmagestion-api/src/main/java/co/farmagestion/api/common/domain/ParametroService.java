package co.farmagestion.api.common.domain;

import java.time.ZoneId;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ParametroService {

	public static final ZoneId ZONA_NEGOCIO = ZoneId.of("America/Bogota");

	public static final String RESERVA_TTL_DOMICILIO_HORAS = "reserva.ttl_domicilio_horas";
	public static final String RESERVA_GRACIA_TURNO_MIN = "reserva.gracia_turno_min";
	public static final String TURNO_FRANJA_MIN = "turno.franja_min";
	public static final String TURNO_CAPACIDAD_FRANJA = "turno.capacidad_franja";
	public static final String TURNO_DIAS_ADELANTE = "turno.dias_adelante";
	public static final String DOMICILIO_MAX_PARADAS = "domicilio.max_paradas";
	public static final String DOMICILIO_MAX_INTENTOS = "domicilio.max_intentos";
	public static final String INVENTARIO_STOCK_MINIMO_DEFAULT = "inventario.stock_minimo_default";

	private final ParametroRepository parametroRepository;

	public ParametroService(ParametroRepository parametroRepository) {
		this.parametroRepository = parametroRepository;
	}

	@Transactional(readOnly = true)
	public int obtenerEntero(String clave, int valorPorDefecto) {
		return parametroRepository.findById(clave)
				.map(Parametro::getValor)
				.map(String::trim)
				.map(valor -> {
					try {
						return Integer.parseInt(valor);
					} catch (NumberFormatException ex) {
						return valorPorDefecto;
					}
				})
				.orElse(valorPorDefecto);
	}
}
