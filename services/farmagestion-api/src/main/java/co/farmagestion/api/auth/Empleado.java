package co.farmagestion.api.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "empleado")
public class Empleado {

	@Id
	@Column(name = "usuario_id", nullable = false, updatable = false)
	private UUID usuarioId;

	@Column(name = "sede_id")
	private UUID sedeId;

	@Enumerated(EnumType.STRING)
	@Column(name = "cargo", nullable = false, length = 20)
	private CargoEmpleado cargo;

	@Column(name = "nombres", nullable = false, length = 120)
	private String nombres;

	@Column(name = "apellidos", nullable = false, length = 120)
	private String apellidos;

	protected Empleado() {
	}

	public UUID getUsuarioId() {
		return usuarioId;
	}

	public void setUsuarioId(UUID usuarioId) {
		this.usuarioId = usuarioId;
	}

	public UUID getSedeId() {
		return sedeId;
	}

	public void setSedeId(UUID sedeId) {
		this.sedeId = sedeId;
	}

	public CargoEmpleado getCargo() {
		return cargo;
	}

	public void setCargo(CargoEmpleado cargo) {
		this.cargo = cargo;
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
}
