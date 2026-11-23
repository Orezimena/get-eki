# Eki

Build a complete web app called Eki — an anonymous market intelligence platform for UK popup market traders. Eki is like Glassdoor but for market traders: vendors anonymously review markets they trade at, and other traders read those reviews before deciding where to book a stall.

Brand colours: primary orange #D35400, light orange #E67E22, charcoal #2A2A2A, mint green #7DCEA0, light background #F4F4F4. Font: clean sans-serif. Logo: the word "Eki" in bold orange. see icon in picture attached and guideline

Use the attached JSON file as the seed data for markets, reviews, and vendors. See PRD for more details on all features

Build the following screens:

AUTHENTICATION:
1. Homepage / landing — hero with tagline "For market traders who mean business", shows top 6 rated markets (those with at least one approved review, sorted by score), CTA buttons to Sign up and Sign in
2. Sign up — email and password fields, confirm password, "Create account" button
3. Email verification — confirmation screen saying "Check your email to verify your account"
4. Sign in — email and password, forgot password link
5. Onboarding — after verification, ask vendor to select their product category (Food and drink / Craft and art / Clothing and accessories / Homeware and gifts / Plants and flowers / Health and beauty / Jewellery / Other) and trading region (North West / Yorkshire / Midlands / London / South East / South West / Scotland / Wales / Northern Ireland). Save to their profile.

CORE PRODUCT:
6. Market directory — grid of market cards (3 columns desktop, 2 tablet, 1 mobile). Each card shows: market name, city, market type badge, stall fee range, star rating and review count. Markets with no approved reviews show "No reviews yet" instead of a score. Search bar at top filters by name and city in real time. Filter options: market type (multi-select), region (single select), stall fee range (slider), minimum score (single select), only show rated markets (toggle). Active filters show as dismissible pills.

7. Market profile page — full profile showing: market name, type badge, location, frequency, organiser name, stall fee range, description, categories accepted. Score section (shown from the first approved review): overall star rating, per-dimension scores as labelled progress bars (footfall quality, crowd spend power, organiser communication, stall fee vs return, setup and logistics), "Would you return?" as a percentage. When there are no approved reviews show: "No reviews yet — be the first to review this market". Show the approved review count alongside scores and return percentages. Individual reviews (shown from the first approved review): review cards showing dimension scores, written comment, product category, trading region, would return badge (green/amber/red), helpful count and upvote button. "Leave a review" button always shown.

8. Review submission form — triggered by "Leave a review" button. Fields: market name (pre-filled, locked), date traded (date picker, past dates only), product category (pre-filled from profile, editable), then 5 rating dimensions each scored 1–5 with star selector: footfall quality, crowd spend power, organiser communication, stall fee vs return, setup and logistics. "Would you return?" as Yes/No/Maybe selector. Written comment (optional, max 500 characters with counter). Submit button. Validation: all 5 dimensions required, date required, would return required.

9. Review confirmation — after submit: "Thanks for your review. It'll go live once it's been checked — usually within 24 hours."

10. Account settings — shows vendor's email, product category, trading region with ability to update category and region.

ADMIN:
11. Moderation queue — accessible at /admin. List of reviews with status "pending". Each row shows: market name, trading date, product category, trading region, overall score, written comment snippet, date submitted. Action buttons: Approve and Reject. Approved reviews update status to approved and are shown on the market profile. Rejected reviews are removed.

EDGE STATES:
- Market with 0 reviews: show "No reviews yet — be the first to review this market"
- Market with one approved review: show its ratings and review, labelled "Based on 1 review"
- Market with two or more approved reviews: show all approved reviews and their averages with accurate counts
- Search with no results: show "No markets found. Try a different search or clear your filters"
- Filter with no results: show "No markets match your filters" with clear filters button

KEY LOGIC:
- Only approved reviews contribute to public scores, counts and review lists, starting with the first approved review. Pending and rejected reviews are excluded.
- Score calculation: overall score = mean of all dimension scores across all reviews. Each dimension score = mean of that dimension across all reviews. Round to 1 decimal place.
- Sort reviews by helpful_count descending, then by trading_date descending
- Helpful upvote: each user can upvote once — button shows filled state after voting
- Flag button on each review — clicking shows a reason selector (Abusive / Inaccurate / Spam / Conflict of interest)

Make the app fully responsive. Deploy it. Use React with Tailwind CSS.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://get-eki.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6db3ee50-4cd5-4345-8749-309256eda63b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Review calculation checks

With Node.js 24, run `node tests/eki.test.mjs` to check zero, one and multiple approved reviews, pending/rejected exclusion, return percentages and review sorting. These checks use local fixtures and do not connect to Supabase.

Run `bun test tests/top-rated-markets.test.tsx` for homepage rendering checks covering successful empty results, loading, failed requests and populated market cards. These also use local fixtures.
