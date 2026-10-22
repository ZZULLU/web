/* Customer menu — reads shared online JSON, never stores restaurant menu in this browser. */
const MENU_URL = new URL('data/menu.json', document.baseURI).href;
const CUSTOMER_VIEW_KEY = 'restaurantCustomerView';
const LANGUAGE_KEY = 'restaurantLanguage';
const THEME_KEY = 'restaurantTheme';
const PERSONAL_LIST_KEY = 'restaurantPersonalListV1';
const FLOAT_POSITION_KEY = 'restaurantPersonalListPositionV1';

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
let menuRequestSerial = 0;
let lastMenuCheck = 0;
let lastAppliedMenuJson = null;
const MENU_REFRESH_INTERVAL_MS = 60_000; // Only while the page is visible

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
// Older releases stored language as a bare string; newer ones JSON-encode it.
// Support both formats and default first-time visitors to Georgian.
function readStringPreference(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : fallback;
    } catch { return raw; }
  } catch { return fallback; }
}
let currentLanguage = readStringPreference(LANGUAGE_KEY, 'ge');
let currentTheme = readStringPreference(THEME_KEY, 'light');
if (!translations[currentLanguage]) currentLanguage = 'ge';
if (!['dark', 'light'].includes(currentTheme)) currentTheme = 'light';

function getTranslatedValue(ge, en) {
  const geText = String(ge || '').trim();
  const enText = String(en || '').trim();
  return currentLanguage === 'ge' ? (geText || enText) : (enText || geText);
}
function getCategoryName(c) { return getTranslatedValue(c.nameGe, c.nameEn); }
function getDishName(d) { return getTranslatedValue(d.nameGe, d.nameEn); }
function getDishDescription(d) { return getTranslatedValue(d.descriptionGe, d.descriptionEn); }

async function loadMenu({ background = false } = {}) {
  // GitHub Pages and mobile browsers can hold older menu.json responses.
  // A unique request URL plus no-store asks for the current published version.
  // The menu is also rechecked when a suspended mobile tab resumes.
  const requestId = ++menuRequestSerial;
  lastMenuCheck = Date.now();
  const hadMenu = lastAppliedMenuJson !== null;
  if (!background || !hadMenu) {
    menuLoading = true;
    menuLoadFailed = false;
    if (!hadMenu) menuContainer.textContent = translations[currentLanguage].loading;
  }
  try {
    const freshUrl = new URL(MENU_URL);
    freshUrl.searchParams.set('_menu_refresh', String(Date.now()));
    const response = await fetch(freshUrl.href, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error(`Menu request failed: ${response.status}`);
    const data = await response.json();
    if (!data || !Array.isArray(data.categories) || !Array.isArray(data.dishes)) {
      throw new Error('Invalid menu.json structure; ensure you have published data/menu.json');
    }
    if (requestId !== menuRequestSerial) return;
    // Don't unnecessarily recreate the cards, disturb scrolling, or collapse
    // categories when the fetched menu is identical to the displayed version.
    const serialized = JSON.stringify(data);
    if (hadMenu && serialized === lastAppliedMenuJson) {
      menuLoading = false;
      menuLoadFailed = false;
      return;
    }
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
    if (selectedCategoryId !== 'all' && selectedCategoryId !== 'popular' && !categories.some(c => c.id === selectedCategoryId)) selectedCategoryId = 'all';
    if (selectedCategoryId === 'popular' && !popularCategoryEnabled()) selectedCategoryId = 'all';
    lastAppliedMenuJson = serialized;
    menuLoadFailed = false;
    menuLoading = false;
    createCategories();
    syncPersonalListFeature();
    filterMenu();
    updateSearchSuggestions();
    if (openedDetailDishId && dishDetailDialog?.open) {
      const activeDetail = dishes.find(d => d.id === openedDetailDishId && d.visible !== false);
      if (activeDetail) openDishDetail(openedDetailDishId); else dishDetailDialog.close();
    }
  } catch (error) {
    if (requestId !== menuRequestSerial) return;
    console.error('Menu loading error:', error);
    // A transient mobile network issue must not erase the last good menu.
    if (!hadMenu) {
      menuLoadFailed = true;
      categories = [];
      dishes = [];
      categorySettings = {};
      menuContainer.title = `Menu URL: ${MENU_URL} — ${error.message}`;
      menuLoading = false;
      createCategories();
      syncPersonalListFeature();
      filterMenu();
    } else {
      menuLoading = false;
      console.warn('Keeping the previously loaded menu while connection recovers.');
    }
  }
}

function refreshMenuIfNeeded(force = false) {
  if (document.visibilityState === 'hidden') return;
  if (!force && Date.now() - lastMenuCheck < 5000) return;
  void loadMenu({ background: lastAppliedMenuJson !== null });
}

// Mobile Safari/Chrome may restore a suspended or back-forward-cached page
// without executing the original load code again.
window.addEventListener('pageshow', event => {
  if (event.persisted) refreshMenuIfNeeded(true);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') refreshMenuIfNeeded();
});
window.addEventListener('focus', () => refreshMenuIfNeeded());
window.addEventListener('online', () => refreshMenuIfNeeded(true));
setInterval(() => {
  if (document.visibilityState === 'visible' && Date.now() - lastMenuCheck >= MENU_REFRESH_INTERVAL_MS) {
    refreshMenuIfNeeded();
  }
}, MENU_REFRESH_INTERVAL_MS);

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
  renderPersonalList();
  if (openedDetailDishId && dishDetailDialog?.open) openDishDetail(openedDetailDishId);
}
languageToggle.addEventListener('click', () => changeLanguage(currentLanguage === 'ge' ? 'en' : 'ge'));

