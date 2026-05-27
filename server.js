const express = require('express');
const path = require('path');
const indexRouter = require('./routes/index');
const pokemonRouter = require('./routes/pokemon');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/', indexRouter);
app.use('/pokemon', pokemonRouter);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
