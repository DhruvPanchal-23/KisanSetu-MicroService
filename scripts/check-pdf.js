import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderReport } from '../farm-service/report.js';
import { getFarmSeedReference } from '../farm-service/seed-reference.js';

const output = new URL('../test-results/pdf/', import.meta.url);
await mkdir(output, { recursive: true });
const base = { id: 7, name: 'Riverside Farm', location: 'Pune, Maharashtra', latitude: 18.5204,
  longitude: 73.8567, area_acres: 5.5, crop: 'Sugarcane', soil_type: 'Black', created_at: '2026-10-19 08:30:00' };
const examples = [
  ['normal', base],
  ['long', { ...base, name: 'Riverside Greenfield Farm '.repeat(4).slice(0, 80),
    location: 'North Field near Pune, Maharashtra '.repeat(4).slice(0, 120) }],
  ['unicode', { ...base, name: 'राम शेत Greenfield Farm', location: 'पुणे महाराष्ट्र - Pune, Maharashtra' }],
  ['unmatched', { ...base, location: 'Unknown district' }],
];
for (const [name, farm] of examples) {
  const bytes = await renderReport(farm);
  await writeFile(new URL(`${name}.pdf`, output), bytes);
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: false });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      await page.render({ canvasContext: canvas.getContext('2d'), viewport, canvas }).promise;
      await writeFile(new URL(`${name}-${number}.png`, output), canvas.toBuffer('image/png'));
      const content = await page.getTextContent();
      pages.push(content.items.map(item => item.str || '').join(' '));
    }
    const text = pages.join(' ').normalize('NFC').replace(/\s/g, '');
    const reference = getFarmSeedReference(farm);
    const values = [farm.name, farm.location, farm.crop, farm.soil_type, farm.created_at,
      reference.farmDate, 'Synthetic demo data'];
    if (reference.record) values.push(reference.record.date, reference.record.state,
      reference.waterLitres.toLocaleString('en-IN', { maximumFractionDigits: 2 }));
    else values.push(reference.message);
    for (const value of values) {
      assert.ok(text.includes(value.normalize('NFC').replace(/\s/g, '')), `${name}: PDF lost ${value}`);
    }
    if (name !== 'long') assert.equal(pdf.numPages, 2, `${name}: standard farm and seed sections should fit two A4 pages`);
    console.log(`${name}: ${pdf.numPages} pages rendered to ${fileURLToPath(output)}`);
  } finally {
    await task.destroy();
  }
}
