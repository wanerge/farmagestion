package co.farmagestion.api.inventario;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface InventarioRepository extends JpaRepository<Inventario, UUID>, JpaSpecificationExecutor<Inventario> {

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			SELECT i FROM Inventario i
			WHERE i.sedeId = :sedeId AND i.medicamentoId = :medicamentoId
			""")
	Optional<Inventario> findBySedeIdAndMedicamentoIdForUpdate(
			@Param("sedeId") UUID sedeId,
			@Param("medicamentoId") UUID medicamentoId);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			SELECT i FROM Inventario i
			WHERE i.sedeId = :sedeId AND i.medicamentoId IN :medicamentoIds
			ORDER BY i.medicamentoId ASC
			""")
	List<Inventario> findAllBySedeIdAndMedicamentoIdInForUpdate(
			@Param("sedeId") UUID sedeId,
			@Param("medicamentoIds") Collection<UUID> medicamentoIds);

	List<Inventario> findAllByMedicamentoId(UUID medicamentoId);

	Optional<Inventario> findBySedeIdAndMedicamentoId(UUID sedeId, UUID medicamentoId);
}
