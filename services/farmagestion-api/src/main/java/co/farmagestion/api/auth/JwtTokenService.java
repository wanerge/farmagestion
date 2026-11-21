package co.farmagestion.api.auth;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class JwtTokenService {

	public static final Duration EXPIRACION = Duration.ofHours(2);

	private final JwtEncoder jwtEncoder;

	public JwtTokenService(JwtEncoder jwtEncoder) {
		this.jwtEncoder = jwtEncoder;
	}

	public String emitirToken(Usuario usuario, UUID sedeId, CargoEmpleado cargo) {
		Instant ahora = Instant.now();
		JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
				.subject(usuario.getId().toString())
				.issuedAt(ahora)
				.expiresAt(ahora.plus(EXPIRACION))
				.claim("rol", usuario.getRol().name())
				.claim("email", usuario.getEmail());

		if (sedeId != null) {
			claims.claim("sedeId", sedeId.toString());
		}
		if (usuario.getRol() == RolUsuario.EMPLEADO && cargo != null) {
			claims.claim("cargo", cargo.name());
		}

		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
		return jwtEncoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
	}
}
