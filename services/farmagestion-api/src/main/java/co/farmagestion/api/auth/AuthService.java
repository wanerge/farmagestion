package co.farmagestion.api.auth;

import co.farmagestion.api.common.web.ApiException;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

	private final UsuarioRepository usuarioRepository;
	private final PacienteRepository pacienteRepository;
	private final EmpleadoRepository empleadoRepository;
	private final PasswordEncoder passwordEncoder;
	private final JwtTokenService jwtTokenService;

	public AuthService(
			UsuarioRepository usuarioRepository,
			PacienteRepository pacienteRepository,
			EmpleadoRepository empleadoRepository,
			PasswordEncoder passwordEncoder,
			JwtTokenService jwtTokenService) {
		this.usuarioRepository = usuarioRepository;
		this.pacienteRepository = pacienteRepository;
		this.empleadoRepository = empleadoRepository;
		this.passwordEncoder = passwordEncoder;
		this.jwtTokenService = jwtTokenService;
	}

	@Transactional
	public AuthResponse registrarPaciente(RegistroPacienteRequest request) {
		String email = request.email().trim().toLowerCase(Locale.ROOT);
		String tipoDocumento = request.tipoDocumento().trim().toUpperCase(Locale.ROOT);
		String documento = request.documento().trim();

		if (usuarioRepository.existsByEmailIgnoreCase(email)) {
			throw ApiException.conflict(
					"EMAIL_YA_REGISTRADO",
					"Correo ya registrado",
					"Ya existe una cuenta registrada con ese correo electrónico.");
		}
		if (pacienteRepository.existsByTipoDocumentoIgnoreCaseAndDocumento(tipoDocumento, documento)) {
			throw ApiException.conflict(
					"DOCUMENTO_YA_REGISTRADO",
					"Documento ya registrado",
					"Ya existe un paciente registrado con ese tipo y número de documento.");
		}

		Usuario usuario = new Usuario();
		usuario.setEmail(email);
		usuario.setPasswordHash(passwordEncoder.encode(request.password()));
		usuario.setRol(RolUsuario.PACIENTE);
		usuario.setActivo(true);
		Usuario guardado = usuarioRepository.save(usuario);

		Paciente paciente = new Paciente();
		paciente.setUsuarioId(guardado.getId());
		paciente.setTipoDocumento(tipoDocumento);
		paciente.setDocumento(documento);
		paciente.setNombres(request.nombres().trim());
		paciente.setApellidos(request.apellidos().trim());
		paciente.setTelefono(request.telefono().trim());
		pacienteRepository.save(paciente);

		String token = jwtTokenService.emitirToken(guardado, null, null);
		UsuarioResumenResponse resumen = new UsuarioResumenResponse(
				guardado.getId(),
				guardado.getEmail(),
				guardado.getRol(),
				null,
				null,
				paciente.getNombres(),
				paciente.getApellidos());
		return new AuthResponse(token, "Bearer", JwtTokenService.EXPIRACION.toSeconds(), resumen);
	}

	@Transactional(readOnly = true)
	public AuthResponse login(LoginRequest request) {
		String email = request.email().trim().toLowerCase(Locale.ROOT);
		Usuario usuario = usuarioRepository.findByEmailIgnoreCase(email)
				.orElseThrow(() -> ApiException.unauthorized(
						"CREDENCIALES_INVALIDAS",
						"Credenciales inválidas",
						"El correo electrónico o la contraseña son incorrectos."));

		if (!passwordEncoder.matches(request.password(), usuario.getPasswordHash())) {
			throw ApiException.unauthorized(
					"CREDENCIALES_INVALIDAS",
					"Credenciales inválidas",
					"El correo electrónico o la contraseña son incorrectos.");
		}

		if (!usuario.isActivo()) {
			throw ApiException.forbidden(
					"USUARIO_INACTIVO",
					"Usuario inactivo",
					"La cuenta de usuario se encuentra desactivada.");
		}

		UUID sedeId = null;
		CargoEmpleado cargo = null;
		String nombres = null;
		String apellidos = null;

		if (usuario.getRol() == RolUsuario.PACIENTE) {
			Paciente paciente = pacienteRepository.findByUsuarioId(usuario.getId()).orElse(null);
			if (paciente != null) {
				nombres = paciente.getNombres();
				apellidos = paciente.getApellidos();
			}
		} else {
			Empleado empleado = empleadoRepository.findByUsuarioId(usuario.getId()).orElse(null);
			if (empleado != null) {
				sedeId = empleado.getSedeId();
				cargo = usuario.getRol() == RolUsuario.EMPLEADO ? empleado.getCargo() : null;
				nombres = empleado.getNombres();
				apellidos = empleado.getApellidos();
			}
		}

		String token = jwtTokenService.emitirToken(usuario, sedeId, cargo);
		UsuarioResumenResponse resumen = new UsuarioResumenResponse(
				usuario.getId(),
				usuario.getEmail(),
				usuario.getRol(),
				cargo,
				sedeId,
				nombres,
				apellidos);
		return new AuthResponse(token, "Bearer", JwtTokenService.EXPIRACION.toSeconds(), resumen);
	}

	@Transactional(readOnly = true)
	public PerfilPacienteResponse obtenerPerfilPaciente(UUID usuarioId) {
		Usuario usuario = usuarioRepository.findById(usuarioId)
				.orElseThrow(() -> ApiException.notFound(
						"PACIENTE_NO_ENCONTRADO",
						"Paciente no encontrado",
						"No se encontró el perfil del paciente autenticado."));
		Paciente paciente = pacienteRepository.findByUsuarioId(usuarioId)
				.orElseThrow(() -> ApiException.notFound(
						"PACIENTE_NO_ENCONTRADO",
						"Paciente no encontrado",
						"No se encontró el perfil del paciente autenticado."));

		return toPerfilResponse(usuario, paciente);
	}

	@Transactional
	public PerfilPacienteResponse actualizarPerfilPaciente(
			UUID usuarioId, ActualizarPerfilPacienteRequest request) {
		Usuario usuario = usuarioRepository.findById(usuarioId)
				.orElseThrow(() -> ApiException.notFound(
						"PACIENTE_NO_ENCONTRADO",
						"Paciente no encontrado",
						"No se encontró el perfil del paciente autenticado."));
		Paciente paciente = pacienteRepository.findByUsuarioId(usuarioId)
				.orElseThrow(() -> ApiException.notFound(
						"PACIENTE_NO_ENCONTRADO",
						"Paciente no encontrado",
						"No se encontró el perfil del paciente autenticado."));

		if (request.telefono() != null) {
			String telefono = request.telefono().trim();
			if (telefono.isBlank()) {
				throw ApiException.badRequest(
						"TELEFONO_INVALIDO",
						"Teléfono inválido",
						"El teléfono no puede quedar vacío.");
			}
			paciente.setTelefono(telefono);
		}

		if (request.passwordNueva() != null && !request.passwordNueva().isBlank()) {
			if (request.passwordActual() == null || request.passwordActual().isBlank()) {
				throw ApiException.badRequest(
						"PASSWORD_ACTUAL_REQUERIDA",
						"Contraseña actual requerida",
						"Debe indicar la contraseña actual para cambiarla.");
			}
			if (!passwordEncoder.matches(request.passwordActual(), usuario.getPasswordHash())) {
				throw ApiException.badRequest(
						"PASSWORD_ACTUAL_INVALIDA",
						"Contraseña actual incorrecta",
						"La contraseña actual no coincide.");
			}
			usuario.setPasswordHash(passwordEncoder.encode(request.passwordNueva()));
		}

		return toPerfilResponse(usuario, paciente);
	}

	@Transactional(readOnly = true)
	public List<UUID> obtenerEmpleadosActivosDeSede(UUID sedeId) {
		return empleadoRepository.findUsuarioIdsActivosBySedeId(sedeId);
	}

	@Transactional(readOnly = true)
	public List<UUID> obtenerAdminsActivos() {
		return usuarioRepository.findIdsActivosByRol(RolUsuario.ADMIN);
	}

	@Transactional(readOnly = true)
	public Optional<PacienteResumen> obtenerPaciente(UUID usuarioId) {
		return pacienteRepository.findByUsuarioId(usuarioId).map(PacienteResumen::from);
	}

	@Transactional(readOnly = true)
	public Map<UUID, PacienteResumen> obtenerPacientesPorIds(Collection<UUID> usuarioIds) {
		if (usuarioIds == null || usuarioIds.isEmpty()) {
			return Collections.emptyMap();
		}
		Map<UUID, PacienteResumen> mapa = new LinkedHashMap<>();
		for (Paciente p : pacienteRepository.findAllByUsuarioIdIn(usuarioIds)) {
			mapa.put(p.getUsuarioId(), PacienteResumen.from(p));
		}
		return mapa;
	}

	@Transactional(readOnly = true)
	public Optional<EmpleadoResumen> obtenerEmpleado(UUID usuarioId) {
		return empleadoRepository.findByUsuarioId(usuarioId).map(EmpleadoResumen::from);
	}

	private PerfilPacienteResponse toPerfilResponse(Usuario usuario, Paciente paciente) {
		return new PerfilPacienteResponse(
				usuario.getId(),
				usuario.getEmail(),
				paciente.getTipoDocumento(),
				paciente.getDocumento(),
				paciente.getNombres(),
				paciente.getApellidos(),
				paciente.getTelefono());
	}
}
