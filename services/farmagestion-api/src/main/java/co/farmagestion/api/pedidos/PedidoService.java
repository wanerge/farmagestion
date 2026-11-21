package co.farmagestion.api.pedidos;

import co.farmagestion.api.auth.AuthService;
import co.farmagestion.api.auth.PacienteResumen;
import co.farmagestion.api.auth.UsuarioAutenticado;
import co.farmagestion.api.catalogo.CatalogoConsultaService;
import co.farmagestion.api.catalogo.MedicamentoPublicoResponse;
import co.farmagestion.api.catalogo.SedePublicaResponse;
import co.farmagestion.api.common.domain.ParametroService;
import co.farmagestion.api.common.web.ApiException;
import co.farmagestion.api.common.web.PaginaResponse;
import co.farmagestion.api.formulas.FormulaRefSnapshot;
import co.farmagestion.api.formulas.FormulaRefSnapshot.FormulaItemSnapshot;
import co.farmagestion.api.formulas.FormulaService;
import co.farmagestion.api.integracion.DispensacionOutboxPayload;
import co.farmagestion.api.integracion.DispensacionOutboxPayload.DispensacionOutboxItem;
import co.farmagestion.api.integracion.OutboxService;
import co.farmagestion.api.inventario.EstadoReservaItem;
import co.farmagestion.api.inventario.InventarioOperacionesService;
import co.farmagestion.api.inventario.ResultadoReserva;
import co.farmagestion.api.inventario.ResultadoReservaItem;
import co.farmagestion.api.inventario.SolicitudStockItem;
import co.farmagestion.api.pedidos.CrearPedidoRequest.ItemSolicitud;
import co.farmagestion.api.pedidos.PedidoDetalleResponse.PedidoHistorialResponse;
import co.farmagestion.api.pedidos.PedidoDetalleResponse.PedidoItemResponse;
import co.farmagestion.api.turnos.TurnoCreado;
import co.farmagestion.api.turnos.TurnoResponse;
import co.farmagestion.api.turnos.TurnoService;
import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

@Service
public class PedidoService {

	static final int MAX_PEDIDOS_ACTIVOS_PACIENTE = 3;
	static final int MAX_PAGE_SIZE = 100;

	static final Set<EstadoPedido> ESTADOS_ACTIVOS = EnumSet.of(
			EstadoPedido.RESERVADO,
			EstadoPedido.EN_PREPARACION,
			EstadoPedido.LISTO,
			EstadoPedido.EN_RUTA);

	static final Set<EstadoPedido> ESTADOS_EXPIRABLES = EnumSet.of(
			EstadoPedido.RESERVADO,
			EstadoPedido.EN_PREPARACION,
			EstadoPedido.LISTO);

	static final Set<EstadoPedido> ESTADOS_CANCELABLES_PACIENTE = EnumSet.of(
			EstadoPedido.RESERVADO,
			EstadoPedido.EN_PREPARACION,
			EstadoPedido.LISTO);

	static final Set<EstadoPedido> ESTADOS_CANCELABLES_EMPLEADO = EnumSet.of(
			EstadoPedido.RESERVADO,
			EstadoPedido.EN_PREPARACION,
			EstadoPedido.LISTO,
			EstadoPedido.EN_RUTA);

	private final PedidoRepository pedidoRepository;
	private final PedidoItemRepository pedidoItemRepository;
	private final PedidoHistorialRepository pedidoHistorialRepository;
	private final FormulaService formulaService;
	private final InventarioOperacionesService inventarioOperacionesService;
	private final TurnoService turnoService;
	private final OutboxService outboxService;
	private final CatalogoConsultaService catalogoConsultaService;
	private final AuthService authService;
	private final ParametroService parametroService;
	private final ApplicationEventPublisher eventPublisher;
	private final TransactionTemplate transactionTemplate;
	private final TransactionTemplate requiresNewTxTemplate;
	private final Clock clock;

	public PedidoService(
			PedidoRepository pedidoRepository,
			PedidoItemRepository pedidoItemRepository,
			PedidoHistorialRepository pedidoHistorialRepository,
			FormulaService formulaService,
			InventarioOperacionesService inventarioOperacionesService,
			TurnoService turnoService,
			OutboxService outboxService,
			CatalogoConsultaService catalogoConsultaService,
			AuthService authService,
			ParametroService parametroService,
			ApplicationEventPublisher eventPublisher,
			PlatformTransactionManager transactionManager,
			Clock clock) {
		this.pedidoRepository = pedidoRepository;
		this.pedidoItemRepository = pedidoItemRepository;
		this.pedidoHistorialRepository = pedidoHistorialRepository;
		this.formulaService = formulaService;
		this.inventarioOperacionesService = inventarioOperacionesService;
		this.turnoService = turnoService;
		this.outboxService = outboxService;
		this.catalogoConsultaService = catalogoConsultaService;
		this.authService = authService;
		this.parametroService = parametroService;
		this.eventPublisher = eventPublisher;
		this.transactionTemplate = new TransactionTemplate(transactionManager);
		this.requiresNewTxTemplate = new TransactionTemplate(transactionManager);
		this.requiresNewTxTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
		this.clock = clock;
	}

