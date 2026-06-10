const express = require('express');
const router  = express.Router();

router.get('/roll', (req, res) => {
  res.render('gacha', { title: 'Stat Roll' });
});

router.get('/roll/random', async (req, res) => {
  const requested = Math.max(1, Math.min(parseInt(req.query.n) || 6, 6));
  const total     = Math.max(requested, 5);

  const ids = new Set();
  while (ids.size < total) {
    ids.add(Math.floor(Math.random() * 1025) + 1);
  }

  try {
    const results = await Promise.all([...ids].map(async id => {
      const r = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
      if (!r.ok) throw new Error(`pokeapi ${id} failed`);
      const data = await r.json();
      const s = {};
      data.stats.forEach(st => { s[st.stat.name] = st.base_stat; });
      return {
        id,
        name:               data.name,
        sprite:             data.sprites.front_default
                              || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
        hp:                 s['hp']               || 0,
        attack:             s['attack']           || 0,
        defense:            s['defense']          || 0,
        'special-attack':   s['special-attack']   || 0,
        'special-defense':  s['special-defense']  || 0,
        speed:              s['speed']             || 0,
      };
    }));

    res.json({ finals: results.slice(0, requested), pool: results });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch Pokémon' });
  }
});

module.exports = router;
