import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import postcss from 'postcss'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

function legacyAndroidCss() {
  return {
    name: 'legacy-android-css',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const renamed = new Map()
      for (const [fileName, output] of Object.entries(bundle)) {
        if (output.type !== 'asset' || !output.fileName.endsWith('.css')) continue
        const root = postcss.parse(String(output.source))
        root.walkAtRules('layer', (rule) => {
          if (rule.nodes) rule.replaceWith(...rule.nodes)
          else rule.remove()
        })
        root.walkAtRules('supports', (rule) => {
          // Tailwind 4 wraps its entire generated sheet in a modern-browser
          // feature test. Older Chrome treats that test as false, which
          // otherwise drops every utility class.
          if (rule.params.includes('margin-trim:inline') && rule.nodes) rule.replaceWith(...rule.nodes)
        })
        output.source =
          root.toString() +
          '.jacket-builder-shell{top:0;right:0;bottom:0;left:0;height:auto}' +
          '.jacket-builder-sidebar-open{height:45%}' +
          '.jacket-builder-preview-open{height:55%}' +
          '.jacket-builder-city-picker{transform:translateX(-50%)}' +
          '.jacket-viewer-mount,.jacket-viewer-overlay{top:0;right:0;bottom:0;left:0}' +
          '@media(max-width:767px){.jacket-builder-actions>*+*{margin-left:.5rem}}' +
          '@supports(height:100dvh){.jacket-builder-shell{height:100dvh}}'
        const legacyFileName = fileName.replace(/\.css$/, '.android-v3.css')
        output.fileName = legacyFileName
        delete bundle[fileName]
        bundle[legacyFileName] = output
        renamed.set(fileName, legacyFileName)
      }
      for (const output of Object.values(bundle)) {
        if (output.type === 'asset' && typeof output.source === 'string') {
          for (const [from, to] of renamed) output.source = output.source.split(from).join(to)
        } else if (output.type === 'chunk') {
          for (const [from, to] of renamed) output.code = output.code.split(from).join(to)
        }
      }
    },
  }
}

export default defineConfig({
  build: {
    // Keep the builder usable on older Android Chrome versions found on
    // physical customer devices (optional chaining is not parsed there).
    target: 'es2017',
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
  plugins: [
    figmaAssetResolver(),
    legacyAndroidCss(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src/app'),
    },
  },
})
