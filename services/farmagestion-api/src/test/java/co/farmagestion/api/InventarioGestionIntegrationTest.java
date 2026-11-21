package co.farmagestion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.farmagestion.api.inventario.InventarioOperacionesService;
import co.farmagestion.api.inventario.SolicitudStockItem;
import co.farmagestion.api.inventario.StockBajoEvent;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.event.EventListener;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.ObjectMapper;

@Import({TestcontainersConfiguration.class, InventarioGestionIntegrationTest.EventCaptorConfig.class})
@SpringBootTest
@AutoConfigureMockMvc
class InventarioGestionIntegrationTest {

	@TestConfiguration(proxyBeanMethods = false)
	static class EventCaptorConfig {

		@Bean
		StockBajoEventCaptor stockBajoEventCaptor() {
			return new StockBajoEventCaptor();
		}
	}

	static class StockBajoEventCaptor {

		private final List<StockBajoEvent> eventos = new CopyOnWriteArrayList<>();

		@EventListener
		void onStockBajo(StockBajoEvent event) {
			eventos.add(event);
		}

		List<StockBajoEvent> getEventos() {
			return List.copyOf(eventos);
		}

		void limpiar() {
			eventos.clear();
		}
	}

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Autowired
	private InventarioOperacionesService operacionesService;

	@Autowired
	private StockBajoEventCaptor stockBajoEventCaptor;

	private UUID sedeCentroId;
	private UUID sedeBelloId;

