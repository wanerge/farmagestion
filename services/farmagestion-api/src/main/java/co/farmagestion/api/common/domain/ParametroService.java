package co.farmagestion.api.common.domain;

import co.farmagestion.api.common.web.ApiException;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.Sort;
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

	private static final Map<String, Integer> MINIMO_POR_CLAVE_ENTERA = Map.of(
			RESERVA_TTL_DOMICILIO_HORAS, 1,
			RESERVA_GRACIA_TURNO_MIN, 0,
			TURNO_FRANJA_MIN, 5,
			TURNO_CAPACIDAD_FRANJA, 1,
			TURNO_DIAS_ADELANTE, 0,
			DOMICILIO_MAX_PARADAS, 1,
			DOMICILIO_MAX_INTENTOS, 1,
			INVENTARIO_STOCK_MINIMO_DEFAULT, 0);

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

	@Transactional(readOnly = true)
	public List<ParametroResponse> listarTodos() {
		return parametroRepository.findAll(Sort.by("clave").ascending()).stream()
				.map(ParametroResponse::from)
				.toList();
	}

	@Transactional
	public ParametroResponse actualizarParametro(String clave, String nuevoValor) {
		String claveLimpia = clave == null ? "" : clave.trim();
		Parametro parametro = parametroRepository.findById(claveLimpia)
				.orElseThrow(() -> ApiException.notFound(
						"PARAMETRO_NO_ENCONTRADO",
						"Parámetro no encontrado",
						"No existe un parámetro con la clave " + claveLimpia + "."));

		String valorValidado = validarValor(claveLimpia, nuevoValor);
		parametro.setValor(valorValidado);
		Parametro guardado = parametroRepository.saveAndFlush(parametro);
		return ParametroResponse.from(guardado);
	}

	@Transactional
	public List<ParametroResponse> actualizarParametros(Map<String, String> cambios) {
		for (Map.Entry<String, String> entry : cambios.entrySet()) {
			actualizarParametro(entry.getKey(), entry.getValue());
		}
		return listarTodos();
	}

	private String validarValor(String clave, String valor) {
		if (valor == null || valor.trim().isEmpty()) {
			throw ApiException.badRequest(
					"PARAMETRO_VALOR_INVALIDO",
					"Valor de parámetro inválido",
					"El valor del parámetro " + clave + " no puede estar vacío.");
		}
		String limpio = valor.trim();
		Integer minimo = MINIMO_POR_CLAVE_ENTERA.get(clave);
		if (minimo != null) {
			int entero;
			try {
				entero = Integer.parseInt(limpio);
			} catch (NumberFormatException ex) {
				throw ApiException.badRequest(
						"PARAMETRO_VALOR_INVALIDO",
						"Valor de parámetro inválido",
						"El parámetro " + clave + " debe ser un número entero.");
			}
			if (entero < minimo) {
				throw ApiException.badRequest(
						"PARAMETRO_VALOR_INVALIDO",
						"Valor de parámetro inválido",
						"El parámetro " + clave + " debe ser mayor o igual a " + minimo + ".");
			}
			return String.valueOf(entero);
		}
		return limpio;
	}
}
