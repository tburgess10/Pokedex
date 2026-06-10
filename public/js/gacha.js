(function () {

  const STAT_KEYS = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
  const STAT_DISPLAY = {
    'hp': 'HP', 'attack': 'Attack', 'defense': 'Defense',
    'special-attack': 'Sp. Atk', 'special-defense': 'Sp. Def', 'speed': 'Speed',
  };
  const HS_KEY = 'burgedex-gacha-highscore';

  let chosenStats     = {};   // stat_key → { value, pokemonName }
  let activeIntervals = [];
  let allBsts         = null; // cached BST list from /pokedex/stats
  let prefetchPromise = null;

  // ── Helpers ──────────────────────────────────────────────────────────────

  function cap(str) {
    return str.split('-').map(function (w) { return w[0].toUpperCase() + w.slice(1); }).join(' ');
  }

  function statColor(v) {
    if (v < 60)  return '#E74C3C';
    if (v < 90)  return '#F39C12';
    if (v < 120) return '#2ECC71';
    return '#3498DB';
  }

  function clearIntervals() {
    activeIntervals.forEach(clearInterval);
    activeIntervals = [];
  }

  function getHighScore() { return parseInt(localStorage.getItem(HS_KEY) || '0'); }
  function saveHighScore(v) { localStorage.setItem(HS_KEY, v); }

  // ── Data fetching ─────────────────────────────────────────────────────────

  async function fetchPokemon(n) {
    const r = await fetch('/roll/random?n=' + n);
    if (!r.ok) throw new Error('fetch failed');
    return r.json();
  }

  function prefetchPokemon(n) {
    prefetchPromise = fetchPokemon(n);
  }

  async function getPokemon(n) {
    if (prefetchPromise) {
      try {
        const data = await prefetchPromise;
        prefetchPromise = null;
        if (data && data.finals && data.finals.length === n) return data;
      } catch (_) { prefetchPromise = null; }
    }
    return fetchPokemon(n);
  }

  async function loadAllBsts() {
    if (allBsts) return allBsts;
    const r = await fetch('/pokedex/stats');
    if (!r.ok) throw new Error('stats failed');
    const stats = await r.json();
    allBsts = stats.map(function (s) { return s.total; });
    return allBsts;
  }

  // ── UI helpers ────────────────────────────────────────────────────────────

  function setHint(text) {
    const el = document.getElementById('gacha-round-hint');
    if (el) el.textContent = text;
  }

  function updateRoundUI() {
    const done  = Object.keys(chosenStats).length;
    const round = done + 1;
    const label = document.getElementById('gacha-round-label');
    if (label) label.textContent = 'Round ' + round + ' of 6';
    document.querySelectorAll('.gacha-dot').forEach(function (dot, i) {
      dot.classList.toggle('gacha-dot--done', i < done);
    });
  }

  function updateBestScoreDisplay() {
    const el = document.getElementById('gacha-best-score');
    if (!el) return;
    const hs = getHighScore();
    if (hs > 0) {
      el.textContent    = 'Best: ' + hs + ' BST';
      el.style.display  = '';
    } else {
      el.style.display = 'none';
    }
  }

  function updateChosenPanel() {
    const panel = document.getElementById('gacha-chosen-panel');
    const row   = document.getElementById('gacha-chosen-row');
    const tot   = document.getElementById('gacha-partial-total');
    if (!panel || !row || !tot) return;

    const entries = STAT_KEYS.filter(function (k) { return chosenStats[k] !== undefined; });
    if (!entries.length) { panel.hidden = true; return; }

    panel.hidden  = false;
    row.innerHTML = entries.map(function (k) {
      const val = chosenStats[k].value;
      return '<div class="gacha-chosen-chip">' +
        '<span class="gacha-chosen-chip__stat">' + STAT_DISPLAY[k] + '</span>' +
        '<span class="gacha-chosen-chip__val" style="color:' + statColor(val) + '">' + val + '</span>' +
      '</div>';
    }).join('');

    const partial = entries.reduce(function (s, k) { return s + chosenStats[k].value; }, 0);
    tot.textContent = 'Running total: ' + partial;
  }

  // ── Shuffle ───────────────────────────────────────────────────────────────

  function startShuffle(statKey, finalPokemon, pool) {
    const card     = document.querySelector('[data-stat="' + statKey + '"]');
    const spriteEl = card.querySelector('.gacha-card__sprite');
    const nameEl   = card.querySelector('.gacha-card__name');
    const valueEl  = card.querySelector('.gacha-card__value');

    card.classList.remove(
      'gacha-card--loading', 'gacha-card--pickable', 'gacha-card--chosen',
      'gacha-card--landed',  'gacha-card--autoclaim'
    );
    card.classList.add('gacha-card--shuffling');
    valueEl.className = 'gacha-card__value gacha-card__value--hidden';
    valueEl.style.removeProperty('--val-color');

    let idx = 0;
    const interval = setInterval(function () {
      const p = pool[idx % pool.length];
      spriteEl.src        = p.sprite;
      nameEl.textContent  = cap(p.name);
      idx++;
    }, 80);
    activeIntervals.push(interval);

    const delay = 1600 + Math.random() * 500;
    setTimeout(function () {
      clearInterval(interval);
      activeIntervals = activeIntervals.filter(function (iv) { return iv !== interval; });

      spriteEl.src       = finalPokemon.sprite;
      nameEl.textContent = cap(finalPokemon.name);
      card.classList.remove('gacha-card--shuffling');
      card.classList.add('gacha-card--landed');

      const val = finalPokemon[statKey] != null ? finalPokemon[statKey] : 0;
      card.dataset.value       = val;
      card.dataset.pokemonName = finalPokemon.name;

      valueEl.style.setProperty('--val-color', statColor(val));
      valueEl.textContent = val;
      valueEl.className   = 'gacha-card__value gacha-card__value--reveal';

      // Single remaining stat: auto-claim after a pause
      const remaining = STAT_KEYS.filter(function (k) { return chosenStats[k] === undefined; });
      if (remaining.length === 1) {
        setHint('Claiming your final stat…');
        setTimeout(function () { autoClaimLast(statKey); }, 900);
        return;
      }

      checkAllLanded();
    }, delay);
  }

  function checkAllLanded() {
    const remaining = STAT_KEYS.filter(function (k) { return chosenStats[k] === undefined; });
    const allLanded = remaining.every(function (k) {
      const c = document.querySelector('[data-stat="' + k + '"]');
      return c && c.classList.contains('gacha-card--landed');
    });
    if (!allLanded) return;

    setHint('Pick one Pokémon to claim its stat');

    // Stagger the "pickable" pop animation so all cards don't activate simultaneously
    remaining.forEach(function (k, i) {
      setTimeout(function () {
        const c = document.querySelector('[data-stat="' + k + '"]');
        if (c) {
          c.classList.remove('gacha-card--landed');
          c.classList.add('gacha-card--pickable');
        }
      }, i * 80);
    });
  }

  function autoClaimLast(statKey) {
    const card = document.querySelector('[data-stat="' + statKey + '"]');
    if (!card) return;
    card.classList.remove('gacha-card--landed');
    card.classList.add('gacha-card--autoclaim');
    setTimeout(function () { claimStat(statKey); }, 700);
  }

  // ── Claim ─────────────────────────────────────────────────────────────────

  function claimStat(statKey) {
    const card = document.querySelector('[data-stat="' + statKey + '"]');
    if (!card) return;

    const value       = parseInt(card.dataset.value) || 0;
    const pokemonName = card.dataset.pokemonName || '';

    chosenStats[statKey] = { value: value, pokemonName: pokemonName };

    card.classList.remove(
      'gacha-card--pickable', 'gacha-card--landed', 'gacha-card--autoclaim'
    );
    card.classList.add('gacha-card--chosen');

    // Remaining unclaimed cards go back to loading before the next round
    STAT_KEYS.filter(function (k) { return chosenStats[k] === undefined; }).forEach(function (k) {
      const c = document.querySelector('[data-stat="' + k + '"]');
      if (c) {
        c.classList.remove('gacha-card--pickable', 'gacha-card--landed');
        c.classList.add('gacha-card--loading');
      }
    });

    updateChosenPanel();
    updateRoundUI();

    if (Object.keys(chosenStats).length === 6) {
      showResults();
    } else {
      setTimeout(doRound, 350);
    }
  }

  // ── Round ─────────────────────────────────────────────────────────────────

  async function doRound() {
    const remaining = STAT_KEYS.filter(function (k) { return chosenStats[k] === undefined; });
    if (!remaining.length) { showResults(); return; }

    remaining.forEach(function (k) {
      const c = document.querySelector('[data-stat="' + k + '"]');
      if (c) {
        c.classList.remove('gacha-card--pickable', 'gacha-card--landed', 'gacha-card--shuffling');
        c.classList.add('gacha-card--loading');
      }
    });

    setHint('Rolling…');

    let data;
    try {
      data = await getPokemon(remaining.length);
    } catch (_) {
      const hintEl = document.getElementById('gacha-round-hint');
      if (hintEl) {
        hintEl.innerHTML = 'Network error. ' +
          '<button id="gacha-net-retry" style="all:unset;cursor:pointer;font-weight:700;' +
          'text-decoration:underline;color:var(--accent)">Retry</button>';
        const btn = document.getElementById('gacha-net-retry');
        if (btn) btn.addEventListener('click', doRound);
      }
      return;
    }

    // Pre-fetch next round while user is picking
    const nextCount = remaining.length - 1;
    if (nextCount > 0) prefetchPokemon(nextCount);

    remaining.forEach(function (k, i) {
      startShuffle(k, data.finals[i], data.pool);
    });
  }

  // ── Results ───────────────────────────────────────────────────────────────

  async function showResults() {
    clearIntervals();
    setHint('');

    const total = STAT_KEYS.reduce(function (s, k) {
      return s + (chosenStats[k] ? chosenStats[k].value : 0);
    }, 0);

    // Stat bars using existing .stat-row / .stat-bar styles
    const statsEl = document.getElementById('gacha-results-stats');
    if (statsEl) {
      statsEl.innerHTML = STAT_KEYS.map(function (k) {
        const val      = chosenStats[k] ? chosenStats[k].value : 0;
        const w        = Math.min(100, Math.round(val / 150 * 100));
        const c        = statColor(val);
        const overflow = val > 150 ? ' stat-bar--overflow' : '';
        return '<div class="stat-row">' +
          '<span class="stat-name">' + STAT_DISPLAY[k] + '</span>' +
          '<span class="stat-num">' + val + '</span>' +
          '<div class="stat-track">' +
            '<div class="stat-bar' + overflow + '" style="--w:' + w + '%;--c:' + c + '"></div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    // Total
    const totalEl = document.getElementById('gacha-total-value');
    if (totalEl) totalEl.textContent = total;

    // High score
    const hs    = getHighScore();
    const isNew = total > hs;
    if (isNew) saveHighScore(total);

    const hsEl = document.getElementById('gacha-highscore-value');
    if (hsEl) hsEl.textContent = (isNew ? total : hs) + ' BST';

    const nrEl = document.getElementById('gacha-newrecord');
    if (nrEl) nrEl.hidden = !isNew;

    updateBestScoreDisplay();

    // Flip panels
    document.getElementById('gacha-game').hidden    = true;
    document.getElementById('gacha-results').hidden = false;

    // Percentile (async — appears after flip)
    const badge = document.getElementById('gacha-percentile-badge');
    try {
      const bsts       = await loadAllBsts();
      const betterThan = bsts.filter(function (t) { return total > t; }).length;
      const pct        = Math.round(betterThan / bsts.length * 100);

      let text, extra;
      if (pct === 0) {
        text  = 'Better than less than 1% of Pokémon';
        extra = '';
      } else if (pct >= 99) {
        text  = 'Better than 99%+ of all Pokémon!';
        extra = 'gacha-percentile-badge--top1';
      } else {
        text  = 'Better than ' + pct + '% of all Pokémon';
        extra = pct >= 90 ? 'gacha-percentile-badge--top10' : '';
      }

      if (badge) {
        badge.textContent = text;
        badge.className   = 'gacha-percentile-badge' + (extra ? ' ' + extra : '');
      }
    } catch (_) {
      if (badge) badge.textContent = 'Could not load comparison data';
    }
  }

  // ── Start / Retry ─────────────────────────────────────────────────────────

  function startGame() {
    clearIntervals();
    prefetchPromise = null;
    chosenStats     = {};

    STAT_KEYS.forEach(function (k) {
      const c = document.querySelector('[data-stat="' + k + '"]');
      if (!c) return;
      c.className = 'gacha-card gacha-card--loading';
      delete c.dataset.value;
      delete c.dataset.pokemonName;

      const sprite = c.querySelector('.gacha-card__sprite');
      const name   = c.querySelector('.gacha-card__name');
      const val    = c.querySelector('.gacha-card__value');
      if (sprite) sprite.src = '';
      if (name)   name.textContent = '—';
      if (val) {
        val.textContent = '—';
        val.className   = 'gacha-card__value gacha-card__value--hidden';
        val.style.removeProperty('--val-color');
      }
    });

    const panel = document.getElementById('gacha-chosen-panel');
    if (panel) panel.hidden = true;

    document.getElementById('gacha-game').hidden    = false;
    document.getElementById('gacha-results').hidden = true;

    updateRoundUI();
    updateBestScoreDisplay();
    doRound();
  }

  // ── Event listeners ───────────────────────────────────────────────────────

  document.querySelectorAll('.gacha-card').forEach(function (card) {
    card.addEventListener('click', function () {
      if (!card.classList.contains('gacha-card--pickable')) return;
      claimStat(card.dataset.stat);
    });
  });

  document.getElementById('gacha-retry-btn').addEventListener('click', startGame);

  // ── Boot ──────────────────────────────────────────────────────────────────

  startGame();

})();
