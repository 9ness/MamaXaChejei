import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { isAdmin as isAdminSession } from "@/lib/admin-auth";
import "./globals.css";
import { GlobalChat } from "@/components/GlobalChat";
import { BottomNav } from "@/components/BottomNav";
import { getPenaColor } from "@/app/actions";
import { penaColorStyle } from "@/lib/pena-colors";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mamá xa Chejei",
  description: "A app da peña MamaXaChejei — Festas da Guadalupe, Rianxo.",
  applicationName: "Mamá xa Chejei",
  // Para que iOS la abra a pantalla completa desde el icono del escritorio.
  appleWebApp: {
    capable: true,
    title: "Mamá xa Chejei",
    statusBarStyle: "default",
  },
};

// Sen isto, en iOS `env(safe-area-inset-*)` vale SEMPRE 0 e todo o que vai
// pegado a un bordo (a barra de abaixo, o botón do chat, o xogo a pantalla
// completa) queda debaixo do notch ou da barra de inicio do iPhone. En Android
// non cambia nada: alí eses insets son cero e os calc() quedan igual.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isAdmin = await isAdminSession();
  const penaColor = await getPenaColor();

  return (
    <html lang="es">
      <head>
        <style dangerouslySetInnerHTML={{ __html: penaColorStyle(penaColor) }} />
      </head>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <BottomNav isAdmin={isAdmin} />
        <div className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
          {children}
        </div>
        <GlobalChat />
      </body>
    </html>
  );
}
