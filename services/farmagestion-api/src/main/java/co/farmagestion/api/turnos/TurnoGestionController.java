package co.farmagestion.api.turnos;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.common.web.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/gestion/turnos")
@Tag(name = "Gestión de turnos", description = "Cola de turnos del día, llamado al siguiente turno y vencimiento por no presentación (RF-EMP-15 a RF-EMP-17)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class TurnoGestionController {

	private final TurnoService turnoService;

	public TurnoGestionController(TurnoService turnoService) {
		this.turnoService = turnoService;
	}

	@GetMapping
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Consultar cola de turnos", description = "Lista los turnos de la sede para la fecha indicada (por defecto hoy), ordenados por franja y número (RF-EMP-15).")
	public List<TurnoResponse> listarCola(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return turnoService.listarColaDelDia(auth, sedeId, fecha);
	}

	@PostMapping("/llamar-siguiente")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Llamar siguiente turno", description = "Pasa el primer turno EN_ESPERA de la sede a LLAMADO y notifica al paciente (RF-EMP-16, CA-EMP-10).")
	public TurnoResponse llamarSiguiente(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) UUID sedeId,
			@RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fecha) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return turnoService.llamarSiguiente(auth, sedeId, fecha);
	}

	@PostMapping("/{id}/vencer")
	@PreAuthorize("hasRole('ADMIN') or (hasRole('EMPLEADO') and hasAnyAuthority('CARGO_AUXILIAR', 'CARGO_FARMACEUTICO'))")
	@Operation(summary = "Marcar turno como vencido", description = "Marca un turno como VENCIDO por no presentación del paciente, venciendo también el pedido con liberación de stock (RF-EMP-17).")
	public TurnoResponse vencerTurno(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return turnoService.vencerTurnoManual(auth, id);
	}
}
