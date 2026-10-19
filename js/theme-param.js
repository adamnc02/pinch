// Sets data-theme before the first paint: ?theme=light|dark (screenshots
// and review) wins, then Settings › Appearance from pinch.prefs. A classic
// (non-module) script on purpose: it blocks while <head> is parsed, so a
// dark theme never flashes light first. Modules are deferred, too late.
(function () {
  var theme = new URLSearchParams(location.search).get('theme');
  if (theme !== 'light' && theme !== 'dark') {
    try { theme = (JSON.parse(localStorage.getItem('pinch.prefs') || '{}') || {}).theme; } catch (e) { theme = null; }
  }
  if (theme === 'light' || theme === 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
  }
})();
