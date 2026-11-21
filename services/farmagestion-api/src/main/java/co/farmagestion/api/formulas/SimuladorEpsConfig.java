package co.farmagestion.api.formulas;

import java.net.http.HttpClient;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class SimuladorEpsConfig {

	@Bean("simuladorEpsRestClient")
	RestClient simuladorEpsRestClient(
			@Value("${app.integracion.eps-simulador-url}") String baseUrl,
			@Value("${app.integracion.eps-simulador-api-key}") String apiKey,
			@Value("${app.integracion.timeout-segundos:10}") int timeoutSegundos) {
		Duration timeout = Duration.ofSeconds(Math.max(1, timeoutSegundos));
		HttpClient httpClient = HttpClient.newBuilder()
				.version(HttpClient.Version.HTTP_1_1)
				.connectTimeout(timeout)
				.build();
		JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
		requestFactory.setReadTimeout(timeout);

		String normalizedBase = baseUrl == null ? "" : baseUrl.trim().replaceAll("/+$", "");
		return RestClient.builder()
				.baseUrl(normalizedBase + "/api/v1")
				.requestFactory(requestFactory)
				.defaultHeader("X-API-Key", apiKey == null ? "" : apiKey)
				.build();
	}
}
