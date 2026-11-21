package co.farmagestion.api.notificaciones;

import co.farmagestion.api.common.web.ApiException;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificacionService {

	private static final int MAX_PAGE_SIZE = 100;

	private final NotificacionRepository notificacionRepository;

	public NotificacionService(NotificacionRepository notificacionRepository) {
		this.notificacionRepository = notificacionRepository;
	}

	@Transactional(readOnly = true)
	public NotificacionesListadoResponse listarPorUsuario(
			UUID usuarioId,
			Boolean soloNoLeidas,
			int page,
			int size) {
		int pagina = Math.max(0, page);
		int tamano = Math.min(Math.max(1, size), MAX_PAGE_SIZE);
		PageRequest pageable = PageRequest.of(pagina, tamano);

		Page<Notificacion> resultados = Boolean.TRUE.equals(soloNoLeidas)
				? notificacionRepository.findAllByUsuarioIdAndLeidaFalseOrderByCreatedAtDesc(usuarioId, pageable)
				: notificacionRepository.findAllByUsuarioIdOrderByCreatedAtDesc(usuarioId, pageable);

		long noLeidas = notificacionRepository.countByUsuarioIdAndLeidaFalse(usuarioId);
		return new NotificacionesListadoResponse(
				resultados.getContent().stream().map(NotificacionResponse::from).toList(),
				resultados.getNumber(),
				resultados.getSize(),
				resultados.getTotalElements(),
				noLeidas);
	}

	@Transactional
	public NotificacionResponse marcarComoLeida(UUID usuarioId, UUID notificacionId) {
		Notificacion notificacion = notificacionRepository.findByIdAndUsuarioId(notificacionId, usuarioId)
				.orElseThrow(() -> ApiException.notFound(
						"NOTIFICACION_NO_ENCONTRADA",
						"Notificación no encontrada",
						"No se encontró la notificación solicitada."));

		if (!notificacion.isLeida()) {
			notificacion.setLeida(true);
			notificacionRepository.save(notificacion);
		}
		return NotificacionResponse.from(notificacion);
	}
}
