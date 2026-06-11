import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
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

const THEME_INIT_SCRIPT = `
(() => {
  try {
    const stored = localStorage.getItem('darkMode');
    const matches = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === null ? matches : stored === 'true';
    document.documentElement.classList.toggle('dark', isDark);
    document.body.classList.toggle('dark', isDark);
  } catch {}
})();`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const isDark = (await cookies()).get('darkMode')?.value === 'true';
  return (
    <html lang="zh-Hans" className={isDark ? 'dark' : undefined} suppressHydrationWarning>
      <body className={isDark ? 'dark' : undefined} suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
