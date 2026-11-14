/* Fetch the catalog once, validate it, and build movie objects in the selected language. */
(function (root) {
  'use strict';
  const scriptUrl = typeof document !== 'undefined' ? new URL(document.currentScript.src) : null;
  const genres = new Set([
    'comedy',
    'drama',
    'scifi',
    'thriller',
    'animation',
    'romance',
    'adventure',
    'action',
    'horror',
    'fantasy',
  ]);
  const moods = new Set(['light', 'wonder', 'tense', 'warm']);
  let catalogPromise;
  let posterObserver;

  function validate(payload) {
    if (!Array.isArray(payload?.movies) || !payload.movies.length)
      throw new Error('The catalog is empty');
    const ids = new Set();
    for (const movie of payload.movies) {
      if (!/^[a-z0-9-]+$/.test(movie.id) || ids.has(movie.id))
        throw new Error('Invalid or duplicate movie ID');
      ids.add(movie.id);
      if (
        typeof movie.originalTitle !== 'string' ||
        !movie.originalTitle.trim() ||
        !Number.isInteger(movie.minutes) ||
        movie.minutes <= 0 ||
        !Number.isInteger(movie.year) ||
        ![1, 2, 3].includes(movie.intensity) ||
        !Array.isArray(movie.genres) ||
        !movie.genres.length ||
        !movie.genres.every((g) => genres.has(g)) ||
        !Array.isArray(movie.moods) ||
        !movie.moods.length ||
        !movie.moods.every((m) => moods.has(m)) ||
        !/^assets\/posters\/[a-z0-9-]+\.(jpg|png|webp)$/.test(movie.poster)
      ) {
        throw new Error(`Invalid movie data: ${movie.id}`);
      }
      const watch = new URL(movie.watchUrl);
      if (watch.protocol !== 'https:' || watch.hostname !== 'rezka-tv.org')
        throw new Error('Unsupported watch link');
    }
    return payload.movies;
  }

  function load() {
    if (!catalogPromise) {
      const url = new URL('data/movies.json', scriptUrl);
      url.search = scriptUrl.search;
      catalogPromise = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
          return response.json();
        })
        .then(validate)
        .catch((error) => {
          catalogPromise = null;
          throw error;
        });
    }
    return catalogPromise;
  }

  function localize(catalog, i18n) {
    return catalog.map((movie) => ({
      ...movie,
      title: i18n.t(`movies.${movie.id}.title`),
      en: movie.originalTitle,
      description: i18n.t(`movies.${movie.id}.description`),
    }));
  }

  function observePosters(container = document) {
    function reveal(image) {
      image.src = image.dataset.src;
      image.removeAttribute('data-src');
    }
    if ('IntersectionObserver' in root && !posterObserver) {
      posterObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries)
            if (entry.isIntersecting) {
              reveal(entry.target);
              posterObserver.unobserve(entry.target);
            }
        },
        { rootMargin: '250px' },
      );
    }
    if (posterObserver) posterObserver.disconnect();
    for (const image of container.querySelectorAll('img[data-src]')) {
      if (posterObserver) posterObserver.observe(image);
      else reveal(image);
    }
  }

  const api = { load, validate, localize, observePosters };
  root.PlotData = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
