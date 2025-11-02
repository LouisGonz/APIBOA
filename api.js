const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const app = express();
const port = 3000;
const ytdlp = require('yt-dlp-exec');
const yts = require('yt-search');

const API_KEYS_FILE = path.join(__dirname, 'apiKeys.json');
const FRASES_FILE = path.join(__dirname, 'frases.json');
// ✅ SERVE a pasta public (para CSS, JS, imagens)
app.use(express.static(path.join(__dirname, 'public')));

// Importa e inicia painel junto
const { startPainel } = require('./painel');
startPainel(app);

// Middleware para verificar chave
app.use((req, res, next) => {
  const key = req.query.key;
  if (!key) return res.status(401).json({ message: 'Chave da API é obrigatória' });

  const apiKeys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
  if(apiKeys[key]){
    if(apiKeys[key].used < apiKeys[key].limit){
      req.apiKey = key;
      next();
    } else {
      res.status(403).json({ message: 'Limite de uso excedido para esta chave.' });
    }
  } else {
    res.status(401).json({ message: 'Chave da API inválida.' });
  }
});

function incrementKeyUsage(key){
  const keys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
  if(keys[key]){
    keys[key].used += 1;
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(keys, null, 2));
  }
}

// Endpoint frases
app.get('/frases', (req, res) => {
  const data = fs.readFileSync(FRASES_FILE, 'utf8');
  const frases = JSON.parse(data).frases;
  const randomIndex = Math.floor(Math.random() * frases.length);
  incrementKeyUsage(req.apiKey);
  res.json({
    status: 'success',
    data: { frase: frases[randomIndex] },
    message: 'Frase retornada com sucesso'
  });
});

// Endpoint uso da key
app.get('/uso', (req, res) => {
  const keys = JSON.parse(fs.readFileSync(API_KEYS_FILE, 'utf8'));
  const keyData = keys[req.apiKey];
  res.json({
    status: 'success',
    data: {
      used: keyData.used,
      limit: keyData.limit,
      remaining: keyData.limit - keyData.used
    }
  });
});

// Endpoint exemplo CEP
app.get('/consulta/:cep', async (req, res) => {
  try {
    const { cep } = req.params;
    const response = await axios.get(`https://viacep.com.br/ws/${cep}/json/`);
    incrementKeyUsage(req.apiKey);
    res.json({ status: 'success', data: response.data });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Erro ao consultar CEP' });
  }
});

app.get('/download', async (req, res) => {
  const { nome, info } = req.query; // info=true retorna só JSON
  if (!nome) return res.status(400).json({ message: 'Informe o nome da música!' });

  try {
    incrementKeyUsage(req.apiKey);

    // Busca a música no YouTube
    const searchResult = await yts(nome);
    if (!searchResult.videos.length) return res.status(404).json({ message: 'Música não encontrada' });

    const video = searchResult.videos[0];
    const videoUrl = video.url;
    const title = video.title;
    const duration = video.seconds; // duração em segundos
    const description = video.description;

    if (info === 'true') {
      // Retorna apenas JSON com informações
      return res.json({
        status: 'success',
        data: {
          title,
          duration,
          description,
          url: videoUrl
        }
      });
    }

    // Nome do arquivo temporário
    const tempFile = path.join(__dirname, `${title.replace(/[\/\\?%*:|"<>]/g, '-')}.mp3`);

    // Baixa áudio
    await ytdlp(videoUrl, {
      extractAudio: true,
      audioFormat: 'mp3',
      output: tempFile,
      quiet: true
    });

    res.download(tempFile, `${title}.mp3`, (err) => {
      if (err) console.error(err);
      fs.unlinkSync(tempFile);
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao processar vídeo', error: err.message });
  }
});

app.listen(port, () => console.log(`API rodando em http://localhost:${port}`));