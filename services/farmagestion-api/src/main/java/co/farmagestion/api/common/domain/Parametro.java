package co.farmagestion.api.common.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "parametro")
public class Parametro {

	@Id
	@Column(name = "clave", nullable = false, length = 100)
	private String clave;

	@Column(name = "valor", nullable = false, length = 255)
	private String valor;

	@Column(name = "descripcion", columnDefinition = "text")
	private String descripcion;

	protected Parametro() {
	}

	public String getClave() {
		return clave;
	}

	public void setClave(String clave) {
		this.clave = clave;
	}

	public String getValor() {
		return valor;
	}

	public void setValor(String valor) {
		this.valor = valor;
	}

	public String getDescripcion() {
		return descripcion;
	}

	public void setDescripcion(String descripcion) {
		this.descripcion = descripcion;
	}
}
