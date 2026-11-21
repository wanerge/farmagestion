package co.farmagestion.api.auth;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface EmpleadoRepository extends JpaRepository<Empleado, UUID> {

	Optional<Empleado> findByUsuarioId(UUID usuarioId);

	@Query("""
			SELECT e.usuarioId FROM Empleado e
			JOIN Usuario u ON u.id = e.usuarioId
			WHERE e.sedeId = :sedeId AND u.activo = true
			""")
	List<UUID> findUsuarioIdsActivosBySedeId(@Param("sedeId") UUID sedeId);
}
