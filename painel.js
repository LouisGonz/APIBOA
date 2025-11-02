// painel.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const bodyParser = require('body-parser');
const session = require('express-session');

const API_KEYS_FILE = path.join(__dirname, 'apiKeys.json');

function startPainel(app) {
  // Middleware
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json());
  app.use(session({
    secret: 'paineladmsecret',
    resave: false,
    saveUninitialized: true
  }));
  app.use(express.static(path.join(__dirname, 'public')));
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));

  // Funções de keys
  function loadKeys() {
    if(!fs.existsSync(API_KEYS_FILE)) fs.writeFileSync(API_KEYS_FILE, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
  }
  function saveKeys(keys) {
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(keys, null, 2));
  }

  function checkAuth(req, res, next) {
    if(req.session.loggedIn) return next();
    res.redirect('/login');
  }

  // Login
  app.get('/login', (req, res) => res.render('login'));
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if(username === 'admin' && password === '123456') {
      req.session.loggedIn = true;
      res.redirect('/dashboard');
    } else {
      res.render('login', { error: 'Usuário ou senha incorretos' });
    }
  });

  // Dashboard
  app.get('/dashboard', checkAuth, (req, res) => {
    const keys = loadKeys();
    res.render('dashboard', { keys });
  });

  // Criar, resetar, deletar keys
  app.post('/keys/create', checkAuth, (req, res) => {
    const { key, limit } = req.body;
    const keys = loadKeys();
    if(keys[key]) return res.send('Key já existe');
    keys[key] = { used: 0, limit: Number(limit) };
    saveKeys(keys);
    res.redirect('/dashboard');
  });
  app.post('/keys/reset', checkAuth, (req, res) => {
    const { key } = req.body;
    const keys = loadKeys();
    if(keys[key]) keys[key].used = 0;
    saveKeys(keys);
    res.redirect('/dashboard');
  });
  app.post('/keys/delete', checkAuth, (req, res) => {
    const { key } = req.body;
    const keys = loadKeys();
    delete keys[key];
    saveKeys(keys);
    res.redirect('/dashboard');
  });

  // Logout
  app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
  });
}

module.exports = { startPainel };