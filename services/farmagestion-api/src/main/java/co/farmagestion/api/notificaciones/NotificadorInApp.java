package co.farmagestion.api.notificaciones;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Adaptador in-app del puerto Notificador: persiste notificaciones en farma_db.
 */
@Component
public class NotificadorInApp implements Notificador {

	private final NotificacionRepository notificacionRepository;

	public NotificadorInApp(NotificacionRepository notificacionRepository) {
		this.notificacionRepository = notificacionRepository;
	}

	@Override
	@Transactional
	public void notificar(SolicitudNotificacion solicitud) {
		Notificacion notificacion = new Notificacion();
		notificacion.setUsuarioId(solicitud.usuarioId());
		notificacion.setTipo(solicitud.tipo());
		notificacion.setTitulo(solicitud.titulo());
		notificacion.setMensaje(solicitud.mensaje());
		notificacion.setReferenciaTipo(solicitud.referenciaTipo());
		notificacion.setReferenciaId(solicitud.referenciaId());
		notificacion.setLeida(false);
		notificacionRepository.save(notificacion);
	}
}