	@BeforeEach
	void setUp() {
		stockBajoEventCaptor.limpiar();
		sedeCentroId = jdbcTemplate.queryForObject(
				"SELECT id FROM sede WHERE codigo = 'SEDE-CENTRO'", UUID.class);
		sedeBelloId = jdbcTemplate.queryForObject(
				"SELECT id FROM sede WHERE codigo = 'SEDE-BELLO'", UUID.class);
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

	@Test
	void CA_EMP_01_alcancePorSede() throws Exception {
		String tokenCentro = login("farmaceutico.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0001");

		// Sin sedeId recibe únicamente inventario de SEDE-CENTRO
		mockMvc.perform(get("/api/v1/gestion/inventario")
						.header("Authorization", "Bearer " + tokenCentro)
						.param("size", "50"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalElements").value(30))
				.andExpect(jsonPath("$.content[*].sedeId", everyItem(is(sedeCentroId.toString()))));

		// Al solicitar inventario de SEDE-BELLO recibe 403 SEDE_NO_AUTORIZADA
		mockMvc.perform(get("/api/v1/gestion/inventario")
						.header("Authorization", "Bearer " + tokenCentro)
						.param("sedeId", sedeBelloId.toString()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("SEDE_NO_AUTORIZADA"));

		// Igual en kárdex y operaciones de escritura sobre SEDE-BELLO
		mockMvc.perform(get("/api/v1/gestion/inventario/{medId}/kardex", medId)
						.header("Authorization", "Bearer " + tokenCentro)
						.param("sedeId", sedeBelloId.toString()))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("SEDE_NO_AUTORIZADA"));

		mockMvc.perform(post("/api/v1/gestion/inventario/{medId}/entradas", medId)
						.header("Authorization", "Bearer " + tokenCentro)
						.param("sedeId", sedeBelloId.toString())
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "cantidad": 5, "motivo": "Intento otra sede" }
								"""))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("SEDE_NO_AUTORIZADA"));

		// ADMIN sí puede consultar todas las sedes y filtrar por SEDE-BELLO
		String tokenAdmin = login("admin@farmagestion.demo");
		mockMvc.perform(get("/api/v1/gestion/inventario")
						.header("Authorization", "Bearer " + tokenAdmin)
						.param("size", "10"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalElements").value(90));

		mockMvc.perform(get("/api/v1/gestion/inventario")
						.header("Authorization", "Bearer " + tokenAdmin)
						.param("sedeId", sedeBelloId.toString())
						.param("size", "50"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalElements").value(30))
				.andExpect(jsonPath("$.content[*].sedeId", everyItem(is(sedeBelloId.toString()))));
	}

	@Test
	void CA_EMP_02_entradaDeStockYRegistroEnKardex() throws Exception {
		String tokenFarmaceutico = login("farmaceutico.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0006");

		// Precondición CA-EMP-02: 10 unidades físicas, 0 reservadas
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 10, cantidad_reservada = 0 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		mockMvc.perform(post("/api/v1/gestion/inventario/{medId}/entradas", medId)
						.header("Authorization", "Bearer " + tokenFarmaceutico)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "cantidad": 40, "motivo": "Reposición proveedor" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cantidadFisica").value(50))
				.andExpect(jsonPath("$.cantidadReservada").value(0))
				.andExpect(jsonPath("$.disponible").value(50));

		// Verificar movimiento ENTRADA con saldo 50 visible en kárdex
		mockMvc.perform(get("/api/v1/gestion/inventario/{medId}/kardex", medId)
						.header("Authorization", "Bearer " + tokenFarmaceutico)
						.param("tipo", "ENTRADA"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].tipo").value("ENTRADA"))
				.andExpect(jsonPath("$.content[0].cantidad").value(40))
				.andExpect(jsonPath("$.content[0].saldoFisico").value(50))
				.andExpect(jsonPath("$.content[0].motivo").value("Reposición proveedor"))
				.andExpect(jsonPath("$.content[0].usuarioId").isNotEmpty());
	}

	@Test
	void CA_EMP_03_ajusteInvalidoNoDejaFisicoMenorQueReservado() throws Exception {
		String tokenFarmaceutico = login("farmaceutico.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0007");

		// Precondición CA-EMP-03: 10 físicas y 8 reservadas
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 10, cantidad_reservada = 8 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		// Intento de ajuste -5 (dejaría 5 físicas < 8 reservadas) -> 409 AJUSTE_INVALIDO_RESERVA
		mockMvc.perform(post("/api/v1/gestion/inventario/{medId}/ajustes", medId)
						.header("Authorization", "Bearer " + tokenFarmaceutico)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "cantidad": -5, "motivo": "Avería en estantería" }
								"""))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("AJUSTE_INVALIDO_RESERVA"));

		Integer fisico = jdbcTemplate.queryForObject(
				"SELECT cantidad_fisica FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		Integer reservado = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		assertThat(fisico).isEqualTo(10);
		assertThat(reservado).isEqualTo(8);

		// Ajuste sin motivo obligatorio -> 400 VALIDACION_ERROR
		mockMvc.perform(post("/api/v1/gestion/inventario/{medId}/ajustes", medId)
						.header("Authorization", "Bearer " + tokenFarmaceutico)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "cantidad": -1, "motivo": "   " }
								"""))
				.andExpect(status().isBadRequest())
				.andExpect(jsonPath("$.code").value("VALIDACION_ERROR"));

		// Ajuste negativo válido de -2 (deja 8 físicas == 8 reservadas) -> 200 OK y queda en kárdex
		mockMvc.perform(post("/api/v1/gestion/inventario/{medId}/ajustes", medId)
						.header("Authorization", "Bearer " + tokenFarmaceutico)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "cantidad": -2, "motivo": "Conteo físico con merma" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.cantidadFisica").value(8))
				.andExpect(jsonPath("$.cantidadReservada").value(8))
				.andExpect(jsonPath("$.disponible").value(0));

		mockMvc.perform(get("/api/v1/gestion/inventario/{medId}/kardex", medId)
						.header("Authorization", "Bearer " + tokenFarmaceutico)
						.param("tipo", "AJUSTE_NEG"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].tipo").value("AJUSTE_NEG"))
				.andExpect(jsonPath("$.content[0].cantidad").value(2))
				.andExpect(jsonPath("$.content[0].saldoFisico").value(8))
				.andExpect(jsonPath("$.content[0].motivo").value("Conteo físico con merma"));
	}

	@Test
	void CA_EMP_08_alertaStockMinimoUnaSolaVezPorCruce() throws Exception {
		String tokenFarmaceutico = login("farmaceutico.centro@farmagestion.demo");
		UUID farmaceuticoId = jdbcTemplate.queryForObject(
				"SELECT id FROM usuario WHERE email = 'farmaceutico.centro@farmagestion.demo'", UUID.class);
		UUID medId = medicamentoIdPorCodigo("MED-0009");

		// Precondición CA-EMP-08: stock_minimo = 10, disponible = 12 (12 físicas, 0 reservadas)
		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 12, cantidad_reservada = 0, stock_minimo = 10 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		// 1. Reserva de 3 -> disponible baja de 12 a 9 (cruza <= 10) -> dispara 1 evento y 1 notificación STOCK_BAJO
		jdbcTemplate.update("DELETE FROM notificacion WHERE tipo = 'STOCK_BAJO' AND referencia_id = ?", medId);
		operacionesService.reservar(
				sedeCentroId,
				List.of(new SolicitudStockItem(medId, 3)),
				false,
				"PEDIDO",
				UUID.randomUUID(),
				farmaceuticoId);

		assertThat(stockBajoEventCaptor.getEventos()).hasSize(1);
		StockBajoEvent primerEvento = stockBajoEventCaptor.getEventos().getFirst();
		assertThat(primerEvento.sedeId()).isEqualTo(sedeCentroId);
		assertThat(primerEvento.medicamentoId()).isEqualTo(medId);
		assertThat(primerEvento.disponibleActual()).isEqualTo(9);
		assertThat(primerEvento.stockMinimo()).isEqualTo(10);

		Integer notifDespuesPrimero = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM notificacion WHERE usuario_id = ? AND tipo = 'STOCK_BAJO' AND referencia_id = ?",
				Integer.class, farmaceuticoId, medId);
		assertThat(notifDespuesPrimero).isEqualTo(1);

		// 2. Segunda reserva de 2 -> disponible baja de 9 a 7 (ya estaba <= 10) -> NO repite
		operacionesService.reservar(
				sedeCentroId,
				List.of(new SolicitudStockItem(medId, 2)),
				false,
				"PEDIDO",
				UUID.randomUUID(),
				farmaceuticoId);
		assertThat(stockBajoEventCaptor.getEventos()).hasSize(1);
		Integer notifDespuesSegundo = jdbcTemplate.queryForObject(
				"SELECT COUNT(*) FROM notificacion WHERE usuario_id = ? AND tipo = 'STOCK_BAJO' AND referencia_id = ?",
				Integer.class, farmaceuticoId, medId);
		assertThat(notifDespuesSegundo).isEqualTo(1);

		mockMvc.perform(get("/api/v1/gestion/notificaciones")
						.header("Authorization", "Bearer " + tokenFarmaceutico))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].tipo").value("STOCK_BAJO"));

		// 3. Entrada de 10 -> disponible sube a 17 (> 10); luego reserva de 7 -> disponible cae a 10 (nuevo cruce)
		mockMvc.perform(post("/api/v1/gestion/inventario/{medId}/entradas", medId)
						.header("Authorization", "Bearer " + tokenFarmaceutico)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "cantidad": 10, "motivo": "Reabastecimiento" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.disponible").value(17));

		operacionesService.reservar(
				sedeCentroId,
				List.of(new SolicitudStockItem(medId, 7)),
				false,
				"PEDIDO",
				UUID.randomUUID(),
				farmaceuticoId);
		assertThat(stockBajoEventCaptor.getEventos()).hasSize(2);
		assertThat(stockBajoEventCaptor.getEventos().get(1).disponibleActual()).isEqualTo(10);
	}

	@Test
	void permisosPorRolYCargoFiltrosYStockMinimo() throws Exception {
		String tokenAuxiliar = login("auxiliar.centro@farmagestion.demo");
		String tokenDomiciliario = login("domiciliario.centro@farmagestion.demo");
		String tokenPaciente = login("paciente1@farmagestion.demo");
		String tokenFarmaceutico = login("farmaceutico.centro@farmagestion.demo");
		UUID medId = medicamentoIdPorCodigo("MED-0011");

		// Auxiliar puede consultar inventario y kárdex, pero NO registrar entradas/ajustes ni editar stock mínimo
		mockMvc.perform(get("/api/v1/gestion/inventario")
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.param("agotado", "true"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[*].disponible", everyItem(is(0))));

		mockMvc.perform(get("/api/v1/gestion/inventario/{medId}/kardex", medId)
						.header("Authorization", "Bearer " + tokenAuxiliar))
				.andExpect(status().isOk());

		mockMvc.perform(post("/api/v1/gestion/inventario/{medId}/entradas", medId)
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "cantidad": 5, "motivo": "No permitido" }
								"""))
				.andExpect(status().isForbidden())
				.andExpect(jsonPath("$.code").value("ACCESO_DENEGADO"));

