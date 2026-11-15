// Практикум 6. Основи JavaScript — варіант 5 «Афіша культурних подій міста»

console.log('script.js підключено');

// Дані: масив подій афіші (назва й категорія)
const events = [
  { title: 'Berliner Döner', category: 'concert' },
  { title: 'Імпровізаційний тур', category: 'standup' },
  { title: 'Дуже сумна людина', category: 'theatre' },
  { title: 'Симфонічний вечір музики Мирослава Скорика', category: 'concert' },
  { title: 'Лісова пісня', category: 'theatre' },
  { title: 'Відкритий мікрофон для початківців', category: 'standup' },
  { title: 'Джазовий квартет під відкритим небом', category: 'concert' },
];

// Повертає текстову назву категорії події та її опис (умовна класифікація if/else)
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

// Скорочує текст до n символів і додає «…», якщо текст довший
const shorten = (text, n) => (text.length > n ? text.slice(0, n) + '…' : text);

// Виводить у консоль події заданої категорії та повертає їх кількість (цикл for...of)
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

// Виводить кожну подію з класифікацією за категорією (цикл for з лічильником)
function printAllEvents(list) {
  console.log(`Усього подій в афіші: ${list.length}`);
  for (let i = 0; i < list.length; i++) {
    console.log(`${i + 1}. ${list[i].title} — ${classifyEvent(list[i])}`);
  }
}

printAllEvents(events);
printEventsByCategory(events, 'concert');
printEventsByCategory(events, 'theatre');

// Демонстрація стрілкової функції shorten на реальних назвах подій
console.log(shorten(events[3].title, 25)); // довга назва — буде скорочена
console.log(shorten(events[0].title, 25)); // коротка назва — без змін
