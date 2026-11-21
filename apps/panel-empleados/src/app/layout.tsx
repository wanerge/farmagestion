import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panel de empleados · FarmaGestión",
  description: "Gestión de inventario por sede, pedidos, turnos y rutas de domicilios.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
