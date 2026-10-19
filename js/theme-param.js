// ?theme=light or ?theme=dark forces a theme, for screenshots and review.
// A classic (non-module) script on purpose: it blocks while <head> is parsed,
// so data-theme is set before the first paint. Modules are deferred, too late.
(function () {
  var theme = new URLSearchParams(location.search).get('theme');
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  }
})();
