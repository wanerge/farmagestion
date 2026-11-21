package co.farmagestion.api.common.web;

import co.farmagestion.api.common.domain.ParametroResponse;
import co.farmagestion.api.common.domain.ParametroService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gestion/admin/parametros")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Administración", description = "Gestión administrativa de sedes, empleados, catálogo, parámetros y outbox (solo ADMIN, RF-EMP-30 a RF-EMP-34)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class AdminParametrosController {

	private final ParametroService parametroService;

	public AdminParametrosController(ParametroService parametroService) {
		this.parametroService = parametroService;
	}

	@GetMapping
	@Operation(summary = "Listar parámetros del sistema", description = "Devuelve todos los parámetros configurables de 00 §6.3 (RF-EMP-33).")
	public List<ParametroResponse> listarParametros() {
		return parametroService.listarTodos();
	}

	@PutMapping
	@Operation(summary = "Actualizar parámetros en lote", description = "Actualiza el valor de uno o varios parámetros de 00 §6.3 (RF-EMP-33).")
	public List<ParametroResponse> actualizarParametros(@Valid @RequestBody ActualizarParametrosRequest request) {
		Map<String, String> cambios = new LinkedHashMap<>();
		for (ActualizarParametrosRequest.ParametroValorItem item : request.parametros()) {
			cambios.put(item.clave(), item.valor());
		}
		return parametroService.actualizarParametros(cambios);
	}

	@PutMapping("/{clave}")
	@Operation(summary = "Actualizar parámetro individual", description = "Actualiza el valor de un parámetro específico por su clave (RF-EMP-33).")
	public ParametroResponse actualizarParametro(
			@PathVariable String clave,
			@Valid @RequestBody ActualizarParametroRequest request) {
		return parametroService.actualizarParametro(clave, request.valor());
	}
}
