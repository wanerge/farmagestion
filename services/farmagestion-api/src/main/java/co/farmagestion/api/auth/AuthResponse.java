package co.farmagestion.api.auth;

public record AuthResponse(
		String accessToken,
		String tokenType,
		long expiresIn,
		UsuarioResumenResponse usuario) {
}
