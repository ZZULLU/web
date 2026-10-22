/* Admin menu enhancements. Uses original admin.js for login, updates and storage. */
(() => {
  const list = document.getElementById('dishList');
  const categoryList = document.getElementById('categoryList');
  const search = document.getElementById('adminDishSearch');
  const count = document.getElementById('adminDishSearchCount');
  const showAll = document.getElementById('adminShowAllDishes');
  if (!list || !categoryList || !search || !count) return;
  const ge = () => {
    const raw = localStorage.getItem('restaurantLanguage');
    return raw === 'ge' || raw === '"ge"';
  };
  const label = (g,e) => ge() ? g : e;
  const opened = new Map();
  let ordering = false, revealing = false;
  const rows = (root, selector) => [...root.querySelectorAll(selector)];
  const menuCategories = () => typeof categories !== 'undefined' ? [...categories].sort((a,b)=>a.order-b.order) : [];
  const visibleText = dish => (dish.nameGe || dish.nameEn || '') + ' ' + (dish.nameEn || '') + ' ' + (dish.descriptionGe || '') + ' ' + (dish.descriptionEn || '');
  function recalc() {
    const q = search.value.trim().toLocaleLowerCase();
    let shown = 0;
    for (const row of rows(list, '.dish-row')) {
      const dish = typeof dishes !== 'undefined' && dishes.find(d=>d.id===row.dataset.id);
      const match = !q || (dish && visibleText(dish).toLocaleLowerCase().includes(q));
      row.classList.toggle('admin-filtered-out', !match);
      if (match) shown++;
    }
    for (const group of rows(list, '.admin-dish-group')) {
      const n = rows(group,'.dish-row:not(.admin-filtered-out)').length;
      const counter = group.querySelector('.admin-group-count');
      if (counter) counter.textContent = String(n);
      group.classList.toggle('admin-group-empty', n === 0);
      // For a search, automatically expand groups with matches.
      if (q && n) group.open = true;
    }
    const total = rows(list,'.dish-row').length;
    count.textContent = label(`${shown} / ${total} კერძი`,`${shown} / ${total} dishes`);
  }
  function makeArrow(direction, categoryId, row) {
    const button = document.createElement('button');
    button.type='button'; button.textContent=direction==='up'?'↑':'↓';
    button.setAttribute('aria-label',direction==='up'?'Move dish up':'Move dish down');
    button.title=button.getAttribute('aria-label');
    button.addEventListener('click', async () => {
      if (ordering) return;
      const siblings = rows(list,'.dish-row').filter(r => r.dataset.categoryId===categoryId);
      const from=siblings.findIndex(r=>r.dataset.id===row.dataset.id);
      const target=from+(direction==='up'?-1:1);
      if (from<0 || target<0 || target>=siblings.length) return;
      if (typeof reorderDishes!=='function') return;
      ordering=true;
      try { await reorderDishes(row.dataset.id,siblings[target].dataset.id); }
      finally { ordering=false; }
    });
    return button;
  }
  function decorateCategories() {
    const items=rows(categoryList,'.category-row');
    items.forEach((row,index)=>{
      if(row.querySelector('.category-order-actions'))return;
      const box=document.createElement('div'); box.className='category-order-actions';
      ['up','down'].forEach(dir=>{
        const b=document.createElement('button');b.type='button';b.textContent=dir==='up'?'↑':'↓';
        b.disabled=dir==='up'?index===0:index===items.length-1;
        b.title=dir==='up'?'Move category up':'Move category down';
        b.addEventListener('click',async()=>{
          if(ordering||typeof reorderCategories!=='function')return;
          const live=rows(categoryList,'.category-row'); const i=live.findIndex(r=>r.dataset.id===row.dataset.id);
          const j=i+(dir==='up'?-1:1);if(j<0||j>=live.length)return;
          ordering=true;try{await reorderCategories(row.dataset.id,live[j].dataset.id);}finally{ordering=false;}
        }); box.append(b);
      });
      row.prepend(box);
    });
  }
  function groupDishes() {
    // Original admin.js replaces the direct rows after each save; regroup those rows.
    const direct=[...list.children].filter(el=>el.classList.contains('dish-row'));
    if(!direct.length) {recalc();return;}
    const fragment=document.createDocumentFragment();
    const byId=new Map();
    const cats=menuCategories();
    for(const cat of cats)byId.set(cat.id,[]);
    for(const row of direct){
      const dish=typeof dishes!=='undefined'&&dishes.find(d=>d.id===row.dataset.id);
      const id=dish?.categoryId || '__uncategorized';
      if(!byId.has(id))byId.set(id,[]);
      row.dataset.categoryId=id;
      byId.get(id).push(row);
    }
    for(const [id,groupRows] of byId){
      if(!groupRows.length)continue;
      const cat=cats.find(c=>c.id===id);
      const details=document.createElement('details');details.className='admin-dish-group';details.dataset.categoryId=id;
      details.open=opened.get(id)!==false;
      const summary=document.createElement('summary');summary.className='admin-dish-group-heading';
      const heading=document.createElement('strong');heading.textContent=cat?(ge()?(cat.nameGe||cat.nameEn):(cat.nameEn||cat.nameGe)):label('სხვა','Other');
      const badge=document.createElement('span');badge.className='admin-group-count';badge.textContent=String(groupRows.length);
      const chevron=document.createElement('span');chevron.className='admin-group-chevron';chevron.setAttribute('aria-hidden','true');
      summary.append(heading,badge,chevron);details.append(summary);
      const content=document.createElement('div');content.className='admin-dish-group-content';
      groupRows.forEach((row,i)=>{
        const controls=document.createElement('div');controls.className='dish-order-actions';
        const up=makeArrow('up',id,row),down=makeArrow('down',id,row);
        up.disabled=i===0;down.disabled=i===groupRows.length-1;
        controls.append(up,down);row.prepend(controls);content.append(row);
      });
      details.append(content);details.addEventListener('toggle',()=>{if(details.isConnected)opened.set(id,details.open);});
      fragment.append(details);
    }
    // Moving rows retains the handlers attached by original admin.js.
    list.replaceChildren(fragment);
    recalc();
  }
  showAll?.addEventListener('click',async()=>{
    if(revealing||typeof commitChange!=='function'||typeof dishes==='undefined')return;
    const hidden=dishes.filter(d=>d.visible===false);
    if(!hidden.length)return;
    const confirmed=confirm(label(`ყველა ${hidden.length} დამალული კერძი გამოჩნდეს მენიუში?`,`Make all ${hidden.length} hidden dishes visible on the customer menu?`));
    if(!confirmed)return;
    revealing=true;showAll.disabled=true;
    try{await commitChange(()=>{dishes.forEach(d=>{d.visible=true;});});}
    finally{revealing=false;showAll.disabled=false;}
  });
  function updateBulkLabel(){
    if(!showAll || typeof dishes==='undefined')return;
    const n=dishes.filter(d=>d.visible===false).length;
    const span=document.getElementById('adminShowAllDishesText');
    if(span)span.textContent=label(`ყველა კერძის გამოჩენა${n?' ('+n+')':''}`,`Show all on menu${n?' ('+n+')':''}`);
    showAll.disabled=n===0;
  }
  const originalRecalc=recalc;
  search.addEventListener('input',recalc);
  list.addEventListener('admin-visibility-updated',()=>{recalc();updateBulkLabel();});
  new MutationObserver(ms=>{
    if(ms.some(m=>m.target===list&&m.type==='childList')){
      if([...list.children].some(el=>el.classList.contains('dish-row')))groupDishes();
      updateBulkLabel();
    }
  }).observe(list,{childList:true});
  new MutationObserver(()=>decorateCategories()).observe(categoryList,{childList:true});
  document.getElementById('languageGe')?.addEventListener('click',()=>{recalc();updateBulkLabel();});
  document.getElementById('languageEn')?.addEventListener('click',()=>{recalc();updateBulkLabel();});
  decorateCategories();groupDishes();updateBulkLabel();
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

/* Optional "Popular" filter chip — saved online with categorySettings. */
(() => {
  const anchor=document.getElementById('dishList')?.closest('.admin-section');
  if(!anchor)return;
  const section=document.createElement('section');section.className='admin-popular-setting';
  section.innerHTML='<label class="admin-popular-label"><input type="checkbox" id="adminPopularCategoryToggle"><span id="adminPopularCategoryText">Show Popular category in customer menu</span></label><p id="adminPopularCategoryNote">Only appears when at least one visible dish is labeled Popular.</p>';
  anchor.querySelector('.section-content')?.prepend(section);
  const input=section.querySelector('input');const title=section.querySelector('#adminPopularCategoryText');const note=section.querySelector('#adminPopularCategoryNote');
  let busy=false;
  const update=()=>{
    if(typeof categories==='undefined'||typeof categorySettings==='undefined')return;
    const raw=localStorage.getItem('restaurantLanguage');const ge=raw==='ge'||raw==='"ge"';
    title.textContent=ge?'პოპულარული კატეგორიის ჩვენება მენიუში':'Show Popular category in menu';
    note.textContent=ge?'ჩნდება მხოლოდ მაშინ, თუ მენიუში პოპულარული მონიშნული კერძი არსებობს.':'Appears only when at least one visible dish has the Popular label.';
    input.checked=categories.some(c=>categorySettings[c.id]?.showPopularCategory===true);
    input.disabled=busy||!categories.length;
  };
  input.addEventListener('change',async()=>{
    if(busy||typeof commitChange!=='function')return;
    busy=true;const enabled=input.checked;input.disabled=true;
    try{await commitChange(()=>{categories.forEach(c=>{categorySettings[c.id]={...categorySettings[c.id],showPopularCategory:enabled};});});}
    finally{busy=false;update();}
  });
  new MutationObserver(()=>update()).observe(document.getElementById('categoryList'),{childList:true});
  document.getElementById('languageGe')?.addEventListener('click',update);
  document.getElementById('languageEn')?.addEventListener('click',update);
  update();
})();
