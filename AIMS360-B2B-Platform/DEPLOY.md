# Putting the Portal Online

The portal is one small Node.js web server. It serves the screens and the
`/api` routes from the same address, so any host that can run Node 20+ or a
Docker container will work.

## What it needs

| Setting | What it is |
| --- | --- |
| `PORT` | The port to listen on. Most hosts set this for you. |
| `SESSION_SECRET` | A long random value that signs login cookies. Required for anything public. |
| `DATA_DIR` | A folder that survives restarts. Buyer logins, settings, linesheets and (in demo mode) orders are saved here in `portal.json`. |

Build with `npm ci --include=dev && npm run build`, then start with `npm start`.

## Option 1: Render

1. Create an account at render.com and connect this GitHub repo.
2. Choose New > Blueprint and pick this repo. `render.yaml` sets up the web
   service, the session secret and a 1 GB disk for the data.
3. Render gives you a web address when the first build finishes.

## Option 2: Docker (Azure, AWS, your own server)

```
docker build -t aims360-b2b-portal .
docker run -p 3000:3000 -e SESSION_SECRET=change-me -v portal-data:/data aims360-b2b-portal
```

## Before real customers use it

This build runs in demo mode. Do not point real buyers at it until these are done:

- Connect the live AIMS360 API (`server/aims360/` has the demo provider to replace).
- Remove the demo logins from the sign-in screen and change the seeded passwords.
- Brand admin sign-in through Runway.
- Email invites instead of on-screen temporary passwords.
- Move `portal.json` to a real database once more than one brand is on it.
- HTTPS only (hosts above do this), and set `secure` cookies.
