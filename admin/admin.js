/* ============================================================
   Restaurant Admin — Online GitHub menu via Cloudflare Worker
   IMPORTANT: Replace only API_BASE_URL with your Worker URL.
   No GitHub tokens or admin passwords belong in this file.
============================================================ */

const API_BASE_URL = "restaurant-menu-api.orivardisferivardi.workers.dev";
const LANGUAGE_KEY = "restaurantLanguage";
const THEME_KEY = "restaurantTheme";
const TOKEN_KEY = "restaurantAdminSessionToken";
const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 950000;

const adminTranslations = {
    en: {
        adminTitle: "Menu Admin", adminSubtitle: "Manage your restaurant menu",
        viewMenu: "← View Menu", logout: "Log Out",
        loginTitle: "Restaurant Admin Login", loginSubtitle: "Sign in to manage the online menu.",
        password: "Admin password", signIn: "Sign In", loginBack: "← Back to menu",
        editCategories: "Edit Categories", categoriesDescription: "Add, edit, delete and reorder categories. You can also choose whether dishes in each category show images.",
        categoryGePlaceholder: "Category — Georgian version", categoryEnPlaceholder: "Category — English version",
        addCategory: "+ Add Category", saveCategory: "Save Category", cancelEdit: "Cancel Edit",
        categoryNote: "At least one category name is required. Either language field can contain any text.",
        addEditDish: "Add / Edit Dish", dishNameGe: "Dish Name — Georgian version", dishNameEn: "Dish Name — English version",
        dishNameNote: "At least one dish name is required.", descriptionGe: "Description — Georgian version",
        descriptionEn: "Description — English version", price: "Price (GEL)", category: "Category", image: "Dish Image",
        imagePreview: "Image preview", uploadNote: "JPG, PNG and WebP are automatically resized and compressed to JPEG. HEIC requires browser support.",
        addDish: "Add Dish", saveChanges: "Save Changes", currentMenu: "Current Menu",
        currentMenuDescription: "Drag dishes by the handle on the left to change their order.",
        edit: "Edit", delete: "Delete", images: "Images", categoryRequired: "Enter at least one category name.",
        dishRequired: "Enter at least one dish name.", deleteCategory: "Delete this category?",
        deleteCategoryWithDishes: "This category contains {count} dishes. Deleting it will delete those dishes. Continue?",
        deleteDish: "Delete this dish?", dishSaved: "Dish saved!", categorySaved: "Category saved!",
        menuSaved: "Menu published to GitHub. The public website may take a few minutes to update.",
        noDishes: "No dishes added yet.", unnamed: "Unnamed", categoryWord: "Category",
        loading: "Loading online menu...", processing: "Preparing photo...", saveError: "Could not save your changes.",
        loginError: "Could not log in.", noBackend: "First paste your deployed Cloudflare Worker URL into admin.js.",
        imageTooLarge: "The original image must be under 20 MB.", imageInvalid: "Could not read the picture. HEIC may require another converter.",
        photoTooLarge: "This photo could not be compressed below 950 KB.", expired: "Your session expired. Sign in again.",
        conflict: "The menu was changed elsewhere. Reload the admin page before saving again."
    },
    ge: {
        adminTitle: "მენიუს მართვა", adminSubtitle: "მართეთ რესტორნის მენიუ",
        viewMenu: "← მენიუს ნახვა", logout: "გასვლა",
        loginTitle: "ადმინისტრატორის შესვლა", loginSubtitle: "შედით ონლაინ მენიუს სამართავად.",
        password: "ადმინისტრატორის პაროლი", signIn: "შესვლა", loginBack: "← მენიუში დაბრუნება",
        editCategories: "კატეგორიების მართვა", categoriesDescription: "დაამატეთ, შეცვალეთ, წაშალეთ და გადაალაგეთ კატეგორიები. შეგიძლიათ თითოეული კატეგორიის სურათების ჩართვა ან გამორთვა.",
        categoryGePlaceholder: "კატეგორია — ქართული ვერსია", categoryEnPlaceholder: "კატეგორია — ინგლისური ვერსია",
        addCategory: "+ კატეგორიის დამატება", saveCategory: "კატეგორიის შენახვა", cancelEdit: "გაუქმება",
        categoryNote: "საჭიროა მინიმუმ ერთი სახელი. ორივე ველში შეგიძლიათ ნებისმიერი ტექსტის შეყვანა.",
        addEditDish: "კერძის დამატება / რედაქტირება", dishNameGe: "კერძის სახელი — ქართული ვერსია", dishNameEn: "კერძის სახელი — ინგლისური ვერსია",
        dishNameNote: "საჭიროა კერძის მინიმუმ ერთი სახელი.", descriptionGe: "აღწერა — ქართული ვერსია",
        descriptionEn: "აღწერა — ინგლისური ვერსია", price: "ფასი (GEL)", category: "კატეგორია", image: "კერძის სურათი",
        imagePreview: "სურათის წინასწარი ნახვა", uploadNote: "JPG, PNG და WebP ავტომატურად მცირდება და გარდაიქმნება JPEG ფორმატში. HEIC დამოკიდებულია ბრაუზერზე.",
        addDish: "კერძის დამატება", saveChanges: "ცვლილებების შენახვა", currentMenu: "მიმდინარე მენიუ",
        currentMenuDescription: "გადაათრიეთ კერძები მარცხენა ნიშნით თანმიმდევრობის შესაცვლელად.",
        edit: "რედაქტირება", delete: "წაშლა", images: "სურათები", categoryRequired: "შეიყვანეთ კატეგორიის მინიმუმ ერთი სახელი.",
        dishRequired: "შეიყვანეთ კერძის მინიმუმ ერთი სახელი.", deleteCategory: "წაიშალოს კატეგორია?",
        deleteCategoryWithDishes: "კატეგორიაში არის {count} კერძი. კატეგორიის წაშლით კერძებიც წაიშლება. გაგრძელდეს?",
        deleteDish: "წაიშალოს კერძი?", dishSaved: "კერძი შენახულია!", categorySaved: "კატეგორია შენახულია!",
        menuSaved: "მენიუ GitHub-ზე შენახულია. საიტზე გამოჩენას შესაძლოა რამდენიმე წუთი დასჭირდეს.",
        noDishes: "კერძები ჯერ არ არის დამატებული.", unnamed: "უსახელო", categoryWord: "კატეგორია",
        loading: "მენიუ იტვირთება...", processing: "სურათი მუშავდება...", saveError: "ცვლილებები ვერ შეინახა.",
        loginError: "შესვლა ვერ მოხერხდა.", noBackend: "ჯერ შეიყვანეთ Cloudflare Worker-ის მისამართი admin.js ფაილში.",
        imageTooLarge: "საწყისი სურათი უნდა იყოს 20 MB-ზე ნაკლები.", imageInvalid: "სურათი ვერ გაიხსნა. HEIC შესაძლოა ცალკე გარდაქმნას საჭიროებდეს.",
        photoTooLarge: "სურათი 950 KB-ზე ქვემოთ ვერ შემცირდა.", expired: "სესია ამოიწურა. შედით თავიდან.",
        conflict: "მენიუ სხვა მოწყობილობაზე შეიცვალა. განაახლეთ ადმინისტრატორის გვერდი."
    }
};

