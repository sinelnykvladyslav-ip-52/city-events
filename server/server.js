const path = require('path');
const express = require('express');
const events = require('./events.json');

const PORT = process.env.PORT || 3000;
const CLIENT_DIR = path.join(__dirname, '..');

const app = express();

app.use((req, res, next) => {
  res.on('finish', () => console.log(`${req.method} ${req.originalUrl} → ${res.statusCode}`));
  next();
});

app.get('/api/events', (req, res) => {
  res.json(events);
});

app.get('/api/events/:id', (req, res) => {
  const event = events.find(item => String(item.id) === req.params.id);
  if (!event) {
    return res.status(404).json({ error: `Подію з id «${req.params.id}» не знайдено` });
  }
  res.json(event);
});

app.get('/', (req, res) => {
  res.sendFile(path.join(CLIENT_DIR, 'index.html'));
});

for (const dir of ['css', 'js', 'assets']) {
  app.use(`/${dir}`, express.static(path.join(CLIENT_DIR, dir)));
}

app.use((req, res) => {
  res.status(404).json({ error: `Шлях «${req.path}» не знайдено` });
});

app.listen(PORT, () => {
  console.log(`Сервер запущено на http://localhost:${PORT}`);
});
