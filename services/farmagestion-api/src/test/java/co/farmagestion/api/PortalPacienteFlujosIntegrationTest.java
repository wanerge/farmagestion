package co.farmagestion.api;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "app.scheduling.enabled=false")
@AutoConfigureMockMvc
class PortalPacienteFlujosIntegrationTest {

	private static final String TEST_API_KEY = "wiremock-test-api-key";
	private static final ZoneId ZONA_BOGOTA = ZoneId.of("America/Bogota");

	private static WireMockServer wireMock;

	@BeforeAll
	static void startWireMock() {
		wireMock = new WireMockServer(WireMockConfiguration.wireMockConfig().dynamicPort());
		wireMock.start();
	}

	@AfterAll
	static void stopWireMock() {
		if (wireMock != null) {
			wireMock.stop();
		}
	}

	@DynamicPropertySource
	static void overrideProperties(DynamicPropertyRegistry registry) {
		registry.add("app.integracion.eps-simulador-url", () -> wireMock.baseUrl());
		registry.add("app.integracion.eps-simulador-api-key", () -> TEST_API_KEY);
	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	private UUID sedeCentroId;

	@BeforeEach
	void setUp() {
		wireMock.resetAll();
		sedeCentroId = jdbcTemplate.queryForObject(
				"SELECT id FROM sede WHERE codigo = 'SEDE-CENTRO'", UUID.class);
		// Limpieza de datos transaccionales entre pruebas
		jdbcTemplate.update("DELETE FROM notificacion");
		jdbcTemplate.update("DELETE FROM evento_integracion");
		jdbcTemplate.update("DELETE FROM turno");
		jdbcTemplate.update("DELETE FROM pedido_historial");
		jdbcTemplate.update("DELETE FROM pedido_item");
		jdbcTemplate.update("DELETE FROM pedido");
		jdbcTemplate.update("DELETE FROM formula_item_ref");
		jdbcTemplate.update("DELETE FROM formula_ref");
		jdbcTemplate.update("UPDATE inventario SET cantidad_reservada = 0");
	}

	private String login(String email) throws Exception {
		MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "email": "%s", "password": "Farma2026!" }
								""".formatted(email)))
				.andExpect(status().isOk())
				.andReturn();
		return objectMapper.readTree(res.getResponse().getContentAsString()).get("accessToken").asString();
	}

	private UUID medicamentoIdPorCodigo(String codigo) {
		return jdbcTemplate.queryForObject(
				"SELECT id FROM medicamento WHERE codigo = ?", UUID.class, codigo);
	}

	private void stubFormula(
			String codigo,
			String documento,
			String estado,
			LocalDate vencimiento,
			String itemsJson) {
		LocalDate emision = LocalDate.now(ZONA_BOGOTA);
		String body = """
				{
				  "codigo": "%s",
				  "estado": "%s",
				  "fechaEmision": "%s",
				  "fechaVencimiento": "%s",
				  "observaciones": "Control médico de prueba",
				  "paciente": {
				    "tipoDocumento": "CC",
				    "documento": "%s",
				    "nombres": "Ana María",
				    "apellidos": "Velásquez"
				  },
				  "medico": { "nombre": "Dr. Carlos Mejía" },
				  "items": %s
				}
				""".formatted(codigo, estado, emision, vencimiento, documento, itemsJson);

		wireMock.stubFor(WireMock.get(urlPathEqualTo("/api/v1/formulas/" + codigo))
				.withHeader("X-API-Key", equalTo(TEST_API_KEY))
				.withQueryParam("documento", equalTo(documento))
				.willReturn(aResponse()
						.withStatus(200)
						.withHeader("Content-Type", "application/json")
						.withBody(body)));
	}

	private String itemJson(String medCodigo, String medNombre, int autorizada, int dispensada) {
		return """
				{
				  "medicamentoCodigo": "%s",
				  "medicamentoNombre": "%s",
				  "dosis": "1 tableta",
				  "frecuencia": "cada 12 horas",
				  "duracionDias": 30,
				  "cantidadAutorizada": %d,
				  "cantidadDispensada": %d
				}
				""".formatted(medCodigo, medNombre, autorizada, dispensada);
	}

	private UUID vincularFormula(String token, String codigo) throws Exception {
		MvcResult res = mockMvc.perform(post("/api/v1/pacientes/me/formulas")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "codigo": "%s" }
								""".formatted(codigo)))
				.andExpect(status().isCreated())
				.andReturn();
		return UUID.fromString(objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asString());
	}

	private String obtenerPrimeraFranjaDisponible(String token, UUID sedeId) throws Exception {
		LocalDate hoy = LocalDate.now(ZONA_BOGOTA);
		for (int delta = 0; delta <= 1; delta++) {
			LocalDate fecha = hoy.plusDays(delta);
			MvcResult res = mockMvc.perform(get("/api/v1/pacientes/me/sedes/{sedeId}/franjas", sedeId)
							.header("Authorization", "Bearer " + token)
							.param("fecha", fecha.toString()))
					.andExpect(status().isOk())
					.andReturn();
			JsonNode franjas = objectMapper.readTree(res.getResponse().getContentAsString()).get("franjas");
			for (JsonNode franja : franjas) {
				if (franja.get("disponible").asBoolean()) {
					return franja.get("franjaInicio").asString();
				}
			}
		}
		throw new IllegalStateException("No se encontró ninguna franja disponible para hoy o mañana.");
	}

	@Test
	void CA_PAC_02_vincularFormulaValidaVerDetalleYDescargarPdf() throws Exception {
		String token = login("paciente1@farmagestion.demo");
		String codigo = "FRM-2026-000102";
		stubFormula(
				codigo,
				"1000000001",
				"EMITIDA",
				LocalDate.now(ZONA_BOGOTA).plusDays(20),
				"[" + itemJson("MED-0004", "Losartán 50 mg", 30, 0) + "]");

		// Vincular fórmula (RF-PAC-06)
		MvcResult creada = mockMvc.perform(post("/api/v1/pacientes/me/formulas")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "codigo": "%s" }
								""".formatted(codigo)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.codigoExterno").value(codigo))
				.andExpect(jsonPath("$.vigente").value(true))
				.andExpect(jsonPath("$.medicoNombre").value("Dr. Carlos Mejía"))
				.andExpect(jsonPath("$.items[0].medicamentoCodigo").value("MED-0004"))
				.andExpect(jsonPath("$.items[0].cantidadAutorizada").value(30))
				.andExpect(jsonPath("$.items[0].cantidadPendiente").value(30))
				.andExpect(jsonPath("$.items[0].dosis").value("1 tableta"))
				.andExpect(jsonPath("$.items[0].disponibilidadPorSede.length()").value(3))
				.andReturn();

		UUID formulaId = UUID.fromString(
				objectMapper.readTree(creada.getResponse().getContentAsString()).get("id").asString());

		// RN-PAC-02: no permite vincular la misma fórmula dos veces
		mockMvc.perform(post("/api/v1/pacientes/me/formulas")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "codigo": "%s" }
								""".formatted(codigo)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("FORMULA_YA_VINCULADA"));

		// RF-PAC-07: listar fórmulas vinculadas
		mockMvc.perform(get("/api/v1/pacientes/me/formulas")
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$[0].id").value(formulaId.toString()))
				.andExpect(jsonPath("$[0].items[0].cantidadPendiente").value(30));

		// RF-PAC-07 y RF-PAC-09: detalle con saldos y matriz de disponibilidad por sede
		mockMvc.perform(get("/api/v1/pacientes/me/formulas/{id}", formulaId)
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].disponibilidadPorSede[0].nivel").isNotEmpty());

		// RF-PAC-08 y CA-PAC-12: descarga de PDF autenticado desde simulador
		byte[] pdfSimulado = "%PDF-1.4\nDOCUMENTO SIMULADO\n%%EOF".getBytes(StandardCharsets.UTF_8);
		wireMock.stubFor(WireMock.get(urlPathEqualTo("/api/v1/formulas/" + codigo + "/pdf"))
				.withHeader("X-API-Key", equalTo(TEST_API_KEY))
				.withQueryParam("documento", equalTo("1000000001"))
				.willReturn(aResponse()
						.withStatus(200)
						.withHeader("Content-Type", "application/pdf")
						.withBody(pdfSimulado)));

		MvcResult pdfRes = mockMvc.perform(get("/api/v1/pacientes/me/formulas/{id}/pdf", formulaId)
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(content().contentType(MediaType.APPLICATION_PDF))
				.andReturn();
		assertThat(new String(pdfRes.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8))
				.contains("DOCUMENTO SIMULADO");
	}

	@Test
	void CA_PAC_03_vincularFormulaAjenaDevuelveMensajeGenericoYNoGuardaNada() throws Exception {
		String token = login("paciente1@farmagestion.demo");
		String codigoAjeno = "FRM-2026-000103";

		wireMock.stubFor(WireMock.get(urlPathEqualTo("/api/v1/formulas/" + codigoAjeno))
				.withHeader("X-API-Key", equalTo(TEST_API_KEY))
				.withQueryParam("documento", equalTo("1000000001"))
				.willReturn(aResponse()
						.withStatus(404)
						.withHeader("Content-Type", "application/problem+json")
						.withBody("""
								{
								  "type": "https://farmagestion.co/errores/formula-no-encontrada",
								  "title": "Fórmula no encontrada",
								  "status": 404,
								  "detail": "No encontramos una fórmula con esos datos.",
								  "code": "FORMULA_NO_ENCONTRADA"
								}
								""")));

		mockMvc.perform(post("/api/v1/pacientes/me/formulas")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "codigo": "%s" }
								""".formatted(codigoAjeno)))
				.andExpect(status().isNotFound())
				.andExpect(jsonPath("$.code").value("FORMULA_NO_ENCONTRADA"))
				.andExpect(jsonPath("$.detail").value("No encontramos una fórmula con esos datos."));

		Integer guardadas = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM formula_ref WHERE codigo_externo = ?",
				Integer.class, codigoAjeno);
		assertThat(guardadas).isZero();
	}

	@Test
	void CA_PAC_04_crearPedidoRecogerReservaStockGeneraTurnoYNotifica() throws Exception {
		String tokenPaciente = login("paciente1@farmagestion.demo");
		String tokenEmpleado = login("auxiliar.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0004");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 50, cantidad_reservada = 0, stock_minimo = 10 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		String codigo = "FRM-2026-000104";
		stubFormula(
				codigo,
				"1000000001",
				"EMITIDA",
				LocalDate.now(ZONA_BOGOTA).plusDays(20),
				"[" + itemJson("MED-0004", "Losartán 50 mg", 30, 0) + "]");
		UUID formulaId = vincularFormula(tokenPaciente, codigo);
		String franjaInicio = obtenerPrimeraFranjaDisponible(tokenPaciente, sedeCentroId);

		MvcResult res = mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + tokenPaciente)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 15 }]
								}
								""".formatted(formulaId, sedeCentroId, franjaInicio, medId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.estado").value("RESERVADO"))
				.andExpect(jsonPath("$.esParcial").value(false))
				.andExpect(jsonPath("$.turno.estado").value("EN_ESPERA"))
				.andExpect(jsonPath("$.turno.codigo").isNotEmpty())
				.andExpect(jsonPath("$.items[0].cantidadReservada").value(15))
				.andExpect(jsonPath("$.items[0].estadoItem").value("COMPLETO"))
				.andExpect(jsonPath("$.historial.length()").value(1))
				.andReturn();

		UUID pedidoId = UUID.fromString(
				objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asString());

		// Stock reservado aumentó en 15
		Integer reservada = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		assertThat(reservada).isEqualTo(15);

		// Notificación PEDIDO_RESERVADO al paciente y marcarla leída (RF-PAC-17, RF-PAC-18)
		MvcResult notifRes = mockMvc.perform(get("/api/v1/pacientes/me/notificaciones")
						.header("Authorization", "Bearer " + tokenPaciente))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.noLeidas").value(1))
				.andExpect(jsonPath("$.content[0].tipo").value("PEDIDO_RESERVADO"))
				.andExpect(jsonPath("$.content[0].referenciaId").value(pedidoId.toString()))
				.andReturn();
		UUID notifId = UUID.fromString(
				objectMapper.readTree(notifRes.getResponse().getContentAsString())
						.get("content").get(0).get("id").asString());

		mockMvc.perform(post("/api/v1/pacientes/me/notificaciones/{id}/leer", notifId)
						.header("Authorization", "Bearer " + tokenPaciente))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.leida").value(true));

		mockMvc.perform(get("/api/v1/pacientes/me/notificaciones")
						.header("Authorization", "Bearer " + tokenPaciente))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.noLeidas").value(0));

		// RF-EMP-26: empleado de la sede recibió notificación NUEVO_PEDIDO
		mockMvc.perform(get("/api/v1/gestion/notificaciones")
						.header("Authorization", "Bearer " + tokenEmpleado))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].tipo").value("NUEVO_PEDIDO"));

		// RF-PAC-16: historial de pedidos del paciente filtrado por estado
		mockMvc.perform(get("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + tokenPaciente)
						.param("estado", "RESERVADO"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalElements").value(1))
				.andExpect(jsonPath("$.content[0].id").value(pedidoId.toString()));
	}

	@Test
	void CA_PAC_05_faltanteSinAceptarParcialDevuelve409YNoReservaNada() throws Exception {
		String token = login("paciente1@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0001");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 5, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		String codigo = "FRM-2026-000105";
		stubFormula(
				codigo,
				"1000000001",
				"EMITIDA",
				LocalDate.now(ZONA_BOGOTA).plusDays(20),
				"[" + itemJson("MED-0001", "Acetaminofén 500 mg", 20, 0) + "]");
		UUID formulaId = vincularFormula(token, codigo);
		String franjaInicio = obtenerPrimeraFranjaDisponible(token, sedeCentroId);

		mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 20 }]
								}
								""".formatted(formulaId, sedeCentroId, franjaInicio, medId)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("STOCK_INSUFICIENTE"))
				.andExpect(jsonPath("$.items[0].solicitada").value(20))
				.andExpect(jsonPath("$.items[0].disponible").value(5))
				.andExpect(jsonPath("$.items[0].estadoItem").value("PARCIAL"));

		Integer reservada = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		Integer pedidos = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM pedido", Integer.class);
		assertThat(reservada).isZero();
		assertThat(pedidos).isZero();
	}

	@Test
	void CA_PAC_06_faltanteAceptandoParcialCreaPedidoParcialYRechazaTodoAgotado() throws Exception {
		String token = login("paciente1@farmagestion.demo");
		UUID medA = medicamentoIdPorCodigo("MED-0001");
		UUID medB = medicamentoIdPorCodigo("MED-0002");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 5, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medA);
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 0, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medB);

		String codigo = "FRM-2026-000106";
		stubFormula(
				codigo,
				"1000000001",
				"EMITIDA",
				LocalDate.now(ZONA_BOGOTA).plusDays(20),
				"[" + itemJson("MED-0001", "Acetaminofén 500 mg", 20, 0) + ","
						+ itemJson("MED-0002", "Ibuprofeno 400 mg", 10, 0) + "]");
		UUID formulaId = vincularFormula(token, codigo);
		String franjaInicio = obtenerPrimeraFranjaDisponible(token, sedeCentroId);

		// Con aceptaParcial=true y al menos un ítem reservable -> 201 esParcial=true
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": true,
								  "items": [
								    { "medicamentoId": "%s", "cantidad": 20 },
								    { "medicamentoId": "%s", "cantidad": 10 }
								  ]
								}
								""".formatted(formulaId, sedeCentroId, franjaInicio, medA, medB)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.esParcial").value(true))
				.andExpect(jsonPath("$.items[?(@.medicamentoCodigo=='MED-0001')].estadoItem").value("PARCIAL"))
				.andExpect(jsonPath("$.items[?(@.medicamentoCodigo=='MED-0001')].cantidadReservada").value(5))
				.andExpect(jsonPath("$.items[?(@.medicamentoCodigo=='MED-0002')].estadoItem").value("AGOTADO"))
				.andExpect(jsonPath("$.items[?(@.medicamentoCodigo=='MED-0002')].cantidadReservada").value(0));

		// RN-02: pedido con todos los ítems AGOTADO nunca se crea, incluso con aceptaParcial=true
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": true,
								  "items": [{ "medicamentoId": "%s", "cantidad": 5 }]
								}
								""".formatted(formulaId, sedeCentroId, franjaInicio, medB)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("STOCK_INSUFICIENTE"));
	}

	@Test
	void CA_PAC_07_concurrenciaDosPacientesPidiendoUltimaUnidad() throws Exception {
		String tokenP2 = login("paciente2@farmagestion.demo");
		String tokenP3 = login("paciente3@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0016");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 1, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		stubFormula("FRM-2026-000107", "1000000002", "EMITIDA", LocalDate.now(ZONA_BOGOTA).plusDays(15),
				"[" + itemJson("MED-0016", "Cefalexina 500 mg", 10, 0) + "]");
		stubFormula("FRM-2026-000207", "1000000003", "EMITIDA", LocalDate.now(ZONA_BOGOTA).plusDays(15),
				"[" + itemJson("MED-0016", "Cefalexina 500 mg", 10, 0) + "]");

		UUID formulaP2 = vincularFormula(tokenP2, "FRM-2026-000107");
		UUID formulaP3 = vincularFormula(tokenP3, "FRM-2026-000207");
		String franja = obtenerPrimeraFranjaDisponible(tokenP2, sedeCentroId);

		CountDownLatch listos = new CountDownLatch(2);
		CountDownLatch disparo = new CountDownLatch(1);
		ExecutorService pool = Executors.newFixedThreadPool(2);
		try {
			Callable<Integer> tareaP2 = () -> {
				listos.countDown();
				disparo.await();
				return mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
								.header("Authorization", "Bearer " + tokenP2)
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{
										  "formulaId": "%s",
										  "sedeId": "%s",
										  "modalidad": "RECOGER",
										  "franjaInicio": "%s",
										  "aceptaParcial": false,
										  "items": [{ "medicamentoId": "%s", "cantidad": 1 }]
										}
										""".formatted(formulaP2, sedeCentroId, franja, medId)))
						.andReturn().getResponse().getStatus();
			};
			Callable<Integer> tareaP3 = () -> {
				listos.countDown();
				disparo.await();
				return mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
								.header("Authorization", "Bearer " + tokenP3)
								.contentType(MediaType.APPLICATION_JSON)
								.content("""
										{
										  "formulaId": "%s",
										  "sedeId": "%s",
										  "modalidad": "RECOGER",
										  "franjaInicio": "%s",
										  "aceptaParcial": false,
										  "items": [{ "medicamentoId": "%s", "cantidad": 1 }]
										}
										""".formatted(formulaP3, sedeCentroId, franja, medId)))
						.andReturn().getResponse().getStatus();
			};

			Future<Integer> f1 = pool.submit(tareaP2);
			Future<Integer> f2 = pool.submit(tareaP3);
			listos.await();
			disparo.countDown();

			List<Integer> estados = new ArrayList<>();
			estados.add(f1.get());
			estados.add(f2.get());
			assertThat(estados).containsExactlyInAnyOrder(201, 409);
		} finally {
			pool.shutdownNow();
		}

		Integer reservada = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		assertThat(reservada).isEqualTo(1);
	}

	@Test
	void CA_PAC_08_cancelarPedidoLiberandoStockYCancelandoTurno() throws Exception {
		String token = login("paciente1@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0006");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 40, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		stubFormula("FRM-2026-000108", "1000000001", "EMITIDA", LocalDate.now(ZONA_BOGOTA).plusDays(20),
				"[" + itemJson("MED-0006", "Amlodipino 5 mg", 20, 0) + "]");
		UUID formulaId = vincularFormula(token, "FRM-2026-000108");
		String franja = obtenerPrimeraFranjaDisponible(token, sedeCentroId);

		MvcResult creado = mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 12 }]
								}
								""".formatted(formulaId, sedeCentroId, franja, medId)))
				.andExpect(status().isCreated())
				.andReturn();
		UUID pedidoId = UUID.fromString(
				objectMapper.readTree(creado.getResponse().getContentAsString()).get("id").asString());

		mockMvc.perform(post("/api/v1/pacientes/me/pedidos/{id}/cancelar", pedidoId)
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("CANCELADO"))
				.andExpect(jsonPath("$.turno.estado").value("CANCELADO"))
				.andExpect(jsonPath("$.historial.length()").value(2));

		Integer reservada = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		assertThat(reservada).isZero();

		// Segundo intento de cancelar sobre estado final -> 409 TRANSICION_INVALIDA (RN-PAC-06)
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos/{id}/cancelar", pedidoId)
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("TRANSICION_INVALIDA"));
	}

	@Test
	void CA_PAC_09_reservaVencidaEvaluacionPerezosaPermiteNuevoPedido() throws Exception {
		String token = login("paciente1@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0008");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 30, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		stubFormula("FRM-2026-000109", "1000000001", "EMITIDA", LocalDate.now(ZONA_BOGOTA).plusDays(20),
				"[" + itemJson("MED-0008", "Metformina 850 mg", 10, 0) + "]");
		UUID formulaId = vincularFormula(token, "FRM-2026-000109");
		String franja = obtenerPrimeraFranjaDisponible(token, sedeCentroId);

		MvcResult creado = mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 10 }]
								}
								""".formatted(formulaId, sedeCentroId, franja, medId)))
				.andExpect(status().isCreated())
				.andReturn();
		UUID pedidoId = UUID.fromString(
				objectMapper.readTree(creado.getResponse().getContentAsString()).get("id").asString());

		// Simular vencimiento de expira_en en el pasado
		jdbcTemplate.update("UPDATE pedido SET expira_en = NOW() - INTERVAL '10 minutes' WHERE id = ?", pedidoId);

		// Al abrir el detalle, la evaluación perezosa (RN-05) transiciona a VENCIDO y libera stock
		mockMvc.perform(get("/api/v1/pacientes/me/pedidos/{id}", pedidoId)
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("VENCIDO"))
				.andExpect(jsonPath("$.turno.estado").value("VENCIDO"));

		Integer reservada = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		assertThat(reservada).isZero();

		// Puede crear un nuevo pedido por los mismos 10 medicamentos
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 10 }]
								}
								""".formatted(formulaId, sedeCentroId, franja, medId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.estado").value("RESERVADO"));
	}

	@Test
	void CA_PAC_11_aislamientoDeDatosPacienteAjenoRecibe404() throws Exception {
		String tokenP1 = login("paciente1@farmagestion.demo");
		String tokenP2 = login("paciente2@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0010");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 40, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		stubFormula("FRM-2026-000111", "1000000001", "EMITIDA", LocalDate.now(ZONA_BOGOTA).plusDays(20),
				"[" + itemJson("MED-0010", "Atorvastatina 20 mg", 20, 0) + "]");
		UUID formulaId = vincularFormula(tokenP1, "FRM-2026-000111");
		String franja = obtenerPrimeraFranjaDisponible(tokenP1, sedeCentroId);

		MvcResult creado = mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + tokenP1)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 5 }]
								}
								""".formatted(formulaId, sedeCentroId, franja, medId)))
				.andExpect(status().isCreated())
				.andReturn();
		UUID pedidoId = UUID.fromString(
				objectMapper.readTree(creado.getResponse().getContentAsString()).get("id").asString());
		UUID notifId = jdbcTemplate.queryForObject(
				"SELECT id FROM notificacion WHERE referencia_id = ? AND tipo = 'PEDIDO_RESERVADO' LIMIT 1",
				UUID.class, pedidoId);

		// Paciente 2 recibe 404 en pedido, fórmula, PDF y notificación de Paciente 1 (RN-PAC-07)
		mockMvc.perform(get("/api/v1/pacientes/me/pedidos/{id}", pedidoId)
						.header("Authorization", "Bearer " + tokenP2))
				.andExpect(status().isNotFound());
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos/{id}/cancelar", pedidoId)
						.header("Authorization", "Bearer " + tokenP2))
				.andExpect(status().isNotFound());
		mockMvc.perform(get("/api/v1/pacientes/me/formulas/{id}", formulaId)
						.header("Authorization", "Bearer " + tokenP2))
				.andExpect(status().isNotFound());
		mockMvc.perform(get("/api/v1/pacientes/me/formulas/{id}/pdf", formulaId)
						.header("Authorization", "Bearer " + tokenP2))
				.andExpect(status().isNotFound());
		mockMvc.perform(post("/api/v1/pacientes/me/notificaciones/{id}/leer", notifId)
						.header("Authorization", "Bearer " + tokenP2))
				.andExpect(status().isNotFound());
	}

	@Test
	void reglasNegocio_RN03_RN04_RNPAC03_RNPAC04_RNPAC05_yDomicilio() throws Exception {
		String token = login("paciente4@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0012");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 100, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		String codigo = "FRM-2026-000199";
		stubFormula(codigo, "1000000004", "EMITIDA", LocalDate.now(ZONA_BOGOTA).plusDays(20),
				"[" + itemJson("MED-0012", "Omeprazol 20 mg", 30, 0) + "]");
		UUID formulaId = vincularFormula(token, codigo);
		String franja = obtenerPrimeraFranjaDisponible(token, sedeCentroId);

		// RN-03: solicitar más que el pendiente -> 409 CANTIDAD_EXCEDE_PENDIENTE
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 31 }]
								}
								""".formatted(formulaId, sedeCentroId, franja, medId)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("CANTIDAD_EXCEDE_PENDIENTE"));

		// RN-04: simulador caído al crear pedido -> 503 SIMULADOR_NO_DISPONIBLE
		wireMock.stubFor(WireMock.get(urlPathEqualTo("/api/v1/formulas/" + codigo))
				.willReturn(aResponse().withStatus(503)));
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 5 }]
								}
								""".formatted(formulaId, sedeCentroId, franja, medId)))
				.andExpect(status().isServiceUnavailable())
				.andExpect(jsonPath("$.code").value("SIMULADOR_NO_DISPONIBLE"));

		// RN-PAC-03: fórmula vencida -> 422 FORMULA_NO_VIGENTE
		stubFormula(codigo, "1000000004", "VENCIDA", LocalDate.now(ZONA_BOGOTA).minusDays(1),
				"[" + itemJson("MED-0012", "Omeprazol 20 mg", 30, 0) + "]");
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 5 }]
								}
								""".formatted(formulaId, sedeCentroId, franja, medId)))
				.andExpect(status().isUnprocessableContent())
				.andExpect(jsonPath("$.code").value("FORMULA_NO_VIGENTE"));

		// Restaurar fórmula vigente y crear 3 pedidos activos (incluyendo 1 DOMICILIO, RF-PAC-12)
		stubFormula(codigo, "1000000004", "EMITIDA", LocalDate.now(ZONA_BOGOTA).plusDays(20),
				"[" + itemJson("MED-0012", "Omeprazol 20 mg", 30, 0) + "]");

		// Pedido 1: DOMICILIO sin turno
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "DOMICILIO",
								  "direccionEntrega": "Calle 10 # 20-30, Medellín",
								  "latitudEntrega": 6.245000,
								  "longitudEntrega": -75.570000,
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 5 }]
								}
								""".formatted(formulaId, sedeCentroId, medId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.modalidad").value("DOMICILIO"))
				.andExpect(jsonPath("$.turno").doesNotExist());

		// Pedidos 2 y 3: RECOGER
		for (int i = 0; i < 2; i++) {
			mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
							.header("Authorization", "Bearer " + token)
							.contentType(MediaType.APPLICATION_JSON)
							.content("""
									{
									  "formulaId": "%s",
									  "sedeId": "%s",
									  "modalidad": "RECOGER",
									  "franjaInicio": "%s",
									  "aceptaParcial": false,
									  "items": [{ "medicamentoId": "%s", "cantidad": 5 }]
									}
									""".formatted(formulaId, sedeCentroId, franja, medId)))
					.andExpect(status().isCreated());
		}

		// RN-PAC-04: 4to pedido activo -> 409 LIMITE_PEDIDOS_ACTIVOS
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": 5 }]
								}
								""".formatted(formulaId, sedeCentroId, franja, medId)))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("LIMITE_PEDIDOS_ACTIVOS"));

		// RN-PAC-05: capacidad de franja agotada -> 409 FRANJA_SIN_CUPO
		jdbcTemplate.update("UPDATE parametro SET valor = '2' WHERE clave = 'turno.capacidad_franja'");
		try {
			String tokenP5 = login("paciente5@farmagestion.demo");
			stubFormula("FRM-2026-000501", "1000000005", "EMITIDA", LocalDate.now(ZONA_BOGOTA).plusDays(20),
					"[" + itemJson("MED-0012", "Omeprazol 20 mg", 10, 0) + "]");
			UUID formulaP5 = vincularFormula(tokenP5, "FRM-2026-000501");

			mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
							.header("Authorization", "Bearer " + tokenP5)
							.contentType(MediaType.APPLICATION_JSON)
							.content("""
									{
									  "formulaId": "%s",
									  "sedeId": "%s",
									  "modalidad": "RECOGER",
									  "franjaInicio": "%s",
									  "aceptaParcial": false,
									  "items": [{ "medicamentoId": "%s", "cantidad": 5 }]
									}
									""".formatted(formulaP5, sedeCentroId, franja, medId)))
					.andExpect(status().isConflict())
					.andExpect(jsonPath("$.code").value("FRANJA_SIN_CUPO"));
		} finally {
			jdbcTemplate.update("UPDATE parametro SET valor = '6' WHERE clave = 'turno.capacidad_franja'");
		}
	}
}
