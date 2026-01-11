/**
 * DOM Manager - Centralized DOM element caching and utilities
 *
 * Replaces 60+ getElementById calls scattered at module scope with
 * lazy-loaded cached access.
 *
 * Usage:
 *   import { dom } from './core/dom.js';
 *
 *   // Get element by ID (cached after first access)
 *   const btn = dom.get('login-btn');
 *
 *   // Get multiple elements
 *   const buttons = dom.getAll('.tool-btn');
 *
 *   // Clear cache when DOM changes (e.g., dynamic content)
 *   dom.clearCache();
 */

class DOMManager {
  constructor() {
    /** @type {Map<string, HTMLElement|null>} */
    this._cache = new Map();

    /** @type {Map<string, NodeList>} */
    this._selectorCache = new Map();
  }

  /**
   * Get an element by ID with caching
   * @param {string} id - Element ID (without #)
   * @returns {HTMLElement|null}
   */
  get(id) {
    if (!this._cache.has(id)) {
      const element = document.getElementById(id);
      this._cache.set(id, element);
    }
    return this._cache.get(id);
  }

  /**
   * Get elements by CSS selector with optional caching
   * @param {string} selector - CSS selector
   * @param {boolean} [cache=false] - Whether to cache the result
   * @returns {NodeList}
   */
  getAll(selector, cache = false) {
    if (cache) {
      if (!this._selectorCache.has(selector)) {
        this._selectorCache.set(selector, document.querySelectorAll(selector));
      }
      return this._selectorCache.get(selector);
    }
    return document.querySelectorAll(selector);
  }

  /**
   * Get first element matching a CSS selector
   * @param {string} selector - CSS selector
   * @returns {Element|null}
   */
  query(selector) {
    return document.querySelector(selector);
  }

  /**
   * Clear the element cache
   * Call this when DOM structure changes significantly
   */
  clearCache() {
    this._cache.clear();
    this._selectorCache.clear();
  }

  /**
   * Clear a specific ID from cache
   * @param {string} id
   */
  invalidate(id) {
    this._cache.delete(id);
  }

  /**
   * Clear selector cache only
   */
  clearSelectorCache() {
    this._selectorCache.clear();
  }

  /**
   * Check if an element exists in the DOM
   * @param {string} id
   * @returns {boolean}
   */
  exists(id) {
    return !!this.get(id);
  }

  /**
   * Show an element (remove hidden class)
   * @param {string|HTMLElement} idOrElement
   * @param {string} [hiddenClass='hidden']
   */
  show(idOrElement, hiddenClass = 'hidden') {
    const el = typeof idOrElement === 'string' ? this.get(idOrElement) : idOrElement;
    if (el) {
      el.classList.remove(hiddenClass);
    }
  }

  /**
   * Hide an element (add hidden class)
   * @param {string|HTMLElement} idOrElement
   * @param {string} [hiddenClass='hidden']
   */
  hide(idOrElement, hiddenClass = 'hidden') {
    const el = typeof idOrElement === 'string' ? this.get(idOrElement) : idOrElement;
    if (el) {
      el.classList.add(hiddenClass);
    }
  }

  /**
   * Toggle element visibility
   * @param {string|HTMLElement} idOrElement
   * @param {boolean} [visible] - If provided, sets visibility explicitly
   * @param {string} [hiddenClass='hidden']
   */
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

  /**
   * Set text content of an element
   * @param {string} id
   * @param {string} text
   */
  setText(id, text) {
    const el = this.get(id);
    if (el) {
      el.textContent = text;
    }
  }

  /**
   * Set innerHTML of an element (use with caution - escape user content!)
   * @param {string} id
   * @param {string} html
   */
  setHTML(id, html) {
    const el = this.get(id);
    if (el) {
      el.innerHTML = html;
    }
  }

  /**
   * Add event listener to an element
   * @param {string} id
   * @param {string} event
   * @param {Function} handler
   * @param {Object} [options]
   */
  on(id, event, handler, options) {
    const el = this.get(id);
    if (el) {
      el.addEventListener(event, handler, options);
    }
  }

  /**
   * Remove event listener from an element
   * @param {string} id
   * @param {string} event
   * @param {Function} handler
   * @param {Object} [options]
   */
  off(id, event, handler, options) {
    const el = this.get(id);
    if (el) {
      el.removeEventListener(event, handler, options);
    }
  }

  /**
   * Create and return a new element
   * @param {string} tag - Element tag name
   * @param {Object} [attributes] - Attributes to set
   * @param {string} [content] - Text content
   * @returns {HTMLElement}
   */
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

// Singleton instance
export const dom = new DOMManager();

// Also export the class for testing
export { DOMManager };
