import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BordoMavi AI Editör',
    short_name: 'BordoMavi',
    description: 'Trabzonspor AI İçerik ve Yayın Yönetim Platformu',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0F172A',
    theme_color: '#781324',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/assets/brand/bordomavi-logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/assets/brand/bordomavi-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
