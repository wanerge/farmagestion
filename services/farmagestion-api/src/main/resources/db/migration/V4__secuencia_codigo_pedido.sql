-- V4: Secuencia para generar códigos legibles únicos de pedido (PED-AAAA-NNNNNN)

CREATE SEQUENCE IF NOT EXISTS seq_pedido_codigo START WITH 1 INCREMENT BY 1;
