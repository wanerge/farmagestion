package co.farmagestion.api.pedidos;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface PedidoHistorialRepository extends JpaRepository<PedidoHistorial, UUID> {

	List<PedidoHistorial> findAllByPedidoIdOrderByCreatedAtAsc(UUID pedidoId);
}
