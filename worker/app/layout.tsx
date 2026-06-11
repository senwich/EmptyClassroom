import type { Metadata, Viewport } from 'next';
import { cookies } from 'next/headers';
import Script from 'next/script';
import './globals.css';

const GOOGLE_ANALYTICS_ID = 'G-JW44VDK41M';

export const metadata: Metadata = {
  title: 'BUPT 空教室查询',
  description: 'BUPT empty classroom query on Cloudflare Workers',
  manifest: '/manifest.webmanifest',
  applicationName: 'BUPT 空教室查询',
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.svg',
  },
  appleWebApp: {
    capable: true,
    title: '空教室查询',
    statusBarStyle: 'black',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#141414' },
  ],
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
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ANALYTICS_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GOOGLE_ANALYTICS_ID}');
          `}
        </Script>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {children}
      </body>
    </html>
  );
}
