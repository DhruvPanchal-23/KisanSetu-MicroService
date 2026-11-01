import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';
import { getFarmSeedReference, SEED_SOURCE } from './seed-reference.js';

const GREEN = '#214D32';
const INK = '#233B2A';
const MUTED = '#667760';
const BORDER = '#DFE8D9';
const display = value => String(value ?? '').replace(/[\s\p{Cc}]+/gu, ' ').trim();

export async function renderReport(farm) {
  const reference = getFarmSeedReference(farm);
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4', margin: 44, bufferPages: true,
      info: { Title: `${display(farm.name)} - Farm report`, Author: 'KisanSetu', Subject: 'Saved farm information' },
    });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    for (const [name, filename] of Object.entries({
      LatinRegular: 'NotoSans-Regular.ttf', LatinBold: 'NotoSans-Bold.ttf',
      DevanagariRegular: 'Mukta-Regular.ttf', DevanagariBold: 'Mukta-Bold.ttf',
    })) {
      doc.registerFont(name, fileURLToPath(new URL(`./fonts/${filename}`, import.meta.url)));
    }

    const margin = 44;
    const width = doc.page.width - margin * 2;
    const bottom = doc.page.height - 96;
    const hectares = (Number(farm.area_acres) * 0.40468564224).toFixed(4);
    const generated = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';
    let y = 0;

    function font(value, size, bold = false, color = INK) {
      const text = display(value);
      const script = /\p{Script=Devanagari}/u.test(text) ? 'Devanagari' : 'Latin';
      doc.font(`${script}${bold ? 'Bold' : 'Regular'}`).fontSize(size).fillColor(color);
      return text;
    }
    function measure(value, textWidth, size = 10, bold = false) {
      return doc.heightOfString(font(value, size, bold), { width: textWidth, lineGap: 2 });
    }
    function write(value, x, top, textWidth, { size = 10, bold = false, color = INK, ...options } = {}) {
      doc.text(font(value, size, bold, color), x, top, { width: textWidth, lineGap: 2, ...options });
    }
    function nextPage() {
      doc.addPage();
      write('KISANSETU | FARM REPORT', margin, 44, width, { size: 10, bold: true, color: GREEN });
      write(`Farm #${farm.id} | Continued`, margin, 64, width, { size: 8, color: MUTED });
      y = 94;
    }
    function ensure(height) {
      if (y + height > bottom) nextPage();
    }
    function section(title, followingHeight) {
      ensure(25 + followingHeight);
      write(title, margin, y, width, { size: 12, bold: true, color: GREEN });
      y += 25;
    }

    const headerX = 32;
    const headerWidth = doc.page.width - headerX * 2;
    const textX = headerX + 24;
    const textWidth = headerWidth - 48;
    const nameY = 101;
    const nameHeight = measure(farm.name, textWidth, 23, true);
    const locationY = nameY + nameHeight + 8;
    const locationHeight = measure(farm.location, textWidth, 10.5);
    const headerBottom = locationY + locationHeight + 22;
    doc.roundedRect(headerX, 32, headerWidth, headerBottom - 32, 12).fill(GREEN);
    write('KISANSETU', textX, 52, textWidth - 175, { size: 11, bold: true, color: '#FFFFFF' });
    write(`FARM #${farm.id}`, textX + textWidth - 175, 54, 175,
      { size: 8, bold: true, color: '#D4E6C6', align: 'right' });
    write('FARM REPORT', textX, 81, textWidth, { size: 8, color: '#D4E6C6' });
    write(farm.name, textX, nameY, textWidth, { size: 23, bold: true, color: '#FFFFFF' });
    write(farm.location, textX, locationY, textWidth, { size: 10.5, color: '#DFEBD7' });

    y = headerBottom + 17;
    write(`Farm added ${reference.farmDate || 'Not available'} (IST calendar date)`, margin, y, width, { size: 9, bold: true });
    y += 17;
    write(`Generated ${generated}`, margin, y, width, { size: 8, color: MUTED });
    y += 29;

    const metrics = [
      ['Farm area', `${farm.area_acres} acres`, `${hectares} hectares`],
      ['Current crop', farm.crop, 'Saved crop selection'],
      ['Soil type', farm.soil_type, 'Saved soil classification'],
    ];
    const metricWidth = (width - 20) / 3;
    const metricValueHeight = Math.max(...metrics.map(([, value]) => measure(value, metricWidth - 26, 16, true)));
    const metricNoteY = 28 + metricValueHeight + 8;
    const metricHeight = Math.max(82, metricNoteY + 23);
    ensure(metricHeight);
    metrics.forEach(([label, value, note], index) => {
      const x = margin + index * (metricWidth + 10);
      doc.roundedRect(x, y, metricWidth, metricHeight, 7).fillAndStroke('#F3F7EF', BORDER);
      write(label, x + 13, y + 12, metricWidth - 26, { size: 8, color: MUTED });
      write(value, x + 13, y + 28, metricWidth - 26, { size: 16, bold: true, color: GREEN });
      write(note, x + 13, y + metricNoteY, metricWidth - 26, { size: 7.5, color: MUTED });
    });
    y += metricHeight + 23;

    const summary = `${display(farm.name)} is recorded in ${display(farm.location)} with an area of `
      + `${farm.area_acres} acres (${hectares} hectares). The saved crop is ${farm.crop} `
      + `and the soil type is ${farm.soil_type}.`;
    const summaryHeight = measure(summary, width, 10);
    section('Farm summary', summaryHeight);
    write(summary, margin, y, width);
    y += summaryHeight + 22;

    const rows = [
      ['Farm ID', farm.id], ['Farm name', farm.name], ['Location', farm.location],
      ['Latitude', farm.latitude], ['Longitude', farm.longitude], ['Area in acres', farm.area_acres],
      ['Area in hectares', hectares], ['Crop', farm.crop], ['Soil type', farm.soil_type],
      ['Farm added timestamp', farm.created_at],
    ];
    const labelWidth = 150;
    const valueX = margin + 176;
    const valueWidth = width - 188;
    const rowHeight = ([label, value]) => Math.max(measure(label, labelWidth, 9), measure(value, valueWidth, 10)) + 11;
    function table(title, items) {
      section(title, rowHeight(items[0]));
      items.forEach(([label, value], index) => {
        const height = rowHeight([label, value]);
        if (y + height > bottom) {
          nextPage();
          section(`${title} (continued)`, height);
        }
        if (index % 2 === 0) doc.rect(margin, y, width, height).fill('#F7F9F4');
        write(label, margin + 12, y + 5, labelWidth, { size: 9, color: MUTED });
        write(value, valueX, y + 5, valueWidth);
        doc.moveTo(margin, y + height).lineTo(margin + width, y + height).lineWidth(0.5).stroke(BORDER);
        y += height;
      });
    }
    function paragraph(text, options = {}) {
      const height = measure(text, width, options.size || 9);
      ensure(height + 12);
      write(text, margin, y, width, { size: 9, ...options });
      y += height + 12;
    }
    table('Saved farm details', rows);

    nextPage();
    section('Weather and irrigation seed reference', 70);
    paragraph('Synthetic demo data from 2024-2025. These values are reference examples, not current weather or a field irrigation prescription.', { bold: true, color: GREEN });
    paragraph(`Source: ${SEED_SOURCE.fileName}. Coverage: ${SEED_SOURCE.startDate} to ${SEED_SOURCE.endDate}; ${SEED_SOURCE.recordCount.toLocaleString('en-IN')} state-level records.`, { size: 8, color: MUTED });
    if (!reference.record) {
      paragraph(reference.message);
    } else {
      const record = reference.record;
      paragraph(reference.matchType === 'exact-date'
        ? `Matched the farm's added date (${reference.farmDate}) and state (${record.state}).`
        : `The seed has no record for the farm's added date (${reference.farmDate}). The reference uses the same calendar day from ${record.date}, matched to ${record.state}.`);
      if (!reference.soilMatches) paragraph(`Soil differs: this farm has ${farm.soil_type} soil; the seed record describes ${record.soil_type} soil. Irrigation values are shown only as seed references; a farm water volume is not calculated.`, { color: MUTED });
      const label = value => String(value).replace(/_/g, ' ');
      const numeric = (value, unit) => `${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${unit}`;
      table('Matched weather data', [
        ['Seed record date', record.date], ['State / season', `${record.state} / ${label(record.season)}`],
        ['Seed soil / farm soil', `${record.soil_type} / ${farm.soil_type}`],
        ['Weather condition', label(record.weather_condition)],
        ['Temperature min / max', `${record.temperature_min_c} / ${record.temperature_max_c} degrees C (average ${record.temperature_avg_c})`],
        ['Humidity', numeric(record.humidity_pct, '%')], ['Rainfall', numeric(record.rainfall_mm, 'mm')],
        ['Wind speed', numeric(record.wind_speed_kmh, 'km/h')], ['Soil moisture', numeric(record.soil_moisture_pct, '%')],
        ['Seed next 2 days rain', numeric(record.next_2_days_rainfall_mm, 'mm')],
      ]);
      y += 18;
      table('Seed irrigation example', [
        ['Reference method', label(record.suggested_irrigation_type)], ['Reference status', label(record.irrigation_status)],
        ['Reference water depth', numeric(record.suggested_irrigation_mm, 'mm')],
        ['Illustrative farm volume', reference.waterLitres === null
          ? (reference.soilMatches ? 'Not available: invalid area or seed depth.' : 'Not calculated: soil does not match.')
          : numeric(reference.waterLitres, 'litres')],
      ]);
      y += 14;
      paragraph(`Seed note: ${record.recommendation_reason}`, { size: 8, color: MUTED });
      paragraph(`Crop: ${farm.crop} (saved farm). The seed file has no crop-specific values. An illustrative volume, when shown, equals seed water depth x saved farm area x 4,046.8564224 litres per mm-acre, before irrigation losses.`, { size: 8, color: MUTED });
    }

    const pages = doc.bufferedPageRange();
    for (let page = pages.start; page < pages.start + pages.count; page += 1) {
      doc.switchToPage(page);
      const footerY = doc.page.height - 65;
      doc.moveTo(margin, footerY - 10).lineTo(margin + width, footerY - 10).lineWidth(0.5).stroke(BORDER);
      write('Saved farm data and synthetic seed reference. 1 acre = 0.40468564224 hectares.', margin, footerY, width - 80,
        { size: 7, color: MUTED, lineBreak: false });
      write(`Page ${page - pages.start + 1} of ${pages.count}`, margin + width - 75, footerY, 75,
        { size: 7, color: MUTED, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}
