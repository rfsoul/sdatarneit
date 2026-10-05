# SDA Tarneit

First release of **https://sdatarneit.au**, showcasing one actual SDA home on Social Street, Tarneit VIC 3029. This is a lightweight, static HTML site with an optional Node enquiry-delivery endpoint. Hosting target: **BTower Linux through the existing Cloudflare Tunnel**.

## Local preview

Requires Python 3.10+ with Pillow and Node 22+.

```powershell
python -m pip install -r requirements.txt
python scripts/build.py
node server.mjs
```

Open **http://127.0.0.1:8085**. On this Windows machine, the bundled executables used for the first build are:

```powershell
& 'C:\Users\ATE\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' scripts/build.py
& 'C:\Users\ATE\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.mjs
```

Run checks after building:

```powershell
node --test tests/server.test.mjs
python scripts/check_site.py
```

## Editing

- `scripts/build.py`: page content and HTML templates.
- `src/styles.css`: responsive visual design.
- `src/app.js`: manual photo gallery, media viewers, mobile navigation and enquiry flow.
- `config/site.json`: owner email and phone (rebuild after editing). Confirmed design category and availability fields also record owner decisions; copy changes belong in `build.py`.
- `scripts/assets.py`: photo inventory, descriptions, ordering and asset preparation.
- `ref/production/`: selected source media. All currently selected stills are included. Two of those are nearby images and also appear in the nearby section.
- `dist/`: generated public site. Only this directory is served. Do not serve the repository root.

The original 479 MB walkthrough is stored with Git LFS at `ref/orig/Al-Social St-Tarneit-DFH Full.mp4`. Install Git LFS and run `git lfs pull` after cloning if you need the master locally. It remains excluded from the Docker build context and public website. Other working reference files are excluded from Git. Only the selected 32.49 MB video is copied into the public build. WebP images are generated at three widths; complete original-resolution stills are not copied publicly. Existing source files are not modified.

## Enquiries

The initial release has working email and phone links. The form prepares a **mailto draft** addressed to `alistairmorgan@hotmail.com`; the visitor must review and send it in their email app. It never presents this as a successful website submission. Visitors without an email app can use the displayed email or phone.

An optional HTTPS webhook can enable direct website delivery; see [deployment](docs/DEPLOYMENT.md). No external service is configured and no real enquiry was sent during testing. Keep email-draft mode until an owner-approved delivery service has been set up and verified.

## Pages

- `/`: substantial property overview, all selected photographs, media actions and links to supporting pages.
- `/the-home/`: bedrooms, bathrooms, spaces, accessibility questions and separately labelled plans.
- `/living-in-tarneit/`: nearby photographs and practical location considerations.
- `/sda-and-support/`: SDA/SIL distinctions and property-specific FAQs.
- `/enquiries/`: owner contact details and enquiry preparation.
- `/walkthrough/`: click-to-play video with a text guide.
- `/privacy/`: initial-enquiry information handling.

Each page has static navigation and text, a distinct title and description, one H1, a canonical URL and inclusion in the sitemap. There are no location-variation doorway pages, trackers, web fonts, embedded external videos or autoplay.

## Before going live

Read [content decisions and outstanding confirmations](docs/CONTENT-REVIEW.md) and [BTower deployment](docs/DEPLOYMENT.md). Current vacancy and move-in dates remain unconfirmed; the site asks visitors to enquire instead of claiming availability. The site is built and locally previewable, but is **not deployed to the domain** by this task.
