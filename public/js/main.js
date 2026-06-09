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

  /* ---- Stat bar renderer ---- */

  const STAT_LABELS = {
    'hp': 'HP', 'attack': 'Attack', 'defense': 'Defense',
    'special-attack': 'Sp. Atk', 'special-defense': 'Sp. Def', 'speed': 'Speed'
  };

  function statColor(v) {
    if (v < 60)  return '#E74C3C';
    if (v < 90)  return '#F39C12';
    if (v < 120) return '#2ECC71';
    return '#3498DB';
  }

  function renderStats(stats) {
    const body = document.getElementById('stats-body');
    if (!body) return;
    const total = stats.reduce(function (s, x) { return s + x.base_stat; }, 0);
    const rows = stats.map(function (s) {
      const label    = STAT_LABELS[s.stat.name] || s.stat.name;
      const w        = Math.min(100, Math.round(s.base_stat / 150 * 100));
      const c        = statColor(s.base_stat);
      const overflow = s.base_stat > 150 ? ' stat-bar--overflow' : '';
      return '<div class="stat-row">' +
        '<span class="stat-name">' + label + '</span>' +
        '<span class="stat-num">' + s.base_stat + '</span>' +
        '<div class="stat-track">' +
          '<div class="stat-bar' + overflow + '" style="--w:' + w + '%;--c:' + c + '"></div>' +
        '</div></div>';
    }).join('');
    const totalW       = Math.min(100, Math.round(total / 720 * 100));
    const totalOverflow = total > 720 ? ' stat-bar--overflow' : '';
    const totalRow = '<div class="stat-row stat-total-row">' +
      '<span class="stat-name">Total</span>' +
      '<span class="stat-num total-num">' + total + '</span>' +
      '<div class="stat-track">' +
        '<div class="stat-bar' + totalOverflow + '" style="--w:' + totalW + '%;--c:var(--accent)"></div>' +
      '</div></div>';
    body.innerHTML = rows + totalRow;
  }

  /* ---- Type chart renderer ---- */

  const TC_ROWS = [
    { mult: 4,    label: '4×',  cls: 'tc-x4'   },
    { mult: 2,    label: '2×',  cls: 'tc-x2'   },
    { mult: 0.5,  label: '½×',  cls: 'tc-half' },
    { mult: 0.25, label: '¼×',  cls: 'tc-qtr'  },
    { mult: 0,    label: '0×',  cls: 'tc-zero' },
  ];

  function renderTypeChart(eff) {
    const body = document.getElementById('tc-body');
    if (!body) return;
    const groups = {};
    Object.keys(eff).forEach(function (t) {
      const m = eff[t];
      if (!groups[m]) groups[m] = [];
      groups[m].push(t);
    });
    body.innerHTML = TC_ROWS
      .filter(function (r) { return groups[r.mult] && groups[r.mult].length > 0; })
      .map(function (r) {
        const badges = groups[r.mult]
          .map(function (t) { return '<span class="type-badge type-' + t + '">' + t + '</span>'; })
          .join('');
        return '<div class="tc-row"><span class="tc-mult ' + r.cls + '">' + r.label + '</span><div class="tc-badges">' + badges + '</div></div>';
      })
      .join('');
  }

  /* ---- Ability renderer ---- */

  function renderAbilities(abilities) {
    const container = document.getElementById('ability-cards');
    if (!container || !Array.isArray(abilities)) return;
    container.innerHTML = abilities.map(function (a) {
      const displayName = a.name.split('-').map(function (w) { return w[0].toUpperCase() + w.slice(1); }).join(' ');
      const hiddenBadge = a.isHidden ? '<span class="ability-card__badge">Hidden</span>' : '';
      const desc = a.shortEffect ? '<p class="ability-card__desc">' + a.shortEffect + '</p>' : '';
      return '<div class="ability-card' + (a.isHidden ? ' ability-card--hidden' : '') + '">' +
        '<div class="ability-card__header">' +
          '<span class="ability-card__name">' + displayName + '</span>' +
          hiddenBadge +
        '</div>' +
        desc +
      '</div>';
    }).join('');
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

      // Update type chart
      try { renderTypeChart(JSON.parse(card.dataset.effectiveness || '{}')); } catch (_) {}

      // Update stats
      try { renderStats(JSON.parse(card.dataset.stats || '[]')); } catch (_) {}

      // Update abilities
      try { renderAbilities(JSON.parse(card.dataset.abilities || '[]')); } catch (_) {}

      // Update physical values
      const h = card.dataset.height, w = card.dataset.weight, xp = card.dataset.baseExp;
      const heightEl  = document.getElementById('phys-height');
      const weightEl  = document.getElementById('phys-weight');
      const baseExpEl = document.getElementById('phys-base-exp');
      if (heightEl  && h)  heightEl.textContent  = (parseFloat(h)  / 10).toFixed(1) + ' m';
      if (weightEl  && w)  weightEl.textContent  = (parseFloat(w)  / 10).toFixed(1) + ' kg';
      if (baseExpEl && xp) baseExpEl.textContent = xp;
    });
  }

  /* ---- Keyboard prev/next (entry page only) ---- */

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowLeft') {
      const prev = document.getElementById('nav-prev');
      if (prev) window.location.href = prev.href;
    } else if (e.key === 'ArrowRight') {
      const next = document.getElementById('nav-next');
      if (next) window.location.href = next.href;
    }
  });

  /* ---- Pokédex name filter ---- */

  const dexFilter = document.getElementById('dex-filter');
  if (dexFilter) {
    const cards   = document.querySelectorAll('.dex-card');
    const emptyEl = document.getElementById('dex-empty');

    dexFilter.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      let visible = 0;
      cards.forEach(function (card) {
        const match = card.dataset.name.includes(q);
        card.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      if (emptyEl) emptyEl.hidden = visible > 0;
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
