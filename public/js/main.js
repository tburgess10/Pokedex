(function () {

  /* ---- Apply saved theme to any page ---- */

  const STORAGE_KEY = 'burgedex-theme';
  const savedTheme  = localStorage.getItem(STORAGE_KEY) || 'pokeball';
  document.body.dataset.theme = savedTheme;

  /* ---- Theme switcher (home page only) ---- */

  const body = document.querySelector('.pokeball-home');

  if (body) {
    function applyTheme(theme) {
      body.dataset.theme = theme;
      document.querySelectorAll('.theme-dot').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.theme === theme);
      });
    }

    const saved = localStorage.getItem(STORAGE_KEY) || 'pokeball';
    applyTheme(saved);

    document.querySelectorAll('.theme-dot').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyTheme(btn.dataset.theme);
        localStorage.setItem(STORAGE_KEY, btn.dataset.theme);
      });
    });
  }

  /* ---- Shared entry-page state ---- */

  const entryArtwork = document.getElementById('entry-artwork');
  const entrySprite  = document.getElementById('entry-sprite');
  const shinyBtn     = document.getElementById('shiny-btn');
  let isShiny = false;

  /* ---- Shiny toggle (entry page only) ---- */

  if (shinyBtn && entrySprite) {
    shinyBtn.addEventListener('click', function () {
      isShiny = !isShiny;

      function swap(el) {
        if (!el) return;
        const shinyUrl = el.dataset.shiny;
        const target   = isShiny && shinyUrl && shinyUrl !== 'null' && shinyUrl !== ''
          ? shinyUrl
          : el.dataset.normal;
        el.src = target;
      }

      swap(entryArtwork);
      swap(entrySprite);
      shinyBtn.classList.toggle('active', isShiny);
    });
  }

  /* ---- Form switcher (entry page only) ---- */

  const formsGrid = document.getElementById('forms-grid');
  if (formsGrid) {
    const typesEl = document.querySelector('.entry-types');

    formsGrid.addEventListener('click', function (e) {
      const card = e.target.closest('.form-card');
      if (!card) return;

      // Update active card highlight
      formsGrid.querySelectorAll('.form-card').forEach(function (c) {
        c.classList.remove('form-card--active');
      });
      card.classList.add('form-card--active');

      // Pull all four URLs from the card
      const newArtwork      = card.dataset.artwork      || '';
      const newArtworkShiny = card.dataset.artworkShiny  || '';
      const newSprite       = card.dataset.sprite        || '';
      const newSpriteShiny  = card.dataset.spriteShiny   || '';

      // Update artwork element and its data attrs
      if (entryArtwork && newArtwork) {
        entryArtwork.dataset.normal = newArtwork;
        entryArtwork.dataset.shiny  = newArtworkShiny;
        entryArtwork.src = isShiny && newArtworkShiny ? newArtworkShiny : newArtwork;
      }

      // Update sprite element and its data attrs
      if (entrySprite && newSprite) {
        entrySprite.dataset.normal = newSprite;
        entrySprite.dataset.shiny  = newSpriteShiny;
        entrySprite.src = isShiny && newSpriteShiny ? newSpriteShiny : newSprite;
      }

      // Swap type badges
      if (typesEl) {
        const types = card.dataset.types.split(',').filter(Boolean);
        typesEl.innerHTML = types
          .map(function (t) { return '<span class="type-badge type-' + t + '">' + t + '</span>'; })
          .join('');
      }
    });
  }

  /* ---- Search autocomplete ---- */

  const input       = document.getElementById('pb-search-input');
  const suggestions = document.getElementById('pb-suggestions');

  if (!input || !suggestions) return;

  let debounceTimer = null;
  let activeIndex   = -1;

  function cap(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function hide() {
    suggestions.hidden = true;
    suggestions.innerHTML = '';
    activeIndex = -1;
  }

  function render(names) {
    if (!names.length) { hide(); return; }
    suggestions.innerHTML = names
      .map((name, i) => `<li class="pb-suggestion" data-name="${name}" data-index="${i}">${cap(name)}</li>`)
      .join('');
    suggestions.hidden = false;
    activeIndex = -1;
  }

  function highlight(index) {
    const items = suggestions.querySelectorAll('.pb-suggestion');
    items.forEach((el, i) => el.classList.toggle('is-active', i === index));
    activeIndex = index;
  }

  // Fetch suggestions with 200 ms debounce
  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    const q = this.value.trim();
    if (q.length < 2) { hide(); return; }

    debounceTimer = setTimeout(async function () {
      try {
        const res   = await fetch('/pokemon/search?q=' + encodeURIComponent(q));
        const names = await res.json();
        render(names);
      } catch (_) {
        hide();
      }
    }, 200);
  });

  // Keyboard navigation
  input.addEventListener('keydown', function (e) {
    const items = suggestions.querySelectorAll('.pb-suggestion');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight(Math.min(activeIndex + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = activeIndex - 1;
      if (next < 0) { highlight(-1); }
      else { highlight(next); }
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      window.location.href = '/pokemon/' + items[activeIndex].dataset.name;
    } else if (e.key === 'Escape') {
      hide();
    }
  });

  // Click a suggestion
  suggestions.addEventListener('click', function (e) {
    const item = e.target.closest('.pb-suggestion');
    if (item) window.location.href = '/pokemon/' + item.dataset.name;
  });

  // Click outside → close
  document.addEventListener('click', function (e) {
    if (e.target !== input && !suggestions.contains(e.target)) hide();
  });

})();
