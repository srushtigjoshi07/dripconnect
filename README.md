# DripConnect — platform build (beta)

This branch holds the DripConnect monitoring platform that runs as Srushti's
Muse web app (the multi-ward Overview / Hospital Simulation / Alert Centre
build — nurse Asha Verma, 12-bed demonstration hospital). It is a separate
codebase from the `main` branch app.

- `client/` — React 19 + TypeScript front end (simulation engine, 3D ward)
- State is kept in the browser (localStorage, key
  `dripconnect-browser-state-v1`), seeded in code — the client makes no
  server calls, so the built front end runs on any static hosting.
- `server/` and `drizzle/` — the original server-actions persistence layer,
  kept for reference; the client no longer calls it.

Live preview of the built front end:
https://srushtigjoshi07.github.io/dripconnect/beta/
State there is per-browser: each visitor starts from the seed ward and
their simulation is saved only in their own browser.