	/**
	 * Crea un pedido con refresco previo de fórmula (RN-04), reserva atómica (RN-01),
	 * manejo de parciales (RN-02), validación de saldo pendiente (RN-03) y turno (RN-PAC-05).
	 */
	public PedidoDetalleResponse crearPedido(UUID pacienteId, CrearPedidoRequest request) {
		validarDatosModalidad(request);
		Map<UUID, Integer> itemsSolicitados = consolidarItems(request.items());

		SedePublicaResponse sede = catalogoConsultaService.obtenerSedeActivaPorId(request.sedeId())
				.orElseThrow(() -> ApiException.notFound(
						"SEDE_NO_ENCONTRADA",
						"Sede no encontrada",
						"No existe una sede activa con el identificador indicado."));

		if (request.modalidad() == ModalidadPedido.RECOGER) {
			turnoService.validarFranjaSinBloquear(sede, request.franjaInicio());
		}

		expirarReservasVencidasDePaciente(pacienteId);

		if (pedidoRepository.countByPacienteIdAndEstadoIn(pacienteId, ESTADOS_ACTIVOS) >= MAX_PEDIDOS_ACTIVOS_PACIENTE) {
			throw ApiException.conflict(
					"LIMITE_PEDIDOS_ACTIVOS",
					"Límite de pedidos activos alcanzado",
					"No puedes tener más de " + MAX_PEDIDOS_ACTIVOS_PACIENTE + " pedidos activos al mismo tiempo.");
		}

		// RN-04: refresco obligatorio contra simulador fuera de bloqueos de inventario
		FormulaRefSnapshot formula = formulaService.refrescarYValidarParaPedido(pacienteId, request.formulaId());

		UUID pedidoId = transactionTemplate.execute(status -> {
			// Bloqueos transaccionales ordenados para evitar condiciones de carrera en RN-PAC-04 y RN-03
			pedidoRepository.adquirirBloqueoTransaccional("paciente:" + pacienteId);
			pedidoRepository.adquirirBloqueoTransaccional("formula:" + formula.id());

			long activos = pedidoRepository.countByPacienteIdAndEstadoIn(pacienteId, ESTADOS_ACTIVOS);
			if (activos >= MAX_PEDIDOS_ACTIVOS_PACIENTE) {
				throw ApiException.conflict(
						"LIMITE_PEDIDOS_ACTIVOS",
						"Límite de pedidos activos alcanzado",
						"No puedes tener más de " + MAX_PEDIDOS_ACTIVOS_PACIENTE + " pedidos activos al mismo tiempo.");
			}

			validarSaldoPendienteFormula(formula, itemsSolicitados);

			Instant ahora = Instant.now(clock);
			int ttlDomicilioHoras = parametroService.obtenerEntero(ParametroService.RESERVA_TTL_DOMICILIO_HORAS, 24);

			Pedido pedido = new Pedido();
			pedido.setCodigo(generarCodigoPedido());
			pedido.setPacienteId(pacienteId);
			pedido.setFormulaRefId(formula.id());
			pedido.setSedeId(sede.id());
			pedido.setModalidad(request.modalidad());
			pedido.setEstado(EstadoPedido.RESERVADO);
			pedido.setEsParcial(false);
			if (request.modalidad() == ModalidadPedido.DOMICILIO) {
				pedido.setDireccionEntrega(request.direccionEntrega().trim());
				pedido.setLatitudEntrega(request.latitudEntrega());
				pedido.setLongitudEntrega(request.longitudEntrega());
			}
			pedido.setIntentosEntrega(0);
			pedido.setExpiraEn(ahora.plus(ttlDomicilioHoras, ChronoUnit.HOURS));
			pedido.setUpdatedAt(ahora);
			Pedido guardado = pedidoRepository.saveAndFlush(pedido);

			List<SolicitudStockItem> solicitudStock = itemsSolicitados.entrySet().stream()
					.map(e -> new SolicitudStockItem(e.getKey(), e.getValue()))
					.toList();

			ResultadoReserva reserva = inventarioOperacionesService.reservar(
					sede.id(),
					solicitudStock,
					request.aceptaParcial(),
					"PEDIDO",
					guardado.getId(),
					pacienteId);

			guardado.setEsParcial(reserva.esParcial());

			String codigoTurno = null;
			if (request.modalidad() == ModalidadPedido.RECOGER) {
				TurnoCreado turnoCreado = turnoService.crearTurnoParaPedido(
						guardado.getId(), sede, request.franjaInicio());
				guardado.setExpiraEn(turnoCreado.expiraEn());
				codigoTurno = turnoCreado.turno().codigo();
			}
			pedidoRepository.saveAndFlush(guardado);

			for (ResultadoReservaItem itemRes : reserva.items()) {
				PedidoItem item = new PedidoItem();
				item.setPedidoId(guardado.getId());
				item.setMedicamentoId(itemRes.medicamentoId());
				item.setCantidadSolicitada(itemRes.solicitada());
				item.setCantidadReservada(itemRes.reservada());
				item.setCantidadEntregada(0);
				item.setEstadoItem(mapearEstadoItem(itemRes.estadoItem()));
				pedidoItemRepository.save(item);
			}
			pedidoItemRepository.flush();

			registrarHistorial(
					guardado.getId(),
					null,
					EstadoPedido.RESERVADO,
					pacienteId,
					reserva.esParcial() ? "Pedido creado parcialmente" : "Pedido creado");

			eventPublisher.publishEvent(new PedidoCreadoEvent(
					guardado.getId(),
					guardado.getCodigo(),
					pacienteId,
					sede.id(),
					guardado.getModalidad(),
					guardado.isEsParcial(),
					codigoTurno));

			return guardado.getId();
		});

		return construirDetallePorId(pedidoId);
	}

