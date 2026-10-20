
const MENU_URL = "data/menu.json";

const CUSTOMER_VIEW_KEY = "restaurantCustomerView";
const LANGUAGE_KEY = "restaurantLanguage";
const THEME_KEY = "restaurantTheme";

/* =====================================
   TRANSLATIONS
===================================== */

const translations = {
    en: {
        menu: "Our Menu",
        search: "Search dishes...",
        restaurantOrder: "Restaurant Order",
        priceAscending: "Price: Low to High",
        priceDescending: "Price: High to Low",
        view: "View",
        cards: "Cards",
        list: "List",
        size: "Size",
        small: "Small",
        medium: "Medium",
        large: "Large",
        all: "All",
        admin: "Admin",
        heroSubtitle: "Traditional Georgian Cuisine",
        hours: "Open every day: 10:00 - 23:00",
        noDishes: "No dishes found.",
        loading: "Loading menu...",
        loadError: "Could not load the menu. Please try again."
    },

    ge: {
        menu: "მენიუ",
        search: "მოძებნე კერძი...",
        restaurantOrder: "რესტორნის განლაგება",
        priceAscending: "ფასი: დაბლიდან მაღლა",
        priceDescending: "ფასი: მაღლიდან დაბლა",
        view: "ხედი",
        cards: "ბარათები",
        list: "სია",
        size: "ზომა",
        small: "პატარა",
        medium: "საშუალო",
        large: "დიდი",
        all: "ყველა",
        admin: "ადმინი",
        heroSubtitle: "ტრადიციული ქართული სამზარეულო",
        hours: "ღიაა ყოველდღე: 10:00 - 23:00",
        noDishes: "კერძები ვერ მოიძებნა.",
        loading: "მენიუ იტვირთება...",
        loadError: "მენიუ ვერ ჩაიტვირთა. სცადეთ ხელახლა."
    }
};

/* =====================================
   DATA
===================================== */

let categories = [];
let dishes = [];
let categorySettings = {};
let menuLoadFailed = false;
let menuLoading = true;

function readPreference(key, fallback) {
    try {
        const saved = localStorage.getItem(key);
        return saved ? JSON.parse(saved) : fallback;
    } catch {
        return fallback;
    }
}

function savePreference(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.warn("Could not save preference:", error);
    }
}

let customerView = readPreference(CUSTOMER_VIEW_KEY, {
    view: "cards",
    size: "medium"
});

if (!["cards", "list"].includes(customerView.view)) {
    customerView.view = "cards";
}

if (!["small", "medium", "large"].includes(customerView.size)) {
    customerView.size = "medium";
}

let currentLanguage = localStorage.getItem(LANGUAGE_KEY) || "en";
let currentTheme = localStorage.getItem(THEME_KEY) || "light";

if (!["ge", "en"].includes(currentLanguage)) {
    currentLanguage = "en";
}

if (!["light", "dark"].includes(currentTheme)) {
    currentTheme = "light";
}

let selectedCategoryId = "all";

/* =====================================
   PAGE ELEMENTS
===================================== */

const menuContainer = document.getElementById("menuContainer");
const categoryButtons = document.getElementById("categoryButtons");
const searchInput = document.getElementById("searchInput");
const sortSelect = document.getElementById("sortSelect");

const cardViewButton = document.getElementById("cardViewButton");
const listViewButton = document.getElementById("listViewButton");
const sizeButtons = document.querySelectorAll(".size-button");

const languageGe = document.getElementById("languageGe");
const languageEn = document.getElementById("languageEn");
const themeToggle = document.getElementById("themeToggle");

/* =====================================
   TEXT HELPERS
===================================== */

function getTranslatedValue(geValue, enValue) {
    const ge = String(geValue || "").trim();
    const en = String(enValue || "").trim();

    if (currentLanguage === "ge") {
        return ge || en;
    }

    return en || ge;
}

function getCategoryName(category) {
    return getTranslatedValue(category.nameGe, category.nameEn);
}

function getDishName(dish) {
    return getTranslatedValue(dish.nameGe, dish.nameEn);
}

function getDishDescription(dish) {
    return getTranslatedValue(
        dish.descriptionGe,
        dish.descriptionEn
    );
}

/* =====================================
   LOAD ONLINE MENU.JSON
===================================== */

