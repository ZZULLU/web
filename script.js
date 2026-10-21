/* Customer menu — reads shared online JSON, never stores restaurant menu in this browser. */
const MENU_URL = new URL('data/menu.json', document.baseURI).href;
const CUSTOMER_VIEW_KEY = 'restaurantCustomerView';
const LANGUAGE_KEY = 'restaurantLanguage';
const THEME_KEY = 'restaurantTheme';

const translations = {
  en: {
    menu: 'Our Menu', search: 'Search dishes...', categories: 'Categories', all: 'All',
    restaurantOrder: 'Default order', priceAscending: 'Price: low to high',
    priceDescending: 'Price: high to low', cards: 'Card view', list: 'List view',
    small: 'Small items', medium: 'Medium items', large: 'Large items',
    admin: 'Admin', heroSubtitle: 'Traditional Georgian Cuisine',
    hours: 'Open every day: 10:00 - 23:00', noDishes: 'No dishes found.',
    loading: 'Loading menu...', loadError: 'Could not load the menu. Please try again.',
    openSearch: 'Open search', closeSearch: 'Close search', noMatches: 'No matching dishes', suggestions: 'Matching dishes'
  },
  ge: {
    menu: 'მენიუ', search: 'მოძებნე კერძი...', categories: 'კატეგორიები', all: 'ყველა',
    restaurantOrder: 'საწყისი განლაგება', priceAscending: 'ფასი: დაბლიდან მაღლა',
    priceDescending: 'ფასი: მაღლიდან დაბლა', cards: 'ბარათებით ნახვა', list: 'სიის სახით ნახვა',
    small: 'პატარა ზომა', medium: 'საშუალო ზომა', large: 'დიდი ზომა',
    admin: 'ადმინი', heroSubtitle: 'ტრადიციული ქართული სამზარეულო',
    hours: 'ღიაა ყოველდღე: 10:00 - 23:00', noDishes: 'კერძები ვერ მოიძებნა.',
    loading: 'მენიუ იტვირთება...', loadError: 'მენიუ ვერ ჩაიტვირთა. სცადეთ ხელახლა.',
    openSearch: 'ძიების გახსნა', closeSearch: 'ძიების დახურვა', noMatches: 'კერძები ვერ მოიძებნა', suggestions: 'ნაპოვნი კერძები'
  }
};

const $ = id => document.getElementById(id);
const menuContainer = $('menuContainer');
const categoryButtons = $('categoryButtons');
const searchInput = $('searchInput');
const searchToggle = $('searchToggle');
const headerSearchPanel = $('headerSearchPanel');
const closeSearch = $('closeSearch');
const searchSuggestions = $('searchSuggestions');
const cardViewButton = $('cardViewButton');
const listViewButton = $('listViewButton');
const sizeButtons = document.querySelectorAll('.size-button');
const sortButtons = document.querySelectorAll('.sort-button');
const languageToggle = $('languageToggle');
const themeToggle = $('themeToggle');

let categories = [];
let dishes = [];
let categorySettings = {};
let menuLoading = true;
let menuLoadFailed = false;
let selectedCategoryId = 'all';
let selectedSort = 'default';
const categoryOpenStates = new Map();

function readPreference(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
}
function savePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (error) { console.warn('Could not save preference', error); }
}
let customerView = readPreference(CUSTOMER_VIEW_KEY, { view: 'cards', size: 'medium' });
if (!customerView || !['cards', 'list'].includes(customerView.view)) customerView = { view: 'cards', size: 'medium' };
if (!['small', 'medium', 'large'].includes(customerView.size)) customerView.size = 'medium';
let currentLanguage = localStorage.getItem(LANGUAGE_KEY) || 'en';
let currentTheme = localStorage.getItem(THEME_KEY) || 'light';
if (!translations[currentLanguage]) currentLanguage = 'en';
if (!['dark', 'light'].includes(currentTheme)) currentTheme = 'light';

function getTranslatedValue(ge, en) {
  const geText = String(ge || '').trim();
  const enText = String(en || '').trim();
  return currentLanguage === 'ge' ? (geText || enText) : (enText || geText);
}
function getCategoryName(c) { return getTranslatedValue(c.nameGe, c.nameEn); }
function getDishName(d) { return getTranslatedValue(d.nameGe, d.nameEn); }
function getDishDescription(d) { return getTranslatedValue(d.descriptionGe, d.descriptionEn); }

