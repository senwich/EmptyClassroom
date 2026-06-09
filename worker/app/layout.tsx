import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BUPT 空教室查询',
  description: 'BUPT empty classroom query on Cloudflare Workers',
  appleWebApp: {
    capable: true,
    title: '空教室查询',
    statusBarStyle: 'black',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hans">
      <body>{children}</body>
    </html>
  );
}
