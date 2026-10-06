# Bruce Liu — GitHub projects

A small self-hosted GitHub project page for Bruce Liu. It uses the visual direction of the supplied reference: a dark image-led header followed by project cards, a real GitHub contribution calendar, technical focus, and a short about section.

The page is built with plain HTML, CSS, and JavaScript. There is no build step or external runtime dependency.

## Local preview

Requires Node.js. Run `npm run dev`, then open http://localhost:4173. Run `npm run check` for JavaScript syntax checks.

The optional `scripts/verify-browser.cjs` smoke test uses an existing Playwright installation to check the responsive layout, project cards, language switch, activity grid, and local resource loading.

## Publish

The workflow in `.github/workflows/pages.yml` publishes only `site/` when changes are pushed to `main`. In the GitHub repository, set **Settings → Pages → Source → GitHub Actions**. The expected project URL is https://bruuuuuceliu.github.io/github-page/ once Pages is enabled.

All asset paths are relative so the site works at a repository subpath or a custom domain.

Technology logos are stored locally under `site/assets/icons/` from [Devicon](https://github.com/devicons/devicon), with its license included. The page also supports direct file previews.

## Content maintenance

- `site/index.html`: public project page structure and English copy.
- `site/app.js`: Chinese translations and language preference.
- `site/styles.css`: dark visual system, responsive layout, focus states, and project cards.
- `site/assets/background.webp`: the supplied image cropped to a central-head background.

The project list features the public EvoAgentX repository. The page intentionally omits résumé downloads, internal project names, salary information, and hiring-oriented copy.

Activity uses GitHub’s official authenticated GraphQL API. It queries the account’s history and past-year calendar without a repository filter, then cross-checks daily counts and overlapping periods. Only aggregate dates, counts, and intensity levels reach the site.

GitHub requires the classic token scope **read:user** to include private/internal contributions, even if the token already has repo access. Locally, run `gh auth refresh -h github.com -s read:user`, complete GitHub’s authorization, then run `python3 scripts/update-activity.py`. The script also accepts ACTIVITY_TOKEN or GH_TOKEN in the environment. It refuses tokens missing the scope or belonging to another account.

For automatic updates, configure the Actions secret **ACTIVITY_TOKEN** with the profile owner’s classic token including read:user. The Pages workflow runs hourly, on pushes, and on manual dispatch. GitHub may delay scheduled runs. Failed syncs stop deployment, preserving the published snapshot. Missing credentials retain the saved snapshot and timestamp. The repository GITHUB_TOKEN cannot read account-wide private contributions.

The browser reloads the published snapshot on page load, Refresh, and hourly while visible. Direct file previews reload local activity-data.js; run the local sync to update it. The public scraper is no longer used. The known incomplete calendar is hidden until an authenticated sync succeeds. Tokens and private repository details are never published.

Run `python3 scripts/test_activity.py` for sync regression tests and `npm run check` for syntax validation.
