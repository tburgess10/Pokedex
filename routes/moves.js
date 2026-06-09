const express = require('express');
const router = express.Router();

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
