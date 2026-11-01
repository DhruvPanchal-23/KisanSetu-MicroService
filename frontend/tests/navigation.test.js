import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('workspace navigation exposes four links and marks the current section', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
  });
  try {
    const { default: Navbar } = await server.ssrLoadModule('/src/components/Navbar.jsx');
    const expected = new Map([['/', 'Overview'], ['/farms', 'My farms'],
      ['/analytics', 'Analytics'], ['/reports', 'Farm Report']]);
    for (const [route, section] of [['/', '/'], ['/farms/42', '/farms'],
      ['/analytics', '/analytics'], ['/reports', '/reports']]) {
      const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [route] },
        createElement(Navbar, { user: { name: 'Test Farmer' }, onLogout() {} })));
      const navigation = /<nav\b[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1] || '';
      const links = [...navigation.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attributes, content]) => ({
        href: /\bhref="([^"]+)"/.exec(attributes)?.[1],
        name: (/\baria-label="([^"]+)"/.exec(attributes)?.[1]
          ?? content.replace(/<span\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, ''))
          .replace(/\s+/g, ' ').trim(),
        active: /\baria-current="page"/.test(attributes),
      }));
      assert.equal(links.length, expected.size);
      for (const [href, name] of expected) assert.equal(links.find(link => link.href === href)?.name, name);
      assert.deepEqual(links.filter(link => link.active).map(link => link.href), [section], route);
    }
  } finally {
    await server.close();
  }
});
