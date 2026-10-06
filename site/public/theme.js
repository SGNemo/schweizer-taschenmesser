/* Theme switch: follows the system; a click stores an override in localStorage. Nothing leaves
 * the browser. Loaded synchronously in <head> so the first paint already has the right theme.
 * Kept as a plain file (not inline) so the CSP can stay `script-src 'self'`. */
(function () {
  var KEY = 'nemo-site-theme';
  var root = document.documentElement;
  var mql = window.matchMedia('(prefers-color-scheme: dark)');
  function stored() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) {
      return null;
    }
  }
  function effective() {
    return stored() || (mql.matches ? 'dark' : 'light');
  }
  function apply() {
    var s = stored();
    if (s) root.setAttribute('data-theme', s);
    else root.removeAttribute('data-theme');
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var dark = effective() === 'dark';
      b.setAttribute('aria-pressed', dark ? 'true' : 'false');
      b.setAttribute('aria-label', dark ? b.getAttribute('data-label-light') : b.getAttribute('data-label-dark'));
    }
  }
  apply();
  window.addEventListener('DOMContentLoaded', function () {
    apply();
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var next = effective() === 'dark' ? 'light' : 'dark';
        try {
          // Back to "follow the system" when the choice equals the system preference.
          if ((next === 'dark') === mql.matches) localStorage.removeItem(KEY);
          else localStorage.setItem(KEY, next);
        } catch (e) {}
        apply();
      });
    }
  });
  mql.addEventListener('change', apply);
})();
