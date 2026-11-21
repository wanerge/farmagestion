package co.farmagestion.api.formulas;

import co.farmagestion.api.auth.AuthService;
import co.farmagestion.api.auth.PacienteResumen;
import co.farmagestion.api.catalogo.CatalogoConsultaService;
import co.farmagestion.api.catalogo.MedicamentoPublicoResponse;
import co.farmagestion.api.catalogo.SedePublicaResponse;
import co.farmagestion.api.common.domain.ParametroService;
import co.farmagestion.api.common.web.ApiException;
import co.farmagestion.api.formulas.FormulaDetalleResponse.FormulaItemDetalleResponse;
import co.farmagestion.api.formulas.FormulaRefSnapshot.FormulaItemSnapshot;
import co.farmagestion.api.formulas.FormulaResumenResponse.DisponibilidadSedeItem;
import co.farmagestion.api.formulas.FormulaResumenResponse.FormulaItemResumenResponse;
import co.farmagestion.api.formulas.SimuladorFormulaResponse.SimuladorFormulaItemDto;
import co.farmagestion.api.inventario.InventarioConsultaService;
import co.farmagestion.api.inventario.NivelDisponibilidad;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class FormulaService {

	private static final Logger log = LoggerFactory.getLogger(FormulaService.class);

	private final FormulaRefRepository formulaRefRepository;
	private final FormulaItemRefRepository formulaItemRefRepository;
	private final SimuladorEpsClient simuladorEpsClient;
	private final AuthService authService;
	private final CatalogoConsultaService catalogoConsultaService;
	private final InventarioConsultaService inventarioConsultaService;
	private final ObjectProvider<ReservasFormulaConsulta> reservasConsultaProvider;
	private final TransactionTemplate transactionTemplate;
	private final Clock clock;

	public FormulaService(
			FormulaRefRepository formulaRefRepository,
			FormulaItemRefRepository formulaItemRefRepository,
			SimuladorEpsClient simuladorEpsClient,
			AuthService authService,
			CatalogoConsultaService catalogoConsultaService,
			InventarioConsultaService inventarioConsultaService,
			ObjectProvider<ReservasFormulaConsulta> reservasConsultaProvider,
			TransactionTemplate transactionTemplate,
			Clock clock) {
		this.formulaRefRepository = formulaRefRepository;
		this.formulaItemRefRepository = formulaItemRefRepository;
		this.simuladorEpsClient = simuladorEpsClient;
		this.authService = authService;
		this.catalogoConsultaService = catalogoConsultaService;
		this.inventarioConsultaService = inventarioConsultaService;
		this.reservasConsultaProvider = reservasConsultaProvider;
		this.transactionTemplate = transactionTemplate;
		this.clock = clock;
	}

	public FormulaDetalleResponse vincularFormula(UUID pacienteId, VincularFormulaRequest request) {
		String codigo = request.codigo().trim().toUpperCase(Locale.ROOT);

		Optional<FormulaRef> existente = formulaRefRepository.findByCodigoExternoIgnoreCase(codigo);
		if (existente.isPresent() && existente.get().getPacienteId().equals(pacienteId)) {
			throw ApiException.conflict(
					"FORMULA_YA_VINCULADA",
					"Fórmula ya vinculada",
					"Esta fórmula ya se encuentra vinculada a tu cuenta.");
		}

		PacienteResumen paciente = obtenerPacienteOBloquear(pacienteId);
		SimuladorFormulaResponse externa = simuladorEpsClient.consultarFormula(codigo, paciente.documento());

		if (existente.isPresent() && !existente.get().getPacienteId().equals(pacienteId)) {
			throw ApiException.notFound(
					"FORMULA_NO_ENCONTRADA",
					"Fórmula no encontrada",
					"No encontramos una fórmula con esos datos.");
		}

		FormulaRef guardada = transactionTemplate.execute(status -> crearCopiaLocal(pacienteId, externa));
		return construirDetalle(guardada, externa);
	}

	@Transactional(readOnly = true)
	public List<FormulaResumenResponse> listarFormulas(UUID pacienteId) {
		List<FormulaRef> formulas = formulaRefRepository
				.findAllByPacienteIdOrderByFechaEmisionDescSincronizadaEnDesc(pacienteId);
		if (formulas.isEmpty()) {
			return List.of();
		}

		List<UUID> formulaIds = formulas.stream().map(FormulaRef::getId).toList();
		List<FormulaItemRef> todosLosItems = formulaItemRefRepository.findAllByFormulaRefIdIn(formulaIds);
		Map<UUID, List<FormulaItemRef>> itemsPorFormula = todosLosItems.stream()
				.collect(Collectors.groupingBy(FormulaItemRef::getFormulaRefId, LinkedHashMap::new, Collectors.toList()));

		Set<UUID> medIds = todosLosItems.stream().map(FormulaItemRef::getMedicamentoId).collect(Collectors.toSet());
		Map<UUID, MedicamentoPublicoResponse> meds = catalogoConsultaService.obtenerMedicamentosPorIds(medIds);
		Map<UUID, Map<UUID, Integer>> reservadasPorFormula = obtenerReservadasPorFormulas(formulaIds);

		LocalDate hoy = hoyBogota();
		List<FormulaResumenResponse> respuesta = new ArrayList<>();
		for (FormulaRef formula : formulas) {
			Map<UUID, Integer> reservadas = reservadasPorFormula.getOrDefault(formula.getId(), Collections.emptyMap());
			List<FormulaItemResumenResponse> itemsDto = itemsPorFormula
					.getOrDefault(formula.getId(), List.of())
					.stream()
					.map(item -> {
						MedicamentoPublicoResponse med = meds.get(item.getMedicamentoId());
						int reservada = reservadas.getOrDefault(item.getMedicamentoId(), 0);
						int pendiente = Math.max(0, item.getCantidadAutorizada() - item.getCantidadDispensada() - reservada);
						return new FormulaItemResumenResponse(
								item.getId(),
								item.getMedicamentoId(),
								med != null ? med.codigo() : null,
								med != null ? med.nombre() : null,
								med != null ? med.presentacion() : null,
								item.getCantidadAutorizada(),
								item.getCantidadDispensada(),
								reservada,
								pendiente);
					})
					.toList();

			respuesta.add(new FormulaResumenResponse(
					formula.getId(),
					formula.getCodigoExterno(),
					formula.getEstadoExterno(),
					formula.getFechaEmision(),
					formula.getFechaVencimiento(),
					esVigente(formula.getEstadoExterno(), formula.getFechaVencimiento(), hoy),
					formula.getSincronizadaEn(),
					itemsDto));
		}
		return respuesta;
	}

	public FormulaDetalleResponse obtenerDetalleFormula(UUID pacienteId, UUID formulaId) {
		FormulaRef formula = formulaRefRepository.findByIdAndPacienteId(formulaId, pacienteId)
				.orElseThrow(() -> ApiException.notFound(
						"FORMULA_NO_ENCONTRADA",
						"Fórmula no encontrada",
						"No se encontró la fórmula solicitada."));

		PacienteResumen paciente = obtenerPacienteOBloquear(pacienteId);
		UUID formulaRefId = formula.getId();
		SimuladorFormulaResponse externa = null;
		try {
			externa = simuladorEpsClient.consultarFormula(formula.getCodigoExterno(), paciente.documento());
			final SimuladorFormulaResponse externaFinal = externa;
			formula = transactionTemplate.execute(status -> actualizarCopiaLocal(formulaRefId, externaFinal));
		} catch (ApiException ex) {
			log.warn("No se pudo refrescar fórmula {} al consultar detalle; se usa copia local: {}",
					formula.getCodigoExterno(), ex.getCode());
		}

		return construirDetalle(formula, externa);
	}

	public PdfFormula descargarPdf(UUID pacienteId, UUID formulaId) {
		FormulaRef formula = formulaRefRepository.findByIdAndPacienteId(formulaId, pacienteId)
				.orElseThrow(() -> ApiException.notFound(
						"FORMULA_NO_ENCONTRADA",
						"Fórmula no encontrada",
						"No se encontró la fórmula solicitada."));
		PacienteResumen paciente = obtenerPacienteOBloquear(pacienteId);
		byte[] pdf = simuladorEpsClient.descargarPdf(formula.getCodigoExterno(), paciente.documento());
		return new PdfFormula(formula.getCodigoExterno(), pdf);
	}

	/**
	 * Refresca la copia local desde el simulador (RN-04) y valida vigencia (RN-PAC-03) antes de crear un pedido.
	 */
	public FormulaRefSnapshot refrescarYValidarParaPedido(UUID pacienteId, UUID formulaId) {
		FormulaRef formula = formulaRefRepository.findByIdAndPacienteId(formulaId, pacienteId)
				.orElseThrow(() -> ApiException.notFound(
						"FORMULA_NO_ENCONTRADA",
						"Fórmula no encontrada",
						"No se encontró la fórmula solicitada."));

		PacienteResumen paciente = obtenerPacienteOBloquear(pacienteId);
		SimuladorFormulaResponse externa = simuladorEpsClient.consultarFormula(
				formula.getCodigoExterno(), paciente.documento());

		FormulaRef actualizada = transactionTemplate.execute(status -> actualizarCopiaLocal(formula.getId(), externa));
		LocalDate hoy = hoyBogota();
		if (!esVigente(actualizada.getEstadoExterno(), actualizada.getFechaVencimiento(), hoy)) {
			throw ApiException.unprocessable(
					"FORMULA_NO_VIGENTE",
					"Fórmula no vigente",
					"La fórmula no está vigente o no admite más dispensaciones (" + actualizada.getEstadoExterno() + ").");
		}

		List<FormulaItemRef> items = formulaItemRefRepository.findAllByFormulaRefId(actualizada.getId());
		Map<UUID, FormulaItemSnapshot> itemsMap = new LinkedHashMap<>();
		for (FormulaItemRef item : items) {
			itemsMap.put(
					item.getMedicamentoId(),
					new FormulaItemSnapshot(
							item.getMedicamentoId(),
							item.getCantidadAutorizada(),
							item.getCantidadDispensada()));
		}

		return new FormulaRefSnapshot(
				actualizada.getId(),
				actualizada.getCodigoExterno(),
				actualizada.getPacienteId(),
				actualizada.getEstadoExterno(),
				actualizada.getFechaEmision(),
				actualizada.getFechaVencimiento(),
				itemsMap);
	}

	@Transactional(readOnly = true)
	public Optional<FormulaRefSnapshot> obtenerSnapshotLocal(UUID formulaId) {
		return formulaRefRepository.findById(formulaId).map(formula -> {
			List<FormulaItemRef> items = formulaItemRefRepository.findAllByFormulaRefId(formula.getId());
			Map<UUID, FormulaItemSnapshot> itemsMap = new LinkedHashMap<>();
			for (FormulaItemRef item : items) {
				itemsMap.put(
						item.getMedicamentoId(),
						new FormulaItemSnapshot(
								item.getMedicamentoId(),
								item.getCantidadAutorizada(),
								item.getCantidadDispensada()));
			}
			return new FormulaRefSnapshot(
					formula.getId(),
					formula.getCodigoExterno(),
					formula.getPacienteId(),
					formula.getEstadoExterno(),
					formula.getFechaEmision(),
					formula.getFechaVencimiento(),
					itemsMap);
		});
	}

	@Transactional(readOnly = true)
	public Map<UUID, String> obtenerCodigosPorIds(Collection<UUID> formulaRefIds) {
		if (formulaRefIds == null || formulaRefIds.isEmpty()) {
			return Collections.emptyMap();
		}
		Map<UUID, String> mapa = new LinkedHashMap<>();
		for (FormulaRef ref : formulaRefRepository.findAllByIdIn(formulaRefIds)) {
			mapa.put(ref.getId(), ref.getCodigoExterno());
		}
		return mapa;
	}

	@Transactional
	public void actualizarDesdeSimulador(String codigoExterno, SimuladorFormulaResponse externa) {
		formulaRefRepository.findByCodigoExternoIgnoreCase(codigoExterno)
				.ifPresent(formula -> actualizarCopiaLocal(formula.getId(), externa));
	}

	/**
	 * Sincroniza copias locales de las fórmulas indicadas (tarea SincronizarFormulas de 00 §11).
	 */
	public int sincronizarFormulas(Collection<UUID> formulaRefIds) {
		if (formulaRefIds == null || formulaRefIds.isEmpty()) {
			return 0;
		}
		List<FormulaRef> formulas = formulaRefRepository.findAllByIdIn(formulaRefIds);
		int actualizadas = 0;
		for (FormulaRef formula : formulas) {
			try {
				Optional<PacienteResumen> pacienteOpt = authService.obtenerPaciente(formula.getPacienteId());
				if (pacienteOpt.isEmpty()) {
					continue;
				}
				SimuladorFormulaResponse externa = simuladorEpsClient.consultarFormula(
						formula.getCodigoExterno(), pacienteOpt.get().documento());
				transactionTemplate.executeWithoutResult(
						status -> actualizarCopiaLocal(formula.getId(), externa));
				actualizadas++;
			} catch (Exception ex) {
				log.warn("No se pudo sincronizar fórmula {}: {}", formula.getCodigoExterno(), ex.getMessage());
			}
		}
		return actualizadas;
	}

	private FormulaRef crearCopiaLocal(UUID pacienteId, SimuladorFormulaResponse externa) {
		FormulaRef formula = new FormulaRef();
		formula.setCodigoExterno(externa.codigo().trim().toUpperCase(Locale.ROOT));
		formula.setPacienteId(pacienteId);
		formula.setEstadoExterno(externa.estado());
		formula.setFechaEmision(externa.fechaEmision());
		formula.setFechaVencimiento(externa.fechaVencimiento());
		formula.setSincronizadaEn(Instant.now(clock));
		FormulaRef guardada = formulaRefRepository.saveAndFlush(formula);

		Map<String, MedicamentoPublicoResponse> medsPorCodigo = resolverMedicamentosExternos(externa.items());
		for (SimuladorFormulaItemDto itemDto : externa.items()) {
			MedicamentoPublicoResponse med = medsPorCodigo.get(itemDto.medicamentoCodigo());
			FormulaItemRef item = new FormulaItemRef();
			item.setFormulaRefId(guardada.getId());
			item.setMedicamentoId(med.id());
			item.setCantidadAutorizada(itemDto.cantidadAutorizada());
			item.setCantidadDispensada(itemDto.cantidadDispensada());
			formulaItemRefRepository.save(item);
		}
		formulaItemRefRepository.flush();
		return guardada;
	}

	private FormulaRef actualizarCopiaLocal(UUID formulaRefId, SimuladorFormulaResponse externa) {
		FormulaRef formula = formulaRefRepository.findById(formulaRefId)
				.orElseThrow(() -> ApiException.notFound(
						"FORMULA_NO_ENCONTRADA",
						"Fórmula no encontrada",
						"No se encontró la fórmula local."));

		formula.setEstadoExterno(externa.estado());
		formula.setFechaEmision(externa.fechaEmision());
		formula.setFechaVencimiento(externa.fechaVencimiento());
		formula.setSincronizadaEn(Instant.now(clock));
		formulaRefRepository.save(formula);

		Map<String, MedicamentoPublicoResponse> medsPorCodigo = resolverMedicamentosExternos(externa.items());
		List<FormulaItemRef> existentes = formulaItemRefRepository.findAllByFormulaRefId(formulaRefId);
		Map<UUID, FormulaItemRef> existentesPorMed = existentes.stream()
				.collect(Collectors.toMap(FormulaItemRef::getMedicamentoId, i -> i));

		for (SimuladorFormulaItemDto itemDto : externa.items()) {
			MedicamentoPublicoResponse med = medsPorCodigo.get(itemDto.medicamentoCodigo());
			FormulaItemRef item = existentesPorMed.get(med.id());
			if (item == null) {
				item = new FormulaItemRef();
				item.setFormulaRefId(formulaRefId);
				item.setMedicamentoId(med.id());
			}
			item.setCantidadAutorizada(itemDto.cantidadAutorizada());
			item.setCantidadDispensada(itemDto.cantidadDispensada());
			formulaItemRefRepository.save(item);
		}
		formulaItemRefRepository.flush();
		return formula;
	}

	private Map<String, MedicamentoPublicoResponse> resolverMedicamentosExternos(
			List<SimuladorFormulaItemDto> items) {
		Set<String> codigos = items.stream()
				.map(SimuladorFormulaItemDto::medicamentoCodigo)
				.collect(Collectors.toSet());
		Map<String, MedicamentoPublicoResponse> encontrados =
				catalogoConsultaService.obtenerMedicamentosPorCodigos(codigos);
		for (String codigo : codigos) {
			if (!encontrados.containsKey(codigo)) {
				throw ApiException.unprocessable(
						"MEDICAMENTO_NO_CATALOGADO",
						"Medicamento no catalogado",
						"El medicamento " + codigo + " de la fórmula no existe en el catálogo local.");
			}
		}
		return encontrados;
	}

	private FormulaDetalleResponse construirDetalle(FormulaRef formula, SimuladorFormulaResponse externa) {
		List<FormulaItemRef> items = formulaItemRefRepository.findAllByFormulaRefId(formula.getId());
		Set<UUID> medIds = items.stream().map(FormulaItemRef::getMedicamentoId).collect(Collectors.toSet());
		Map<UUID, MedicamentoPublicoResponse> meds = catalogoConsultaService.obtenerMedicamentosPorIds(medIds);
		List<SedePublicaResponse> sedesActivas = catalogoConsultaService.listarSedesActivas();
		Map<UUID, Map<UUID, NivelDisponibilidad>> nivelesPorMed =
				inventarioConsultaService.obtenerNivelesPorMedicamentos(medIds);
		Map<UUID, Integer> reservadasPorMed = obtenerReservadasPorFormula(formula.getId());

		Map<String, SimuladorFormulaItemDto> externosPorCodigo = new LinkedHashMap<>();
		if (externa != null && externa.items() != null) {
			for (SimuladorFormulaItemDto dto : externa.items()) {
				externosPorCodigo.put(dto.medicamentoCodigo(), dto);
			}
		}

		List<FormulaItemDetalleResponse> itemsDto = new ArrayList<>();
		for (FormulaItemRef item : items) {
			MedicamentoPublicoResponse med = meds.get(item.getMedicamentoId());
			SimuladorFormulaItemDto ext = med != null ? externosPorCodigo.get(med.codigo()) : null;
			int reservada = reservadasPorMed.getOrDefault(item.getMedicamentoId(), 0);
			int pendiente = Math.max(0, item.getCantidadAutorizada() - item.getCantidadDispensada() - reservada);

			Map<UUID, NivelDisponibilidad> nivelesMed =
					nivelesPorMed.getOrDefault(item.getMedicamentoId(), Collections.emptyMap());
			List<DisponibilidadSedeItem> dispPorSede = sedesActivas.stream()
					.map(sede -> new DisponibilidadSedeItem(
							sede.id(),
							sede.codigo(),
							sede.nombre(),
							nivelesMed.getOrDefault(sede.id(), NivelDisponibilidad.AGOTADO)))
					.toList();

			itemsDto.add(new FormulaItemDetalleResponse(
					item.getId(),
					item.getMedicamentoId(),
					med != null ? med.codigo() : null,
					med != null ? med.nombre() : null,
					med != null ? med.principioActivo() : null,
					med != null ? med.presentacion() : null,
					ext != null ? ext.dosis() : null,
					ext != null ? ext.frecuencia() : null,
					ext != null ? ext.duracionDias() : null,
					item.getCantidadAutorizada(),
					item.getCantidadDispensada(),
					reservada,
					pendiente,
					dispPorSede));
		}

		LocalDate hoy = hoyBogota();
		return new FormulaDetalleResponse(
				formula.getId(),
				formula.getCodigoExterno(),
				formula.getEstadoExterno(),
				formula.getFechaEmision(),
				formula.getFechaVencimiento(),
				esVigente(formula.getEstadoExterno(), formula.getFechaVencimiento(), hoy),
				externa != null ? externa.observaciones() : null,
				externa != null && externa.medico() != null ? externa.medico().nombre() : null,
				formula.getSincronizadaEn(),
				itemsDto);
	}

	private PacienteResumen obtenerPacienteOBloquear(UUID pacienteId) {
		return authService.obtenerPaciente(pacienteId)
				.orElseThrow(() -> ApiException.notFound(
						"PACIENTE_NO_ENCONTRADO",
						"Paciente no encontrado",
						"No se encontró el perfil del paciente autenticado."));
	}

	private Map<UUID, Integer> obtenerReservadasPorFormula(UUID formulaRefId) {
		ReservasFormulaConsulta consulta = reservasConsultaProvider.getIfAvailable();
		return consulta == null
				? Collections.emptyMap()
				: consulta.obtenerCantidadReservadaActivaPorMedicamento(formulaRefId);
	}

	private Map<UUID, Map<UUID, Integer>> obtenerReservadasPorFormulas(Collection<UUID> formulaRefIds) {
		ReservasFormulaConsulta consulta = reservasConsultaProvider.getIfAvailable();
		return consulta == null
				? Collections.emptyMap()
				: consulta.obtenerCantidadReservadaActivaPorFormulas(formulaRefIds);
	}

	private LocalDate hoyBogota() {
		return LocalDate.now(clock.withZone(ParametroService.ZONA_NEGOCIO));
	}

	static boolean esVigente(EstadoFormulaExterna estado, LocalDate fechaVencimiento, LocalDate hoy) {
		boolean estadoPermite = estado == EstadoFormulaExterna.EMITIDA
				|| estado == EstadoFormulaExterna.PARCIALMENTE_DISPENSADA;
		return estadoPermite && fechaVencimiento != null && !fechaVencimiento.isBefore(hoy);
	}
}
