# PlotTwist

A website for choosing movies and planning movie nights.

**[Open the website](https://fara1009.github.io/plottwist/)**

## Features

- A four-question mood quiz with explained recommendations.
- Choose together: two people answer in turn on the same device.
- A movie night kit with a snack, atmosphere, schedule and saved checklist.
- A personal list with watch statuses and ratings.
- A catalog of 24 movies, search, mood filters and spoiler-free details.
- English interface, movie titles, descriptions and accessibility labels.

## Technologies

HTML, CSS, Bootstrap Grid 5.3.3, JavaScript and jQuery 3.7.1.
Libraries and posters are stored in the repository, so the website can run offline.
External watch links require internet access. Your list and most recent movie night
kit are stored in localStorage on the current device and browser only.

## Run locally

Open the folder with Live Server in VS Code, or start a static server:

```sh
python -m http.server 8000
```

Then visit http://localhost:8000. You can also open `index.html` directly,
but a server is recommended for reliable storage across pages.

## Pages

| File | Purpose |
| --- | --- |
| `index.html` | Home and catalog |
| `quiz.html` | Mood quiz |
| `together.html` | Choose together |
| `evening.html` | Movie night kit |
| `my-list.html` | Personal list |

## Validation

```sh
node checks.cjs
```

Checks cover 216 quiz profiles, 46,656 pairs of answers, equal treatment of both
participants, time and intensity limits, midnight rollover and local asset paths.

## Sources

Movie and poster sources: [assets/SOURCES.md](assets/SOURCES.md).
Descriptions were written for this student project. Posters belong to their
respective rights holders. Emotional intensity is an editorial description and
does not replace an age rating. The website does not provide video playback.

## Catalog and source maintenance

The catalog contains 24 movies: eight earlier titles were replaced and six added.
Movie details and evening kits include verified direct links to the corresponding
Rezka movie pages. These open in a new tab.

JavaScript and CSS are formatted for readability. Comments identify the main
application sections, and recommendation rules are kept in named functions.
Edit `assets/movies.js`, including `watchUrl`, to update the catalog.
