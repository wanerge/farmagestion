-- Secuencia para generar códigos de fórmula FRM-{año}-{6 dígitos} (RF-EPS-04)

CREATE SEQUENCE IF NOT EXISTS "formula_codigo_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
