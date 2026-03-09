import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: '--font-mono' });

export const metadata: Metadata = {
  title: "Vantage Point | Global Market Intelligence",
  description: "Bloomberg Japan & Reuters Japan の最新マーケットニュースを集約。為替・株式・債券・コモディティ・暗号資産をリアルタイムで追跡。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${inter.className} ${mono.variable} antialiased`} >
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
          {children}
        </div>
      </body>
    </html>
  );
}
