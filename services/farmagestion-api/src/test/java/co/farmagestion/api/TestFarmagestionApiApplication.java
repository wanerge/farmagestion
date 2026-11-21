package co.farmagestion.api;

import org.springframework.boot.SpringApplication;

public class TestFarmagestionApiApplication {

	public static void main(String[] args) {
		SpringApplication.from(FarmagestionApiApplication::main).with(TestcontainersConfiguration.class).run(args);
	}

}
