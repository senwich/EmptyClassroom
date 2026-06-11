import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BUPT 空教室查询',
    short_name: '空教室',
    description: '北邮空教室查询，支持安装到桌面。',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1677ff',
    lang: 'zh-CN',
    icons: [
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/apple-icon.svg',
        sizes: '180x180',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