const $ = id => document.getElementById(id);
const loginScreen = $("loginScreen");
const adminContainer = $("adminContainer");
const loginForm = $("loginForm");
const loginError = $("loginError");
const loginButton = $("loginButton");
const adminPassword = $("adminPassword");
const info = $("saveInfo");
const categoryList = $("categoryList");
const dishList = $("dishList");
const categorySelect = $("dishCategory");
const dishForm = $("dishForm");
const imageInput = $("dishImage");
const previewContainer = $("previewContainer");
const imagePreview = $("imagePreview");

let currentLanguage = localStorage.getItem(LANGUAGE_KEY) === "ge" ? "ge" : "en";
let currentTheme = localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
let token = sessionStorage.getItem(TOKEN_KEY) || "";
let categories = [];
let dishes = [];
let categorySettings = {};
let menuSha = "";
let menuReady = false;
let saving = false;
let imageProcessing = false;
let pendingImage = null;
let pendingPreviewUrl = null;
let draggedCategoryId = null;
let draggedDishId = null;

function t() { return adminTranslations[currentLanguage]; }
function configured() { return /^https:\/\/[\w.-]+(?:\/.*)?$/.test(API_BASE_URL); }
function api(path) { return API_BASE_URL.replace(/\/$/, "") + path; }
function escapeHTML(value) {
    return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function displayText(ge, en) {
    return currentLanguage === "ge" ? (ge || en || "") : (en || ge || "");
}
function categoryName(category) { return displayText(category.nameGe, category.nameEn); }
function dishName(dish) { return displayText(dish.nameGe, dish.nameEn); }
function id(prefix) { return `${prefix}-${crypto.randomUUID()}`; }
function photoPath(path) {
    if (!path) return "";
    if (/^(https?:|blob:|data:)/.test(path)) return path;
    if (path.startsWith("images/")) return "../" + path;
    return path;
}
function setInfo(text, error = false) {
    info.textContent = text;
    info.style.color = error ? "#d24a4a" : "";
}
function showLogin(message = "") {
    menuReady = false;
    adminContainer.hidden = true;
    loginScreen.hidden = false;
    loginError.textContent = message;
    token = "";
    sessionStorage.removeItem(TOKEN_KEY);
}
function showAdmin() {
    loginScreen.hidden = true;
    adminContainer.hidden = false;
}
function applyTheme() {
    document.body.classList.toggle("dark-mode", currentTheme === "dark");
    $("themeToggle").textContent = currentTheme === "dark" ? "☀️" : "🌙";
}
function updateCategoryFormButtons() {
    $("addCategoryButton").textContent = $("editCategoryId").value ? t().saveCategory : t().addCategory;
    $("cancelCategoryEditButton").textContent = t().cancelEdit;
    $("cancelCategoryEditButton").classList.toggle("hidden", !$("editCategoryId").value);
}
function updateDishFormButtons() {
    $("saveButton").textContent = $("editId").value ? t().saveChanges : t().addDish;
    $("cancelEditButton").textContent = t().cancelEdit;
    $("cancelEditButton").classList.toggle("hidden", !$("editId").value);
}
function translateUI() {
    const labels = {
        adminTitle: "adminTitle", adminSubtitle: "adminSubtitle", viewMenuButton: "viewMenu", logoutButton: "logout",
        loginTitle: "loginTitle", loginSubtitle: "loginSubtitle", passwordLabel: "password", loginButton: "signIn", loginBackLink: "loginBack",
        categoriesSectionTitle: "editCategories", categoriesDescription: "categoriesDescription", categoryFieldNote: "categoryNote",
        dishSectionTitle: "addEditDish", dishNameGeLabel: "dishNameGe", dishNameEnLabel: "dishNameEn", dishNameNote: "dishNameNote",
        descriptionGeLabel: "descriptionGe", descriptionEnLabel: "descriptionEn", priceLabel: "price", categoryLabel: "category",
        dishImageLabel: "image", imagePreviewLabel: "imagePreview", uploadNote: "uploadNote",
        currentMenuTitle: "currentMenu", currentMenuDescription: "currentMenuDescription"
    };
    for (const [nodeId, key] of Object.entries(labels)) $(nodeId).textContent = t()[key];
    $("newCategoryGe").placeholder = t().categoryGePlaceholder;
    $("newCategoryEn").placeholder = t().categoryEnPlaceholder;
    document.documentElement.lang = currentLanguage === "ge" ? "ka" : "en";
    $("languageGe").classList.toggle("active", currentLanguage === "ge");
    $("languageEn").classList.toggle("active", currentLanguage === "en");
    updateCategoryFormButtons();
    updateDishFormButtons();
    if (menuReady) { renderCategories(); renderDishes(); }
}
$("languageGe").addEventListener("click", () => {
    currentLanguage = "ge"; localStorage.setItem(LANGUAGE_KEY, currentLanguage); translateUI();
});
$("languageEn").addEventListener("click", () => {
    currentLanguage = "en"; localStorage.setItem(LANGUAGE_KEY, currentLanguage); translateUI();
});
$("themeToggle").addEventListener("click", () => {
    currentTheme = currentTheme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, currentTheme); applyTheme();
});
$("logoutButton").addEventListener("click", () => showLogin());

