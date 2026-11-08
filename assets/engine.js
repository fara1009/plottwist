/* Правила подбора общие для обычного квиза и режима для двоих. */
(function (root) {
  'use strict';

  const genres = {
    comedy: 'comedy',
    drama: 'drama',
    scifi: 'sci-fi',
    thriller: 'thriller',
    animation: 'animation',
    romance: 'romance',
    adventure: 'adventure',
    action: 'action',
    horror: 'horror',
    fantasy: 'fantasy',
  };

  const moods = {
    light: 'lighthearted',
    wonder: 'a sense of wonder',
    tense: 'suspense',
    warm: 'heartwarming',
  };

  const POINTS = {
    mood: 5,
    genre: 4,
    duration: 3,
    intensity: 2,
    overTimeLimit: -8,
    overIntensityLimit: -4,
  };

  function fitsDuration(movie, duration) {
    return duration === 'any' || movie.minutes <= Number(duration);
  }

  function fitsIntensity(movie, intensity) {
    return intensity === 'any' || movie.intensity <= Number(intensity);
  }

  // Эти ограничения обязательны, даже когда жанры участников различаются.
  function fitsHardLimits(movie, preferences) {
    return fitsDuration(movie, preferences.duration) && fitsIntensity(movie, preferences.intensity);
  }

  function score(movie, preferences) {
    let total = 0;
    if (movie.moods.includes(preferences.mood)) total += POINTS.mood;
    if (preferences.genre === 'any' || movie.genres.includes(preferences.genre)) {
      total += POINTS.genre;
    }
    total += fitsDuration(movie, preferences.duration) ? POINTS.duration : POINTS.overTimeLimit;
    total += fitsIntensity(movie, preferences.intensity)
      ? POINTS.intensity
      : POINTS.overIntensityLimit;
    return total;
  }

  // Объяснение строится из реальных совпадений, а не из случайного текста.
  function reasons(movie, preferences) {
    const matches = [];
    if (movie.moods.includes(preferences.mood)) {
      matches.push('mood: ' + moods[preferences.mood]);
    }
    if (preferences.genre !== 'any' && movie.genres.includes(preferences.genre)) {
      matches.push('preferred genre: ' + genres[preferences.genre]);
    }
    if (preferences.duration !== 'any' && fitsDuration(movie, preferences.duration)) {
      matches.push('fits within ' + preferences.duration + ' minutes');
    }
    if (preferences.intensity !== 'any' && fitsIntensity(movie, preferences.intensity)) {
      matches.push('comfortable emotional intensity');
    }
    return matches.length ? matches : ['a chance to try something new'];
  }

  function matchesAllPreferences(movie, preferences) {
    const genreMatches = preferences.genre === 'any' || movie.genres.includes(preferences.genre);
    return (
      fitsHardLimits(movie, preferences) && genreMatches && movie.moods.includes(preferences.mood)
    );
  }

  function recommend(movies, preferences) {
    const eligibleMovies = movies.filter((movie) => fitsHardLimits(movie, preferences));
    if (!eligibleMovies.length) return { items: [], exact: false };

    eligibleMovies.sort(
      (first, second) =>
        score(second, preferences) - score(first, preferences) ||
        first.title.localeCompare(second.title, 'en'),
    );
    const items = eligibleMovies.slice(0, 3);
    return { items, exact: items.every((movie) => matchesAllPreferences(movie, preferences)) };
  }

  function together(movies, firstPreferences, secondPreferences) {
    const eligibleMovies = movies.filter(
      (movie) =>
        fitsHardLimits(movie, firstPreferences) && fitsHardLimits(movie, secondPreferences),
    );
    const rankedMovies = eligibleMovies.map((movie) => ({
      movie,
      a: score(movie, firstPreferences),
      b: score(movie, secondPreferences),
      exact:
        matchesAllPreferences(movie, firstPreferences) &&
        matchesAllPreferences(movie, secondPreferences),
    }));

    // Сначала точные совпадения, затем вариант с лучшей худшей оценкой:
    // это учитывает обоих, не отдавая приоритет первому участнику.
    rankedMovies.sort(
      (first, second) =>
        Number(second.exact) - Number(first.exact) ||
        Math.min(second.a, second.b) - Math.min(first.a, first.b) ||
        second.a + second.b - first.a - first.b ||
        first.movie.title.localeCompare(second.movie.title, 'en'),
    );
    return {
      items: rankedMovies.slice(0, 3),
      exact: rankedMovies.length > 0 && rankedMovies[0].exact,
    };
  }

  function clock(startTime, offsetMinutes) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + offsetMinutes;
    const displayHours = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const displayMinutes = String(totalMinutes % 60).padStart(2, '0');
    const nextDay = totalMinutes >= 1440 ? ' (+1 day)' : '';
    return `${displayHours}:${displayMinutes}${nextDay}`;
  }

  const api = { genres, moods, score, reasons, recommend, together, clock };
  root.PlotEngine = api;
  // Экспорт нужен для проверок в Node.js. В браузере используется PlotEngine.
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
