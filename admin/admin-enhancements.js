/*
 * UI enhancements for the existing Admin page.
 * Online persistence and authentication remain in admin.js.
 * This uses the existing reorderDishes() and reorderCategories().
 */
(() => {
  const search = document.getElementById('adminDishSearch');
  const count = document.getElementById('adminDishSearchCount');
  const dishList = document.getElementById('dishList');
  const categoryList = document.getElementById('categoryList');
  if (!search || !count || !dishList || !categoryList) return;

  const isGeorgian = () => localStorage.getItem('restaurantLanguage') === 'ge';
  const rowsOf = list => Array.from(list.children).filter(row =>
    row.classList.contains('dish-row') || row.classList.contains('category-row')
  );
  let orderSaving = false;
  let showAll = false;
  const showAllButton = document.getElementById('adminShowAllDishes');
  const showAllText = document.getElementById('adminShowAllDishesText');
  function applyAllFilter() {
    const all = rowsOf(dishList);
    all.forEach(row => {
      row.classList.toggle('admin-hidden-filtered', !showAll && row.classList.contains('dish-is-hidden'));
    });
    const ge = isGeorgian();
    if (showAllText) showAllText.textContent = showAll
      ? (ge ? 'მხოლოდ ხილული' : 'Visible items only')
      : (ge ? 'ყველა კერძის ჩვენება' : 'Show all items');
    if (showAllButton) {
      showAllButton.setAttribute('aria-pressed', String(showAll));
      showAllButton.title = showAllText?.textContent || '';
    }
  }
  showAllButton?.addEventListener('click', () => {
    showAll = !showAll; applyAllFilter(); applyDishSearch();
  });

  function applyDishSearch() {
    const q = search.value.trim().toLocaleLowerCase();
    const rows = rowsOf(dishList);
    let shown = 0;
    for (const row of rows) {
      const info = row.querySelector('.dish-info');
      const match = !q || Boolean(info && info.textContent.toLocaleLowerCase().includes(q));
      row.classList.toggle('admin-filtered-out', !match);
      if (match && !row.classList.contains('admin-hidden-filtered')) shown++;
    }
    applyAllFilter();
    shown = rows.filter(row => !row.classList.contains('admin-filtered-out') && !row.classList.contains('admin-hidden-filtered')).length;
    count.textContent = isGeorgian()
      ? `${shown} / ${rows.length} კერძი`
      : `${shown} / ${rows.length} dishes`;
  }

  function makeOrderButtons(list, type) {
    const rows = rowsOf(list);
    const selector = type === 'dish' ? '.dish-order-actions' : '.category-order-actions';
    rows.forEach((row, index) => {
      if (row.querySelector(selector)) return;
      const controls = document.createElement('div');
      controls.className = type === 'dish' ? 'dish-order-actions' : 'category-order-actions';
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', type === 'dish' ? 'Dish order' : 'Category order');

      const makeButton = (direction, targetIndex) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = direction === 'up' ? '↑' : '↓';
        button.title = `Move ${type} ${direction}`;
        button.setAttribute('aria-label', button.title);
        button.disabled = targetIndex < 0 || targetIndex >= rows.length;
        button.addEventListener('click', async () => {
          if (orderSaving) return;
          const liveRows = rowsOf(list);
          const currentIndex = liveRows.findIndex(r => r.dataset.id === row.dataset.id);
          const nextIndex = currentIndex + (direction === 'up' ? -1 : 1);
          if (currentIndex < 0 || nextIndex < 0 || nextIndex >= liveRows.length) return;
          const functionName = type === 'dish' ? 'reorderDishes' : 'reorderCategories';
          const reorder = type === 'dish'
            ? (typeof reorderDishes === 'function' ? reorderDishes : null)
            : (typeof reorderCategories === 'function' ? reorderCategories : null);
          if (!reorder) { console.error(`${functionName} is unavailable`); return; }
          orderSaving = true;
          try {
            await reorder(row.dataset.id, liveRows[nextIndex].dataset.id);
          } finally {
            orderSaving = false;
          }
        });
        return button;
      };
      controls.append(makeButton('up', index - 1), makeButton('down', index + 1));
      row.insertBefore(controls, row.firstChild);
    });
    if (type === 'dish') applyDishSearch();
  }

  const observeList = (list, type) => {
    const refresh = () => makeOrderButtons(list, type);
    const observer = new MutationObserver(mutations => {
      // Only react when the original Admin renderer replaces the list's rows.
      if (mutations.some(m => m.target === list && m.type === 'childList')) refresh();
    });
    observer.observe(list, { childList: true });
    refresh();
  };

  dishList.addEventListener('admin-visibility-updated', () => { applyAllFilter(); applyDishSearch(); });
  search.addEventListener('input', applyDishSearch);
  document.getElementById('languageGe')?.addEventListener('click', applyDishSearch);
  document.getElementById('languageEn')?.addEventListener('click', applyDishSearch);
  observeList(dishList, 'dish');
  observeList(categoryList, 'category');
  setTimeout(applyDishSearch, 0);
})();

