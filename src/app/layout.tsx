import type { Metadata } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "מערכת נוכחות - סמינר",
  description: "מערכת ניהול נוכחות היסטורית לסמינר",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full`}>
      <body
        className={`${heebo.className} font-body-md min-h-full antialiased text-on-background`}
      >
        {children}
      </body>
    </html>
  );
}
