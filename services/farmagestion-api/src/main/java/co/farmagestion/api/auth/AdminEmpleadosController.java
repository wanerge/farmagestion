package co.farmagestion.api.auth;

import co.farmagestion.api.common.web.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gestion/admin/empleados")
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Administración", description = "Gestión administrativa de sedes, empleados, catálogo, parámetros y outbox (solo ADMIN, RF-EMP-30 a RF-EMP-34)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class AdminEmpleadosController {

	private final EmpleadoAdminService empleadoAdminService;

	public AdminEmpleadosController(EmpleadoAdminService empleadoAdminService) {
		this.empleadoAdminService = empleadoAdminService;
	}

	@GetMapping
	@Operation(summary = "Listar empleados", description = "Lista todas las cuentas de empleados y administradores con cargo, sede y estado (RF-EMP-31).")
	public List<EmpleadoAdminResponse> listarEmpleados() {
		return empleadoAdminService.listarEmpleados();
	}

	@PostMapping
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Crear empleado", description = "Crea una cuenta de empleado con cargo y sede asignada (RF-EMP-31).")
	public EmpleadoAdminResponse crearEmpleado(@Valid @RequestBody CrearEmpleadoRequest request) {
		return empleadoAdminService.crearEmpleado(request);
	}

	@PutMapping("/{id}")
	@Operation(summary = "Actualizar empleado", description = "Edita cargo, sede, correo, contraseña opcional o estado activo de un empleado (RF-EMP-31).")
	public EmpleadoAdminResponse actualizarEmpleado(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id,
			@Valid @RequestBody ActualizarEmpleadoRequest request) {
		UsuarioAutenticado admin = UsuarioAutenticado.fromJwt(jwt);
		return empleadoAdminService.actualizarEmpleado(admin, id, request);
	}
}
