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
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "ruta")
public class Ruta {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "sede_id", nullable = false)
	private UUID sedeId;

	@Column(name = "domiciliario_id", nullable = false)
	private UUID domiciliarioId;

	@Column(name = "fecha", nullable = false)
	private LocalDate fecha;

	@Enumerated(EnumType.STRING)
	@Column(name = "estado", nullable = false, length = 20)
	private EstadoRuta estado;

	@Column(name = "distancia_km", nullable = false, precision = 10, scale = 3)
	private BigDecimal distanciaKm = BigDecimal.ZERO;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected Ruta() {
	}

	public UUID getId() {
		return id;
	}

	public UUID getSedeId() {
		return sedeId;
	}

	public void setSedeId(UUID sedeId) {
		this.sedeId = sedeId;
	}

	public UUID getDomiciliarioId() {
		return domiciliarioId;
	}

	public void setDomiciliarioId(UUID domiciliarioId) {
		this.domiciliarioId = domiciliarioId;
	}

	public LocalDate getFecha() {
		return fecha;
	}

	public void setFecha(LocalDate fecha) {
		this.fecha = fecha;
	}

	public EstadoRuta getEstado() {
		return estado;
	}

	public void setEstado(EstadoRuta estado) {
		this.estado = estado;
	}

	public BigDecimal getDistanciaKm() {
		return distanciaKm;
	}

	public void setDistanciaKm(BigDecimal distanciaKm) {
		this.distanciaKm = distanciaKm;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
