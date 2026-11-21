package co.farmagestion.api.common.web;

import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class GlobalExceptionHandler {

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.BAD_REQUEST,
				"Los datos enviados no son válidos.");
		problem.setType(URI.create("https://farmagestion.co/errores/validacion"));
		problem.setTitle("Error de validación");
		problem.setProperty("code", "VALIDACION_ERROR");
		return problem;
	}

	@ExceptionHandler(NoResourceFoundException.class)
	public ProblemDetail handleNotFound(NoResourceFoundException ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.NOT_FOUND,
				"El recurso solicitado no existe.");
		problem.setType(URI.create("https://farmagestion.co/errores/no-encontrado"));
		problem.setTitle("Recurso no encontrado");
		problem.setProperty("code", "RECURSO_NO_ENCONTRADO");
		return problem;
	}

	@ExceptionHandler(Exception.class)
	public ProblemDetail handleGeneric(Exception ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.INTERNAL_SERVER_ERROR,
				"Ocurrió un error interno inesperado.");
		problem.setType(URI.create("https://farmagestion.co/errores/error-interno"));
		problem.setTitle("Error interno del servidor");
		problem.setProperty("code", "ERROR_INTERNO");
		return problem;
	}
}
