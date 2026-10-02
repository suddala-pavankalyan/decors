// Product photos come from the API's /uploads folder (and, for sample data, picsum.photos).
const api = new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000');

export default {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      {
        protocol: api.protocol.replace(':', ''),
        hostname: api.hostname,
        ...(api.port ? { port: api.port } : {}),
        pathname: '/uploads/**',
      },
    ],
  },
};
