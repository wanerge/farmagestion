package co.farmagestion.api;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.urlPathEqualTo;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.github.tomakehurst.wiremock.WireMockServer;
import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.core.WireMockConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
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
class DomiciliosRutasIntegrationTest {

	private static final String TEST_API_KEY = "wiremock-domicilios-api-key";
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
	private UUID domiciliarioCentroId;
	private UUID domiciliarioBelloId;

	@BeforeEach
	void setUp() {
		wireMock.resetAll();
		sedeCentroId = jdbcTemplate.queryForObject(
				"SELECT id FROM sede WHERE codigo = 'SEDE-CENTRO'", UUID.class);
		domiciliarioCentroId = jdbcTemplate.queryForObject(
				"SELECT id FROM usuario WHERE email = 'domiciliario.centro@farmagestion.demo'", UUID.class);
		domiciliarioBelloId = jdbcTemplate.queryForObject(
				"SELECT id FROM usuario WHERE email = 'domiciliario.bello@farmagestion.demo'", UUID.class);
		limpiarDatosTransaccionales();
		jdbcTemplate.update("UPDATE parametro SET valor = '8' WHERE clave = 'domicilio.max_paradas'");
		jdbcTemplate.update("UPDATE parametro SET valor = '2' WHERE clave = 'domicilio.max_intentos'");
	}

	@AfterEach
	void tearDown() {
		limpiarDatosTransaccionales();
		jdbcTemplate.update("UPDATE parametro SET valor = '8' WHERE clave = 'domicilio.max_paradas'");
		jdbcTemplate.update("UPDATE parametro SET valor = '2' WHERE clave = 'domicilio.max_intentos'");
	}

	private void limpiarDatosTransaccionales() {
		jdbcTemplate.update("DELETE FROM ruta_parada");
		jdbcTemplate.update("DELETE FROM ruta");
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

	private void stubConsultaFormula(
			String codigo,
			String documento,
			String medCodigo,
			String medNombre,
			int autorizada) {
		LocalDate hoy = LocalDate.now(ZONA_BOGOTA);
		String body = """
				{
				  "codigo": "%s",
				  "estado": "EMITIDA",
				  "fechaEmision": "%s",
				  "fechaVencimiento": "%s",
				  "observaciones": "Fórmula domicilio",
				  "paciente": {
				    "tipoDocumento": "CC",
				    "documento": "%s",
				    "nombres": "Paciente",
				    "apellidos": "Prueba"
				  },
				  "medico": { "nombre": "Dr. Luis Torres" },
				  "items": [
				    {
				      "medicamentoCodigo": "%s",
				      "medicamentoNombre": "%s",
				      "dosis": "1 tableta",
				      "frecuencia": "cada 12 horas",
				      "duracionDias": 15,
				      "cantidadAutorizada": %d,
				      "cantidadDispensada": 0
				    }
				  ]
				}
				""".formatted(codigo, hoy, hoy.plusDays(20), documento, medCodigo, medNombre, autorizada);

		wireMock.stubFor(WireMock.get(urlPathEqualTo("/api/v1/formulas/" + codigo))
				.withQueryParam("documento", equalTo(documento))
				.withHeader("X-API-Key", equalTo(TEST_API_KEY))
				.willReturn(aResponse()
						.withStatus(200)
						.withHeader("Content-Type", "application/json")
						.withBody(body)));
	}

	private UUID crearPedidoDomicilioListo(
			String tokenPaciente,
			String documentoPaciente,
			String tokenFarmaceutico,
			String codigoFormula,
			String medCodigo,
			int cantidad,
			String direccion,
			double lat,
			double lon) throws Exception {
		UUID medId = medicamentoIdPorCodigo(medCodigo);
		stubConsultaFormula(codigoFormula, documentoPaciente, medCodigo, "Acetaminofén 500 mg", Math.max(cantidad, 10));

		MvcResult vincularRes = mockMvc.perform(post("/api/v1/pacientes/me/formulas")
						.header("Authorization", "Bearer " + tokenPaciente)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "codigo": "%s" }
								""".formatted(codigoFormula)))
				.andExpect(status().isCreated())
				.andReturn();
		UUID formulaId = UUID.fromString(
				objectMapper.readTree(vincularRes.getResponse().getContentAsString()).get("id").asString());

		MvcResult pedidoRes = mockMvc.perform(post("/api/v1/pacientes/me/pedidos")
						.header("Authorization", "Bearer " + tokenPaciente)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "formulaId": "%s",
								  "sedeId": "%s",
								  "modalidad": "DOMICILIO",
								  "direccionEntrega": "%s",
								  "latitudEntrega": %s,
								  "longitudEntrega": %s,
								  "aceptaParcial": false,
								  "items": [ { "medicamentoId": "%s", "cantidad": %d } ]
								}
								""".formatted(formulaId, sedeCentroId, direccion, lat, lon, medId, cantidad)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.modalidad").value("DOMICILIO"))
				.andExpect(jsonPath("$.estado").value("RESERVADO"))
				.andReturn();
		UUID pedidoId = UUID.fromString(
				objectMapper.readTree(pedidoRes.getResponse().getContentAsString()).get("id").asString());

		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/tomar", pedidoId)
						.header("Authorization", "Bearer " + tokenFarmaceutico))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("EN_PREPARACION"));