/* -------------------------------------
   ONLINE API: authenticated requests
------------------------------------- */
async function requestOnline(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(api(path), { ...options, headers, cache: "no-store" });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== "/login") {
        showLogin(t().expired);
        throw new Error(t().expired);
    }
    if (!response.ok) {
        const error = new Error(result.error || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return result;
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    loginError.textContent = "";
    if (!configured()) { loginError.textContent = t().noBackend; return; }
    loginButton.disabled = true;
    try {
        const result = await requestOnline("/login", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: adminPassword.value })
        });
        if (!result.token) throw new Error("Login returned no token.");
        token = result.token;
        sessionStorage.setItem(TOKEN_KEY, token);
        adminPassword.value = "";
        await loadMenu();
    } catch (error) {
        loginError.textContent = t().loginError + " " + error.message;
    } finally { loginButton.disabled = false; }
});

async function loadMenu() {
    if (!configured()) { showLogin(t().noBackend); return; }
    if (!token) { showLogin(); return; }
    try {
        setInfo(t().loading);
        const result = await requestOnline("/menu");
        if (!result.menu || !result.sha || !Array.isArray(result.menu.categories) || !Array.isArray(result.menu.dishes)) {
            throw new Error("Invalid menu returned by the backend.");
        }
        categories = result.menu.categories;
        dishes = result.menu.dishes;
        categorySettings = result.menu.categorySettings || {};
        menuSha = result.sha;
        menuReady = true;
        renderCategories(); renderDishes(); showAdmin(); setInfo("");
    } catch (error) {
        if (token) showLogin(error.message);
    }
}

