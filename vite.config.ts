import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serves the Vercel functions in api/ during `npm run dev`, so /feed.ics works locally without the
 * Vercel CLI. In production Vercel runs those files directly; this only mirrors the rewrite rules
 * from vercel.json so the two environments agree.
 */
function localApi(): Plugin {
  return {
    name: 'local-api',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url?.split('?')[0] === '/feed.ics') {
          req.url = `/api/feed${req.url.includes('?') ? `?${req.url.split('?')[1]}` : ''}`
        }
        next()
      })
      server.middlewares.use('/api', async (req, res) => {
        try {
          const route = (req.url ?? '/').split('?')[0].replace(/^\/+/, '')
          if (!/^[a-z0-9-]+$/i.test(route) || !existsSync(join(server.config.root, 'api', `${route}.ts`))) {
            res.statusCode = 404
            res.end('not found')
            return
          }
          const mod = await server.ssrLoadModule(`/api/${route}.ts`)
          const handler = mod[req.method ?? 'GET'] as ((request: Request) => Promise<Response>) | undefined
          if (!handler) {
            res.statusCode = 405
            res.end('method not allowed')
            return
          }
          const response = await handler(
            new Request(`http://${req.headers.host}${req.originalUrl ?? req.url}`, { method: req.method })
          )
          res.statusCode = response.status
          response.headers.forEach((value, key) => res.setHeader(key, value))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (error) {
          server.config.logger.error(`api error: ${String(error)}`)
          res.statusCode = 500
          res.end('internal error')
        }
      })
    }
  }
}

export default defineConfig({ plugins: [react(), localApi()] })
