package co.farmagestion.api.turnos;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface TurnoRepository extends JpaRepository<Turno, UUID> {

	Optional<Turno> findByPedidoId(UUID pedidoId);

	List<Turno> findAllByPedidoIdIn(Collection<UUID> pedidoIds);

	List<Turno> findAllBySedeIdAndFechaOrderByFranjaInicioAscNumeroAsc(UUID sedeId, LocalDate fecha);

	List<Turno> findAllBySedeIdAndFechaAndEstadoOrderByLlamadoEnDescNumeroAsc(
			UUID sedeId, LocalDate fecha, EstadoTurno estado);

	List<Turno> findAllBySedeIdAndFechaAndEstadoOrderByFranjaInicioAscNumeroAsc(
			UUID sedeId, LocalDate fecha, EstadoTurno estado);

	Optional<Turno> findFirstBySedeIdAndFechaAndEstadoOrderByFranjaInicioAscNumeroAsc(
			UUID sedeId, LocalDate fecha, EstadoTurno estado);

	long countBySedeIdAndFechaAndFranjaInicioAndEstadoIn(
			UUID sedeId, LocalDate fecha, LocalTime franjaInicio, Collection<EstadoTurno> estados);

	@Query("""
			SELECT t.franjaInicio, COUNT(t) FROM Turno t
			WHERE t.sedeId = :sedeId AND t.fecha = :fecha AND t.estado IN :estados
			GROUP BY t.franjaInicio
			""")
	List<Object[]> contarOcupadosPorFranja(
			@Param("sedeId") UUID sedeId,
			@Param("fecha") LocalDate fecha,
			@Param("estados") Collection<EstadoTurno> estados);

	@Query("""
			SELECT COALESCE(MAX(t.numero), 0) FROM Turno t
			WHERE t.sedeId = :sedeId AND t.fecha = :fecha
			""")
	int findMaxNumeroBySedeIdAndFecha(@Param("sedeId") UUID sedeId, @Param("fecha") LocalDate fecha);

	List<Turno> findAllByEstado(EstadoTurno estado);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("SELECT t FROM Turno t WHERE t.id = :id")
	Optional<Turno> findByIdForUpdate(@Param("id") UUID id);

	@Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(:llave))) AS _lock", nativeQuery = true)
	Integer adquirirBloqueoTransaccional(@Param("llave") String llave);
}
