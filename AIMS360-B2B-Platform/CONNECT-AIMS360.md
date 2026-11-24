# Connecting the Hosted Portal to AIMS360

The hosted portal reads one AIMS360 company directly through the AIMS360 API.
It needs two settings. Type them into your host's settings screen (on Render:
your service, then Environment). Do not put them in GitHub, email or chat.

| Setting | What to enter |
| --- | --- |
| `AIMS360_BASE_URL` | The API address for your AIMS360 zone. It is the `BaseURL` value in the AIMS360-API-Endpoints Postman collection. |
| `AIMS360_TOKEN` | An AIMS360 access token for the company you want to show. It is what Postman sends after the word "Bearer". The token decides which company's database appears. |

Optional:

| Setting | What it does |
| --- | --- |
| `AIMS360_SEND_ORDERS` | Set to `true` to create a real AIMS360 order whenever someone places an order. Leave blank until order creation has been checked on a test company. |
| `AIMS360_ACCOUNT`, `AIMS360_COMPANY_NAME` | Shown in the banner if AIMS360 does not report the company for the token. |

## What happens once they are set

- At start, and every 10 minutes after, the portal reads active styles (with
  sizes, stock, WIP and OTS) and active customers (terms, credit limit, A/R).
- The banner turns green and names the company and the time it was last read.
- With `AIMS360_SEND_ORDERS=true`, each order placed is also created in
  AIMS360. The order screen shows the AIMS360 order number, or the reason
  AIMS360 gave if it did not accept the order. The portal keeps its own copy
  either way.

## Not built yet

- Customer price sheets (prices shown are wholesale).
- Style pictures from AIMS360.
- Open orders already in AIMS360 are not counted in credit checks.
- Access tokens that renew themselves. When a token expires, the portal says so
  in its log and keeps showing the last data it read; enter a new token to fix it.
- Runway sign-in for admins. The demo logins on the sign-in screen must be
  replaced before real customers use the portal.

## To show a different company

Change `AIMS360_TOKEN` to a token for that company and restart the service.
Orders and linesheets made under one company are not shown under another.
