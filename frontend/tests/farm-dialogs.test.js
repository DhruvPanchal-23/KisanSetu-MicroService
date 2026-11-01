import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

test('farm dialogs preserve saved values and identify the farm before deletion', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('../', import.meta.url)),
    server: { middlewareMode: true, hmr: false }, appType: 'custom',
  });
  try {
    const { default: FarmFormDialog } = await server.ssrLoadModule('/src/components/FarmFormDialog.jsx');
    const { default: FarmDeleteDialog } = await server.ssrLoadModule('/src/components/FarmDeleteDialog.jsx');
    const farm = { id: 42, name: 'Hilltop Farm', location: 'Nashik', latitude: 20.0059,
      longitude: 73.791, area_acres: 7.25, crop: 'Cotton', soil_type: 'Black' };
    const props = { open: true, farm, busy: false, error: '', onClose() {}, onSave() {}, onConfirm() {} };
    const form = renderToStaticMarkup(createElement(FarmFormDialog, props));
    const headingId = /<dialog\b[^>]*aria-labelledby="([^"]+)"/.exec(form)?.[1];
    assert.ok(headingId);
    assert.ok(form.includes(`<h2 id="${headingId}">Edit farm</h2>`));
    const inputs = [...form.matchAll(/<input\b([^>]*)>/g)];
    for (const field of ['name', 'location', 'latitude', 'longitude', 'area_acres']) {
      const attributes = inputs.find(([, value]) => value.includes(`name="${field}"`))?.[1] || '';
      assert.ok(attributes.includes(`value="${farm[field]}"`), `Edit must preserve ${field}`);
    }
    for (const field of ['crop', 'soil_type']) {
      const select = new RegExp(`<select\\b[^>]*name="${field}"[^>]*>([\\s\\S]*?)<\\/select>`).exec(form)?.[1];
      assert.match(select || '', new RegExp(`<option\\b[^>]*\\bselected[^>]*>${farm[field]}<\\/option>`));
    }
    assert.match(form, /<button\b[^>]*type="submit"[^>]*>Save farm/);
    const confirmation = renderToStaticMarkup(createElement(FarmDeleteDialog, props));
    assert.ok(confirmation.includes(`Delete ${farm.name}?`));
    assert.match(confirmation, /<button\b[^>]*autofocus[^>]*>Keep farm<\/button>/);
    const busy = renderToStaticMarkup(createElement(FarmDeleteDialog, { ...props, busy: true }));
    const buttons = [...busy.matchAll(/<button\b([^>]*)>/g)];
    assert.equal(buttons.length, 2);
    assert.ok(buttons.every(([, attributes]) => /\bdisabled\b/.test(attributes)));
  } finally {
    await server.close();
  }
});
