package co.farmagestion.api.catalogo;

import co.farmagestion.api.common.web.ApiException;
import co.farmagestion.api.common.web.PaginaResponse;
import co.farmagestion.api.inventario.InventarioOperacionesService;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogoAdminService {

	private static final int MAX_PAGE_SIZE = 100;

	private final SedeRepository sedeRepository;
	private final MedicamentoRepository medicamentoRepository;
	private final InventarioOperacionesService inventarioOperacionesService;

	public CatalogoAdminService(
			SedeRepository sedeRepository,
			MedicamentoRepository medicamentoRepository,
			InventarioOperacionesService inventarioOperacionesService) {
		this.sedeRepository = sedeRepository;
		this.medicamentoRepository = medicamentoRepository;
		this.inventarioOperacionesService = inventarioOperacionesService;
	}

	@Transactional(readOnly = true)
	public List<SedeAdminResponse> listarSedes() {
		return sedeRepository.findAllByOrderByNombreAsc().stream()
				.map(SedeAdminResponse::from)
				.toList();
	}

	@Transactional
	public SedeAdminResponse crearSede(CrearSedeRequest request) {
		String codigo = normalizarCodigo(request.codigo());
		if (sedeRepository.existsByCodigoIgnoreCase(codigo)) {
			throw ApiException.conflict(
					"SEDE_CODIGO_DUPLICADO",
					"Código de sede duplicado",
					"Ya existe una sede registrada con el código " + codigo + ".");
		}
		validarHorario(request.horaApertura(), request.horaCierre());

		boolean activa = request.activa() == null || request.activa();
		Sede sede = new Sede();
		sede.setCodigo(codigo);
		sede.setNombre(request.nombre().trim());
		sede.setDireccion(request.direccion().trim());
		sede.setLatitud(request.latitud());
		sede.setLongitud(request.longitud());
		sede.setHoraApertura(request.horaApertura());
		sede.setHoraCierre(request.horaCierre());
		sede.setActiva(activa);

		Sede guardada = sedeRepository.saveAndFlush(sede);

		if (guardada.isActiva()) {
			List<UUID> medsActivos = medicamentoRepository.findAllByActivoTrueOrderByNombreAsc().stream()
					.map(Medicamento::getId)
					.toList();
			inventarioOperacionesService.inicializarInventarioEnCeroParaMedicamentos(guardada.getId(), medsActivos);
		}

		return SedeAdminResponse.from(guardada);
	}

	@Transactional
	public SedeAdminResponse actualizarSede(UUID sedeId, ActualizarSedeRequest request) {
		Sede sede = sedeRepository.findById(sedeId)
				.orElseThrow(() -> ApiException.notFound(
						"SEDE_NO_ENCONTRADA",
						"Sede no encontrada",
						"No existe una sede con el identificador indicado."));

		String codigo = normalizarCodigo(request.codigo());
		if (sedeRepository.existsByCodigoIgnoreCaseAndIdNot(codigo, sedeId)) {
			throw ApiException.conflict(
					"SEDE_CODIGO_DUPLICADO",
					"Código de sede duplicado",
					"Ya existe otra sede registrada con el código " + codigo + ".");
		}
		validarHorario(request.horaApertura(), request.horaCierre());

		boolean estabaInactiva = !sede.isActiva();
		sede.setCodigo(codigo);
		sede.setNombre(request.nombre().trim());
		sede.setDireccion(request.direccion().trim());
		sede.setLatitud(request.latitud());
		sede.setLongitud(request.longitud());
		sede.setHoraApertura(request.horaApertura());
		sede.setHoraCierre(request.horaCierre());
		sede.setActiva(Boolean.TRUE.equals(request.activa()));

		Sede guardada = sedeRepository.saveAndFlush(sede);

		if (estabaInactiva && guardada.isActiva()) {
			List<UUID> medsActivos = medicamentoRepository.findAllByActivoTrueOrderByNombreAsc().stream()
					.map(Medicamento::getId)
					.toList();
			inventarioOperacionesService.inicializarInventarioEnCeroParaMedicamentos(guardada.getId(), medsActivos);
		}

		return SedeAdminResponse.from(guardada);
	}

	@Transactional(readOnly = true)
	public PaginaResponse<MedicamentoAdminResponse> listarMedicamentos(
			String q,
			Boolean activo,
			int page,
			int size) {
		int pagina = Math.max(0, page);
		int tamano = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
		String filtro = q == null ? "" : q.trim();
		String estadoFiltro = activo == null ? "TODOS" : (activo ? "ACTIVOS" : "INACTIVOS");

		Page<MedicamentoAdminResponse> resultados = medicamentoRepository
				.buscarAdmin(filtro, estadoFiltro, PageRequest.of(pagina, tamano))
				.map(MedicamentoAdminResponse::from);
		return PaginaResponse.of(resultados);
	}

	/**
	 * Crea un medicamento y genera registros de inventario en cero para cada sede activa (RF-EMP-32).
	 */
	@Transactional
	public MedicamentoAdminResponse crearMedicamento(CrearMedicamentoRequest request) {
		String codigo = normalizarCodigo(request.codigo());
		if (medicamentoRepository.existsByCodigoIgnoreCase(codigo)) {
			throw ApiException.conflict(
					"MEDICAMENTO_CODIGO_DUPLICADO",
					"Código de medicamento duplicado",
					"Ya existe un medicamento registrado con el código " + codigo + ".");
		}

		Medicamento medicamento = new Medicamento();
		medicamento.setCodigo(codigo);
		medicamento.setNombre(request.nombre().trim());
		medicamento.setPrincipioActivo(request.principioActivo().trim());
		medicamento.setPresentacion(request.presentacion().trim());
		medicamento.setActivo(request.activo() == null || request.activo());

		Medicamento guardado = medicamentoRepository.saveAndFlush(medicamento);

		List<UUID> sedesActivas = sedeRepository.findAllByActivaTrueOrderByNombreAsc().stream()
				.map(Sede::getId)
				.toList();
		inventarioOperacionesService.inicializarInventarioEnCeroParaSedes(guardado.getId(), sedesActivas);

		return MedicamentoAdminResponse.from(guardado);
	}

	@Transactional
	public MedicamentoAdminResponse actualizarMedicamento(UUID medicamentoId, ActualizarMedicamentoRequest request) {
		Medicamento medicamento = medicamentoRepository.findById(medicamentoId)
				.orElseThrow(() -> ApiException.notFound(
						"MEDICAMENTO_NO_ENCONTRADO",
						"Medicamento no encontrado",
						"No existe un medicamento con el identificador indicado."));

		String codigo = normalizarCodigo(request.codigo());
		if (medicamentoRepository.existsByCodigoIgnoreCaseAndIdNot(codigo, medicamentoId)) {
			throw ApiException.conflict(
					"MEDICAMENTO_CODIGO_DUPLICADO",
					"Código de medicamento duplicado",
					"Ya existe otro medicamento registrado con el código " + codigo + ".");
		}

		medicamento.setCodigo(codigo);
		medicamento.setNombre(request.nombre().trim());
		medicamento.setPrincipioActivo(request.principioActivo().trim());
		medicamento.setPresentacion(request.presentacion().trim());
		medicamento.setActivo(Boolean.TRUE.equals(request.activo()));

		Medicamento guardado = medicamentoRepository.saveAndFlush(medicamento);
		return MedicamentoAdminResponse.from(guardado);
	}

	private String normalizarCodigo(String codigo) {
		return codigo.trim().toUpperCase(Locale.ROOT);
	}

	private void validarHorario(LocalTime apertura, LocalTime cierre) {
		if (!cierre.isAfter(apertura)) {
			throw ApiException.badRequest(
					"HORARIO_INVALIDO",
					"Horario inválido",
					"La hora de cierre debe ser posterior a la hora de apertura.");
		}
	}
}
