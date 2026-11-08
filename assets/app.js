(function () {
  'use strict';
  // 1. Помощники для DOM, данные и сохранение в браузере.
  const getElement = (selector, root = document) => root.querySelector(selector);
  const getElements = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const movies = globalThis.MOVIES || [],
    movieEngine = globalThis.PlotEngine;
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
        evening: raw.evening && movies.some((m) => m.id === raw.evening.film) ? raw.evening : null,
      };
    } catch {
      storageWarning = true;
      return { list: {}, evening: null };
    }
  }
  let state = read(),
    toastTimer;
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch {
      toast('Your browser blocked saving. Changes are available until you close this page.');
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
        (saved ? 'Remove from my list: ' : 'Add to my list: ') +
          (movies.find((m) => m.id === el.dataset.save)?.title || ''),
      );
      if (el.classList.contains('save-button')) el.textContent = saved ? '✓' : '+';
      else el.textContent = saved ? '✓ In my list' : '+ My list';
    });
  }
  function toggleSave(id) {
    if (!movies.some((m) => m.id === id)) return;
    if (state.list[id]) {
      delete state.list[id];
      if (persist()) toast('Movie removed from your list');
    } else {
      state.list[id] = { status: 'watch', rating: 0 };
      if (persist()) toast('Added to your list');
    }
    updateCount();
    if (page === 'list') renderList();
  }
  const page = document.body.dataset.page;
  const links = [
    ['home', 'index.html', 'Home'],
    ['quiz', 'quiz.html', 'Quiz'],
    ['duo', 'together.html', 'Choose together'],
    ['evening', 'evening.html', 'Movie night'],
    ['list', 'my-list.html', 'My list'],
  ];
  // 2. Общие шапка и подвал на всех пяти страницах.
  function shell() {
    getElement('#site-header').innerHTML = /* HTML */ `
      <div class="container header-inner">
        <a class="brand" href="index.html" aria-label="PlotTwist — home">
          <span class="brand-symbol" aria-hidden="true">››</span>
          plot
          <span>twist.</span>
        </a>
        <button class="menu-button" aria-expanded="false" aria-controls="navigation">
          Menu ☰
        </button>
        <nav class="navigation" id="navigation" aria-label="Main navigation">
          ${links
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
      </div>
    `;
    getElement('#site-footer').innerHTML = /* HTML */ `
      <div class="container footer-inner">
        <a class="brand" href="index.html">
          plot
          <span>twist.</span>
        </a>
        <p>Less choosing. More watching.</p>
        <p>© ${new Date().getFullYear()} PlotTwist · Student project</p>
        <a class="footer-link" href="assets/SOURCES.md">Poster and data sources ↗</a>
      </div>
    `;
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
  function meta(m) {
    return `${m.year} <span aria-hidden="true">·</span> ${m.minutes} min <span aria-hidden="true">·</span> ${escapeHtml(movieEngine.genres[m.genres[0]])}`;
  }

  // Проверенные адреса хранятся в movies.js рядом с данными нужного фильма.
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
        Watch on Rezka ↗
        <span class="visually-hidden">(opens in a new tab)</span>
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
          aria-label="Add to my list: ${escapeHtml(m.title)}"
        >
          +
        </button>
        <button
          class="poster-button"
          data-detail="${m.id}"
          aria-label="Details: ${escapeHtml(m.title)}"
        >
          <img
            src="${m.poster}"
            alt="Movie poster: «${escapeHtml(m.title)}»"
            loading="lazy"
            width="400"
            height="600"
          />
        </button>
        <button class="movie-title" data-detail="${m.id}">${escapeHtml(m.title)}</button>
        <div class="movie-meta">${meta(m)}</div>
        <div class="movie-tag">${escapeHtml(movieEngine.moods[m.moods[0]])}</div>
      </article>
    `;
  }
  // 4. Главная страница: каталог, поиск, фильтры и FAQ.
  let homeFilter = 'all';
  function home() {
    const featured = ['interstellar', 'grand-budapest', 'la-la-land']
      .map((id) => movies.find((m) => m.id === id))
      .map((m, i) => m || movies[i]);
    getElement('#main').innerHTML = /* HTML */ `
      <section class="hero container">
        <div class="row align-items-center">
          <div class="col-lg-6">
            <div class="eyebrow">For nights worth remembering</div>
            <h1>
              Not sure
              <br />
              what to watch?
              <br />
              <em>Here’s your plot twist.</em>
            </h1>
            <p>
              Find a movie to match your mood.
              <br />
              Solo or together, without the endless scrolling.
            </p>
            <div class="hero-actions">
              <a href="quiz.html" class="button primary">
                Find my movie
                <span aria-hidden="true">↗</span>
              </a>
              <a href="together.html" class="button secondary">
                Choose together
                <span aria-hidden="true">♡</span>
              </a>
            </div>
            <div class="hero-note">
              <span class="avatars" aria-hidden="true">
                <span>☺</span>
                <span>✦</span>
                <span>☻</span>
              </span>
              <span>4 questions. 1 great evening.</span>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="hero-cinema" aria-label="Movie night inspiration">
              ${featured
                .map(
                  (m) => /* HTML */ `
                    <a
                      class="hero-film"
                      href="evening.html?film=${m.id}"
                      aria-label="Movie night with «${escapeHtml(m.title)}»"
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
              <span class="cinema-note">✦ Your next favorite movie is waiting here</span>
            </div>
          </div>
        </div>
      </section>
      <div class="container">
        <div class="feature-strip">
          <a href="quiz.html">
            <b>✦</b>
            Mood quiz
          </a>
          <a href="together.html">
            <b>♡</b>
            A match for two
          </a>
          <a href="evening.html">
            <b>◒</b>
            Your movie night kit
          </a>
          <a href="my-list.html">
            <b>＋</b>
            Your collection
          </a>
        </div>
      </div>
      <section class="section container" id="catalog">
        <div class="section-head">
          <div>
            <div class="eyebrow">Picked for you</div>
            <h2>Stories to lose yourself in</h2>
          </div>
          <label class="search-box">
            <span class="visually-hidden">Search movies</span>
            <input id="movie-search" type="search" placeholder="Find a movie…" autocomplete="off" />
          </label>
        </div>
        <div class="filters" aria-label="Filter by mood">
          ${[
            ['all', 'All movies'],
            ['light', 'Light and fun'],
            ['wonder', 'Be amazed'],
            ['tense', 'Feel the suspense'],
            ['warm', 'Feel the warmth'],
          ]
            .map(
              ([id, label]) => /* HTML */ `
                <button
                  class="chip ${id === 'all' ? 'active' : ''}"
                  data-filter="${id}"
                  aria-pressed="${id === 'all'}"
                >
                  ${label}
                </button>
              `,
            )
            .join('')}
        </div>
        <p id="catalog-status" class="page-status" aria-live="polite"></p>
        <div class="row g-4" id="movie-grid"></div>
      </section>
      <section class="curated container">
        <div class="callout">
          <div>
            <div class="eyebrow" style="margin-bottom:13px">Two tastes. One movie.</div>
            <h2>Move beyond “anything is fine.”</h2>
            <p>Take turns answering and find a story you will both enjoy.</p>
          </div>
          <a class="button primary" href="together.html">Find your match ↗</a>
        </div>
      </section>
      <section class="container curated">
        <div class="section-head"><h2>Before you press play</h2></div>
        ${[
          [
            'Can I watch movies here?',
            'PlotTwist helps you choose a movie and plan your evening. Watch your pick at a cinema or on a streaming service available to you.',
          ],
          [
            'How do recommendations work?',
            'We match your mood, preferred genre, available time and emotional intensity with each movie. Every recommendation comes with an explanation.',
          ],
          [
            'Where is my list saved?',
            'In this browser on this device. No account is needed. Clearing your browser data will delete your saved list.',
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
    getElement('#movie-search').addEventListener('input', renderCatalog);
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
  function renderCatalog() {
    const query = getElement('#movie-search').value.trim().toLocaleLowerCase('en');
    const filtered = movies.filter(
      (m) =>
        (homeFilter === 'all' || m.moods.includes(homeFilter)) &&
        `${m.title} ${m.en} ${m.year}`.toLocaleLowerCase('en').includes(query),
    );
    getElement('#catalog-status').textContent = `Movies found: ${filtered.length}`;
    getElement('#movie-grid').innerHTML = filtered.length
      ? filtered
          .map(
            (m) => /* HTML */ `
              <div class="col-6 col-md-4 col-lg-2">${card(m)}</div>
            `,
          )
          .join('')
      : /* HTML */ `
          <div class="col-12">
            <div class="empty">
              <h2>No movies found yet</h2>
              <p>Try another title or mood.</p>
              <button class="button secondary" id="reset-search">Reset filters</button>
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
    updateCount();
  }
  // 5. Вопросы квиза. В режиме для двоих меняется участник.
  const questions = [
    {
      key: 'mood',
      title: 'What is your mood today?',
      hint: 'Choose the feeling you want for your evening.',
      options: [
        ['light', '☀', 'Light and fun', 'A little escape and a smile'],
        ['wonder', '✦', 'Ready to be amazed', 'New worlds and unexpected ideas'],
        ['tense', '◉', 'Craving suspense', 'Keep me guessing'],
        ['warm', '♡', 'A little warmth', 'Kind, heartfelt stories'],
      ],
    },
    {
      key: 'genre',
      title: 'Which genre feels right?',
      hint: 'Pick a favorite or let your mood decide.',
      options: [
        ['comedy', '☺', 'Comedy', 'Humor with personality'],
        ['scifi', '⌁', 'Sci-fi', 'Beyond the everyday'],
        ['thriller', '◇', 'Thriller', 'A mystery until the very end'],
        ['animation', '✿', 'Animation', 'Stories for every age'],
        ['romance', '♡', 'Romance', 'Connections and feelings'],
        ['any', '✦', 'Surprise me', 'Open to any genre'],
      ],
    },
    {
      key: 'duration',
      title: 'How much time do you have?',
      hint: 'Your time limit is always respected.',
      options: [
        ['100', '◷', 'Up to 100 minutes', 'Just enough before bed'],
        ['125', '◴', 'Up to 125 minutes', 'A classic movie night'],
        ['any', '∞', 'No time limit', 'Ready to get lost in a story'],
      ],
    },
    {
      key: 'intensity',
      title: 'How intense should it feel?',
      hint: 'This describes emotional intensity, not an age rating.',
      options: [
        ['1', '☁', 'Keep it gentle', 'No heavy emotions'],
        ['2', '≈', 'Moderate', 'A little tension is fine'],
        ['any', 'ϟ', 'Ready for strong emotions', 'An intense story is welcome'],
      ],
    },
  ];
  let quizState = { step: 0, person: 0, answers: [{}, {}], names: ['', ''] };
  function questionnaire(duo) {
    getElement('#main').innerHTML =
      title(
        duo ? 'A match for two' : 'Movies for your mood',
        duo ? 'Two people. One story.' : 'What shall we watch today?',
        duo
          ? 'Take turns answering four questions. We will consider both tastes and find a shared pick.'
          : 'Four questions, then up to three movies with reasons to watch. Your endless search ends here.',
      ) +
      /* HTML */ `
        <section class="workspace container">
          <div class="row g-4">
            <div class="col-lg-8"><div class="panel" id="quiz-panel"></div></div>
            <aside class="col-lg-4">
              <div class="panel aside-panel">
                <div class="aside-number">${duo ? '02' : '04'}</div>
                <h2 class="aside-title">
                  ${duo ? 'Both tastes matter' : 'Questions to a great movie'}
                </h2>
                <ul class="aside-list">
                  <li>
                    <b>Mood comes first</b>
                    We focus on what you feel like today.
                  </li>
                  <li>
                    <b>Time matters</b>
                    Every pick fits your chosen time limit.
                  </li>
                  <li>
                    <b>Clear reasons</b>
                    We explain every recommendation in plain words.
                  </li>
                </ul>
                <p class="fineprint">
                  These are editorial recommendations. Check the age rating before
                  watching.
                </p>
              </div>
            </aside>
          </div>
        </section>
      `;
    if (duo) namesForm();
    else renderQuestion(false);
  }
  function namesForm() {
    getElement('#quiz-panel').innerHTML = /* HTML */ `
      <form id="names-form" class="names-form">
        <div class="eyebrow">Meet your movie partner</div>
        <h2 style="margin-top:20px">Who is choosing tonight?</h2>
        <p>
          You will answer on the same device. The first person’s answers stay hidden from the second.
        </p>
        <label class="input-label" for="name-one">First person</label>
        <input
          class="field"
          id="name-one"
          name="first"
          placeholder="For example, Alex"
          maxlength="24"
          required
          autocomplete="off"
        />
        <label class="input-label" for="name-two">Second person</label>
        <input
          class="field"
          id="name-two"
          name="second"
          placeholder="For example, Sam"
          maxlength="24"
          required
          autocomplete="off"
        />
        <p id="names-error" class="form-error" role="alert"></p>
        <button class="button primary" type="submit" style="margin-top:20px">
          Find a match ↗
        </button>
      </form>
    `;
    getElement('#names-form').onsubmit = (e) => {
      e.preventDefault();
      const names = [getElement('#name-one').value.trim(), getElement('#name-two').value.trim()];
      if (names.some((n) => !n)) {
        getElement('#names-error').textContent =
          'Enter a name or short nickname for each person.';
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
    const q = questions[quizState.step],
      answer = quizState.answers[quizState.person][q.key];
    getElement('#quiz-panel').innerHTML = `${
      duo
        ? /* HTML */ `
            <div class="duo-badge">Your turn, ${escapeHtml(quizState.names[quizState.person])}</div>
          `
        : ''
    }<div class="step-label"><span>${duo ? 'Person ' + (quizState.person + 1) + ' of 2' : 'Your movie profile'}</span><span>Question ${quizState.step + 1} / 4</span></div><div class="progress-track" aria-label="Progress: ${quizState.step + 1} of 4"><div class="progress-fill" style="width:${(quizState.step + 1) * 25}%"></div></div><h2 class="question-title">${q.title}</h2><p class="question-hint">${q.hint}</p><div class="option-grid" role="group" aria-label="Answer options">${q.options
      .map(
        ([value, icon, name, sub]) => /* HTML */ `
          <button
            class="option ${answer === value ? 'selected' : ''}"
            data-answer="${value}"
            aria-pressed="${answer === value}"
          >
            <span class="option-icon" aria-hidden="true">${icon}</span>
            <span>
              <strong>${name}</strong>
              <small>${sub}</small>
            </span>
          </button>
        `,
      )
      .join(
        '',
      )}</div><div class="question-nav"><button class="text-button" id="previous" ${quizState.step === 0 ? 'disabled' : ''}>← Back</button><button class="button primary" id="next" ${!answer ? 'disabled' : ''}>${quizState.step < 3 ? 'Next →' : duo && quizState.person === 0 ? 'Pass the device →' : 'Show movies ↗'}</button></div>`;
    getElements('[data-answer]').forEach(
      (el) =>
        (el.onclick = () => {
          quizState.answers[quizState.person][q.key] = el.dataset.answer;
          getElements('[data-answer]').forEach((b) => {
            const chosen = b === el;
            b.classList.toggle('selected', chosen);
            b.setAttribute('aria-pressed', String(chosen));
          });
          getElement('#next').disabled = false;
        }),
    );
    getElement('#previous').onclick = () => {
      if (quizState.step > 0) {
        quizState.step--;
        renderQuestion(duo);
      }
    };
    getElement('#next').onclick = () => {
      if (!quizState.answers[quizState.person][q.key]) return;
      if (quizState.step < 3) {
        quizState.step++;
        renderQuestion(duo);
      } else if (duo && quizState.person === 0) {
        getElement('#quiz-panel').innerHTML = /* HTML */ `
          <div class="empty" style="border:0">
            <div class="empty-symbol">♡</div>
            <h2>${escapeHtml(quizState.names[0])}, your answers are in.</h2>
            <p>
              Pass the device to «${escapeHtml(quizState.names[1])}».
              <br />
              It is their turn to choose a mood.
            </p>
            <button id="second-person" class="button primary">
              I’m ${escapeHtml(quizState.names[1])}, let’s start →
            </button>
          </div>
        `;
        getElement('#second-person').onclick = () => {
          quizState.person = 1;
          quizState.step = 0;
          renderQuestion(true);
        };
      } else showResults(duo);
    };
    animatePanel();
  }
  function resultCard(m, reason, badge) {
    return /* HTML */ `
      <div class="col-md-4">
        <article class="result-card">
          <button
            class="poster-button"
            style="aspect-ratio:3/2;border-radius:0"
            data-detail="${m.id}"
            aria-label="Details: ${escapeHtml(m.title)}"
          >
            <img
              src="${m.poster}"
              alt="Movie poster: «${escapeHtml(m.title)}»"
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
              <a class="button primary small" href="evening.html?film=${m.id}">Plan movie night ↗</a>
              <button class="button secondary small" data-save="${m.id}">+ My list</button>
            </div>
          </div>
        </article>
      </div>
    `;
  }
  function showResults(duo) {
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
        duo ? 'Your movie night together' : 'Your results',
        duo
          ? `${escapeHtml(quizState.names[0])} + ${escapeHtml(quizState.names[1])}`
          : 'This could be your next favorite.',
        duo
          ? exact
            ? 'We found an exact match for both of your preferences.'
            : 'These are compromise picks. They respect both time and intensity limits and match your tastes as closely as the catalog allows.'
          : exact
            ? 'These movies match all your preferences.'
            : 'Every pick fits your time and intensity limits. Some are close alternatives for your mood or genre.',
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
                        ${movieEngine.reasons(m, quizState.answers[0]).map(escapeHtml).join(', ')}.
                        <br />
                        <strong>${escapeHtml(quizState.names[1])}:</strong>
                        ${movieEngine.reasons(m, quizState.answers[1]).map(escapeHtml).join(', ')}.
                      `;
                    } else
                      reason = movieEngine
                        .reasons(m, quizState.answers[0])
                        .map(escapeHtml)
                        .join(' · ');
                    return resultCard(
                      m,
                      reason,
                      duo
                        ? isExact
                          ? 'Exact match'
                          : 'Shared pick'
                        : i === 0
                          ? 'Start here'
                          : 'Another story',
                    );
                  })
                  .join('')
              : '<div class="col-12"><div class="empty"><h2>No movie fits all your limits yet</h2><p>Try allowing more time or adjusting your intensity limit.</p></div></div>'}
          </div>
          <button id="restart" class="button secondary" style="margin-top:30px">
            ↻ Try again
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
        'Your movie night starts here',
        'The movie is just the beginning.',
        'Pick a story and we will add a snack, set the mood and make a simple plan. All you need to do is press play.',
      ) +
      /* HTML */ `
        <section class="workspace container">
          <div class="row g-4">
            <div class="col-lg-4">
              <form class="panel" id="evening-form">
                <h2 class="aside-title">Your movie night</h2>
                <label class="input-label" for="evening-film">What are we watching?</label>
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
                <label class="input-label" for="people">How many people?</label>
                <select class="field" id="people" name="people">
                  <option value="1">One person</option>
                  <option value="2">Two people</option>
                  <option value="3">Three people</option>
                  <option value="4">Four people</option>
                </select>
                <label class="input-label" for="snack">What are you craving?</label>
                <select class="field" id="snack" name="snack">
                  <option value="salty">Something savory</option>
                  <option value="sweet">Something sweet</option>
                  <option value="fresh">Fresh fruit</option>
                </select>
                <label class="input-label" for="start-time">When does prep start?</label>
                <input
                  class="field"
                  id="start-time"
                  name="start"
                  type="time"
                  value="20:00"
                  required
                />
                <button class="button primary" type="submit" style="width:100%;margin-top:25px">
                  Plan my evening ↗
                </button>
                <p class="fineprint" style="margin:17px 0 0">
                  15 minutes to get ready, then the movie. Times follow your local clock.
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
        ? 'Your kit is saved in this browser.'
        : 'Your kit is ready, but could not be saved in this browser.';
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
            <div class="eyebrow">Tonight’s starring role</div>
            <h3 style="margin-top:15px">${escapeHtml(m.title)}</h3>
            <p>${meta(m)}</p>
            <p>${escapeHtml(m.description)}</p>
            ${watchLink(m, true)}
          </div>
        </div>
        <div class="empty" style="margin-top:25px">
          <div class="empty-symbol">◒</div>
          <h2>Make the evening your own?</h2>
          <p>Choose your company, snack and start time. We will bring it all together.</p>
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
      snack = 'Berry yogurt cups';
      ingredients = [
        `${n * 150} g plain yogurt`,
        `${n * 80} g berries`,
        `${n * 25} g granola`,
      ];
      instruction = 'Layer yogurt, berries and granola in a glass. Sweeten to taste.';
    } else if (kit.snack === 'fresh') {
      snack = 'Fresh fruit platter';
      ingredients = [`Apples: ${n}`, `Bananas: ${n}`, `${n * 100} g grapes`];
      instruction = 'Wash the fruit, cut into bite-sized pieces and serve on small plates.';
    } else {
      snack = 'Paprika popcorn';
      ingredients = [
        `${n * 35} g popcorn kernels`,
        `${n} tsp vegetable oil`,
        'Salt and paprika to taste',
      ];
      instruction =
        'Make the popcorn according to the package instructions. Season with salt and paprika.';
    }
    const atmos = m.moods.includes('tense')
      ? [
          'Your home cinema',
          'Dim the overhead lights and leave a soft light to one side. Silence notifications so you catch every clue.',
        ]
      : m.moods.includes('warm')
        ? [
            'Warm light and a cozy blanket',
            'Turn on a warm lamp, get comfortable and keep your favorite drink nearby.',
          ]
        : m.moods.includes('wonder')
          ? [
              'A little adventure',
              'Soften the lights, check the sound and give the story your full attention.',
            ]
          : [
              'Easy and relaxed',
              'Soft light, comfortable seats and individual snack bowls. Just settle in and relax.',
            ];
    const checklist = [
      ...ingredients,
      'Get water or drinks ready',
      'Set up the lights and sound',
      'Silence notifications',
    ];
    const checked = Array.isArray(kit.checked) ? kit.checked : [];
    getElement('#evening-output').innerHTML = /* HTML */ `
      <div class="panel">
        <div class="evening-card">
          <img src="${m.poster}" alt="${escapeHtml(m.title)}" width="115" height="172" />
          <div>
            <div class="eyebrow">Your movie night kit</div>
            <h3 style="margin-top:15px">${escapeHtml(m.title)}</h3>
            <p>${meta(m)}</p>
            <div class="result-actions">
              <button class="button secondary small" data-save="${m.id}">+ My list</button>
              ${watchLink(m, true)}
            </div>
          </div>
        </div>
        <div class="kit-block">
          <h3>
            <span aria-hidden="true">◒</span>
            ${snack}
          </h3>
          <p>Serves ${['', 'one', 'two', 'three', 'four'][n]}. ${instruction}</p>
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
            Adjust the ingredients and quantities to suit your preferences.
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
            A plan with time to unwind
          </h3>
          <ol class="timeline">
            <li>
              <time>${movieEngine.clock(kit.start, 0)}</time>
              <span>Prepare your snack and settle in</span>
            </li>
            <li>
              <time>${movieEngine.clock(kit.start, 15)}</time>
              <span>Start watching «${escapeHtml(m.title)}»</span>
            </li>
            <li>
              <time>${movieEngine.clock(kit.start, 15 + m.minutes)}</time>
              <span>Credits roll. What was your favorite moment?</span>
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
        'Your collection',
        'Keep good movies close.',
        'Save your discoveries, mark what you have watched and add your ratings. Your list lives only in this browser.',
      ) +
      /* HTML */ `
        <section class="workspace container">
          <div id="list-stats"></div>
          <div class="filters">
            ${[
              ['all', 'All movies'],
              ['watch', 'Want to watch'],
              ['watched', 'Watched'],
            ]
              .map(
                ([id, t]) => /* HTML */ `
                  <button
                    class="chip ${id === 'all' ? 'active' : ''}"
                    data-list-filter="${id}"
                    aria-pressed="${id === 'all'}"
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
          <span>In your collection</span>
        </div>
        <div class="stat">
          <b>${all.length - viewed.length}</b>
          <span>Waiting for movie night</span>
        </div>
        <div class="stat">
          <b>${viewed.length}</b>
          <span>Already watched</span>
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
                  data-detail="${m.id}"
                  style="width:auto;flex-shrink:0;border-radius:6px"
                  aria-label="Details: ${escapeHtml(m.title)}"
                >
                  <img src="${m.poster}" alt="${escapeHtml(m.title)}" width="80" height="120" />
                </button>
                <div class="list-item-main">
                  <h3>${escapeHtml(m.title)}</h3>
                  <p>${meta(m)}</p>
                  <div class="list-controls">
                    <label class="list-label">
                      Status
                      <select data-status="${m.id}" aria-label="Status: ${escapeHtml(m.title)}">
                        <option value="watch" ${item.status === 'watch' ? 'selected' : ''}>
                          Want to watch
                        </option>
                        <option value="watched" ${item.status === 'watched' ? 'selected' : ''}>
                          Watched
                        </option>
                      </select>
                    </label>
                    ${item.status === 'watched'
                      ? /* HTML */ `
                          <label class="list-label">
                            My rating
                            <select
                              data-rating="${m.id}"
                              aria-label="My rating: ${escapeHtml(m.title)}"
                            >
                              <option value="0">Not rated</option>
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
                      Movie night ↗
                    </a>
                  </div>
                </div>
                <button
                  class="text-button"
                  data-remove="${m.id}"
                  aria-label="Remove from my list: ${escapeHtml(m.title)}"
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
                ? 'This part of your list is empty'
                : 'Your next story is waiting'}
            </h2>
            <p>
              ${all.length
                ? 'Change the filter or update a saved movie’s status.'
                : 'Tap “+” on a movie card to save it here.'}
            </p>
            <a class="button primary" href="index.html#catalog">Choose a movie ↗</a>
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
          if (persist()) toast('Rating saved');
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
    dialog.innerHTML = /* HTML */ `
      <button class="dialog-close" aria-label="Close details">×</button>
      <div class="dialog-content">
        <div class="row g-4">
          <div class="col-md-4">
            <img
              class="dialog-poster"
              src="${m.poster}"
              alt="Movie poster: «${escapeHtml(m.title)}»"
              width="400"
              height="600"
            />
          </div>
          <div class="col-md-8">
            <div class="eyebrow">The story, without spoilers</div>
            <h2 id="dialog-title" style="margin:16px 0 6px">${escapeHtml(m.title)}</h2>
            <p class="movie-meta">${escapeHtml(m.en)} · ${m.year} · ${m.minutes} min</p>
            <p class="dialog-description">${escapeHtml(m.description)}</p>
            <p class="movie-tag">
              ${m.genres.map((g) => escapeHtml(movieEngine.genres[g])).join(' / ')}
            </p>
            <p class="fineprint">
              Intensity: ${['', 'gentle', 'moderate', 'high'][m.intensity]}. Check the age
              rating on your viewing service.
            </p>
            <div class="result-actions">
              <a href="evening.html?film=${m.id}" class="button primary">Plan movie night ↗</a>
              <button class="button secondary" data-save="${m.id}">+ My list</button>
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
  shell();
  if (!movies.length) {
    getElement('#main').innerHTML =
      '<div class="empty"><h1>Could not load the catalog</h1><p>Refresh the page or check that the assets folder is beside the HTML files.</p></div>';
    return;
  }
  if (page === 'home') home();
  else if (page === 'quiz') questionnaire(false);
  else if (page === 'duo') questionnaire(true);
  else if (page === 'evening') evening();
  else if (page === 'list') list();
  updateCount();
  if (storageWarning) toast('Saved data is unavailable. You can start a new list.');
})();