	@Transactional
	public PaginaResponse<PedidoResumenResponse> listarPedidosPaciente(
			UUID pacienteId,
			EstadoPedido estado,
			int page,
			int size) {
		expirarReservasVencidasDePaciente(pacienteId);

		int pagina = Math.max(0, page);
		int tamano = Math.min(Math.max(1, size), MAX_PAGE_SIZE);

		Specification<Pedido> spec = (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			predicates.add(cb.equal(root.get("pacienteId"), pacienteId));
			if (estado != null) {
				predicates.add(cb.equal(root.get("estado"), estado));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};

		Page<Pedido> resultados = pedidoRepository.findAll(
				spec,
				PageRequest.of(pagina, tamano, Sort.by("createdAt").descending().and(Sort.by("id").descending())));
		return construirPaginaResumen(resultados);
	}

	public PedidoDetalleResponse obtenerDetallePaciente(UUID pacienteId, UUID pedidoId) {
		Pedido pedido = pedidoRepository.findByIdAndPacienteId(pedidoId, pacienteId)
				.orElseThrow(() -> ApiException.notFound(
						"PEDIDO_NO_ENCONTRADO",
						"Pedido no encontrado",
						"No se encontró el pedido solicitado."));
		expirarSiVencido(pedido.getId());
		return construirDetallePorId(pedido.getId());
	}

	public PedidoDetalleResponse cancelarPedidoPaciente(
			UUID pacienteId,
			UUID pedidoId,
			NotaOpcionalRequest request) {
		Pedido existente = pedidoRepository.findByIdAndPacienteId(pedidoId, pacienteId)
				.orElseThrow(() -> ApiException.notFound(
						"PEDIDO_NO_ENCONTRADO",
						"Pedido no encontrado",
						"No se encontró el pedido solicitado."));
		expirarSiVencido(existente.getId());

		transactionTemplate.executeWithoutResult(status -> {
			Pedido pedido = pedidoRepository.findByIdAndPacienteIdForUpdate(pedidoId, pacienteId)
					.orElseThrow(() -> ApiException.notFound(
							"PEDIDO_NO_ENCONTRADO",
							"Pedido no encontrado",
							"No se encontró el pedido solicitado."));

			if (!ESTADOS_CANCELABLES_PACIENTE.contains(pedido.getEstado())) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Transición inválida",
						"No es posible cancelar un pedido en estado " + pedido.getEstado() + ".");
			}

			String nota = (request == null || request.nota() == null || request.nota().isBlank())
					? "Cancelado por el paciente"
					: request.nota().trim();
			ejecutarCancelacion(pedido, pacienteId, nota);
		});

