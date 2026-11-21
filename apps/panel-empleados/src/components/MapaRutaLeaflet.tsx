"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PedidoPendienteDomicilio, RutaParada } from "@/lib/api/client";
import { formatearDistanciaKm } from "@/lib/format";

export interface OrigenSedeMapa {
  nombre?: string | null;
  codigo?: string | null;
  direccion?: string | null;
  latitud?: number | null;
  longitud?: number | null;
}

interface MapaRutaLeafletProps {
  origen?: OrigenSedeMapa | null;
  pendientes?: PedidoPendienteDomicilio[];
  seleccionadosIds?: string[];
  onToggleSeleccion?: (pedidoId: string) => void;
  paradas?: RutaParada[];
  alturaClase?: string;
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function iconoSede(): L.DivIcon {
  return L.divIcon({
    className: "fg-marker-sede",
    html: `<div style="
      width:34px;
      height:34px;
      border-radius:9999px;
      background:#047857;
      border:3px solid #ffffff;
      box-shadow:0 0 0 4px rgba(4,120,87,0.25);
      display:flex;
      align-items:center;
      justify-content:center;
      color:#ffffff;
      font-weight:800;
      font-size:13px;
      font-family:system-ui,sans-serif;
    ">S</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

function iconoPendiente(seleccionado: boolean): L.DivIcon {
  const bg = seleccionado ? "#4f46e5" : "#0284c7";
  const ring = seleccionado
    ? "0 0 0 4px rgba(79,70,229,0.28)"
    : "0 2px 6px rgba(15,23,42,0.28)";
  const size = seleccionado ? 30 : 24;
  return L.divIcon({
    className: "fg-marker-pendiente",
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      background:${bg};
      border:2.5px solid #ffffff;
      box-shadow:${ring};
      display:flex;
      align-items:center;
      justify-content:center;
      color:#ffffff;
      font-weight:700;
      font-size:${seleccionado ? 13 : 11}px;
      font-family:system-ui,sans-serif;
    ">${seleccionado ? "✓" : "•"}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function iconoParada(orden: number, estado?: string): L.DivIcon {
  const bg =
    estado === "ENTREGADA"
      ? "#059669"
      : estado === "FALLIDA"
        ? "#e11d48"
        : "#4f46e5";
  return L.divIcon({
    className: "fg-marker-parada",
    html: `<div style="
      width:30px;
      height:30px;
      border-radius:9999px;
      background:${bg};
      border:2.5px solid #ffffff;
      box-shadow:0 2px 6px rgba(15,23,42,0.32);
      display:flex;
      align-items:center;
      justify-content:center;
      color:#ffffff;
      font-weight:800;
      font-size:12px;
      font-family:system-ui,sans-serif;
    ">${orden}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

export default function MapaRutaLeaflet({
  origen,
  pendientes = [],
  seleccionadosIds = [],
  onToggleSeleccion,
  paradas = [],
  alturaClase = "h-80 sm:h-96",
}: MapaRutaLeafletProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [6.2476, -75.5658],
      zoom: 12,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const boundsCoords: [number, number][] = [];

    // 1. Sede de origen
    const tieneOrigen =
      typeof origen?.latitud === "number" &&
      typeof origen?.longitud === "number";
    if (tieneOrigen) {
      const posOrigen: [number, number] = [
        origen!.latitud!,
        origen!.longitud!,
      ];
      boundsCoords.push(posOrigen);

      L.marker(posOrigen, {
        icon: iconoSede(),
        title: origen?.nombre ?? "Sede origen",
        zIndexOffset: 500,
      })
        .bindPopup(
          `<div style="min-width:170px;font-family:system-ui,sans-serif;">
            <p style="margin:0;font-weight:700;color:#065f46;font-size:12px;">ORIGEN · ${escaparHtml(
              origen?.codigo ?? "SEDE"
            )}</p>
            <p style="margin:2px 0 0;font-weight:600;color:#0f172a;font-size:13px;">${escaparHtml(
              origen?.nombre ?? "Sede"
            )}</p>
            <p style="margin:4px 0 0;color:#475569;font-size:11px;">${escaparHtml(
              origen?.direccion ?? ""
            )}</p>
          </div>`
        )
        .addTo(group);
    }

    // 2. Modo ruta (paradas ordenadas + polilínea abierta sin regreso a sede)
    if (paradas.length > 0) {
      const lineaCoords: [number, number][] = [];
      if (tieneOrigen) {
        lineaCoords.push([origen!.latitud!, origen!.longitud!]);
      }

      const ordenadas = [...paradas].sort(
        (a, b) => (a.orden ?? 0) - (b.orden ?? 0)
      );

      for (const parada of ordenadas) {
        if (
          typeof parada.latitudEntrega !== "number" ||
          typeof parada.longitudEntrega !== "number"
        ) {
          continue;
        }
        const pos: [number, number] = [
          parada.latitudEntrega,
          parada.longitudEntrega,
        ];
        lineaCoords.push(pos);
        boundsCoords.push(pos);

        L.marker(pos, {
          icon: iconoParada(parada.orden ?? 0, parada.estado),
          title: `Parada ${parada.orden}: ${parada.pedidoCodigo ?? ""}`,
        })
          .bindPopup(
            `<div style="min-width:190px;font-family:system-ui,sans-serif;">
              <p style="margin:0;font-weight:700;color:#312e81;font-size:12px;">Parada #${parada.orden ?? "—"} · ${escaparHtml(
                parada.pedidoCodigo ?? ""
              )}</p>
              <p style="margin:3px 0 0;font-weight:600;color:#0f172a;font-size:12px;">${escaparHtml(
                parada.pacienteNombre ?? "Paciente"
              )}</p>
              <p style="margin:3px 0 0;color:#334155;font-size:11px;">${escaparHtml(
                parada.direccionEntrega ?? ""
              )}</p>
              <p style="margin:4px 0 0;color:#475569;font-size:11px;">Tramo: <strong>${escaparHtml(
                formatearDistanciaKm(parada.distanciaKmDesdeAnterior)
              )}</strong> · Estado: <strong>${escaparHtml(
                parada.estado ?? "PENDIENTE"
              )}</strong></p>
            </div>`
          )
          .addTo(group);
      }

      if (lineaCoords.length >= 2) {
        L.polyline(lineaCoords, {
          color: "#4f46e5",
          weight: 3.5,
          opacity: 0.85,
          dashArray: "8 6",
        }).addTo(group);
      }
    }

    // 3. Modo selección de pendientes (cuando no se está mostrando una ruta específica)
    if (paradas.length === 0 && pendientes.length > 0) {
      const seleccionSet = new Set(seleccionadosIds);
      for (const pedido of pendientes) {
        if (
          !pedido.id ||
          typeof pedido.latitudEntrega !== "number" ||
          typeof pedido.longitudEntrega !== "number"
        ) {
          continue;
        }
        const pos: [number, number] = [
          pedido.latitudEntrega,
          pedido.longitudEntrega,
        ];
        boundsCoords.push(pos);
        const seleccionado = seleccionSet.has(pedido.id);

        const marker = L.marker(pos, {
          icon: iconoPendiente(seleccionado),
          title: `${pedido.codigo ?? "Pedido"} — ${pedido.direccionEntrega ?? ""}`,
        })
          .bindPopup(
            `<div style="min-width:190px;font-family:system-ui,sans-serif;">
              <p style="margin:0;font-weight:700;color:#0f172a;font-size:12px;">${escaparHtml(
                pedido.codigo ?? ""
              )}</p>
              <p style="margin:2px 0 0;color:#334155;font-size:12px;">${escaparHtml(
                pedido.pacienteNombre ?? ""
              )}</p>
              <p style="margin:3px 0 0;color:#475569;font-size:11px;">${escaparHtml(
                pedido.direccionEntrega ?? ""
              )}</p>
              <p style="margin:4px 0 0;color:#4f46e5;font-size:11px;font-weight:600;">${
                seleccionado
                  ? "Seleccionado para ruta (clic para quitar)"
                  : "Clic en el marcador para seleccionar"
              }</p>
            </div>`
          )
          .addTo(group);

        if (onToggleSeleccion) {
          const idPedido = pedido.id;
          marker.on("click", () => {
            onToggleSeleccion(idPedido);
          });
        }
      }
    }

    if (boundsCoords.length === 1) {
      map.setView(boundsCoords[0], 14);
    } else if (boundsCoords.length > 1) {
      map.fitBounds(L.latLngBounds(boundsCoords), {
        padding: [36, 36],
        maxZoom: 14,
      });
    }
  }, [origen, pendientes, seleccionadosIds, onToggleSeleccion, paradas]);

  return (
    <div
      ref={containerRef}
      aria-label="Mapa interactivo de rutas de domicilio"
      className={`z-0 w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${alturaClase}`}
    />
  );
}
