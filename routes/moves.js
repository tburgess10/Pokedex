const express = require('express');
const router = express.Router();

let moveList = null;
async function getMoveList() {
    if (moveList) return moveList;
    const res = await fetch('https://pokeapi.co/api/v2/move?limit=1000');
    const data = await res.json();
    moveList = data.results.map(m => m.name);
    return moveList;
}

router.get('/', async (req, res) => {
    try {
        const cap  = w => w.charAt(0).toUpperCase() + w.slice(1);
        const list = await getMoveList();
        const moves = list
            .map(name => ({ name, displayName: name.split('-').map(cap).join(' ') }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));
        res.render('moves/index', { moves });
    } catch (_) {
        res.render('moves/index', { moves: [] });
    }
});

router.get('/search', async (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase().replace(/ /g, '-');
    if (q.length < 2) return res.json([]);
    try {
        const list = await getMoveList();
        const matches = list.filter(name => name.startsWith(q)).slice(0, 8);
        res.json(matches);
    } catch (_) {
        res.json([]);
    }
});

router.get('/:name', async (req, res) => {
    try {
        const moveRes = await fetch(`https://pokeapi.co/api/v2/move/${req.params.name.toLowerCase()}`);
        if (!moveRes.ok) {
            return res.status(404).render('moves/not-found', { query: req.params.name });
        }
        const data = await moveRes.json();

        const enEntry = data.effect_entries.find(e => e.language.name === 'en');
        const displayName = data.name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
        const generation = data.generation.name
            .replace('generation-', 'Gen ')
            .toUpperCase();

        const pokemon = (data.learned_by_pokemon || [])
            .map(p => {
                const idMatch = p.url.match(/\/(\d+)\/$/);
                const id = idMatch ? parseInt(idMatch[1]) : null;
                if (!id) return null;
                return {
                    name:        p.name,
                    displayName: p.name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
                    id,
                    sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
                };
            })
            .filter(p => p && p.id <= 1025)
            .sort((a, b) => a.id - b.id);

        res.render('moves/entry', {
            move: {
                name:        data.name,
                displayName,
                generation,
                type:        data.type?.name        || null,
                damageClass: data.damage_class?.name || null,
                power:       data.power,
                accuracy:    data.accuracy,
                pp:          data.pp,
                effect:      enEntry ? enEntry.effect.replace(/\n/g, ' ')      : '',
                shortEffect: enEntry ? enEntry.short_effect : '',
                pokemon,
            }
        });
    } catch (err) {
        res.status(404).render('moves/not-found', { query: req.params.name });
    }
});

module.exports = router;