/* =========================================================
   Restaurant-wide personal list switch (online via GitHub).
   Uses the existing authenticated commitChange() in admin.js.
   The existing Worker accepts extra category setting fields.
   We copy the on/off flag to every current category so it
   survives deletion/reordering without changing the Worker.
========================================================= */
(() => {
  const adminContainer = document.getElementById('adminContainer');
  const categorySection = document.getElementById('categoryList')?.closest('.admin-section');
  if (!adminContainer || !categorySection) return;

  const section = document.createElement('section');
  section.className = 'admin-personal-feature';
  section.innerHTML = `
    <div class="admin-personal-feature-text">
      <h2 id="personalFeatureTitle">Customer personal lists</h2>
      <p id="personalFeatureDescription">Let customers save dishes and quantities in their own browser before speaking to the waiter. No orders are sent.</p>
    </div>
    <label class="admin-personal-switch">
      <input id="enablePersonalLists" type="checkbox" disabled>
      <span class="admin-personal-switch-track" aria-hidden="true"></span>
      <span id="personalFeatureStatus">Off</span>
    </label>
    <p class="admin-personal-hint" id="personalFeatureHint" role="status" aria-live="polite"></p>
  `;
  adminContainer.insertBefore(section, categorySection);
  const checkbox = section.querySelector('#enablePersonalLists');
  const status = section.querySelector('#personalFeatureStatus');
  const hint = section.querySelector('#personalFeatureHint');
  let busy = false;

  function update() {
    const ge = localStorage.getItem('restaurantLanguage') === 'ge';
    section.querySelector('#personalFeatureTitle').textContent = ge ? 'მომხმარებლის პირადი სია' : 'Customer personal lists';
    section.querySelector('#personalFeatureDescription').textContent = ge
      ? 'მომხმარებლებს შეუძლიათ კერძებისა და რაოდენობების შენახვა საკუთარ ბრაუზერში მიმტანთან საუბრამდე. შეკვეთა არ იგზავნება.'
      : 'Let customers save dishes and quantities in their own browser before speaking to the waiter. No orders are sent.';
    const ready = typeof menuReady !== 'undefined' && menuReady;
    const hasCategories = typeof categories !== 'undefined' && categories.length > 0;
    const enabled = ready && categories.some(c => categorySettings[c.id]?.personalListEnabled === true);
    checkbox.checked = enabled;
    checkbox.disabled = busy || !ready || !hasCategories;
    status.textContent = ge ? (enabled ? 'ჩართულია' : 'გამორთულია') : (enabled ? 'On' : 'Off');
    if (!busy) hint.textContent = hasCategories
      ? ''
      : (ge ? 'ჯერ დაამატეთ მინიმუმ ერთი კატეგორია.' : 'Add at least one category before enabling lists.');
  }

  checkbox.addEventListener('change', async () => {
    if (busy || typeof commitChange !== 'function') return;
    const next = checkbox.checked;
    busy = true;
    checkbox.disabled = true;
    hint.textContent = localStorage.getItem('restaurantLanguage') === 'ge' ? 'ინახება...' : 'Saving to GitHub...';
    try {
      const saved = await commitChange(() => {
        // Preserve showImages and any other per-category settings.
        for (const cat of categories) {
          categorySettings[cat.id] = {
            ...categorySettings[cat.id],
            showImages: categorySettings[cat.id]?.showImages !== false,
            personalListEnabled: next
          };
        }
      });
      hint.textContent = saved
        ? (localStorage.getItem('restaurantLanguage') === 'ge'
          ? 'შენახულია. საიტზე გამოჩენას შესაძლოა რამდენიმე წუთი დასჭირდეს.'
          : 'Saved. GitHub Pages may take a minute to publish the change.')
        : (localStorage.getItem('restaurantLanguage') === 'ge' ? 'შენახვა ვერ მოხერხდა.' : 'Could not save the setting.');
    } finally {
      busy = false;
      update();
    }
  });

  document.getElementById('languageGe')?.addEventListener('click', update);
  document.getElementById('languageEn')?.addEventListener('click', update);
  const categoryList = document.getElementById('categoryList');
  const observer = new MutationObserver(update);
  if (categoryList) observer.observe(categoryList, { childList: true });
  update();
})();

