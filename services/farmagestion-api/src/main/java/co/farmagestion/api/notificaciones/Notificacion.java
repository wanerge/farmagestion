package co.farmagestion.api.notificaciones;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notificacion")
public class Notificacion {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "usuario_id", nullable = false)
	private UUID usuarioId;

	@Column(name = "tipo", nullable = false, length = 40)
	private String tipo;

	@Column(name = "titulo", nullable = false, length = 200)
	private String titulo;

	@Column(name = "mensaje", nullable = false, columnDefinition = "text")
	private String mensaje;

	@Column(name = "referencia_tipo", length = 40)
	private String referenciaTipo;

	@Column(name = "referencia_id")
	private UUID referenciaId;

	@Column(name = "leida", nullable = false)
	private boolean leida;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	protected Notificacion() {
	}

	public UUID getId() {
		return id;
	}

	public UUID getUsuarioId() {
		return usuarioId;
	}

	public void setUsuarioId(UUID usuarioId) {
		this.usuarioId = usuarioId;
	}

	public String getTipo() {
		return tipo;
	}

	public void setTipo(String tipo) {
		this.tipo = tipo;
	}

	public String getTitulo() {
		return titulo;
	}

	public void setTitulo(String titulo) {
		this.titulo = titulo;
	}

	public String getMensaje() {
		return mensaje;
	}

	public void setMensaje(String mensaje) {
		this.mensaje = mensaje;
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

	public boolean isLeida() {
		return leida;
	}

	public void setLeida(boolean leida) {
		this.leida = leida;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}
}
