const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Isolated browser-API checks: no DOM library or extra dependencies are needed.
async function checkEnhancements() {
  const source = fs.readFileSync(path.join(__dirname, 'assets/enhancements.js'), 'utf8');
  function createSession({
    savedTheme,
    blockedStorage = false,
    deniedClipboard = false,
    reducedMotion = false,
  } = {}) {
    const values = new Map(savedTheme ? [['plottwist:theme', savedTheme]] : []);
    const messages = [];
    const writes = [];
    const frames = new Map();
    const observers = [];
    const listeners = {};
    const elements = new Map();
    let frameId = 0;
    let now = 0;
    const element = () => ({
      dataset: {},
      style: { setProperty() {} },
      attributes: {},
      textContent: '',
      isConnected: true,
      classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
      setAttribute(key, value) {
        this.attributes[key] = value;
      },
      removeAttribute(key) {
        delete this.attributes[key];
      },
      querySelector: () => ({ textContent: '' }),
      getBoundingClientRect: () => ({ top: 1000, height: 120 }),
    });
    const html = { ...element(), scrollHeight: 3000 };
    const header = element();
    const counter = { ...element(), dataset: { count: '24' }, textContent: '24' };
    const sections = ['catalog', 'together-preview', 'questions'].map((id) => ({
      ...element(),
      id,
    }));
    sections.forEach((section) => elements.set(section.id, section));
    const links = sections.map((section) => ({
      ...element(),
      dataset: { sectionLink: section.id },
    }));
    elements.set('site-header', header);
    elements.set('theme-toggle', element());
    elements.set('meta', element());
    const sandbox = {
      document: {
        documentElement: html,
        querySelector: (selector) =>
          selector.startsWith('meta')
            ? elements.get('meta')
            : elements.get(selector.slice(1)) || null,
        querySelectorAll: (selector) =>
          selector === '[data-section-link]' ? links : selector === '[data-count]' ? [counter] : [],
        getElementById: (id) => elements.get(id),
        createElement: () => element(),
        body: { append: (button) => elements.set(button.id, button) },
        addEventListener: (name, callback) => (listeners[name] = callback),
      },
      matchMedia: () => ({ matches: reducedMotion, addEventListener() {} }),
      localStorage: {
        getItem: (key) => {
          if (blockedStorage) throw new Error('blocked');
          return values.get(key) || null;
        },
        setItem: (key, value) => {
          if (blockedStorage) throw new Error('blocked');
          values.set(key, value);
        },
      },
      navigator: {
        clipboard: {
          writeText: async (text) => {
            if (deniedClipboard) throw new Error('denied');
            writes.push(text);
          },
        },
      },
      innerHeight: 800,
      scrollY: 0,
      performance: { now: () => now },
      requestAnimationFrame: (callback) => {
        frames.set(++frameId, callback);
        return frameId;
      },
      cancelAnimationFrame: (id) => frames.delete(id),
      IntersectionObserver: class {
        constructor(callback) {
          this.callback = callback;
          this.observed = [];
          observers.push(this);
        }
        disconnect() {
          this.observed = [];
        }
        observe(target) {
          this.observed.push(target);
        }
        unobserve(target) {
          this.observed = this.observed.filter((item) => item !== target);
        }
      },
      window: { addEventListener: (name, callback) => (listeners[name] = callback), scrollTo() {} },
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    const api = sandbox.PlotEnhancements;
    api.init({ t: (key) => key, toast: (message) => messages.push(message) });
    const tick = (time) => {
      now = time;
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(time));
    };
    return {
      api,
      html,
      values,
      messages,
      writes,
      elements,
      observers,
      counter,
      links,
      sandbox,
      listeners,
      tick,
    };
  }
  const session = createSession();
  assert.equal(session.html.dataset.theme, 'dark');
  session.api.toggleTheme();
  assert.equal(session.values.get('plottwist:theme'), 'light');
  assert.equal(session.elements.get('theme-toggle').attributes['aria-pressed'], 'true');
  assert.equal(session.elements.get('meta').content, '#faf4ec');
  assert.equal(
    createSession({ savedTheme: session.values.get('plottwist:theme') }).api.theme,
    'light',
  );
  assert.equal(createSession({ savedTheme: 'invalid' }).api.theme, 'dark');
  const blocked = createSession({ blockedStorage: true });
  blocked.api.toggleTheme();
  assert.equal(blocked.api.theme, 'light');
  assert.equal(blocked.messages.at(-1), 'theme.session');
  assert.equal(await session.api.copy('A movie night\n23:50 → 00:05 (+1 day)'), true);
  assert.equal(session.writes[0], 'A movie night\n23:50 → 00:05 (+1 day)');
  assert.equal(session.messages.at(-1), 'copy.success');
  const denied = createSession({ deniedClipboard: true });
  assert.equal(await denied.api.copy('Plan'), false);
  assert.equal(denied.messages.at(-1), 'copy.error');
  session.api.refresh();
  session.tick(0);
  assert.equal(session.elements.get('back-to-top').hidden, true);
  const counterObserver = session.observers.find((observer) =>
    observer.observed.includes(session.counter),
  );
  assert.ok(counterObserver, 'Counters must wait for viewport intersection');
  counterObserver.callback([{ isIntersecting: true, target: session.counter }]);
  session.tick(325);
  assert.ok(Number(session.counter.textContent) > 0 && Number(session.counter.textContent) < 24);
  session.tick(700);
  assert.equal(session.counter.textContent, '24');
  session.sandbox.scrollY = 2200;
  session.listeners.scroll();
  session.tick(800);
  assert.equal(session.elements.get('back-to-top').hidden, false);
  assert.equal(session.links.at(-1).attributes['aria-current'], 'location');
  const reduced = createSession({ reducedMotion: true });
  reduced.api.refresh();
  assert.equal(reduced.counter.textContent, '24');
  assert.equal(reduced.observers.length, 0, 'Reduced motion bypasses observer animations');
}
module.exports = checkEnhancements;
if (require.main === module)
  checkEnhancements()
    .then(() =>
      console.log(
        'PASS: theme persistence/failure, clipboard success/denial, scroll navigation, animated counters and reduced motion.',
      ),
    )
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
