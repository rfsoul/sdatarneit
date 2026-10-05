# Deploy to BTower Linux using the existing Cloudflare Tunnel

No alternative hosting service is needed. The supplied Docker image builds the static site and runs a small Node server. The server only serves `dist/`, supports MP4 byte ranges and gzip for text, and applies security headers.

## 1. Prepare BTower

Copy/clone this repository including `ref/production`. Do not transfer `ref/orig`, `ref/processed` or `tmp`. Docker and Docker Compose must be available on BTower; this task has not connected to BTower or verified its installed services.

From the repository directory on BTower:

```sh
docker compose build
docker compose up -d
curl -I http://127.0.0.1:8085/
curl http://127.0.0.1:8085/healthz
curl -H 'Range: bytes=0-31' -I http://127.0.0.1:8085/assets/tarneit-720p.mp4
```

Expected: homepage 200, health JSON `{"ok":true}`, video range 206. Port 8085 is bound to the loopback interface, not publicly exposed. Choose another free port deliberately if BTower already uses 8085; update Compose and the tunnel service together. Do not replace an existing service.

Docker was not available in the Windows build environment, so the container recipe still needs its first build on BTower. The identical Node server and generated site were tested on Windows.

## 2. Add this hostname to the existing tunnel

For a **host-installed cloudflared service**, add a public hostname to the existing tunnel:

- Hostname: `sdatarneit.au`
- Service type: HTTP
- Service: `http://127.0.0.1:8085`

If the tunnel is managed by a local YAML file, merge this entry **above** its existing catch-all; preserve every existing hostname and all credentials:

```yaml
ingress:
  # Keep other existing entries here.
  - hostname: sdatarneit.au
    service: http://127.0.0.1:8085
  # Keep the existing catch-all last.
  - service: http_status:404
```

For **cloudflared running in Docker**, `127.0.0.1` refers to its own container. Join the site container to the tunnel’s existing Docker network and target `http://sdatarneit:8085`; use the actual network name from BTower rather than creating a second tunnel. Keep the port private and do not expose it to the internet. The existing tunnel arrangement is not included in this repository, so this choice must be checked on BTower.

Point the hostname's Cloudflare DNS record at the **existing** tunnel using its current management workflow. Do not create a new tunnel, replace DNS for other hosts, or alter other public services. If `www.sdatarneit.au` is used, redirect it to `https://sdatarneit.au` in Cloudflare. Set HTTP-to-HTTPS redirection at Cloudflare. The site canonical URLs already use the bare HTTPS domain.

Do not cache `/api/*` in Cloudflare. The application already sends `Cache-Control: no-store` for API responses. Respect origin cache headers for HTML and assets. Never proxy the repository directory or a file server rooted above `dist/`.

## 3. Enquiry delivery

**Default (ready now):** direct phone/email links and an email-draft form. No credentials or mail service are needed. The visitor must send from their email app; the site never says a draft has been submitted.

**Optional direct sending:** configure an owner-approved HTTPS endpoint that accepts JSON and delivers it to the owner. No particular provider has been chosen. Create `.env` from `.env.example` and set:

```dotenv
ENQUIRY_WEBHOOK_URL=https://YOUR-APPROVED-SERVICE/endpoint
ENQUIRY_WEBHOOK_TOKEN=YOUR-SERVICE-TOKEN
TRUST_PROXY=false
```

Do not use the example URL literally. The endpoint must return 2xx only after accepting the enquiry for delivery. Payload fields are `name`, `email`, `phone`, `role`, `topic`, `message`, `consent`, `property`, `submittedAt`. The optional token is passed as a Bearer token. Delivery credentials are server-only and must never be committed or put in frontend code.

Restart after environment changes: `docker compose up -d --force-recreate`. The browser checks `/api/enquiry-status` and switches from “Open email enquiry” to “Send enquiry” only when a valid HTTPS delivery URL is configured. This status does not prove delivery: test with the owner’s permission and verify the actual received message before relying on it. Failed or timed-out delivery produces a visible error, never a success message.

Validation, a honeypot, same-origin checking, a 16 KB request limit and a five-attempts-per-15-minutes rate limit are included. Rate limits are in memory and reset on restart. By default they use the socket IP. If—and only if—the origin is restricted to traffic through the existing Cloudflare Tunnel, set `TRUST_PROXY=true` to use Cloudflare's client IP header. With `false`, requests through a common tunnel peer share a rate limit. Add a Cloudflare rate-limiting rule for the POST endpoint if needed.

Confirm delivery-service privacy/retention settings with the owner and update `/privacy/` for the chosen service before enabling direct sending. Do not log enquiry bodies or sensitive personal data.

## 4. Launch checks

- Confirm the owner still wants the displayed email and phone published.
- Review `docs/CONTENT-REVIEW.md`. Do not turn historical image captions into a current vacancy claim.
- Visit HTTPS desktop and mobile pages through the real hostname.
- Test gallery arrows, thumbnails, Escape, keyboard navigation and swipe; check both plan labels.
- Check video starts only after user action and seeking works through Cloudflare.
- Test a phone link and email draft with no real message sent unless authorised.
- Check canonical URLs, `/robots.txt` and `/sitemap.xml`.
- Confirm `/ref/orig/`, `/.env` and `/server.mjs` return 404 through the public hostname.
- Submit the sitemap to the owner's search-console account when ready. This is not done automatically.

## Updates and rollback

After edits: rebuild locally, run tests, then rebuild/restart the BTower service. Keep the previous working container image or release checkout so the service can be reverted without modifying the existing tunnel. Source assets remain unchanged. Generated assets use stable names and one-hour caching; purge the affected URLs in Cloudflare if an immediate image correction is necessary.
