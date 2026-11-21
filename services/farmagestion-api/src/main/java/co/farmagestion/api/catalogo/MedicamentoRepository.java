package co.farmagestion.api.catalogo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface MedicamentoRepository extends JpaRepository<Medicamento, UUID> {

	Optional<Medicamento> findByIdAndActivoTrue(UUID id);

	List<Medicamento> findAllByIdIn(Collection<UUID> ids);

	Optional<Medicamento> findByCodigoIgnoreCase(String codigo);

	List<Medicamento> findAllByCodigoIn(Collection<String> codigos);

	List<Medicamento> findAllByActivoTrueOrderByNombreAsc();

	boolean existsByCodigoIgnoreCase(String codigo);

	boolean existsByCodigoIgnoreCaseAndIdNot(String codigo, UUID id);

	@Query(
			value = """
					SELECT * FROM medicamento m
					WHERE (:estadoFiltro = 'TODOS'
					    OR (:estadoFiltro = 'ACTIVOS' AND m.activo = TRUE)
					    OR (:estadoFiltro = 'INACTIVOS' AND m.activo = FALSE))
					  AND (
					    :q = ''
					    OR translate(lower(m.nombre), 'áéíóúü', 'aeiouu') LIKE '%' || translate(lower(:q), 'áéíóúü', 'aeiouu') || '%'
					    OR translate(lower(m.principio_activo), 'áéíóúü', 'aeiouu') LIKE '%' || translate(lower(:q), 'áéíóúü', 'aeiouu') || '%'
					    OR lower(m.codigo) LIKE '%' || lower(:q) || '%'
					  )
					ORDER BY m.codigo ASC
					""",
			countQuery = """
					SELECT COUNT(*) FROM medicamento m
					WHERE (:estadoFiltro = 'TODOS'
					    OR (:estadoFiltro = 'ACTIVOS' AND m.activo = TRUE)
					    OR (:estadoFiltro = 'INACTIVOS' AND m.activo = FALSE))
					  AND (
					    :q = ''
					    OR translate(lower(m.nombre), 'áéíóúü', 'aeiouu') LIKE '%' || translate(lower(:q), 'áéíóúü', 'aeiouu') || '%'
					    OR translate(lower(m.principio_activo), 'áéíóúü', 'aeiouu') LIKE '%' || translate(lower(:q), 'áéíóúü', 'aeiouu') || '%'
					    OR lower(m.codigo) LIKE '%' || lower(:q) || '%'
					  )
					""",
			nativeQuery = true)
	Page<Medicamento> buscarAdmin(@Param("q") String q, @Param("estadoFiltro") String estadoFiltro, Pageable pageable);

	@Query(
			value = """
					SELECT * FROM medicamento m
					WHERE m.activo = TRUE
					  AND (
					    :q = ''
					    OR translate(lower(m.nombre), 'áéíóúü', 'aeiouu') LIKE '%' || translate(lower(:q), 'áéíóúü', 'aeiouu') || '%'
					    OR translate(lower(m.principio_activo), 'áéíóúü', 'aeiouu') LIKE '%' || translate(lower(:q), 'áéíóúü', 'aeiouu') || '%'
					    OR lower(m.codigo) LIKE '%' || lower(:q) || '%'
					  )
					ORDER BY m.nombre ASC
					""",
			countQuery = """
					SELECT COUNT(*) FROM medicamento m
					WHERE m.activo = TRUE
					  AND (
					    :q = ''
					    OR translate(lower(m.nombre), 'áéíóúü', 'aeiouu') LIKE '%' || translate(lower(:q), 'áéíóúü', 'aeiouu') || '%'
					    OR translate(lower(m.principio_activo), 'áéíóúü', 'aeiouu') LIKE '%' || translate(lower(:q), 'áéíóúü', 'aeiouu') || '%'
					    OR lower(m.codigo) LIKE '%' || lower(:q) || '%'
					  )
					""",
			nativeQuery = true)
	Page<Medicamento> buscarActivos(@Param("q") String q, Pageable pageable);

	@Query(
			value = """
					SELECT m.id FROM medicamento m
					WHERE translate(lower(m.nombre), 'áéíóúü', 'aeiouu') LIKE '%' || translate(lower(:q), 'áéíóúü', 'aeiouu') || '%'
					   OR translate(lower(m.principio_activo), 'áéíóúü', 'aeiouu') LIKE '%' || translate(lower(:q), 'áéíóúü', 'aeiouu') || '%'
					   OR lower(m.codigo) LIKE '%' || lower(:q) || '%'
					""",
			nativeQuery = true)
	List<UUID> buscarIdsPorTexto(@Param("q") String q);
}
