package co.farmagestion.api.inventario;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "movimiento_inventario")
public class MovimientoInventario {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "sede_id", nullable = false)
	private UUID sedeId;

	@Column(name = "medicamento_id", nullable = false)
	private UUID medicamentoId;

	@Enumerated(EnumType.STRING)
	@Column(name = "tipo", nullable = false, length = 25)
	private TipoMovimientoInventario tipo;

	@Column(name = "cantidad", nullable = false)
	private int cantidad;

	@Column(name = "saldo_fisico", nullable = false)
	private int saldoFisico;

	@Column(name = "referencia_tipo", length = 40)
	private String referenciaTipo;

	@Column(name = "referencia_id")
	private UUID referenciaId;

	@Column(name = "usuario_id")
	private UUID usuarioId;

	@Column(name = "motivo", columnDefinition = "text")
	private String motivo;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected MovimientoInventario() {
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

	public UUID getMedicamentoId() {
		return medicamentoId;
	}

	public void setMedicamentoId(UUID medicamentoId) {
		this.medicamentoId = medicamentoId;
	}

	public TipoMovimientoInventario getTipo() {
		return tipo;
	}

	public void setTipo(TipoMovimientoInventario tipo) {
		this.tipo = tipo;
	}

	public int getCantidad() {
		return cantidad;
	}

	public void setCantidad(int cantidad) {
		this.cantidad = cantidad;
	}

	public int getSaldoFisico() {
		return saldoFisico;
	}

	public void setSaldoFisico(int saldoFisico) {
		this.saldoFisico = saldoFisico;
	}

	public String getReferenciaTipo() {
		return referenciaTipo;
	}

	public void setReferenciaTipo(String referenciaTipo) {
		this.referenciaTipo = referenciaTipo;
	}

	public UUID getReferenciaId() {
		return referenciaId;
	}

	public void setReferenciaId(UUID referenciaId) {
		this.referenciaId = referenciaId;
	}

	public UUID getUsuarioId() {
		return usuarioId;
	}

	public void setUsuarioId(UUID usuarioId) {
		this.usuarioId = usuarioId;
	}

	public String getMotivo() {
		return motivo;
	}

	public void setMotivo(String motivo) {
		this.motivo = motivo;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
