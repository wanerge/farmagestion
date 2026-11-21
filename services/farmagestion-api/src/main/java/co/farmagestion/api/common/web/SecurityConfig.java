package co.farmagestion.api.common.web;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.ObjectMapper;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

	private static final int MIN_SECRET_BYTES = 32;

	private final String jwtSecret;
	private final String corsAllowedOrigins;
	private final ObjectMapper objectMapper;

	public SecurityConfig(
			@Value("${app.security.jwt-secret}") String jwtSecret,
			@Value("${app.cors.allowed-origins}") String corsAllowedOrigins,
			ObjectMapper objectMapper) {
		this.jwtSecret = jwtSecret;
		this.corsAllowedOrigins = corsAllowedOrigins;
		this.objectMapper = objectMapper;
	}

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
		AuthenticationEntryPoint entryPoint = problemAuthenticationEntryPoint();
		AccessDeniedHandler deniedHandler = problemAccessDeniedHandler();

		return http
				.cors(Customizer.withDefaults())
				.csrf(AbstractHttpConfigurer::disable)
				.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
				.exceptionHandling(ex -> ex
						.authenticationEntryPoint(entryPoint)
						.accessDeniedHandler(deniedHandler))
				.oauth2ResourceServer(oauth2 -> oauth2
						.jwt(jwt -> jwt.jwtAuthenticationConverter(jwtAuthenticationConverter()))
						.authenticationEntryPoint(entryPoint)
						.accessDeniedHandler(deniedHandler))
				.authorizeHttpRequests(auth -> auth
						.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/v1/health").permitAll()
						.requestMatchers("/actuator/health", "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
						.permitAll()
						.requestMatchers(HttpMethod.POST, "/api/v1/auth/registro", "/api/v1/auth/login").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/v1/catalogo/**").permitAll()
						.requestMatchers(HttpMethod.GET, "/api/v1/gestion/public/sala/**").permitAll()
						.requestMatchers("/api/v1/pacientes/me/**").hasRole("PACIENTE")
						.requestMatchers("/api/v1/gestion/admin/**").hasRole("ADMIN")
						.requestMatchers("/api/v1/gestion/**").hasAnyRole("EMPLEADO", "ADMIN")
						.anyRequest().authenticated())
				.build();
	}

	@Bean
	PasswordEncoder passwordEncoder() {
		return new BCryptPasswordEncoder();
	}

	@Bean
	SecretKey jwtSecretKey() {
		byte[] bytes = jwtSecret == null ? new byte[0] : jwtSecret.getBytes(StandardCharsets.UTF_8);
		if (bytes.length < MIN_SECRET_BYTES) {
			throw new IllegalStateException("JWT_SECRET debe tener al menos 32 bytes para firmar con HS256.");
		}
		return new SecretKeySpec(bytes, "HmacSHA256");
	}

	@Bean
	JwtDecoder jwtDecoder(SecretKey jwtSecretKey) {
		return NimbusJwtDecoder.withSecretKey(jwtSecretKey)
				.macAlgorithm(MacAlgorithm.HS256)
				.build();
	}

	@Bean
	JwtEncoder jwtEncoder(SecretKey jwtSecretKey) {
		return new NimbusJwtEncoder(new ImmutableSecret<>(jwtSecretKey));
	}

	@Bean
	JwtAuthenticationConverter jwtAuthenticationConverter() {
		JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
		converter.setJwtGrantedAuthoritiesConverter(jwt -> {
			List<GrantedAuthority> authorities = new ArrayList<>();
			String rol = jwt.getClaimAsString("rol");
			if (rol != null && !rol.isBlank()) {
				authorities.add(new SimpleGrantedAuthority("ROLE_" + rol));
			}
			String cargo = jwt.getClaimAsString("cargo");
			if (cargo != null && !cargo.isBlank()) {
				authorities.add(new SimpleGrantedAuthority("CARGO_" + cargo));
			}
			return authorities;
		});
		return converter;
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource() {
		List<String> origins = Arrays.stream(corsAllowedOrigins.split(","))
				.map(String::trim)
				.filter(s -> !s.isBlank())
				.toList();

		CorsConfiguration config = new CorsConfiguration();
		config.setAllowedOrigins(origins);
		config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"));
		config.setExposedHeaders(List.of("Content-Disposition"));
		config.setAllowCredentials(false);
		config.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", config);
		return source;
	}

	private AuthenticationEntryPoint problemAuthenticationEntryPoint() {
		return (request, response, authException) -> writeProblem(
				response,
				HttpStatus.UNAUTHORIZED,
				"NO_AUTENTICADO",
				"No autenticado",
				"Se requiere un token JWT válido para acceder a este recurso.",
				"https://farmagestion.co/errores/no-autenticado");
	}

	private AccessDeniedHandler problemAccessDeniedHandler() {
		return (request, response, accessDeniedException) -> writeProblem(
				response,
				HttpStatus.FORBIDDEN,
				"ACCESO_DENEGADO",
				"Acceso denegado",
				"No tiene permisos para realizar esta operación.",
				"https://farmagestion.co/errores/acceso-denegado");
	}

	private void writeProblem(
			HttpServletResponse response,
			HttpStatus status,
			String code,
			String title,
			String detail,
			String type) throws IOException {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
		problem.setType(URI.create(type));
		problem.setTitle(title);
		problem.setProperty("code", code);

		response.setStatus(status.value());
		response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
		response.setCharacterEncoding(StandardCharsets.UTF_8.name());
		objectMapper.writeValue(response.getWriter(), problem);
	}
}
