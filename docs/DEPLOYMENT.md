# SDA Tarneit deployment and enquiries

The live site is **https://sdatarneit.au**, running on BTower through the existing `szatla7` Cloudflare Tunnel. VentraIP remains the registrar; nameservers are `elle.ns.cloudflare.com` and `memphis.ns.cloudflare.com`.

## Current services

- Site: enabled user service `sdatarneit.service`, listening only on `127.0.0.1:8085`.
- Tunnel: system service `cloudflared`, with configuration in `/etc/cloudflared/config.yml`.
- Route: `sdatarneit.au` → `http://127.0.0.1:8085`, tunnel UUID `98147799-1c14-4995-8198-21015a4864ba`.
- The existing calendar route is preserved. Do not replace other routes when updating the tunnel. `deploy/cloudflared-btower.yml` records the launch configuration; compare it with the active file before applying it again.
- User lingering is enabled, so the site service starts without an interactive login. BTower must remain powered on and connected.

The application serves only `dist/`. Source, configuration, reference originals and private enquiries must never be served by another web server rooted above that directory.

## Where enquiries are saved

Each accepted submission is a separate JSON file in:

```text
/home/al/Git/sdatarneit/enquiries/
```

This is persistent storage inside the repository working directory, outside the public `dist/` directory. It is ignored by Git and excluded from the Docker build context. It survives site rebuilds and service restarts. The systemd unit sets `ENQUIRIES_DIR` explicitly. Without an override, Node uses the `enquiries/` folder beside `server.mjs`. Existing enquiries were moved here from the earlier `~/.local/share/sdatarneit/enquiries` location.

Files contain a UTC timestamp, UUID reference, name, email, optional phone, role, enquiry purpose (`topic`), message, consent and property name. Filenames contain the timestamp and UUID, never visitor-supplied text. The directory is created with mode `0700` and files with `0600`. The service runs as `al` with `UMask=0077`.

The receiver validates and length-limits input, checks the request origin, uses a honeypot, and limits attempts to five per visitor address per 15 minutes. It writes a temporary file, flushes the file to disk, renames it to its final JSON filename and flushes the directory before returning success. Submitted text remains plain JSON data. Never execute it, interpolate it into shell commands, or render it as unescaped HTML.

Enquiries are saved locally as the durable record. A separate background job sends a copy to the owner by email after the local save; email failures never undo a saved enquiry. The form shows the thank-you message only after the server confirms a saved enquiry. Failed submissions keep their form entries for retrying. After an interrupted connection, an enquiry may have been saved without the browser receiving its receipt; a retry can create a duplicate.

## How to check enquiries

On BTower, logged in as `al`:

```sh
ls -lt ~/Git/sdatarneit/enquiries/
```

To read one enquiry, replace `FILENAME.json` with a filename from the list:

```sh
/usr/bin/python3 -m json.tool ~/Git/sdatarneit/enquiries/FILENAME.json
```

You can also open the private folder in the local file manager. There is no public enquiry listing, download route or administration page. Use the visitor's saved contact details to respond privately and coordinate the next step with Disability Forever Homes.

No automatic retention or backup schedule is configured. Include the folder in a private server backup if required, with access restricted to authorised people. Review and delete enquiries when they are no longer needed, including any backup copies according to your retention decisions. Keep the folder out of `dist`, shared/public directories and publicly served backups. `/enquiries/`, `/data/` and temporary JSON files are ignored by Git to avoid accidentally committing visitor details. Placing the folder in the checkout does not upload it to the Git remote. Back it up separately before deleting or replacing the checkout, or running commands such as `git clean -fdx` that remove ignored files. Any future upload of enquiry data should be a deliberate, separate action to an appropriately restricted destination.

## Build, check and update

Requires Node 22+ and Python 3 with Pillow. BTower currently uses `/usr/bin/python3` and Node 24 at the path recorded in the unit.

Build into a staging directory so the running site is not changed before checks pass:

```sh
SITE_OUTPUT_DIR="$PWD/tmp/release" /usr/bin/python3 scripts/build.py
SITE_OUTPUT_DIR="$PWD/tmp/release" npm test
SITE_OUTPUT_DIR="$PWD/tmp/release" /usr/bin/python3 scripts/check_site.py
```

After verification, replace `dist` with the staged output and restart `sdatarneit.service`. Preserve the previous public build and corresponding server version for rollback; never replace, empty or roll back the enquiries folder as part of a code deployment.

When the service unit changes:

```sh
install -m 644 deploy/sdatarneit.service ~/.config/systemd/user/sdatarneit.service
systemctl --user daemon-reload
systemctl --user enable --now sdatarneit.service
systemctl --user restart sdatarneit.service
curl -f http://127.0.0.1:8085/healthz
```

