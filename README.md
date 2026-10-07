# Bruce Liu — GitHub projects

A small self-hosted GitHub project page for Bruce Liu. Its Ink Atlas composition combines bright warm paper, aged gold drafting, transparent editorial panels, a real GitHub contribution calendar, technical focus, and a short about section.

The page is built with plain HTML, CSS, and JavaScript. There is no build step or external runtime dependency.

## Local preview

Requires Node.js. Run `npm run dev`, then open http://localhost:4173. Run `npm run check` for JavaScript syntax checks.

The optional `scripts/verify-browser.cjs` smoke test uses an existing Playwright installation to check the responsive layout, project cards, language switch, activity grid, and local resource loading.

## Publish

The live site is https://bruuuuuceliu.github.io/github-page/. GitHub Pages is configured to use GitHub Actions. Every push to `main` runs syntax and contribution-sync tests, then publishes `site/` through `.github/workflows/pages.yml`. Manual deployment is available in Actions → Deploy GitHub project page → Run workflow.

The public repository starts with the current project files. Earlier development history is preserved separately in the private `github-page-private-archive` repository.

All asset paths are relative so the site works at a repository subpath or a custom domain.

Technology logos are stored locally under `site/assets/icons/` from [Devicon](https://github.com/devicons/devicon), with its license included. The page also supports direct file previews.

## Content maintenance

- `site/index.html`: public project page structure and English copy.
- `site/app.js`: Chinese translations and language preference.
- `site/styles.css`: gilded editorial surfaces, responsive layout, focus states, and shared material.
- `site/assets/ink-atlas-background.svg`: an original authored umber, aged gold, drafting, and oxide-red composition used as the hero background.
- `site/assets/ink-atlas/`: locally bundled Bodoni/Barlow fonts, cutout icons, and original drafting/print assets with their licenses. The usage manifest records SVG sources and hashes. Small SVG masks are embedded in CSS so direct file previews work.

The sections share a continuous warm background. Transparent reading planes, open borders, a torn intro strip, a network drafting emblem, and bracketed activity framing follow the current Ink Atlas surface guidance. Decorative geometry stays outside semantic reading and control containers.

The project list features the public EvoAgentX repository. The page intentionally omits résumé downloads, internal project names, salary information, and hiring-oriented copy.

Activity uses GitHub’s official authenticated GraphQL API. It queries the account’s history and past-year calendar without a repository filter, then cross-checks daily counts and overlapping periods. Only aggregate dates, counts, and intensity levels reach the site.

GitHub requires the classic token scope **read:user** to include private/internal contributions, even if the token already has repo access. Locally, run `gh auth refresh -h github.com -s read:user`, complete GitHub’s authorization, then run `python3 scripts/update-activity.py`. The script also accepts ACTIVITY_TOKEN or GH_TOKEN in the environment. It refuses tokens missing the scope or belonging to another account.

For automatic updates, configure the Actions secret **ACTIVITY_TOKEN** with the profile owner’s dedicated classic token with only read:user. The Pages workflow runs hourly, on pushes, and on manual dispatch. GitHub may delay scheduled runs. Failed syncs stop deployment, preserving the published snapshot. Without credentials, a direct GitHub public-calendar sync runs unless an authenticated snapshot already exists; authenticated data is preserved so public-only counts cannot overwrite it. The repository GITHUB_TOKEN cannot read account-wide private contributions.

The browser reloads the published snapshot on page load, Refresh, and hourly while visible. Direct file previews reload local activity-data.js; run the local sync to update it. The third-party scraper is no longer used. A no-token fallback reads dates and counts directly from GitHub calendar tooltips and labels them as public contributions. Both scopes are usable, with the actual data timestamp displayed. Tokens and private repository details are never published.

Run `python3 scripts/test_activity.py` for sync regression tests and `npm run check` for syntax validation.
