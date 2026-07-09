import { build, context } from 'esbuild'
import { readFile } from 'node:fs/promises'

const [htmlTemplate, banner] = await Promise.all([
  readFile(new URL('../ui.html', import.meta.url), 'utf8'),
  readFile(new URL('../plugin-banner.png', import.meta.url)),
])
const bannerSrc = `data:image/png;base64,${banner.toString('base64')}`
const html = htmlTemplate.replace('{{PLUGIN_BANNER_SRC}}', bannerSrc)

const options = {
  entryPoints: ['code.ts'],
  bundle: true,
  outfile: 'code.js',
  target: 'es2017',
  define: { __html__: JSON.stringify(html) },
  logLevel: 'info',
}

if (process.argv.includes('--watch')) {
  const buildContext = await context(options)
  await buildContext.watch()
  console.log('Watching for changes…')
} else {
  await build(options)
}