async function loadMenu() {
    menuLoading = true;
    menuLoadFailed = false;

    menuContainer.textContent = translations[currentLanguage].loading;

    try {
        const response = await fetch(MENU_URL, {
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("Menu request failed: " + response.status);
        }

        const menuData = await response.json();

        if (
            !menuData ||
            !Array.isArray(menuData.categories) ||
            !Array.isArray(menuData.dishes)
        ) {
            throw new Error("Invalid menu.json structure");
        }

        categories = menuData.categories
            .filter(category => category && category.id != null)
            .map((category, index) => ({
                ...category,
                id: String(category.id),
                order: Number.isFinite(Number(category.order))
                    ? Number(category.order)
                    : index
            }));

        dishes = menuData.dishes
            .filter(dish => dish && dish.id != null)
            .map((dish, index) => ({
                ...dish,
                id: String(dish.id),
                categoryId: String(dish.categoryId),
                price: Number(dish.price) || 0,
                order: Number.isFinite(Number(dish.order))
                    ? Number(dish.order)
                    : index
            }));

        categorySettings =
            menuData.categorySettings &&
            typeof menuData.categorySettings === "object"
                ? menuData.categorySettings
                : {};

        // Optional settings stored directly on categories
        categories.forEach(category => {
            if (!categorySettings[category.id]) {
                categorySettings[category.id] = {
                    showImages: category.showImages !== false
                };
            }
        });

        if (
            selectedCategoryId !== "all" &&
            !categories.some(category => category.id === selectedCategoryId)
        ) {
            selectedCategoryId = "all";
        }

    } catch (error) {
        console.error("Menu loading error:", error);

        categories = [];
        dishes = [];
        categorySettings = {};
        menuLoadFailed = true;
    } finally {
        menuLoading = false;
        createCategories();
        filterMenu();
    }
}

/* =====================================
   DARK / LIGHT MODE
===================================== */

function applyTheme() {
    document.body.classList.toggle(
        "dark-mode",
        currentTheme === "dark"
    );

    themeToggle.textContent = currentTheme === "dark"
        ? "☀️"
        : "🌙";

    themeToggle.setAttribute(
        "aria-label",
        currentTheme === "dark"
            ? "Switch to light mode"
            : "Switch to dark mode"
    );
}

themeToggle.addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, currentTheme);
    applyTheme();
});

/* =====================================
   LANGUAGE
===================================== */

function updateStaticLanguage() {
    const t = translations[currentLanguage];

    document.documentElement.lang =
        currentLanguage === "ge" ? "ka" : "en";

    document.getElementById("menuHeading").textContent = t.menu;
    searchInput.placeholder = t.search;

    sortSelect.options[0].textContent = t.restaurantOrder;
    sortSelect.options[1].textContent = t.priceAscending;
    sortSelect.options[2].textContent = t.priceDescending;

    document.getElementById("viewLabel").textContent = t.view;
    cardViewButton.textContent = "▦ " + t.cards;
    listViewButton.textContent = "☰ " + t.list;

    document.getElementById("sizeLabel").textContent = t.size;
    document.getElementById("smallSizeButton").textContent = t.small;
    document.getElementById("mediumSizeButton").textContent = t.medium;
    document.getElementById("largeSizeButton").textContent = t.large;

    document.getElementById("adminButton").textContent = t.admin;
    document.getElementById("heroSubtitle").textContent = t.heroSubtitle;
    document.getElementById("footerHours").textContent = t.hours;

    languageGe.classList.toggle("active", currentLanguage === "ge");
    languageEn.classList.toggle("active", currentLanguage === "en");
}

function changeLanguage(language) {
    currentLanguage = language;

    localStorage.setItem(LANGUAGE_KEY, language);

    updateStaticLanguage();
    createCategories();
    filterMenu();
}

languageGe.addEventListener("click", () => changeLanguage("ge"));
languageEn.addEventListener("click", () => changeLanguage("en"));

/* =====================================
   CARD / LIST AND SIZE
===================================== */

function applyCustomerView() {
    document.body.classList.remove(
        "list-view",
        "menu-size-small",
        "menu-size-medium",
        "menu-size-large"
    );

    if (customerView.view === "list") {
        document.body.classList.add("list-view");
    }

    document.body.classList.add("menu-size-" + customerView.size);

    cardViewButton.classList.toggle(
        "active",
        customerView.view === "cards"
    );

    listViewButton.classList.toggle(
        "active",
        customerView.view === "list"
    );

    sizeButtons.forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.size === customerView.size
        );
    });
}

cardViewButton.addEventListener("click", () => {
    customerView.view = "cards";
    savePreference(CUSTOMER_VIEW_KEY, customerView);
    applyCustomerView();
    filterMenu();
});

listViewButton.addEventListener("click", () => {
    customerView.view = "list";
    savePreference(CUSTOMER_VIEW_KEY, customerView);
    applyCustomerView();
    filterMenu();
});

sizeButtons.forEach(button => {
    button.addEventListener("click", () => {
        customerView.size = button.dataset.size;
        savePreference(CUSTOMER_VIEW_KEY, customerView);
        applyCustomerView();
    });
});

/* =====================================
   CATEGORY IMAGE VISIBILITY
===================================== */

function categoryShowsImages(categoryId) {
    if (customerView.view === "list") {
        return false;
    }

    const setting = categorySettings[categoryId];

    return !setting || setting.showImages !== false;
}

/* =====================================
   SORT DISHES
===================================== */

