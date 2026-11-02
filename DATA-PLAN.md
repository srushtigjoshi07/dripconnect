# Data Plan

No external data sources.

State model (changed 2026-11-02 at the user's request — "Convert it to browser state and redeploy beta"):
- All state now lives in the browser, in `localStorage` under the key
  `dripconnect-browser-state-v1`, implemented in `client/src/api.ts`.
  There are no server-action / network calls for state anymore, so the
  built client bundle runs as a fully static site (e.g. GitHub Pages
  `/beta/`), which the previous server-database build could not.
- On first launch in a browser, the same sample hospital the server
  used to seed is created locally (main hospital: 5 wards, 6 nurses,
  16 patients, 30 resolved historical alerts, seeded reading history;
  demo hospital via reseed: 4 nurses, 12 patients — Asha Verma et al.).
- Every mutation (simulation ticks, scenario triggers, alert
  acknowledge/resolve/assign, bottle changes, patient/nurse add/edit,
  patient reassignment, settings, reseed) writes through to the same
  localStorage record. Readings are capped at the last 200 per patient,
  events at 600 and alerts at 500 so storage cannot grow without bound.
- Trade-off, stated to the user before this change: state is
  per-browser/per-device and persists across reloads on that browser
  only; it is not shared or backed up on a server.
- The server actions in `server/src/actions.ts` remain in the repo for
  reference/rollback but are no longer called by the client.
