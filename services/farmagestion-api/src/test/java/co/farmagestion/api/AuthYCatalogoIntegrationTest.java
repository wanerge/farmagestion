package co.farmagestion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest
@AutoConfigureMockMvc
class AuthYCatalogoIntegrationTest {

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Autowired
	private JwtDecoder jwtDecoder;

	@Autowired
	private JdbcTemplate jdbcTemplate;

	@Test
	void registroYLoginPacienteYEdicionPerfil() throws Exception {
		String email = "nuevo.paciente." + UUID.randomUUID().toString().substring(0, 8) + "@demo.co";
		String documento = "9" + Math.abs(UUID.randomUUID().hashCode() % 100000000);

		String registroPayload = """
				{
				  "email": "%s",
				  "password": "MiPassword2026!",
				  "tipoDocumento": "cc",
				  "documento": "%s",
				  "nombres": "Lucía",
				  "apellidos": "Martínez",
				  "telefono": "3015551234"
				}
				""".formatted(email, documento);

		MvcResult registroRes = mockMvc.perform(post("/api/v1/auth/registro")
						.contentType(MediaType.APPLICATION_JSON)
						.content(registroPayload))
				.andExpect(status().isCreated())
				.andExpect(jsonPath("$.tokenType").value("Bearer"))
				.andExpect(jsonPath("$.expiresIn").value(7200))
				.andExpect(jsonPath("$.usuario.email").value(email))
				.andExpect(jsonPath("$.usuario.rol").value("PACIENTE"))
				.andReturn();

		JsonNode registroJson = objectMapper.readTree(registroRes.getResponse().getContentAsString());
		String token = registroJson.get("accessToken").asString();
		String usuarioId = registroJson.get("usuario").get("id").asString();

		Jwt jwt = jwtDecoder.decode(token);
		assertThat(jwt.getSubject()).isEqualTo(usuarioId);
		assertThat(jwt.getClaimAsString("rol")).isEqualTo("PACIENTE");
		assertThat(jwt.getClaimAsString("sedeId")).isNull();
		assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofHours(2));

