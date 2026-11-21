package co.farmagestion.api.notificaciones;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

interface NotificacionRepository extends JpaRepository<Notificacion, UUID> {

	Page<Notificacion> findAllByUsuarioIdOrderByCreatedAtDesc(UUID usuarioId, Pageable pageable);

	Page<Notificacion> findAllByUsuarioIdAndLeidaFalseOrderByCreatedAtDesc(UUID usuarioId, Pageable pageable);

	long countByUsuarioIdAndLeidaFalse(UUID usuarioId);

	Optional<Notificacion> findByIdAndUsuarioId(UUID id, UUID usuarioId);
}
