package co.farmagestion.api.formulas;

public sealed interface ResultadoDispensacionSimulador {

	record Exito(SimuladorFormulaResponse formula) implements ResultadoDispensacionSimulador {
	}

	record ErrorDefinitivo(int status, String code, String detalle) implements ResultadoDispensacionSimulador {
	}

	record ErrorReintentable(String detalle) implements ResultadoDispensacionSimulador {
	}
}
