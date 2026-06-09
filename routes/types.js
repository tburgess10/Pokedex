const express = require('express');
const router = express.Router();

router.get('/:name', async (req, res) => {
    try {
        const typeRes = await fetch(`https://pokeapi.co/api/v2/type/${req.params.name.toLowerCase()}`);
        if (!typeRes.ok) {
            return res.status(404).render('types/not-found', { query: req.params.name });
        }
        const data = await typeRes.json();
        const dr   = data.damage_relations;
        const cap  = w => w.charAt(0).toUpperCase() + w.slice(1);

        const pokemon = data.pokemon
            .map(p => {
                const idMatch = p.pokemon.url.match(/\/(\d+)\/$/);
                const id = idMatch ? parseInt(idMatch[1]) : null;
                if (!id || id > 1025) return null;
                return {
                    name:        p.pokemon.name,
                    displayName: p.pokemon.name.split('-').map(cap).join(' '),
                    id,
                    sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.id - b.id);

        const moves = data.moves
            .map(m => ({
                name:        m.name,
                displayName: m.name.split('-').map(cap).join(' '),
            }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName));

        res.render('types/entry', {
            type: {
                name:        data.name,
                displayName: cap(data.name),
                offense: {
                    superEffective:  dr.double_damage_to.map(t => t.name),
                    notVeryEffective: dr.half_damage_to.map(t => t.name),
                    noEffect:        dr.no_damage_to.map(t => t.name),
                },
                defense: {
                    weakTo:   dr.double_damage_from.map(t => t.name),
                    resists:  dr.half_damage_from.map(t => t.name),
                    immuneTo: dr.no_damage_from.map(t => t.name),
                },
                pokemon,
                moves,
            }
        });
    } catch (err) {
        res.status(404).render('types/not-found', { query: req.params.name });
    }
});

module.exports = router;
