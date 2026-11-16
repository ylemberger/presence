import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

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
    <html lang="he" dir="rtl" className="h-full">
      <Script id="sidebar-collapsed" strategy="beforeInteractive">
        {`try{if(localStorage.getItem("presence-sidebar-collapsed")==="1"){document.documentElement.dataset.sidebar="collapsed"}}catch(e){}`}
      </Script>
      <Script id="scroll-keeper" strategy="beforeInteractive">
        {`try{if("scrollRestoration"in history)history.scrollRestoration="manual";var y=Number(sessionStorage.getItem("presence-scroll:"+location.pathname+location.search)||"0");if(y>0)window.scrollTo(0,y)}catch(e){}`}
      </Script>
      <body className="font-body-md min-h-full antialiased text-on-background">
        {children}
      </body>
    </html>
  );
}
