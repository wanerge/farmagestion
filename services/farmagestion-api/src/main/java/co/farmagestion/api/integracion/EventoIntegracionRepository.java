package co.farmagestion.api.integracion;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface EventoIntegracionRepository extends JpaRepository<EventoIntegracion, UUID> {

	boolean existsByIdempotencyKey(String idempotencyKey);

	List<EventoIntegracion> findAllByEstadoOrderByCreatedAtAsc(EstadoEventoIntegracion estado);

	Page<EventoIntegracion> findAllByEstadoOrderByCreatedAtDesc(EstadoEventoIntegracion estado, Pageable pageable);

	Page<EventoIntegracion> findAllByOrderByCreatedAtDesc(Pageable pageable);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("SELECT e FROM EventoIntegracion e WHERE e.id = :id")
	Optional<EventoIntegracion> findByIdForUpdate(@Param("id") UUID id);
}
