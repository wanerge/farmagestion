package co.farmagestion.api.turnos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.UUID;

@Entity
@Table(name = "turno")
public class Turno {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "pedido_id", nullable = false, unique = true)
	private UUID pedidoId;

	@Column(name = "sede_id", nullable = false)
	private UUID sedeId;

	@Column(name = "fecha", nullable = false)
	private LocalDate fecha;

	@Column(name = "franja_inicio", nullable = false)
	private LocalTime franjaInicio;

	@Column(name = "numero", nullable = false)
	private int numero;

	@Column(name = "codigo", nullable = false, length = 30)
	private String codigo;

	@Enumerated(EnumType.STRING)
	@Column(name = "estado", nullable = false, length = 20)
	private EstadoTurno estado;

	@Column(name = "llamado_en")
	private Instant llamadoEn;

	@Column(name = "atendido_en")
	private Instant atendidoEn;

	protected Turno() {
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

	public UUID getSedeId() {
		return sedeId;
	}

	public void setSedeId(UUID sedeId) {
		this.sedeId = sedeId;
	}

	public LocalDate getFecha() {
		return fecha;
	}

	public void setFecha(LocalDate fecha) {
		this.fecha = fecha;
	}

	public LocalTime getFranjaInicio() {
		return franjaInicio;
	}

	public void setFranjaInicio(LocalTime franjaInicio) {
		this.franjaInicio = franjaInicio;
	}

	public int getNumero() {
		return numero;
	}

	public void setNumero(int numero) {
		this.numero = numero;
	}

	public String getCodigo() {
		return codigo;
	}

	public void setCodigo(String codigo) {
		this.codigo = codigo;
	}

	public EstadoTurno getEstado() {
		return estado;
	}

	public void setEstado(EstadoTurno estado) {
		this.estado = estado;
	}

	public Instant getLlamadoEn() {
		return llamadoEn;
	}

	public void setLlamadoEn(Instant llamadoEn) {
		this.llamadoEn = llamadoEn;
	}

	public Instant getAtendidoEn() {
		return atendidoEn;
	}

	public void setAtendidoEn(Instant atendidoEn) {
		this.atendidoEn = atendidoEn;
	}
}
