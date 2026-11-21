package co.farmagestion.api.catalogo;

import co.farmagestion.api.common.web.OpenApiConfig;
import co.farmagestion.api.common.web.PaginaResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gestion/admin")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Administración", description = "Gestión administrativa de sedes, empleados, catálogo, parámetros y outbox (solo ADMIN, RF-EMP-30 a RF-EMP-34)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class AdminCatalogoController {

	private final CatalogoAdminService catalogoAdminService;

	public AdminCatalogoController(CatalogoAdminService catalogoAdminService) {
		this.catalogoAdminService = catalogoAdminService;
	}

	@GetMapping("/sedes")
	@Operation(summary = "Listar todas las sedes", description = "Lista todas las sedes (activas e inactivas) para administración (RF-EMP-30).")
	public List<SedeAdminResponse> listarSedes() {
		return catalogoAdminService.listarSedes();
	}

	@PostMapping("/sedes")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Crear sede", description = "Crea una nueva sede con horario y coordenadas (RF-EMP-30).")
	public SedeAdminResponse crearSede(@Valid @RequestBody CrearSedeRequest request) {
		return catalogoAdminService.crearSede(request);
	}

	@PutMapping("/sedes/{id}")
	@Operation(summary = "Actualizar sede", description = "Edita los datos, horario, coordenadas o estado activo de una sede (RF-EMP-30).")
	public SedeAdminResponse actualizarSede(
			@PathVariable UUID id,
			@Valid @RequestBody ActualizarSedeRequest request) {
		return catalogoAdminService.actualizarSede(id, request);
	}

	@GetMapping("/medicamentos")
	@Operation(summary = "Listar catálogo de medicamentos", description = "Lista paginada del catálogo de medicamentos (activos e inactivos) con búsqueda (RF-EMP-32).")
	public PaginaResponse<MedicamentoAdminResponse> listarMedicamentos(
			@RequestParam(required = false) String q,
			@RequestParam(required = false) Boolean activo,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "50") int size) {
		return catalogoAdminService.listarMedicamentos(q, activo, page, size);
	}

	@PostMapping("/medicamentos")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Crear medicamento", description = "Crea un medicamento en el catálogo y genera automáticamente registros de inventario en cero para cada sede activa (RF-EMP-32).")
	public MedicamentoAdminResponse crearMedicamento(@Valid @RequestBody CrearMedicamentoRequest request) {
		return catalogoAdminService.crearMedicamento(request);
	}

	@PutMapping("/medicamentos/{id}")
	@Operation(summary = "Actualizar medicamento", description = "Edita los datos o desactiva/activa un medicamento del catálogo (RF-EMP-32).")
	public MedicamentoAdminResponse actualizarMedicamento(
			@PathVariable UUID id,
			@Valid @RequestBody ActualizarMedicamentoRequest request) {
		return catalogoAdminService.actualizarMedicamento(id, request);
	}
}
