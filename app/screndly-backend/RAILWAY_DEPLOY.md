**Railway Deploy**
Run these commands from [app/screndly-backend](/C:/Users/Favour/Desktop/Projects/screndly/app/screndly-backend).

First-time setup:
- `npm install`
- `npm run railway:login`
- `npm run railway:link`

Regular deploy:
- `npm run railway:deploy`
- default behavior uploads only `app/screndly-backend` and detaches after the upload succeeds

Useful helpers:
- `npm run railway:status`
- `npm run railway:logs`
- `npm run railway:open`
- `npm run railway:deploy:attach`

Notes:
- `railway:deploy` runs `npm run build` before `railway up`.
- `railway:deploy` now calls `railway up . --path-as-root --detach` so monorepo files outside the backend folder are not archived.
- If you want the CLI to stay attached to build logs, use `npm run railway:deploy:attach`.
- To skip the local build check, use `npm run railway:deploy -- --skip-build`.
