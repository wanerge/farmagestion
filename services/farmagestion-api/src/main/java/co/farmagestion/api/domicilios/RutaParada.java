package co.farmagestion.api.domicilios;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "ruta_parada")
public class RutaParada {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "ruta_id", nullable = false)
	private UUID rutaId;

	@Column(name = "pedido_id", nullable = false, unique = true)
	private UUID pedidoId;

	@Column(name = "orden", nullable = false)
	private int orden;

	@Enumerated(EnumType.STRING)
	@Column(name = "estado", nullable = false, length = 20)
	private EstadoRutaParada estado;

	@Column(name = "distancia_km_desde_anterior", nullable = false, precision = 10, scale = 3)
	private BigDecimal distanciaKmDesdeAnterior = BigDecimal.ZERO;

	protected RutaParada() {
	}

	public UUID getId() {
		return id;
	}

	public UUID getRutaId() {
		return rutaId;
	}

	public void setRutaId(UUID rutaId) {
		this.rutaId = rutaId;
	}

	public UUID getPedidoId() {
		return pedidoId;
	}

	public void setPedidoId(UUID pedidoId) {
		this.pedidoId = pedidoId;
	}

	public int getOrden() {
		return orden;
	}

	public void setOrden(int orden) {
		this.orden = orden;
	}

	public EstadoRutaParada getEstado() {
		return estado;
	}

	public void setEstado(EstadoRutaParada estado) {
		this.estado = estado;
	}

	public BigDecimal getDistanciaKmDesdeAnterior() {
		return distanciaKmDesdeAnterior;
	}

	public void setDistanciaKmDesdeAnterior(BigDecimal distanciaKmDesdeAnterior) {
		this.distanciaKmDesdeAnterior = distanciaKmDesdeAnterior;
	}
}