/* Search suggestions are built from menu.json, never from browser-stored dishes. */
function matchingDishes(query) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  return dishes.filter(dish => dish.visible !== false).filter(dish => [
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

/* Accessible, scrollable dish detail dialog. Card size is unchanged. */
const dishTagWords = {
  ge: { popular: 'პოპულარული', new: 'ახალი', sale: 'ფასდაკლება' },
  en: { popular: 'Popular', new: 'New', sale: 'Sale' }
};
const dishDetailDialog = document.getElementById('dishDetailDialog');
const dishDetailBody = document.getElementById('dishDetailBody');
let openedDetailDishId = null;
function openDishDetail(id) {
  const dish = dishes.find(d => d.id === String(id) && d.visible !== false);
  if (!dish || !dishDetailDialog || !dishDetailBody) return;
  openedDetailDishId = dish.id;
  dishDetailBody.replaceChildren();
  if (dish.image) {
    const photo = document.createElement('img');
    photo.className = 'dish-detail-photo';
    photo.src = dish.image;
    photo.alt = getDishName(dish);
    photo.addEventListener('error', () => photo.remove());
    dishDetailBody.append(photo);
  }
  const content = document.createElement('div'); content.className = 'dish-detail-content';
  if (['popular', 'new', 'sale'].includes(dish.tag)) {
    const tag = document.createElement('span'); tag.className = 'dish-detail-tag dish-tag-' + dish.tag;
    tag.textContent = dishTagWords[currentLanguage][dish.tag]; content.append(tag);
  }
  const heading = document.createElement('h2'); heading.id = 'dishDetailName'; heading.textContent = getDishName(dish);
  const price = document.createElement('strong'); price.className = 'dish-detail-price';
  price.textContent = Number(dish.price).toFixed(2) + ' GEL';
  content.append(heading, price);
  const description = getDishDescription(dish);
  if (description) {
    const paragraph = document.createElement('p'); paragraph.className = 'dish-detail-description';
    paragraph.textContent = description; content.append(paragraph);
  }
  if (isPersonalListAvailable()) {
    const add = document.createElement('button'); add.type = 'button'; add.className = 'dish-detail-add';
    add.textContent = currentLanguage === 'ge' ? '+ ჩემს სიაში' : '+ Add to my list';
    add.addEventListener('click', () => addPersonalDish(dish.id)); content.append(add);
  }
  dishDetailBody.append(content);
  if (!dishDetailDialog.open) dishDetailDialog.showModal();
}
if (dishDetailDialog) {
  dishDetailDialog.querySelector('.dish-detail-close').addEventListener('click', () => dishDetailDialog.close());
  dishDetailDialog.addEventListener('click', event => {
    if (event.target === dishDetailDialog) dishDetailDialog.close();
  });
  dishDetailDialog.addEventListener('close', () => { openedDetailDishId = null; });
}

function createDishCard(dish) {
  const card = document.createElement('div');
  card.className = 'food-card';
  card.dataset.dishId = String(dish.id);
  if ((personalQuantities[String(dish.id)] || 0) > 0 && isPersonalListAvailable()) card.classList.add('dish-in-personal-list');
  const showImage = categoryShowsImages(dish.categoryId);
  if (!showImage) card.classList.add('no-image');
  if (showImage && dish.image) {
    const imageFrame = document.createElement('div');
    imageFrame.className = 'dish-image-frame';
    const img = document.createElement('img');
    img.src = dish.image;
    img.alt = getDishName(dish);
    img.loading = 'lazy';
    img.addEventListener('error', () => { imageFrame.remove(); card.classList.add('no-image'); });
    imageFrame.append(img);
    card.appendChild(imageFrame);
  } else if (!dish.image) card.classList.add('no-image');
  if (customerView.view !== 'list' && ['popular', 'new', 'sale'].includes(dish.tag)) {
    const badge = document.createElement('span');
    badge.className = 'dish-tag dish-tag-' + dish.tag;
    badge.textContent = dishTagWords[currentLanguage][dish.tag];
    // On card view, overlay on the photograph. On list view, show beside the title.
    const frame = card.querySelector('.dish-image-frame');
    if (frame) frame.append(badge);
    else card.append(badge);
  }
  const info = document.createElement('div'); info.className = 'food-info';
  const title = document.createElement('div'); title.className = 'food-title';
  const name = document.createElement('h3'); name.textContent = getDishName(dish);
  const price = document.createElement('span'); price.className = 'price';
  price.textContent = Number(dish.price).toFixed(2) + ' GEL';
  title.append(name, price); info.appendChild(title);
  const descriptionText = getDishDescription(dish);
  if (descriptionText && customerView.view !== 'list') {
    const desc = document.createElement('p'); desc.textContent = descriptionText;
    info.appendChild(desc);
  }
  if (isPersonalListAvailable()) {
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'personal-add-button';
    add.textContent = '+';
    add.setAttribute('aria-label', currentLanguage === 'ge' ? `სიაში დამატება: ${getDishName(dish)}` : `Add ${getDishName(dish)} to my list`);
    add.title = add.getAttribute('aria-label');
    add.addEventListener('click', () => addPersonalDish(dish.id));
    info.appendChild(add);
  }
  card.appendChild(info);
  card.classList.add('dish-clickable');
  card.setAttribute('role', 'button');
  card.tabIndex = 0;
  card.setAttribute('aria-label', (currentLanguage === 'ge' ? 'კერძის დეტალები: ' : 'View dish: ') + getDishName(dish));
  card.addEventListener('click', event => {
    if (event.target.closest('button, a')) return;
    openDishDetail(dish.id);
  });
  card.addEventListener('keydown', event => {
    if (event.target !== card) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDishDetail(dish.id); }
  });
  return card;
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
  // SVG keeps the chevron geometrically centered across Georgian/Latin fonts.
  arrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>';
  title.append(name, count, arrow);
  const grid = document.createElement('div'); grid.className = 'menu-grid';
  items.forEach(d => grid.appendChild(createDishCard(d)));
  section.append(title, grid);
  // Intercept the summary interaction so details stay open until the
  // closing animation finishes. Native details would otherwise hide instantly.
  let moving = false;
  title.addEventListener('click', event => {
    if (moving) {event.preventDefault(); return;}
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !grid.animate) return;
    event.preventDefault();
    moving = true;
    const duration = 300;
    if (section.open) {
      const animation = grid.animate([
        {opacity:1, transform:'translateY(0)'},
        {opacity:0, transform:'translateY(-12px)'}
      ], {duration, easing:'ease-in-out'});
      animation.finished.catch(()=>{}).then(() => {
        section.open = false;
        moving = false;
      });
    } else {
      section.open = true;
      const animation = grid.animate([
        {opacity:0, transform:'translateY(-12px)'},
        {opacity:1, transform:'translateY(0)'}
      ], {duration, easing:'ease-out'});
      animation.finished.catch(()=>{}).then(() => {moving = false;});
    }
  });
  section.addEventListener('toggle', () => {
    if (section.isConnected) categoryOpenStates.set(category.id, section.open);
  });
  return section;
}
function displayMenu(items) {
  menuContainer.replaceChildren();
  if (menuLoading) { menuContainer.textContent = translations[currentLanguage].loading; return; }
  if (menuLoadFailed) { menuContainer.textContent = translations[currentLanguage].loadError; return; }
  const sorted = getSortedItems(items);
  if (selectedCategoryId === 'popular') {
    if (popularCategoryEnabled()) {
      const popularItems = sorted.filter(d => d.tag === 'popular');
      if (popularItems.length) menuContainer.appendChild(createMenuSection({id:'popular', nameGe:'პოპულარული', nameEn:'Popular'}, popularItems));
    }
    if (!menuContainer.children.length) menuContainer.textContent = translations[currentLanguage].noDishes;
    return;
  }
  const orderedCategories = [...categories].sort((a,b) => a.order-b.order);
  const position = Math.max(0, Math.min(orderedCategories.length, popularSettings().position));
  for (let i=0; i<=orderedCategories.length; i++) {
    // Popular is a computed view, so dishes are not duplicated in menu.json.
    if (selectedCategoryId === 'all' && i === position && popularCategoryEnabled()) {
      const popularItems = sorted.filter(d => d.tag === 'popular');
      if (popularItems.length) menuContainer.appendChild(createMenuSection({id:'popular', nameGe:'პოპულარული', nameEn:'Popular'}, popularItems));
    }
    const category = orderedCategories[i];
    if (!category) continue;
    if (selectedCategoryId !== 'all' && selectedCategoryId !== category.id) continue;
    const related = sorted.filter(d => d.categoryId === category.id);
    if (related.length) menuContainer.appendChild(createMenuSection(category, related));
  }
  if (!menuContainer.children.length) menuContainer.textContent = translations[currentLanguage].noDishes;
}
// The optional Popular category uses extra fields on an EXISTING, validated
// categorySettings entry. This avoids unsupported synthetic keys.
function popularSettings() {
  const record = categories.map(c => categorySettings[c.id]).find(x => typeof x?.showPopularCategory === 'boolean');
  if (record) return { enabled: record.showPopularCategory, position: Number(record.popularCategoryPosition) || 0 };
  const legacy = categories.find(c => typeof c.popularCategoryEnabled === 'boolean');
  if (legacy) return { enabled: legacy.popularCategoryEnabled, position: Number(legacy.popularCategoryPosition) || 0 };
  return {enabled:false, position:0};
}
function popularCategoryEnabled() { return popularSettings().enabled === true; }
function popularCategoryTitle() { return currentLanguage === 'ge' ? 'პოპულარული' : 'Popular'; }
function createCategories() {
  categoryButtons.replaceChildren();
  function appendCategory(id, label) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'category-btn'; button.textContent = label;
    button.classList.toggle('active', selectedCategoryId === id);
    button.addEventListener('click', () => { selectedCategoryId=id; createCategories(); filterMenu(); });
    categoryButtons.appendChild(button);
  }
  appendCategory('all', translations[currentLanguage].all);
  const sorted = [...categories].sort((a,b)=>a.order-b.order);
  const at = Math.max(0, Math.min(sorted.length, popularSettings().position));
  for (let i=0;i<=sorted.length;i++) {
    if (i===at && popularCategoryEnabled()) appendCategory('popular', popularCategoryTitle());
    if (i<sorted.length) appendCategory(sorted[i].id, getCategoryName(sorted[i]));
  }
}
function filterMenu() {
  const q = searchInput.value.trim().toLowerCase();
  const filtered = dishes.filter(d => {
    if (d.visible === false) return false;
    const belongs = selectedCategoryId === 'all' || (selectedCategoryId === 'popular' ? (popularCategoryEnabled() && d.tag === 'popular') : d.categoryId === selectedCategoryId);
    const searchable = [d.nameGe, d.nameEn, d.descriptionGe, d.descriptionEn]
      .filter(Boolean).join(' ').toLowerCase();
    return belongs && searchable.includes(q);
  });
  // The setting is already loaded at this point; cards read it directly.
  displayMenu(filtered);
}
searchInput.addEventListener('input', () => {
  filterMenu();
  updateSearchSuggestions();
});

