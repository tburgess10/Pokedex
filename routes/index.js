const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', { title: 'Home', message: 'Welcome to my Node.js website!' });
});

router.get('/about', (req, res) => {
  res.render('about', { title: 'About' });
});

module.exports = router;
