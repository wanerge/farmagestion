import type { Metadata } from "next";
import { AppProvider } from "@/components/AppProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panel de empleados · FarmaGestión",
  description:
    "Gestión de inventario por sede, bandeja de pedidos, turnos y notificaciones de FarmaGestión.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