/* =======================================================
   PRIVATE CUSTOMER PLANNING LIST
   Only quantities / floating position live in this browser.
   The restaurant enables it through shared menu.json settings.
======================================================= */
const personalWords = {
  en: { title: 'My list', empty: 'Your list is empty', total: 'Estimated total', clear: 'Clear list', remove: 'Remove', close: 'Close list', open: 'Open my list', note: 'Show this list to your waiter. This does not place an order.', count: 'items', drag: 'Drag to move' },
  ge: { title: 'ჩემი სია', empty: 'სია ცარიელია', total: 'სავარაუდო ჯამი', clear: 'სიის გასუფთავება', remove: 'წაშლა', close: 'სიის დახურვა', open: 'ჩემი სიის გახსნა', note: 'აჩვენეთ სია მიმტანს. ეს შეკვეთას არ აგზავნის.', count: 'ცალი', drag: 'გადაადგილება' }
};
let personalListEnabled = false;
let personalQuantities = readPreference(PERSONAL_LIST_KEY, {});
if (!personalQuantities || typeof personalQuantities !== 'object' || Array.isArray(personalQuantities)) personalQuantities = {};
let floatingPosition = readPreference(FLOAT_POSITION_KEY, null);
let personalPanelOpen = false;
let draggedRecently = false;

