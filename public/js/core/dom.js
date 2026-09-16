class DOMManager {
  constructor() {
    this._cache = new Map();

    this._selectorCache = new Map();
  }

  get(id) {
    if (!this._cache.has(id)) {
      const element = document.getElementById(id);
      this._cache.set(id, element);
    }
    return this._cache.get(id);
  }

  getAll(selector, cache = false) {
    if (cache) {
      if (!this._selectorCache.has(selector)) {
        this._selectorCache.set(selector, document.querySelectorAll(selector));
      }
      return this._selectorCache.get(selector);
    }
    return document.querySelectorAll(selector);
  }

  query(selector) {
    return document.querySelector(selector);
  }

  clearCache() {
    this._cache.clear();
    this._selectorCache.clear();
  }

  invalidate(id) {
    this._cache.delete(id);
  }

  clearSelectorCache() {
    this._selectorCache.clear();
  }

  exists(id) {
    return !!this.get(id);
  }

  show(idOrElement, hiddenClass = 'hidden') {
    const el = typeof idOrElement === 'string' ? this.get(idOrElement) : idOrElement;
    if (el) {
      el.classList.remove(hiddenClass);
    }
  }

  hide(idOrElement, hiddenClass = 'hidden') {
    const el = typeof idOrElement === 'string' ? this.get(idOrElement) : idOrElement;
    if (el) {
      el.classList.add(hiddenClass);
    }
  }

  toggle(idOrElement, visible, hiddenClass = 'hidden') {
    const el = typeof idOrElement === 'string' ? this.get(idOrElement) : idOrElement;
    if (el) {
      if (typeof visible === 'boolean') {
        el.classList.toggle(hiddenClass, !visible);
      } else {
        el.classList.toggle(hiddenClass);
      }
    }
  }

  setText(id, text) {
    const el = this.get(id);
    if (el) {
      el.textContent = text;
    }
  }

  setHTML(id, html) {
    const el = this.get(id);
    if (el) {
      el.innerHTML = html;
    }
  }

  on(id, event, handler, options) {
    const el = this.get(id);
    if (el) {
      el.addEventListener(event, handler, options);
    }
  }

  off(id, event, handler, options) {
    const el = this.get(id);
    if (el) {
      el.removeEventListener(event, handler, options);
    }
  }

  create(tag, attributes = {}, content = '') {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attributes)) {
      if (key === 'className') {
        el.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else {
        el.setAttribute(key, value);
      }
    }
    if (content) {
      el.textContent = content;
    }
    return el;
  }
}

export const dom = new DOMManager();

export { DOMManager };
