/* JSON-based localization. English is the default; the choice is shared by all pages. */
(function (root) {
  'use strict';
  const supportedLanguages = ['en', 'ru'];
  const storageKey = 'plottwist:language';
  const scriptUrl = new URL(document.currentScript.src);
  const dictionaries = new Map();
  let language = 'en';

  async function loadDictionary(code) {
    if (dictionaries.has(code)) return dictionaries.get(code);
    const url = new URL(`locales/${code}.json`, scriptUrl);
    url.search = scriptUrl.search;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Translation request failed: ${response.status}`);
    const dictionary = await response.json();
    if (
      !dictionary ||
      typeof dictionary !== 'object' ||
      !Object.values(dictionary).every((value) => typeof value === 'string')
    ) {
      throw new Error('Invalid translation dictionary');
    }
    dictionaries.set(code, dictionary);
    return dictionary;
  }

  async function init() {
    let preferred = 'en';
    try {
      preferred = localStorage.getItem(storageKey) || 'en';
    } catch {
      /* Session-only language. */
    }
    await loadDictionary('en');
    if (supportedLanguages.includes(preferred) && preferred !== 'en') {
      await loadDictionary(preferred);
    }
    language = supportedLanguages.includes(preferred) ? preferred : 'en';
  }

  async function setLanguage(code) {
    if (!supportedLanguages.includes(code)) throw new Error('Unsupported language');
    await loadDictionary(code);
    language = code;
    try {
      localStorage.setItem(storageKey, code);
    } catch {
      /* Keep the current page usable. */
    }
  }

  function t(key, values = {}) {
    const template = dictionaries.get(language)?.[key] ?? dictionaries.get('en')?.[key];
    if (template === undefined) throw new Error(`Missing translation: ${key}`);
    return template.replace(/\{(\w+)\}/g, (match, name) =>
      Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match,
    );
  }

  root.PlotI18n = {
    init,
    setLanguage,
    t,
    get language() {
      return language;
    },
  };
})(globalThis);
