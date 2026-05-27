const express = require('express');
const router = express.Router();


router.get('/:id', async (req, res) => {
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${req.params.id}`);
    const pokedata = await response.json();
    console.log(pokedata);
    pokedata.capName = pokedata.name.charAt(0).toUpperCase() + pokedata.name.slice(1);
    res.render('pokemon/entry', { pokemon: pokedata });
});

module.exports = router;
