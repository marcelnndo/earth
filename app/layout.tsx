import "./globals.css";

export const metadata = {
  title: 'Rotating Earth',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-white min-h-screen m-0 p-0 overflow-hidden">
        {children}
      </body>
    </html>
  );
}
