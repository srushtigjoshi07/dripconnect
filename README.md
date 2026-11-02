# DripConnect — platform build (beta)

This branch holds the DripConnect monitoring platform that runs as Srushti's
Muse web app (the multi-ward Overview / Hospital Simulation / Alert Centre
build — nurse Asha Verma, 12-bed demonstration hospital). It is a separate
codebase from the `main` branch app.

- `client/` — React 19 + TypeScript front end (simulation engine, 3D ward)
- `server/` — typed actions layer (state persistence)
- `drizzle/` — database schema/migrations

It runs on the Muse spaces runtime (`@hatch/space-sdk` is a local runtime
package, so `bun install` outside Muse will not resolve it). The built
front end is deployed for preview at
https://srushtigjoshi07.github.io/dripconnect/beta/ — note the preview is
static hosting: pages and the in-browser simulation load, but the server
actions/database of the Muse runtime do not run there.
