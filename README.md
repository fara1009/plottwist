# PlotTwist

A bilingual movie discovery website for choosing a story and planning a movie night.

**[Open PlotTwist](https://fara1009.github.io/plottwist/)** · **[Defense guide](DEFENSE_GUIDE.md)**

## Features

- A four-question mood quiz with reasons for each recommendation.
- Choose together: two people answer separately on one device; both preferences count equally.
- A movie night kit with scaled snack ingredients, atmosphere, a schedule and a saved checklist.
- A personal list with watch statuses and ratings, saved in the current browser.
- A JSON catalog of 24 movies with search, mood filters and animated sorting.
- English and Russian throughout all five pages, including movie descriptions, recommendations and accessibility labels. English is the default; the selected language is remembered across pages and reloads.
- A custom movie details dialog, FAQ accordion and feedback toasts.
- Cream and wine palette with light/dark themes; the choice is saved across pages and reloads.
- Copy the evening plan, including quantities, checked items and midnight times; selectable text is offered if clipboard access is denied.
- Sticky section navigation, a back-to-top button, scroll reveals and viewport-triggered counters.

## Run locally

Serve this folder over HTTP: JSON files are loaded with `fetch`, so opening HTML directly with `file://` will not work.

With Node.js, no dependencies or installation are required:

```sh
node server.cjs
```

Then open http://127.0.0.1:8000. Alternatively, use VS Code Live Server or run `python -m http.server 8000` from the project folder. Stop the server with Ctrl+C.

The production site is static GitHub Pages. Bootstrap, jQuery and all 24 posters are local assets. External watch links need an internet connection. This website does not play videos or send personal data to a server. Saved lists, ratings and kits belong to the current browser and origin; moving to another browser/domain does not transfer them.

## Structure

| File                                | Responsibility                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `index.html`                        | Home, catalog, FAQ                                                             |
| `quiz.html`                         | Single-person quiz                                                             |
| `together.html`                     | Two-person matching                                                            |
| `evening.html`                      | Movie night kit                                                                |
| `my-list.html`                      | Saved collection                                                               |
| `assets/app.js`                     | Shared layout, page rendering and event handlers                               |
| `assets/engine.js`                  | Pure recommendation, explanation and time calculations                         |
| `assets/data.js`                    | Fetching and validating catalog data; progressive poster loading               |
| `assets/i18n.js`                    | Loading/caching dictionaries, translating placeholders and persisting language |
| `assets/data/movies.json`           | Language-independent movie IDs, metadata and links                             |
| `assets/locales/en.json`, `ru.json` | Interface text, movie titles and descriptions                                  |
| `assets/style.css`                  | Shared design, responsive layouts, focus and reduced-motion styles             |
| `assets/vendor/`                    | Bootstrap Grid 5.3.3 and jQuery 3.7.1                                          |
| `checks.cjs`                        | Automated checks using built-in Node.js modules                                |
| `server.cjs`                        | Optional local static server                                                   |

## Final Project Criteria

The assignment allocates 60% to technical work, 30% to the live defense and up to 10 additional bonus points. Optional bonus examples are alternatives; implementing all of them is not required.

| Technical criterion                       | Weight | Evidence in this project                                                                                                                                                                         |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Structure, connected pages and navigation | 5%     | Five HTML pages, shared navigation, active-page indicators and contextual links                                                                                                                  |
| Consistent design and usability           | 5%     | Shared header/footer, reusable cards/forms/buttons and consistent typography/colors                                                                                                              |
| Responsiveness and accessibility          | 10%    | Bootstrap breakpoints, custom mobile layout, semantic landmarks, form labels, poster alt text, keyboard focus, skip link, dialog labels, live status messages and reduced-motion support         |
| Bootstrap and custom CSS                  | 15%    | Local Bootstrap 12-column grid (`container`, `row`, responsive `col-*`) combined with custom components and media queries                                                                        |
| JavaScript and jQuery                     | 20%    | Quiz, fair two-person ranking, input validation, search/filter/sort, saved collection, dynamic kits; jQuery FAQ slides, question fades, sorting and validation animations                        |
| Code quality and optimization             | 5%     | Separate data/localization/logic/UI files, named functions, validated JSON, safe text escaping, cached requests, deferred scripts, local optimized posters and progressive catalog image loading |

Primary bonus evidence: **dynamic JSON loading (+5)** and **site-wide persisted EN/RU localization (+5)**. Search/filter, quiz, custom dialog, toasts, animated sorting, loader and lazy image loading provide additional working examples, but the bonus total is capped at +10 by the assignment. The teacher makes the final grading decision.

The remaining 30% depends on the student's live demonstration, explanation of their own contribution, problem solving and answers to three theory questions. Source code cannot complete that part on the student's behalf; use the defense guide to prepare.

## Additional bonus features: cream and wine update

`assets/enhancements.js` handles themes and optional interactions. It runs before CSS to restore the saved theme immediately; its UI initialization waits for the application's data. `enhancements-checks.cjs` verifies the new behavior and is included in `node checks.cjs`.

| Assignment feature             | Listed bonus | Implementation                                                                               |
| ------------------------------ | ------------ | -------------------------------------------------------------------------------------------- |
| Dark / Light Mode              | +3%          | Header toggle, site-wide CSS variables and localStorage persistence                          |
| Scroll Animations              | +3%          | IntersectionObserver triggers jQuery opacity animation and a short upward reveal             |
| Animated Counters              | +3%          | Catalog and saved-list numbers animate with requestAnimationFrame when entering the viewport |
| Sticky Navigation / Scroll Spy | +2%          | Scroll handler updates the active catalog/together/questions link and `aria-current`         |
| Back to Top                    | +2%          | Appears after scrolling, returns smoothly to the top and moves keyboard focus to the brand   |
| Clipboard Copy Button          | +2%          | Clipboard API copies the current evening kit in EN/RU, with feedback and manual fallback     |

These are separate working examples; the assignment's total bonus is still capped at +10%. Reduced-motion preferences bypass the animations. Keyboard focus immediately reveals hidden sections. Blocked storage or clipboard access does not stop the site from working.

## Recommendation rules

Duration and emotional intensity are hard limits. Eligible movies receive points for mood (5), genre (4), duration (3) and intensity (2). Exact mood/genre matches rank first; other eligible picks are clearly identified as alternatives. Up to three results are shown. When two people choose, each movie must meet both hard limits. Sorting then prioritizes an exact match for both, the better minimum individual score and the combined score. Stable IDs break ties, so changing the interface language does not change recommendations. Intensity is an editorial label, not an age rating.

## Validation

```sh
node checks.cjs
```

Checks cover 216 preference profiles and 46,656 pairs, equal treatment of participants, hard limits, language-independent results, truthful explanation descriptors, midnight rollover, catalog validation, dictionary key/placeholder parity, request caching, language persistence/failure behavior, local HTML assets and exactly 24 used posters.

Browser verification covers all five pages at desktop, tablet and phone widths in both languages, plus mid-quiz language switching, two-person handover/results, form validation, list status/rating persistence, saved kits/checklists, midnight schedules, sorting and keyboard dialog closure.

## Maintenance and sources

Edit movie metadata in `assets/data/movies.json` and both locale dictionaries for translated titles/descriptions. Keep stable IDs to preserve existing saved lists. Add every interface translation key to both dictionaries. Refresh the asset version query strings in the HTML after changing deployed files; data and locale loaders carry their script's version into JSON requests.

Movie metadata, poster and watch-link sources: [assets/SOURCES.md](assets/SOURCES.md). Descriptions and mood labels were written for this educational project. Posters belong to their respective rights holders. Watch links open externally in a new tab.
