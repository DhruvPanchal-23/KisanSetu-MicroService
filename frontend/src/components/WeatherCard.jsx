function description(code) {
  if (code === 0) return 'Clear skies';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rainy';
  if (code <= 77) return 'Snowy';
  if (code <= 86) return 'Showers';
  return 'Thunderstorms';
}

export default function WeatherCard({ weather, farm }) {
  if (!weather) return <section className="card weather-card"><h2>Local weather</h2><p>Weather data is temporarily unavailable. Use Refresh to try again.</p></section>;
  return <section className="card weather-card"><div className="section-heading"><h2>Local weather</h2><span className="weather-location">{farm.location}</span></div>
    <div className="weather-main"><div><span className="temperature">{Math.round(weather.temperature)}<sup>°C</sup></span><p>{description(weather.weather_code)}</p></div><span className="weather-symbol" aria-hidden="true">{weather.weather_code <= 3 ? '☀' : '☁'}</span></div>
    <div className="weather-details"><div><span>Humidity</span><strong>{weather.humidity}%</strong></div><div><span>Wind</span><strong>{weather.wind_speed} km/h</strong></div><div><span>Rain now</span><strong>{weather.precipitation} mm</strong></div></div>
    <div className="forecast">{weather.forecast.map((day, index) => <div key={day.date}><span>{index === 0 ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}</span><strong>{Math.round(day.high)}° <small>{Math.round(day.low)}°</small></strong><small>{day.rain} mm rain</small></div>)}</div>
    <a className="weather-source" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Weather by Open-Meteo</a><small className="weather-updated">Updated {weather.observed_at.replace('T', ' · ')} ({weather.timezone})</small>
  </section>;
}
