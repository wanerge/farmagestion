package co.farmagestion.api.inventario;

public enum NivelDisponibilidad {
	DISPONIBLE,
	POCAS_UNIDADES,
	AGOTADO;

	public static NivelDisponibilidad calcular(int disponible, int stockMinimo) {
		if (disponible <= 0) {
			return AGOTADO;
		}
		if (disponible <= stockMinimo) {
			return POCAS_UNIDADES;
		}
		return DISPONIBLE;
	}
}
