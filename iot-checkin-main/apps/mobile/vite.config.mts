import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { readFileSync } from 'fs';
import { VitePWA } from 'vite-plugin-pwa';

const extensions = [
  '.mjs',
  '.web.tsx',
  '.tsx',
  '.web.ts',
  '.ts',
  '.web.jsx',
  '.jsx',
  '.web.js',
  '.js',
  '.css',
  '.json',
];

const rollupPlugin = (matchers: RegExp[]) => ({
  name: 'js-in-jsx',
  async load(id: string) {
    if (matchers.some((matcher) => matcher.test(id)) && id.endsWith('.js')) {
      const file = readFileSync(id, { encoding: 'utf-8' });
      return transformWithEsbuild(file, id, {
        loader: 'jsx',
        jsx: 'automatic',
      });
    }
  },
});

export default defineConfig({
  root: import.meta.dirname,
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  cacheDir: '../../node_modules/.vite/apps/mobile',
  define: {
    global: 'window',
  },
  resolve: {
    extensions,
    alias: [
      { find: 'react-native-config', replacement: import.meta.dirname + '/src/lib/react-native-config.mock.ts' },
      { find: 'lucide-react-native', replacement: 'lucide-react' },
      { find: 'react-native/Libraries/Utilities/codegenNativeComponent', replacement: import.meta.dirname + '/src/lib/empty.mock.ts' },
      { find: 'react-native/Libraries/ReactNative/AppContainer', replacement: import.meta.dirname + '/src/lib/empty.mock.ts' },
      { find: 'react-native', replacement: 'react-native-web' },
      { find: 'react-native-svg', replacement: 'react-native-svg-web' },
      { find: '@react-native-google-signin/google-signin', replacement: import.meta.dirname + '/src/lib/empty.mock.ts' },
    ],
  },
  build: {
    reportCompressedSize: true,
    commonjsOptions: { transformMixedEsModules: true },
    outDir: '../../dist/apps/mobile/web',
    rollupOptions: {
      plugins: [rollupPlugin([/react-native-vector-icons/])],
    },
  },
  server: {
    port: 4200,
    host: true,
    fs: {
      // Allow serving files from one level up to the project root
      allow: ['..'],
    },
  },
  preview: {
    port: 4300,
    host: 'localhost',
  },
  optimizeDeps: {
    esbuildOptions: {
      resolveExtensions: extensions,
      jsx: 'automatic',
      loader: { '.js': 'jsx' },
    },
  },
  plugins: [
    react(),
    nxViteTsPaths(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Mobile',
        short_name: 'Mobile',
        description: 'IoT check-in mobile web app',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        theme_color: '#09090b',
        background_color: '#09090b',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
      },
    }),
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //   plugins: () => [ nxViteTsPaths() ],
  // },
});
