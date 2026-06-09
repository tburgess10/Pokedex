const express = require('express');
const router = express.Router();

const ALL_TYPES = [
  'normal','fire','water','electric','grass','ice','fighting',
  'poison','ground','flying','psychic','bug','rock','ghost',
  'dragon','dark','steel','fairy'
];

const GENS = [
  { num: 0, start: 1,   end: 1025, label: 'All'      },
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

// Phase 1: name, id, types only — fast, used for initial page render
let basicCache = null;

// Phase 2: adds stats, height, weight — fetched in background via GraphQL
let statsCache = null;

async function getBasicDex() {
  if (basicCache) return basicCache;

  const responses = await Promise.all([
    fetch('https://pokeapi.co/api/v2/pokemon?limit=10000'),
    ...ALL_TYPES.map(t => fetch(`https://pokeapi.co/api/v2/type/${t}`))
  ]);
  const [listData, ...typeDatas] = await Promise.all(responses.map(r => r.json()));

  const typeMap = {};
  typeDatas.forEach((typeData, i) => {
    if (!typeData.pokemon) return;
    typeData.pokemon.forEach(entry => {
      const name = entry.pokemon.name;
      if (!typeMap[name]) typeMap[name] = [];
      typeMap[name].push(ALL_TYPES[i]);
    });
  });
  typeMap['terapagos'] = ['stellar'];

  basicCache = listData.results
    .map(p => {
      const id = parseInt(p.url.match(/\/(\d+)\/$/)[1]);
      return { name: p.name, id, types: typeMap[p.name] || [],
               height: 0, weight: 0, hp: 0, attack: 0, defense: 0,
               spatk: 0, spdef: 0, speed: 0, total: 0 };
    })
    .filter(p => p.id >= 1 && p.id <= 1025);

  return basicCache;
}

// Single GraphQL request replaces 1025 individual REST calls
const GQL_URL = 'https://beta.pokeapi.co/graphql/v1beta';
const GQL_QUERY = `{
  pokemon_v2_pokemon(where: {id: {_lte: 1025}}) {
    id height weight
    pokemon_v2_pokemonstats {
      base_stat
      pokemon_v2_stat { name }
    }
  }
}`;

async function warmStats() {
  if (statsCache) return statsCache;
  const basic = await getBasicDex();

  const res  = await fetch(GQL_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ query: GQL_QUERY }),
  });
  const { data } = await res.json();

  const statsById = {};
  for (const p of data.pokemon_v2_pokemon) {
    const sm = {};
    for (const s of p.pokemon_v2_pokemonstats) sm[s.pokemon_v2_stat.name] = s.base_stat;
    const hp      = sm['hp']             || 0;
    const attack  = sm['attack']         || 0;
    const defense = sm['defense']        || 0;
    const spatk   = sm['special-attack'] || 0;
    const spdef   = sm['special-defense']|| 0;
    const speed   = sm['speed']          || 0;
    statsById[p.id] = { height: p.height || 0, weight: p.weight || 0,
                        hp, attack, defense, spatk, spdef, speed,
                        total: hp + attack + defense + spatk + spdef + speed };
  }

  statsCache = basic.map(p => ({ ...p, ...(statsById[p.id] || {}) }));
  return statsCache;
}

// Lightweight stats endpoint for client-side lazy loading
router.get('/stats', async (req, res) => {
  try {
    const full = await warmStats();
    res.json(full.map(p => ({
      id: p.id, hp: p.hp, attack: p.attack, defense: p.defense,
      spatk: p.spatk, spdef: p.spdef, speed: p.speed,
      total: p.total, height: p.height, weight: p.weight,
    })));
  } catch (err) {
    res.status(500).json({ error: 'stats unavailable' });
  }
});

router.get('/', async (req, res) => {
  try {
    const raw     = parseInt(req.query.gen);
    const gen     = GENS.find(g => g.num === (isNaN(raw) ? 0 : raw)) || GENS[0];
    const list    = await getBasicDex();           // fast — Phase 1 only
    const pokemon = list.filter(p => p.id >= gen.start && p.id <= gen.end);
    res.render('pokedex/index', { pokemon, genNum: gen.num, gens: GENS });
    warmStats().catch(() => {});                   // stats load in background
  } catch (err) {
    res.render('pokedex/index', { pokemon: [], genNum: 0, gens: GENS });
  }
});

getBasicDex().catch(() => {});    // pre-warm Phase 1 on startup

module.exports = router;
