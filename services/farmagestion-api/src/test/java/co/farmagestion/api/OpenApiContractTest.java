package co.farmagestion.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

@Import(TestcontainersConfiguration.class)
@SpringBootTest(properties = "app.scheduling.enabled=false")
@AutoConfigureMockMvc
class OpenApiContractTest {

	private static final Path CONTRACT_PATH = Path.of("..", "..", "contracts", "farmagestion-api.openapi.json");

	@Autowired
	private MockMvc mockMvc;

	@Autowired
	private ObjectMapper objectMapper;

	@Test
	void contratoOpenApiPublicadoYSincronizado() throws Exception {
		MvcResult res = mockMvc.perform(get("/v3/api-docs"))
				.andExpect(status().isOk())
				.andReturn();

		String rawJson = res.getResponse().getContentAsString(StandardCharsets.UTF_8);
		JsonNode actual = objectMapper.readTree(rawJson);

		JsonNode paths = actual.get("paths");
		assertThat(paths).isNotNull();
		assertThat(paths.has("/api/v1/pacientes/me/formulas")).isTrue();
		assertThat(paths.has("/api/v1/pacientes/me/formulas/{id}")).isTrue();
		assertThat(paths.has("/api/v1/pacientes/me/formulas/{id}/pdf")).isTrue();
		assertThat(paths.has("/api/v1/pacientes/me/sedes/{sedeId}/franjas")).isTrue();
		assertThat(paths.has("/api/v1/pacientes/me/pedidos")).isTrue();
		assertThat(paths.has("/api/v1/pacientes/me/pedidos/{id}")).isTrue();
		assertThat(paths.has("/api/v1/pacientes/me/pedidos/{id}/cancelar")).isTrue();
		assertThat(paths.has("/api/v1/pacientes/me/notificaciones")).isTrue();
		assertThat(paths.has("/api/v1/pacientes/me/notificaciones/{id}/leer")).isTrue();
		assertThat(paths.has("/api/v1/gestion/pedidos")).isTrue();
		assertThat(paths.has("/api/v1/gestion/pedidos/{id}/tomar")).isTrue();
		assertThat(paths.has("/api/v1/gestion/pedidos/{id}/listo")).isTrue();
		assertThat(paths.has("/api/v1/gestion/pedidos/{id}/entregar")).isTrue();
		assertThat(paths.has("/api/v1/gestion/pedidos/{id}/cancelar")).isTrue();
		assertThat(paths.has("/api/v1/gestion/turnos")).isTrue();
		assertThat(paths.has("/api/v1/gestion/turnos/llamar-siguiente")).isTrue();
		assertThat(paths.has("/api/v1/gestion/turnos/{id}/vencer")).isTrue();
		assertThat(paths.has("/api/v1/gestion/public/sala/{sedeCodigo}")).isTrue();
		assertThat(paths.has("/api/v1/gestion/notificaciones")).isTrue();

		if (Boolean.parseBoolean(System.getProperty("export.openapi", "false"))) {
			Files.createDirectories(CONTRACT_PATH.getParent());
			String pretty = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(actual) + "\n";
			Files.writeString(CONTRACT_PATH, pretty, StandardCharsets.UTF_8);
		}

		assertThat(Files.exists(CONTRACT_PATH))
				.as("Debe existir contracts/farmagestion-api.openapi.json")
				.isTrue();
		JsonNode guardado = objectMapper.readTree(Files.readString(CONTRACT_PATH, StandardCharsets.UTF_8));
		assertThat(actual).isEqualTo(guardado);
	}
}
