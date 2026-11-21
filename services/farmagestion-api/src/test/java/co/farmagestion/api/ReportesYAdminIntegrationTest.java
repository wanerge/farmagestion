package co.farmagestion.api;

import static com.github.tomakehurst.wiremock.client.WireMock.aResponse;
import static com.github.tomakehurst.wiremock.client.WireMock.equalTo;
import static com.github.tomakehurst.wiremock.client.WireMock.postRequestedFor;
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
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
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
class ReportesYAdminIntegrationTest {

	private static final String TEST_API_KEY = "wiremock-admin-reportes-api-key";
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
	private UUID sedeBelloId;
	private UUID paciente1Id;
	private UUID med1Id;
	private UUID med2Id;

	@BeforeEach
	void setUp() {
		wireMock.resetAll();
		sedeCentroId = jdbcTemplate.queryForObject(
				"SELECT id FROM sede WHERE codigo = 'SEDE-CENTRO'", UUID.class);
		sedeBelloId = jdbcTemplate.queryForObject(
				"SELECT id FROM sede WHERE codigo = 'SEDE-BELLO'", UUID.class);
		paciente1Id = jdbcTemplate.queryForObject(
				"SELECT id FROM usuario WHERE email = 'paciente1@farmagestion.demo'", UUID.class);
		med1Id = jdbcTemplate.queryForObject(
				"SELECT id FROM medicamento WHERE codigo = 'MED-0001'", UUID.class);
		med2Id = jdbcTemplate.queryForObject(
				"SELECT id FROM medicamento WHERE codigo = 'MED-0002'", UUID.class);
		limpiarDatosDePrueba();
	}

	@AfterEach
	void tearDown() {
		limpiarDatosDePrueba();
	}

	private void limpiarDatosDePrueba() {
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
		jdbcTemplate.update("DELETE FROM movimiento_inventario WHERE motivo LIKE 'TEST-P11%'");
		jdbcTemplate.update("DELETE FROM inventario WHERE medicamento_id IN (SELECT id FROM medicamento WHERE codigo LIKE 'MED-P11%')");
		jdbcTemplate.update("DELETE FROM medicamento WHERE codigo LIKE 'MED-P11%'");
		jdbcTemplate.update("DELETE FROM inventario WHERE sede_id IN (SELECT id FROM sede WHERE codigo LIKE 'SEDE-P11%')");
		jdbcTemplate.update("DELETE FROM empleado WHERE usuario_id IN (SELECT id FROM usuario WHERE email LIKE '%@p11.demo')");
		jdbcTemplate.update("DELETE FROM usuario WHERE email LIKE '%@p11.demo'");
		jdbcTemplate.update("DELETE FROM sede WHERE codigo LIKE 'SEDE-P11%'");
		jdbcTemplate.update("UPDATE parametro SET valor = '10' WHERE clave = 'inventario.stock_minimo_default'");
		jdbcTemplate.update("UPDATE parametro SET valor = '8' WHERE clave = 'domicilio.max_paradas'");
	}

	private String login(String email) throws Exception {
		return login(email, "Farma2026!");
	}

