package co.farmagestion.api.pedidos;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface PedidoRepository extends JpaRepository<Pedido, UUID>, JpaSpecificationExecutor<Pedido> {

	Optional<Pedido> findByIdAndPacienteId(UUID id, UUID pacienteId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("SELECT p FROM Pedido p WHERE p.id = :id")
	Optional<Pedido> findByIdForUpdate(@Param("id") UUID id);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("SELECT p FROM Pedido p WHERE p.id = :id AND p.pacienteId = :pacienteId")
	Optional<Pedido> findByIdAndPacienteIdForUpdate(
			@Param("id") UUID id,
			@Param("pacienteId") UUID pacienteId);

	long countByPacienteIdAndEstadoIn(UUID pacienteId, Collection<EstadoPedido> estados);

	List<Pedido> findAllByEstadoInAndExpiraEnLessThanEqual(
			Collection<EstadoPedido> estados,
			Instant ahora);

	List<Pedido> findAllByPacienteIdAndEstadoInAndExpiraEnLessThanEqual(
			UUID pacienteId,
			Collection<EstadoPedido> estados,
			Instant ahora);

	List<Pedido> findAllBySedeIdAndEstadoInAndExpiraEnLessThanEqual(
			UUID sedeId,
			Collection<EstadoPedido> estados,
			Instant ahora);

	@Query("SELECT DISTINCT p.formulaRefId FROM Pedido p WHERE p.estado IN :estados")
	List<UUID> findDistinctFormulaRefIdsByEstadoIn(@Param("estados") Collection<EstadoPedido> estados);

	@Query(value = "SELECT nextval('seq_pedido_codigo')", nativeQuery = true)
	long siguienteSecuenciaCodigo();

	@Query(value = "SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(:llave))) AS _lock", nativeQuery = true)
	Integer adquirirBloqueoTransaccional(@Param("llave") String llave);
}
