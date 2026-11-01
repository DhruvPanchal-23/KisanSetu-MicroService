const CURRENT_FIELDS = ['temperature_2m', 'relative_humidity_2m', 'precipitation', 'weather_code', 'wind_speed_10m'];
const DAILY_FIELDS = ['temperature_2m_max', 'temperature_2m_min', 'precipitation_sum'];

export async function fetchWeather(latitude, longitude, { fetchImpl = fetch } = {}) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude, longitude, current: CURRENT_FIELDS.join(','), daily: DAILY_FIELDS.join(','),
    forecast_days: 3, timezone: 'auto',
  }).toString();
  const response = await fetchImpl(url.toString(), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('Weather provider is unavailable');
  const data = await response.json();
  const current = data?.current;
  const daily = data?.daily;
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  if (!current || !daily || !CURRENT_FIELDS.every(field => finite(current[field]))
    || typeof current.time !== 'string' || typeof data.timezone !== 'string'
    || !Array.isArray(daily.time) || daily.time.length === 0
    || !DAILY_FIELDS.every(field => Array.isArray(daily[field]) && daily[field].length === daily.time.length)) {
    throw new Error('Incomplete weather response');
  }
  const forecast = daily.time.map((date, index) => ({
    date, high: daily.temperature_2m_max[index], low: daily.temperature_2m_min[index],
    rain: daily.precipitation_sum[index],
  }));
  if (!forecast.every(day => typeof day.date === 'string' && [day.high, day.low, day.rain].every(finite))) {
    throw new Error('Incomplete weather forecast');
  }
  return {
    temperature: current.temperature_2m, humidity: current.relative_humidity_2m,
    precipitation: current.precipitation, wind_speed: current.wind_speed_10m,
    weather_code: current.weather_code, observed_at: current.time,
    timezone: data.timezone, source: 'Open-Meteo', forecast,
  };
}
