package co.farmagestion.api.integracion;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "evento_integracion")
public class EventoIntegracion {

	@Id
	@GeneratedValue(strategy = GenerationType.UUID)
	@Column(name = "id", nullable = false, updatable = false)
	private UUID id;

	@Column(name = "tipo", nullable = false, length = 40)
	private String tipo;

	@JdbcTypeCode(SqlTypes.JSON)
	@Column(name = "payload", nullable = false, columnDefinition = "jsonb")
	private String payload;

	@Enumerated(EnumType.STRING)
	@Column(name = "estado", nullable = false, length = 20)
	private EstadoEventoIntegracion estado;

	@Column(name = "intentos", nullable = false)
	private int intentos;

	@Column(name = "ultimo_error", columnDefinition = "text")
	private String ultimoError;

	@Column(name = "idempotency_key", nullable = false, unique = true, length = 120)
	private String idempotencyKey;

	@Column(name = "created_at", nullable = false, updatable = false)
	private Instant createdAt = Instant.now();

	@Column(name = "enviado_en")
	private Instant enviadoEn;

	protected EventoIntegracion() {
	}

	public UUID getId() {
		return id;
	}

	public String getTipo() {
		return tipo;
	}

	public void setTipo(String tipo) {
		this.tipo = tipo;
	}

	public String getPayload() {
		return payload;
	}

	public void setPayload(String payload) {
		this.payload = payload;
	}

	public EstadoEventoIntegracion getEstado() {
		return estado;
	}

	public void setEstado(EstadoEventoIntegracion estado) {
		this.estado = estado;
	}

	public int getIntentos() {
		return intentos;
	}

	public void setIntentos(int intentos) {
		this.intentos = intentos;
	}

	public String getUltimoError() {
		return ultimoError;
	}

	public void setUltimoError(String ultimoError) {
		this.ultimoError = ultimoError;
	}

	public String getIdempotencyKey() {
		return idempotencyKey;
	}

	public void setIdempotencyKey(String idempotencyKey) {
		this.idempotencyKey = idempotencyKey;
	}

	public Instant getCreatedAt() {
		return createdAt;
	}

	public Instant getEnviadoEn() {
		return enviadoEn;
	}

	public void setEnviadoEn(Instant enviadoEn) {
		this.enviadoEn = enviadoEn;
	}
}
