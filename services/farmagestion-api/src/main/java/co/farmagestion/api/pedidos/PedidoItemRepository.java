package co.farmagestion.api.pedidos;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface PedidoItemRepository extends JpaRepository<PedidoItem, UUID> {

	List<PedidoItem> findAllByPedidoId(UUID pedidoId);

	List<PedidoItem> findAllByPedidoIdIn(Collection<UUID> pedidoIds);

	@Query("""
			SELECT pi.medicamentoId, COALESCE(SUM(pi.cantidadReservada), 0)
			FROM PedidoItem pi
			JOIN Pedido p ON p.id = pi.pedidoId
			WHERE p.formulaRefId = :formulaRefId
			  AND p.estado IN :estados
			GROUP BY pi.medicamentoId
			""")
	List<Object[]> sumarReservadoActivoPorFormula(
			@Param("formulaRefId") UUID formulaRefId,
			@Param("estados") Collection<EstadoPedido> estados);

	@Query("""
			SELECT p.formulaRefId, pi.medicamentoId, COALESCE(SUM(pi.cantidadReservada), 0)
			FROM PedidoItem pi
			JOIN Pedido p ON p.id = pi.pedidoId
			WHERE p.formulaRefId IN :formulaRefIds
			  AND p.estado IN :estados
			GROUP BY p.formulaRefId, pi.medicamentoId
			""")
	List<Object[]> sumarReservadoActivoPorFormulas(
			@Param("formulaRefIds") Collection<UUID> formulaRefIds,
			@Param("estados") Collection<EstadoPedido> estados);

	@Lock(LockModeType.PESSIMISTIC_WRITE)
	@Query("""
			SELECT pi FROM PedidoItem pi
			JOIN Pedido p ON p.id = pi.pedidoId
			WHERE p.sedeId = :sedeId
			  AND pi.medicamentoId = :medicamentoId
			  AND pi.cantidadReservada > 0
			  AND p.estado IN :estados
			ORDER BY p.createdAt DESC, p.id DESC
			""")
	List<PedidoItem> findReduciblesMasRecientesPrimeroForUpdate(
			@Param("sedeId") UUID sedeId,
			@Param("medicamentoId") UUID medicamentoId,
			@Param("estados") Collection<EstadoPedido> estados);
}
