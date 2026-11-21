import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal del paciente · FarmaGestión",
  description: "Consulta de medicamentos, fórmulas médicas, turnos y domicilios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
