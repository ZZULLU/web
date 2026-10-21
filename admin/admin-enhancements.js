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

  function applyDishSearch() {
    const q = search.value.trim().toLocaleLowerCase();
    const rows = rowsOf(dishList);
    let shown = 0;
    for (const row of rows) {
      const info = row.querySelector('.dish-info');
      const match = !q || Boolean(info && info.textContent.toLocaleLowerCase().includes(q));
      row.classList.toggle('admin-filtered-out', !match);
      if (match) shown++;
    }
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

  search.addEventListener('input', applyDishSearch);
  document.getElementById('languageGe')?.addEventListener('click', applyDishSearch);
  document.getElementById('languageEn')?.addEventListener('click', applyDishSearch);
  observeList(dishList, 'dish');
  observeList(categoryList, 'category');
})();
