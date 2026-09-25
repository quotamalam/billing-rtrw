(function () {
  var savedTheme = localStorage.getItem('app-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
})();

function toggleAppTheme() {
  var currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  var newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  if (document.body) {
    document.body.classList.toggle('light-theme', newTheme === 'light');
  }
  localStorage.setItem('app-theme', newTheme);
  updateThemeToggleIcons(newTheme);
}

function updateThemeToggleIcons(theme) {
  var icons = document.querySelectorAll('.theme-toggle-icon');
  var btns = document.querySelectorAll('.theme-toggle-btn');
  icons.forEach(function (icon) {
    if (theme === 'light') {
      icon.className = 'bi bi-sun-fill theme-toggle-icon';
      icon.style.color = '#f59e0b';
    } else {
      icon.className = 'bi bi-moon-stars-fill theme-toggle-icon';
      icon.style.color = '#fbbf24';
    }
  });
  btns.forEach(function (btn) {
    btn.setAttribute('title', theme === 'light' ? 'Ganti ke Mode Gelap (Dark)' : 'Ganti ke Mode Terang (Light)');
  });
}

// Suntik tombol tema mengambang bila halaman belum punya tombol tema sendiri
function injectThemeFab() {
  if (!document.body) return;
  if (document.querySelector('.theme-toggle-btn') || document.querySelector('.theme-fab')) return;
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-fab theme-toggle-btn';
  btn.setAttribute('onclick', 'toggleAppTheme()');
  btn.setAttribute('title', 'Ganti Tema Dark / Light');
  btn.innerHTML = '<i class="bi bi-moon-stars-fill theme-toggle-icon" style="color:#fbbf24"></i>';
  document.body.appendChild(btn);
}

// Muat CSS tema bersama sekali
function ensureThemeCss() {
  if (document.getElementById('app-theme-css')) return;
  var link = document.createElement('link');
  link.id = 'app-theme-css';
  link.rel = 'stylesheet';
  link.href = '/css/theme.css';
  document.head.appendChild(link);
}

document.addEventListener('DOMContentLoaded', function () {
  var theme = localStorage.getItem('app-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'light' && document.body) {
    document.body.classList.add('light-theme');
  }
  ensureThemeCss();
  injectThemeFab();
  updateThemeToggleIcons(theme);
});