async function saveMenu() {
    const result = await requestOnline("/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sha: menuSha, menu: { categories, dishes, categorySettings } })
    });
    if (!result.sha) throw new Error("GitHub did not return a new revision.");
    menuSha = result.sha;
}

async function commitChange(change) {
    if (!menuReady || saving) return false;
    const before = structuredClone({ categories, dishes, categorySettings });
    saving = true;
    try {
        change();
        await saveMenu();
        setInfo(t().menuSaved);
        return true;
    } catch (error) {
        categories = before.categories; dishes = before.dishes; categorySettings = before.categorySettings;
        const message = error.status === 409 ? t().conflict : `${t().saveError} ${error.message}`;
        setInfo(message, true);
        alert(message);
        return false;
    } finally {
        saving = false;
        renderCategories(); renderDishes();
    }
}

/* -------------------------------------
   CATEGORIES
------------------------------------- */
function renderCategories() {
    const previousValue = categorySelect.value;
    categoryList.replaceChildren(); categorySelect.replaceChildren();
    categories.sort((a, b) => a.order - b.order);
    for (const category of categories) {
        const option = document.createElement("option");
        option.value = category.id; option.textContent = categoryName(category); categorySelect.appendChild(option);
        const showImages = categorySettings[category.id]?.showImages !== false;
        const row = document.createElement("div"); row.className = "category-row"; row.dataset.id = category.id;
        row.innerHTML = `
          <div class="category-drag-handle" draggable="true" data-id="${escapeHTML(category.id)}" title="Drag category">≡</div>
          <div class="category-main">
            <div class="category-names">
              <span class="category-language-value">GE: ${escapeHTML(category.nameGe || "—")}</span>
              <span class="category-language-value">EN: ${escapeHTML(category.nameEn || "—")}</span>
            </div>
            <div class="image-toggle-wrapper"><span>🖼 ${escapeHTML(t().images)}</span>
              <button type="button" class="image-toggle ${showImages ? "on" : ""}"
                role="switch" aria-checked="${showImages}" data-id="${escapeHTML(category.id)}"
                aria-label="${escapeHTML(t().images)}"></button>
            </div>
          </div>
          <div class="category-actions">
            <button type="button" class="category-edit-button" data-id="${escapeHTML(category.id)}">${escapeHTML(t().edit)}</button>
            <button type="button" class="category-delete-button" data-id="${escapeHTML(category.id)}">${escapeHTML(t().delete)}</button>
          </div>`;
        categoryList.appendChild(row);
    }
    if ([...categorySelect.options].some(option => option.value === previousValue)) categorySelect.value = previousValue;
    categoryList.querySelectorAll(".category-edit-button").forEach(button =>
        button.addEventListener("click", () => editCategory(button.dataset.id)));
    categoryList.querySelectorAll(".category-delete-button").forEach(button =>
        button.addEventListener("click", () => deleteCategory(button.dataset.id)));
    categoryList.querySelectorAll(".image-toggle").forEach(button =>
        button.addEventListener("click", () => commitChange(() => {
            const key = button.dataset.id;
            categorySettings[key] = { showImages: !(categorySettings[key]?.showImages !== false) };
        })));
    attachDrag(categoryList, ".category-row", ".category-drag-handle", id => { draggedCategoryId = id; },
        () => draggedCategoryId, (from, to) => reorderCategories(from, to));
}
function resetCategoryForm() {
    $("editCategoryId").value = ""; $("newCategoryGe").value = ""; $("newCategoryEn").value = "";
    updateCategoryFormButtons();
}
$("cancelCategoryEditButton").addEventListener("click", resetCategoryForm);
$("addCategoryButton").addEventListener("click", async () => {
    const ge = $("newCategoryGe").value.trim();
    const en = $("newCategoryEn").value.trim();
    if (!ge && !en) { alert(t().categoryRequired); return; }
    if (ge.length > 200 || en.length > 200) { alert("Category names must be 200 characters or fewer."); return; }
    const editing = $("editCategoryId").value;
    const success = await commitChange(() => {
        if (editing) {
            const category = categories.find(c => c.id === editing);
            if (!category) throw new Error("Category not found.");
            category.nameGe = ge; category.nameEn = en;
        } else {
            const newId = id("category");
            const nextOrder = categories.length ? Math.max(...categories.map(c => c.order)) + 1 : 0;
            categories.push({ id: newId, nameGe: ge, nameEn: en, order: nextOrder });
            categorySettings[newId] = { showImages: true };
        }
    });
    if (success) resetCategoryForm();
});
function editCategory(categoryId) {
    const category = categories.find(c => c.id === categoryId); if (!category) return;
    $("editCategoryId").value = category.id;
    $("newCategoryGe").value = category.nameGe;
    $("newCategoryEn").value = category.nameEn;
    updateCategoryFormButtons();
    const section = categoryList.closest(".admin-section"); section.open = true;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
    $("newCategoryGe").focus();
}
async function deleteCategory(categoryId) {
    const count = dishes.filter(dish => dish.categoryId === categoryId).length;
    const message = count ? t().deleteCategoryWithDishes.replace("{count}", count) : t().deleteCategory;
    if (!confirm(message)) return;
    const success = await commitChange(() => {
        categories = categories.filter(c => c.id !== categoryId);
        dishes = dishes.filter(dish => dish.categoryId !== categoryId);
        delete categorySettings[categoryId];
        categories.forEach((c, i) => { c.order = i; });
        dishes.forEach((dish, i) => { dish.order = i; });
    });
    if (success && $("editCategoryId").value === categoryId) resetCategoryForm();
}
async function reorderCategories(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    await commitChange(() => {
        categories.sort((a, b) => a.order - b.order);
        const from = categories.findIndex(c => c.id === fromId);
        const to = categories.findIndex(c => c.id === toId);
        if (from < 0 || to < 0) return;
        categories.splice(to, 0, categories.splice(from, 1)[0]);
        categories.forEach((c, i) => { c.order = i; });
    });
}