const personalFloat = document.createElement('button');
personalFloat.type = 'button';
personalFloat.id = 'personalListFloat';
personalFloat.className = 'personal-list-float';
personalFloat.setAttribute('aria-label', 'Open my list');
personalFloat.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 11h16M4 17h11"/><path d="M18 16v6M15 19h6"/></svg><span id="personalListBadge" class="personal-list-badge">0</span>';
personalFloat.hidden = true;
document.body.appendChild(personalFloat);

const personalPanel = document.createElement('section');
personalPanel.id = 'personalListPanel';
personalPanel.className = 'personal-list-panel';
personalPanel.setAttribute('role', 'dialog');
personalPanel.setAttribute('aria-modal', 'false');
personalPanel.setAttribute('aria-label', 'My list');
personalPanel.hidden = true;
document.body.appendChild(personalPanel);

function isPersonalListAvailable() {
  return categories.some(c => categorySettings[c.id]?.personalListEnabled === true);
}
function syncPersonalListFeature() {
  // The same flag is copied into category settings, which the existing Worker
  // already validates and saves. No Cloudflare backend modification is needed.
  personalListEnabled = isPersonalListAvailable();
  personalFloat.hidden = !personalListEnabled;
  if (!personalListEnabled) { personalPanelOpen = false; personalPanel.hidden = true; }
  if (personalListEnabled) positionFloatingButton();
  renderPersonalList();
}
function cleanPersonalQuantities() {
  for (const key of Object.keys(personalQuantities)) {
    if (!Number.isSafeInteger(personalQuantities[key]) || personalQuantities[key] < 1 || personalQuantities[key] > 999) delete personalQuantities[key];
  }
}
function savePersonalQuantities() {
  cleanPersonalQuantities();
  savePreference(PERSONAL_LIST_KEY, personalQuantities);
  document.querySelectorAll('.food-card[data-dish-id]').forEach(card => {
    card.classList.toggle('dish-in-personal-list', (personalQuantities[card.dataset.dishId] || 0) > 0 && isPersonalListAvailable());
  });
  renderPersonalList();
}
function addPersonalDish(id) {
  if (!personalListEnabled) return;
  const dish = dishes.find(d => d.id === String(id));
  if (!dish) return;
  personalQuantities[id] = Math.min(999, (personalQuantities[id] || 0) + 1);
  savePersonalQuantities();
  document.querySelectorAll('.food-card[data-dish-id]').forEach(card => {
    if (card.dataset.dishId !== String(id)) return;
    card.classList.remove('dish-just-added');
    void card.offsetWidth;
    card.classList.add('dish-just-added');
    const button = card.querySelector('.personal-add-button');
    if (button) { button.classList.remove('personal-added-bounce'); void button.offsetWidth; button.classList.add('personal-added-bounce'); }
    setTimeout(() => {card.classList.remove('dish-just-added'); button?.classList.remove('personal-added-bounce');}, 1350);
  });
  personalFloat.classList.remove('personal-pulse');
  void personalFloat.offsetWidth;
  personalFloat.classList.add('personal-pulse');
  // Detail-dialog additions have no directly visible card to animate.
  // Always acknowledge success near the tapped button and list bubble.
  const detailButton = dishDetailDialog?.open ? dishDetailDialog.querySelector('.dish-detail-add') : null;
  if (detailButton) {
    detailButton.classList.remove('personal-added-bounce');
    void detailButton.offsetWidth;
    detailButton.classList.add('personal-added-bounce');
    const original = currentLanguage === 'ge' ? '+ ჩემს სიაში' : '+ Add to my list';
    detailButton.textContent = currentLanguage === 'ge' ? '✓ დამატებულია' : '✓ Added!';
    clearTimeout(detailButton._feedbackTimeout);
    detailButton._feedbackTimeout = setTimeout(() => { if (detailButton.isConnected) detailButton.textContent = original; }, 1100);
  }
}
function changePersonalQuantity(id, amount) {
  const qty = (personalQuantities[id] || 0) + amount;
  if (qty < 1) delete personalQuantities[id];
  else personalQuantities[id] = Math.min(999, qty);
  savePersonalQuantities();
}
function makePersonalButton(text, label, callback, className) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = text;
  button.setAttribute('aria-label', label);
  button.addEventListener('click', callback);
  return button;
}
function renderPersonalList() {
  const w = personalWords[currentLanguage];
  const active = Object.entries(personalQuantities)
    .map(([id, qty]) => ({ dish: dishes.find(d => d.id === id), qty }))
    .filter(x => x.dish && x.dish.visible !== false && Number.isSafeInteger(x.qty) && x.qty > 0);
  const count = active.reduce((sum, x) => sum + x.qty, 0);
  $('personalListBadge').textContent = String(count);
  personalFloat.setAttribute('aria-label', `${w.open} (${count})`);
  personalPanel.replaceChildren();
  if (!personalListEnabled || !personalPanelOpen) return;
  const header = document.createElement('div');
  header.className = 'personal-panel-header';
  const title = document.createElement('h2');
  title.textContent = `${w.title} · ${count}`;
  const close = makePersonalButton('×', w.close, closePersonalPanel, 'personal-panel-close');
  header.append(title, close);
  personalPanel.append(header);
  const content = document.createElement('div');
  content.className = 'personal-panel-items';
  if (!active.length) {
    const empty = document.createElement('p'); empty.className = 'personal-empty'; empty.textContent = w.empty; content.append(empty);
  }
  for (const { dish, qty } of active) {
    const row = document.createElement('div'); row.className = 'personal-panel-item';
    const detail = document.createElement('div'); detail.className = 'personal-item-detail';
    const name = document.createElement('strong'); name.textContent = getDishName(dish);
    const subtotal = document.createElement('span'); subtotal.textContent = `${(Number(dish.price) * qty).toFixed(2)} GEL`;
    detail.append(name, subtotal);
    const controls = document.createElement('div'); controls.className = 'personal-quantity-controls';
    controls.append(
      makePersonalButton('−', `Remove one ${getDishName(dish)}`, () => changePersonalQuantity(dish.id, -1), 'personal-quantity-btn'),
      Object.assign(document.createElement('span'), { textContent: String(qty), className: 'personal-quantity-value' }),
      makePersonalButton('+', `Add one ${getDishName(dish)}`, () => changePersonalQuantity(dish.id, 1), 'personal-quantity-btn'),
      makePersonalButton('×', `${w.remove}: ${getDishName(dish)}`, () => { delete personalQuantities[dish.id]; savePersonalQuantities(); }, 'personal-remove-btn')
    );
    row.append(detail, controls); content.append(row);
  }
  personalPanel.append(content);
  const footer = document.createElement('div'); footer.className = 'personal-panel-footer';
  const total = document.createElement('div'); total.className = 'personal-panel-total';
  total.append(Object.assign(document.createElement('span'), { textContent: w.total }),
    Object.assign(document.createElement('strong'), { textContent: active.reduce((sum, x) => sum + Number(x.dish.price) * x.qty, 0).toFixed(2) + ' GEL' }));
  const note = document.createElement('p'); note.textContent = w.note;
  const clear = makePersonalButton(w.clear, w.clear, () => { personalQuantities = {}; savePersonalQuantities(); }, 'personal-clear-btn');
  clear.disabled = count === 0;
  footer.append(total, note, clear); personalPanel.append(footer);
  positionPersonalPanel();
}
function closePersonalPanel() { personalPanelOpen = false; personalPanel.hidden = true; personalFloat.setAttribute('aria-expanded', 'false'); }
function positionFloatingButton() {
  const size = 62, edge = 12;
  const x = floatingPosition && Number.isFinite(floatingPosition.x) ? floatingPosition.x : window.innerWidth - size - 20;
  const y = floatingPosition && Number.isFinite(floatingPosition.y) ? floatingPosition.y : window.innerHeight - size - 92;
  const left = Math.max(edge, Math.min(window.innerWidth - size - edge, x));
  const top = Math.max(edge, Math.min(window.innerHeight - size - edge, y));
  personalFloat.style.left = left + 'px';
  personalFloat.style.top = top + 'px';
  floatingPosition = { x: left, y: top };
  if (personalPanelOpen) positionPersonalPanel();
}
function positionPersonalPanel() {
  if (!personalPanelOpen) return;
  const margin = 12;
  const width = personalPanel.offsetWidth || 340;
  const height = personalPanel.offsetHeight || 350;
  const bx = personalFloat.getBoundingClientRect();
  let left = bx.right - width;
  let top = bx.top - height - 10;
  if (top < margin) top = bx.bottom + 10;
  left = Math.max(margin, Math.min(window.innerWidth - width - margin, left));
  top = Math.max(margin, Math.min(window.innerHeight - height - margin, top));
  personalPanel.style.left = left + 'px'; personalPanel.style.top = top + 'px';
}
let dragState = null;
personalFloat.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  const rect = personalFloat.getBoundingClientRect();
  dragState = { id: e.pointerId, dx: e.clientX - rect.left, dy: e.clientY - rect.top, sx: e.clientX, sy: e.clientY, moved: false };
  personalFloat.setPointerCapture(e.pointerId);
});
personalFloat.addEventListener('pointermove', e => {
  if (!dragState || e.pointerId !== dragState.id) return;
  if (Math.hypot(e.clientX - dragState.sx, e.clientY - dragState.sy) > 6) dragState.moved = true;
  if (!dragState.moved) return;
  floatingPosition = { x: e.clientX - dragState.dx, y: e.clientY - dragState.dy };
  positionFloatingButton();
});
personalFloat.addEventListener('pointerup', e => {
  if (!dragState || dragState.id !== e.pointerId) return;
  draggedRecently = dragState.moved;
  if (dragState.moved) savePreference(FLOAT_POSITION_KEY, floatingPosition);
  dragState = null;
});
personalFloat.addEventListener('pointercancel', () => { dragState = null; });
personalFloat.addEventListener('click', () => {
  if (draggedRecently) { draggedRecently = false; return; }
  if (!personalListEnabled) return;
  personalPanelOpen = !personalPanelOpen;
  personalPanel.hidden = !personalPanelOpen;
  personalFloat.setAttribute('aria-expanded', String(personalPanelOpen));
  renderPersonalList();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && personalPanelOpen) closePersonalPanel(); });
window.addEventListener('resize', positionFloatingButton);

applyTheme();
applyCustomerView();
updateStaticLanguage();
loadMenu();
