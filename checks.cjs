const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const E = require('./assets/engine.js');
const Data = require('./assets/data.js');
const json = (filename) => JSON.parse(fs.readFileSync(path.join(__dirname, filename), 'utf8'));
const catalog = Data.validate(json('assets/data/movies.json'));
const locales = { en: json('assets/locales/en.json'), ru: json('assets/locales/ru.json') };
const translate = (language) => ({
  t: (key) => {
    assert.ok(key in locales[language], key);
    return locales[language][key];
  },
});
const movies = Data.localize(catalog, translate('en'));
const russianMovies = Data.localize(catalog, translate('ru'));

async function main() {
  assert.equal(catalog.length, 24);
  assert.equal(new Set(catalog.map((movie) => movie.id)).size, catalog.length);
  assert.deepEqual(Object.keys(locales.en).sort(), Object.keys(locales.ru).sort());
  const appSource = fs.readFileSync(path.join(__dirname, 'assets/app.js'), 'utf8');
  for (const match of appSource.matchAll(/\bt\(['"]([^'"]+)['"]\s*[,)]/g)) {
    assert.ok(match[1] in locales.en, `Missing interface translation: ${match[1]}`);
  }
  const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const dictionary of Object.values(locales))
    for (const [key, value] of Object.entries(dictionary)) {
      assert.equal(typeof value, 'string');
      assert.deepEqual(placeholders(value), placeholders(locales.en[key]), key);
    }
  for (const movie of movies) {
    assert.ok(movie.title && movie.description && movie.originalTitle);
    assert.ok(fs.existsSync(path.join(__dirname, movie.poster)), movie.poster);
    assert.match(new URL(movie.watchUrl).pathname, /^\/(films|cartoons|animation)\/.+\.html$/);
  }
  assert.deepEqual(
    fs.readdirSync(path.join(__dirname, 'assets/posters')).sort(),
    movies.map((movie) => path.basename(movie.poster)).sort(),
    'No unused posters',
  );
  assert.throws(() => Data.validate({ movies: [catalog[0], catalog[0]] }), /duplicate/);
  assert.throws(() => Data.validate({ movies: [{ ...catalog[0], minutes: -1 }] }), /Invalid/);
  assert.throws(
    () => Data.validate({ movies: [{ ...catalog[0], watchUrl: 'https://example.test/movie' }] }),
    /Unsupported/,
  );
  const profiles = [];
  for (const mood of ['light', 'wonder', 'tense', 'warm'])
    for (const genre of ['comedy', 'scifi', 'thriller', 'animation', 'romance', 'any'])
      for (const duration of ['100', '125', 'any'])
        for (const intensity of ['1', '2', 'any'])
          profiles.push({ mood, genre, duration, intensity });
  const within = (movie, p) =>
    (p.duration === 'any' || movie.minutes <= Number(p.duration)) &&
    (p.intensity === 'any' || movie.intensity <= Number(p.intensity));
  const exact = (movie, p) =>
    within(movie, p) &&
    movie.moods.includes(p.mood) &&
    (p.genre === 'any' || movie.genres.includes(p.genre));
  const ids = (items) => items.map((movie) => movie.id);
  for (const profile of profiles) {
    const result = E.recommend(movies, profile);
    assert.ok(result.items.length > 0 && result.items.length <= 3);
    assert.ok(result.items.every((movie) => within(movie, profile)));
    assert.equal(
      result.exact,
      result.items.every((movie) => exact(movie, profile)),
    );
    assert.deepEqual(
      ids(result.items),
      ids(E.recommend(russianMovies, profile).items),
      'Language-independent ranking',
    );
    for (const movie of result.items)
      for (const reason of E.reasons(movie, profile)) {
        assert.ok(locales.en['reasons.' + reason.type]);
        if (reason.type === 'mood') assert.ok(movie.moods.includes(reason.value));
        if (reason.type === 'genre') assert.ok(movie.genres.includes(reason.value));
        if (reason.type === 'duration') assert.ok(movie.minutes <= Number(reason.value));
      }
  }
  for (const first of profiles)
    for (const second of profiles) {
      const forward = E.together(movies, first, second),
        reverse = E.together(movies, second, first);
      assert.ok(forward.items.length > 0 && forward.items.length <= 3);
      assert.deepEqual(
        ids(forward.items.map((item) => item.movie)),
        ids(reverse.items.map((item) => item.movie)),
      );
      assert.ok(
        forward.items.every((item) => within(item.movie, first) && within(item.movie, second)),
      );
      assert.equal(forward.exact, forward.items[0].exact);
    }
  assert.equal(E.clock('23:50', 30), '00:20 (+1 day)');
  assert.equal(E.clock('23:50', 30, ' (+1 день)'), '00:20 (+1 день)');
  assert.equal(E.clock('20:00', 115), '21:55');
  assert.deepEqual(E.recommend([], profiles[0]), { items: [], exact: false });
  for (const filename of [
    'index.html',
    'quiz.html',
    'together.html',
    'evening.html',
    'my-list.html',
  ]) {
    const html = fs.readFileSync(path.join(__dirname, filename), 'utf8');
    assert.match(html, /<html lang="en">/);
    assert.match(html, /aria-describedby="dialog-description"/);
    for (const [, asset] of html.matchAll(/(?:src|href)="(assets\/[^"#]+)"/g))
      assert.ok(fs.existsSync(path.join(__dirname, asset.split('?')[0])), asset);
  }
  await checkRuntime();
  await require('./enhancements-checks.cjs')();
  console.log(
    `PASS: ${profiles.length} profiles; ${profiles.length ** 2} pairs; language-independent ranking; reason descriptors; JSON loading/validation; EN/RU caching/persistence; clock rollover; theme/clipboard/scroll/counter checks; 24 used posters; all HTML assets.`,
  );
}

async function checkRuntime() {
  const source = fs.readFileSync(path.join(__dirname, 'assets/i18n.js'), 'utf8');
  const saved = new Map();
  let requests = 0;
  const sandbox = {
    URL,
    document: { currentScript: { src: 'https://example.test/plottwist/assets/i18n.js?v=test' } },
    localStorage: {
      getItem: (key) => saved.get(key) || null,
      setItem: (key, value) => saved.set(key, value),
    },
    fetch: async (url) => {
      requests++;
      return { ok: true, json: async () => locales[url.pathname.includes('/ru.') ? 'ru' : 'en'] };
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  await sandbox.PlotI18n.init();
  assert.equal(sandbox.PlotI18n.language, 'en');
  await sandbox.PlotI18n.setLanguage('ru');
  assert.equal(saved.get('plottwist:language'), 'ru');
  assert.equal(sandbox.PlotI18n.t('reasons.duration', { value: 100 }), 'укладывается в 100 минут');
  await sandbox.PlotI18n.setLanguage('en');
  await sandbox.PlotI18n.setLanguage('ru');
  assert.equal(requests, 2);
  await assert.rejects(sandbox.PlotI18n.setLanguage('xx'), /Unsupported/);
  assert.throws(() => sandbox.PlotI18n.t('does.not.exist'), /Missing/);
  const reload = { ...sandbox };
  vm.createContext(reload);
  vm.runInContext(source, reload);
  await reload.PlotI18n.init();
  assert.equal(reload.PlotI18n.language, 'ru');
  const failure = {
    ...sandbox,
    localStorage: { getItem: () => null, setItem: () => {} },
    fetch: async (url) => ({
      ok: !url.pathname.includes('/ru.'),
      status: 503,
      json: async () => locales.en,
    }),
  };
  vm.createContext(failure);
  vm.runInContext(source, failure);
  await failure.PlotI18n.init();
  await assert.rejects(failure.PlotI18n.setLanguage('ru'), /503/);
  assert.equal(failure.PlotI18n.language, 'en');
  const dataSource = fs.readFileSync(path.join(__dirname, 'assets/data.js'), 'utf8');
  let dataRequests = 0;
  const dataScope = {
    URL,
    document: { currentScript: { src: 'https://example.test/assets/data.js?v=test' } },
    fetch: async () => {
      dataRequests++;
      return { ok: true, json: async () => ({ movies: catalog }) };
    },
  };
  vm.createContext(dataScope);
  vm.runInContext(dataSource, dataScope);
  await Promise.all([dataScope.PlotData.load(), dataScope.PlotData.load()]);
  assert.equal(dataRequests, 1);
  const badData = { ...dataScope, fetch: async () => ({ ok: false, status: 404 }) };
  vm.createContext(badData);
  vm.runInContext(dataSource, badData);
  await assert.rejects(badData.PlotData.load(), /404/);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