function getSortedItems(items) {
    const sorted = [...items];

    if (sortSelect.value === "priceAsc") {
        sorted.sort((a, b) => a.price - b.price);
    } else if (sortSelect.value === "priceDesc") {
        sorted.sort((a, b) => b.price - a.price);
    } else {
        sorted.sort((a, b) => a.order - b.order);
    }

    return sorted;
}

/* =====================================
   DISH CARDS
===================================== */

function createDishCard(dish) {
    const card = document.createElement("div");
    card.className = "food-card";

    const showImage = categoryShowsImages(dish.categoryId);

    if (!showImage) {
        card.classList.add("no-image");
    }

    if (showImage && dish.image) {
        const img = document.createElement("img");
        img.src = dish.image;
        img.alt = getDishName(dish);
        img.loading = "lazy";

        img.addEventListener("error", () => {
            img.remove();
            card.classList.add("no-image");
        });

        card.appendChild(img);
    } else if (!dish.image) {
        card.classList.add("no-image");
    }

    const info = document.createElement("div");
    info.className = "food-info";

    const title = document.createElement("div");
    title.className = "food-title";

    const name = document.createElement("h3");
    name.textContent = getDishName(dish);

    const price = document.createElement("span");
    price.className = "price";
    price.textContent = Number(dish.price).toFixed(2) + " GEL";

    title.appendChild(name);
    title.appendChild(price);
    info.appendChild(title);

    const descriptionText = getDishDescription(dish);

    if (descriptionText) {
        const description = document.createElement("p");
        description.textContent = descriptionText;
        info.appendChild(description);
    }

    card.appendChild(info);

    return card;
}

/* =====================================
   CREATE MENU SECTIONS
===================================== */

function createMenuSection(category, items) {
    const section = document.createElement("section");
    section.className = "menu-category-section";

    const title = document.createElement("h2");
    title.className = "menu-category-title";
    title.textContent = getCategoryName(category);

    const grid = document.createElement("div");
    grid.className = "menu-grid";

    items.forEach(dish => {
        grid.appendChild(createDishCard(dish));
    });

    section.appendChild(title);
    section.appendChild(grid);

    return section;
}

/* =====================================
   DISPLAY MENU
===================================== */

function displayMenu(items) {
    menuContainer.replaceChildren();

    if (menuLoading) {
        menuContainer.textContent = translations[currentLanguage].loading;
        return;
    }

    if (menuLoadFailed) {
        menuContainer.textContent = translations[currentLanguage].loadError;
        return;
    }

    if (items.length === 0) {
        menuContainer.textContent = translations[currentLanguage].noDishes;
        return;
    }

    const sortedItems = getSortedItems(items);

    const orderedCategories = [...categories].sort(
        (a, b) => a.order - b.order
    );

    for (const category of orderedCategories) {
        if (
            selectedCategoryId !== "all" &&
            selectedCategoryId !== category.id
        ) {
            continue;
        }

        const categoryItems = sortedItems.filter(
            dish => dish.categoryId === category.id
        );

        if (categoryItems.length === 0) {
            continue;
        }

        menuContainer.appendChild(
            createMenuSection(category, categoryItems)
        );
    }

    if (!menuContainer.children.length) {
        menuContainer.textContent = translations[currentLanguage].noDishes;
    }
}

/* =====================================
   CATEGORY BUTTONS
===================================== */

function createCategories() {
    categoryButtons.replaceChildren();

    function addButton(categoryId, label) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "category-btn";
        button.textContent = label;

        button.classList.toggle(
            "active",
            selectedCategoryId === categoryId
        );

        button.addEventListener("click", () => {
            selectedCategoryId = categoryId;
            createCategories();
            filterMenu();
        });

        categoryButtons.appendChild(button);
    }

    addButton("all", translations[currentLanguage].all);

    const orderedCategories = [...categories].sort(
        (a, b) => a.order - b.order
    );

    orderedCategories.forEach(category => {
        addButton(category.id, getCategoryName(category));
    });
}

/* =====================================
   SEARCH + FILTER
===================================== */

function filterMenu() {
    const searchText = searchInput.value.toLowerCase().trim();

    const filtered = dishes.filter(dish => {
        const categoryMatch =
            selectedCategoryId === "all" ||
            dish.categoryId === selectedCategoryId;

        // Search both languages, regardless of selected language.
        const searchableText = [
            dish.nameGe,
            dish.nameEn,
            dish.descriptionGe,
            dish.descriptionEn
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return (
            categoryMatch &&
            searchableText.includes(searchText)
        );
    });

    displayMenu(filtered);
}

/* =====================================
   EVENTS
===================================== */

searchInput.addEventListener("input", filterMenu);
sortSelect.addEventListener("change", filterMenu);

/* =====================================
   START WEBSITE
===================================== */

applyTheme();
applyCustomerView();
updateStaticLanguage();

loadMenu();
