---
name: Apify Social Media Scraping
description: Automated tenant social media verification using Apify actors + AI analysis, feeding into match score Block 3
type: feature
---
- Landlord stores Apify API token in `landlords.apify_token` via Settings > Integrations
- Edge function `social-media-scrape` runs 3 Apify actors: social-media-finder, instagram-profile-scraper, google-search-scraper
- Results analyzed by Lovable AI (gemini-2.5-flash-lite) via tool calling for structured output
- Output stored in `applicants.social_scrape_data` + individual scrape columns
- Triggered automatically in background after tenant completes socials stage (or skips it)
- Score feeds into Block 3 of match algorithm (max 2.0 points)
- No Apify token = neutral 1.0/2.0 score (no penalty)
- No social media found = neutral 1.0/2.0 score
- Background Check card shown in applicant expanded detail on ApplicantsPage
