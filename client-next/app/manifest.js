export default function manifest() {
  return {
    id: '/dashboard', name: 'CiPD 360 Student', short_name: 'CiPD 360',
    description: 'Your classes, attendance and feedback in one place.',
    start_url: '/dashboard', scope: '/', display: 'standalone',
    background_color: '#f4f6fb', theme_color: '#1d2d65',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
