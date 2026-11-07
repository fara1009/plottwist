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
      toast('Браузер не разрешил сохранение. Изменения доступны до закрытия страницы.');
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
        (saved ? 'Убрать из списка: ' : 'Добавить в список: ') +
          (movies.find((m) => m.id === el.dataset.save)?.title || ''),
      );
      if (el.classList.contains('save-button')) el.textContent = saved ? '✓' : '+';
      else el.textContent = saved ? '✓ В моём списке' : '+ В мой список';
    });
  }
  function toggleSave(id) {
    if (!movies.some((m) => m.id === id)) return;
    if (state.list[id]) {
      delete state.list[id];
      if (persist()) toast('Фильм убран из списка');
    } else {
      state.list[id] = { status: 'watch', rating: 0 };
      if (persist()) toast('Добавлено в твой список');
    }
    updateCount();
    if (page === 'list') renderList();
  }
  const page = document.body.dataset.page;
  const links = [
    ['home', 'index.html', 'Главная'],
    ['quiz', 'quiz.html', 'Квиз'],
    ['duo', 'together.html', 'Выбираем вдвоём'],
    ['evening', 'evening.html', 'Киновечер'],
    ['list', 'my-list.html', 'Мой список'],
  ];
  // 2. Общие шапка и подвал на всех пяти страницах.
  function shell() {
    getElement('#site-header').innerHTML = /* HTML */ `
      <div class="container header-inner">
        <a class="brand" href="index.html" aria-label="PlotTwist — главная">
          <span class="brand-symbol" aria-hidden="true">››</span>
          plot
          <span>twist.</span>
        </a>
        <button class="menu-button" aria-expanded="false" aria-controls="navigation">
          Меню ☰
        </button>
        <nav class="navigation" id="navigation" aria-label="Основная навигация">
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
        <p>Меньше выбирать. Больше смотреть.</p>
        <p>© ${new Date().getFullYear()} PlotTwist · Учебный проект</p>
        <a class="footer-link" href="assets/SOURCES.md">Источники постеров и данных ↗</a>
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
    return `${m.year} <span aria-hidden="true">·</span> ${m.minutes} мин <span aria-hidden="true">·</span> ${escapeHtml(movieEngine.genres[m.genres[0]])}`;
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
        Смотреть на Rezka ↗
        <span class="visually-hidden">(откроется в новой вкладке)</span>
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
          aria-label="Добавить в список: ${escapeHtml(m.title)}"
        >
          +
        </button>
        <button
          class="poster-button"
          data-detail="${m.id}"
          aria-label="Подробнее: ${escapeHtml(m.title)}"
        >
          <img
            src="${m.poster}"
            alt="Постер фильма «${escapeHtml(m.title)}»"
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
            <div class="eyebrow">Для вечеров, которые запомнятся</div>
            <h1>
              Не знаешь,
              <br />
              что посмотреть?
              <br />
              <em>Вот это поворот.</em>
            </h1>
            <p>
              Найдём фильм под твоё настроение.
              <br />
              В одиночку, вдвоём — и без вечного скролла.
            </p>
            <div class="hero-actions">
              <a href="quiz.html" class="button primary">
                Найти свой фильм
                <span aria-hidden="true">↗</span>
              </a>
              <a href="together.html" class="button secondary">
                Выбираем вдвоём
                <span aria-hidden="true">♡</span>
              </a>
            </div>
            <div class="hero-note">
              <span class="avatars" aria-hidden="true">
                <span>☺</span>
                <span>✦</span>
                <span>☻</span>
              </span>
              <span>4 вопроса. 1 хороший вечер.</span>
            </div>
          </div>
          <div class="col-lg-6">
            <div class="hero-cinema" aria-label="Вдохновение для киновечера">
              ${featured
                .map(
                  (m) => /* HTML */ `
                    <a
                      class="hero-film"
                      href="evening.html?film=${m.id}"
                      aria-label="Киновечер с фильмом «${escapeHtml(m.title)}»"
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
              <span class="cinema-note">✦ Твой следующий любимый фильм где-то здесь</span>
            </div>
          </div>
        </div>
      </section>
      <div class="container">
        <div class="feature-strip">
          <a href="quiz.html">
            <b>✦</b>
            Квиз по настроению
          </a>
          <a href="together.html">
            <b>♡</b>
            Совпадение для двоих
          </a>
          <a href="evening.html">
            <b>◒</b>
            Готовый вечерний набор
          </a>
          <a href="my-list.html">
            <b>＋</b>
            Твоя коллекция
          </a>
        </div>
      </div>
      <section class="section container" id="catalog">
        <div class="section-head">
          <div>
            <div class="eyebrow">Выбрали для тебя</div>
            <h2>Истории, в которые хочется попасть</h2>
          </div>
          <label class="search-box">
            <span class="visually-hidden">Поиск фильма</span>
            <input id="movie-search" type="search" placeholder="Найти фильм…" autocomplete="off" />
          </label>
        </div>
        <div class="filters" aria-label="Фильтр по настроению">
          ${[
            ['all', 'Всё кино'],
            ['light', 'Легко и весело'],
            ['wonder', 'Удивиться'],
            ['tense', 'Поймать интригу'],
            ['warm', 'Согреться'],
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
            <div class="eyebrow" style="margin-bottom:13px">Два вкуса. Один фильм.</div>
            <h2>«Мне всё равно» больше не вариант.</h2>
            <p>Ответьте по очереди — найдём историю, которая подойдёт обоим.</p>
          </div>
          <a class="button primary" href="together.html">Найти совпадение ↗</a>
        </div>
      </section>
      <section class="container curated">
        <div class="section-head"><h2>Перед началом сеанса</h2></div>
        ${[
          [
            'Это онлайн-кинотеатр?',
            'PlotTwist помогает выбрать фильм и спланировать вечер. Смотреть фильм нужно в доступном тебе кинотеатре или стриминговом сервисе.',
          ],
          [
            'Как работает подбор?',
            'Сравниваем настроение, жанр, свободное время и эмоциональную нагрузку с характеристиками фильмов. В результатах показываем причины выбора.',
          ],
          [
            'Где хранится мой список?',
            'В этом браузере на этом устройстве. Аккаунт не нужен. Очистка данных браузера удалит сохранённый список.',
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
    const query = getElement('#movie-search').value.trim().toLocaleLowerCase('ru');
    const filtered = movies.filter(
      (m) =>
        (homeFilter === 'all' || m.moods.includes(homeFilter)) &&
        `${m.title} ${m.en} ${m.year}`.toLocaleLowerCase('ru').includes(query),
    );
    getElement('#catalog-status').textContent = `В подборке: ${filtered.length}`;
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
              <h2>Пока ничего не нашлось</h2>
              <p>Попробуй другое название или настроение.</p>
              <button class="button secondary" id="reset-search">Сбросить фильтры</button>
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
      title: 'Какой у тебя сегодня настрой?',
      hint: 'Выбери ощущение, с которым хочется провести вечер.',
      options: [
        ['light', '☀', 'Легко и весело', 'Хочу отвлечься и улыбнуться'],
        ['wonder', '✦', 'Хочется удивиться', 'Новые миры и необычные идеи'],
        ['tense', '◉', 'Нужна интрига', 'Хочу строить догадки'],
        ['warm', '♡', 'Немного тепла', 'Добрые и человечные истории'],
      ],
    },
    {
      key: 'genre',
      title: 'К какому жанру тянет?',
      hint: 'Выбери один любимый или доверься настроению.',
      options: [
        ['comedy', '☺', 'Комедия', 'С юмором и характером'],
        ['scifi', '⌁', 'Фантастика', 'За пределами привычного'],
        ['thriller', '◇', 'Триллер', 'Загадка до самого конца'],
        ['animation', '✿', 'Анимация', 'Истории без возрастных границ'],
        ['romance', '♡', 'Романтика', 'О встречах и чувствах'],
        ['any', '✦', 'Удивите меня', 'Открыт любым жанрам'],
      ],
    },
    {
      key: 'duration',
      title: 'Сколько времени есть на фильм?',
      hint: 'Длительность — обязательное условие подбора.',
      options: [
        ['100', '◷', 'До 100 минут', 'Успеть до сна'],
        ['125', '◴', 'До 125 минут', 'Классический киновечер'],
        ['any', '∞', 'Время не ограничено', 'Готов погрузиться в историю'],
      ],
    },
    {
      key: 'intensity',
      title: 'Сколько эмоций тебе комфортно?',
      hint: 'Это условная нагрузка сюжета, а не возрастной рейтинг.',
      options: [
        ['1', '☁', 'Максимально спокойно', 'Без тяжёлых переживаний'],
        ['2', '≈', 'Умеренно', 'Можно немного поволноваться'],
        ['any', 'ϟ', 'Готов к сильным эмоциям', 'Можно и напряжённую историю'],
      ],
    },
  ];
  let quizState = { step: 0, person: 0, answers: [{}, {}], names: ['', ''] };
  function questionnaire(duo) {
    getElement('#main').innerHTML =
      title(
        duo ? 'Совпадение для двоих' : 'Кино под настроение',
        duo ? 'Два человека. Одна история.' : 'Что посмотрим сегодня?',
        duo
          ? 'Ответьте по очереди на четыре вопроса. Мы учтём вкусы обоих и найдём общий вариант.'
          : 'Никаких бесконечных подборок. Четыре вопроса — и до трёх фильмов с объяснением выбора.',
      ) +
      /* HTML */ `
        <section class="workspace container">
          <div class="row g-4">
            <div class="col-lg-8"><div class="panel" id="quiz-panel"></div></div>
            <aside class="col-lg-4">
              <div class="panel aside-panel">
                <div class="aside-number">${duo ? '02' : '04'}</div>
                <h2 class="aside-title">
                  ${duo ? 'Вкус каждого важен' : 'Вопроса до хорошего кино'}
                </h2>
                <ul class="aside-list">
                  <li>
                    <b>Настроение прежде жанра</b>
                    Учитываем, чего хочется именно сегодня.
                  </li>
                  <li>
                    <b>Время имеет значение</b>
                    Не предлагаем фильмы длиннее выбранного лимита.
                  </li>
                  <li>
                    <b>Никакой магии</b>
                    Объясняем каждый результат понятными словами.
                  </li>
                </ul>
                <p class="fineprint">
                  Подбор — редакционная рекомендация. Проверь возрастную маркировку перед
                  просмотром.
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
        <div class="eyebrow">Знакомимся</div>
        <h2 style="margin-top:20px">Кто сегодня выбирает кино?</h2>
        <p>
          Вы будете отвечать на одном устройстве. Ответы первого участника не показываются второму.
        </p>
        <label class="input-label" for="name-one">Первый участник</label>
        <input
          class="field"
          id="name-one"
          name="first"
          placeholder="Например, Алина"
          maxlength="24"
          required
          autocomplete="off"
        />
        <label class="input-label" for="name-two">Второй участник</label>
        <input
          class="field"
          id="name-two"
          name="second"
          placeholder="Например, Дамир"
          maxlength="24"
          required
          autocomplete="off"
        />
        <p id="names-error" class="form-error" role="alert"></p>
        <button class="button primary" type="submit" style="margin-top:20px">
          Начать подбор ↗
        </button>
      </form>
    `;
    getElement('#names-form').onsubmit = (e) => {
      e.preventDefault();
      const names = [getElement('#name-one').value.trim(), getElement('#name-two').value.trim()];
      if (names.some((n) => !n)) {
        getElement('#names-error').textContent =
          'Введите имя или короткий псевдоним каждого участника.';
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
            <div class="duo-badge">Отвечает ${escapeHtml(quizState.names[quizState.person])}</div>
          `
        : ''
    }<div class="step-label"><span>${duo ? 'Участник ' + (quizState.person + 1) + ' из 2' : 'Твой кинопрофиль'}</span><span>Вопрос ${quizState.step + 1} / 4</span></div><div class="progress-track" aria-label="Прогресс: ${quizState.step + 1} из 4"><div class="progress-fill" style="width:${(quizState.step + 1) * 25}%"></div></div><h2 class="question-title">${q.title}</h2><p class="question-hint">${q.hint}</p><div class="option-grid" role="group" aria-label="Варианты ответа">${q.options
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
      )}</div><div class="question-nav"><button class="text-button" id="previous" ${quizState.step === 0 ? 'disabled' : ''}>← Назад</button><button class="button primary" id="next" ${!answer ? 'disabled' : ''}>${quizState.step < 3 ? 'Дальше →' : duo && quizState.person === 0 ? 'Передать устройство →' : 'Показать фильмы ↗'}</button></div>`;
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
            <h2>${escapeHtml(quizState.names[0])}, ответы приняты.</h2>
            <p>
              Передай устройство участнику «${escapeHtml(quizState.names[1])}».
              <br />
              Теперь его очередь выбрать настроение.
            </p>
            <button id="second-person" class="button primary">
              Я ${escapeHtml(quizState.names[1])}, начинаем →
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
            aria-label="Подробнее: ${escapeHtml(m.title)}"
          >
            <img
              src="${m.poster}"
              alt="Постер фильма «${escapeHtml(m.title)}»"
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
              <a class="button primary small" href="evening.html?film=${m.id}">Собрать вечер ↗</a>
              <button class="button secondary small" data-save="${m.id}">+ В мой список</button>
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
        duo ? 'Ваш общий киновечер' : 'Твой результат',
        duo
          ? `${escapeHtml(quizState.names[0])} + ${escapeHtml(quizState.names[1])}`
          : 'Кажется, это твоё кино.',
        duo
          ? exact
            ? 'Нашлось точное совпадение по вашим предпочтениям.'
            : 'Это варианты для компромисса: время и допустимая нагрузка соблюдены, вкусы учтены настолько, насколько позволяет подборка.'
          : exact
            ? 'Подходят по всем выбранным условиям.'
            : 'Учли время и комфортную нагрузку. По настроению или жанру некоторые варианты могут быть близкими альтернативами.',
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
                          ? 'Точное совпадение'
                          : 'Общий вариант'
                        : i === 0
                          ? 'Начни с этого'
                          : 'Ещё одна история',
                    );
                  })
                  .join('')
              : '<div class="col-12"><div class="empty"><h2>Пока нет фильма под все ограничения</h2><p>Попробуйте увеличить время или изменить допустимую нагрузку.</p></div></div>'}
          </div>
          <button id="restart" class="button secondary" style="margin-top:30px">
            ↻ Пройти ещё раз
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
        'Сеанс начинается здесь',
        'Фильм — только начало вечера.',
        'Выбери историю, а мы соберём к ней закуску, атмосферу и небольшой план. Всё, чтобы просто нажать «play».',
      ) +
      /* HTML */ `
        <section class="workspace container">
          <div class="row g-4">
            <div class="col-lg-4">
              <form class="panel" id="evening-form">
                <h2 class="aside-title">Твой киновечер</h2>
                <label class="input-label" for="evening-film">Что смотрим?</label>
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
                <label class="input-label" for="people">Сколько вас?</label>
                <select class="field" id="people" name="people">
                  <option value="1">Один человек</option>
                  <option value="2">Двое</option>
                  <option value="3">Трое</option>
                  <option value="4">Четверо</option>
                </select>
                <label class="input-label" for="snack">Что хочется к фильму?</label>
                <select class="field" id="snack" name="snack">
                  <option value="salty">Что-нибудь солёное</option>
                  <option value="sweet">Что-нибудь сладкое</option>
                  <option value="fresh">Фрукты и свежесть</option>
                </select>
                <label class="input-label" for="start-time">Когда начинаем готовиться?</label>
                <input
                  class="field"
                  id="start-time"
                  name="start"
                  type="time"
                  value="20:00"
                  required
                />
                <button class="button primary" type="submit" style="width:100%;margin-top:25px">
                  Собрать мой вечер ↗
                </button>
                <p class="fineprint" style="margin:17px 0 0">
                  15 минут на подготовку, затем фильм. Время указано по твоим часам.
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
        ? 'Набор сохранён в этом браузере.'
        : 'Набор собран. Сохранить в этом браузере не удалось.';
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
            <div class="eyebrow">Сегодня в главной роли</div>
            <h3 style="margin-top:15px">${escapeHtml(m.title)}</h3>
            <p>${meta(m)}</p>
            <p>${escapeHtml(m.description)}</p>
            ${watchLink(m, true)}
          </div>
        </div>
        <div class="empty" style="margin-top:25px">
          <div class="empty-symbol">◒</div>
          <h2>Добавим вечеру деталей?</h2>
          <p>Укажи компанию, закуску и время — соберём всё в одном месте.</p>
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
      snack = 'Йогуртовые стаканчики с ягодами';
      ingredients = [
        `${n * 150} г натурального йогурта`,
        `${n * 80} г ягод`,
        `${n * 25} г гранолы`,
      ];
      instruction = 'Выложи в стакан слоями йогурт, ягоды и гранолу. Сладость добавь по вкусу.';
    } else if (kit.snack === 'fresh') {
      snack = 'Фруктовая тарелка';
      ingredients = [`Яблоки: ${n} шт.`, `Бананы: ${n} шт.`, `${n * 100} г винограда`];
      instruction = 'Вымой фрукты, нарежь удобными кусочками и разложи по небольшим тарелкам.';
    } else {
      snack = 'Попкорн с паприкой';
      ingredients = [
        `${n * 35} г зёрен для попкорна`,
        `${n} ч. л. растительного масла`,
        'Соль и паприка по вкусу',
      ];
      instruction =
        'Приготовь попкорн по инструкции на упаковке. Готовый попкорн приправь солью и паприкой.';
    }
    const atmos = m.moods.includes('tense')
      ? [
          'Кинотеатр дома',
          'Приглуши верхний свет, оставь мягкий источник света сбоку. Убери уведомления, чтобы не пропустить подсказки.',
        ]
      : m.moods.includes('warm')
        ? [
            'Тёплый свет и мягкий плед',
            'Включи тёплую лампу, устройся поудобнее и оставь под рукой любимый напиток.',
          ]
        : m.moods.includes('wonder')
          ? [
              'Маленькое путешествие',
              'Сделай свет мягче, проверь звук и дай истории всё своё внимание.',
            ]
          : [
              'Легко и непринуждённо',
              'Мягкий свет, удобные места и закуски в отдельных мисках — можно просто расслабиться.',
            ];
    const checklist = [
      ...ingredients,
      'Подготовить воду или напитки',
      'Настроить свет и звук',
      'Отключить уведомления',
    ];
    const checked = Array.isArray(kit.checked) ? kit.checked : [];
    getElement('#evening-output').innerHTML = /* HTML */ `
      <div class="panel">
        <div class="evening-card">
          <img src="${m.poster}" alt="${escapeHtml(m.title)}" width="115" height="172" />
          <div>
            <div class="eyebrow">Твой вечерний набор</div>
            <h3 style="margin-top:15px">${escapeHtml(m.title)}</h3>
            <p>${meta(m)}</p>
            <div class="result-actions">
              <button class="button secondary small" data-save="${m.id}">+ В мой список</button>
              ${watchLink(m, true)}
            </div>
          </div>
        </div>
        <div class="kit-block">
          <h3>
            <span aria-hidden="true">◒</span>
            ${snack}
          </h3>
          <p>На ${['', 'одного', 'двоих', 'троих', 'четверых'][n]}. ${instruction}</p>
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
            Состав и количество можно изменить под свои предпочтения.
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
            Без спешки, по плану
          </h3>
          <ol class="timeline">
            <li>
              <time>${movieEngine.clock(kit.start, 0)}</time>
              <span>Готовим закуску и устраиваемся</span>
            </li>
            <li>
              <time>${movieEngine.clock(kit.start, 15)}</time>
              <span>Начинаем смотреть «${escapeHtml(m.title)}»</span>
            </li>
            <li>
              <time>${movieEngine.clock(kit.start, 15 + m.minutes)}</time>
              <span>Титры. Обсудим любимый момент?</span>
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
        'Твоя коллекция',
        'Хорошее кино не потеряется.',
        'Сохраняй находки, отмечай просмотренное и оставляй свою оценку. Этот список хранится только в твоём браузере.',
      ) +
      /* HTML */ `
        <section class="workspace container">
          <div id="list-stats"></div>
          <div class="filters">
            ${[
              ['all', 'Все фильмы'],
              ['watch', 'Хочу посмотреть'],
              ['watched', 'Просмотрено'],
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
          <span>В коллекции</span>
        </div>
        <div class="stat">
          <b>${all.length - viewed.length}</b>
          <span>Ждут своего вечера</span>
        </div>
        <div class="stat">
          <b>${viewed.length}</b>
          <span>Уже посмотрели</span>
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
                  aria-label="Подробнее: ${escapeHtml(m.title)}"
                >
                  <img src="${m.poster}" alt="${escapeHtml(m.title)}" width="80" height="120" />
                </button>
                <div class="list-item-main">
                  <h3>${escapeHtml(m.title)}</h3>
                  <p>${meta(m)}</p>
                  <div class="list-controls">
                    <label class="list-label">
                      Статус
                      <select data-status="${m.id}" aria-label="Статус: ${escapeHtml(m.title)}">
                        <option value="watch" ${item.status === 'watch' ? 'selected' : ''}>
                          Хочу посмотреть
                        </option>
                        <option value="watched" ${item.status === 'watched' ? 'selected' : ''}>
                          Просмотрено
                        </option>
                      </select>
                    </label>
                    ${item.status === 'watched'
                      ? /* HTML */ `
                          <label class="list-label">
                            Моя оценка
                            <select
                              data-rating="${m.id}"
                              aria-label="Моя оценка: ${escapeHtml(m.title)}"
                            >
                              <option value="0">Без оценки</option>
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
                      Киновечер ↗
                    </a>
                  </div>
                </div>
                <button
                  class="text-button"
                  data-remove="${m.id}"
                  aria-label="Убрать из списка: ${escapeHtml(m.title)}"
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
                ? 'В этой части списка пока пусто'
                : 'Твоя следующая история ещё впереди'}
            </h2>
            <p>
              ${all.length
                ? 'Измени фильтр или отметь статус сохранённого фильма.'
                : 'Нажми «+» на карточке фильма, чтобы сохранить его здесь.'}
            </p>
            <a class="button primary" href="index.html#catalog">Выбрать фильм ↗</a>
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
          if (persist()) toast('Оценка сохранена');
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
      <button class="dialog-close" aria-label="Закрыть подробности">×</button>
      <div class="dialog-content">
        <div class="row g-4">
          <div class="col-md-4">
            <img
              class="dialog-poster"
              src="${m.poster}"
              alt="Постер фильма «${escapeHtml(m.title)}»"
              width="400"
              height="600"
            />
          </div>
          <div class="col-md-8">
            <div class="eyebrow">История без спойлеров</div>
            <h2 id="dialog-title" style="margin:16px 0 6px">${escapeHtml(m.title)}</h2>
            <p class="movie-meta">${escapeHtml(m.en)} · ${m.year} · ${m.minutes} мин</p>
            <p class="dialog-description">${escapeHtml(m.description)}</p>
            <p class="movie-tag">
              ${m.genres.map((g) => escapeHtml(movieEngine.genres[g])).join(' / ')}
            </p>
            <p class="fineprint">
              Нагрузка: ${['', 'лёгкая', 'умеренная', 'высокая'][m.intensity]}. Проверь возрастную
              маркировку в своём сервисе.
            </p>
            <div class="result-actions">
              <a href="evening.html?film=${m.id}" class="button primary">Собрать вечер ↗</a>
              <button class="button secondary" data-save="${m.id}">+ В мой список</button>
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
      '<div class="empty"><h1>Не удалось загрузить подборку</h1><p>Обнови страницу или проверь, что папка assets находится рядом с HTML-файлами.</p></div>';
    return;
  }
  if (page === 'home') home();
  else if (page === 'quiz') questionnaire(false);
  else if (page === 'duo') questionnaire(true);
  else if (page === 'evening') evening();
  else if (page === 'list') list();
  updateCount();
  if (storageWarning) toast('Сохранённые данные недоступны. Можно начать новый список.');
})();
