const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const indexRouter    = require('./routes/index');
const pokemonRouter  = require('./routes/pokemon');
const pokedexRouter  = require('./routes/pokedex');
const abilitiesRouter = require('./routes/abilities');
const movesRouter     = require('./routes/moves');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'", "'unsafe-inline'"],
            styleSrc:    ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc:     ["'self'", 'https://fonts.gstatic.com'],
            imgSrc:      ["'self'", 'data:', 'https://raw.githubusercontent.com', 'https://pokeapi.co'],
            connectSrc:  ["'self'", 'https://pokeapi.co'],
        },
    },
}));

// Note: in-memory limiter is per-serverless-instance on Vercel.
// Effective for abuse bursts; not a global cap across all instances.
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/', indexRouter);
app.use('/pokemon', pokemonRouter);
app.use('/pokedex', pokedexRouter);
app.use('/abilities', abilitiesRouter);
app.use('/moves',     movesRouter);

// Export for Vercel (serverless). Only bind a port when run directly locally.
module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
