package co.farmagestion.api.formulas;

import co.farmagestion.api.common.web.ApiException;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Adaptador HTTP (anti-corruption layer) hacia simulador-eps según contracts/eps-simulador.openapi.yaml (00 §9).
 */
@Component
public class SimuladorEpsClient {

	private static final Logger log = LoggerFactory.getLogger(SimuladorEpsClient.class);

	private final RestClient restClient;
	private final ObjectMapper objectMapper;

	public SimuladorEpsClient(
			@Qualifier("simuladorEpsRestClient") RestClient restClient,
			ObjectMapper objectMapper) {
		this.restClient = restClient;
		this.objectMapper = objectMapper;
	}

	public SimuladorFormulaResponse consultarFormula(String codigo, String documento) {
		try {
			return restClient.get()
					.uri(uriBuilder -> uriBuilder
							.path("/formulas/{codigo}")
							.queryParam("documento", documento)
							.build(codigo))
					.accept(MediaType.APPLICATION_JSON)
					.exchange((request, response) -> {
						int status = response.getStatusCode().value();
						if (status == HttpStatus.OK.value()) {
							return objectMapper.readValue(response.getBody(), SimuladorFormulaResponse.class);
						}
						if (status == HttpStatus.NOT_FOUND.value()) {
							throw ApiException.notFound(
									"FORMULA_NO_ENCONTRADA",
									"Fórmula no encontrada",
									"No encontramos una fórmula con esos datos.");
						}
						log.warn("Simulador EPS respondió HTTP {} al consultar fórmula {}", status, codigo);
						throw ApiException.serviceUnavailable(
								"SIMULADOR_NO_DISPONIBLE",
								"Simulador no disponible",
								"No fue posible validar la fórmula con el simulador de la EPS en este momento.");
					});
		} catch (ApiException ex) {
			throw ex;
		} catch (RestClientException ex) {
			log.warn("Error de comunicación al consultar fórmula {} en simulador EPS: {}", codigo, ex.getMessage());
			throw ApiException.serviceUnavailable(
					"SIMULADOR_NO_DISPONIBLE",
					"Simulador no disponible",
					"No fue posible comunicarse con el simulador de la EPS en este momento.");
		}
	}

	public byte[] descargarPdf(String codigo, String documento) {
		try {
			return restClient.get()
					.uri(uriBuilder -> uriBuilder
							.path("/formulas/{codigo}/pdf")
							.queryParam("documento", documento)
							.build(codigo))
					.accept(MediaType.APPLICATION_PDF)
					.exchange((request, response) -> {
						int status = response.getStatusCode().value();
						if (status == HttpStatus.OK.value()) {
							return response.getBody().readAllBytes();
						}
						if (status == HttpStatus.NOT_FOUND.value()) {
							throw ApiException.notFound(
									"FORMULA_NO_ENCONTRADA",
									"Fórmula no encontrada",
									"No encontramos una fórmula con esos datos.");
						}
						log.warn("Simulador EPS respondió HTTP {} al descargar PDF de fórmula {}", status, codigo);
						throw ApiException.serviceUnavailable(
								"SIMULADOR_NO_DISPONIBLE",
								"Simulador no disponible",
								"No fue posible descargar el PDF de la fórmula en este momento.");
					});
		} catch (ApiException ex) {
			throw ex;
		} catch (RestClientException ex) {
			log.warn("Error de comunicación al descargar PDF de fórmula {}: {}", codigo, ex.getMessage());
			throw ApiException.serviceUnavailable(
					"SIMULADOR_NO_DISPONIBLE",
					"Simulador no disponible",
					"No fue posible comunicarse con el simulador de la EPS en este momento.");
		}
	}

	public ResultadoDispensacionSimulador registrarDispensacion(
			String codigoFormula,
			String idempotencyKey,
			SimuladorDispensacionRequest body) {
		try {
			return restClient.post()
					.uri("/formulas/{codigo}/dispensaciones", codigoFormula)
					.header("Idempotency-Key", idempotencyKey)
					.contentType(MediaType.APPLICATION_JSON)
					.accept(MediaType.APPLICATION_JSON)
					.body(body)
					.exchange((request, response) -> {
						int status = response.getStatusCode().value();
						byte[] raw = response.getBody().readAllBytes();
						if (status == HttpStatus.CREATED.value() || status == HttpStatus.OK.value()) {
							SimuladorFormulaResponse formula = objectMapper.readValue(raw, SimuladorFormulaResponse.class);
							return new ResultadoDispensacionSimulador.Exito(formula);
						}
						String texto = new String(raw, StandardCharsets.UTF_8);
						if (status == HttpStatus.CONFLICT.value() || status == HttpStatus.UNPROCESSABLE_CONTENT.value()) {
							ProblemaSimulador problema = parsearProblema(texto);
							return new ResultadoDispensacionSimulador.ErrorDefinitivo(
									status, problema.code(), problema.detail());
						}
						return new ResultadoDispensacionSimulador.ErrorReintentable(
								"HTTP " + status + (texto.isBlank() ? "" : ": " + truncar(texto, 300)));
					});
		} catch (Exception ex) {
			return new ResultadoDispensacionSimulador.ErrorReintentable(
					ex.getClass().getSimpleName() + ": " + truncar(ex.getMessage(), 300));
		}
	}

	private ProblemaSimulador parsearProblema(String body) {
		if (body == null || body.isBlank()) {
			return new ProblemaSimulador("ERROR_SIMULADOR", "Error reportado por el simulador EPS.");
		}
		try {
			JsonNode node = objectMapper.readTree(body);
			String code = node.hasNonNull("code") ? node.get("code").asString() : "ERROR_SIMULADOR";
			String detail = node.hasNonNull("detail") ? node.get("detail").asString() : truncar(body, 300);
			return new ProblemaSimulador(code, detail);
		} catch (Exception ex) {
			return new ProblemaSimulador("ERROR_SIMULADOR", truncar(body, 300));
		}
	}

	private String truncar(String valor, int max) {
		if (valor == null) {
			return "";
		}
		return valor.length() <= max ? valor : valor.substring(0, max);
	}

	private record ProblemaSimulador(String code, String detail) {
	}
}
