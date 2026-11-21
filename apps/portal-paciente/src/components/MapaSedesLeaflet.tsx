"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SedePublica } from "@/lib/api/client";
import { formatearHora } from "@/lib/format";

interface MapaSedesLeafletProps {
  sedes: SedePublica[];
  sedeSeleccionadaId?: string | null;
  onSeleccionarSede?: (sedeId: string) => void;
}

function crearIconoSede(seleccionada: boolean): L.DivIcon {
  const colorFondo = seleccionada ? "#0f766e" : "#0284c7";
  const anillo = seleccionada ? "0 0 0 4px rgba(15,118,110,0.28)" : "0 2px 6px rgba(15,23,42,0.3)";
  const size = seleccionada ? 34 : 28;

  return L.divIcon({
    className: "farmagestion-marker",
    html: `<div style="
      width:${size}px;
      height:${size}px;
      border-radius:9999px;
      background:${colorFondo};
      border:3px solid #ffffff;
      box-shadow:${anillo};
      display:flex;
      align-items:center;
      justify-content:center;
      color:#ffffff;
      font-weight:700;
      font-size:${seleccionada ? 14 : 12}px;
      font-family:system-ui,sans-serif;
    ">+</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default function MapaSedesLeaflet({
  sedes,
  sedeSeleccionadaId,
  onSeleccionarSede,
}: MapaSedesLeafletProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  // Inicializar mapa OpenStreetMap (sin API keys)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [6.2476, -75.5658], // Área Metropolitana del Valle de Aburrá
      zoom: 11,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
    const markers = markersRef.current;

    return () => {
      markers.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sincronizar marcadores de sedes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current.clear();

    const coords: [number, number][] = [];

    for (const sede of sedes) {
      if (
        typeof sede.latitud !== "number" ||
        typeof sede.longitud !== "number" ||
        !sede.id
      ) {
        continue;
      }

      const pos: [number, number] = [sede.latitud, sede.longitud];
      coords.push(pos);

      const seleccionada = sede.id === sedeSeleccionadaId;
      const marker = L.marker(pos, {
        icon: crearIconoSede(seleccionada),
        title: sede.nombre ?? sede.codigo ?? "Sede",
      }).addTo(map);

      const horario = `${formatearHora(sede.horaApertura)} – ${formatearHora(
        sede.horaCierre
      )}`;

      marker.bindPopup(
        `<div style="min-width:180px;font-family:system-ui,sans-serif;">
          <p style="margin:0;font-weight:700;color:#0f172a;font-size:13px;">${escaparHtml(
            sede.nombre ?? "Sede"
          )}</p>
          <p style="margin:2px 0 0;color:#0f766e;font-size:11px;font-family:monospace;">${escaparHtml(
            sede.codigo ?? ""
          )}</p>
          <p style="margin:6px 0 0;color:#334155;font-size:12px;">${escaparHtml(
            sede.direccion ?? ""
          )}</p>
          <p style="margin:4px 0 0;color:#475569;font-size:12px;"><strong>Horario:</strong> ${escaparHtml(
            horario
          )}</p>
        </div>`
      );

      marker.on("click", () => {
        if (sede.id && onSeleccionarSede) {
          onSeleccionarSede(sede.id);
        }
      });

      markersRef.current.set(sede.id, marker);
    }

    if (coords.length > 0 && !sedeSeleccionadaId) {
      if (coords.length === 1) {
        map.setView(coords[0], 14);
      } else {
        map.fitBounds(L.latLngBounds(coords), { padding: [36, 36], maxZoom: 13 });
      }
    }
  }, [sedes, sedeSeleccionadaId, onSeleccionarSede]);

  // Enfocar sede seleccionada
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !sedeSeleccionadaId) return;

    const marker = markersRef.current.get(sedeSeleccionadaId);
    if (marker) {
      const ll = marker.getLatLng();
      map.flyTo(ll, 14, { duration: 0.6 });
      marker.openPopup();
    }
  }, [sedeSeleccionadaId]);

  return (
    <div
      ref={containerRef}
      aria-label="Mapa de sedes de FarmaGestión"
      className="z-0 h-72 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-96"
    />
  );
}