	private String login(String email, String password) throws Exception {
		MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"email":"%s","password":"%s"}
								""".formatted(email, password)))
				.andExpect(status().isOk())
				.andReturn();
		return objectMapper.readTree(res.getResponse().getContentAsString()).get("accessToken").asText();
	}

	@Test
	void CA_EMP_14_reporteTiemposYReportesAgregadosPorSedeYRango() throws Exception {
		String tokenFarmCentro = login("farmaceutico.centro@farmagestion.demo");
		String tokenAuxCentro = login("auxiliar.centro@farmagestion.demo");
		String tokenDomCentro = login("domiciliario.centro@farmagestion.demo");
		String tokenAdmin = login("admin@farmagestion.demo");

		LocalDate hoy = LocalDate.now(ZONA_BOGOTA);
		LocalDate ayer = hoy.minusDays(1);
		ZonedDateTime baseHoy = hoy.atTime(9, 0).atZone(ZONA_BOGOTA);
		ZonedDateTime baseAyer = ayer.atTime(10, 0).atZone(ZONA_BOGOTA);

		UUID formulaId = UUID.randomUUID();
		jdbcTemplate.update("""
				INSERT INTO formula_ref (id, codigo_externo, paciente_id, estado_externo, fecha_emision, fecha_vencimiento)
				VALUES (?, 'FRM-P11-0001', ?, 'EMITIDA', ?, ?)
				""", formulaId, paciente1Id, ayer, hoy.plusDays(20));

		// Pedido 1 (SEDE-CENTRO, RECOGER, ENTREGADO ayer): 10 min preparación, 20 min entrega (30 min total)
		UUID p1 = UUID.randomUUID();
		Instant p1Created = baseAyer.toInstant();
		Instant p1Listo = baseAyer.plusMinutes(10).toInstant();
		Instant p1Entregado = baseAyer.plusMinutes(30).toInstant();
		jdbcTemplate.update("""
				INSERT INTO pedido (id, codigo, paciente_id, formula_ref_id, sede_id, modalidad, estado, es_parcial,
				                    intentos_entrega, expira_en, created_at, updated_at, listo_en, entregado_en)
				VALUES (?, 'PED-P11-001', ?, ?, ?, 'RECOGER', 'ENTREGADO', FALSE, 0, ?, ?, ?, ?, ?)
				""",
				p1, paciente1Id, formulaId, sedeCentroId,
				Timestamp.from(p1Created.plusSeconds(3600)),
				Timestamp.from(p1Created),
				Timestamp.from(p1Entregado),
				Timestamp.from(p1Listo),
				Timestamp.from(p1Entregado));
		jdbcTemplate.update("""
				INSERT INTO pedido_item (pedido_id, medicamento_id, cantidad_solicitada, cantidad_reservada, cantidad_entregada, estado_item)
				VALUES (?, ?, 20, 20, 20, 'COMPLETO')
				""", p1, med1Id);
		jdbcTemplate.update("""
				INSERT INTO turno (pedido_id, sede_id, fecha, franja_inicio, numero, codigo, estado, llamado_en, atendido_en)
				VALUES (?, ?, ?, '09:00', 1, 'CEN-001', 'ATENDIDO', ?, ?)
				""", p1, sedeCentroId, ayer, Timestamp.from(p1Listo), Timestamp.from(p1Entregado));

		// Pedido 2 (SEDE-CENTRO, DOMICILIO, ENTREGADO hoy): 30 min preparación, 40 min entrega (70 min total)
		UUID p2 = UUID.randomUUID();
		Instant p2Created = baseHoy.toInstant();
		Instant p2Listo = baseHoy.plusMinutes(30).toInstant();
		Instant p2Entregado = baseHoy.plusMinutes(70).toInstant();
		jdbcTemplate.update("""
				INSERT INTO pedido (id, codigo, paciente_id, formula_ref_id, sede_id, modalidad, estado, es_parcial,
				                    intentos_entrega, expira_en, created_at, updated_at, listo_en, entregado_en)
				VALUES (?, 'PED-P11-002', ?, ?, ?, 'DOMICILIO', 'ENTREGADO', TRUE, 0, ?, ?, ?, ?, ?)
				""",
				p2, paciente1Id, formulaId, sedeCentroId,
				Timestamp.from(p2Created.plusSeconds(7200)),
				Timestamp.from(p2Created),
				Timestamp.from(p2Entregado),
				Timestamp.from(p2Listo),
				Timestamp.from(p2Entregado));
		// Ítem parcial (faltan 12 unidades de med2)
		jdbcTemplate.update("""
				INSERT INTO pedido_item (pedido_id, medicamento_id, cantidad_solicitada, cantidad_reservada, cantidad_entregada, estado_item)
				VALUES (?, ?, 30, 18, 18, 'PARCIAL')
				""", p2, med2Id);

		// Pedido 3 (SEDE-CENTRO, RECOGER, CANCELADO hoy) con turno CANCELADO en misma franja
		UUID p3 = UUID.randomUUID();
		jdbcTemplate.update("""
				INSERT INTO pedido (id, codigo, paciente_id, formula_ref_id, sede_id, modalidad, estado, es_parcial,
				                    intentos_entrega, expira_en, created_at, updated_at)
				VALUES (?, 'PED-P11-003', ?, ?, ?, 'RECOGER', 'CANCELADO', FALSE, 0, ?, ?, ?)
				""",
				p3, paciente1Id, formulaId, sedeCentroId,
				Timestamp.from(p2Created.plusSeconds(3600)),
				Timestamp.from(p2Created),
				Timestamp.from(p2Created.plusSeconds(600)));
		jdbcTemplate.update("""
				INSERT INTO turno (pedido_id, sede_id, fecha, franja_inicio, numero, codigo, estado)
				VALUES (?, ?, ?, '09:00', 2, 'CEN-002', 'CANCELADO')
				""", p3, sedeCentroId, hoy);

		// Pedido 4 en otra sede (SEDE-BELLO) para validar aislamiento RN-09
		UUID p4 = UUID.randomUUID();
		Instant p4Created = baseHoy.toInstant();
		Instant p4Listo = baseHoy.plusMinutes(100).toInstant();
		Instant p4Entregado = baseHoy.plusMinutes(200).toInstant();
		jdbcTemplate.update("""
				INSERT INTO pedido (id, codigo, paciente_id, formula_ref_id, sede_id, modalidad, estado, es_parcial,
				                    intentos_entrega, expira_en, created_at, updated_at, listo_en, entregado_en)
				VALUES (?, 'PED-P11-004', ?, ?, ?, 'RECOGER', 'ENTREGADO', FALSE, 0, ?, ?, ?, ?, ?)
				""",
				p4, paciente1Id, formulaId, sedeBelloId,
				Timestamp.from(p4Created.plusSeconds(7200)),
				Timestamp.from(p4Created),
				Timestamp.from(p4Entregado),
				Timestamp.from(p4Listo),
				Timestamp.from(p4Entregado));

		// 1. CA-EMP-14: Farmacéutico de SEDE-CENTRO consulta reporte de tiempos
		mockMvc.perform(get("/api/v1/gestion/reportes/tiempos")
						.param("desde", ayer.toString())
						.param("hasta", hoy.toString())
						.header("Authorization", "Bearer " + tokenFarmCentro))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.sedeId").value(sedeCentroId.toString()))
				.andExpect(jsonPath("$.cantidadPedidosEntregados").value(2))
				.andExpect(jsonPath("$.promedioPreparacionMin").value(20.0))
				.andExpect(jsonPath("$.promedioEntregaMin").value(30.0))
				.andExpect(jsonPath("$.promedioTotalMin").value(50.0))
				.andExpect(jsonPath("$.porDia.length()").value(2))
				.andExpect(jsonPath("$.porModalidad.length()").value(2));

		// 2. Reporte de pedidos (SEDE-CENTRO: 3 pedidos = 2 ENTREGADO + 1 CANCELADO)
		mockMvc.perform(get("/api/v1/gestion/reportes/pedidos")
						.param("desde", ayer.toString())
						.param("hasta", hoy.toString())
						.header("Authorization", "Bearer " + tokenFarmCentro))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalPedidos").value(3))
				.andExpect(jsonPath("$.totalEntregados").value(2))
				.andExpect(jsonPath("$.totalCancelados").value(1))
				.andExpect(jsonPath("$.porDia.length()").value(2));

		// 3. Reporte de turnos por franja (SEDE-CENTRO: franja 09:00 tiene 2 turnos: 1 ATENDIDO, 1 CANCELADO)
		mockMvc.perform(get("/api/v1/gestion/reportes/turnos")
						.param("desde", ayer.toString())
						.param("hasta", hoy.toString())
						.header("Authorization", "Bearer " + tokenFarmCentro))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalTurnos").value(2))
				.andExpect(jsonPath("$.totalAtendidos").value(1))
				.andExpect(jsonPath("$.totalCancelados").value(1))
				.andExpect(jsonPath("$.porFranja[0].franjaInicio").value("09:00"))
				.andExpect(jsonPath("$.porFranja[0].atendidos").value(1));

		// 4. Reporte de faltantes (med2 lidera con 12 unidades faltantes)
		mockMvc.perform(get("/api/v1/gestion/reportes/faltantes")
						.param("desde", ayer.toString())
						.param("hasta", hoy.toString())
						.header("Authorization", "Bearer " + tokenFarmCentro))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.items[0].medicamentoCodigo").value("MED-0002"))
				.andExpect(jsonPath("$.items[0].vecesFaltante").value(1))
				.andExpect(jsonPath("$.items[0].unidadesFaltantes").value(12));

		// 5. ADMIN consulta todas las sedes (incluye pedido 4 de SEDE-BELLO -> 3 entregados)
		mockMvc.perform(get("/api/v1/gestion/reportes/tiempos")
						.param("desde", ayer.toString())
						.param("hasta", hoy.toString())
						.header("Authorization", "Bearer " + tokenAdmin))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cantidadPedidosEntregados").value(3));

		// 6. RN-09: Farmacéutico de SEDE-CENTRO intentando ver reportes de SEDE-BELLO -> 403
		mockMvc.perform(get("/api/v1/gestion/reportes/tiempos")
						.param("sedeId", sedeBelloId.toString())
						.header("Authorization", "Bearer " + tokenFarmCentro))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("SEDE_NO_AUTORIZADA"));

		// 7. Matriz 03 §3: Auxiliar y Domiciliario reciben 403 en reportes
		mockMvc.perform(get("/api/v1/gestion/reportes/tiempos")
						.header("Authorization", "Bearer " + tokenAuxCentro))
				.andExpect(status().isForbidden());
		mockMvc.perform(get("/api/v1/gestion/reportes/pedidos")
						.header("Authorization", "Bearer " + tokenDomCentro))
				.andExpect(status().isForbidden());
	}

	@Test
	void controlAcceso403EnAdminParaCualquierEmpleadoNoAdmin() throws Exception {
		List<String> tokensNoAdmin = List.of(
				login("farmaceutico.centro@farmagestion.demo"),
				login("auxiliar.centro@farmagestion.demo"),
				login("domiciliario.centro@farmagestion.demo"),
				login("paciente1@farmagestion.demo"));

		UUID randomId = UUID.randomUUID();

		for (String token : tokensNoAdmin) {
			mockMvc.perform(get("/api/v1/gestion/admin/sedes")
							.header("Authorization", "Bearer " + token))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));

			mockMvc.perform(post("/api/v1/gestion/admin/sedes")
							.header("Authorization", "Bearer " + token)
							.contentType(MediaType.APPLICATION_JSON)
							.content("{}"))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));

			mockMvc.perform(get("/api/v1/gestion/admin/empleados")
							.header("Authorization", "Bearer " + token))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));

			mockMvc.perform(get("/api/v1/gestion/admin/medicamentos")
							.header("Authorization", "Bearer " + token))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));

			mockMvc.perform(get("/api/v1/gestion/admin/parametros")
							.header("Authorization", "Bearer " + token))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));

			mockMvc.perform(put("/api/v1/gestion/admin/parametros")
							.header("Authorization", "Bearer " + token)
							.contentType(MediaType.APPLICATION_JSON)
							.content("{}"))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));

			mockMvc.perform(get("/api/v1/gestion/admin/integracion/eventos")
							.header("Authorization", "Bearer " + token))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));

			mockMvc.perform(post("/api/v1/gestion/admin/integracion/eventos/{id}/reintentar", randomId)
							.header("Authorization", "Bearer " + token))
					.andExpect(status().isForbidden())
					.andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));
		}
	}

	@Test
	void RF_EMP_30_a_33_administracionSedesEmpleadosCatalogoYParametros() throws Exception {
		String tokenAdmin = login("admin@farmagestion.demo");

		// RF-EMP-33: Consultar y editar parámetros (00 §6.3)
		mockMvc.perform(get("/api/v1/gestion/admin/parametros")
						.header("Authorization", "Bearer " + tokenAdmin))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(8));

		mockMvc.perform(put("/api/v1/gestion/admin/parametros")
						.header("Authorization", "Bearer " + tokenAdmin)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "parametros": [
								    { "clave": "inventario.stock_minimo_default", "valor": "15" },
								    { "clave": "domicilio.max_paradas", "valor": "10" }
								  ]
								}
								"""))
				.andExpect(status().isOk());

		// Validación de valor inválido -> 400
		mockMvc.perform(put("/api/v1/gestion/admin/parametros/domicilio.max_paradas")
						.header("Authorization", "Bearer " + tokenAdmin)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "valor": "0" }
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("PARAMETRO_VALOR_INVALIDO"));

		// RF-EMP-30: Crear sede inactiva + crear sede activa y editar/desactivar
		MvcResult resSedeInactiva = mockMvc.perform(post("/api/v1/gestion/admin/sedes")
						.header("Authorization", "Bearer " + tokenAdmin)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "codigo": "SEDE-P11-INACTIVA",
								  "nombre": "FarmaGestión Envigado Sur",
								  "direccion": "Carrera 43A # 30-10",
								  "latitud": 6.170000,
								  "longitud": -75.590000,
								  "horaApertura": "07:00",
								  "horaCierre": "18:00",
								  "activa": false
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.activa").value(false))
				.andReturn();
		UUID sedeInactivaId = UUID.fromString(
				objectMapper.readTree(resSedeInactiva.getResponse().getContentAsString()).get("id").asText());

		MvcResult resSedeActiva = mockMvc.perform(post("/api/v1/gestion/admin/sedes")
						.header("Authorization", "Bearer " + tokenAdmin)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "codigo": "SEDE-P11-SUR",
								  "nombre": "FarmaGestión Sabaneta",
								  "direccion": "Calle 75 Sur # 45-20",
								  "latitud": 6.151500,
								  "longitud": -75.616600,
								  "horaApertura": "07:30",
								  "horaCierre": "19:30",
								  "activa": true
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.activa").value(true))
				.andReturn();
		UUID sedeActivaId = UUID.fromString(
				objectMapper.readTree(resSedeActiva.getResponse().getContentAsString()).get("id").asText());

		// RF-EMP-32: Al crear un medicamento se generan registros de inventario en cero por cada sede activa
		int cantidadSedesActivas = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM sede WHERE activa = TRUE", Integer.class);
		assertThat(cantidadSedesActivas).isGreaterThanOrEqualTo(4);

		MvcResult resMed = mockMvc.perform(post("/api/v1/gestion/admin/medicamentos")
						.header("Authorization", "Bearer " + tokenAdmin)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "codigo": "MED-P11-9001",
								  "nombre": "Vitamina D3 1000 UI",
								  "principioActivo": "Colecalciferol",
								  "presentacion": "Cápsula blanda caja x 30",
								  "activo": true
								}
								"""))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.codigo").value("MED-P11-9001"))
				.andReturn();
		UUID nuevoMedId = UUID.fromString(
				objectMapper.readTree(resMed.getResponse().getContentAsString()).get("id").asText());

		Integer registrosCreados = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM inventario WHERE medicamento_id = ?", Integer.class, nuevoMedId);
		assertThat(registrosCreados).isEqualTo(cantidadSedesActivas);

		Integer registrosEnCeroYMinimoDefault = jdbcTemplate.queryForObject("""
				SELECT COUNT(*) FROM inventario
				WHERE medicamento_id = ? AND cantidad_fisica = 0 AND cantidad_reservada = 0 AND stock_minimo = 15
				""", Integer.class, nuevoMedId);
		assertThat(registrosEnCeroYMinimoDefault).isEqualTo(cantidadSedesActivas);

		// La sede inactiva NO debe tener registro de inventario generado
		Integer enSedeInactiva = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM inventario WHERE medicamento_id = ? AND sede_id = ?",
				Integer.class, nuevoMedId, sedeInactivaId);
		assertThat(enSedeInactiva).isZero();

		// Editar y desactivar el medicamento
		mockMvc.perform(put("/api/v1/gestion/admin/medicamentos/{id}", nuevoMedId)
						.header("Authorization", "Bearer " + tokenAdmin)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "codigo": "MED-P11-9001",
								  "nombre": "Vitamina D3 2000 UI",
								  "principioActivo": "Colecalciferol",
								  "presentacion": "Cápsula blanda caja x 30",
								  "activo": false
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.nombre").value("Vitamina D3 2000 UI"))
				.andExpect(jsonPath("$.activo").value(false));

		// RF-EMP-31: Crear, editar y desactivar empleado
		MvcResult resEmp = mockMvc.perform(post("/api/v1/gestion/admin/empleados")
						.header("Authorization", "Bearer " + tokenAdmin)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "nuevo.farm@p11.demo",
								  "password": "Password123!",
								  "rol": "EMPLEADO",
								  "cargo": "AUXILIAR",
								  "sedeId": "%s",
								  "nombres": "Diana",
								  "apellidos": "Salazar",
								  "activo": true
								}
								""".formatted(sedeActivaId)))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.cargo").value("AUXILIAR"))
				.andExpect(jsonPath("$.sedeId").value(sedeActivaId.toString()))
				.andReturn();
		UUID nuevoEmpId = UUID.fromString(
				objectMapper.readTree(resEmp.getResponse().getContentAsString()).get("id").asText());

		// El empleado recién creado puede iniciar sesión
		String tokenNuevoEmp = login("nuevo.farm@p11.demo", "Password123!");
		assertThat(tokenNuevoEmp).isNotBlank();

		// Editar cargo y desactivar empleado
		mockMvc.perform(put("/api/v1/gestion/admin/empleados/{id}", nuevoEmpId)
						.header("Authorization", "Bearer " + tokenAdmin)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "email": "nuevo.farm@p11.demo",
								  "rol": "EMPLEADO",
								  "cargo": "FARMACEUTICO",
								  "sedeId": "%s",
								  "nombres": "Diana",
								  "apellidos": "Salazar",
								  "activo": false
								}
								""".formatted(sedeCentroId)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cargo").value("FARMACEUTICO"))
				.andExpect(jsonPath("$.activo").value(false));

		// Al estar desactivado, ya no puede iniciar sesión
		mockMvc.perform(post("/api/v1/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{"email":"nuevo.farm@p11.demo","password":"Password123!"}
								"""))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("USUARIO_INACTIVO"));
	}

	@Test
	void RF_EMP_34_outboxConsultarEventosYReintentoManualExitoso() throws Exception {
		String tokenAdmin = login("admin@farmagestion.demo");

		UUID eventoId = UUID.randomUUID();
		String idempotencyKey = UUID.randomUUID().toString();
		String formulaCodigo = "FRM-P11-OUTBOX";
		String payloadJson = """
				{
				  "formulaCodigo": "%s",
				  "pedidoRef": "%s",
				  "sedeCodigo": "SEDE-CENTRO",
				  "fecha": "2026-11-21T14:00:00Z",
				  "items": [{ "medicamentoCodigo": "MED-0001", "cantidad": 10 }]
				}
				""".formatted(formulaCodigo, idempotencyKey);

		jdbcTemplate.update("""
				INSERT INTO evento_integracion (id, tipo, payload, estado, intentos, ultimo_error, idempotency_key)
				VALUES (?, 'DISPENSACION_FORMULA', ?::jsonb, 'ERROR', 10, 'HTTP 503 Simulador temporalmente caído', ?)
				""", eventoId, payloadJson, idempotencyKey);

		// Consultar eventos filtrados por ERROR
		mockMvc.perform(get("/api/v1/gestion/admin/integracion/eventos")
						.param("estado", "ERROR")
						.header("Authorization", "Bearer " + tokenAdmin))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].id").value(eventoId.toString()))
				.andExpect(jsonPath("$.content[0].estado").value("ERROR"))
				.andExpect(jsonPath("$.content[0].intentos").value(10));

		// Simulador responde 201 al reintento manual
		wireMock.stubFor(WireMock.post(urlPathEqualTo("/api/v1/formulas/" + formulaCodigo + "/dispensaciones"))
				.withHeader("X-API-Key", equalTo(TEST_API_KEY))
				.withHeader("Idempotency-Key", equalTo(idempotencyKey))
				.willReturn(aResponse()
						.withStatus(201)
						.withHeader("Content-Type", "application/json")
						.withBody("""
								{
								  "codigo": "%s",
								  "estado": "DISPENSADA",
								  "fechaEmision": "2026-11-20",
								  "fechaVencimiento": "2026-12-20",
								  "paciente": { "tipoDocumento": "CC", "documento": "1000000001", "nombres": "Ana", "apellidos": "Velásquez" },
								  "medico": { "nombre": "Dr. Demo" },
								  "items": [
								    { "medicamentoCodigo": "MED-0001", "medicamentoNombre": "Acetaminofén 500 mg",
								      "dosis": "1", "frecuencia": "8h", "duracionDias": 5, "cantidadAutorizada": 10, "cantidadDispensada": 10 }
								  ]
								}
								""".formatted(formulaCodigo))));

		// Ejecutar reintento manual
		MvcResult resReintento = mockMvc.perform(
						post("/api/v1/gestion/admin/integracion/eventos/{id}/reintentar", eventoId)
								.header("Authorization", "Bearer " + tokenAdmin))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.estado").value("ENVIADO"))
				.andExpect(jsonPath("$.intentos").value(1))
				.andExpect(jsonPath("$.ultimoError").doesNotExist())
				.andExpect(jsonPath("$.enviadoEn").isNotEmpty())
				.andReturn();

		JsonNode json = objectMapper.readTree(resReintento.getResponse().getContentAsString());
		assertThat(json.get("id").asText()).isEqualTo(eventoId.toString());

		wireMock.verify(1, postRequestedFor(urlPathEqualTo("/api/v1/formulas/" + formulaCodigo + "/dispensaciones"))
				.withHeader("Idempotency-Key", equalTo(idempotencyKey)));

		// Reintentar un evento ya ENVIADO -> 409 EVENTO_YA_ENVIADO
		mockMvc.perform(post("/api/v1/gestion/admin/integracion/eventos/{id}/reintentar", eventoId)
						.header("Authorization", "Bearer " + tokenAdmin))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EVENTO_YA_ENVIADO"));
	}
}