		mockMvc.perform(post("/api/v1/gestion/pedidos/{id}/listo", pedidoId)
						.header("Authorization", "Bearer " + tokenFarmaceutico))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("LISTO"));

		return pedidoId;
	}

	@Test
	void CA_EMP_11_generarRutaConHeuristicoReordenYMaximoDeParadas() throws Exception {
		String tokenFarm = login("farmaceutico.centro@farmagestion.demo");
		// 5 pacientes semilla distintos para crear 5 pedidos DOMICILIO en LISTO con coordenadas
		String[][] pacientes = {
				{ "paciente1@farmagestion.demo", "1000000001", "FRM-DOM-11-01", "Calle 30 # 45-10", "6.228000", "-75.570000" },
				{ "paciente2@farmagestion.demo", "1000000002", "FRM-DOM-11-02", "Carrera 43A # 1-50", "6.200000", "-75.572000" },
				{ "paciente3@farmagestion.demo", "1000000003", "FRM-DOM-11-03", "Calle 50 # 47-12", "6.245000", "-75.566000" },
				{ "paciente4@farmagestion.demo", "1000000004", "FRM-DOM-11-04", "Avenida 33 # 65-20", "6.238000", "-75.580000" },
				{ "paciente5@farmagestion.demo", "1000000005", "FRM-DOM-11-05", "Calle 10 # 40-15", "6.210000", "-75.569000" }
		};

		List<UUID> pedidoIds = new ArrayList<>();
		for (String[] p : pacientes) {
			String tokenPac = login(p[0]);
			UUID pedidoId = crearPedidoDomicilioListo(
					tokenPac, p[1], tokenFarm, p[2], "MED-0001", 2,
					p[3], Double.parseDouble(p[4]), Double.parseDouble(p[5]));
			pedidoIds.add(pedidoId);
		}

		// Consultar pendientes de domicilio en SEDE-CENTRO
		mockMvc.perform(get("/api/v1/gestion/domicilios/pendientes")
						.header("Authorization", "Bearer " + tokenFarm))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.sedeCodigo").value("SEDE-CENTRO"))
				.andExpect(jsonPath("$.maxParadas").value(8))
				.andExpect(jsonPath("$.pedidos.length()").value(5))
				.andExpect(jsonPath("$.domiciliarios[0].usuarioId").value(domiciliarioCentroId.toString()));

		// Verificar respeto de domicilio.max_paradas (bajamos temporalmente a 4 -> 5 pedidos deben rechazarse con 422)
		jdbcTemplate.update("UPDATE parametro SET valor = '4' WHERE clave = 'domicilio.max_paradas'");
		String bodyCrear5 = objectMapper.writeValueAsString(
				new java.util.LinkedHashMap<String, Object>() {
					{
						put("domiciliarioId", domiciliarioCentroId);
						put("pedidoIds", pedidoIds);
					}
				});

		mockMvc.perform(post("/api/v1/gestion/rutas")
						.header("Authorization", "Bearer " + tokenFarm)
						.contentType(MediaType.APPLICATION_JSON)
						.content(bodyCrear5))
				.andExpect(status().isUnprocessableContent())
				.andExpect(jsonPath("$.code").value("MAX_PARADAS_EXCEDIDO"));

		// Restaurar max_paradas = 8 y crear la ruta con los 5 pedidos
		jdbcTemplate.update("UPDATE parametro SET valor = '8' WHERE clave = 'domicilio.max_paradas'");

		MvcResult crearRes = mockMvc.perform(post("/api/v1/gestion/rutas")
						.header("Authorization", "Bearer " + tokenFarm)
						.contentType(MediaType.APPLICATION_JSON)
						.content(bodyCrear5))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.estado").value("PLANEADA"))
				.andExpect(jsonPath("$.paradas.length()").value(5))
				.andExpect(jsonPath("$.paradas[0].orden").value(1))
				.andExpect(jsonPath("$.paradas[4].orden").value(5))
				.andReturn();

		JsonNode rutaJson = objectMapper.readTree(crearRes.getResponse().getContentAsString());
		UUID rutaId = UUID.fromString(rutaJson.get("id").asString());
		BigDecimal distanciaTotal = new BigDecimal(rutaJson.get("distanciaKm").asString());
		assertThat(distanciaTotal).isGreaterThan(BigDecimal.ZERO);

		// La suma de los tramos debe coincidir con la distancia total y el primer punto debe ser el más cercano (Calle 50 # 47-12)
		BigDecimal sumaTramos = BigDecimal.ZERO;
		List<UUID> paradaIds = new ArrayList<>();
		for (JsonNode parada : rutaJson.get("paradas")) {
			sumaTramos = sumaTramos.add(new BigDecimal(parada.get("distanciaKmDesdeAnterior").asString()));
			paradaIds.add(UUID.fromString(parada.get("id").asString()));
		}
		assertThat(distanciaTotal).isEqualByComparingTo(sumaTramos);
		assertThat(rutaJson.get("paradas").get(0).get("pedidoId").asString()).isEqualTo(pedidoIds.get(2).toString());

		// RN-EMP-06: intentar incluir un pedido que ya está en ruta activa responde 409 PEDIDO_YA_EN_RUTA_ACTIVA
		mockMvc.perform(post("/api/v1/gestion/rutas")
						.header("Authorization", "Bearer " + tokenFarm)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "domiciliarioId": "%s",
								  "pedidoIds": ["%s"]
								}
								""".formatted(domiciliarioCentroId, pedidoIds.get(0))))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("PEDIDO_YA_EN_RUTA_ACTIVA"));

		// Los 5 pedidos ya no aparecen en pendientes porque están en una ruta activa
		mockMvc.perform(get("/api/v1/gestion/domicilios/pendientes")
						.header("Authorization", "Bearer " + tokenFarm))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pedidos.length()").value(0));

		// RF-EMP-21: reordenar manualmente las paradas antes de iniciar la ruta (invertir orden)
		List<UUID> invertidas = new ArrayList<>(paradaIds);
		java.util.Collections.reverse(invertidas);
		String bodyReorden = objectMapper.writeValueAsString(java.util.Map.of("paradaIds", invertidas));

		MvcResult reordenRes = mockMvc.perform(put("/api/v1/gestion/rutas/{id}/orden", rutaId)
						.header("Authorization", "Bearer " + tokenFarm)
						.contentType(MediaType.APPLICATION_JSON)
						.content(bodyReorden))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paradas[0].id").value(invertidas.get(0).toString()))
				.andExpect(jsonPath("$.paradas[0].orden").value(1))
				.andExpect(jsonPath("$.paradas[4].id").value(invertidas.get(4).toString()))
				.andExpect(jsonPath("$.paradas[4].orden").value(5))
				.andReturn();

		JsonNode rutaReordenada = objectMapper.readTree(reordenRes.getResponse().getContentAsString());
		BigDecimal nuevaDistancia = new BigDecimal(rutaReordenada.get("distanciaKm").asString());
		assertThat(nuevaDistancia).isGreaterThan(BigDecimal.ZERO);
	}

	@Test
	void CA_PAC_10_domicilioEnRutaNotificacionYEntregaCompleta() throws Exception {
		String tokenPac = login("paciente1@farmagestion.demo");
		String tokenFarm = login("farmaceutico.centro@farmagestion.demo");
		String tokenDom = login("domiciliario.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0001");

		Integer fisicoInicial = jdbcTemplate.queryForObject(
				"SELECT cantidad_fisica FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);

		UUID pedidoId = crearPedidoDomicilioListo(
				tokenPac, "1000000001", tokenFarm, "FRM-DOM-PAC10", "MED-0001", 3,
				"Carrera 45 # 20-15, Medellín", 6.235000, -75.568000);

		// Crear ruta PLANEADA
		MvcResult crearRes = mockMvc.perform(post("/api/v1/gestion/rutas")
						.header("Authorization", "Bearer " + tokenFarm)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "domiciliarioId": "%s",
								  "pedidoIds": ["%s"]
								}
								""".formatted(domiciliarioCentroId, pedidoId)))
				.andExpect(status().isCreated())
				.andReturn();
		JsonNode rutaCreada = objectMapper.readTree(crearRes.getResponse().getContentAsString());
		UUID rutaId = UUID.fromString(rutaCreada.get("id").asString());
		UUID paradaId = UUID.fromString(rutaCreada.get("paradas").get(0).get("id").asString());

		// Iniciar ruta -> ruta EN_CURSO, pedido EN_RUTA, notificación PEDIDO_EN_RUTA para paciente
		mockMvc.perform(post("/api/v1/gestion/rutas/{id}/iniciar", rutaId)
						.header("Authorization", "Bearer " + tokenFarm))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("EN_CURSO"))
				.andExpect(jsonPath("$.paradas[0].estadoPedido").value("EN_RUTA"));

		// CA-PAC-10: el paciente consulta el detalle y ve EN_RUTA + información de ruta
		mockMvc.perform(get("/api/v1/pacientes/me/pedidos/{id}", pedidoId)
						.header("Authorization", "Bearer " + tokenPac))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("EN_RUTA"))
				.andExpect(jsonPath("$.modalidad").value("DOMICILIO"))
				.andExpect(jsonPath("$.direccionEntrega").value("Carrera 45 # 20-15, Medellín"))
				.andExpect(jsonPath("$.ruta.rutaId").value(rutaId.toString()))
				.andExpect(jsonPath("$.ruta.estadoRuta").value("EN_CURSO"));

		// El paciente recibió notificación PEDIDO_EN_RUTA
		mockMvc.perform(get("/api/v1/pacientes/me/notificaciones")
						.header("Authorization", "Bearer " + tokenPac))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].tipo").value("PEDIDO_EN_RUTA"));

		// RN-PAC-06: el paciente NO puede cancelar un pedido EN_RUTA
		mockMvc.perform(post("/api/v1/pacientes/me/pedidos/{id}/cancelar", pedidoId)
						.header("Authorization", "Bearer " + tokenPac)
						.contentType(MediaType.APPLICATION_JSON)
						.content("{}"))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("TRANSICION_INVALIDA"));

		// RF-EMP-22: el domiciliario ve su ruta del día y marca la parada como ENTREGADA
		mockMvc.perform(get("/api/v1/gestion/rutas/mias")
						.header("Authorization", "Bearer " + tokenDom))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(1))
				.andExpect(jsonPath("$[0].id").value(rutaId.toString()));

		mockMvc.perform(post("/api/v1/gestion/rutas/{id}/paradas/{paradaId}/entregar", rutaId, paradaId)
						.header("Authorization", "Bearer " + tokenDom)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "nota": "Entregado en portería" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("COMPLETADA"))
				.andExpect(jsonPath("$.paradas[0].estado").value("ENTREGADA"))
				.andExpect(jsonPath("$.paradas[0].estadoPedido").value("ENTREGADO"));

		// Verificar dispensación en inventario y evento en outbox (RN-06)
		Integer fisicoDespues = jdbcTemplate.queryForObject(
				"SELECT cantidad_fisica FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		Integer reservadoDespues = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		Integer outboxPendiente = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM evento_integracion WHERE idempotency_key = ? AND estado = 'PENDIENTE'",
				Integer.class, pedidoId.toString());

		assertThat(fisicoDespues).isEqualTo(fisicoInicial - 3);
		assertThat(reservadoDespues).isZero();
		assertThat(outboxPendiente).isEqualTo(1);
	}

	@Test
	void CA_EMP_12_paradaFallidaReintentoYCancelacionAlAgotarIntentos() throws Exception {
		String tokenPac = login("paciente2@farmagestion.demo");
		String tokenFarm = login("farmaceutico.centro@farmagestion.demo");
		String tokenDom = login("domiciliario.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0001");

		UUID pedidoId = crearPedidoDomicilioListo(
				tokenPac, "1000000002", tokenFarm, "FRM-DOM-EMP12", "MED-0001", 4,
				"Calle 44 # 70-10, Medellín", 6.246000, -75.590000);

		// --- Intento 1: crear ruta 1, iniciar y marcar fallida ---
		MvcResult ruta1Res = mockMvc.perform(post("/api/v1/gestion/rutas")
						.header("Authorization", "Bearer " + tokenFarm)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "domiciliarioId": "%s",
								  "pedidoIds": ["%s"]
								}
								""".formatted(domiciliarioCentroId, pedidoId)))
				.andExpect(status().isCreated())
				.andReturn();
		JsonNode ruta1 = objectMapper.readTree(ruta1Res.getResponse().getContentAsString());
		UUID ruta1Id = UUID.fromString(ruta1.get("id").asString());
		UUID parada1Id = UUID.fromString(ruta1.get("paradas").get(0).get("id").asString());

		mockMvc.perform(post("/api/v1/gestion/rutas/{id}/iniciar", ruta1Id)
						.header("Authorization", "Bearer " + tokenFarm))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/gestion/rutas/{id}/paradas/{paradaId}/fallida", ruta1Id, parada1Id)
						.header("Authorization", "Bearer " + tokenDom)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "motivo": "No había nadie en la dirección" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("COMPLETADA"))
				.andExpect(jsonPath("$.paradas[0].estado").value("FALLIDA"))
				.andExpect(jsonPath("$.paradas[0].estadoPedido").value("LISTO"))
				.andExpect(jsonPath("$.paradas[0].intentosEntrega").value(1));

		// El stock sigue reservado después del intento 1 (1 < max_intentos = 2)
		Integer reservadoTrasIntento1 = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		assertThat(reservadoTrasIntento1).isEqualTo(4);

		// El pedido vuelve a aparecer en pendientes de domicilio
		mockMvc.perform(get("/api/v1/gestion/domicilios/pendientes")
						.header("Authorization", "Bearer " + tokenFarm))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.pedidos.length()").value(1))
				.andExpect(jsonPath("$.pedidos[0].id").value(pedidoId.toString()))
				.andExpect(jsonPath("$.pedidos[0].intentosEntrega").value(1));

		// --- Intento 2 (CA-EMP-12): con intentos_entrega = 1 y domicilio.max_intentos = 2 ---
		MvcResult ruta2Res = mockMvc.perform(post("/api/v1/gestion/rutas")
						.header("Authorization", "Bearer " + tokenFarm)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "domiciliarioId": "%s",
								  "pedidoIds": ["%s"]
								}
								""".formatted(domiciliarioCentroId, pedidoId)))
				.andExpect(status().isCreated())
				.andReturn();
		JsonNode ruta2 = objectMapper.readTree(ruta2Res.getResponse().getContentAsString());
		UUID ruta2Id = UUID.fromString(ruta2.get("id").asString());
		UUID parada2Id = UUID.fromString(ruta2.get("paradas").get(0).get("id").asString());

		mockMvc.perform(post("/api/v1/gestion/rutas/{id}/iniciar", ruta2Id)
						.header("Authorization", "Bearer " + tokenFarm))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/gestion/rutas/{id}/paradas/{paradaId}/fallida", ruta2Id, parada2Id)
						.header("Authorization", "Bearer " + tokenDom)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "motivo": "Dirección sin respuesta en segundo intento" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("COMPLETADA"))
				.andExpect(jsonPath("$.paradas[0].estado").value("FALLIDA"))
				.andExpect(jsonPath("$.paradas[0].estadoPedido").value("CANCELADO"))
				.andExpect(jsonPath("$.paradas[0].intentosEntrega").value(2));

		// Verificar que el pedido quedó CANCELADO, se liberó el stock y se notificó al paciente
		Integer reservadoTrasIntento2 = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		Integer movimientosLiberacion = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM movimiento_inventario WHERE referencia_id = ? AND tipo = 'LIBERACION'",
				Integer.class, pedidoId);

		assertThat(reservadoTrasIntento2).isZero();
		assertThat(movimientosLiberacion).isEqualTo(1);

		mockMvc.perform(get("/api/v1/pacientes/me/pedidos/{id}", pedidoId)
						.header("Authorization", "Bearer " + tokenPac))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("CANCELADO"))
				.andExpect(jsonPath("$.intentosEntrega").value(2));

		mockMvc.perform(get("/api/v1/pacientes/me/notificaciones")
						.header("Authorization", "Bearer " + tokenPac))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].tipo").value("PEDIDO_CANCELADO"));
	}

	@Test
	void CA_EMP_13_permisosDeDomiciliario() throws Exception {
		String tokenPac = login("paciente3@farmagestion.demo");
		String tokenFarmCentro = login("farmaceutico.centro@farmagestion.demo");
		String tokenAuxCentro = login("auxiliar.centro@farmagestion.demo");
		String tokenDomCentro = login("domiciliario.centro@farmagestion.demo");
		String tokenDomBello = login("domiciliario.bello@farmagestion.demo");

		UUID pedidoId = crearPedidoDomicilioListo(
				tokenPac, "1000000003", tokenFarmCentro, "FRM-DOM-EMP13", "MED-0001", 2,
				"Carrera 50 # 30-20, Medellín", 6.231000, -75.571000);

		MvcResult crearRes = mockMvc.perform(post("/api/v1/gestion/rutas")
						.header("Authorization", "Bearer " + tokenFarmCentro)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "domiciliarioId": "%s",
								  "pedidoIds": ["%s"]
								}
								""".formatted(domiciliarioCentroId, pedidoId)))
				.andExpect(status().isCreated())
				.andReturn();
		JsonNode ruta = objectMapper.readTree(crearRes.getResponse().getContentAsString());
		UUID rutaId = UUID.fromString(ruta.get("id").asString());
		UUID paradaId = UUID.fromString(ruta.get("paradas").get(0).get("id").asString());

		mockMvc.perform(post("/api/v1/gestion/rutas/{id}/iniciar", rutaId)
						.header("Authorization", "Bearer " + tokenFarmCentro))
				.andExpect(status().isOk());

		// 1. Domiciliario NO puede consultar inventario -> 403
		mockMvc.perform(get("/api/v1/gestion/inventario")
						.header("Authorization", "Bearer " + tokenDomCentro))
				.andExpect(status().isForbidden());

		// 2. Domiciliario NO puede consultar bandeja de pedidos ni pendientes de domicilios -> 403
		mockMvc.perform(get("/api/v1/gestion/pedidos")
						.header("Authorization", "Bearer " + tokenDomCentro))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/v1/gestion/domicilios/pendientes")
						.header("Authorization", "Bearer " + tokenDomCentro))
				.andExpect(status().isForbidden());

		// 3. Otro domiciliario (Bello) NO puede consultar ni operar una ruta que no tiene asignada -> 403
		mockMvc.perform(get("/api/v1/gestion/rutas/{id}", rutaId)
						.header("Authorization", "Bearer " + tokenDomBello))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("RUTA_NO_ASIGNADA"));

		mockMvc.perform(post("/api/v1/gestion/rutas/{id}/paradas/{paradaId}/entregar", rutaId, paradaId)
						.header("Authorization", "Bearer " + tokenDomBello))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("RUTA_NO_ASIGNADA"));

		mockMvc.perform(post("/api/v1/gestion/rutas/{id}/paradas/{paradaId}/fallida", rutaId, paradaId)
						.header("Authorization", "Bearer " + tokenDomBello)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "motivo": "Intento no autorizado" }
								"""))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("RUTA_NO_ASIGNADA"));

		// 4. Auxiliar NO puede armar rutas (03 §3) y farmacéutico NO puede ejecutar paradas de ruta -> 403
		mockMvc.perform(get("/api/v1/gestion/domicilios/pendientes")
						.header("Authorization", "Bearer " + tokenAuxCentro))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/v1/gestion/rutas/mias")
						.header("Authorization", "Bearer " + tokenFarmCentro))
				.andExpect(status().isForbidden());
		mockMvc.perform(post("/api/v1/gestion/rutas/{id}/paradas/{paradaId}/entregar", rutaId, paradaId)
						.header("Authorization", "Bearer " + tokenFarmCentro))
				.andExpect(status().isForbidden());

		// 5. El domiciliario asignado SÍ puede consultar su ruta
		mockMvc.perform(get("/api/v1/gestion/rutas/{id}", rutaId)
						.header("Authorization", "Bearer " + tokenDomCentro))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.id").value(rutaId.toString()))
				.andExpect(jsonPath("$.domiciliarioId").value(domiciliarioCentroId.toString()));

		assertThat(domiciliarioBelloId).isNotEqualTo(domiciliarioCentroId);
	}
}
