package co.farmagestion.api.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Autenticación", description = "Registro de pacientes e inicio de sesión con JWT HS256")
public class AuthController {

	private final AuthService authService;

	public AuthController(AuthService authService) {
		this.authService = authService;
	}

	@PostMapping("/registro")
	@ResponseStatus(HttpStatus.CREATED)
	@Operation(summary = "Registrar paciente", description = "Crea una cuenta de paciente (RF-PAC-01) y retorna un token JWT.")
	public AuthResponse registrarPaciente(@Valid @RequestBody RegistroPacienteRequest request) {
		return authService.registrarPaciente(request);
	}

	@PostMapping("/login")
	@Operation(summary = "Iniciar sesión", description = "Autentica un paciente, empleado o administrador y retorna un JWT HS256 válido por 2 horas (RF-PAC-02, RF-EMP-01).")
	public AuthResponse login(@Valid @RequestBody LoginRequest request) {
		return authService.login(request);
	}
}
