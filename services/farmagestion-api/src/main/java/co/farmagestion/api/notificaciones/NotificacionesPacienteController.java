package co.farmagestion.api.notificaciones;

import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.common.web.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pacientes/me/notificaciones")
@Tag(name = "Notificaciones del paciente", description = "Consulta y lectura de notificaciones in-app del paciente (RF-PAC-17, RF-PAC-18)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class NotificacionesPacienteController {

	private final NotificacionService notificacionService;

	public NotificacionesPacienteController(NotificacionService notificacionService) {
		this.notificacionService = notificacionService;
	}

	@GetMapping
	@Operation(summary = "Listar notificaciones", description = "Devuelve notificaciones paginadas del paciente y contador de no leídas (RF-PAC-18).")
	public NotificacionesListadoResponse listar(
			@AuthenticationPrincipal Jwt jwt,
			@RequestParam(required = false) Boolean soloNoLeidas,
			@RequestParam(defaultValue = "0") int page,
			@RequestParam(defaultValue = "20") int size) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return notificacionService.listarPorUsuario(auth.usuarioId(), soloNoLeidas, page, size);
	}

	@PostMapping("/{id}/leer")
	@Operation(summary = "Marcar notificación como leída", description = "Marca como leída una notificación propia del paciente.")
	public NotificacionResponse marcarLeida(
			@AuthenticationPrincipal Jwt jwt,
			@PathVariable UUID id) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return notificacionService.marcarComoLeida(auth.usuarioId(), id);
	}
}