/* Dish availability and corner tags: saved with the existing authenticated
   commitChange() / GitHub Worker. No changes to admin.js or Worker. */
(() => {
  const list = document.getElementById('dishList');
  if (!list) return;
  const text = {
    ge: { show: 'ჩანს მენიუში', hide: 'დამალულია', tag: 'ნიშანი', none: 'ნიშნის გარეშე', popular: 'პოპულარული', new: 'ახალი', sale: 'ფასდაკლება', save: 'ინახება…', error: 'შენახვა ვერ მოხერხდა' },
    en: { show: 'Visible', hide: 'Hidden', tag: 'Label', none: 'No label', popular: 'Popular', new: 'New', sale: 'Sale', save: 'Saving…', error: 'Could not save' }
  };
  const lang = () => {
    try { return JSON.parse(localStorage.getItem('restaurantLanguage')) === 'ge' ? 'ge' : 'en'; }
    catch { return localStorage.getItem('restaurantLanguage') === 'ge' ? 'ge' : 'en'; }
  };
  let busy = false;
  const setDishField = async (id, field, value) => {
    if (busy || typeof commitChange !== 'function') return false;
    busy = true;
    try {
      return await commitChange(() => {
        const dish = dishes.find(d => d.id === id);
        if (!dish) throw new Error('Dish not found');
        dish[field] = value;
      });
    } finally { busy = false; }
  };
  function applyControls() {
    if (typeof dishes === 'undefined') return;
    const w = text[lang()];
    list.querySelectorAll('.dish-row').forEach(row => {
      if (row.dataset.availabilityReady === '1') return;
      row.dataset.availabilityReady = '1';
      const dish = dishes.find(d => d.id === row.dataset.id);
      if (!dish) return;
      const actions = row.querySelector('.actions');
      const info = row.querySelector('.dish-info');
      if (!actions || !info) return;

      // The eye lives beside Edit/Delete, not in a full-width settings bar.
      const eye = document.createElement('button');
      eye.type = 'button'; eye.className = 'dish-visibility-eye';
      const eyeSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
      const hiddenSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"/><path d="M10.6 5.1c.5-.1.9-.1 1.4-.1 6.5 0 10 7 10 7a17 17 0 0 1-3.2 3.7M6.3 6.3A15 15 0 0 0 2 12s3.5 7 10 7c1.5 0 2.8-.4 3.9-1"/><path d="M10 10a3 3 0 0 0 4 4"/></svg>';
      const syncEye = () => {
        const isVisible = dish.visible !== false;
        eye.innerHTML = isVisible ? eyeSvg : hiddenSvg;
        eye.setAttribute('aria-pressed', String(isVisible));
        eye.setAttribute('aria-label', isVisible ? w.show : w.hide);
        eye.title = (isVisible ? w.show : w.hide) + ' — click to change';
        row.classList.toggle('dish-is-hidden', !isVisible);
        row.dispatchEvent(new CustomEvent('admin-visibility-updated', { bubbles: true }));
      };
      eye.addEventListener('click', async () => {
        if (busy) return;
        eye.disabled = true;
        const success = await setDishField(dish.id, 'visible', dish.visible === false);
        if (!success) syncEye();
        eye.disabled = false;
      });
      actions.prepend(eye);

      // Compact label selector under the dish's price/details.
      const tagWrap = document.createElement('div');
      tagWrap.className = 'dish-tag-inline';
      const tagTitle = document.createElement('span');
      tagTitle.className = 'dish-tag-caption'; tagTitle.textContent = w.tag;
      const select = document.createElement('select');
      for (const [key, caption] of [['', w.none], ['popular', w.popular], ['new', w.new], ['sale', w.sale]]) {
        const option = document.createElement('option'); option.value = key; option.textContent = caption; select.append(option);
      }
      select.value = ['popular', 'new', 'sale'].includes(dish.tag) ? dish.tag : '';
      select.setAttribute('aria-label', w.tag);
      select.addEventListener('change', async () => {
        const previous = dish.tag || '';
        select.disabled = true;
        const result = await setDishField(dish.id, 'tag', select.value);
        if (!result) select.value = previous;
        select.disabled = false;
      });
      tagWrap.append(tagTitle, select);
      info.append(tagWrap);
      syncEye();
    });
  }
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.type === 'childList' && m.target === list)) applyControls();
  });
  observer.observe(list, { childList: true });
  applyControls();
  document.getElementById('languageGe')?.addEventListener('click', () => setTimeout(applyControls, 0));
  document.getElementById('languageEn')?.addEventListener('click', () => setTimeout(applyControls, 0));
})();