/* -------------------------------------
   SHARED DESKTOP DRAG/DROP
------------------------------------- */
function attachDrag(parent, rowSelector, handleSelector, setId, getId, reorder) {
    parent.querySelectorAll(handleSelector).forEach(handle => {
        handle.addEventListener("dragstart", event => {
            setId(handle.dataset.id);
            event.dataTransfer.setData("text/plain", handle.dataset.id);
            handle.closest(rowSelector).classList.add("dragging");
        });
        handle.addEventListener("dragend", () => {
            setId(null);
            parent.querySelectorAll(rowSelector).forEach(row => row.classList.remove("dragging", "drag-over"));
        });
    });
    parent.querySelectorAll(rowSelector).forEach(row => {
        row.addEventListener("dragover", event => { event.preventDefault(); row.classList.add("drag-over"); });
        row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
        row.addEventListener("drop", event => {
            event.preventDefault(); row.classList.remove("drag-over");
            reorder(getId(), row.dataset.id);
        });
    });
}

/* -------------------------------------
   PHOTO OPTIMIZATION BEFORE UPLOAD
------------------------------------- */
function releasePreview() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    pendingPreviewUrl = null;
}
function canvasBlob(canvas, quality) {
    return new Promise((resolve, reject) => canvas.toBlob(
        result => result ? resolve(result) : reject(new Error("JPEG encoding failed.")),
        "image/jpeg", quality
    ));
}
async function compressImage(file) {
    if (!file || file.size > MAX_ORIGINAL_BYTES) throw new Error(t().imageTooLarge);
    if (!file.type.startsWith("image/")) throw new Error(t().imageInvalid);
    const temp = URL.createObjectURL(file);
    try {
        const img = new Image(); img.src = temp; await img.decode();
        const maxOriginal = Math.max(img.naturalWidth, img.naturalHeight);
        if (!maxOriginal) throw new Error(t().imageInvalid);
        for (const dimension of [1200, 1000, 850, 700]) {
            const scale = Math.min(1, dimension / maxOriginal);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
            const context = canvas.getContext("2d");
            if (!context) throw new Error("Canvas is not supported.");
            context.fillStyle = "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            for (const quality of [0.8, 0.68, 0.55]) {
                const blob = await canvasBlob(canvas, quality);
                if (blob.size <= MAX_UPLOAD_BYTES) {
                    return new File([blob], `dish-${crypto.randomUUID()}.jpg`, { type: "image/jpeg" });
                }
            }
        }
        throw new Error(t().photoTooLarge);
    } catch (error) {
        throw new Error(error.message || t().imageInvalid);
    } finally { URL.revokeObjectURL(temp); }
}
imageInput.addEventListener("change", async event => {
    const file = event.target.files?.[0]; if (!file) return;
    imageProcessing = true; pendingImage = null; releasePreview();
    $("saveButton").disabled = true; setInfo(t().processing);
    try {
        pendingImage = await compressImage(file);
        pendingPreviewUrl = URL.createObjectURL(pendingImage);
        imagePreview.src = pendingPreviewUrl;
        previewContainer.style.display = "block";
        setInfo("");
    } catch (error) {
        imageInput.value = ""; setInfo(error.message, true); alert(error.message);
    } finally { imageProcessing = false; $("saveButton").disabled = false; }
});
async function uploadImage(file) {
    const body = new FormData(); body.append("image", file);
    const result = await requestOnline("/upload", { method: "POST", body });
    if (!result.url || !result.url.startsWith("images/uploads/")) throw new Error("Unexpected upload response.");
    return result.url;
}

