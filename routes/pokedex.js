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

let dexCache = null;

async function getFullDex() {
  if (dexCache) return dexCache;

  // Phase 1: list + all type data (parallel)
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

  const baseList = listData.results
    .map(p => {
      const id = parseInt(p.url.match(/\/(\d+)\/$/)[1]);
      return { name: p.name, id, url: p.url, types: typeMap[p.name] || [] };
    })
    .filter(p => p.id >= 1 && p.id <= 1025);

  // Phase 2: individual Pokémon data for stats/height/weight (batched)
  const BATCH = 100;
  const detailResults = [];
  for (let i = 0; i < baseList.length; i += BATCH) {
    const batch = await Promise.allSettled(
      baseList.slice(i, i + BATCH).map(p => fetch(p.url).then(r => r.json()))
    );
    detailResults.push(...batch);
  }

  dexCache = baseList.map((p, i) => {
    const res = detailResults[i];
    if (res.status !== 'fulfilled') {
      return { name: p.name, id: p.id, types: p.types, height: 0, weight: 0, hp: 0, attack: 0, defense: 0, spatk: 0, spdef: 0, speed: 0, total: 0 };
    }
    const d  = res.value;
    const sm = {};
    (d.stats || []).forEach(s => { sm[s.stat.name] = s.base_stat; });
    const hp      = sm['hp']              || 0;
    const attack  = sm['attack']          || 0;
    const defense = sm['defense']         || 0;
    const spatk   = sm['special-attack']  || 0;
    const spdef   = sm['special-defense'] || 0;
    const speed   = sm['speed']           || 0;
    return {
      name: p.name, id: p.id, types: p.types,
      height: d.height || 0, weight: d.weight || 0,
      hp, attack, defense, spatk, spdef, speed,
      total: hp + attack + defense + spatk + spdef + speed,
    };
  });

  return dexCache;
}

router.get('/', async (req, res) => {
  try {
    const raw    = parseInt(req.query.gen);
    const gen    = GENS.find(g => g.num === (isNaN(raw) ? 0 : raw)) || GENS[0];
    const list   = await getFullDex();
    const pokemon = list.filter(p => p.id >= gen.start && p.id <= gen.end);
    res.render('pokedex/index', { pokemon, genNum: gen.num, gens: GENS });
  } catch (err) {
    res.render('pokedex/index', { pokemon: [], genNum: 0, gens: GENS });
  }
});

getFullDex().catch(() => {});

module.exports = router;
