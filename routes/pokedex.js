const express = require('express');
const router = express.Router();

const GENS = [
  { num: 1, start: 1,   end: 151,  label: 'Gen I'    },
  { num: 2, start: 152, end: 251,  label: 'Gen II'   },
  { num: 3, start: 252, end: 386,  label: 'Gen III'  },
  { num: 4, start: 387, end: 493,  label: 'Gen IV'   },
  { num: 5, start: 494, end: 649,  label: 'Gen V'    },
  { num: 6, start: 650, end: 721,  label: 'Gen VI'   },
  { num: 7, start: 722, end: 809,  label: 'Gen VII'  },
  { num: 8, start: 810, end: 905,  label: 'Gen VIII' },
  { num: 9, start: 906, end: 1025, label: 'Gen IX'   },
];

let dexCache = null;

async function getFullDex() {
  if (dexCache) return dexCache;
  const res  = await fetch('https://pokeapi.co/api/v2/pokemon?limit=10000');
  const data = await res.json();
  dexCache = data.results
    .map(p => {
      const id = parseInt(p.url.match(/\/(\d+)\/$/)[1]);
      return { name: p.name, id };
    })
    .filter(p => p.id >= 1 && p.id <= 1025);
  return dexCache;
}

router.get('/', async (req, res) => {
  try {
    const genNum  = Math.min(9, Math.max(1, parseInt(req.query.gen) || 1));
    const gen     = GENS[genNum - 1];
    const list    = await getFullDex();
    const pokemon = list.filter(p => p.id >= gen.start && p.id <= gen.end);
    res.render('pokedex/index', { pokemon, genNum, gens: GENS });
  } catch (err) {
    res.render('pokedex/index', { pokemon: [], genNum: 1, gens: GENS });
  }
});

module.exports = router;
