package co.farmagestion.api.auth;

import co.farmagestion.api.catalogo.CatalogoConsultaService;
import co.farmagestion.api.catalogo.SedePublicaResponse;
import co.farmagestion.api.common.web.ApiException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmpleadoAdminService {

	private final UsuarioRepository usuarioRepository;
	private final EmpleadoRepository empleadoRepository;
	private final PasswordEncoder passwordEncoder;
	private final CatalogoConsultaService catalogoConsultaService;

	public EmpleadoAdminService(
			UsuarioRepository usuarioRepository,
			EmpleadoRepository empleadoRepository,
			PasswordEncoder passwordEncoder,
			CatalogoConsultaService catalogoConsultaService) {
		this.usuarioRepository = usuarioRepository;
		this.empleadoRepository = empleadoRepository;
		this.passwordEncoder = passwordEncoder;
		this.catalogoConsultaService = catalogoConsultaService;
	}

	@Transactional(readOnly = true)
	public List<EmpleadoAdminResponse> listarEmpleados() {
		List<Empleado> empleados = empleadoRepository.findAllByOrderByNombresAscApellidosAsc();
		if (empleados.isEmpty()) {
			return List.of();
		}

		List<UUID> usuarioIds = empleados.stream().map(Empleado::getUsuarioId).toList();
		Map<UUID, Usuario> usuariosPorId = new LinkedHashMap<>();
		for (Usuario u : usuarioRepository.findAllByIdIn(usuarioIds)) {
			usuariosPorId.put(u.getId(), u);
		}

		Set<UUID> sedeIds = empleados.stream()
				.map(Empleado::getSedeId)
				.filter(Objects::nonNull)
				.collect(Collectors.toSet());
		Map<UUID, SedePublicaResponse> sedesPorId = catalogoConsultaService.obtenerSedesPorIds(sedeIds);

		return empleados.stream()
				.filter(e -> usuariosPorId.containsKey(e.getUsuarioId()))
				.map(e -> toResponse(usuariosPorId.get(e.getUsuarioId()), e,
						e.getSedeId() == null ? null : sedesPorId.get(e.getSedeId())))
				.toList();
	}

	@Transactional
	public EmpleadoAdminResponse crearEmpleado(CrearEmpleadoRequest request) {
		RolUsuario rol = request.rol() == null ? RolUsuario.EMPLEADO : request.rol();
		validarRolEmpleado(rol);

		String email = request.email().trim().toLowerCase(Locale.ROOT);
		if (usuarioRepository.existsByEmailIgnoreCase(email)) {
			throw ApiException.conflict(
					"EMAIL_YA_REGISTRADO",
					"Correo ya registrado",
					"Ya existe una cuenta registrada con el correo " + email + ".");
		}

		SedePublicaResponse sede = resolverSedeParaRol(rol, request.sedeId());

		Usuario usuario = new Usuario();
		usuario.setEmail(email);
		usuario.setPasswordHash(passwordEncoder.encode(request.password()));
		usuario.setRol(rol);
		usuario.setActivo(request.activo() == null || request.activo());
		Usuario usuarioGuardado = usuarioRepository.saveAndFlush(usuario);

		Empleado empleado = new Empleado();
		empleado.setUsuarioId(usuarioGuardado.getId());
		empleado.setSedeId(sede == null ? null : sede.id());
		empleado.setCargo(request.cargo());
		empleado.setNombres(request.nombres().trim());
		empleado.setApellidos(request.apellidos().trim());
		Empleado empleadoGuardado = empleadoRepository.saveAndFlush(empleado);

		return toResponse(usuarioGuardado, empleadoGuardado, sede);
	}

	@Transactional
	public EmpleadoAdminResponse actualizarEmpleado(
			UsuarioAutenticado adminActual,
			UUID empleadoId,
			ActualizarEmpleadoRequest request) {
		validarRolEmpleado(request.rol());

		Usuario usuario = usuarioRepository.findById(empleadoId)
				.orElseThrow(() -> ApiException.notFound(
						"EMPLEADO_NO_ENCONTRADO",
						"Empleado no encontrado",
						"No existe un empleado con el identificador indicado."));
		Empleado empleado = empleadoRepository.findByUsuarioId(empleadoId)
				.orElseThrow(() -> ApiException.notFound(
						"EMPLEADO_NO_ENCONTRADO",
						"Empleado no encontrado",
						"No existe un registro de empleado para el usuario indicado."));

		if (empleadoId.equals(adminActual.usuarioId()) && Boolean.FALSE.equals(request.activo())) {
			throw ApiException.conflict(
					"NO_AUTO_DESACTIVAR",
					"Operación no permitida",
					"No puedes desactivar tu propia cuenta de administrador.");
		}

		String email = request.email().trim().toLowerCase(Locale.ROOT);
		if (usuarioRepository.existsByEmailIgnoreCaseAndIdNot(email, empleadoId)) {
			throw ApiException.conflict(
					"EMAIL_YA_REGISTRADO",
					"Correo ya registrado",
					"Ya existe otra cuenta registrada con el correo " + email + ".");
		}

		SedePublicaResponse sede = resolverSedeParaRol(request.rol(), request.sedeId());

		usuario.setEmail(email);
		usuario.setRol(request.rol());
		usuario.setActivo(Boolean.TRUE.equals(request.activo()));
		if (request.password() != null && !request.password().isBlank()) {
			usuario.setPasswordHash(passwordEncoder.encode(request.password()));
		}
		Usuario usuarioGuardado = usuarioRepository.saveAndFlush(usuario);

		empleado.setSedeId(sede == null ? null : sede.id());
		empleado.setCargo(request.cargo());
		empleado.setNombres(request.nombres().trim());
		empleado.setApellidos(request.apellidos().trim());
		Empleado empleadoGuardado = empleadoRepository.saveAndFlush(empleado);

		return toResponse(usuarioGuardado, empleadoGuardado, sede);
	}

	private void validarRolEmpleado(RolUsuario rol) {
		if (rol != RolUsuario.EMPLEADO && rol != RolUsuario.ADMIN) {
			throw ApiException.badRequest(
					"ROL_INVALIDO",
					"Rol inválido",
					"El rol de una cuenta administrativa o de empleado debe ser EMPLEADO o ADMIN.");
		}
	}

	private SedePublicaResponse resolverSedeParaRol(RolUsuario rol, UUID sedeId) {
		if (rol == RolUsuario.ADMIN) {
			return null;
		}
		if (sedeId == null) {
			throw ApiException.badRequest(
					"SEDE_REQUERIDA",
					"Sede requerida",
					"Todo empleado debe estar asignado a una sede.");
		}
		return catalogoConsultaService.obtenerSedePorId(sedeId)
				.orElseThrow(() -> ApiException.notFound(
						"SEDE_NO_ENCONTRADA",
						"Sede no encontrada",
						"No existe una sede con el identificador indicado."));
	}

	private EmpleadoAdminResponse toResponse(Usuario usuario, Empleado empleado, SedePublicaResponse sede) {
		return new EmpleadoAdminResponse(
				usuario.getId(),
				usuario.getEmail(),
				usuario.getRol(),
				empleado.getCargo(),
				empleado.getSedeId(),
				sede == null ? null : sede.codigo(),
				sede == null ? null : sede.nombre(),
				empleado.getNombres(),
				empleado.getApellidos(),
				usuario.isActivo(),
				usuario.getCreatedAt());
	}
}
