# Search visibility handover

## Starting point

The Search Console figures supplied for 4–10 October 2026 were 19 total impressions, no clicks and an average position of 67.4. The query “specialist disability accommodation Tarneit” had 3 impressions at position 66; “sda tarneit” had 2 impressions at position 55; “sil housing tarneit” had 2 impressions at position 51; “sil tarneit” had 2 impressions at position 89.5; and “supported independent living tarneit” had 1 impression at position 97. These are a small, short-window baseline, not evidence of a trend. A manual search result around position 85 on 13 October is a separate observation because location, device, time and result layout can change rankings.

The reported index status at the time was 4 URLs indexed and 3 discovered but not indexed. The homepage’s HTTP-to-HTTPS redirect is expected. Recheck indexing in Search Console after publishing; this local implementation does not establish that Google has crawled or indexed any changes.

## Changes in this pass

- Added the public call and SMS actions across the existing site and clarified the exact HPS home, two ensuites, roll-in showers, current furnishing and vacancy details.
- Expanded the existing Tarneit page with official links to local transport, library, shopping and hospital information. The copy avoids travel times and unverified accessibility claims.
- Added a careful funding and household-arrangement invitation, with explicit limits around suitability, enrolment and funding approval.
- Added a representative social sharing image and corrected image dimensions to match the generated assets.

## How to measure

After deployment, compare equivalent Search Console date ranges (for example, the next 28 days versus the previous 28 days). Review clicks, impressions, average position and indexed pages separately. In Performance, filter queries for Tarneit and SDA variants, then compare page-level results for `/`, `/the-home/`, `/living-in-tarneit/` and `/sda-and-support/`. Record the date range, country, device and search type with each export. Rankings from manual searches are directional observations only; use Search Console for the site’s own query and impression data.

The changes improve clarity and discoverability but cannot guarantee rankings or enquiries. Indexing, ranking and click-through depend on Google and on searcher behaviour after publication.

## Deferred off-site follow-up

When ready, ask Disability Forever Homes whether it can link to the property page, align existing directory/property listings with the confirmed facts, and ask Bruno how past prospects described their searches. No outreach or listing changes were made in this pass.

## Follow-up content pass (13 October 2026)

The homepage and existing home/support routes now lead with two participant vacancies, the HPS category, roll-in showers, the separate OOA staff room, furnishing, pets, provider choice and lease/MTA options. The existing SDA & support page serves support coordinators, SIL providers and allied-health professionals; no new audience route was needed. The Tarneit guide uses current council, transport, shopping and hospital links without claiming travel times or access suitability.

Funding flexibility is presented in the concise wording approved by DFH before deployment. The follow-up content pass was merged to `main` in PR #1 and deployed on 13 October 2026. The public homepage and funding section were checked after deployment.
