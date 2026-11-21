package co.farmagestion.api.auth;

import co.farmagestion.api.common.web.ApiException;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

public record UsuarioAutenticado(
		UUID usuarioId,
		RolUsuario rol,
		CargoEmpleado cargo,
		UUID sedeId) {

	public static UsuarioAutenticado fromJwt(Jwt jwt) {
		try {
			UUID usuarioId = UUID.fromString(jwt.getSubject());
			String rolClaim = jwt.getClaimAsString("rol");
			if (rolClaim == null || rolClaim.isBlank()) {
				throw ApiException.unauthorized("TOKEN_INVALIDO", "Token inválido", "El token no contiene el claim rol.");
			}
			RolUsuario rol = RolUsuario.valueOf(rolClaim);

			String cargoClaim = jwt.getClaimAsString("cargo");
			CargoEmpleado cargo = (cargoClaim == null || cargoClaim.isBlank())
					? null
					: CargoEmpleado.valueOf(cargoClaim);

			String sedeClaim = jwt.getClaimAsString("sedeId");
			UUID sedeId = (sedeClaim == null || sedeClaim.isBlank())
					? null
					: UUID.fromString(sedeClaim);

			return new UsuarioAutenticado(usuarioId, rol, cargo, sedeId);
		} catch (ApiException ex) {
			throw ex;
		} catch (IllegalArgumentException ex) {
			throw ApiException.unauthorized("TOKEN_INVALIDO", "Token inválido", "Los claims del token JWT no son válidos.");
		}
	}

	public boolean esAdmin() {
		return rol == RolUsuario.ADMIN;
	}

	public boolean esEmpleado() {
		return rol == RolUsuario.EMPLEADO;
	}

	public boolean esPaciente() {
		return rol == RolUsuario.PACIENTE;
	}
}
