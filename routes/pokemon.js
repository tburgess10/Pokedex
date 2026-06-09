const express = require('express');
const router = express.Router();

const ALL_TYPES = ['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];

// Gen 6+ type chart: typeChart[attacker][defender] = multiplier
const TYPE_CHART = {
  normal:   { rock: 0.5, ghost: 0, steel: 0.5 },
  fire:     { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water:    { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass:    { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice:      { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, rock: 2, dark: 2, steel: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0 },
  poison:   { grass: 2, fairy: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0 },
  ground:   { fire: 2, electric: 2, poison: 2, rock: 2, steel: 2, grass: 0.5, bug: 0.5, flying: 0 },
  flying:   { grass: 2, fighting: 2, bug: 2, electric: 0.5, rock: 0.5, steel: 0.5 },
  psychic:  { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug:      { grass: 2, psychic: 2, dark: 2, fire: 0.5, fighting: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5, poison: 0.5 },
  rock:     { fire: 2, ice: 2, flying: 2, bug: 2, fighting: 0.5, ground: 0.5, steel: 0.5 },
  ghost:    { psychic: 2, ghost: 2, dark: 0.5, normal: 0 },
  dragon:   { dragon: 2, steel: 0.5, fairy: 0 },
  dark:     { psychic: 2, ghost: 2, fighting: 0.5, dark: 0.5, fairy: 0.5 },
  steel:    { ice: 2, rock: 2, fairy: 2, fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5 },
  fairy:    { fighting: 2, dragon: 2, dark: 2, fire: 0.5, poison: 0.5, steel: 0.5 },
};

function computeTypeEffectiveness(defenderTypes) {
    const result = {};
    for (const attacker of ALL_TYPES) {
        let mult = 1;
        for (const def of defenderTypes) mult *= TYPE_CHART[attacker]?.[def] ?? 1;
        if (mult !== 1) result[attacker] = mult;
    }
    return result;
}

const VERSION_GROUP_ORDER = [
    'scarlet-violet', 'legends-arceus', 'brilliant-diamond-and-shining-pearl',
    'sword-shield', 'lets-go-pikachu-eevee', 'ultra-sun-ultra-moon',
    'sun-moon', 'omega-ruby-alpha-sapphire', 'x-y', 'black-2-white-2',
    'black-white', 'heartgold-soulsilver', 'platinum', 'diamond-pearl',
    'firered-leafgreen', 'emerald', 'ruby-sapphire', 'crystal',
    'gold-silver', 'yellow', 'red-blue',
];

async function fetchVersionGroupMoves(rawMoves, targetVG = null) {
    try {
        const vgSet = new Set(
            rawMoves.flatMap(m => m.version_group_details.map(d => d.version_group.name))
        );
        const bestVG = (targetVG && vgSet.has(targetVG))
            ? targetVG
            : VERSION_GROUP_ORDER.find(vg => vgSet.has(vg));
        if (!bestVG) return { versionGroup: '', versionGroupId: '', table: {} };

        const vgMoves = rawMoves
            .map(m => {
                const detail = m.version_group_details.find(d => d.version_group.name === bestVG);
                if (!detail) return null;
                return {
                    name:   m.move.name,
                    url:    m.move.url,
                    method: detail.move_learn_method.name,
                    level:  detail.level_learned_at,
                };
            })
            .filter(Boolean);

        const moveDetails = await Promise.all(
            vgMoves.map(async (m) => {
                try {
                    const res = await fetch(m.url);
                    if (!res.ok) return null;
                    const data = await res.json();
                    return {
                        name:        m.name,
                        displayName: m.name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
                        method:      m.method,
                        level:       m.level,
                        type:        data.type?.name        || null,
                        power:       data.power,
                        accuracy:    data.accuracy,
                        pp:          data.pp,
                        damageClass: data.damage_class?.name || null,
                    };
                } catch (_) { return null; }
            })
        );

        const table = {};
        for (const method of ['level-up', 'machine', 'egg', 'tutor']) {
            const moves = moveDetails.filter(m => m?.method === method);
            if (!moves.length) continue;
            if (method === 'level-up') moves.sort((a, b) => a.level - b.level);
            else moves.sort((a, b) => a.displayName.localeCompare(b.displayName));
            table[method] = moves;
        }

        const vgLabel = bestVG.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
        return { versionGroup: vgLabel, versionGroupId: bestVG, table };
    } catch (_) {
        return { versionGroup: '', versionGroupId: '', table: {} };
    }
}

// Cached list of all Pokémon names, fetched once from PokéAPI
let pokemonList = null;

async function getPokemonList() {
    if (pokemonList) return pokemonList;
    const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=2000');
    const data = await res.json();
    pokemonList = data.results.map(p => p.name);
    return pokemonList;
}

// Search form handler: redirect /pokemon?q=pikachu → /pokemon/pikachu
router.get('/', (req, res) => {
    const query = (req.query.q || '').trim().toLowerCase();
    if (!query) return res.redirect('/');
    res.redirect(`/pokemon/${query}`);
});

// Autocomplete endpoint: returns up to 8 matching names as JSON
router.get('/search', async (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase();
    if (q.length < 2) return res.json([]);
    try {
        const list = await getPokemonList();
        const matches = list.filter(name => name.startsWith(q)).slice(0, 8);
        res.json(matches);
    } catch (err) {
        res.json([]);
    }
});

// AJAX endpoint — returns moves JSON for a specific version group
router.get('/:id/moves', async (req, res) => {
    const targetVG = (req.query.vg || '').trim() || null;
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${req.params.id}`);
        if (!response.ok) return res.status(404).json({ error: 'not found' });
        const pokedata = await response.json();
        const result = await fetchVersionGroupMoves(pokedata.moves, targetVG);
        res.json(result);
    } catch (_) {
        res.status(500).json({ error: 'failed' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${req.params.id}`);
        if (!response.ok) {
            // Species-name fallback: "pumpkaboo" → redirect to "pumpkaboo-average"
            const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${req.params.id}`);
            if (speciesRes.ok) {
                const speciesData = await speciesRes.json();
                const defaultVariety = speciesData.varieties.find(v => v.is_default);
                if (defaultVariety) return res.redirect(`/pokemon/${defaultVariety.pokemon.name}`);
            }
            return res.render('pokemon/not-found', { query: req.params.id });
        }
        const pokedata = await response.json();
        pokedata.capName = pokedata.name.charAt(0).toUpperCase() + pokedata.name.slice(1);
        pokedata.typeEffectiveness = computeTypeEffectiveness(pokedata.types.map(t => t.type.name));

        // Build ordered list of version groups this Pokémon has moves in
        {
            const vgSet = new Set(
                pokedata.moves.flatMap(m => m.version_group_details.map(d => d.version_group.name))
            );
            pokedata.availableVersionGroups = VERSION_GROUP_ORDER
                .filter(vg => vgSet.has(vg))
                .map(vg => ({
                    id:    vg,
                    label: vg.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
                }));
        }

        // Fetch ability descriptions in parallel
        pokedata.abilityDetails = await Promise.all(
            pokedata.abilities.map(async (a) => {
                try {
                    const ar   = await fetch(`https://pokeapi.co/api/v2/ability/${a.ability.name}`);
                    const data = await ar.json();
                    const entry = data.effect_entries.find(e => e.language.name === 'en');
                    return {
                        name:        a.ability.name,
                        isHidden:    a.is_hidden,
                        shortEffect: entry ? entry.short_effect : '',
                    };
                } catch (err) {
                    return { name: a.ability.name, isHidden: a.is_hidden, shortEffect: '' };
                }
            })
        );

        // Fetch species data (flavor text, forms, evolution chain)
        try {
            const speciesRes = await fetch(pokedata.species.url);
            if (speciesRes.ok) {
                const speciesData = await speciesRes.json();
                pokedata.speciesId   = speciesData.id;
                pokedata.speciesName = speciesData.name;

                // Flavor text — latest English entry
                const enEntries = speciesData.flavor_text_entries.filter(e => e.language.name === 'en');
                if (enEntries.length > 0) {
                    const latest = enEntries[enEntries.length - 1];
                    pokedata.flavorText = latest.flavor_text.replace(/[\n\f\r]/g, ' ');
                    pokedata.flavorGame = latest.version.name
                        .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                } else {
                    pokedata.flavorText = '';
                    pokedata.flavorGame = '';
                }

                // Fetch forms + evolution chain in parallel; moves load lazily on the client
                const otherVarieties = speciesData.varieties.filter(v => v.pokemon.name !== pokedata.name);
                const [formResults, evoChainRes] = await Promise.all([
                    Promise.all(
                        otherVarieties.map(async (v) => {
                            try {
                                const formRes  = await fetch(v.pokemon.url);
                                const formData = await formRes.json();
                                const fTypes = formData.types.map(t => t.type.name);
                                const abilityDetails = await Promise.all(
                                    formData.abilities.map(async (a) => {
                                        try {
                                            const ar   = await fetch(`https://pokeapi.co/api/v2/ability/${a.ability.name}`);
                                            const data = await ar.json();
                                            const entry = data.effect_entries.find(e => e.language.name === 'en');
                                            return {
                                                name:        a.ability.name,
                                                isHidden:    a.is_hidden,
                                                shortEffect: entry ? entry.short_effect : '',
                                            };
                                        } catch (_) {
                                            return { name: a.ability.name, isHidden: a.is_hidden, shortEffect: '' };
                                        }
                                    })
                                );
                                return {
                                    name:             v.pokemon.name,
                                    artwork:          formData.sprites.other?.['official-artwork']?.front_default
                                                   || formData.sprites.front_default,
                                    artworkShiny:     formData.sprites.other?.['official-artwork']?.front_shiny || null,
                                    sprite:           formData.sprites.front_default,
                                    spriteShiny:      formData.sprites.front_shiny || null,
                                    types:            formData.types,
                                    typeEffectiveness: computeTypeEffectiveness(fTypes),
                                    stats:            formData.stats,
                                    height:           formData.height,
                                    weight:           formData.weight,
                                    baseExperience:   formData.base_experience,
                                    abilityDetails,
                                };
                            } catch (err) {
                                return null;
                            }
                        })
                    ),
                    fetch(speciesData.evolution_chain.url),
                ]);

                pokedata.forms               = formResults.filter(f => f !== null);
                pokedata.movesTable          = {};
                pokedata.movesVersionGroup   = '';
                pokedata.movesVersionGroupId = '';

                // Parse evolution chain into stages array
                if (evoChainRes.ok) {
                    const evoData  = await evoChainRes.json();
                    const evoStages = [];

                    const flattenChain = (node, depth) => {
                        if (!evoStages[depth]) evoStages[depth] = [];
                        const idMatch = node.species.url.match(/\/(\d+)\/$/);
                        const id = idMatch ? parseInt(idMatch[1]) : null;
                        if (id) {
                            const entry = { id, name: node.species.name, trigger: null };
                            const det = (node.evolution_details || [])[0];
                            if (det) {
                                if (det.min_level)      entry.trigger = `Lv. ${det.min_level}`;
                                else if (det.item)      entry.trigger = det.item.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                else if (det.trigger?.name === 'trade') entry.trigger = 'Trade';
                                else if (det.min_happiness) entry.trigger = 'Friendship';
                                else if (det.min_beauty)    entry.trigger = 'Beauty';
                                else if (det.known_move)    entry.trigger = det.known_move.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                else if (det.trigger)       entry.trigger = det.trigger.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                            }
                            evoStages[depth].push(entry);
                        }
                        for (const next of node.evolves_to) flattenChain(next, depth + 1);
                    };

                    flattenChain(evoData.chain, 0);
                    pokedata.evolutionStages = evoStages;
                } else {
                    pokedata.evolutionStages = [];
                }
            } else {
                pokedata.speciesId           = pokedata.id;
                pokedata.flavorText          = '';
                pokedata.flavorGame          = '';
                pokedata.forms               = [];
                pokedata.evolutionStages     = [];
                pokedata.movesTable          = {};
                pokedata.movesVersionGroup   = '';
                pokedata.movesVersionGroupId = '';
            }
        } catch (err) {
            pokedata.speciesId           = pokedata.id;
            pokedata.flavorText          = '';
            pokedata.flavorGame          = '';
            pokedata.forms               = [];
            pokedata.evolutionStages     = [];
            pokedata.movesTable          = {};
            pokedata.movesVersionGroup   = '';
            pokedata.movesVersionGroupId = '';
        }

        const sid = pokedata.speciesId || pokedata.id;
        pokedata.prevId = sid > 1    ? sid - 1    : null;
        pokedata.nextId = sid < 1025 ? sid + 1    : null;

        res.render('pokemon/entry', { pokemon: pokedata });
    } catch (err) {
        res.render('pokemon/not-found', { query: req.params.id });
    }
});

module.exports = router;
