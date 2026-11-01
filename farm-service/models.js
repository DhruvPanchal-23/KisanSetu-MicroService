import { httpError } from '../shared/http.js';

export const CROPS = ['Rice', 'Wheat', 'Maize', 'Cotton', 'Sugarcane', 'Soybean'];
export const SOILS = ['Alluvial', 'Black', 'Red', 'Loamy', 'Sandy', 'Clay'];

export function validateFarm(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw httpError(422, 'Farm details must be a JSON object');
  }
  const farm = {};
  for (const [field, maximum] of [['name', 80], ['location', 120]]) {
    const value = typeof body[field] === 'string' ? body[field].trim() : '';
    if (value.length < 2 || value.length > maximum) {
      throw httpError(422, `${field} must contain between 2 and ${maximum} characters`);
    }
    farm[field] = value;
  }
  for (const [field, minimum, maximum] of [['latitude', -90, 90], ['longitude', -180, 180], ['area_acres', 0, 100000]]) {
    const value = body[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum
        || (field === 'area_acres' && value === 0)) {
      const range = field === 'area_acres' ? `greater than 0 and at most ${maximum}` : `between ${minimum} and ${maximum}`;
      throw httpError(422, `${field} must be a finite number ${range}`);
    }
    farm[field] = value;
  }
  for (const [field, choices] of [['crop', CROPS], ['soil_type', SOILS]]) {
    if (!choices.includes(body[field])) throw httpError(422, `Choose a valid ${field}`);
    farm[field] = body[field];
  }
  return farm;
}
