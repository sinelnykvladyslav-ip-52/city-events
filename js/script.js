const HOLIDAYS_API_URL = 'https://date.nager.at/api/v3/PublicHolidays/2026/UA';
const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'savedEvents';
const MIGRATED_KEY = 'savedEventsMigrated';
const DB_NAME = 'CityEventsDB';
const DB_VERSION = 1;
const STORE_NAME = 'savedEvents';
const PROGRESS_DAYS = 60;
const UPCOMING_LIMIT = 4;

console.log('script.js підключено');

const events = [
  { id: 1, title: 'Berliner Döner', category: 'concert', date: '2026-10-09T19:00', place: 'POP UP', address: 'Київ, Кирилівська, 60', image: 'assets/img/a0e3.jpg_v35-banner' },
  { id: 2, title: 'Імпровізаційний тур', category: 'standup', date: '2026-09-25T19:00', place: 'Київський культурний кластер "Краків"', address: 'Київ, вул. Русанівська Набережна, 12', image: 'assets/img/8a6d.jpg_v35-banner' },
  { id: 3, title: 'Дуже сумна людина', category: 'theatre', date: '2026-10-02T18:30', place: 'Тернопільська обласна філармонія', address: 'Тернопіль, вул. Князя Острозького, 11', image: 'assets/img/9440.jpg_v35-banner' },
  { id: 4, title: 'Симфонічний вечір музики Мирослава Скорика', category: 'concert', date: '2026-10-17T19:00', place: 'Національна філармонія України', address: 'Київ, Володимирський узвіз, 2' },
  { id: 5, title: 'Лісова пісня', category: 'theatre', date: '2026-10-24T18:00', place: 'Театр імені Івана Франка', address: 'Київ, пл. Івана Франка, 3' },
  { id: 6, title: 'Відкритий мікрофон для початківців', category: 'standup', date: '2026-10-30T20:00', place: 'Underground Stand Up Club', address: 'Київ, вул. Ярославська, 6' },
  { id: 7, title: 'Джазовий квартет під відкритим небом', category: 'concert', date: '2026-11-07T17:00', place: 'Арт-простір «Платформа»', address: 'Київ, вул. Біломорська, 1' },
];

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
  holiday: 'Свято',
};

const hasTime = isoDate => isoDate.includes('T');
const parseEventDate = isoDate => new Date(hasTime(isoDate) ? isoDate : `${isoDate}T00:00`);
const startOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

function pluralDays(n) {
  const lastDigit = n % 10;
  const lastTwoDigits = n % 100;
  if (lastDigit === 1 && lastTwoDigits !== 11) {
    return 'день';
  }
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
    return 'дні';
  }
  return 'днів';
}

function daysUntil(isoDate) {
  return Math.round((startOfDay(parseEventDate(isoDate)) - startOfDay(new Date())) / DAY_MS);
}

function daysLabel(daysLeft) {
  const days = Math.abs(daysLeft);
  if (daysLeft === 0) {
    return 'Сьогодні';
  }
  if (daysLeft === 1) {
    return 'Завтра';
  }
  if (daysLeft > 1) {
    return `Через ${days} ${pluralDays(days)}`;
  }
  if (daysLeft === -1) {
    return 'Відбулася вчора';
  }
  return `Відбулася ${days} ${pluralDays(days)} тому`;
}

function progressPercent(daysLeft) {
  if (daysLeft <= 0) {
    return 100;
  }
  return Math.max(0, Math.round((1 - daysLeft / PROGRESS_DAYS) * 100));
}

function eventLocation(event) {
  if (event.place) {
    return `${event.place}, ${event.address}`;
  }
  return event.category === 'holiday' ? 'Україна' : 'Місце уточнюється';
}

function toSavedEvent(event) {
  return {
    id: event.id,
    date: event.date,
    name: event.title,
    location: eventLocation(event),
  };
}

function saveToLocalStorage(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch (error) {
    console.error('Пошкоджені дані в localStorage:', error);
    return [];
  }
}

let dbPromise = null;

