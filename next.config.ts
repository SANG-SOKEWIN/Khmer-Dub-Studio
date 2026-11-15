import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader:false,
  async headers() {
    const production = process.env.NODE_ENV === 'production';
    return [{source:'/(.*)',headers:[
      {key:'X-Content-Type-Options',value:'nosniff'},
      {key:'Referrer-Policy',value:'no-referrer'},
      {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'},
      {key:'Content-Security-Policy',value:`default-src 'self'; script-src 'self' 'unsafe-inline' ${production?'':"'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' https://generativelanguage.googleapis.com ${production?'':'ws://127.0.0.1:* ws://localhost:*'}; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`}
    ]}];
  }
};
export default process.env.NEXT_PUBLIC_GITHUB_PAGES === '1'
  ? {
      output: 'export',
      trailingSlash: true,
      basePath: process.env.NEXT_PUBLIC_PAGES_BASE_PATH ?? '',
      poweredByHeader: false,
    } satisfies NextConfig
  : config;
