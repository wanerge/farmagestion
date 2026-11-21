# Etapa 1: compilación con JDK 21
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw && ./mvnw -B dependency:go-offline

COPY src src
RUN ./mvnw -B package -DskipTests

# Etapa 2: ejecución con JRE 21 y usuario no root ajustado a 512 MB de RAM
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/target/*.jar app.jar
RUN chown appuser:appgroup app.jar

USER appuser

ENV PORT=8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65.0 -XX:+UseSerialGC -Xss256k -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
