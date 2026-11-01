import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { createServer } from 'vite';

test('farm cards provide distinct native links and separately named actions', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
  });
  try {
    const { default: FarmCard } = await server.ssrLoadModule('/src/components/FarmCard.jsx');
    const farms = [
      { id: 7, name: 'Riverside Farm' },
      { id: 42, name: 'Hilltop Farm' },
    ].map(farm => ({ ...farm, crop: 'Rice', soil_type: 'Clay', location: 'Pune',
      area_acres: 5, latitude: 18.5, longitude: 73.8 }));
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: ['/farms'] },
      farms.map(farm => createElement(FarmCard, { key: farm.id, farm,
        onEdit() {}, onDelete() {}, onDownload() {}, reportBusy: false, isGenerating: false }))));
    const cards = [...html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/g)];
    assert.equal(cards.length, farms.length);
    for (const [index, [, attributes, content]] of cards.entries()) {
      const farm = farms[index];
      assert.doesNotMatch(attributes, /\b(?:role="button"|tabindex=)/i);
      const headingId = /\baria-labelledby="([^"]+)"/.exec(attributes)?.[1];
      assert.ok(headingId, 'Each card must have an accessible heading');
      assert.ok(content.includes(`id="${headingId}"`));
      const links = [...content.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)];
      assert.equal(links.length, 1);
      assert.ok(links[0][1].includes(`href="/farms/${farm.id}"`));
      assert.ok(links[0][1].includes(`aria-label="View details for ${farm.name}"`));
      assert.ok(links[0][2].includes(farm.name));
      assert.doesNotMatch(links[0][2], /<(?:button|input|select)\b/i);
      const buttons = [...content.matchAll(/<button\b([^>]*)>/g)];
      assert.equal(buttons.length, 3);
      for (const label of [`Edit ${farm.name}`, `Delete ${farm.name}`, `Download PDF for ${farm.name}`]) {
        assert.ok(buttons.some(([, attributes]) => attributes.includes(`aria-label="${label}"`)));
      }
    }
  } finally {
    await server.close();
  }
});
