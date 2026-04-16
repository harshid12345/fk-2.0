---
name: Apify Social Media Scraping
description: Company-owned Apify account for automated tenant background checks, zero config for landlords
type: feature
---
- Company owns the Apify account — API token stored as APIFY_TOKEN backend secret
- Landlords see NOTHING about Apify — zero config, it just works
- Edge function `social-media-scrape` runs 3 Apify actors: social-media-finder, instagram-profile-scraper, google-search-scraper
- Results analyzed by Lovable AI (gemini-2.5-flash-lite) via tool calling for structured output
- Output stored in `applicants.social_scrape_data` + individual scrape columns
- Triggered automatically in background after tenant completes socials stage
- Score feeds into Block 3 of match algorithm (max 2.0 points)
- No social media found = neutral 1.0/2.0 score (no penalty)
- Background Check card shown in applicant expanded detail on ApplicantsPage
- Cost per applicant: ~€0.033 (Apify + AI combined)
