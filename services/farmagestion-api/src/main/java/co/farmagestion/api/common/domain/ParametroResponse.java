package co.farmagestion.api.common.domain;

public record ParametroResponse(
		String clave,
		String valor,
		String descripcion) {

	public static ParametroResponse from(Parametro parametro) {
		return new ParametroResponse(
				parametro.getClave(),
				parametro.getValor(),
				parametro.getDescripcion());
	}
}
