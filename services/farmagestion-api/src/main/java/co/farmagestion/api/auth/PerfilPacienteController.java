package co.farmagestion.api.auth;

import co.farmagestion.api.common.web.OpenApiConfig;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pacientes/me")
@Tag(name = "Perfil del paciente", description = "Consulta y edición de perfil del paciente autenticado (RF-PAC-03)")
@SecurityRequirement(name = OpenApiConfig.BEARER_AUTH)
public class PerfilPacienteController {

	private final AuthService authService;

	public PerfilPacienteController(AuthService authService) {
		this.authService = authService;
	}

	@GetMapping
	@Operation(summary = "Consultar perfil del paciente")
	public PerfilPacienteResponse obtenerPerfil(@AuthenticationPrincipal Jwt jwt) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return authService.obtenerPerfilPaciente(auth.usuarioId());
	}

	@PutMapping
	@Operation(summary = "Actualizar teléfono o contraseña del paciente", description = "El documento del paciente no es editable (RF-PAC-03).")
	public PerfilPacienteResponse actualizarPerfil(
			@AuthenticationPrincipal Jwt jwt,
			@Valid @RequestBody ActualizarPerfilPacienteRequest request) {
		UsuarioAutenticado auth = UsuarioAutenticado.fromJwt(jwt);
		return authService.actualizarPerfilPaciente(auth.usuarioId(), request);
	}
}
