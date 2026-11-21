package co.farmagestion.api.common.web;

import java.util.List;
import org.springframework.data.domain.Page;

public record PaginaResponse<T>(
		List<T> content,
		int page,
		int size,
		long totalElements) {

	public static <T> PaginaResponse<T> of(Page<T> springPage) {
		return new PaginaResponse<>(
				springPage.getContent(),
				springPage.getNumber(),
				springPage.getSize(),
				springPage.getTotalElements());
	}
}
