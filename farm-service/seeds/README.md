# Farm report seed data

`india_weather_irrigation_2024_2025.json` is the file supplied by the user, copied unchanged from Downloads. SHA-256: `9457c5f684af8b7243079dad6c6f003e434279de4a0a725a3e87cc2d943fa20c`.

It contains 20,468 **synthetic demo records**, covering 28 Indian states from 2024-01-01 through 2025-12-31. Each state has one soil profile; these are not measured local weather, forecasts, or crop-specific irrigation requirements.

PDF reports read the seed on the server and match it against the saved farm:

- The location must contain one full state name, such as `Pune, Maharashtra`. Unknown or ambiguous states produce an explanation instead of guessed data.
- The farm's saved `created_at` timestamp supplies the added date, interpreted as an Indian calendar date (Asia/Kolkata). Downloads do not change this date.
- An exact seed date is preferred. Outside the covered years, the latest available record for the same month and day is used and its real date is printed. A leap-day reference can therefore come from 2024.
- Farm and seed soil types are compared. If they differ, the report identifies the mismatch and omits the illustrative farm water volume.
- For matching soils, the example volume is `suggested_irrigation_mm × area_acres × 4046.8564224` litres. This is a unit conversion from the synthetic seed depth, before losses. It is not a field irrigation prescription.

No seed records are imported into the farm database. Existing farm ownership, values, and added timestamps are preserved. The independent `farm-service/seed.js` command still generates random demo **farm records**; it does not generate this weather reference file.
