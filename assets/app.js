(async function () {
  'use strict';
  const i18n = globalThis.PlotI18n;
  const [catalog] = await Promise.all([globalThis.PlotData.load(), i18n.init()]);
  const t = i18n.t;
  let movies = globalThis.PlotData.localize(catalog, i18n);
  // 1. Помощники для DOM, данные и сохранение в браузере.
  const getElement = (selector, root = document) => root.querySelector(selector);
  const getElements = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const movieEngine = globalThis.PlotEngine;
  const escapeHtml = (s) =>
    String(s ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const STORAGE_KEY = 'plottwist:v1';
  let storageWarning = false;
  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const list = {};
      for (const m of movies) {
        const item = raw.list?.[m.id];
        if (item && ['watch', 'watched'].includes(item.status))
          list[m.id] = {
            status: item.status,
            rating: [1, 2, 3, 4, 5].includes(Number(item.rating)) ? Number(item.rating) : 0,
          };
      }
      return {
        list,
        evening: sanitizeEvening(raw.evening),
      };
    } catch {
      storageWarning = true;
      return { list: {}, evening: null };
    }
  }
  function sanitizeEvening(kit) {
    if (
      !kit ||
      !movies.some((movie) => movie.id === kit.film) ||
      ![1, 2, 3, 4].includes(kit.people) ||
      !['salty', 'sweet', 'fresh'].includes(kit.snack) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(kit.start)
    )
      return null;
    return {
      film: kit.film,
      people: kit.people,
      snack: kit.snack,
      start: kit.start,
      checked: Array.isArray(kit.checked)
        ? kit.checked.filter((index) => Number.isInteger(index) && index >= 0 && index < 6)
        : [],
    };
  }
  let state = read(),
    toastTimer;
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      toast(t('ui.your_browser_blocked_saving_changes_are_available_until_you_close_this_page'));
      return false;
    }
  }
  function toast(message) {
    const el = getElement('#toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 3800);
  }
  function updateCount() {
    getElements('.nav-count').forEach((el) => (el.textContent = Object.keys(state.list).length));
    getElements('[data-save]').forEach((el) => {
      const saved = !!state.list[el.dataset.save];
      el.classList.toggle('saved', saved);
      el.setAttribute('aria-pressed', String(saved));
      el.setAttribute(
        'aria-label',
        (saved ? t('ui.remove_from_my_list') : t('ui.add_to_my_list')) +
          (movies.find((m) => m.id === el.dataset.save)?.title || ''),
      );
      if (el.classList.contains('save-button')) el.textContent = saved ? '✓' : '+';
      else el.textContent = saved ? t('ui.in_my_list') : t('ui.my_list');
    });
  }
  function toggleSave(id) {
    if (!movies.some((m) => m.id === id)) return;
    if (state.list[id]) {
      delete state.list[id];
      if (persist()) toast(t('ui.movie_removed_from_your_list'));
    } else {
      state.list[id] = { status: 'watch', rating: 0 };
      if (persist()) toast(t('ui.added_to_your_list'));
    }
    updateCount();
    if (page === 'list') renderList();
  }
  const page = document.body.dataset.page;
  function navigationLinks() {
    return [
      ['home', 'index.html', t('ui.home')],
      ['quiz', 'quiz.html', t('ui.quiz')],
      ['duo', 'together.html', t('ui.choose_together')],
      ['evening', 'evening.html', t('ui.movie_night')],
      ['list', 'my-list.html', t('ui.my_list_11')],
    ];
  }
  // 2. Общие шапка и подвал на всех пяти страницах.
  function shell() {
    getElement('#site-header').innerHTML = /* HTML */ `
      <div class="container header-inner">
        <a class="brand" href="index.html" aria-label="${t('ui.plottwist_home')}">
          <span class="brand-symbol" aria-hidden="true">››</span>
          plot
          <span>twist.</span>
        </a>
        <button class="menu-button" aria-expanded="false" aria-controls="navigation">
          ${t('ui.menu')}
        </button>
        <nav class="navigation" id="navigation" aria-label="${t('ui.main_navigation')}">
          ${navigationLinks()
            .map(
              ([id, url, title]) => /* HTML */ `
                <a
                  href="${url}"
                  class="${page === id ? 'active ' : ''}${id === 'list' ? 'nav-list' : ''}"
                  ${page === id ? 'aria-current="page"' : ''}
                >
                  ${title}${id === 'list' ? '<span class="nav-count">0</span>' : ''}
                </a>
              `,
            )
            .join('')}
        </nav>
        <div class="language-control">
          <label class="visually-hidden" for="language-switch">${t('language.label')}</label>
          <select id="language-switch" class="language-select" aria-label="${t('language.label')}">
            <option value="en" ${i18n.language === 'en' ? 'selected' : ''}>EN</option>
            <option value="ru" ${i18n.language === 'ru' ? 'selected' : ''}>RU</option>
          </select>
        </div>
      </div>
    `;
    getElement('#site-footer').innerHTML = /* HTML */ `
      <div class="container footer-inner">
        <a class="brand" href="index.html">
          plot
          <span>twist.</span>
        </a>
        <p>${t('ui.less_choosing_more_watching')}</p>
        <p>© ${new Date().getFullYear()} PlotTwist · ${t('ui.student_project')}</p>
        <a class="footer-link" href="assets/SOURCES.md">${t('ui.poster_and_data_sources')}</a>
      </div>
    `;
    getElement('#language-switch').addEventListener('change', changeLanguage);
    getElement('.menu-button').addEventListener('click', (e) => {
      const open = e.currentTarget.getAttribute('aria-expanded') !== 'true';
      e.currentTarget.setAttribute('aria-expanded', String(open));
      getElement('#navigation').classList.toggle('open', open);
    });
  }
  // 3. Переиспользуемые фрагменты интерфейса.
  function title(eyebrow, heading, description) {
    return /* HTML */ `
      <section class="page-top container">
        <div class="eyebrow">${eyebrow}</div>
        <h1>${heading}</h1>
        <p>${description}</p>
      </section>
    `;
  }
  function describeReasons(movie, preferences) {
    return movieEngine.reasons(movie, preferences).map((reason) => {
      let value = reason.value;
      if (reason.type === 'mood') value = t('moods.' + value);
      if (reason.type === 'genre') value = t('genres.' + value);
      return t('reasons.' + reason.type, { value });
    });
  }
  function formatClock(start, offset) {
    return movieEngine.clock(start, offset, t('time.nextDay'));
  }
  function meta(m) {
    return `${m.year} <span aria-hidden="true">·</span> ${m.minutes}${t('ui.min')} <span aria-hidden="true">·</span> ${escapeHtml(t('genres.' + m.genres[0]))}`;
  }

  // Проверенные адреса хранятся в data/movies.json рядом с данными нужного фильма.
  // Ссылка открывает внешнюю страницу, не встраивая чужой видеоплеер в сайт.
  function watchLink(movie, compact = false) {
    let destination;
    try {
      destination = new URL(movie.watchUrl);
    } catch {
      return '';
    }
    if (destination.protocol !== 'https:' || destination.hostname !== 'rezka-tv.org') return '';

    return /* HTML */ `
      <a
        class="button secondary watch-link ${compact ? 'small' : ''}"
        href="${escapeHtml(destination.href)}"
        data-watch="${movie.id}"
        target="_blank"
        rel="noopener noreferrer"
      >
        ${t('ui.watch_on_rezka')}
        <span class="visually-hidden">${t('ui.opens_in_a_new_tab')}</span>
      </a>
    `;
  }
  function card(m) {
    return /* HTML */ `
      <article class="movie-card">
        <button
          class="save-button"
          data-save="${m.id}"
          aria-pressed="false"
          aria-label="${t('ui.add_to_my_list')}${escapeHtml(m.title)}"
        >
          +
        </button>
        <button
          class="poster-button"
          data-details-label="${t('common.details')}"
          data-detail="${m.id}"
          aria-label="${t('ui.details')}${escapeHtml(m.title)}"
        >
          <img
            data-src="${m.poster}"
            alt="${t('ui.movie_poster')}${escapeHtml(m.title)}»"
            loading="lazy"
            decoding="async"
            width="400"
            height="600"
          />
        </button>
        <button class="movie-title" data-detail="${m.id}">${escapeHtml(m.title)}</button>
        <div class="movie-meta">${meta(m)}</div>
        <div class="movie-tag">${escapeHtml(t('moods.' + m.moods[0]))}</div>
      </article>
    `;
  }
  // 4. Главная страница: каталог, поиск, фильтры и FAQ.
  let homeFilter = 'all';
  let homeSort = 'featured';
  function home() {
    const featured = ['interstellar', 'grand-budapest', 'la-la-land']
      .map((id) => movies.find((m) => m.id === id))
      .map((m, i) => m || movies[i]);
    getElement('#main').innerHTML = /* HTML */ `
      <section class="hero container">
        <div class="row align-items-center">
          <div class="col-lg-6">
            <div class="eyebrow">${t('ui.for_nights_worth_remembering')}</div>
            <h1>
              ${t('ui.not_sure')}
              <br />
              ${t('ui.what_to_watch')}
              <br />
              <em>${t('ui.here_s_your_plot_twist')}</em>
            </h1>
            <p>
              ${t('ui.find_a_movie_to_match_your_mood')}
              <br />
              ${t('ui.solo_or_together_without_the_endless_scrolling')}
            </p>
            <div class="hero-actions">
              <a href="quiz.html" class="button primary">
                ${t('ui.find_my_movie')}
                <span aria-hidden="true">↗</span>
              </a>
              <a href="together.html" class="button secondary">
                ${t('ui.choose_together')}
                <span aria-hidden="true">♡</span>
              </a>
            </div>
            <div class="hero-note">
              <span class="avatars" aria-hidden="true">
                <span>☺</span>
                <span>✦</span>
                <span>☻</span>
              </span>
              <span>${t('ui.4_questions_1_great_evening')}</span>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="hero-cinema" aria-label="${t('ui.movie_night_inspiration')}">
              ${featured
                .map(
                  (m) => /* HTML */ `
                    <a
                      class="hero-film"
                      href="evening.html?film=${m.id}"
                      aria-label="${t('ui.movie_night_with')}${escapeHtml(m.title)}»"
                    >
                      <img
                        src="${m.poster}"
                        alt="${escapeHtml(m.title)}"
                        width="400"
                        height="600"
                      />
                    </a>
                  `,
                )
                .join('')}
              <span class="cinema-note">${t('ui.your_next_favorite_movie_is_waiting_here')}</span>
            </div>
          </div>
        </div>
      </section>
      <div class="container">
        <div class="feature-strip">
          <a href="quiz.html">
            <b>✦</b>
            ${t('ui.mood_quiz')}
          </a>
          <a href="together.html">
            <b>♡</b>
            ${t('ui.a_match_for_two')}
          </a>
          <a href="evening.html">
            <b>◒</b>
            ${t('ui.your_movie_night_kit')}
          </a>
          <a href="my-list.html">
            <b>＋</b>
            ${t('ui.your_collection')}
          </a>
        </div>
      </div>
      <section class="section container" id="catalog">
        <div class="section-head">
          <div>
            <div class="eyebrow">${t('ui.picked_for_you')}</div>
            <h2>${t('ui.stories_to_lose_yourself_in')}</h2>
          </div>
          <label class="search-box">
            <span class="visually-hidden">${t('ui.search_movies')}</span>
            <input
              id="movie-search"
              type="search"
              placeholder="${t('ui.find_a_movie')}"
              autocomplete="off"
            />
          </label>
        </div>
        <div class="filters" aria-label="${t('ui.filter_by_mood')}">
          ${[
            ['all', t('ui.all_movies')],
            ['light', t('ui.light_and_fun')],
            ['wonder', t('ui.be_amazed')],
            ['tense', t('ui.feel_the_suspense')],
            ['warm', t('ui.feel_the_warmth')],
          ]
            .map(
              ([id, label]) => /* HTML */ `
                <button
                  class="chip ${id === homeFilter ? 'active' : ''}"
                  data-filter="${id}"
                  aria-pressed="${id === homeFilter}"
                >
                  ${label}
                </button>
              `,
            )
            .join('')}
        </div>
        <p id="catalog-status" class="page-status" aria-live="polite"></p>
        <label class="catalog-sort" for="movie-sort">
          <span>${t('sort.label')}</span>
          <select class="field" id="movie-sort">
            ${['featured', 'title', 'duration', 'year']
              .map(
                (value) => `
              <option value="${value}" ${homeSort === value ? 'selected' : ''}>${t('sort.' + value)}</option>
            `,
              )
              .join('')}
          </select>
        </label>
        <div class="row g-4" id="movie-grid"></div>
      </section>
      <section class="curated container">
        <div class="callout">
          <div>
            <div class="eyebrow" style="margin-bottom:13px">${t('ui.two_tastes_one_movie')}</div>
            <h2>${t('ui.move_beyond_anything_is_fine')}</h2>
            <p>${t('ui.take_turns_answering_and_find_a_story_you_will_both_enjoy')}</p>
          </div>
          <a class="button primary" href="together.html">${t('ui.find_your_match')}</a>
        </div>
      </section>
      <section class="container curated">
        <div class="section-head"><h2>${t('ui.before_you_press_play')}</h2></div>
        ${[
          [
            t('ui.can_i_watch_movies_here'),
            t('ui.plottwist_helps_you_choose_a_movie_and_plan_your_evening_watch_your_pick_at'),
          ],
          [
            t('ui.how_do_recommendations_work'),
            t('ui.we_match_your_mood_preferred_genre_available_time_and_emotional_intensity_w'),
          ],
          [
            t('ui.where_is_my_list_saved'),
            t('ui.in_this_browser_on_this_device_no_account_is_needed_clearing_your_browser_d'),
          ],
        ]
          .map(
            ([q, a], i) => /* HTML */ `
              <button class="faq-button" aria-expanded="false" aria-controls="faq-${i}">
                ${q}
                <span aria-hidden="true">＋</span>
              </button>
              <div class="faq-content" id="faq-${i}" hidden>${a}</div>
            `,
          )
          .join('')}
      </section>
    `;
    getElement('#movie-search').addEventListener('input', () => renderCatalog());
    getElement('#movie-sort').onchange = (event) => {
      homeSort = event.target.value;
      renderCatalog(true);
    };
    getElements('[data-filter]').forEach((el) =>
      el.addEventListener('click', () => {
        homeFilter = el.dataset.filter;
        getElements('[data-filter]').forEach((b) => {
          b.classList.toggle('active', b === el);
          b.setAttribute('aria-pressed', String(b === el));
        });
        renderCatalog();
      }),
    );
    getElements('.faq-button').forEach((el) =>
      el.addEventListener('click', () => {
        const open = el.getAttribute('aria-expanded') !== 'true';
        el.setAttribute('aria-expanded', String(open));
        const content = document.getElementById(el.getAttribute('aria-controls'));
        if (globalThis.jQuery && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          content.hidden = false;
          jQuery(content)
            .stop(true, true)
            [open ? 'slideDown' : 'slideUp'](180, () => (content.hidden = !open));
        } else content.hidden = !open;
      }),
    );
    renderCatalog();
  }
  function renderCatalog(animate = false) {
    const query = getElement('#movie-search').value.trim().toLocaleLowerCase('en');
    const filtered = movies.filter(
      (m) =>
        (homeFilter === 'all' || m.moods.includes(homeFilter)) &&
        `${m.title} ${m.en} ${m.year}`.toLocaleLowerCase('en').includes(query),
    );
    if (homeSort !== 'featured') {
      const collator = new Intl.Collator(i18n.language);
      filtered.sort((a, b) => {
        if (homeSort === 'duration')
          return a.minutes - b.minutes || collator.compare(a.title, b.title);
        if (homeSort === 'year') return b.year - a.year || collator.compare(a.title, b.title);
        return collator.compare(a.title, b.title);
      });
    }
    getElement('#catalog-status').textContent = `${t('ui.movies_found')}${filtered.length}`;
    getElement('#movie-grid').innerHTML = filtered.length
      ? filtered
          .map((m) => /* HTML */ ` <div class="col-6 col-md-4 col-lg-2">${card(m)}</div> `)
          .join('')
      : /* HTML */ `
          <div class="col-12">
            <div class="empty">
              <h2>${t('ui.no_movies_found_yet')}</h2>
              <p>${t('ui.try_another_title_or_mood')}</p>
              <button class="button secondary" id="reset-search">${t('ui.reset_filters')}</button>
            </div>
          </div>
        `;
    if (getElement('#reset-search'))
      getElement('#reset-search').onclick = () => {
        getElement('#movie-search').value = '';
        homeFilter = 'all';
        getElements('[data-filter]').forEach((el) => {
          const active = el.dataset.filter === 'all';
          el.classList.toggle('active', active);
          el.setAttribute('aria-pressed', String(active));
        });
        renderCatalog();
      };
    globalThis.PlotData.observePosters(getElement('#movie-grid'));
    if (animate && globalThis.jQuery && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      jQuery('#movie-grid').stop(true, true).hide().fadeIn(180);
    }
    updateCount();
  }
  // 5. Вопросы квиза. В режиме для двоих меняется участник.
  function questions() {
    return [
      {
        key: 'mood',
        title: t('ui.what_is_your_mood_today'),
        hint: t('ui.choose_the_feeling_you_want_for_your_evening'),
        options: [
          ['light', '☀', t('ui.light_and_fun'), t('ui.a_little_escape_and_a_smile')],
          ['wonder', '✦', t('ui.ready_to_be_amazed'), t('ui.new_worlds_and_unexpected_ideas')],
          ['tense', '◉', t('ui.craving_suspense'), t('ui.keep_me_guessing')],
          ['warm', '♡', t('ui.a_little_warmth'), t('ui.kind_heartfelt_stories')],
        ],
      },
      {
        key: 'genre',
        title: t('ui.which_genre_feels_right'),
        hint: t('ui.pick_a_favorite_or_let_your_mood_decide'),
        options: [
          ['comedy', '☺', t('ui.comedy'), t('ui.humor_with_personality')],
          ['scifi', '⌁', t('ui.sci_fi'), t('ui.beyond_the_everyday')],
          ['thriller', '◇', t('ui.thriller'), t('ui.a_mystery_until_the_very_end')],
          ['animation', '✿', t('ui.animation'), t('ui.stories_for_every_age')],
          ['romance', '♡', t('ui.romance'), t('ui.connections_and_feelings')],
          ['any', '✦', t('ui.surprise_me'), t('ui.open_to_any_genre')],
        ],
      },
      {
        key: 'duration',
        title: t('ui.how_much_time_do_you_have'),
        hint: t('ui.your_time_limit_is_always_respected'),
        options: [
          ['100', '◷', t('ui.up_to_100_minutes'), t('ui.just_enough_before_bed')],
          ['125', '◴', t('ui.up_to_125_minutes'), t('ui.a_classic_movie_night')],
          ['any', '∞', t('ui.no_time_limit'), t('ui.ready_to_get_lost_in_a_story')],
        ],
      },
      {
        key: 'intensity',
        title: t('ui.how_intense_should_it_feel'),
        hint: t('ui.this_describes_emotional_intensity_not_an_age_rating'),
        options: [
          ['1', '☁', t('ui.keep_it_gentle'), t('ui.no_heavy_emotions')],
          ['2', '≈', t('ui.moderate'), t('ui.a_little_tension_is_fine')],
          ['any', 'ϟ', t('ui.ready_for_strong_emotions'), t('ui.an_intense_story_is_welcome')],
        ],
      },
    ];
  }
  let quizScreen = 'names';
  let quizState = { step: 0, person: 0, answers: [{}, {}], names: ['', ''] };
  function questionnaire(duo, resume = false) {
    getElement('#main').innerHTML =
      title(
        duo ? t('ui.a_match_for_two') : t('ui.movies_for_your_mood'),
        duo ? t('ui.two_people_one_story') : t('ui.what_shall_we_watch_today'),
        duo
          ? t('ui.take_turns_answering_four_questions_we_will_consider_both_tastes_and_find_a')
          : t('ui.four_questions_then_up_to_three_movies_with_reasons_to_watch_your_endless_s'),
      ) +
      /* HTML */ `
        <section class="workspace container">
          <div class="row g-4">
            <div class="col-lg-8"><div class="panel" id="quiz-panel"></div></div>
            <aside class="col-lg-4">
              <div class="panel aside-panel">
                <div class="aside-number">${duo ? '02' : '04'}</div>
                <h2 class="aside-title">
                  ${duo ? t('ui.both_tastes_matter') : t('ui.questions_to_a_great_movie')}
                </h2>
                <ul class="aside-list">
                  <li>
                    <b>${t('ui.mood_comes_first')}</b>
                    ${t('ui.we_focus_on_what_you_feel_like_today')}
                  </li>
                  <li>
                    <b>${t('ui.time_matters')}</b>
                    ${t('ui.every_pick_fits_your_chosen_time_limit')}
                  </li>
                  <li>
                    <b>${t('ui.clear_reasons')}</b>
                    ${t('ui.we_explain_every_recommendation_in_plain_words')}
                  </li>
                </ul>
                <p class="fineprint">
                  ${t('ui.these_are_editorial_recommendations_check_the_age_rating_before')}
                  ${t('ui.watching')}
                </p>
              </div>
            </aside>
          </div>
        </section>
      `;
    if (resume && quizScreen === 'results') showResults(duo);
    else if (resume && quizScreen === 'handover') renderHandover();
    else if (resume && quizScreen === 'question') renderQuestion(duo);
    else if (duo) namesForm();
    else renderQuestion(false);
  }
  function namesForm() {
    quizScreen = 'names';
    getElement('#quiz-panel').innerHTML = /* HTML */ `
      <form id="names-form" class="names-form" novalidate>
        <div class="eyebrow">${t('ui.meet_your_movie_partner')}</div>
        <h2 style="margin-top:20px">${t('ui.who_is_choosing_tonight')}</h2>
        <p>
          ${t('ui.you_will_answer_on_the_same_device_the_first_person_s_answers_stay_hidden_f')}
        </p>
        <label class="input-label" for="name-one">${t('ui.first_person')}</label>
        <input
          class="field"
          aria-describedby="names-error"
          id="name-one"
          name="first"
          placeholder="${t('ui.for_example_alex')}"
          maxlength="24"
          required
          autocomplete="off"
        />
        <label class="input-label" for="name-two">${t('ui.second_person')}</label>
        <input
          class="field"
          aria-describedby="names-error"
          id="name-two"
          name="second"
          placeholder="${t('ui.for_example_sam')}"
          maxlength="24"
          required
          autocomplete="off"
        />
        <p id="names-error" class="form-error" role="alert"></p>
        <button class="button primary" type="submit" style="margin-top:20px">
          ${t('ui.find_a_match')}
        </button>
      </form>
    `;
    getElement('#names-form').onsubmit = (e) => {
      e.preventDefault();
      const names = [getElement('#name-one').value.trim(), getElement('#name-two').value.trim()];
      const fields = [getElement('#name-one'), getElement('#name-two')];
      fields.forEach((field, index) => field.setAttribute('aria-invalid', String(!names[index])));
      if (names.some((name) => !name)) {
        const error = getElement('#names-error');
        error.textContent = t('validation.names');
        if (globalThis.jQuery && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          jQuery(error).stop(true, true).hide().slideDown(180);
        } else error.hidden = false;
        fields[names.findIndex((name) => !name)].focus();
        return;
      }
      quizState = { step: 0, person: 0, answers: [{}, {}], names };
      renderQuestion(true);
    };
  }
  function animatePanel() {
    const panel = getElement('#quiz-panel');
    if (globalThis.jQuery && !matchMedia('(prefers-reduced-motion: reduce)').matches)
      jQuery(panel).hide().fadeIn(160);
    const heading = getElement('.question-title', panel);
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }
  function renderQuestion(duo) {
    quizScreen = 'question';
    const question = questions()[quizState.step];
    const answer = quizState.answers[quizState.person][question.key];
    const step = quizState.step + 1;
    const nextLabel =
      quizState.step < 3
        ? t('ui.next')
        : duo && quizState.person === 0
          ? t('ui.pass_the_device')
          : t('ui.show_movies');
    getElement('#quiz-panel').innerHTML = /* HTML */ `
      ${duo
        ? `<div class="duo-badge">${t('ui.your_turn')}${escapeHtml(quizState.names[quizState.person])}</div>`
        : ''}
      <div class="step-label">
        <span
          >${duo
            ? t('ui.person') + (quizState.person + 1) + t('ui.of_2')
            : t('ui.your_movie_profile')}</span
        >
        <span>${t('ui.question')}${step} / 4</span>
      </div>
      <div
        class="progress-track"
        role="progressbar"
        aria-label="${t('ui.progress')}"
        aria-valuemin="0"
        aria-valuemax="4"
        aria-valuenow="${step}"
      >
        <div class="progress-fill" style="width:${step * 25}%"></div>
      </div>
      <h2 class="question-title">${question.title}</h2>
      <p class="question-hint">${question.hint}</p>
      <div class="option-grid" role="group" aria-label="${t('ui.answer_options')}">
        ${question.options
          .map(
            ([value, icon, name, hint]) => `
          <button class="option ${answer === value ? 'selected' : ''}"
                  data-answer="${value}" aria-pressed="${answer === value}">
            <span class="option-icon" aria-hidden="true">${icon}</span>
            <span><strong>${name}</strong><small>${hint}</small></span>
          </button>
        `,
          )
          .join('')}
      </div>
      <div class="question-nav">
        <button class="text-button" id="previous" ${quizState.step === 0 ? 'disabled' : ''}>
          ${t('ui.back')}
        </button>
        <button class="button primary" id="next" ${!answer ? 'disabled' : ''}>${nextLabel}</button>
      </div>
    `;
    getElements('[data-answer]').forEach((button) => {
      button.onclick = () => {
        quizState.answers[quizState.person][question.key] = button.dataset.answer;
        getElements('[data-answer]').forEach((option) => {
          const selected = option === button;
          option.classList.toggle('selected', selected);
          option.setAttribute('aria-pressed', String(selected));
        });
        getElement('#next').disabled = false;
      };
    });
    getElement('#previous').onclick = () => {
      if (quizState.step > 0) {
        quizState.step--;
        renderQuestion(duo);
      }
    };
    getElement('#next').onclick = () => {
      if (!quizState.answers[quizState.person][question.key]) return;
      if (quizState.step < 3) {
        quizState.step++;
        renderQuestion(duo);
      } else if (duo && quizState.person === 0) renderHandover();
      else showResults(duo);
    };
    animatePanel();
  }

  function renderHandover() {
    quizScreen = 'handover';
    getElement('#quiz-panel').innerHTML = /* HTML */ `
      <div class="empty handover">
        <div class="empty-symbol" aria-hidden="true">♡</div>
        <h2>${escapeHtml(quizState.names[0])}${t('ui.your_answers_are_in')}</h2>
        <p>
          ${t('ui.pass_the_device_to')}${escapeHtml(quizState.names[1])}».<br />${t(
            'ui.it_is_their_turn_to_choose_a_mood',
          )}
        </p>
        <button id="second-person" class="button primary">
          ${t('duo.startSecond', { name: escapeHtml(quizState.names[1]) })}
        </button>
      </div>
    `;
    getElement('#second-person').onclick = () => {
      quizState.person = 1;
      quizState.step = 0;
      renderQuestion(true);
    };
  }
  function resultCard(m, reason, badge) {
    return /* HTML */ `
      <div class="col-md-4">
        <article class="result-card">
          <button
            class="poster-button"
            data-details-label="${t('common.details')}"
            style="aspect-ratio:3/2;border-radius:0"
            data-detail="${m.id}"
            aria-label="${t('ui.details')}${escapeHtml(m.title)}"
          >
            <img
              src="${m.poster}"
              alt="${t('ui.movie_poster')}${escapeHtml(m.title)}»"
              width="400"
              height="300"
            />
          </button>
          <div class="result-body">
            <div class="result-badge">${badge}</div>
            <h3>${escapeHtml(m.title)}</h3>
            <div class="movie-meta">${meta(m)}</div>
            <p class="reason">${reason}</p>
            <p>${escapeHtml(m.description)}</p>
            ${watchLink(m, true)}
            <div class="result-actions">
              <a class="button primary small" href="evening.html?film=${m.id}"
                >${t('ui.plan_movie_night')}</a
              >
              <button class="button secondary small" data-save="${m.id}">${t('ui.my_list')}</button>
            </div>
          </div>
        </article>
      </div>
    `;
  }
  function showResults(duo) {
    quizScreen = 'results';
    let items, exact;
    if (duo) {
      const r = movieEngine.together(movies, ...quizState.answers);
      items = r.items;
      exact = r.exact;
    } else {
      const r = movieEngine.recommend(movies, quizState.answers[0]);
      items = r.items.map((movie) => ({ movie }));
      exact = r.exact;
    }
    getElement('#main').innerHTML =
      title(
        duo ? t('ui.your_movie_night_together') : t('ui.your_results'),
        duo
          ? `${escapeHtml(quizState.names[0])} + ${escapeHtml(quizState.names[1])}`
          : t('ui.this_could_be_your_next_favorite'),
        duo
          ? exact
            ? t('ui.we_found_an_exact_match_for_both_of_your_preferences')
            : t('ui.these_are_compromise_picks_they_respect_both_time_and_intensity_limits_and_')
          : exact
            ? t('ui.these_movies_match_all_your_preferences')
            : t('ui.every_pick_fits_your_time_and_intensity_limits_some_are_close_alternatives_'),
      ) +
      /* HTML */ `
        <section class="workspace container">
          <div class="row g-4">
            ${items.length
              ? items
                  .map(({ movie: m, exact: isExact }, i) => {
                    let reason;
                    if (duo) {
                      reason = /* HTML */ `
                        <strong>${escapeHtml(quizState.names[0])}:</strong>
                        ${describeReasons(m, quizState.answers[0]).map(escapeHtml).join(', ')}.
                        <br />
                        <strong>${escapeHtml(quizState.names[1])}:</strong>
                        ${describeReasons(m, quizState.answers[1]).map(escapeHtml).join(', ')}.
                      `;
                    } else
                      reason = describeReasons(m, quizState.answers[0]).map(escapeHtml).join(' · ');
                    return resultCard(
                      m,
                      reason,
                      duo
                        ? isExact
                          ? t('ui.exact_match')
                          : t('ui.shared_pick')
                        : i === 0
                          ? t('ui.start_here')
                          : t('ui.another_story'),
                    );
                  })
                  .join('')
              : t('ui.div_class_col_12_div_class_empty_h2_no_movie_fits_all_your_limits_yet_h2_p_')}
          </div>
          <button id="restart" class="button secondary" style="margin-top:30px">
            ${t('ui.try_again')}
          </button>
        </section>
      `;
    getElement('#restart').onclick = () => {
      quizState = { step: 0, person: 0, answers: [{}, {}], names: ['', ''] };
      questionnaire(duo);
    };
    updateCount();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  // 6. Вечерний набор: фильм, закуска, чек-лист и расписание.
  function evening() {
    let requested = new URLSearchParams(location.search).get('film');
    if (!movies.some((m) => m.id === requested)) requested = state.evening?.film || movies[0].id;
    getElement('#main').innerHTML =
      title(
        t('ui.your_movie_night_starts_here'),
        t('ui.the_movie_is_just_the_beginning'),
        t('ui.pick_a_story_and_we_will_add_a_snack_set_the_mood_and_make_a_simple_plan_al'),
      ) +
      /* HTML */ `
        <section class="workspace container">
          <div class="row g-4">
            <div class="col-lg-4">
              <form class="panel" id="evening-form">
                <h2 class="aside-title">${t('ui.your_movie_night')}</h2>
                <label class="input-label" for="evening-film"
                  >${t('ui.what_are_we_watching')}</label
                >
                <select class="field" id="evening-film" name="film">
                  ${movies
                    .map(
                      (m) => /* HTML */ `
                        <option value="${m.id}" ${m.id === requested ? 'selected' : ''}>
                          ${escapeHtml(m.title)}
                        </option>
                      `,
                    )
                    .join('')}
                </select>
                <label class="input-label" for="people">${t('ui.how_many_people')}</label>
                <select class="field" id="people" name="people">
                  <option value="1">${t('ui.one_person')}</option>
                  <option value="2">${t('ui.two_people')}</option>
                  <option value="3">${t('ui.three_people')}</option>
                  <option value="4">${t('ui.four_people')}</option>
                </select>
                <label class="input-label" for="snack">${t('ui.what_are_you_craving')}</label>
                <select class="field" id="snack" name="snack">
                  <option value="salty">${t('ui.something_savory')}</option>
                  <option value="sweet">${t('ui.something_sweet')}</option>
                  <option value="fresh">${t('ui.fresh_fruit')}</option>
                </select>
                <label class="input-label" for="start-time">${t('ui.when_does_prep_start')}</label>
                <input
                  class="field"
                  id="start-time"
                  name="start"
                  type="time"
                  value="20:00"
                  required
                />
                <button class="button primary" type="submit" style="width:100%;margin-top:25px">
                  ${t('ui.plan_my_evening')}
                </button>
                <p class="fineprint" style="margin:17px 0 0">
                  ${t('ui.15_minutes_to_get_ready_then_the_movie_times_follow_your_local_clock')}
                </p>
                <p id="evening-message" class="fineprint" role="status"></p>
              </form>
            </div>
            <div class="col-lg-8"><div id="evening-output" aria-live="polite"></div></div>
          </div>
        </section>
      `;
    if (state.evening) {
      getElement('#people').value = String(state.evening.people || 1);
      getElement('#snack').value = state.evening.snack || 'salty';
      getElement('#start-time').value = state.evening.start || '20:00';
    }
    getElement('#evening-form').onsubmit = (e) => {
      e.preventDefault();
      const form = new FormData(e.currentTarget);
      state.evening = {
        film: form.get('film'),
        people: Number(form.get('people')),
        snack: form.get('snack'),
        start: form.get('start'),
        checked: [],
      };
      const saved = persist();
      renderEvening();
      getElement('#evening-message').textContent = saved
        ? t('ui.your_kit_is_saved_in_this_browser')
        : t('ui.your_kit_is_ready_but_could_not_be_saved_in_this_browser');
    };
    if (state.evening && state.evening.film === requested) renderEvening();
    else previewEvening(requested);
    getElement('#evening-film').onchange = () => previewEvening(getElement('#evening-film').value);
  }
  function previewEvening(id) {
    const m = movies.find((m) => m.id === id);
    getElement('#evening-output').innerHTML = /* HTML */ `
      <div class="panel">
        <div class="evening-card">
          <img src="${m.poster}" alt="${escapeHtml(m.title)}" width="115" height="172" />
          <div>
            <div class="eyebrow">${t('ui.tonight_s_starring_role')}</div>
            <h3 style="margin-top:15px">${escapeHtml(m.title)}</h3>
            <p>${meta(m)}</p>
            <p>${escapeHtml(m.description)}</p>
            ${watchLink(m, true)}
          </div>
        </div>
        <div class="empty" style="margin-top:25px">
          <div class="empty-symbol">◒</div>
          <h2>${t('ui.make_the_evening_your_own')}</h2>
          <p>${t('ui.choose_your_company_snack_and_start_time_we_will_bring_it_all_together')}</p>
        </div>
      </div>
    `;
  }
  function renderEvening() {
    const kit = state.evening,
      m = movies.find((m) => m.id === kit.film);
    if (!m) return;
    const n = kit.people;
    let snack, ingredients, instruction;
    if (kit.snack === 'sweet') {
      snack = t('ui.berry_yogurt_cups');
      ingredients = [
        `${n * 150}${t('ui.g_plain_yogurt')}`,
        `${n * 80}${t('ui.g_berries')}`,
        `${n * 25}${t('ui.g_granola')}`,
      ];
      instruction = t('ui.layer_yogurt_berries_and_granola_in_a_glass_sweeten_to_taste');
    } else if (kit.snack === 'fresh') {
      snack = t('ui.fresh_fruit_platter');
      ingredients = [
        `${t('ui.apples')}${n}`,
        `${t('ui.bananas')}${n}`,
        `${n * 100}${t('ui.g_grapes')}`,
      ];
      instruction = t('ui.wash_the_fruit_cut_into_bite_sized_pieces_and_serve_on_small_plates');
    } else {
      snack = t('ui.paprika_popcorn');
      ingredients = [
        `${n * 35}${t('ui.g_popcorn_kernels')}`,
        `${n}${t('ui.tsp_vegetable_oil')}`,
        t('ui.salt_and_paprika_to_taste'),
      ];
      instruction = t(
        'ui.make_the_popcorn_according_to_the_package_instructions_season_with_salt_and',
      );
    }
    const atmos = m.moods.includes('tense')
      ? [
          t('ui.your_home_cinema'),
          t('ui.dim_the_overhead_lights_and_leave_a_soft_light_to_one_side_silence_notifica'),
        ]
      : m.moods.includes('warm')
        ? [
            t('ui.warm_light_and_a_cozy_blanket'),
            t('ui.turn_on_a_warm_lamp_get_comfortable_and_keep_your_favorite_drink_nearby'),
          ]
        : m.moods.includes('wonder')
          ? [
              t('ui.a_little_adventure'),
              t('ui.soften_the_lights_check_the_sound_and_give_the_story_your_full_attention'),
            ]
          : [
              t('ui.easy_and_relaxed'),
              t('ui.soft_light_comfortable_seats_and_individual_snack_bowls_just_settle_in_and_'),
            ];
    const checklist = [
      ...ingredients,
      t('ui.get_water_or_drinks_ready'),
      t('ui.set_up_the_lights_and_sound'),
      t('ui.silence_notifications'),
    ];
    const checked = Array.isArray(kit.checked) ? kit.checked : [];
    getElement('#evening-output').innerHTML = /* HTML */ `
      <div class="panel">
        <div class="evening-card">
          <img src="${m.poster}" alt="${escapeHtml(m.title)}" width="115" height="172" />
          <div>
            <div class="eyebrow">${t('ui.your_movie_night_kit')}</div>
            <h3 style="margin-top:15px">${escapeHtml(m.title)}</h3>
            <p>${meta(m)}</p>
            <div class="result-actions">
              <button class="button secondary small" data-save="${m.id}">${t('ui.my_list')}</button>
              ${watchLink(m, true)}
            </div>
          </div>
        </div>
        <div class="kit-block">
          <h3>
            <span aria-hidden="true">◒</span>
            ${snack}
          </h3>
          <p>
            ${t('kit.serves')}${['', t('ui.one'), t('ui.two'), t('ui.three'), t('ui.four')][n]}.
            ${instruction}
          </p>
          <ul class="check-list">
            ${checklist
              .map(
                (text, i) => /* HTML */ `
                  <li>
                    <label>
                      <input
                        type="checkbox"
                        data-kit-check="${i}"
                        ${checked.includes(i) ? 'checked' : ''}
                      />
                      <span>${escapeHtml(text)}</span>
                    </label>
                  </li>
                `,
              )
              .join('')}
          </ul>
          <p class="fineprint" style="margin-top:12px">
            ${t('ui.adjust_the_ingredients_and_quantities_to_suit_your_preferences')}
          </p>
        </div>
        <div class="kit-block">
          <h3>
            <span aria-hidden="true">✦</span>
            ${atmos[0]}
          </h3>
          <p>${atmos[1]}</p>
        </div>
        <div class="kit-block">
          <h3>
            <span aria-hidden="true">◷</span>
            ${t('ui.a_plan_with_time_to_unwind')}
          </h3>
          <ol class="timeline">
            <li>
              <time>${formatClock(kit.start, 0)}</time>
              <span>${t('ui.prepare_your_snack_and_settle_in')}</span>
            </li>
            <li>
              <time>${formatClock(kit.start, 15)}</time>
              <span>${t('ui.start_watching')}${escapeHtml(m.title)}»</span>
            </li>
            <li>
              <time>${formatClock(kit.start, 15 + m.minutes)}</time>
              <span>${t('ui.credits_roll_what_was_your_favorite_moment')}</span>
            </li>
          </ol>
        </div>
      </div>
    `;
    getElements('[data-kit-check]').forEach(
      (el) =>
        (el.onchange = () => {
          state.evening.checked = getElements('[data-kit-check]:checked').map((c) =>
            Number(c.dataset.kitCheck),
          );
          persist();
        }),
    );
    updateCount();
  }
  // 7. Личная коллекция: статусы просмотра и оценки.
  let listFilter = 'all';
  function list() {
    getElement('#main').innerHTML =
      title(
        t('ui.your_collection'),
        t('ui.keep_good_movies_close'),
        t('ui.save_your_discoveries_mark_what_you_have_watched_and_add_your_ratings_your_'),
      ) +
      /* HTML */ `
        <section class="workspace container">
          <div id="list-stats"></div>
          <div class="filters">
            ${[
              ['all', t('ui.all_movies')],
              ['watch', t('ui.want_to_watch')],
              ['watched', t('ui.watched')],
            ]
              .map(
                ([id, t]) => /* HTML */ `
                  <button
                    class="chip ${id === listFilter ? 'active' : ''}"
                    data-list-filter="${id}"
                    aria-pressed="${id === listFilter}"
                  >
                    ${t}
                  </button>
                `,
              )
              .join('')}
          </div>
          <div id="list-output" aria-live="polite"></div>
        </section>
      `;
    getElements('[data-list-filter]').forEach(
      (el) =>
        (el.onclick = () => {
          listFilter = el.dataset.listFilter;
          getElements('[data-list-filter]').forEach((b) => {
            b.classList.toggle('active', b === el);
            b.setAttribute('aria-pressed', String(b === el));
          });
          renderList();
        }),
    );
    renderList();
  }
  function renderList() {
    const all = movies.filter((m) => state.list[m.id]);
    const viewed = all.filter((m) => state.list[m.id].status === 'watched');
    const filtered = all.filter(
      (m) => listFilter === 'all' || state.list[m.id].status === listFilter,
    );
    getElement('#list-stats').innerHTML = /* HTML */ `
      <div class="stats">
        <div class="stat">
          <b>${all.length}</b>
          <span>${t('ui.in_your_collection')}</span>
        </div>
        <div class="stat">
          <b>${all.length - viewed.length}</b>
          <span>${t('ui.waiting_for_movie_night')}</span>
        </div>
        <div class="stat">
          <b>${viewed.length}</b>
          <span>${t('ui.already_watched')}</span>
        </div>
      </div>
    `;
    getElement('#list-output').innerHTML = filtered.length
      ? filtered
          .map((m) => {
            const item = state.list[m.id];
            return /* HTML */ `
              <article class="list-item">
                <button
                  class="poster-button"
                  data-details-label="${t('common.details')}"
                  data-detail="${m.id}"
                  style="width:auto;flex-shrink:0;border-radius:6px"
                  aria-label="${t('ui.details')}${escapeHtml(m.title)}"
                >
                  <img src="${m.poster}" alt="${escapeHtml(m.title)}" width="80" height="120" />
                </button>
                <div class="list-item-main">
                  <h3>${escapeHtml(m.title)}</h3>
                  <p>${meta(m)}</p>
                  <div class="list-controls">
                    <label class="list-label">
                      ${t('ui.status')}
                      <select
                        data-status="${m.id}"
                        aria-label="${t('ui.status')}: ${escapeHtml(m.title)}"
                      >
                        <option value="watch" ${item.status === 'watch' ? 'selected' : ''}>
                          ${t('ui.want_to_watch')}
                        </option>
                        <option value="watched" ${item.status === 'watched' ? 'selected' : ''}>
                          ${t('ui.watched')}
                        </option>
                      </select>
                    </label>
                    ${item.status === 'watched'
                      ? /* HTML */ `
                          <label class="list-label">
                            ${t('ui.my_rating')}
                            <select
                              data-rating="${m.id}"
                              aria-label="${t('ui.my_rating')}: ${escapeHtml(m.title)}"
                            >
                              <option value="0">${t('ui.not_rated')}</option>
                              ${[1, 2, 3, 4, 5]
                                .map(
                                  (v) => /* HTML */ `
                                    <option value="${v}" ${item.rating === v ? 'selected' : ''}>
                                      ${'★'.repeat(v)} ${v}/5
                                    </option>
                                  `,
                                )
                                .join('')}
                            </select>
                          </label>
                        `
                      : ''}
                    <a
                      href="evening.html?film=${m.id}"
                      class="button secondary small"
                      style="align-self:end"
                    >
                      ${t('ui.movie_night')} ↗
                    </a>
                  </div>
                </div>
                <button
                  class="text-button"
                  data-remove="${m.id}"
                  aria-label="${t('ui.remove_from_my_list')}${escapeHtml(m.title)}"
                >
                  ×
                </button>
              </article>
            `;
          })
          .join('')
      : /* HTML */ `
          <div class="empty">
            <div class="empty-symbol">＋</div>
            <h2>
              ${all.length
                ? t('ui.this_part_of_your_list_is_empty')
                : t('ui.your_next_story_is_waiting')}
            </h2>
            <p>
              ${all.length
                ? t('ui.change_the_filter_or_update_a_saved_movie_s_status')
                : t('ui.tap_on_a_movie_card_to_save_it_here')}
            </p>
            <a class="button primary" href="index.html#catalog">${t('ui.choose_a_movie')}</a>
          </div>
        `;
    getElements('[data-status]').forEach(
      (el) =>
        (el.onchange = () => {
          state.list[el.dataset.status].status = el.value;
          persist();
          renderList();
        }),
    );
    getElements('[data-rating]').forEach(
      (el) =>
        (el.onchange = () => {
          state.list[el.dataset.rating].rating = Number(el.value);
          if (persist()) toast(t('ui.rating_saved'));
        }),
    );
    getElements('[data-remove]').forEach(
      (el) => (el.onclick = () => toggleSave(el.dataset.remove)),
    );
    updateCount();
  }
  // 8. Подробности фильма в модальном окне.
  function detail(id) {
    const m = movies.find((m) => m.id === id);
    if (!m) return;
    const dialog = getElement('#movie-dialog');
    dialog.dataset.movieId = id;
    dialog.innerHTML = /* HTML */ `
      <button class="dialog-close" aria-label="${t('ui.close_details')}">×</button>
      <div class="dialog-content">
        <div class="row g-4">
          <div class="col-md-4">
            <img
              class="dialog-poster"
              src="${m.poster}"
              alt="${t('ui.movie_poster')}${escapeHtml(m.title)}»"
              width="400"
              height="600"
            />
          </div>
          <div class="col-md-8">
            <div class="eyebrow">${t('ui.the_story_without_spoilers')}</div>
            <h2 id="dialog-title" style="margin:16px 0 6px">${escapeHtml(m.title)}</h2>
            <p class="movie-meta">${escapeHtml(m.en)} · ${m.year} · ${m.minutes}${t('ui.min')}</p>
            <p id="dialog-description" class="dialog-description">${escapeHtml(m.description)}</p>
            <p class="movie-tag">
              ${m.genres.map((g) => escapeHtml(t('genres.' + g))).join(' / ')}
            </p>
            <p class="fineprint">
              ${t('ui.intensity')}${['', t('ui.gentle'), t('ui.moderate_229'), t('ui.high')][
                m.intensity
              ]}.
              ${t('ui.check_the_age')} ${t('ui.rating_on_your_viewing_service')}
            </p>
            <div class="result-actions">
              <a href="evening.html?film=${m.id}" class="button primary"
                >${t('ui.plan_movie_night')}</a
              >
              <button class="button secondary" data-save="${m.id}">${t('ui.my_list')}</button>
              ${watchLink(m)}
            </div>
          </div>
        </div>
      </div>
    `;
    dialog.querySelector('.dialog-close').onclick = () => dialog.close();
    updateCount();
    dialog.showModal();
  }
  // 9. Общие обработчики и запуск нужной страницы.
  document.addEventListener('click', (e) => {
    const save = e.target.closest('[data-save]');
    if (save) {
      toggleSave(save.dataset.save);
      return;
    }
    const open = e.target.closest('[data-detail]');
    if (open) detail(open.dataset.detail);
  });
  getElement('#movie-dialog').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      if (
        e.clientX < rect.left ||
        e.clientX > rect.right ||
        e.clientY < rect.top ||
        e.clientY > rect.bottom
      )
        e.currentTarget.close();
    }
  });
  function renderPage(resume = false) {
    document.documentElement.lang = i18n.language;
    document.title = t('pages.' + page + '.title');
    getElement('meta[name="description"]').content = t('meta.description');
    getElement('.skip-link').textContent = t('common.skip');
    shell();
    if (page === 'home') home();
    else if (page === 'quiz') questionnaire(false, resume);
    else if (page === 'duo') questionnaire(true, resume);
    else if (page === 'evening') evening();
    else if (page === 'list') list();
    updateCount();
    getElement('#main').removeAttribute('aria-busy');
  }

  async function changeLanguage(event) {
    const selector = event.currentTarget;
    const oldLanguage = i18n.language;
    const draft = {};
    for (const input of getElements('main input:not([type="checkbox"]), main select')) {
      if (input.id) draft[input.id] = input.value;
    }
    const dialog = getElement('#movie-dialog');
    const openMovie = dialog.open ? dialog.dataset.movieId : null;
    selector.disabled = true;
    try {
      await i18n.setLanguage(selector.value);
      movies = globalThis.PlotData.localize(catalog, i18n);
      if (dialog.open) dialog.close();
      renderPage(true);
      for (const [id, value] of Object.entries(draft)) {
        const input = document.getElementById(id);
        if (input) input.value = value;
      }
      if (page === 'home') renderCatalog();
      if (
        page === 'evening' &&
        draft['evening-film'] &&
        draft['evening-film'] !== state.evening?.film
      ) {
        previewEvening(draft['evening-film']);
      }
      if (openMovie) detail(openMovie);
      else getElement('#language-switch').focus({ preventScroll: true });
      toast(t('language.changed'));
    } catch (error) {
      console.error('Could not change language', error);
      selector.value = oldLanguage;
      selector.disabled = false;
      toast(t('language.error'));
    }
  }

  renderPage();
  if (storageWarning) toast(t('ui.saved_data_is_unavailable_you_can_start_a_new_list'));
})().catch((error) => {
  console.error('PlotTwist could not start', error);
  const main = document.querySelector('#main');
  main.removeAttribute('aria-busy');
  main.innerHTML = `<section class="container page-top"><div class="panel" role="alert">
    <h1>Could not load PlotTwist</h1>
    <p>Please check your connection and try again. For local use, start an HTTP server with
    <code>node server.cjs</code> or Live Server instead of opening the HTML file directly.</p>
    <button class="button primary" id="retry-load">Try again</button>
  </div></section>`;
  document.querySelector('#retry-load').onclick = () => location.reload();
});