function openDB() {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB не підтримується в цьому браузері'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function addItem(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllItems() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function deleteItem(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function migrateFromLocalStorage() {
  if (localStorage.getItem(MIGRATED_KEY) === 'true') {
    return 0;
  }
  const oldItems = loadFromLocalStorage();
  const storedItems = await getAllItems();
  let moved = 0;
  if (storedItems.length === 0 && oldItems.length > 0) {
    for (const item of oldItems) {
      await addItem(item);
    }
    moved = oldItems.length;
  }
  localStorage.setItem(MIGRATED_KEY, 'true');
  return moved;
}

const DaysProgress = {
  props: {
    daysLeft: { type: Number, required: true },
  },
  data() {
    return { ready: false };
  },
  computed: {
    percent() {
      return progressPercent(this.daysLeft);
    },
  },
  mounted() {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      this.ready = true;
    }));
  },
  template: `
    <div class="days-progress" :class="{ 'days-progress--past': daysLeft < 0 }" aria-hidden="true">
      <div class="days-progress__fill" :style="{ width: (ready ? percent : 0) + '%' }"></div>
    </div>
  `,
};

const EventCard = {
  components: { DaysProgress },
  props: {
    title: { type: String, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true },
    image: String,
    place: String,
    address: String,
    note: String,
    saved: Boolean,
  },
  emits: ['toggle-save'],
  computed: {
    eventDate() {
      return parseEventDate(this.date);
    },
    daysLeft() {
      return daysUntil(this.date);
    },
    daysText() {
      return daysLabel(this.daysLeft);
    },
    categoryLabel() {
      return categoryLabels[this.category] ?? this.category;
    },
    monthText() {
      return this.eventDate.toLocaleDateString('uk-UA', { month: 'short' });
    },
    timeText() {
      if (!hasTime(this.date)) {
        return this.eventDate.toLocaleDateString('uk-UA', { weekday: 'long' });
      }
      const weekday = this.eventDate.toLocaleDateString('uk-UA', { weekday: 'short' });
      const time = this.eventDate.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      return `${weekday}, ${time}`;
    },
  },
  template: `
    <article class="card" :class="'category-' + category" :data-category="category">
      <div class="card-head">
        <time class="card-date" :datetime="date">
          <span class="card-date__day">{{ eventDate.getDate() }}</span>
          <span class="card-date__month">{{ monthText }}</span>
          <span class="card-date__year">{{ eventDate.getFullYear() }}</span>
        </time>
        <p class="category">{{ categoryLabel }}</p>
      </div>
      <h3>{{ title }}</h3>
      <p class="card-days" :class="{ 'card-days--today': daysLeft === 0, 'card-days--past': daysLeft < 0 }">{{ daysText }}</p>
      <days-progress :days-left="daysLeft"></days-progress>
      <img v-if="image" :src="image" :alt="title">
      <p class="card-time">{{ timeText }}</p>
      <p v-if="note" class="card-note">{{ note }}</p>
      <p v-if="place" class="card-place"><strong>{{ place }}</strong><br>{{ address }}</p>
      <div class="card-actions">
        <button type="button" class="card-save" :class="{ 'card-save--active': saved }" @click="$emit('toggle-save')">
          <span aria-hidden="true">{{ saved ? '★' : '☆' }}</span> {{ saved ? 'Прибрати з обраного' : 'Додати в обране' }}
        </button>
      </div>
    </article>
  `,
};

