import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import Index from './pages/Index';
import { ThemeProvider } from './hooks/useTheme';
import { WhitelabelProvider } from './hooks/useWhitelabel';

const loadIndexContent = async () => {
  const candidatePaths = [
    path.resolve(process.cwd(), 'public/data/index-content.json'),
    path.resolve(process.cwd(), 'dist/data/index-content.json'),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      const raw = await fs.readFile(candidatePath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      // Try next location.
    }
  }

  return null;
};

export async function render(url: string) {
  const initialContent = await loadIndexContent();

  const app = (
    <StaticRouter location={url}>
      <ThemeProvider>
        <WhitelabelProvider>
          <Index initialContent={initialContent} />
        </WhitelabelProvider>
      </ThemeProvider>
    </StaticRouter>
  );

  return {
    appHtml: renderToString(app),
    initialContent,
  };
}
