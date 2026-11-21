package co.farmagestion.api.auth;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface EmpleadoRepository extends JpaRepository<Empleado, UUID> {

	Optional<Empleado> findByUsuarioId(UUID usuarioId);

	List<Empleado> findAllByOrderByNombresAscApellidosAsc();

	List<Empleado> findAllByUsuarioIdIn(Collection<UUID> usuarioIds);

	@Query("""
			SELECT e.usuarioId FROM Empleado e
			JOIN Usuario u ON u.id = e.usuarioId
			WHERE e.sedeId = :sedeId AND u.activo = true
			""")
	List<UUID> findUsuarioIdsActivosBySedeId(@Param("sedeId") UUID sedeId);

	@Query("""
			SELECT e FROM Empleado e
			JOIN Usuario u ON u.id = e.usuarioId
			WHERE e.sedeId = :sedeId AND e.cargo = :cargo AND u.activo = true
			ORDER BY e.nombres ASC, e.apellidos ASC
			""")
	List<Empleado> findActivosBySedeIdAndCargo(
			@Param("sedeId") UUID sedeId,
			@Param("cargo") CargoEmpleado cargo);

	@Query("""
			SELECT e FROM Empleado e
			JOIN Usuario u ON u.id = e.usuarioId
			WHERE e.usuarioId = :usuarioId AND u.activo = true AND u.rol = co.farmagestion.api.auth.RolUsuario.EMPLEADO
			""")
	Optional<Empleado> findEmpleadoActivoByUsuarioId(@Param("usuarioId") UUID usuarioId);
}
