const EVENTS_API_URL = '/api/events';
const DAY_MS = 24 * 60 * 60 * 1000;
const STORAGE_KEY = 'savedEvents';
const MIGRATED_KEY = 'savedEventsMigrated';
const DB_NAME = 'CityEventsDB';
const DB_VERSION = 1;
const STORE_NAME = 'savedEvents';
const PROGRESS_DAYS = 60;
const UPCOMING_LIMIT = 4;

console.log('script.js підключено');

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

const categoryLabels = {
  concert: 'Концерти',
  theatre: 'Театр',
  standup: 'Стендап',
  saved: 'Обране',
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
  if (event.location) {
    return event.location;
  }
  return 'Місце уточнюється';
}

function toSavedEvent(event) {
  return {
    id: event.id,
    date: event.date,
    name: event.title,
    location: eventLocation(event),
  };
}

function fromSavedEvent(record) {
  return {
    id: record.id,
    title: record.name,
    category: 'saved',
    date: record.date,
    location: record.location,
  };
}

function eventHref(id) {
  return `#/events/${encodeURIComponent(id)}`;
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
    id: { type: [Number, String], required: true },
    title: { type: String, required: true },
    category: { type: String, required: true },
    date: { type: String, required: true },
    image: String,
    place: String,
    address: String,
    note: String,
    saved: Boolean,
    linked: { type: Boolean, default: true },
  },
  emits: ['toggle-save'],
  computed: {
    href() {
      return eventHref(this.id);
    },
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
      <h3><a v-if="linked" :href="href" data-link>{{ title }}</a><template v-else>{{ title }}</template></h3>
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

const NotFoundView = {
  inject: ['app'],
  props: {
    title: { type: String, default: 'СТОРІНКУ НЕ ЗНАЙДЕНО' },
    text: String,
  },
  computed: {
    message() {
      return this.text ?? `За адресою «#${this.app.path}» в афіші нічого немає.`;
    },
  },
  template: '#not-found-view',
};

const HomeView = {
  inject: ['app'],
  components: { EventCard, DaysProgress },
  template: '#home-view',
};

const EventView = {
  inject: ['app'],
  components: { EventCard, NotFoundView },
  props: {
    id: { type: String, required: true },
  },
  computed: {
    event() {
      return this.app.findEvent(this.id);
    },
    details() {
      return [
        { label: 'Тип', value: classifyEvent(this.event) },
        { label: 'Дата', value: this.app.savedDateText(this.event.date) },
        { label: 'Місце', value: eventLocation(this.event) },
      ];
    },
  },
  template: '#event-view',
};

const SavedView = {
  inject: ['app'],
  template: '#saved-view',
};

const routes = [
  { path: '/', view: HomeView },
  { path: '/events/:id', view: EventView },
  { path: '/saved', view: SavedView },
];

function matchRoute(path) {
  const pathParts = path.split('/').filter(Boolean);
  for (const route of routes) {
    const routeParts = route.path.split('/').filter(Boolean);
    if (routeParts.length !== pathParts.length) {
      continue;
    }
    const params = {};
    const isMatch = routeParts.every((part, i) => {
      if (part.startsWith(':')) {
        params[part.slice(1)] = pathParts[i];
        return true;
      }
      return part === pathParts[i];
    });
    if (isMatch) {
      return { view: route.view, params };
    }
  }
  return null;
}

function currentPath() {
  const path = location.hash.slice(1) || '/';
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

Vue.createApp({
  provide() {
    return { app: this };
  },
  data() {
    return {
      path: currentPath(),
      section: '',
      events: [],
      eventsLoading: false,
      eventsError: '',
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
      savedEvents: [],
      savedLoading: true,
      useLocalStorage: false,
      storageError: '',
    };
  },
  computed: {
    page() {
      return matchRoute(this.path) ?? { view: NotFoundView, params: {} };
    },
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
      this.events.map(toSavedEvent).concat(this.savedEvents)
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
    eventHref,
    findEvent(id) {
      const event = this.events.find(item => String(item.id) === id);
      if (event) {
        return event;
      }
      const record = this.savedEvents.find(item => String(item.id) === id);
      return record ? fromSavedEvent(record) : null;
    },
    renderRoute() {
      this.path = currentPath();
      this.$nextTick(() => {
        const target = this.section && document.getElementById(this.section);
        if (target) {
          target.scrollIntoView();
        } else {
          window.scrollTo(0, 0);
        }
        this.section = '';
      });
    },
    navigate(path, section = '') {
      this.section = section;
      if (location.hash === `#${path}`) {
        this.renderRoute();
      } else {
        location.hash = path;
      }
    },
    onLinkClick(event) {
      const link = event.target.closest('a[data-link]');
      if (!link || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      event.preventDefault();
      this.navigate(link.getAttribute('href').slice(1), link.dataset.section);
    },
    validateTitle(event) {
      const input = event.target;
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
    addEvent(event) {
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
      event.target.reset();
    },
    async loadEvents(url = EVENTS_API_URL) {
      this.eventsLoading = true;
      this.eventsError = '';
      try {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) {
          const error = new Error(`Сервер відповів кодом ${response.status}`);
          error.status = response.status;
          throw error;
        }
        const data = await response.json();
        console.log('Події з локального сервера:', data);
        this.events = data;
      } catch (error) {
        this.events = [];
        this.eventsError = error.status === 404
          ? 'Дані про події не знайдено'
          : 'Не вдалося завантажити події. Перевірте, чи запущено сервер, і натисніть «Оновити».';
        console.error('Помилка завантаження подій:', error);
      } finally {
        this.eventsLoading = false;
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
      } finally {
        this.savedLoading = false;
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
    history.scrollRestoration = 'manual';
    window.addEventListener('hashchange', this.renderRoute);
    document.addEventListener('click', this.onLinkClick);
    this.loadSaved();
    this.loadEvents();
  },
}).mount('#app');
