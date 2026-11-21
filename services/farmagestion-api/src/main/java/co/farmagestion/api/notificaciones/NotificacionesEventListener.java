package co.farmagestion.api.notificaciones;

import co.farmagestion.api.auth.AuthService;
import co.farmagestion.api.catalogo.CatalogoConsultaService;
import co.farmagestion.api.catalogo.MedicamentoPublicoResponse;
import co.farmagestion.api.integracion.IntegracionErrorEvent;
import co.farmagestion.api.inventario.StockBajoEvent;
import co.farmagestion.api.pedidos.PedidoCreadoEvent;
import co.farmagestion.api.pedidos.PedidoEstadoCambiadoEvent;
import co.farmagestion.api.pedidos.PedidoFaltanteDetectadoEvent;
import co.farmagestion.api.turnos.TurnoLlamadoEvent;
import java.util.List;
import java.util.UUID;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Consumidor de eventos de dominio de los módulos del backend hacia el puerto Notificador.
 */
@Component
public class NotificacionesEventListener {

	private final Notificador notificador;
	private final AuthService authService;
	private final CatalogoConsultaService catalogoConsultaService;

	public NotificacionesEventListener(
			Notificador notificador,
			AuthService authService,
			CatalogoConsultaService catalogoConsultaService) {
		this.notificador = notificador;
		this.authService = authService;
		this.catalogoConsultaService = catalogoConsultaService;
	}

	@EventListener
	public void onStockBajo(StockBajoEvent event) {
		List<UUID> empleados = authService.obtenerEmpleadosActivosDeSede(event.sedeId());
		if (empleados.isEmpty()) {
			return;
		}
		String nombreMed = catalogoConsultaService.obtenerMedicamentoPorId(event.medicamentoId())
				.map(MedicamentoPublicoResponse::nombre)
				.orElse("Medicamento");
		String titulo = "Stock bajo: " + nombreMed;
		String mensaje = nombreMed + " quedó con " + event.disponibleActual()
				+ " unidades disponibles (mínimo configurado: " + event.stockMinimo() + ").";
		notificador.notificarVarios(
				empleados,
				"STOCK_BAJO",
				titulo,
				mensaje,
				"MEDICAMENTO",
				event.medicamentoId());
	}

	@EventListener
	public void onPedidoCreado(PedidoCreadoEvent event) {
		String detalleTurno = event.codigoTurno() != null
				? " Turno asignado: " + event.codigoTurno() + "."
				: "";
		String detalleParcial = event.esParcial() ? " (reserva parcial)" : "";
		notificador.notificar(new SolicitudNotificacion(
				event.pacienteId(),
				"PEDIDO_RESERVADO",
				"Pedido reservado " + event.codigoPedido(),
				"Tu pedido " + event.codigoPedido() + " fue reservado" + detalleParcial + "." + detalleTurno,
				"PEDIDO",
				event.pedidoId()));

		List<UUID> empleados = authService.obtenerEmpleadosActivosDeSede(event.sedeId());
		notificador.notificarVarios(
				empleados,
				"NUEVO_PEDIDO",
				"Nuevo pedido " + event.codigoPedido(),
				"Se registró el pedido " + event.codigoPedido() + " (" + event.modalidad() + ")" + detalleParcial + ".",
				"PEDIDO",
				event.pedidoId());
	}

	@EventListener
	public void onPedidoEstadoCambiado(PedidoEstadoCambiadoEvent event) {
		String tipo;
		String titulo;
		String mensaje;
		switch (event.estadoNuevo()) {
			case EN_PREPARACION -> {
				tipo = "PEDIDO_EN_PREPARACION";
				titulo = "Pedido en preparación " + event.codigoPedido();
				mensaje = "Tu pedido " + event.codigoPedido() + " está siendo preparado en la sede.";
			}
			case LISTO -> {
				tipo = "PEDIDO_LISTO";
				titulo = "Pedido listo " + event.codigoPedido();
				mensaje = "Tu pedido " + event.codigoPedido() + " está listo para entrega.";
			}
			case EN_RUTA -> {
				tipo = "PEDIDO_EN_RUTA";
				titulo = "Pedido en ruta " + event.codigoPedido();
				mensaje = "Tu pedido " + event.codigoPedido() + " va en camino a tu dirección.";
			}
			case ENTREGADO -> {
				tipo = "PEDIDO_ENTREGADO";
				titulo = "Pedido entregado " + event.codigoPedido();
				mensaje = "Tu pedido " + event.codigoPedido() + " fue entregado exitosamente.";
			}
			case CANCELADO -> {
				tipo = "PEDIDO_CANCELADO";
				titulo = "Pedido cancelado " + event.codigoPedido();
				mensaje = "Tu pedido " + event.codigoPedido() + " fue cancelado."
						+ (event.nota() != null && !event.nota().isBlank() ? " Motivo: " + event.nota() : "");
			}
			case VENCIDO -> {
				tipo = "PEDIDO_VENCIDO";
				titulo = "Reserva vencida " + event.codigoPedido();
				mensaje = "La reserva de tu pedido " + event.codigoPedido()
						+ " venció y los medicamentos fueron liberados.";
			}
			default -> {
				return;
			}
		}

		notificador.notificar(new SolicitudNotificacion(
				event.pacienteId(),
				tipo,
				titulo,
				mensaje,
				"PEDIDO",
				event.pedidoId()));
	}

	@EventListener
	public void onPedidoFaltanteDetectado(PedidoFaltanteDetectadoEvent event) {
		String nombreMed = catalogoConsultaService.obtenerMedicamentoPorId(event.medicamentoId())
				.map(MedicamentoPublicoResponse::nombre)
				.orElse("un medicamento");
		notificador.notificar(new SolicitudNotificacion(
				event.pacienteId(),
				"FALTANTE_DETECTADO",
				"Faltante detectado en pedido " + event.codigoPedido(),
				"Se redujo la reserva de " + nombreMed + " en " + event.cantidadReducida()
						+ " unidad(es) por ajuste de inventario. Motivo: " + event.motivo(),
				"PEDIDO",
				event.pedidoId()));
	}

	@EventListener
	public void onTurnoLlamado(TurnoLlamadoEvent event) {
		notificador.notificar(new SolicitudNotificacion(
				event.pacienteId(),
				"TURNO_LLAMADO",
				"Turno llamado: " + event.codigoTurno(),
				"Tu turno " + event.codigoTurno() + " ha sido llamado. Acércate al punto de entrega.",
				"TURNO",
				event.turnoId()));
	}

	@EventListener
	public void onIntegracionError(IntegracionErrorEvent event) {
		List<UUID> admins = authService.obtenerAdminsActivos();
		if (admins.isEmpty()) {
			return;
		}
		notificador.notificarVarios(
				admins,
				"INTEGRACION_ERROR",
				"Error de integración (" + event.tipo() + ")",
				"El evento " + event.idempotencyKey() + " pasó a estado ERROR: " + event.ultimoError(),
				"EVENTO_INTEGRACION",
				event.eventoId());
	}
}
