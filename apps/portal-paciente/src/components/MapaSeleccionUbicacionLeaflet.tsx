"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { SedePublica } from "@/lib/api/client";

interface MapaSeleccionUbicacionLeafletProps {
  sede?: SedePublica | null;
  latitud: number | null;
  longitud: number | null;
  onSeleccionarUbicacion: (lat: number, lon: number) => void;
}

function redondear6(valor: number): number {
  return Math.round(valor * 1_000_000) / 1_000_000;
}

function iconoSedeReferencia(): L.DivIcon {
  return L.divIcon({
    className: "fg-sede-ref",
    html: `<div style="
      width:28px;
      height:28px;
      border-radius:9999px;
      background:#0f766e;
      border:2.5px solid #ffffff;
      box-shadow:0 2px 6px rgba(15,23,42,0.3);
      display:flex;
      align-items:center;
      justify-content:center;
      color:#ffffff;
      font-weight:700;
      font-size:12px;
      font-family:system-ui,sans-serif;
    ">S</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function iconoDestinoPaciente(): L.DivIcon {
  return L.divIcon({
    className: "fg-destino-paciente",
    html: `<div style="
      width:34px;
      height:34px;
      border-radius:9999px;
      background:#4f46e5;
      border:3px solid #ffffff;
      box-shadow:0 0 0 4px rgba(79,70,229,0.28);
      display:flex;
      align-items:center;
      justify-content:center;
      color:#ffffff;
      font-weight:800;
      font-size:14px;
      font-family:system-ui,sans-serif;
    ">★</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
  });
}

export default function MapaSeleccionUbicacionLeaflet({
  sede,
  latitud,
  longitud,
  onSeleccionarUbicacion,
}: MapaSeleccionUbicacionLeafletProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const sedeMarkerRef = useRef<L.Marker | null>(null);
  const destinoMarkerRef = useRef<L.Marker | null>(null);
  const callbackRef = useRef(onSeleccionarUbicacion);

  useEffect(() => {
    callbackRef.current = onSeleccionarUbicacion;
  }, [onSeleccionarUbicacion]);

  // Inicializar mapa OpenStreetMap (02 §9: selección manual sin geocodificación)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const centroInicial: [number, number] =
      typeof sede?.latitud === "number" && typeof sede?.longitud === "number"
        ? [sede.latitud, sede.longitud]
        : [6.2476, -75.5658];

    const map = L.map(containerRef.current, {
      center: centroInicial,
      zoom: 13,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    map.on("click", (ev: L.LeafletMouseEvent) => {
      callbackRef.current(redondear6(ev.latlng.lat), redondear6(ev.latlng.lng));
    });

    mapRef.current = map;

    return () => {
      sedeMarkerRef.current = null;
      destinoMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Actualizar marcador de referencia de la sede seleccionada
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (sedeMarkerRef.current) {
      sedeMarkerRef.current.remove();
      sedeMarkerRef.current = null;
    }

    if (
      typeof sede?.latitud === "number" &&
      typeof sede?.longitud === "number"
    ) {
      const pos: [number, number] = [sede.latitud, sede.longitud];
      sedeMarkerRef.current = L.marker(pos, {
        icon: iconoSedeReferencia(),
        title: sede.nombre ?? "Sede",
      })
        .bindPopup(
          `<div style="font-family:system-ui,sans-serif;font-size:12px;">
            <strong>Sede:</strong> ${sede.nombre ?? sede.codigo ?? ""}
          </div>`
        )
        .addTo(map);

      if (latitud === null || longitud === null) {
        map.setView(pos, 13);
      }
    }
  }, [sede, latitud, longitud]);

  // Actualizar marcador draggable de ubicación de entrega del paciente
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (latitud === null || longitud === null) {
      if (destinoMarkerRef.current) {
        destinoMarkerRef.current.remove();
        destinoMarkerRef.current = null;
      }
      return;
    }

    const pos: [number, number] = [latitud, longitud];
    if (destinoMarkerRef.current) {
      destinoMarkerRef.current.setLatLng(pos);
    } else {
      const marker = L.marker(pos, {
        icon: iconoDestinoPaciente(),
        draggable: true,
        title: "Ubicación de entrega (arrastra para ajustar)",
        zIndexOffset: 600,
      }).addTo(map);

      marker.on("dragend", () => {
        const ll = marker.getLatLng();
        callbackRef.current(redondear6(ll.lat), redondear6(ll.lng));
      });

      destinoMarkerRef.current = marker;
    }
  }, [latitud, longitud]);

  return (
    <div
      ref={containerRef}
      aria-label="Mapa para marcar ubicación de entrega a domicilio"
      className="z-0 h-72 w-full cursor-crosshair overflow-hidden rounded-xl border border-slate-300 bg-slate-100 sm:h-80"
    />
  );
}
