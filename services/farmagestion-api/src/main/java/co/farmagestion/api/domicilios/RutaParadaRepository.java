package co.farmagestion.api.domicilios;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface RutaParadaRepository extends JpaRepository<RutaParada, UUID> {

	List<RutaParada> findAllByRutaIdOrderByOrdenAsc(UUID rutaId);

	List<RutaParada> findAllByRutaIdInOrderByRutaIdAscOrdenAsc(Collection<UUID> rutaIds);

	Optional<RutaParada> findByIdAndRutaId(UUID id, UUID rutaId);

	@Query("""
			SELECT rp.pedidoId FROM RutaParada rp
			JOIN Ruta r ON r.id = rp.rutaId
			WHERE rp.pedidoId IN :pedidoIds
			  AND (rp.estado = co.farmagestion.api.domicilios.EstadoRutaParada.PENDIENTE
			       OR r.estado IN (
			           co.farmagestion.api.domicilios.EstadoRuta.PLANEADA,
			           co.farmagestion.api.domicilios.EstadoRuta.EN_CURSO))
			""")
	List<UUID> findPedidoIdsEnRutasActivas(@Param("pedidoIds") Collection<UUID> pedidoIds);

	@Query("""
			SELECT rp FROM RutaParada rp
			JOIN Ruta r ON r.id = rp.rutaId
			WHERE rp.pedidoId = :pedidoId
			ORDER BY r.createdAt DESC, rp.orden ASC
			""")
	List<RutaParada> findHistorialParadasPorPedido(@Param("pedidoId") UUID pedidoId);
}