async function loadMenu() {
  menuLoading = true;
  menuLoadFailed = false;
  menuContainer.textContent = translations[currentLanguage].loading;
  try {
    const response = await fetch(MENU_URL, { cache: 'no-store', headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`Menu request failed: ${response.status}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.categories) || !Array.isArray(data.dishes)) throw new Error('Invalid menu.json structure; ensure you have published data/menu.json');
    categories = data.categories.filter(c => c && c.id != null).map((c, i) => ({
      ...c, id: String(c.id), order: Number.isFinite(Number(c.order)) ? Number(c.order) : i
    }));
    dishes = data.dishes.filter(d => d && d.id != null).map((d, i) => ({
      ...d, id: String(d.id), categoryId: String(d.categoryId),
      price: Number(d.price) || 0, order: Number.isFinite(Number(d.order)) ? Number(d.order) : i
    }));
    categorySettings = data.categorySettings && typeof data.categorySettings === 'object' ? data.categorySettings : {};
    categories.forEach(c => {
      if (!categorySettings[c.id]) categorySettings[c.id] = { showImages: c.showImages !== false };
    });
    if (selectedCategoryId !== 'all' && !categories.some(c => c.id === selectedCategoryId)) selectedCategoryId = 'all';
  } catch (error) {
    console.error('Menu loading error:', error);
    categories = [];
    dishes = [];
    categorySettings = {};
    menuLoadFailed = true;
    menuContainer.title = `Menu URL: ${MENU_URL} — ${error.message}`;
  } finally {
    menuLoading = false;
    createCategories();
    filterMenu();
    updateSearchSuggestions();
  }
}

function applyTheme() {
  document.body.classList.toggle('dark-mode', currentTheme === 'dark');
  themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  themeToggle.setAttribute('aria-label', currentTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
}
themeToggle.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  savePreference(THEME_KEY, currentTheme);
  applyTheme();
});

function setAccessibleTitle(element, label) {
  element.setAttribute('aria-label', label);
  element.title = label;
}
function updateStaticLanguage() {
  const t = translations[currentLanguage];
  document.documentElement.lang = currentLanguage === 'ge' ? 'ka' : 'en';
  $('menuHeading').textContent = t.menu;
  searchInput.placeholder = t.search;
  $('searchLabel').textContent = t.search;
  $('adminButton').textContent = t.admin;
  $('heroSubtitle').textContent = t.heroSubtitle;
  $('footerHours').textContent = t.hours;
  setAccessibleTitle(searchToggle, t.openSearch);
  setAccessibleTitle(closeSearch, t.closeSearch);
  searchSuggestions.setAttribute('aria-label', t.suggestions);
  setAccessibleTitle($('sortDefault'), t.restaurantOrder);
  setAccessibleTitle($('sortAsc'), t.priceAscending);
  setAccessibleTitle($('sortDesc'), t.priceDescending);
  setAccessibleTitle(cardViewButton, t.cards);
  setAccessibleTitle(listViewButton, t.list);
  setAccessibleTitle($('smallSizeButton'), t.small);
  setAccessibleTitle($('mediumSizeButton'), t.medium);
  setAccessibleTitle($('largeSizeButton'), t.large);
  languageToggle.textContent = currentLanguage === 'ge' ? 'English' : 'ქართული';
  const nextLanguageLabel = currentLanguage === 'ge' ? 'Switch to English' : 'ქართულზე გადართვა';
  languageToggle.setAttribute('aria-label', nextLanguageLabel);
  languageToggle.title = nextLanguageLabel;
}
function changeLanguage(lang) {
  currentLanguage = lang;
  savePreference(LANGUAGE_KEY, lang);
  updateStaticLanguage();
  createCategories();
  filterMenu();
  updateSearchSuggestions();
}
languageToggle.addEventListener('click', () => changeLanguage(currentLanguage === 'ge' ? 'en' : 'ge'));

/* Search suggestions are built from menu.json, never from browser-stored dishes. */
function matchingDishes(query) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return dishes.filter(dish => [
    dish.nameGe, dish.nameEn, dish.descriptionGe, dish.descriptionEn
  ].filter(Boolean).some(value => String(value).toLocaleLowerCase().includes(normalized)))
    .sort((a, b) => {
      const aName = [a.nameGe, a.nameEn].some(value => String(value || '').toLocaleLowerCase().startsWith(normalized));
      const bName = [b.nameGe, b.nameEn].some(value => String(value || '').toLocaleLowerCase().startsWith(normalized));
      return Number(bName) - Number(aName) || a.order - b.order;
    })
    .slice(0, 15);
}
function hideSearchSuggestions() {
  searchSuggestions.hidden = true;
  searchSuggestions.replaceChildren();
  searchInput.setAttribute('aria-expanded', 'false');
}
function updateSearchSuggestions() {
  const query = searchInput.value.trim();
  if (headerSearchPanel.hidden || !query || menuLoading || menuLoadFailed) {
    hideSearchSuggestions();
    return;
  }
  searchSuggestions.replaceChildren();
  const matches = matchingDishes(query);
  if (!matches.length) {
    const empty = document.createElement('div');
    empty.className = 'search-suggestion-empty';
    empty.textContent = translations[currentLanguage].noMatches;
    searchSuggestions.append(empty);
  }
  for (const dish of matches) {
    const result = document.createElement('button');
    result.type = 'button';
    result.className = 'search-suggestion-item';
    result.setAttribute('role', 'option');
    result.setAttribute('aria-label', `${getDishName(dish)}, ${Number(dish.price).toFixed(2)} GEL`);
    if (dish.image) {
      const thumbnail = document.createElement('img');
      thumbnail.src = dish.image;
      thumbnail.alt = '';
      thumbnail.loading = 'lazy';
      thumbnail.addEventListener('error', () => thumbnail.remove());
      result.append(thumbnail);
    }
    const detail = document.createElement('span');
    detail.className = 'search-suggestion-detail';
    const name = document.createElement('strong');
    name.textContent = getDishName(dish);
    const category = categories.find(c => c.id === dish.categoryId);
    const subtitle = document.createElement('small');
    subtitle.textContent = category ? getCategoryName(category) : '';
    detail.append(name, subtitle);
    const price = document.createElement('span');
    price.className = 'search-suggestion-price';
    price.textContent = Number(dish.price).toFixed(2) + ' GEL';
    result.append(detail, price);
    result.addEventListener('click', () => openDishFromSearch(dish));
    searchSuggestions.append(result);
  }
  searchSuggestions.hidden = false;
  searchInput.setAttribute('aria-expanded', 'true');
}
function openDishFromSearch(dish) {
  // Clear the search so the full category can be browsed after selection.
  searchInput.value = '';
  selectedCategoryId = dish.categoryId;
  categoryOpenStates.set(dish.categoryId, true);
  createCategories();
  filterMenu();
  toggleSearch(false);
  const card = [...menuContainer.querySelectorAll('.food-card')]
    .find(element => element.dataset.dishId === String(dish.id));
  if (card) {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('search-result-highlight');
    card.addEventListener('animationend', () => card.classList.remove('search-result-highlight'), { once: true });
  }
}
function toggleSearch(open) {
  headerSearchPanel.hidden = !open;
  document.querySelector('.hero').classList.toggle('search-open', open);
  searchToggle.setAttribute('aria-expanded', String(open));
  if (open) {
    searchInput.focus();
    updateSearchSuggestions();
  } else {
    hideSearchSuggestions();
    searchToggle.focus();
  }
}
searchToggle.addEventListener('click', () => toggleSearch(true));
closeSearch.addEventListener('click', () => {
  filterMenu();
  toggleSearch(false);
});
searchInput.addEventListener('keydown', event => {
  if (event.key === 'Escape') { toggleSearch(false); return; }
  if (event.key === 'ArrowDown' && !searchSuggestions.hidden) {
    const first = searchSuggestions.querySelector('.search-suggestion-item');
    if (first) { event.preventDefault(); first.focus(); }
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    const [first] = matchingDishes(searchInput.value);
    if (first) openDishFromSearch(first);
    else { filterMenu(); toggleSearch(false); }
  }
});
searchSuggestions.addEventListener('keydown', event => {
  const options = [...searchSuggestions.querySelectorAll('.search-suggestion-item')];
  const index = options.indexOf(document.activeElement);
  if (event.key === 'ArrowDown' && index !== -1) {
    event.preventDefault(); options[Math.min(index + 1, options.length - 1)].focus();
  } else if (event.key === 'ArrowUp' && index !== -1) {
    event.preventDefault(); if (index === 0) searchInput.focus(); else options[index - 1].focus();
  } else if (event.key === 'Escape') {
    toggleSearch(false);
  }
});
function applyCustomerView() {
  document.body.classList.remove('list-view', 'menu-size-small', 'menu-size-medium', 'menu-size-large');
  if (customerView.view === 'list') document.body.classList.add('list-view');
  document.body.classList.add('menu-size-' + customerView.size);
  cardViewButton.classList.toggle('active', customerView.view === 'cards');
  listViewButton.classList.toggle('active', customerView.view === 'list');
  cardViewButton.setAttribute('aria-pressed', String(customerView.view === 'cards'));
  listViewButton.setAttribute('aria-pressed', String(customerView.view === 'list'));
  sizeButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.size === customerView.size);
    b.setAttribute('aria-pressed', String(b.dataset.size === customerView.size));
  });
}
cardViewButton.addEventListener('click', () => {
  customerView.view = 'cards'; savePreference(CUSTOMER_VIEW_KEY, customerView);
  applyCustomerView(); filterMenu();
});
listViewButton.addEventListener('click', () => {
  customerView.view = 'list'; savePreference(CUSTOMER_VIEW_KEY, customerView);
  applyCustomerView(); filterMenu();
});
sizeButtons.forEach(button => button.addEventListener('click', () => {
  customerView.size = button.dataset.size;
  savePreference(CUSTOMER_VIEW_KEY, customerView);
  applyCustomerView();
}));
sortButtons.forEach(button => button.addEventListener('click', () => {
  selectedSort = button.dataset.sort;
  sortButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.sort === selectedSort);
    b.setAttribute('aria-pressed', String(b.dataset.sort === selectedSort));
  });
  filterMenu();
}));

function categoryShowsImages(categoryId) {
  if (customerView.view === 'list') return false;
  return categorySettings[categoryId]?.showImages !== false;
}
function getSortedItems(items) {
  const sorted = [...items];
  if (selectedSort === 'priceAsc') sorted.sort((a, b) => a.price - b.price);
  else if (selectedSort === 'priceDesc') sorted.sort((a, b) => b.price - a.price);
  else sorted.sort((a, b) => a.order - b.order);
  return sorted;
}
function createDishCard(dish) {
  const card = document.createElement('div');
  card.className = 'food-card';
  card.dataset.dishId = String(dish.id);
  const showImage = categoryShowsImages(dish.categoryId);
  if (!showImage) card.classList.add('no-image');
  if (showImage && dish.image) {
    const img = document.createElement('img');
    img.src = dish.image;
    img.alt = getDishName(dish);
    img.loading = 'lazy';
    img.addEventListener('error', () => { img.remove(); card.classList.add('no-image'); });
    card.appendChild(img);
  } else if (!dish.image) card.classList.add('no-image');
  const info = document.createElement('div'); info.className = 'food-info';
  const title = document.createElement('div'); title.className = 'food-title';
  const name = document.createElement('h3'); name.textContent = getDishName(dish);
  const price = document.createElement('span'); price.className = 'price';
  price.textContent = Number(dish.price).toFixed(2) + ' GEL';
  title.append(name, price); info.appendChild(title);
  const descriptionText = getDishDescription(dish);
  if (descriptionText) {
    const desc = document.createElement('p'); desc.textContent = descriptionText;
    info.appendChild(desc);
  }
  card.appendChild(info); return card;
}
function createMenuSection(category, items) {
  const section = document.createElement('details');
  section.className = 'menu-category-section';
  section.dataset.categoryId = category.id;
  section.open = categoryOpenStates.get(category.id) !== false;
  const title = document.createElement('summary');
  title.className = 'menu-category-title';
  const name = document.createElement('span');
  name.textContent = getCategoryName(category);
  const count = document.createElement('span');
  count.className = 'category-item-count';
  count.textContent = String(items.length);
  const arrow = document.createElement('span');
  arrow.className = 'section-chevron';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '⌄';
  title.append(name, count, arrow);
  const grid = document.createElement('div'); grid.className = 'menu-grid';
  items.forEach(d => grid.appendChild(createDishCard(d)));
  section.append(title, grid);
  section.addEventListener('toggle', () => {
    if (section.isConnected) categoryOpenStates.set(category.id, section.open);
  });
  return section;
}
function displayMenu(items) {
  menuContainer.replaceChildren();
  if (menuLoading) { menuContainer.textContent = translations[currentLanguage].loading; return; }
  if (menuLoadFailed) { menuContainer.textContent = translations[currentLanguage].loadError; return; }
  if (!items.length) { menuContainer.textContent = translations[currentLanguage].noDishes; return; }
  const sorted = getSortedItems(items);
  const orderedCategories = [...categories].sort((a, b) => a.order - b.order);
  for (const category of orderedCategories) {
    if (selectedCategoryId !== 'all' && selectedCategoryId !== category.id) continue;
    const related = sorted.filter(d => d.categoryId === category.id);
    if (related.length) menuContainer.appendChild(createMenuSection(category, related));
  }
  if (!menuContainer.children.length) menuContainer.textContent = translations[currentLanguage].noDishes;
}
function createCategories() {
  categoryButtons.replaceChildren();
  function appendCategory(id, label) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'category-btn'; button.textContent = label;
    button.classList.toggle('active', selectedCategoryId === id);
    button.addEventListener('click', () => {
      selectedCategoryId = id;
      createCategories(); filterMenu();
    });
    categoryButtons.appendChild(button);
  }
  appendCategory('all', translations[currentLanguage].all);
  [...categories].sort((a, b) => a.order - b.order)
    .forEach(c => appendCategory(c.id, getCategoryName(c)));
}
function filterMenu() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = dishes.filter(d => {
    const belongs = selectedCategoryId === 'all' || d.categoryId === selectedCategoryId;
    const searchable = [d.nameGe, d.nameEn, d.descriptionGe, d.descriptionEn]
      .filter(Boolean).join(' ').toLowerCase();
    return belongs && searchable.includes(q);
  });
  displayMenu(filtered);
}
searchInput.addEventListener('input', () => {
  filterMenu();
  updateSearchSuggestions();
});
applyTheme();
applyCustomerView();
updateStaticLanguage();
loadMenu();