		// Duplicados: correo y documento
		mockMvc.perform(post("/api/v1/auth/registro")
						.contentType(MediaType.APPLICATION_JSON)
						.content(registroPayload))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("EMAIL_YA_REGISTRADO"));

		String mismoDoc = registroPayload.replace(email, "otro." + email);
		mockMvc.perform(post("/api/v1/auth/registro")
						.contentType(MediaType.APPLICATION_JSON)
						.content(mismoDoc))
				.andExpect(status().isConflict())
				.andExpect(jsonPath("$.code").value("DOCUMENTO_YA_REGISTRADO"));

		// RF-PAC-03: Consultar y editar perfil (teléfono y contraseña, documento inmutable)
		mockMvc.perform(get("/api/v1/pacientes/me")
						.header("Authorization", "Bearer " + token))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.tipoDocumento").value("CC"))
				.andExpect(jsonPath("$.documento").value(documento))
				.andExpect(jsonPath("$.telefono").value("3015551234"));

		mockMvc.perform(put("/api/v1/pacientes/me")
						.header("Authorization", "Bearer " + token)
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{
								  "telefono": "3029998877",
								  "passwordActual": "MiPassword2026!",
								  "passwordNueva": "NuevaClave2026!"
								}
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.telefono").value("3029998877"))
				.andExpect(jsonPath("$.documento").value(documento));

		// Login con contraseña antigua falla, con nueva funciona
		mockMvc.perform(post("/api/v1/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "email": "%s", "password": "MiPassword2026!" }
								""".formatted(email)))
				.andExpect(status().isUnauthorized())
				.andExpect(jsonPath("$.code").value("CREDENCIALES_INVALIDAS"));

		mockMvc.perform(post("/api/v1/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "email": "%s", "password": "NuevaClave2026!" }
								""".formatted(email)))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.usuario.rol").value("PACIENTE"));
	}

	@Test
	void loginEmpleadoIncluyeRolCargoYSedeIdEnJwt() throws Exception {
		UUID sedeCentroId = jdbcTemplate.queryForObject(
				"SELECT id FROM sede WHERE codigo = 'SEDE-CENTRO'", UUID.class);

		MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
						.contentType(MediaType.APPLICATION_JSON)
						.content("""
								{ "email": "farmaceutico.centro@farmagestion.demo", "password": "Farma2026!" }
								"""))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.usuario.rol").value("EMPLEADO"))
				.andExpect(jsonPath("$.usuario.cargo").value("FARMACEUTICO"))
				.andExpect(jsonPath("$.usuario.sedeId").value(sedeCentroId.toString()))
				.andReturn();

		String token = objectMapper.readTree(res.getResponse().getContentAsString()).get("accessToken").asString();
		Jwt jwt = jwtDecoder.decode(token);
		assertThat(jwt.getClaimAsString("rol")).isEqualTo("EMPLEADO");
		assertThat(jwt.getClaimAsString("cargo")).isEqualTo("FARMACEUTICO");
		assertThat(jwt.getClaimAsString("sedeId")).isEqualTo(sedeCentroId.toString());
		assertThat(Duration.between(jwt.getIssuedAt(), jwt.getExpiresAt())).isEqualTo(Duration.ofHours(2));
	}

	@Test
	void CA_PAC_01_busquedaPublicaYDisponibilidadPorNivelesSinCantidadesExactas() throws Exception {
		// Sin sesión: busca con tilde y sin tilde
		MvcResult busquedaConTilde = mockMvc.perform(get("/api/v1/catalogo/medicamentos")
						.param("q", "losartán"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.totalElements").value(greaterThan(0)))
				.andExpect(jsonPath("$.content[0].codigo").value("MED-0004"))
				.andReturn();

		mockMvc.perform(get("/api/v1/catalogo/medicamentos")
						.param("q", "losartan"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.content[0].codigo").value("MED-0004"));

		String medId = objectMapper.readTree(busquedaConTilde.getResponse().getContentAsString())
				.get("content").get(0).get("id").asString();

		MvcResult dispRes = mockMvc.perform(get("/api/v1/catalogo/medicamentos/{id}/disponibilidad", medId))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.codigo").value("MED-0004"))
				.andExpect(jsonPath("$.sedes.length()").value(3))
				.andExpect(jsonPath("$.sedes[*].codigo", hasItem("SEDE-CENTRO")))
				.andExpect(jsonPath("$.sedes[*].codigo", hasItem("SEDE-BELLO")))
				.andExpect(jsonPath("$.sedes[*].codigo", hasItem("SEDE-ITAGUI")))
				.andExpect(jsonPath("$.sedes[?(@.codigo=='SEDE-BELLO')].nivel", hasItem("AGOTADO")))
				.andReturn();

		// RN-10: No se exponen cantidades exactas
		String body = dispRes.getResponse().getContentAsString();
		assertThat(body).doesNotContain("cantidadFisica");
		assertThat(body).doesNotContain("cantidadReservada");
		assertThat(body).doesNotContain("stockMinimo");
		assertThat(body).doesNotContain("\"disponible\"");

		// RF-PAC-05: Sedes públicas con dirección, horario y coordenadas
		mockMvc.perform(get("/api/v1/catalogo/sedes"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.length()").value(3))
				.andExpect(jsonPath("$[0].direccion").isNotEmpty())
				.andExpect(jsonPath("$[0].latitud").isNumber())
				.andExpect(jsonPath("$[0].longitud").isNumber())
				.andExpect(jsonPath("$[0].horaApertura").isNotEmpty())
				.andExpect(jsonPath("$[0].horaCierre").isNotEmpty());
	}

	@Test
	void corsSoloPermiteOrigenesConfigurados() throws Exception {
		mockMvc.perform(options("/api/v1/catalogo/sedes")
						.header("Origin", "http://localhost:3001")
						.header("Access-Control-Request-Method", "GET"))
				.andExpect(status().isOk())
				.andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:3001"));

		mockMvc.perform(options("/api/v1/catalogo/sedes")
						.header("Origin", "https://sitio-no-autorizado.example")
						.header("Access-Control-Request-Method", "GET"))
				.andExpect(status().isForbidden())
				.andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
	}

	@Test
	void openApiExponeEndpointsDeAuthCatalogoEInventario() throws Exception {
		mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andExpect(jsonPath("$.paths['/api/v1/auth/registro']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/auth/login']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/pacientes/me']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/catalogo/medicamentos']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/catalogo/medicamentos/{id}/disponibilidad']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/catalogo/sedes']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/gestion/inventario']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/gestion/inventario/{medicamentoId}/entradas']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/gestion/inventario/{medicamentoId}/ajustes']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/gestion/inventario/{medicamentoId}']").exists())
				.andExpect(jsonPath("$.paths['/api/v1/gestion/inventario/{medicamentoId}/kardex']").exists());

		mockMvc.perform(get("/swagger-ui/index.html"))
				.andExpect(status().isOk())
				.andExpect(header().string("Content-Type", containsString("text/html")));
	}
}
