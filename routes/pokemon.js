const express = require('express');
const router = express.Router();

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

router.get('/:id', async (req, res) => {
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${req.params.id}`);
        if (!response.ok) {
            return res.render('pokemon/not-found', { query: req.params.id });
        }
        const pokedata = await response.json();
        pokedata.capName = pokedata.name.charAt(0).toUpperCase() + pokedata.name.slice(1);

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

        // Fetch alternate forms from species data
        try {
            const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pokedata.id}`);
            if (speciesRes.ok) {
                const speciesData = await speciesRes.json();

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

                const otherVarieties = speciesData.varieties.filter(v => !v.is_default);
                const formResults = await Promise.all(
                    otherVarieties.map(async (v) => {
                        try {
                            const formRes  = await fetch(v.pokemon.url);
                            const formData = await formRes.json();
                            return {
                                name:         v.pokemon.name,
                                artwork:      formData.sprites.other?.['official-artwork']?.front_default
                                           || formData.sprites.front_default,
                                artworkShiny: formData.sprites.other?.['official-artwork']?.front_shiny || null,
                                sprite:       formData.sprites.front_default,
                                spriteShiny:  formData.sprites.front_shiny || null,
                                types:        formData.types,
                            };
                        } catch (err) {
                            return null;
                        }
                    })
                );
                pokedata.forms = formResults.filter(f => f !== null);
            } else {
                pokedata.flavorText = '';
                pokedata.flavorGame = '';
                pokedata.forms = [];
            }
        } catch (err) {
            pokedata.flavorText = '';
            pokedata.flavorGame = '';
            pokedata.forms = [];
        }

        res.render('pokemon/entry', { pokemon: pokedata });
    } catch (err) {
        res.render('pokemon/not-found', { query: req.params.id });
    }
});

module.exports = router;
