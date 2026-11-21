import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/AppProvider";
import { PortalShell } from "@/components/PortalShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portal del paciente · FarmaGestión",
  description:
    "Consulta disponibilidad de medicamentos por sede, vincula tus fórmulas médicas y agenda tu turno sin filas.",
  applicationName: "FarmaGestión",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FarmaGestión",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-slate-50 text-slate-900">
        <AppProvider>
          <PortalShell>{children}</PortalShell>
        </AppProvider>
      </body>
    </html>
  );
}