The unit's repository and Node paths are specific to BTower. Adjust them if moving the checkout or changing the installed Node version. The Node server does not automatically load `.env`; use the systemd environment settings or Node's `--env-file` option for a deliberate local override.

`TRUST_PROXY=true` is enabled on BTower because the origin is bound to loopback and public traffic arrives through cloudflared. It lets the limiter use Cloudflare's visitor address. Do not enable this with a directly exposed origin or a proxy that accepts forged visitor headers. Rate limits are held in memory and reset on restart. Do not cache `/api/*`; the application sends `Cache-Control: no-store`.

## Docker alternative

Docker is not used on this BTower installation. `compose.yaml` includes a persistent named `enquiries` volume mounted at `/data/enquiries`; the image creates the mount point with the Node user's ownership and mode `0700`. The root filesystem remains read-only. The named volume must stay writable and must be retained across updates; **do not use `docker compose down -v`**, which deletes it.

```sh
docker compose build
docker compose up -d
```

The Docker path is `ENQUIRIES_DIR=/data/enquiries`. Do not replace it with a directory inside the image's public files or temporary storage. Keep the existing tunnel setup: a host-installed cloudflared can use `127.0.0.1:8085`; a containerised tunnel needs a shared private network and the service hostname. Set `TRUST_PROXY` only after confirming that traffic arrives exclusively through the trusted tunnel. This alternative recipe was not executed on BTower because Docker is not installed.

## Verification for this update

Automated checks cover successful durable storage, unique references, field validation, honeypot and rate limits, save failure and retry, public-path and symlink isolation, client-side detail preservation, navigation, metadata, the public enquiries link with private owner contacts excluded, media counts and video ranges. All automated enquiry tests use isolated temporary folders and remove their files afterward.

The deployment check uses a clearly marked synthetic enquiry, verifies private persistence across a service restart, checks that the exact filename cannot be fetched publicly, then removes only that test file. For the notification setup, a separate marked end-to-end test was sent to the owner and then removed.

Check the live form, homepage availability, privacy information, gallery, plans, video and mobile navigation after future updates. The Node server redirects trusted Cloudflare requests with an original HTTP scheme to the canonical HTTPS domain. Cloudflare's **Always Use HTTPS** can also be enabled at the edge. `www` support is separate from the canonical bare domain and requires its own DNS/redirect configuration if desired.

## Email notifications — active

`sdatarneit-notify.timer` is enabled on BTower and checks once a minute. Resend has the verified sending domain `sdatarneit.au`; its API key is sending-only and restricted to that domain. The public contact `enquiries@sdatarneit.au` is linked in the site footer and enquiry page. Cloudflare Email Routing forwards it to the owner's verified Gmail destination. A live test confirmed both paths.

The destination address is in `~/.config/sdatarneit/email.env`, a mode-0600 private file outside Git. The API key and activation cutoff are set only in this private file; earlier enquiries are skipped. Use `deploy/email.env.example` as a template on another machine. Do not copy real credentials into the repository or public files.

Cloudflare MX records remain in place for inbound forwarding. Resend sending records are DNS-only CNAME/TXT entries and do not replace those MX records. Resend inbound receiving is off. No mail server or paid Cloudflare Workers plan is used.

The job checks once a minute and sends at most one pending enquiry per run, using readable plain text plus the JSON attachment. The web form's success still depends on the local disk save, independently of email delivery. No new packages or mail server are needed.

The current Resend Free plan is $0/month and includes 3,000 emails per month with a 100-per-day limit. If the free quota is exceeded without a paid plan, Resend says sending stops until you upgrade; paid pay-as-you-go overages must be enabled on a paid subscription. No paid plan or overage billing is configured for this setup. Check [Resend's current pricing](https://resend.com/pricing) before relying on these limits, as plans can change.

Receipts are stored privately under `enquiries/.notifications/`. `accepted` means Resend accepted the request, not proof of inbox delivery. Failed transient requests retry after an hour using the same idempotency key. Ambiguous attempts older than 23 hours, changed destination/content, or permanent rejections are held as `review` rather than blindly resent: check the Resend dashboard and local receipt before deciding what to retry. This respects Resend's 24-hour idempotency window. Existing JSON enquiries are never removed or rewritten by the mail job.

Inspect operation with `systemctl --user status sdatarneit-notify.timer` and `journalctl --user -u sdatarneit-notify.service`. Logs contain summary counts only, not credentials, addresses or enquiry text. Mock-provider tests verify success, attachment contents, Reply-To, retry behaviour, duplicate avoidance, activation cutoffs and provider rejection. The live test confirmed delivery in Gmail, the JSON attachment and the visitor Reply-To; the synthetic enquiry and local receipt were removed afterward.
