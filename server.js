import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);

const serializeForInlineScript = (value) =>
  JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

async function createApp() {
  const app = express();
  let vite;

  if (!isProduction) {
    const { createServer } = await import('vite');
    vite = await createServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    const compression = (await import('compression')).default;
    const sirv = (await import('sirv')).default;
    app.use(compression());
    app.use(sirv(path.resolve(__dirname, 'dist'), { extensions: [] }));
  }

  app.use('*', async (req, res) => {
    try {
      const url = req.originalUrl;
      const isHomeRoute = url === '/' || url.startsWith('/?');

      let template;
      let render;

      if (!isProduction) {
        template = await fs.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        ({ render } = await vite.ssrLoadModule('/src/entry-server.tsx'));
      } else {
        template = await fs.readFile(path.resolve(__dirname, 'dist/index.html'), 'utf-8');
        ({ render } = await import('./dist/server/entry-server.js'));
      }

      let appHtml = '';
      let ssrStateScript = '';

      if (isHomeRoute) {
        const result = await render(url);
        if (typeof result === 'string') {
          appHtml = result;
        } else {
          appHtml = result?.appHtml || '';
          if (result?.initialContent) {
            const serializedContent = serializeForInlineScript(result.initialContent);
            ssrStateScript = `<script>window.__INDEX_CONTENT__=${serializedContent};</script>`;
          }
        }
      }

      const html = template
        .replace('<!--ssr-outlet-->', appHtml)
        .replace('<!--ssr-state-->', ssrStateScript);

      res
        .status(200)
        .set({
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        })
        .end(html);
    } catch (error) {
      if (!isProduction && vite) {
        vite.ssrFixStacktrace(error);
      }
      console.error(error);
      res.status(500).end('Internal Server Error');
    }
  });

  app.listen(port, () => {
    console.log(`SSR server running at http://localhost:${port}`);
  });
}

createApp();
