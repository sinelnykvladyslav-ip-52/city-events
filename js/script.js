console.log('script.js підключено');

const events = [
  { title: 'Berliner Döner', category: 'concert', date: '2026-10-09T19:00', place: 'POP UP', address: 'Київ, Кирилівська, 60', image: 'assets/img/a0e3.jpg_v35-banner' },
  { title: 'Імпровізаційний тур', category: 'standup', date: '2026-09-25T19:00', place: 'Київський культурний кластер "Краків"', address: 'Київ, вул. Русанівська Набережна, 12', image: 'assets/img/8a6d.jpg_v35-banner' },
  { title: 'Дуже сумна людина', category: 'theatre', date: '2026-10-02T18:30', place: 'Тернопільська обласна філармонія', address: 'Тернопіль, вул. Князя Острозького, 11', image: 'assets/img/9440.jpg_v35-banner' },
  { title: 'Симфонічний вечір музики Мирослава Скорика', category: 'concert', date: '2026-10-17T19:00', place: 'Національна філармонія України', address: 'Київ, Володимирський узвіз, 2' },
  { title: 'Лісова пісня', category: 'theatre', date: '2026-10-24T18:00', place: 'Театр імені Івана Франка', address: 'Київ, пл. Івана Франка, 3' },
  { title: 'Відкритий мікрофон для початківців', category: 'standup', date: '2026-10-30T20:00', place: 'Underground Stand Up Club', address: 'Київ, вул. Ярославська, 6' },
  { title: 'Джазовий квартет під відкритим небом', category: 'concert', date: '2026-11-07T17:00', place: 'Арт-простір «Платформа»', address: 'Київ, вул. Біломорська, 1' },
];

const listContainer = document.querySelector('#events-list');
const eventsCount = document.querySelector('#events-count');

function classifyEvent(event) {
  if (event.category === 'concert') {
    return 'Концерт — жива музика';
  } else if (event.category === 'theatre') {
    return 'Театр — вистава на сцені';
  } else if (event.category === 'standup') {
    return 'Стендап — гумористичний виступ';
  } else {
    return 'Інша подія';
  }
}

const shorten = (text, n) => (text.length > n ? text.slice(0, n) + '…' : text);

function printEventsByCategory(list, category) {
  console.log(`Події категорії «${category}»:`);
  let count = 0;
  for (const event of list) {
    if (event.category === category) {
      count++;
      console.log(`  ${count}. ${shorten(event.title, 20)}`);
    }
  }
  console.log(`Усього подій категорії «${category}»: ${count}`);
  return count;
}

function printAllEvents(list) {
  console.log(`Усього подій в афіші: ${list.length}`);
  for (let i = 0; i < list.length; i++) {
    console.log(`${i + 1}. ${list[i].title} — ${classifyEvent(list[i])}`);
  }
}

printAllEvents(events);
printEventsByCategory(events, 'concert');
printEventsByCategory(events, 'theatre');

console.log(shorten(events[3].title, 25));
console.log(shorten(events[0].title, 25));

const categoryLabels = {
  concert: 'Концерти',
  theatre: 'Театр',
  standup: 'Стендап',
};

document.querySelectorAll('#events-list .card').forEach(card => card.remove());

function createDateTile(isoDate) {
  const date = new Date(isoDate);
  const time = document.createElement('time');
  time.className = 'card-date';
  time.setAttribute('datetime', isoDate);

  const day = document.createElement('span');
  day.className = 'card-date__day';
  day.textContent = date.getDate();

  const month = document.createElement('span');
  month.className = 'card-date__month';
  month.textContent = date.toLocaleDateString('uk-UA', { month: 'short' });

  const year = document.createElement('span');
  year.className = 'card-date__year';
  year.textContent = date.getFullYear();

  time.append(day, month, year);
  return time;
}

function renderEvents(list) {
  listContainer.innerHTML = '';

  list.forEach(event => {
    const card = document.createElement('article');
    card.classList.add('card');
    card.dataset.category = event.category;

    if (event.category in categoryLabels) {
      card.classList.add(`category-${event.category}`);
    }

    const head = document.createElement('div');
    head.className = 'card-head';

    const category = document.createElement('p');
    category.className = 'category';
    category.textContent = categoryLabels[event.category] ?? event.category;

    head.append(createDateTile(event.date), category);

    const title = document.createElement('h3');
    title.textContent = event.title;

    card.append(head, title);

    if (event.image) {
      const img = document.createElement('img');
      img.src = event.image;
      img.alt = event.title;
      card.append(img);
    }

    const date = new Date(event.date);
    const time = document.createElement('p');
    time.className = 'card-time';
    time.textContent = `${date.toLocaleDateString('uk-UA', { weekday: 'short' })}, ${date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;

    const place = document.createElement('p');
    place.className = 'card-place';
    const placeName = document.createElement('strong');
    placeName.textContent = event.place;
    place.append(placeName, document.createElement('br'), event.address);

    card.append(time, place);
    listContainer.append(card);
  });
}

function updateEventsCount(list) {
  eventsCount.textContent = `Усього подій: ${list.length}`;
}

renderEvents(events);
updateEventsCount(events);
