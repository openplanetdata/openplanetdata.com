import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "OpenPlanetData"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 antialiased">
        {children}
      </body>
    </html>
  );
}