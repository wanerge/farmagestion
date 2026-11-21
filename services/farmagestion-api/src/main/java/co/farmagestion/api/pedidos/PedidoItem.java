package co.farmagestion.api.pedidos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "pedido_item")
public class PedidoItem {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "pedido_id", nullable = false)
	private UUID pedidoId;

	@Column(name = "medicamento_id", nullable = false)
	private UUID medicamentoId;

	@Column(name = "cantidad_solicitada", nullable = false)
	private int cantidadSolicitada;

	@Column(name = "cantidad_reservada", nullable = false)
	private int cantidadReservada;

	@Column(name = "cantidad_entregada", nullable = false)
	private int cantidadEntregada;

	@Enumerated(EnumType.STRING)
	@Column(name = "estado_item", nullable = false, length = 20)
	private EstadoPedidoItem estadoItem;

	protected PedidoItem() {
	}

	public UUID getId() {
		return id;
	}

	public UUID getPedidoId() {
		return pedidoId;
	}

	public void setPedidoId(UUID pedidoId) {
		this.pedidoId = pedidoId;
	}

	public UUID getMedicamentoId() {
		return medicamentoId;
	}

	public void setMedicamentoId(UUID medicamentoId) {
		this.medicamentoId = medicamentoId;
	}

	public int getCantidadSolicitada() {
		return cantidadSolicitada;
	}

	public void setCantidadSolicitada(int cantidadSolicitada) {
		this.cantidadSolicitada = cantidadSolicitada;
	}

	public int getCantidadReservada() {
		return cantidadReservada;
	}

	public void setCantidadReservada(int cantidadReservada) {
		this.cantidadReservada = cantidadReservada;
	}

	public int getCantidadEntregada() {
		return cantidadEntregada;
	}

	public void setCantidadEntregada(int cantidadEntregada) {
		this.cantidadEntregada = cantidadEntregada;
	}

	public EstadoPedidoItem getEstadoItem() {
		return estadoItem;
	}

	public void setEstadoItem(EstadoPedidoItem estadoItem) {
		this.estadoItem = estadoItem;
	}
}
