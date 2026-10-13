import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { build, defineConfig, type Plugin } from 'vite';
import { createManifest } from './src/manifest.ts';

const root = resolve(import.meta.dirname, 'src');
const outDirFor = (mode: string) => resolve(import.meta.dirname, mode === 'e2e' ? 'dist-e2e' : 'dist');

function manifestPlugin(mode: string): Plugin {
  return {
    name: 'breakpointer:manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(createManifest(mode), null, 2)}\n`,
      });
    },
  };
}

/**
 * The frame agent is registered as a content script, which must be a classic
 * script without imports, so it is bundled separately as an IIFE after the
 * main build (also on every rebuild in watch mode).
 */
function agentPlugin(mode: string, outDir: string): Plugin {
  return {
    name: 'breakpointer:agent',
    apply: 'build',
    async closeBundle() {
      await build({
        configFile: false,
        logLevel: 'warn',
        mode,
        publicDir: false,
        build: {
          outDir,
          emptyOutDir: false,
          copyPublicDir: false,
          target: 'chrome116',
          minify: mode === 'production',
          sourcemap: false,
          lib: {
            entry: resolve(root, 'agent/frame-agent.ts'),
            formats: ['iife'],
            name: 'BreakpointerAgent',
            fileName: () => 'frame-agent.js',
          },
        },
      });
    },
  };
}

// Multi-entry extension build: popup page, viewer page and the MV3 service worker.
export default defineConfig(({ mode }) => ({
  root,
  base: '',
  publicDir: resolve(import.meta.dirname, 'public'),
  plugins: [react(), manifestPlugin(mode), agentPlugin(mode, outDirFor(mode))],
  build: {
    outDir: outDirFor(mode),
    emptyOutDir: true,
    target: 'chrome116',
    sourcemap: mode !== 'production',
    minify: mode === 'production',
    // Chrome supports modulepreload natively; skip Vite's polyfill.
    modulePreload: { polyfill: false },
    rolldownOptions: {
      input: {
        popup: resolve(root, 'popup/popup.html'),
        viewer: resolve(root, 'viewer/viewer.html'),
        'service-worker': resolve(root, 'background/service-worker.ts'),
      },
      output: {
        // The manifest references the worker by a fixed name.
        entryFileNames: (chunk) => (chunk.name === 'service-worker' ? 'service-worker.js' : 'assets/[name]-[hash].js'),
        // Keep third-party code (React) in one clearly named chunk.
        advancedChunks: { groups: [{ name: 'vendor', test: /node_modules/ }] },
      },
    },
  },
}));
