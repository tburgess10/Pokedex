const express = require('express');
const router = express.Router();

router.get('/:name', async (req, res) => {
    try {
        const abilityRes = await fetch(`https://pokeapi.co/api/v2/ability/${req.params.name.toLowerCase()}`);
        if (!abilityRes.ok) {
            return res.status(404).render('abilities/not-found', { query: req.params.name });
        }
        const data = await abilityRes.json();

        const enEntry = data.effect_entries.find(e => e.language.name === 'en');
        const displayName = data.name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
        const generation = data.generation.name
            .replace('generation-', 'Gen ')
            .toUpperCase();

        const pokemon = data.pokemon
            .map(p => {
                const idMatch = p.pokemon.url.match(/\/(\d+)\/$/);
                const id = idMatch ? parseInt(idMatch[1]) : null;
                if (!id) return null;
                return {
                    name:        p.pokemon.name,
                    displayName: p.pokemon.name.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' '),
                    id,
                    isHidden: p.is_hidden,
                    sprite:   `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.id - b.id);

        res.render('abilities/entry', {
            ability: {
                name:        data.name,
                displayName,
                generation,
                effect:      enEntry ? enEntry.effect.replace(/\n/g, ' ')      : '',
                shortEffect: enEntry ? enEntry.short_effect : '',
                pokemon,
            }
        });
    } catch (err) {
        res.status(404).render('abilities/not-found', { query: req.params.name });
    }
});

module.exports = router;