/* -------------------------------------
   DISH FORM
------------------------------------- */
function resetDishForm() {
    dishForm.reset(); $("editId").value = "";
    releasePreview(); pendingImage = null; imagePreview.removeAttribute("src");
    previewContainer.style.display = "none";
    updateDishFormButtons();
}
$("cancelEditButton").addEventListener("click", resetDishForm);
dishForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (imageProcessing || saving) return;
    const nameGe = $("dishNameGe").value.trim();
    const nameEn = $("dishNameEn").value.trim();
    const descriptionGe = $("dishDescriptionGe").value.trim();
    const descriptionEn = $("dishDescriptionEn").value.trim();
    const price = Number($("dishPrice").value);
    const categoryId = categorySelect.value;
    const editingId = $("editId").value;
    if (!nameGe && !nameEn) { alert(t().dishRequired); return; }
    if (!Number.isFinite(price) || price < 0 || !categories.some(c => c.id === categoryId)) {
        alert("Enter a valid price and category."); return;
    }
    if (nameGe.length > 200 || nameEn.length > 200 || descriptionGe.length > 2500 || descriptionEn.length > 2500) {
        alert("Dish name or description is too long."); return;
    }
    const existing = editingId ? dishes.find(dish => dish.id === editingId) : null;
    if (editingId && !existing) { alert("Dish not found."); return; }
    $("saveButton").disabled = true;
    try {
        let image = existing?.image || "";
        if (pendingImage) image = await uploadImage(pendingImage);
        const success = await commitChange(() => {
            if (existing) {
                const dish = dishes.find(d => d.id === editingId);
                Object.assign(dish, { nameGe, nameEn, descriptionGe, descriptionEn, price, categoryId, image });
            } else {
                dishes.push({
                    id: id("dish"), nameGe, nameEn, descriptionGe, descriptionEn,
                    price, categoryId, image,
                    order: dishes.length ? Math.max(...dishes.map(d => d.order)) + 1 : 0
                });
            }
        });
        if (success) resetDishForm();
    } catch (error) {
        setInfo(`${t().saveError} ${error.message}`, true);
        alert(`${t().saveError} ${error.message}`);
    } finally { $("saveButton").disabled = false; }
});

