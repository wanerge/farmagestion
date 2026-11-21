package co.farmagestion.api.domicilios;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface RutaRepository extends JpaRepository<Ruta, UUID> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("SELECT r FROM Ruta r WHERE r.id = :id")
	Optional<Ruta> findByIdForUpdate(@Param("id") UUID id);

	List<Ruta> findAllBySedeIdAndFechaOrderByCreatedAtDesc(UUID sedeId, LocalDate fecha);

	List<Ruta> findAllByFechaOrderByCreatedAtDesc(LocalDate fecha);

	List<Ruta> findAllByDomiciliarioIdAndFechaOrderByCreatedAtDesc(UUID domiciliarioId, LocalDate fecha);

	List<Ruta> findAllByIdIn(Collection<UUID> ids);
}
