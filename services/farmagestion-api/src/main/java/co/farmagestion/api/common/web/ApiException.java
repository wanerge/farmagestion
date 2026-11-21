package co.farmagestion.api.common.web;

import java.util.Collections;
import java.util.Map;
import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

	private final HttpStatus status;
	private final String code;
	private final String title;
	private final Map<String, Object> properties;

	public ApiException(HttpStatus status, String code, String title, String detail) {
		this(status, code, title, detail, Collections.emptyMap());
	}

	public ApiException(
			HttpStatus status,
			String code,
			String title,
			String detail,
			Map<String, Object> properties) {
		super(detail);
		this.status = status;
		this.code = code;
		this.title = title;
		this.properties = properties == null ? Collections.emptyMap() : Map.copyOf(properties);
	}

	public HttpStatus getStatus() {
		return status;
	}

	public String getCode() {
		return code;
	}

	public String getTitle() {
		return title;
	}

	public Map<String, Object> getProperties() {
		return properties;
	}

	public static ApiException badRequest(String code, String title, String detail) {
		return new ApiException(HttpStatus.BAD_REQUEST, code, title, detail);
	}

	public static ApiException unauthorized(String code, String title, String detail) {
		return new ApiException(HttpStatus.UNAUTHORIZED, code, title, detail);
	}

	public static ApiException forbidden(String code, String title, String detail) {
		return new ApiException(HttpStatus.FORBIDDEN, code, title, detail);
	}

	public static ApiException notFound(String code, String title, String detail) {
		return new ApiException(HttpStatus.NOT_FOUND, code, title, detail);
	}

	public static ApiException conflict(String code, String title, String detail) {
		return new ApiException(HttpStatus.CONFLICT, code, title, detail);
	}

	public static ApiException conflict(
			String code, String title, String detail, Map<String, Object> properties) {
		return new ApiException(HttpStatus.CONFLICT, code, title, detail, properties);
	}

	public static ApiException unprocessable(String code, String title, String detail) {
		return new ApiException(HttpStatus.UNPROCESSABLE_CONTENT, code, title, detail);
	}
}