/* -------------------------------------
   CURRENT DISHES
------------------------------------- */
function renderDishes() {
    dishList.replaceChildren();
    if (!dishes.length) { dishList.textContent = t().noDishes; return; }
    dishes.sort((a, b) => a.order - b.order);
    for (const dish of dishes) {
        const category = categories.find(c => c.id === dish.categoryId);
        const row = document.createElement("div"); row.className = "dish-row"; row.dataset.id = dish.id;
        row.innerHTML = `
          <div class="drag-handle" draggable="true" data-id="${escapeHTML(dish.id)}" title="Drag dish">≡</div>
          <div class="dish-info"><h3>${escapeHTML(dishName(dish) || t().unnamed)}</h3>
            <p><span class="dish-language">GE</span> ${escapeHTML(dish.nameGe || "—")}</p>
            <p><span class="dish-language">EN</span> ${escapeHTML(dish.nameEn || "—")}</p>
            <p>${escapeHTML(t().categoryWord)}: ${escapeHTML(category ? categoryName(category) : "—")}</p>
            <strong>${Number(dish.price).toFixed(2)} GEL</strong>
          </div>
          <div class="actions">
            <button type="button" class="edit-btn" data-id="${escapeHTML(dish.id)}">${escapeHTML(t().edit)}</button>
            <button type="button" class="delete-btn" data-id="${escapeHTML(dish.id)}">${escapeHTML(t().delete)}</button>
          </div>`;
        const img = document.createElement("img");
        img.alt = dishName(dish); img.loading = "lazy";
        if (dish.image) img.src = photoPath(dish.image);
        else img.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#ddd"/><text x="150" y="100" text-anchor="middle" fill="#555" font-size="18">No Image</text></svg>');
        row.insertBefore(img, row.querySelector(".dish-info"));
        dishList.appendChild(row);
    }
    dishList.querySelectorAll(".edit-btn").forEach(button =>
        button.addEventListener("click", () => editDish(button.dataset.id)));
    dishList.querySelectorAll(".delete-btn").forEach(button =>
        button.addEventListener("click", () => deleteDish(button.dataset.id)));
    attachDrag(dishList, ".dish-row", ".drag-handle", id => { draggedDishId = id; },
        () => draggedDishId, (from, to) => reorderDishes(from, to));
}
function editDish(dishId) {
    const dish = dishes.find(d => d.id === dishId); if (!dish) return;
    $("editId").value = dish.id;
    $("dishNameGe").value = dish.nameGe || "";
    $("dishNameEn").value = dish.nameEn || "";
    $("dishDescriptionGe").value = dish.descriptionGe || "";
    $("dishDescriptionEn").value = dish.descriptionEn || "";
    $("dishPrice").value = dish.price;
    categorySelect.value = dish.categoryId;
    releasePreview(); pendingImage = null; imageInput.value = "";
    if (dish.image) { imagePreview.src = photoPath(dish.image); previewContainer.style.display = "block"; }
    else { imagePreview.removeAttribute("src"); previewContainer.style.display = "none"; }
    updateDishFormButtons();
    const section = dishForm.closest(".admin-section"); section.open = true;
    section.scrollIntoView({ behavior: "smooth", block: "start" });
}
async function deleteDish(dishId) {
    if (!confirm(t().deleteDish)) return;
    const success = await commitChange(() => {
        dishes = dishes.filter(d => d.id !== dishId);
        dishes.forEach((dish, i) => { dish.order = i; });
    });
    if (success && $("editId").value === dishId) resetDishForm();
}
async function reorderDishes(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    await commitChange(() => {
        dishes.sort((a, b) => a.order - b.order);
        const from = dishes.findIndex(d => d.id === fromId);
        const to = dishes.findIndex(d => d.id === toId);
        if (from < 0 || to < 0) return;
        dishes.splice(to, 0, dishes.splice(from, 1)[0]);
        dishes.forEach((dish, i) => { dish.order = i; });
    });
}

/* -------------------------------------
   INITIALIZE
------------------------------------- */
applyTheme(); translateUI();
if (token) loadMenu();
else showLogin(configured() ? "" : t().noBackend);
