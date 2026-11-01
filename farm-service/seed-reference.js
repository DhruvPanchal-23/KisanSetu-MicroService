import { readFileSync } from 'node:fs';

const fileName = 'india_weather_irrigation_2024_2025.json';
const loadedRows = JSON.parse(readFileSync(new URL(`./seeds/${fileName}`, import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const dates = loadedRows.map(row => row.date).sort();
const states = [...new Set(loadedRows.map(row => row.state))];
const normalize = value => typeof value === 'string' ? value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() : '';

export const SEED_SOURCE = {
  fileName, startDate: dates[0], endDate: dates.at(-1), recordCount: loadedRows.length,
  isSynthetic: loadedRows.length > 0 && loadedRows.every(row => row.is_synthetic === true),
};

function farmCalendarDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const timestamp = value.trim().replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(timestamp)) return null;
  const calendar = timestamp.slice(0, 10);
  const day = new Date(`${calendar}T00:00:00Z`);
  if (Number.isNaN(day.getTime()) || day.toISOString().slice(0, 10) !== calendar) return null;
  const date = new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getFarmSeedReference(farm, records = loadedRows) {
  const farmDate = farmCalendarDate(farm?.created_at);
  const unmatched = message => ({ farmDate, record: null, matchType: null, soilMatches: false, waterLitres: null, message });
  if (!farmDate) return unmatched('The farm-added date is missing or invalid, so a dated seed reference cannot be selected.');
  const location = ` ${normalize(farm.location)} `;
  const matchingStates = states.filter(state => location.includes(` ${normalize(state)} `));
  if (!matchingStates.length) {
    return unmatched('Add the full state name to the farm location to find a seed reference. City names and coordinates are not matched.');
  }
  if (matchingStates.length > 1) {
    return unmatched('The farm location names more than one state. Keep one full state name to select a seed reference.');
  }
  const state = matchingStates[0];
  const stateRows = records.filter(row => normalize(row.state) === normalize(state));
  let candidates = stateRows.filter(row => row.date === farmDate);
  let matchType = 'exact-date';
  if (!candidates.length) {
    const calendarRows = stateRows.filter(row => row.date.slice(5) === farmDate.slice(5));
    const latestDate = calendarRows.reduce((latest, row) => row.date > latest ? row.date : latest, '');
    candidates = calendarRows.filter(row => row.date === latestDate);
    matchType = 'calendar-day';
  }
  if (!candidates.length) return unmatched(`No seed reference is available for ${state} on ${farmDate} or the same calendar day in the latest seed year.`);
  const soil = normalize(farm.soil_type);
  const soilRecord = soil && candidates.find(row => normalize(row.soil_type) === soil);
  const record = soilRecord || candidates[0];
  const soilMatches = Boolean(soilRecord);
  let waterLitres = null;
  if (soilMatches && Number.isFinite(farm.area_acres) && farm.area_acres > 0
      && Number.isFinite(record.suggested_irrigation_mm) && record.suggested_irrigation_mm >= 0) {
    const litres = record.suggested_irrigation_mm * farm.area_acres * 4046.8564224;
    if (Number.isFinite(litres)) waterLitres = litres;
  }
  let message = matchType === 'exact-date'
    ? `Synthetic seed reference for ${state} on ${record.date}, matched to the farm-added date.`
    : `Historical synthetic seed reference for ${state} on ${record.date}, matched by calendar day to ${farmDate}. This is not current weather.`;
  if (!soilMatches) message += ` The reference soil (${record.soil_type}) differs from the farm soil (${farm.soil_type}), so no water volume is shown.`;
  else if (waterLitres === null) message += ' A water volume is unavailable because the saved area or reference irrigation depth is invalid.';
  else message += ' The water volume is an illustrative conversion of the synthetic reference depth and saved farm area.';
  return { farmDate, record, matchType, soilMatches, waterLitres, message };
}
