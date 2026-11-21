package co.farmagestion.api.common.web;

import jakarta.validation.ConstraintViolationException;
import java.net.URI;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
	private static final String BASE_ERROR_TYPE = "https://farmagestion.co/errores/";

	@ExceptionHandler(ApiException.class)
	public ProblemDetail handleApiException(ApiException ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(ex.getStatus(), ex.getMessage());
		problem.setType(URI.create(BASE_ERROR_TYPE + ex.getCode().toLowerCase(Locale.ROOT).replace('_', '-')));
		problem.setTitle(ex.getTitle());
		problem.setProperty("code", ex.getCode());
		ex.getProperties().forEach(problem::setProperty);
		return problem;
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	public ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
		Map<String, String> errores = new LinkedHashMap<>();
		for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
			errores.putIfAbsent(fieldError.getField(), fieldError.getDefaultMessage());
		}
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.BAD_REQUEST,
				"Los datos enviados no son válidos.");
		problem.setType(URI.create(BASE_ERROR_TYPE + "validacion"));
		problem.setTitle("Error de validación");
		problem.setProperty("code", "VALIDACION_ERROR");
		if (!errores.isEmpty()) {
			problem.setProperty("errores", errores);
		}
		return problem;
	}

	@ExceptionHandler(ConstraintViolationException.class)
	public ProblemDetail handleConstraintViolation(ConstraintViolationException ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.BAD_REQUEST,
				"Los parámetros enviados no son válidos.");
		problem.setType(URI.create(BASE_ERROR_TYPE + "validacion"));
		problem.setTitle("Error de validación");
		problem.setProperty("code", "VALIDACION_ERROR");
		return problem;
	}

	@ExceptionHandler({
			HttpMessageNotReadableException.class,
			MethodArgumentTypeMismatchException.class,
			MissingServletRequestParameterException.class
	})
	public ProblemDetail handleBadRequest(Exception ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.BAD_REQUEST,
				"La solicitud tiene un formato o parámetro inválido.");
		problem.setType(URI.create(BASE_ERROR_TYPE + "solicitud-invalida"));
		problem.setTitle("Solicitud inválida");
		problem.setProperty("code", "SOLICITUD_INVALIDA");
		return problem;
	}

	@ExceptionHandler(AuthenticationException.class)
	public ProblemDetail handleAuthentication(AuthenticationException ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.UNAUTHORIZED,
				"Se requiere autenticación válida para acceder a este recurso.");
		problem.setType(URI.create(BASE_ERROR_TYPE + "no-autenticado"));
		problem.setTitle("No autenticado");
		problem.setProperty("code", "NO_AUTENTICADO");
		return problem;
	}

	@ExceptionHandler(AccessDeniedException.class)
	public ProblemDetail handleAccessDenied(AccessDeniedException ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.FORBIDDEN,
				"No tiene permisos para realizar esta operación.");
		problem.setType(URI.create(BASE_ERROR_TYPE + "acceso-denegado"));
		problem.setTitle("Acceso denegado");
		problem.setProperty("code", "ACCESO_DENEGADO");
		return problem;
	}

	@ExceptionHandler(NoResourceFoundException.class)
	public ProblemDetail handleNotFound(NoResourceFoundException ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.NOT_FOUND,
				"El recurso solicitado no existe.");
		problem.setType(URI.create(BASE_ERROR_TYPE + "no-encontrado"));
		problem.setTitle("Recurso no encontrado");
		problem.setProperty("code", "RECURSO_NO_ENCONTRADO");
		return problem;
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	public ProblemDetail handleDataIntegrity(DataIntegrityViolationException ex) {
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.CONFLICT,
				"La operación entra en conflicto con el estado actual de los datos.");
		problem.setType(URI.create(BASE_ERROR_TYPE + "conflicto-datos"));
		problem.setTitle("Conflicto de datos");
		problem.setProperty("code", "CONFLICTO_DATOS");
		return problem;
	}

	@ExceptionHandler(Exception.class)
	public ProblemDetail handleGeneric(Exception ex) {
		log.error("Error interno no controlado", ex);
		ProblemDetail problem = ProblemDetail.forStatusAndDetail(
				HttpStatus.INTERNAL_SERVER_ERROR,
				"Ocurrió un error interno inesperado.");
		problem.setType(URI.create(BASE_ERROR_TYPE + "error-interno"));
		problem.setTitle("Error interno del servidor");
		problem.setProperty("code", "ERROR_INTERNO");
		return problem;
	}
}