Vue.createApp({
  components: { EventCard, DaysProgress },
  data() {
    return {
      events: events.map(event => ({ ...event })),
      activeCategory: 'all',
      categoryFilters: [
        { value: 'all', label: 'УСІ КАТЕГОРІЇ' },
        { value: 'concert', label: 'КОНЦЕРТИ' },
        { value: 'theatre', label: 'ТЕАТР' },
        { value: 'standup', label: 'СТЕНДАП' },
      ],
      newTitle: '',
      newCategory: '',
      newDate: '',
      titleError: '',
      holidays: [],
      holidaysLoading: false,
      holidaysError: '',
      savedEvents: [],
      useLocalStorage: false,
      storageError: '',
    };
  },
  computed: {
    visibleEvents() {
      if (this.activeCategory === 'all') {
        return this.events;
      }
      return this.events.filter(event => event.category === this.activeCategory);
    },
    countText() {
      return this.activeCategory === 'all'
        ? `Усього подій: ${this.events.length}`
        : `Показано подій: ${this.visibleEvents.length} з ${this.events.length}`;
    },
    savedIds() {
      return new Set(this.savedEvents.map(item => item.id));
    },
    sortedSaved() {
      return [...this.savedEvents].sort((a, b) => a.date.localeCompare(b.date));
    },
    upcomingEvents() {
      const byId = new Map();
      [...this.events, ...this.holidays].map(toSavedEvent).concat(this.savedEvents)
        .forEach(item => byId.set(item.id, item));
      return [...byId.values()]
        .map(item => ({ ...item, daysLeft: daysUntil(item.date) }))
        .filter(item => item.daysLeft >= 0)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, UPCOMING_LIMIT)
        .map(item => ({ ...item, daysText: daysLabel(item.daysLeft) }));
    },
  },
  methods: {
    validateTitle() {
      const input = this.$refs.titleInput;
      const length = input.value.trim().length;
      if (length === 0) {
        input.setCustomValidity('Введіть назву події');
      } else if (length < 3) {
        input.setCustomValidity('Назва події має містити щонайменше 3 символи');
      } else {
        input.setCustomValidity('');
      }
      this.titleError = input.validationMessage;
    },
    addEvent() {
      const newEvent = {
        id: Date.now(),
        title: this.newTitle.trim(),
        category: this.newCategory,
        date: this.newDate,
      };
      this.events.push(newEvent);
      console.log(`Додано подію «${newEvent.title}», усього подій: ${this.events.length}`);

      if (this.activeCategory !== newEvent.category) {
        this.activeCategory = 'all';
      }

      this.newTitle = '';
      this.newCategory = '';
      this.newDate = '';
      this.titleError = '';
      this.$refs.form.reset();
    },
    async loadHolidays(url = HOLIDAYS_API_URL) {
      this.holidaysLoading = true;
      this.holidaysError = '';
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          const error = new Error(`Сервер відповів кодом ${response.status}`);
          error.status = response.status;
          throw error;
        }
        const data = await response.json();
        console.log('Свята з API Nager.Date:', data);
        this.holidays = data.map(holiday => ({
          id: `${holiday.date}-${holiday.name}`,
          title: holiday.localName,
          category: 'holiday',
          date: holiday.date,
          note: holiday.name,
        }));
      } catch (error) {
        this.holidays = [];
        this.holidaysError = error.status === 404
          ? 'Дані про події не знайдено'
          : 'Не вдалося завантажити свята. Перевірте з\'єднання й натисніть «Оновити».';
        console.error('Помилка завантаження свят:', error);
      } finally {
        this.holidaysLoading = false;
      }
    },
    async loadSaved() {
      try {
        const moved = await migrateFromLocalStorage();
        if (moved > 0) {
          console.log(`Перенесено з localStorage в IndexedDB подій: ${moved}`);
        }
        this.savedEvents = await getAllItems();
      } catch (error) {
        console.error('Не вдалося відкрити IndexedDB:', error);
        this.useLocalStorage = true;
        this.storageError = 'Базу IndexedDB не вдалося відкрити (можливо, увімкнено приватний перегляд). Обране зберігатиметься лише в localStorage.';
        this.savedEvents = loadFromLocalStorage();
      }
    },
    async saveEvent(event) {
      const record = toSavedEvent(event);
      if (this.useLocalStorage) {
        this.savedEvents = [...this.savedEvents, record];
        saveToLocalStorage(this.savedEvents);
      } else {
        await addItem(record);
        this.savedEvents = await getAllItems();
      }
    },
    async removeSaved(id) {
      if (this.useLocalStorage) {
        this.savedEvents = this.savedEvents.filter(item => item.id !== id);
        saveToLocalStorage(this.savedEvents);
      } else {
        await deleteItem(id);
        this.savedEvents = await getAllItems();
      }
    },
    async toggleSaved(event) {
      try {
        if (this.savedIds.has(event.id)) {
          await this.removeSaved(event.id);
        } else {
          await this.saveEvent(event);
        }
      } catch (error) {
        console.error('Не вдалося оновити обране:', error);
        this.storageError = 'Не вдалося оновити обране. Спробуйте ще раз.';
      }
    },
    savedDateText(isoDate) {
      const date = parseEventDate(isoDate);
      const day = date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
      if (!hasTime(isoDate)) {
        return day;
      }
      return `${day}, ${date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`;
    },
  },
  mounted() {
    this.loadSaved();
    this.loadHolidays();
  },
}).mount('#app');