		mockMvc.perform(patch("/api/v1/gestion/inventario/{medId}", medId)
						.header("Authorization", "Bearer " + tokenAuxiliar)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "stockMinimo": 15 }
								"""))
				.andExpect(status().isForbidden());

		// Domiciliario y Paciente reciben 403 en inventario (03 §3, CA-EMP-13)
		mockMvc.perform(get("/api/v1/gestion/inventario")
						.header("Authorization", "Bearer " + tokenDomiciliario))
				.andExpect(status().isForbidden());

		mockMvc.perform(get("/api/v1/gestion/inventario")
						.header("Authorization", "Bearer " + tokenPaciente))
				.andExpect(status().isForbidden());

		// Farmacéutico puede actualizar stock mínimo (RF-EMP-07)
		mockMvc.perform(patch("/api/v1/gestion/inventario/{medId}", medId)
						.header("Authorization", "Bearer " + tokenFarmaceutico)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "stockMinimo": 15 }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.stockMinimo").value(15));
	}

	@Test
	void operacionesInternasReservaLiberacionYDispensacionEscribenKardex() {
		UUID usuarioId = jdbcTemplate.queryForObject(
				"SELECT id FROM usuario WHERE email = 'farmaceutico.centro@farmagestion.demo'", UUID.class);
		UUID medId = medicamentoIdPorCodigo("MED-0015");
		UUID pedidoRef = UUID.randomUUID();

		jdbcTemplate.update(
				"UPDATE inventario SET cantidad_fisica = 30, cantidad_reservada = 0, stock_minimo = 5 WHERE sede_id = ? AND medicamento_id = ?",
				sedeCentroId, medId);

		// Reservar 10
		operacionesService.reservar(
				sedeCentroId, List.of(new SolicitudStockItem(medId, 10)), false, "PEDIDO", pedidoRef, usuarioId);
		// Liberar 4
		operacionesService.liberar(
				sedeCentroId, List.of(new SolicitudStockItem(medId, 4)), "PEDIDO", pedidoRef, usuarioId, "Ajuste de prueba");
		// Dispensar 6
		operacionesService.dispensar(
				sedeCentroId, List.of(new SolicitudStockItem(medId, 6)), "PEDIDO", pedidoRef, usuarioId, "Entrega de prueba");

		Integer fisico = jdbcTemplate.queryForObject(
				"SELECT cantidad_fisica FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		Integer reservado = jdbcTemplate.queryForObject(
				"SELECT cantidad_reservada FROM inventario WHERE sede_id = ? AND medicamento_id = ?",
				Integer.class, sedeCentroId, medId);
		assertThat(fisico).isEqualTo(24);
		assertThat(reservado).isEqualTo(0);

		List<String> tipos = jdbcTemplate.queryForList(
				"SELECT tipo FROM movimiento_inventario WHERE referencia_id = ? ORDER BY created_at ASC, id ASC",
				String.class, pedidoRef);
		assertThat(tipos).containsExactly("RESERVA", "LIBERACION", "DISPENSACION");
	}
}