		return construirDetallePorId(pedidoId);
	}

	@Transactional
	public PaginaResponse<PedidoResumenResponse> listarPedidosGestion(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			EstadoPedido estado,
			ModalidadPedido modalidad,
			LocalDate fecha,
			int page,
			int size) {
		UUID sedeObjetivo = resolverSedeOperacion(auth, sedeIdSolicitada, false);
		if (sedeObjetivo != null) {
			expirarReservasVencidasDeSede(sedeObjetivo);
		} else {
			expirarReservasVencidas();
		}

		int pagina = Math.max(0, page);
		int tamano = Math.min(Math.max(1, size), MAX_PAGE_SIZE);

		Instant inicioDia = fecha == null ? null : fecha.atStartOfDay(ParametroService.ZONA_NEGOCIO).toInstant();
		Instant finDia = fecha == null
				? null
				: fecha.plusDays(1).atStartOfDay(ParametroService.ZONA_NEGOCIO).toInstant().minusNanos(1);

		Specification<Pedido> spec = (root, query, cb) -> {
			List<Predicate> predicates = new ArrayList<>();
			if (sedeObjetivo != null) {
				predicates.add(cb.equal(root.get("sedeId"), sedeObjetivo));
			}
			if (estado != null) {
				predicates.add(cb.equal(root.get("estado"), estado));
			}
			if (modalidad != null) {
				predicates.add(cb.equal(root.get("modalidad"), modalidad));
			}
			if (inicioDia != null) {
				predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), inicioDia));
				predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), finDia));
			}
			return cb.and(predicates.toArray(Predicate[]::new));
		};

		// RF-EMP-08: ordenados por urgencia (vencimiento de reserva más próximo)
		Page<Pedido> resultados = pedidoRepository.findAll(
				spec,
				PageRequest.of(pagina, tamano, Sort.by("expiraEn").ascending().and(Sort.by("createdAt").ascending())));
		return construirPaginaResumen(resultados);
	}

	public PedidoDetalleResponse obtenerDetalleGestion(UsuarioAutenticado auth, UUID pedidoId) {
		Pedido pedido = pedidoRepository.findById(pedidoId)
				.orElseThrow(() -> ApiException.notFound(
						"PEDIDO_NO_ENCONTRADO",
						"Pedido no encontrado",
						"No se encontró el pedido solicitado."));
		verificarAccesoSede(auth, pedido.getSedeId());
		expirarSiVencido(pedido.getId());
		return construirDetallePorId(pedido.getId());
	}

	public PedidoDetalleResponse tomarPedido(
			UsuarioAutenticado auth,
			UUID pedidoId,
			NotaOpcionalRequest request) {
		Pedido previo = pedidoRepository.findById(pedidoId)
				.orElseThrow(() -> ApiException.notFound(
						"PEDIDO_NO_ENCONTRADO",
						"Pedido no encontrado",
						"No se encontró el pedido solicitado."));
		verificarAccesoSede(auth, previo.getSedeId());
		expirarSiVencido(previo.getId());

		transactionTemplate.executeWithoutResult(status -> {
			Pedido pedido = pedidoRepository.findByIdForUpdate(pedidoId)
					.orElseThrow(() -> ApiException.notFound(
							"PEDIDO_NO_ENCONTRADO",
							"Pedido no encontrado",
							"No se encontró el pedido solicitado."));
			verificarAccesoSede(auth, pedido.getSedeId());

			if (pedido.getEstado() != EstadoPedido.RESERVADO) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Transición inválida",
						"Solo se puede tomar un pedido en estado RESERVADO (estado actual: " + pedido.getEstado() + ").");
			}

			Instant ahora = Instant.now(clock);
			EstadoPedido anterior = pedido.getEstado();
			pedido.setEstado(EstadoPedido.EN_PREPARACION);
			pedido.setAsignadoA(auth.usuarioId());
			pedido.setUpdatedAt(ahora);
			pedidoRepository.save(pedido);

			String nota = (request == null || request.nota() == null || request.nota().isBlank())
					? "Pedido tomado para preparación"
					: request.nota().trim();
			registrarHistorial(pedido.getId(), anterior, EstadoPedido.EN_PREPARACION, auth.usuarioId(), nota);

			eventPublisher.publishEvent(new PedidoEstadoCambiadoEvent(
					pedido.getId(), pedido.getCodigo(), pedido.getPacienteId(), pedido.getSedeId(),
					anterior, EstadoPedido.EN_PREPARACION, nota));
		});

		return construirDetallePorId(pedidoId);
	}

	public PedidoDetalleResponse marcarListo(
			UsuarioAutenticado auth,
			UUID pedidoId,
			NotaOpcionalRequest request) {
		Pedido previo = pedidoRepository.findById(pedidoId)
				.orElseThrow(() -> ApiException.notFound(
						"PEDIDO_NO_ENCONTRADO",
						"Pedido no encontrado",
						"No se encontró el pedido solicitado."));
		verificarAccesoSede(auth, previo.getSedeId());
		expirarSiVencido(previo.getId());

		transactionTemplate.executeWithoutResult(status -> {
			Pedido pedido = pedidoRepository.findByIdForUpdate(pedidoId)
					.orElseThrow(() -> ApiException.notFound(
							"PEDIDO_NO_ENCONTRADO",
							"Pedido no encontrado",
							"No se encontró el pedido solicitado."));
			verificarAccesoSede(auth, pedido.getSedeId());

			if (pedido.getEstado() != EstadoPedido.EN_PREPARACION) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Transición inválida",
						"Solo se puede marcar LISTO un pedido EN_PREPARACION (estado actual: " + pedido.getEstado() + ").");
			}
			verificarPropietarioPreparacion(auth, pedido);

			Instant ahora = Instant.now(clock);
			EstadoPedido anterior = pedido.getEstado();
			pedido.setEstado(EstadoPedido.LISTO);
			pedido.setListoEn(ahora);
			pedido.setUpdatedAt(ahora);
			pedidoRepository.save(pedido);

			String nota = (request == null || request.nota() == null || request.nota().isBlank())
					? "Pedido listo para entrega"
					: request.nota().trim();
			registrarHistorial(pedido.getId(), anterior, EstadoPedido.LISTO, auth.usuarioId(), nota);

			eventPublisher.publishEvent(new PedidoEstadoCambiadoEvent(
					pedido.getId(), pedido.getCodigo(), pedido.getPacienteId(), pedido.getSedeId(),
					anterior, EstadoPedido.LISTO, nota));
		});

		return construirDetallePorId(pedidoId);
	}

	public PedidoDetalleResponse entregarPedidoRecoger(
			UsuarioAutenticado auth,
			UUID pedidoId,
			EntregarPedidoRequest request) {
		Pedido previo = pedidoRepository.findById(pedidoId)
				.orElseThrow(() -> ApiException.notFound(
						"PEDIDO_NO_ENCONTRADO",
						"Pedido no encontrado",
						"No se encontró el pedido solicitado."));
		verificarAccesoSede(auth, previo.getSedeId());
		expirarSiVencido(previo.getId());

		transactionTemplate.executeWithoutResult(status -> {
			Pedido pedido = pedidoRepository.findByIdForUpdate(pedidoId)
					.orElseThrow(() -> ApiException.notFound(
							"PEDIDO_NO_ENCONTRADO",
							"Pedido no encontrado",
							"No se encontró el pedido solicitado."));
			verificarAccesoSede(auth, pedido.getSedeId());

			if (pedido.getModalidad() != ModalidadPedido.RECOGER || pedido.getEstado() != EstadoPedido.LISTO) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Transición inválida",
						"Solo se pueden entregar por mostrador pedidos RECOGER en estado LISTO (estado actual: "
								+ pedido.getEstado() + ").");
			}

			// RN-EMP-02 y CA-EMP-05: verificación obligatoria del documento del paciente
			PacienteResumen paciente = authService.obtenerPaciente(pedido.getPacienteId())
					.orElseThrow(() -> ApiException.notFound(
							"PACIENTE_NO_ENCONTRADO",
							"Paciente no encontrado",
							"No se encontraron los datos del paciente del pedido."));
			if (!paciente.documento().trim().equalsIgnoreCase(request.documentoVerificado().trim())) {
				throw ApiException.unprocessable(
						"DOCUMENTO_NO_COINCIDE",
						"Documento incorrecto",
						"El documento verificado no coincide con el titular del pedido.");
			}

			List<PedidoItem> items = pedidoItemRepository.findAllByPedidoId(pedido.getId());
			List<SolicitudStockItem> aDispensar = new ArrayList<>();
			for (PedidoItem item : items) {
				if (item.getCantidadReservada() > 0) {
					aDispensar.add(new SolicitudStockItem(item.getMedicamentoId(), item.getCantidadReservada()));
					item.setCantidadEntregada(item.getCantidadReservada());
				}
			}
			if (aDispensar.isEmpty()) {
				throw ApiException.conflict(
						"PEDIDO_SIN_STOCK_RESERVADO",
						"Pedido sin stock reservado",
						"El pedido no tiene unidades reservadas para entregar.");
			}

			Instant ahora = Instant.now(clock);
			inventarioOperacionesService.dispensar(
					pedido.getSedeId(),
					aDispensar,
					"PEDIDO",
					pedido.getId(),
					auth.usuarioId(),
					"Entrega de pedido " + pedido.getCodigo());
			pedidoItemRepository.saveAllAndFlush(items);

			EstadoPedido anterior = pedido.getEstado();
			pedido.setEstado(EstadoPedido.ENTREGADO);
			pedido.setEntregadoEn(ahora);
			pedido.setUpdatedAt(ahora);
			pedidoRepository.save(pedido);

			String nota = (request.nota() == null || request.nota().isBlank())
					? "Pedido entregado al paciente en sede"
					: request.nota().trim();
			registrarHistorial(pedido.getId(), anterior, EstadoPedido.ENTREGADO, auth.usuarioId(), nota);
			turnoService.marcarAtendidoPorPedido(pedido.getId());

			// RN-06: encolar evento de integración en la misma transacción
			encolarDispensacionOutbox(pedido, items, ahora);

			eventPublisher.publishEvent(new PedidoEstadoCambiadoEvent(
					pedido.getId(), pedido.getCodigo(), pedido.getPacienteId(), pedido.getSedeId(),
					anterior, EstadoPedido.ENTREGADO, nota));
		});

		return construirDetallePorId(pedidoId);
	}

	public PedidoDetalleResponse cancelarPedidoGestion(
			UsuarioAutenticado auth,
			UUID pedidoId,
			CancelarPedidoGestionRequest request) {
		Pedido previo = pedidoRepository.findById(pedidoId)
				.orElseThrow(() -> ApiException.notFound(
						"PEDIDO_NO_ENCONTRADO",
						"Pedido no encontrado",
						"No se encontró el pedido solicitado."));
		verificarAccesoSede(auth, previo.getSedeId());
		expirarSiVencido(previo.getId());

		transactionTemplate.executeWithoutResult(status -> {
			Pedido pedido = pedidoRepository.findByIdForUpdate(pedidoId)
					.orElseThrow(() -> ApiException.notFound(
							"PEDIDO_NO_ENCONTRADO",
							"Pedido no encontrado",
							"No se encontró el pedido solicitado."));
			verificarAccesoSede(auth, pedido.getSedeId());

			if (!ESTADOS_CANCELABLES_EMPLEADO.contains(pedido.getEstado())) {
				throw ApiException.conflict(
						"TRANSICION_INVALIDA",
						"Transición inválida",
						"No es posible cancelar un pedido en estado " + pedido.getEstado() + ".");
			}
			if (pedido.getEstado() == EstadoPedido.EN_PREPARACION) {
				verificarPropietarioPreparacion(auth, pedido);
			}

			ejecutarCancelacion(pedido, auth.usuarioId(), request.motivo().trim());
		});

		return construirDetallePorId(pedidoId);
	}

	/**
	 * Vence un pedido asociado a un turno marcado como no presentado (RF-EMP-17 o VencerTurnos).
	 */
	@Transactional
	public void vencerPedidoPorTurno(UUID pedidoId, UUID usuarioId, String motivo) {
		Pedido pedido = pedidoRepository.findByIdForUpdate(pedidoId).orElse(null);
		if (pedido == null || !ESTADOS_EXPIRABLES.contains(pedido.getEstado())) {
			return;
		}
		ejecutarVencimientoEnTxActual(pedido, usuarioId, motivo);
	}

	/**
	 * Tarea programada ExpirarReservas (00 §11): idempotente.
	 */
	public int expirarReservasVencidas() {
		Instant ahora = Instant.now(clock);
		List<Pedido> candidatos = pedidoRepository.findAllByEstadoInAndExpiraEnLessThanEqual(
				ESTADOS_EXPIRABLES, ahora);
		int vencidos = 0;
		for (Pedido candidato : candidatos) {
			if (expirarSiVencido(candidato.getId())) {
				vencidos++;
			}
		}
		return vencidos;
	}

	public int expirarReservasVencidasDePaciente(UUID pacienteId) {
		Instant ahora = Instant.now(clock);
		List<Pedido> candidatos = pedidoRepository.findAllByPacienteIdAndEstadoInAndExpiraEnLessThanEqual(
				pacienteId, ESTADOS_EXPIRABLES, ahora);
		int vencidos = 0;
		for (Pedido candidato : candidatos) {
			if (expirarSiVencido(candidato.getId())) {
				vencidos++;
			}
		}
		return vencidos;
	}

	public int expirarReservasVencidasDeSede(UUID sedeId) {
		Instant ahora = Instant.now(clock);
		List<Pedido> candidatos = pedidoRepository.findAllBySedeIdAndEstadoInAndExpiraEnLessThanEqual(
				sedeId, ESTADOS_EXPIRABLES, ahora);
		int vencidos = 0;
		for (Pedido candidato : candidatos) {
			if (expirarSiVencido(candidato.getId())) {
				vencidos++;
			}
		}
		return vencidos;
	}

	/**
	 * Evaluación perezosa del vencimiento (RN-05) en transacción independiente para que
	 * se persista incluso si una operación posterior rechaza la transición con 409.
	 */
	public boolean expirarSiVencido(UUID pedidoId) {
		Boolean resultado = requiresNewTxTemplate.execute(status -> {
			Pedido pedido = pedidoRepository.findByIdForUpdate(pedidoId).orElse(null);
			if (pedido == null || !ESTADOS_EXPIRABLES.contains(pedido.getEstado())) {
				return false;
			}
			Instant ahora = Instant.now(clock);
			if (pedido.getExpiraEn().isAfter(ahora)) {
				return false;
			}
			ejecutarVencimientoEnTxActual(pedido, null, "Reserva expirada automáticamente");
			return true;
		});
		return Boolean.TRUE.equals(resultado);
	}

	@Transactional(readOnly = true)
	public List<UUID> obtenerFormulaRefIdsDePedidosActivos() {
		return pedidoRepository.findDistinctFormulaRefIdsByEstadoIn(ESTADOS_ACTIVOS);
	}

	private void ejecutarCancelacion(Pedido pedido, UUID usuarioId, String motivo) {
		List<PedidoItem> items = pedidoItemRepository.findAllByPedidoId(pedido.getId());
		List<SolicitudStockItem> aLiberar = items.stream()
				.filter(i -> i.getCantidadReservada() > 0)
				.map(i -> new SolicitudStockItem(i.getMedicamentoId(), i.getCantidadReservada()))
				.toList();

		if (!aLiberar.isEmpty()) {
			inventarioOperacionesService.liberar(
					pedido.getSedeId(), aLiberar, "PEDIDO", pedido.getId(), usuarioId, motivo);
		}

		EstadoPedido anterior = pedido.getEstado();
		pedido.setEstado(EstadoPedido.CANCELADO);
		pedido.setUpdatedAt(Instant.now(clock));
		pedidoRepository.save(pedido);

		registrarHistorial(pedido.getId(), anterior, EstadoPedido.CANCELADO, usuarioId, motivo);
		if (pedido.getModalidad() == ModalidadPedido.RECOGER) {
			turnoService.cancelarPorPedido(pedido.getId());
		}

		eventPublisher.publishEvent(new PedidoEstadoCambiadoEvent(
				pedido.getId(), pedido.getCodigo(), pedido.getPacienteId(), pedido.getSedeId(),
				anterior, EstadoPedido.CANCELADO, motivo));
	}

	private void ejecutarVencimientoEnTxActual(Pedido pedido, UUID usuarioId, String motivo) {
		List<PedidoItem> items = pedidoItemRepository.findAllByPedidoId(pedido.getId());
		List<SolicitudStockItem> aLiberar = items.stream()
				.filter(i -> i.getCantidadReservada() > 0)
				.map(i -> new SolicitudStockItem(i.getMedicamentoId(), i.getCantidadReservada()))
				.toList();

		if (!aLiberar.isEmpty()) {
			inventarioOperacionesService.liberar(
					pedido.getSedeId(), aLiberar, "PEDIDO", pedido.getId(), usuarioId, motivo);
		}

		EstadoPedido anterior = pedido.getEstado();
		pedido.setEstado(EstadoPedido.VENCIDO);
		pedido.setUpdatedAt(Instant.now(clock));
		pedidoRepository.save(pedido);

		registrarHistorial(pedido.getId(), anterior, EstadoPedido.VENCIDO, usuarioId, motivo);
		if (pedido.getModalidad() == ModalidadPedido.RECOGER) {
			turnoService.marcarVencidoPorPedido(pedido.getId());
		}

		eventPublisher.publishEvent(new PedidoEstadoCambiadoEvent(
				pedido.getId(), pedido.getCodigo(), pedido.getPacienteId(), pedido.getSedeId(),
				anterior, EstadoPedido.VENCIDO, motivo));
	}

	private void encolarDispensacionOutbox(Pedido pedido, List<PedidoItem> items, Instant fechaEntrega) {
		String formulaCodigo = formulaService.obtenerSnapshotLocal(pedido.getFormulaRefId())
				.map(FormulaRefSnapshot::codigoExterno)
				.orElseThrow(() -> ApiException.notFound(
						"FORMULA_NO_ENCONTRADA",
						"Fórmula no encontrada",
						"No se encontró la referencia de fórmula del pedido."));
		String sedeCodigo = catalogoConsultaService.obtenerSedePorId(pedido.getSedeId())
				.map(SedePublicaResponse::codigo)
				.orElse("SEDE");

		Set<UUID> medIds = items.stream()
				.filter(i -> i.getCantidadEntregada() > 0)
				.map(PedidoItem::getMedicamentoId)
				.collect(Collectors.toSet());
		Map<UUID, MedicamentoPublicoResponse> meds = catalogoConsultaService.obtenerMedicamentosPorIds(medIds);

		List<DispensacionOutboxItem> outboxItems = items.stream()
				.filter(i -> i.getCantidadEntregada() > 0)
				.map(i -> {
					MedicamentoPublicoResponse med = meds.get(i.getMedicamentoId());
					return new DispensacionOutboxItem(med.codigo(), i.getCantidadEntregada());
				})
				.toList();

		DispensacionOutboxPayload payload = new DispensacionOutboxPayload(
				formulaCodigo,
				pedido.getId().toString(),
				sedeCodigo,
				fechaEntrega,
				outboxItems);
		outboxService.encolarDispensacion(pedido.getId().toString(), payload);
	}

	private void validarDatosModalidad(CrearPedidoRequest request) {
		if (request.modalidad() == ModalidadPedido.RECOGER) {
			if (request.franjaInicio() == null) {
				throw ApiException.badRequest(
						"FRANJA_REQUERIDA",
						"Franja horaria requerida",
						"Para modalidad RECOGER debe seleccionar una franja horaria.");
			}
		} else if (request.modalidad() == ModalidadPedido.DOMICILIO) {
			if (request.franjaInicio() != null) {
				throw ApiException.badRequest(
						"FRANJA_NO_APLICA",
						"Franja no aplica",
						"Para modalidad DOMICILIO el campo franjaInicio debe ser nulo.");
			}
			if (request.direccionEntrega() == null || request.direccionEntrega().isBlank()
					|| request.latitudEntrega() == null || request.longitudEntrega() == null) {
				throw ApiException.badRequest(
						"DIRECCION_DOMICILIO_REQUERIDA",
						"Datos de domicilio requeridos",
						"Para modalidad DOMICILIO la dirección, latitud y longitud son obligatorias.");
			}
		}
	}

	private Map<UUID, Integer> consolidarItems(List<ItemSolicitud> items) {
		Map<UUID, Integer> mapa = new LinkedHashMap<>();
		for (ItemSolicitud item : items) {
			mapa.merge(item.medicamentoId(), item.cantidad(), Integer::sum);
		}
		return mapa;
	}

	private void validarSaldoPendienteFormula(
			FormulaRefSnapshot formula,
			Map<UUID, Integer> itemsSolicitados) {
		Map<UUID, Integer> reservadoEnActivos = new HashMap<>();
		for (Object[] row : pedidoItemRepository.sumarReservadoActivoPorFormula(formula.id(), ESTADOS_ACTIVOS)) {
			reservadoEnActivos.put((UUID) row[0], ((Number) row[1]).intValue());
		}

		for (Map.Entry<UUID, Integer> entry : itemsSolicitados.entrySet()) {
			UUID medId = entry.getKey();
			int solicitada = entry.getValue();
			FormulaItemSnapshot formulaItem = formula.itemsPorMedicamento().get(medId);
			if (formulaItem == null) {
				throw ApiException.unprocessable(
						"MEDICAMENTO_NO_EN_FORMULA",
						"Medicamento no pertenece a la fórmula",
						"Uno de los medicamentos solicitados no hace parte de la fórmula seleccionada.");
			}
			int reservado = reservadoEnActivos.getOrDefault(medId, 0);
			int pendiente = Math.max(0, formulaItem.cantidadAutorizada() - formulaItem.cantidadDispensada() - reservado);
			if (solicitada > pendiente) {
				throw ApiException.conflict(
						"CANTIDAD_EXCEDE_PENDIENTE",
						"Cantidad excede el saldo pendiente",
						"La cantidad solicitada (" + solicitada + ") supera el saldo pendiente de la fórmula ("
								+ pendiente + ").");
			}
		}
	}

	private void registrarHistorial(
			UUID pedidoId,
			EstadoPedido anterior,
			EstadoPedido nuevo,
			UUID usuarioId,
			String nota) {
		PedidoHistorial historial = new PedidoHistorial();
		historial.setPedidoId(pedidoId);
		historial.setEstadoAnterior(anterior == null ? null : anterior.name());
		historial.setEstadoNuevo(nuevo.name());
		historial.setUsuarioId(usuarioId);
		historial.setNota(nota);
		pedidoHistorialRepository.save(historial);
	}

	private String generarCodigoPedido() {
		int anio = LocalDate.now(clock.withZone(ParametroService.ZONA_NEGOCIO)).getYear();
		long seq = pedidoRepository.siguienteSecuenciaCodigo();
		return String.format("PED-%d-%06d", anio, seq);
	}

	private EstadoPedidoItem mapearEstadoItem(EstadoReservaItem estado) {
		return switch (estado) {
			case COMPLETO -> EstadoPedidoItem.COMPLETO;
			case PARCIAL -> EstadoPedidoItem.PARCIAL;
			case AGOTADO -> EstadoPedidoItem.AGOTADO;
		};
	}

	private void verificarPropietarioPreparacion(UsuarioAutenticado auth, Pedido pedido) {
		if (auth.esAdmin()) {
			return;
		}
		if (pedido.getAsignadoA() != null && !pedido.getAsignadoA().equals(auth.usuarioId())) {
			throw ApiException.forbidden(
					"PEDIDO_ASIGNADO_A_OTRO_EMPLEADO",
					"Pedido asignado a otro empleado",
					"Solo quien tomó el pedido en preparación o un administrador puede modificarlo.");
		}
	}

	private UUID resolverSedeOperacion(
			UsuarioAutenticado auth,
			UUID sedeIdSolicitada,
			boolean obligatoriaParaAdmin) {
		if (auth.esEmpleado()) {
			if (auth.sedeId() == null) {
				throw ApiException.forbidden(
						"SEDE_NO_ASIGNADA",
						"Sede no asignada",
						"El empleado no tiene una sede asignada.");
			}
			if (sedeIdSolicitada != null && !sedeIdSolicitada.equals(auth.sedeId())) {
				throw ApiException.forbidden(
						"SEDE_NO_AUTORIZADA",
						"Sede no autorizada",
						"No tiene permiso para acceder a pedidos de otra sede.");
			}
			return auth.sedeId();
		}
		if (auth.esAdmin()) {
			if (sedeIdSolicitada != null) {
				catalogoConsultaService.obtenerSedePorId(sedeIdSolicitada)
						.orElseThrow(() -> ApiException.notFound(
								"SEDE_NO_ENCONTRADA",
								"Sede no encontrada",
								"No existe una sede con el identificador indicado."));
				return sedeIdSolicitada;
			}
			if (obligatoriaParaAdmin) {
				throw ApiException.badRequest(
						"SEDE_REQUERIDA",
						"Sede requerida",
						"El administrador debe indicar sedeId.");
			}
			return null;
		}
		throw ApiException.forbidden("ACCESO_DENEGADO", "Acceso denegado", "No tiene permisos para operar pedidos.");
	}

	private void verificarAccesoSede(UsuarioAutenticado auth, UUID sedeIdRecurso) {
		if (auth.esEmpleado() && !sedeIdRecurso.equals(auth.sedeId())) {
			throw ApiException.forbidden(
					"SEDE_NO_AUTORIZADA",
					"Sede no autorizada",
					"No tiene permiso para acceder a pedidos de otra sede.");
		}
	}

	@Transactional(readOnly = true)
	protected PedidoDetalleResponse construirDetallePorId(UUID pedidoId) {
		Pedido pedido = pedidoRepository.findById(pedidoId)
				.orElseThrow(() -> ApiException.notFound(
						"PEDIDO_NO_ENCONTRADO",
						"Pedido no encontrado",
						"No se encontró el pedido solicitado."));
		List<PedidoItem> items = pedidoItemRepository.findAllByPedidoId(pedidoId);
		List<PedidoHistorial> historial = pedidoHistorialRepository.findAllByPedidoIdOrderByCreatedAtAsc(pedidoId);
		TurnoResponse turno = turnoService.obtenerPorPedidoId(pedidoId).orElse(null);

		SedePublicaResponse sede = catalogoConsultaService.obtenerSedePorId(pedido.getSedeId()).orElse(null);
		String formulaCodigo = formulaService.obtenerSnapshotLocal(pedido.getFormulaRefId())
				.map(FormulaRefSnapshot::codigoExterno)
				.orElse(null);
		PacienteResumen paciente = authService.obtenerPaciente(pedido.getPacienteId()).orElse(null);

		Set<UUID> medIds = items.stream().map(PedidoItem::getMedicamentoId).collect(Collectors.toSet());
		Map<UUID, MedicamentoPublicoResponse> meds = catalogoConsultaService.obtenerMedicamentosPorIds(medIds);

		List<PedidoItemResponse> itemsDto = items.stream()
				.map(item -> {
					MedicamentoPublicoResponse med = meds.get(item.getMedicamentoId());
					return new PedidoItemResponse(
							item.getId(),
							item.getMedicamentoId(),
							med != null ? med.codigo() : null,
							med != null ? med.nombre() : null,
							med != null ? med.presentacion() : null,
							item.getCantidadSolicitada(),
							item.getCantidadReservada(),
							item.getCantidadEntregada(),
							item.getEstadoItem());
				})
				.toList();

		List<PedidoHistorialResponse> historialDto = historial.stream()
				.map(PedidoHistorialResponse::from)
				.toList();

		return new PedidoDetalleResponse(
				pedido.getId(),
				pedido.getCodigo(),
				pedido.getEstado(),
				pedido.getModalidad(),
				pedido.isEsParcial(),
				pedido.getSedeId(),
				sede != null ? sede.codigo() : null,
				sede != null ? sede.nombre() : null,
				pedido.getFormulaRefId(),
				formulaCodigo,
				pedido.getPacienteId(),
				paciente != null ? paciente.nombres() + " " + paciente.apellidos() : null,
				paciente != null ? paciente.tipoDocumento() : null,
				paciente != null ? paciente.documento() : null,
				paciente != null ? paciente.telefono() : null,
				pedido.getDireccionEntrega(),
				pedido.getLatitudEntrega(),
				pedido.getLongitudEntrega(),
				pedido.getIntentosEntrega(),
				pedido.getAsignadoA(),
				pedido.getExpiraEn(),
				pedido.getCreatedAt(),
				pedido.getUpdatedAt(),
				pedido.getListoEn(),
				pedido.getEntregadoEn(),
				turno,
				itemsDto,
				historialDto);
	}

	private PaginaResponse<PedidoResumenResponse> construirPaginaResumen(Page<Pedido> resultados) {
		List<Pedido> pedidos = resultados.getContent();
		Set<UUID> sedeIds = pedidos.stream().map(Pedido::getSedeId).collect(Collectors.toSet());
		Set<UUID> formulaIds = pedidos.stream().map(Pedido::getFormulaRefId).collect(Collectors.toSet());
		Set<UUID> pacienteIds = pedidos.stream().map(Pedido::getPacienteId).collect(Collectors.toSet());
		Set<UUID> pedidoIds = pedidos.stream().map(Pedido::getId).collect(Collectors.toSet());

		Map<UUID, SedePublicaResponse> sedes = catalogoConsultaService.obtenerSedesPorIds(sedeIds);
		Map<UUID, String> formulas = formulaService.obtenerCodigosPorIds(formulaIds);
		Map<UUID, PacienteResumen> pacientes = authService.obtenerPacientesPorIds(pacienteIds);
		Map<UUID, TurnoResponse> turnos = turnoService.obtenerPorPedidoIds(pedidoIds);

		Page<PedidoResumenResponse> mapped = resultados.map(p -> {
			SedePublicaResponse sede = sedes.get(p.getSedeId());
			PacienteResumen pac = pacientes.get(p.getPacienteId());
			return new PedidoResumenResponse(
					p.getId(),
					p.getCodigo(),
					p.getEstado(),
					p.getModalidad(),
					p.isEsParcial(),
					p.getSedeId(),
					sede != null ? sede.codigo() : null,
					sede != null ? sede.nombre() : null,
					p.getFormulaRefId(),
					formulas.get(p.getFormulaRefId()),
					p.getPacienteId(),
					pac != null ? pac.nombres() + " " + pac.apellidos() : null,
					pac != null ? pac.documento() : null,
					p.getAsignadoA(),
					p.getExpiraEn(),
					p.getCreatedAt(),
					p.getUpdatedAt(),
					p.getListoEn(),
					p.getEntregadoEn(),
					turnos.get(p.getId()));
		});
		return PaginaResponse.of(mapped);
	}
}
