package co.farmagestion.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "paciente")
public class Paciente {

	@Id
	@Column(name = "usuario_id", nullable = false, updatable = false)
	private UUID usuarioId;

	@Column(name = "tipo_documento", nullable = false, length = 10)
	private String tipoDocumento;

	@Column(name = "documento", nullable = false, length = 30)
	private String documento;

	@Column(name = "nombres", nullable = false, length = 120)
	private String nombres;

	@Column(name = "apellidos", nullable = false, length = 120)
	private String apellidos;

	@Column(name = "telefono", length = 30)
	private String telefono;

	protected Paciente() {
	}

	public UUID getUsuarioId() {
		return usuarioId;
	}

	public void setUsuarioId(UUID usuarioId) {
		this.usuarioId = usuarioId;
	}

	public String getTipoDocumento() {
		return tipoDocumento;
	}

	public void setTipoDocumento(String tipoDocumento) {
		this.tipoDocumento = tipoDocumento;
	}

	public String getDocumento() {
		return documento;
	}

	public void setDocumento(String documento) {
		this.documento = documento;
	}

	public String getNombres() {
		return nombres;
	}

	public void setNombres(String nombres) {
		this.nombres = nombres;
	}

	public String getApellidos() {
		return apellidos;
	}

	public void setApellidos(String apellidos) {
		this.apellidos = apellidos;
	}

	public String getTelefono() {
		return telefono;
	}

	public void setTelefono(String telefono) {
		this.telefono = telefono;
	}
}
