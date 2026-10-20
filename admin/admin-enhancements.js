/*
 * UI-only enhancements for the existing authenticated Admin dashboard.
 * DO NOT replace admin.js: it contains your actual Worker URL and login flow.
 * This file reuses the existing reorderDishes(), which persists changes online.
 */
(() => {
  const search = document.getElementById('adminDishSearch');
  const count = document.getElementById('adminDishSearchCount');
  const list = document.getElementById('dishList');
  if (!search || !count || !list) return;

  const currentLanguage = () => localStorage.getItem('restaurantLanguage') === 'ge' ? 'ge' : 'en';
  const allRows = () => Array.from(list.querySelectorAll('.dish-row'));

  function applyFilter() {
    const q = search.value.trim().toLocaleLowerCase();
    const rows = allRows();
    let visible = 0;
    for (const row of rows) {
      const info = row.querySelector('.dish-info');
      const matches = !q || (info && info.textContent.toLocaleLowerCase().includes(q));
      row.classList.toggle('admin-filtered-out', !matches);
      if (matches) visible++;
    }
    count.textContent = currentLanguage() === 'ge'
      ? `${visible} / ${rows.length} კერძი`
      : `${visible} / ${rows.length} dishes`;
  }

  function decorateRows() {
    const rows = allRows();
    rows.forEach((row, index) => {
      if (row.querySelector('.dish-order-actions')) return;
      const controls = document.createElement('div');
      controls.className = 'dish-order-actions';
      controls.setAttribute('role', 'group');
      controls.setAttribute('aria-label', 'Reorder dish');
      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = '↑';
      up.title = 'Move dish up';
      up.setAttribute('aria-label', 'Move dish up');
      up.disabled = index === 0;
      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = '↓';
      down.title = 'Move dish down';
      down.setAttribute('aria-label', 'Move dish down');
      down.disabled = index === rows.length - 1;
      up.addEventListener('click', async () => {
        const previous = allRows()[index - 1];
        if (previous && typeof reorderDishes === 'function') {
          up.disabled = true;
          await reorderDishes(row.dataset.id, previous.dataset.id);
        }
      });
      down.addEventListener('click', async () => {
        const next = allRows()[index + 1];
        if (next && typeof reorderDishes === 'function') {
          down.disabled = true;
          await reorderDishes(row.dataset.id, next.dataset.id);
        }
      });
      controls.append(up, down);
      row.insertBefore(controls, row.firstChild);
    });
    applyFilter();
  }

  /* The existing admin code completely redraws the dish rows after a save.
     Watch only direct child changes so adding controls doesn't cause a loop. */
  const observer = new MutationObserver(mutations => {
    if (mutations.some(m => m.type === 'childList' && m.target === list)) {
      decorateRows();
    }
  });
  observer.observe(list, { childList: true });
  search.addEventListener('input', applyFilter);
  document.getElementById('languageGe')?.addEventListener('click', applyFilter);
  document.getElementById('languageEn')?.addEventListener('click', applyFilter);
  decorateRows();
})();
