# Milestone: SEO – Fix Titles & Descriptions

**Goal**  
Ensure every page renders the correct <title> and <meta name="description"> from sheet fields with safe fallbacks.

**Scope**
- layouts/Site.astro
- pages/types (index + [slug])
- pages/neighbourhoods (index + [slug])

## Tasks
- [ ] Layout fallback: seo_description || summary
- [ ] Types index: header row → seo_title/seo_description/summary
- [ ] Types slug: pull + pass seo fields
- [ ] Neighbourhoods index/slug: same pattern
- [ ] Verify & remove debug metas
