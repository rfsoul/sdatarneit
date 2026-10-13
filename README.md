# SDA Tarneit

**https://sdatarneit.au** presents two vacant participant bedrooms in the High Physical Support SDA home on Social Street, Tarneit VIC 3029. Each has an ensuite with a roll-in shower; a separate overnight assistance room is for support staff. The property manager lists Medium Term Accommodation or an ongoing lease.

The existing static HTML site and Node server run on BTower through Cloudflare Tunnel. The enquiry form saves submissions as private persistent JSON files for the owner to review. Visitors can call or text Al on **0480 027 263**, use the form, or email `enquiries@sdatarneit.au`. Personal contact details remain private.

## Build and preview

Requires Python 3.10+ with Pillow and Node 22+:

```sh
python3 -m pip install -r requirements.txt
python3 scripts/build.py
npm start
```

On BTower, use `/usr/bin/python3` for the installed Pillow environment. The live service already uses port 8085; use `PORT=8086 npm start` for a separate local preview and set the matching `ALLOWED_ORIGINS` if testing its form.

```sh
npm test
python3 scripts/check_site.py
```

`SITE_OUTPUT_DIR` selects a staging build/check directory. See [deployment and enquiry operations](docs/DEPLOYMENT.md) for the tested update workflow.

## Editing

- `scripts/build.py`: page copy, HTML, metadata and navigation.
- `src/styles.css`: existing responsive design.
- `src/app.js`: photo gallery, media viewers, mobile navigation and enquiry submission.
- `server.mjs`: static file serving and private enquiry receiver.
- `config/site.json`: property configuration and the public business contact number; do not add private contact details.
- `scripts/assets.py`: image inventory, captions and web derivatives.
- `ref/production/`: selected photos, walkthrough and floorplans. The 2D plan's copy is kept consistent across SVG, PDF and PNG.
- `deploy/sdatarneit.service`: BTower's user service, loopback binding and persistent storage configuration.
- `dist/`: generated public site. Never serve the repository root.

The original walkthrough is tracked with Git LFS at `ref/orig/Al-Social St-Tarneit-DFH Full.mp4` and is excluded from the public build. Only the compressed walkthrough is served. The site has no autoplay, external video embeds, tracking scripts or web fonts.

## Enquiries

BTower stores enquiries at **`/home/al/Git/sdatarneit/enquiries/`**, inside the working checkout, but outside `dist` and ignored by Git. A separate job emails a copy to the owner’s Gmail through Resend; the local JSON file remains the durable record. Each saved JSON file contains its timestamp and reference plus the visitor's details and message. Read [how to inspect, retain and back up enquiries](docs/DEPLOYMENT.md).

The form requires a name, email, enquiry role, purpose, message and consent, with an optional phone number. It does not require SDA funding or a SIL provider. Server validation, field limits, same-origin checking, a honeypot, rate limiting and private file permissions are included. Success is returned only after saving to disk. Enquiry notification email is a separate background job, so a mail outage never prevents a successful local save.

## Pages and property facts

The existing routes remain: `/`, `/the-home/`, `/living-in-tarneit/`, `/sda-and-support/`, `/enquiries/`, `/walkthrough/` and `/privacy/`. Each page has its own title, description, H1, canonical URL and sitemap entry.

See [content decisions](docs/CONTENT-REVIEW.md) for the owner-confirmed facts and distinctions between actual property imagery, illustrative floorplans, rental inclusions and separately arranged support services.
