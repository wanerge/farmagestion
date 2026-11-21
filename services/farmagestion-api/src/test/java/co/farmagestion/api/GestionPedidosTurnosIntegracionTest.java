package co.farmagestion.api;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.farmagestion.api.integracion.OutboxService;
import co.farmagestion.api.integracion.TareasProgramadas;
import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.UUID;
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
class GestionPedidosTurnosIntegracionTest {

	private static final String TEST_API_KEY = "wiremock-gestion-api-key";
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

	@Autowired
	private TareasProgramadas tareasProgramadas;

	@Autowired
	private OutboxService outboxService;

	private UUID sedeCentroId;

	@BeforeEach
	void setUp() {
		wireMock.resetAll();
		sedeCentroId = jdbcTemplate.queryForObject(
				"SELECT id FROM sede WHERE codigo = 'SEDE-CENTRO'", UUID.class);
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

	private String formulaResponseJson(
			String codigo,
			String documento,
			String estado,
			String medCodigo,
			String medNombre,
			int autorizada,
			int dispensada) {
		LocalDate hoy = LocalDate.now(ZONA_BOGOTA);
		return """
				{
				  "codigo": "%s",
				  "estado": "%s",
				  "fechaEmision": "%s",
				  "fechaVencimiento": "%s",
				  "observaciones": "Fórmula de prueba",
				  "paciente": {
				    "tipoDocumento": "CC",
				    "documento": "%s",
				    "nombres": "Ana María",
				    "apellidos": "Velásquez"
				  },
				  "medico": { "nombre": "Dra. Paula Sánchez" },
				  "items": [
				    {
				      "medicamentoCodigo": "%s",
				      "medicamentoNombre": "%s",
				      "dosis": "1 tableta",
				      "frecuencia": "cada 8 horas",
				      "duracionDias": 10,
				      "cantidadAutorizada": %d,
				      "cantidadDispensada": %d
				    }
				  ]
				}
				""".formatted(
				codigo, estado, hoy, hoy.plusDays(20), documento, medCodigo, medNombre, autorizada, dispensada);
	}

	private void stubConsultaFormula(
			String codigo,
			String documento,
			String estado,
			String medCodigo,
			String medNombre,
			int autorizada,
			int dispensada) {
		wireMock.stubFor(WireMock.get(urlPathEqualTo("/api/v1/formulas/" + codigo))
				.withHeader("X-API-Key", equalTo(TEST_API_KEY))
				.withQueryParam("documento", equalTo(documento))
				.willReturn(aResponse()
						.withStatus(200)
						.withHeader("Content-Type", "application/json")
						.withBody(formulaResponseJson(
								codigo, documento, estado, medCodigo, medNombre, autorizada, dispensada))));
	}

	private FranjaSeleccionada obtenerPrimeraFranjaDisponible(String tokenPaciente, UUID sedeId) throws Exception {
		LocalDate hoy = LocalDate.now(ZONA_BOGOTA);
		for (int delta = 0; delta <= 1; delta++) {
			LocalDate fecha = hoy.plusDays(delta);
			MvcResult res = mockMvc.perform(get("/api/v1/pacientes/me/sedes/{sedeId}/franjas", sedeId)
							.header("Authorization", "Bearer " + tokenPaciente)
							.param("fecha", fecha.toString()))
					.andExpect(status().isOk())
					.andReturn();
			JsonNode franjas = objectMapper.readTree(res.getResponse().getContentAsString()).get("franjas");
			for (JsonNode f : franjas) {
				if (f.get("disponible").asBoolean()) {
					String franjaIso = f.get("franjaInicio").asString();
					LocalDate fechaTurno = OffsetDateTime.parse(franjaIso)
							.atZoneSameInstant(ZONA_BOGOTA).toLocalDate();
					return new FranjaSeleccionada(franjaIso, fechaTurno);
				}
			}
		}
		throw new IllegalStateException("No hay franjas disponibles.");
	}

	private PedidoCreadoTest crearPedidoRecoger(
			String tokenPaciente,
			String documento,
			String codigoFormula,
			String medCodigo,
			String medNombre,
			int autorizada,
			int cantidadPedido) throws Exception {
		UUID medId = medicamentoIdPorCodigo(medCodigo);
		stubConsultaFormula(codigoFormula, documento, "EMITIDA", medCodigo, medNombre, autorizada, 0);

		MvcResult fRes = mockMvc.perform(post("/api/v1/pacientes/me/formulas")
						.header("Authorization", "Bearer " + tokenPaciente)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "codigo": "%s" }
								""".formatted(codigoFormula)))
				.andExpect(status().isCreated())
				.andReturn();
		UUID formulaId = UUID.fromString(
				objectMapper.readTree(fRes.getResponse().getContentAsString()).get("id").asString());

		FranjaSeleccionada franja = obtenerPrimeraFranjaDisponible(tokenPaciente, sedeCentroId);
		MvcResult pRes = mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + tokenPaciente)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "RECOGER",
								  "franjaInicio": "%s",
								  "aceptaParcial": false,
								  "items": [{ "medicamentoId": "%s", "cantidad": %d }]
								}
								""".formatted(formulaId, sedeCentroId, franja.iso(), medId, cantidadPedido)))
				.andExpect(status().isCreated())
				.andReturn();
		JsonNode root = objectMapper.readTree(pRes.getResponse().getContentAsString());
		return new PedidoCreadoTest(
				UUID.fromString(root.get("id").asString()),
				UUID.fromString(root.get("turno").get("id").asString()),
				root.get("turno").get("codigo").asString(),
				franja.fecha());
	}

	@Test
	void CA_EMP_04_flujoCompletoPedidoRecogerYCreacionOutbox() throws Exception {
		String tokenPaciente = login("paciente1@farmagestion.demo");
		String tokenAuxiliar = login("auxiliar.centro@farmagestion.demo");
		String tokenOtraSede = login("auxiliar.bello@farmagestion.demo");
		String tokenDomiciliario = login("domiciliario.centro@farmagestion.demo");

		UUID medId = medicamentoIdPorCodigo("MED-0004");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 40, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		PedidoCreadoTest creado = crearPedidoRecoger(
				tokenPaciente, "1000000001", "FRM-2026-000304", "MED-0004", "Losartán 50 mg", 30, 10);

		// RN-09 y 03 §3: otra sede -> 403; domiciliario -> 403
		mockMvc.perform(get("/api/v1/gestion/pedidos/{id}", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenOtraSede))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("SEDE_NO_AUTORIZADA"));
		mockMvc.perform(get("/api/v1/gestion/pedidos")
						.header("Authorization", "Bearer " + tokenDomiciliario))
				.andExpect(status().isForbidden());

		// Bandeja de pedidos (RF-EMP-08)
		mockMvc.perform(get("/api/v1/gestion/pedidos")
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.param("estado", "RESERVADO"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].id").value(creado.pedidoId().toString()));

		// 1. Tomar pedido: RESERVADO -> EN_PREPARACION
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/tomar", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "nota": "Iniciando alistamiento" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("EN_PREPARACION"))
				.andExpect(jsonPath("$.asignadoA").isNotEmpty());

		// 2. Marcar listo: EN_PREPARACION -> LISTO
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/listo", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "nota": "Empacado en mostrador 2" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("LISTO"))
				.andExpect(jsonPath("$.listoEn").isNotEmpty());

		// 3. Entregar con documento correcto: LISTO -> ENTREGADO
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/entregar", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "documentoVerificado": "1000000001", "nota": "Entregado al titular" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("ENTREGADO"))
				.andExpect(jsonPath("$.entregadoEn").isNotEmpty())
				.andExpect(jsonPath("$.turno.estado").value("ATENDIDO"))
				.andExpect(jsonPath("$.items[0].cantidadEntregada").value(10))
				.andExpect(jsonPath("$.historial.length()").value(4));

		// Verificar stock físico y reservado disminuidos
		Integer fisico = jdbcTemplate.queryForObject(
				"SELECT cantidad_fisica FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		Integer reservada = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		assertThat(fisico).isEqualTo(30);
		assertThat(reservada).isZero();

		// Verificar evento de integración en PENDIENTE con idempotency_key = pedido.id
		String estadoOutbox = jdbcTemplate.queryForObject(
				"SELECT estado FROM evento_integracion WHERE idempotency_key = ?",
				String.class, creado.pedidoId().toString());
		assertThat(estadoOutbox).isEqualTo("PENDIENTE");
	}

	@Test
	void CA_EMP_05_entregarConDocumentoIncorrectoDevuelve422YSinCambiarEstado() throws Exception {
		String tokenPaciente = login("paciente1@farmagestion.demo");
		String tokenAuxiliar = login("auxiliar.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0006");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 40, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		PedidoCreadoTest creado = crearPedidoRecoger(
				tokenPaciente, "1000000001", "FRM-2026-000305", "MED-0006", "Amlodipino 5 mg", 20, 8);

		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/tomar", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/listo", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/entregar", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "documentoVerificado": "9999999999" }
								"""))
				.andExpect(status().isUnprocessableContent())
				.andExpect(jsonPath("$.code").value("DOCUMENTO_NO_COINCIDE"));

		String estado = jdbcTemplate.queryForObject(
				"SELECT estado FROM pedido WHERE id = ?", String.class, creado.pedidoId());
		assertThat(estado).isEqualTo("LISTO");
	}

	@Test
	void CA_EMP_06_transicionInvalidaYReglaDeAsignacion() throws Exception {
		String tokenPaciente = login("paciente1@farmagestion.demo");
		String tokenAuxiliar = login("auxiliar.centro@farmagestion.demo");
		String tokenFarmaceutico = login("farmaceutico.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0008");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 40, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		PedidoCreadoTest creado = crearPedidoRecoger(
				tokenPaciente, "1000000001", "FRM-2026-000306", "MED-0008", "Metformina 850 mg", 20, 6);

		// Intentar entregar directamente desde RESERVADO -> 409 TRANSICION_INVALIDA
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/entregar", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "documentoVerificado": "1000000001" }
								"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("TRANSICION_INVALIDA"));

		// Intentar marcar listo desde RESERVADO -> 409 TRANSICION_INVALIDA
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/listo", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("TRANSICION_INVALIDA"));

		// RN-EMP-04: auxiliar toma el pedido; farmacéutico no puede marcarlo listo mientras esté EN_PREPARACION
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/tomar", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/listo", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenFarmaceutico))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("PEDIDO_ASIGNADO_A_OTRO_EMPLEADO"));

		// RF-EMP-12: cancelar desde gestión requiere motivo obligatorio
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/cancelar", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "motivo": "   " }
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDACION_ERROR"));

		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/cancelar", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "motivo": "Solicitud de cancelación en mostrador" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("CANCELADO"));
	}

	@Test
	void CA_EMP_07_simuladorCaidoOutboxReintentoExitosoYErrorDefinitivo() throws Exception {
		String tokenPaciente = login("paciente1@farmagestion.demo");
		String tokenAuxiliar = login("auxiliar.centro@farmagestion.demo");
		String tokenAdmin = login("admin@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0010");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 50, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		String codigoFormula = "FRM-2026-000307";
		PedidoCreadoTest creado = crearPedidoRecoger(
				tokenPaciente, "1000000001", codigoFormula, "MED-0010", "Atorvastatina 20 mg", 10, 10);

		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/tomar", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/listo", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk());

		// Simulador caído (503) al entregar -> la entrega igual se completa (RN-06)
		wireMock.stubFor(WireMock.post(urlPathEqualTo("/api/v1/formulas/" + codigoFormula + "/dispensaciones"))
				.willReturn(aResponse().withStatus(503).withBody("Servicio temporalmente no disponible")));

		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/entregar", creado.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "documentoVerificado": "1000000001" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("ENTREGADO"));

		// 1er intento del job mientras el simulador sigue caído -> queda PENDIENTE con intentos=1
		tareasProgramadas.reintentarOutbox();
		String estadoTrasFallo = jdbcTemplate.queryForObject(
				"SELECT estado FROM evento_integracion WHERE idempotency_key = ?",
				String.class, creado.pedidoId().toString());
		Integer intentosTrasFallo = jdbcTemplate.queryForObject(
				"SELECT intentos FROM evento_integracion WHERE idempotency_key = ?",
				Integer.class, creado.pedidoId().toString());
		assertThat(estadoTrasFallo).isEqualTo("PENDIENTE");
		assertThat(intentosTrasFallo).isEqualTo(1);

		// Espera creciente: reintento inmediato antes de 60 s no debe disparar aún
		int procesadosAntesBackoff = outboxService.procesarPendientes(Instant.now().plusSeconds(10));
		assertThat(procesadosAntesBackoff).isZero();

		// Simulador se recupera y responde 201 con la fórmula DISPENSADA
		wireMock.stubFor(WireMock.post(urlPathEqualTo("/api/v1/formulas/" + codigoFormula + "/dispensaciones"))
				.withHeader("X-API-Key", equalTo(TEST_API_KEY))
				.withHeader("Idempotency-Key", equalTo(creado.pedidoId().toString()))
				.willReturn(aResponse()
						.withStatus(201)
						.withHeader("Content-Type", "application/json")
						.withBody(formulaResponseJson(
								codigoFormula, "1000000001", "DISPENSADA",
								"MED-0010", "Atorvastatina 20 mg", 10, 10))));

		int procesadosTrasBackoff = outboxService.procesarPendientes(Instant.now().plusSeconds(120));
		assertThat(procesadosTrasBackoff).isEqualTo(1);

		String estadoFinal = jdbcTemplate.queryForObject(
				"SELECT estado FROM evento_integracion WHERE idempotency_key = ?",
				String.class, creado.pedidoId().toString());
		Integer intentosFinal = jdbcTemplate.queryForObject(
				"SELECT intentos FROM evento_integracion WHERE idempotency_key = ?",
				Integer.class, creado.pedidoId().toString());
		String estadoFormulaLocal = jdbcTemplate.queryForObject(
				"SELECT estado_externo FROM formula_ref WHERE codigo_externo = ?",
				String.class, codigoFormula);
		assertThat(estadoFinal).isEqualTo("ENVIADO");
		assertThat(intentosFinal).isEqualTo(2);
		assertThat(estadoFormulaLocal).isEqualTo("DISPENSADA");

		wireMock.verify(2, postRequestedFor(urlPathEqualTo("/api/v1/formulas/" + codigoFormula + "/dispensaciones"))
				.withHeader("X-API-Key", equalTo(TEST_API_KEY))
				.withHeader("Idempotency-Key", equalTo(creado.pedidoId().toString())));

		// Error definitivo 409 (00 §9.3, RF-EMP-27) -> ERROR inmediato + alerta para ADMIN
		String codigoError = "FRM-2026-000377";
		PedidoCreadoTest pedidoError = crearPedidoRecoger(
				tokenPaciente, "1000000001", codigoError, "MED-0010", "Atorvastatina 20 mg", 10, 5);
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/tomar", pedidoError.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/listo", pedidoError.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/entregar", pedidoError.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "documentoVerificado": "1000000001" }
								"""))
				.andExpect(status().isOk());

		wireMock.stubFor(WireMock.post(urlPathEqualTo("/api/v1/formulas/" + codigoError + "/dispensaciones"))
				.willReturn(aResponse()
						.withStatus(409)
						.withHeader("Content-Type", "application/problem+json")
						.withBody("""
								{
								  "type": "https://farmagestion.co/errores/formula-no-dispensable",
								  "title": "Fórmula no dispensable",
								  "status": 409,
								  "detail": "La fórmula fue anulada.",
								  "code": "FORMULA_NO_DISPENSABLE"
								}
								""")));

		tareasProgramadas.reintentarOutbox();

		String estadoErr = jdbcTemplate.queryForObject(
				"SELECT estado FROM evento_integracion WHERE idempotency_key = ?",
				String.class, pedidoError.pedidoId().toString());
		assertThat(estadoErr).isEqualTo("ERROR");

		mockMvc.perform(get("/api/v1/gestion/notificaciones")
						.header("Authorization", "Bearer " + tokenAdmin))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].tipo").value("INTEGRACION_ERROR"));
	}

	@Test
	void CA_EMP_09_vencimientoAutomaticoDePedidoListoPorJobYConsulta() throws Exception {
		String tokenPaciente = login("paciente1@farmagestion.demo");
		String tokenAuxiliar = login("auxiliar.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0014");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 40, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		PedidoCreadoTest pedidoJob = crearPedidoRecoger(
				tokenPaciente, "1000000001", "FRM-2026-000309", "MED-0014", "Amoxicilina 500 mg", 20, 7);
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/tomar", pedidoJob.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk());
		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/listo", pedidoJob.pedidoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk());

		// Expirar el pedido LISTO y correr ExpirarReservas (00 §11)
		jdbcTemplate.update("UPDATE pedido SET expira_en = NOW() - INTERVAL '5 minutes' WHERE id = ?",
				pedidoJob.pedidoId());

		int vencidosPrimera = tareasProgramadas.expirarReservas();
		int vencidosSegunda = tareasProgramadas.expirarReservas(); // idempotente
		assertThat(vencidosPrimera).isEqualTo(1);
		assertThat(vencidosSegunda).isZero();

		String estado = jdbcTemplate.queryForObject(
				"SELECT estado FROM pedido WHERE id = ?", String.class, pedidoJob.pedidoId());
		Integer reservada = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		assertThat(estado).isEqualTo("VENCIDO");
		assertThat(reservada).isZero();

		mockMvc.perform(get("/api/v1/pacientes/me/notificaciones")
						.header("Authorization", "Bearer " + tokenPaciente))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].tipo").value("PEDIDO_VENCIDO"));
	}

	@Test
	void CA_EMP_10_llamarSiguienteTurnoPantallaSalaVencerTurnoYSincronizarFormulas() throws Exception {
		String tokenP1 = login("paciente1@farmagestion.demo");
		String tokenP2 = login("paciente2@farmagestion.demo");
		String tokenAuxiliar = login("auxiliar.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0018");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 50, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		PedidoCreadoTest p1 = crearPedidoRecoger(
				tokenP1, "1000000001", "FRM-2026-000310", "MED-0018", "Loratadina 10 mg", 10, 5);
		PedidoCreadoTest p2 = crearPedidoRecoger(
				tokenP2, "1000000002", "FRM-2026-000311", "MED-0018", "Loratadina 10 mg", 10, 5);

		// Cola de turnos (RF-EMP-15)
		mockMvc.perform(get("/api/v1/gestion/turnos")
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.param("fecha", p1.fechaTurno().toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(2))
				.andExpect(jsonPath("$[0].estado").value("EN_ESPERA"));

		// Llamar siguiente turno (RF-EMP-16, CA-EMP-10)
		mockMvc.perform(post("/api/v1/gestion/turnos/llamar-siguiente")
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.param("fecha", p1.fechaTurno().toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(p1.turnoId().toString()))
				.andExpect(jsonPath("$.codigo").value(p1.turnoCodigo()))
				.andExpect(jsonPath("$.estado").value("LLAMADO"))
				.andExpect(jsonPath("$.llamadoEn").isNotEmpty());

		// Pantalla pública de sala SIN autenticación y SIN datos personales (RF-EMP-18, CA-EMP-10)
		MvcResult salaRes = mockMvc.perform(get("/api/v1/gestion/public/sala/SEDE-CENTRO")
						.param("fecha", p1.fechaTurno().toString()))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.sedeCodigo").value("SEDE-CENTRO"))
				.andExpect(jsonPath("$.llamados[0].codigo").value(p1.turnoCodigo()))
				.andExpect(jsonPath("$.enEspera[0].codigo").value(p2.turnoCodigo()))
				.andReturn();
		String salaJson = salaRes.getResponse().getContentAsString();
		assertThat(salaJson).doesNotContain("1000000001");
		assertThat(salaJson).doesNotContain("Velásquez");

		// Notificación TURNO_LLAMADO al paciente 1
		mockMvc.perform(get("/api/v1/pacientes/me/notificaciones")
						.header("Authorization", "Bearer " + tokenP1))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].tipo").value("TURNO_LLAMADO"));

		// RF-EMP-17: vencer turno 2 por no presentación -> pedido 2 pasa a VENCIDO y libera 5 u.
		mockMvc.perform(post("/api/v1/gestion/turnos/{id}/vencer", p2.turnoId())
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("VENCIDO"));

		String estadoP2 = jdbcTemplate.queryForObject(
				"SELECT estado FROM pedido WHERE id = ?", String.class, p2.pedidoId());
		Integer reservada = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		assertThat(estadoP2).isEqualTo("VENCIDO");
		assertThat(reservada).isEqualTo(5);

		// SincronizarFormulas (00 §11) refresca copia local de pedido activo 1
		stubConsultaFormula("FRM-2026-000310", "1000000001", "PARCIALMENTE_DISPENSADA",
				"MED-0018", "Loratadina 10 mg", 10, 4);
		int sincronizadas = tareasProgramadas.sincronizarFormulas();
		assertThat(sincronizadas).isEqualTo(1);
		String estadoExterno = jdbcTemplate.queryForObject(
				"SELECT estado_externo FROM formula_ref WHERE codigo_externo = 'FRM-2026-000310'",
				String.class);
		assertThat(estadoExterno).isEqualTo("PARCIALMENTE_DISPENSADA");

		// VencerTurnos (00 §11): turno EN_ESPERA de ayer pasa a VENCIDO y libera stock (idempotente)
		PedidoCreadoTest p3 = crearPedidoRecoger(
				tokenP2, "1000000002", "FRM-2026-000312", "MED-0018", "Loratadina 10 mg", 10, 4);
		jdbcTemplate.update(
				"UPDATE turno SET fecha = CURRENT_DATE - INTERVAL '1 day' WHERE id = ?", p3.turnoId());
		assertThat(tareasProgramadas.vencerTurnos()).isEqualTo(1);
		assertThat(tareasProgramadas.vencerTurnos()).isZero();
		String estadoTurnoP3 = jdbcTemplate.queryForObject(
				"SELECT estado FROM turno WHERE id = ?", String.class, p3.turnoId());
		String estadoPedidoP3 = jdbcTemplate.queryForObject(
				"SELECT estado FROM pedido WHERE id = ?", String.class, p3.pedidoId());
		assertThat(estadoTurnoP3).isEqualTo("VENCIDO");
		assertThat(estadoPedidoP3).isEqualTo("VENCIDO");
	}

	@Test
	void RF_EMP_13_ajusteNegativoReduceReservaDePedidoMasRecienteYNotifica() throws Exception {
		String tokenP1 = login("paciente1@farmagestion.demo");
		String tokenP2 = login("paciente2@farmagestion.demo");
		String tokenFarmaceutico = login("farmaceutico.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0019");
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 10, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		PedidoCreadoTest pedidoAntiguo = crearPedidoRecoger(
				tokenP1, "1000000001", "FRM-2026-000401", "MED-0019", "Cetirizina 10 mg", 10, 4);
		PedidoCreadoTest pedidoReciente = crearPedidoRecoger(
				tokenP2, "1000000002", "FRM-2026-000402", "MED-0019", "Cetirizina 10 mg", 10, 6);

		// Ajuste negativo de -3 (físico 10 -> 7 < 10 reservado): RN-EMP-07 reduce el pedido más reciente primero
		mockMvc.perform(post("/api/v1/gestion/inventario/{medId}/ajustes", medId)
						.header("Authorization", "Bearer " + tokenFarmaceutico)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "cantidad": -3, "motivo": "Cajas dañadas en estantería" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cantidadFisica").value(7))
				.andExpect(jsonPath("$.cantidadReservada").value(7));

		// Pedido más reciente quedó es_parcial=true y reserva reducida de 6 a 3
		Boolean parcialReciente = jdbcTemplate.queryForObject(
				"SELECT es_parcial FROM pedido WHERE id = ?", Boolean.class, pedidoReciente.pedidoId());
		Integer reservaReciente = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM pedido_item WHERE pedido_id = ?", Integer.class, pedidoReciente.pedidoId());
		Integer reservaAntiguo = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM pedido_item WHERE pedido_id = ?", Integer.class, pedidoAntiguo.pedidoId());
		assertThat(parcialReciente).isTrue();
		assertThat(reservaReciente).isEqualTo(3);
		assertThat(reservaAntiguo).isEqualTo(4);

		// Paciente del pedido afectado recibe notificación FALTANTE_DETECTADO
		mockMvc.perform(get("/api/v1/pacientes/me/notificaciones")
						.header("Authorization", "Bearer " + tokenP2))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].tipo").value("FALTANTE_DETECTADO"));
	}

	private record FranjaSeleccionada(String iso, LocalDate fecha) {
	}

	private record PedidoCreadoTest(UUID pedidoId, UUID turnoId, String turnoCodigo, LocalDate fechaTurno) {
	}
}
