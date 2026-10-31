/* Hero cover editor. Does not replace admin.js, Worker, or any existing handlers. */
(() => {
  const byId = id => document.getElementById(id);
  const input = byId('heroPhotoInput');
  const status = byId('heroSaveStatus');
  const previews = [byId('heroPreviewDesktop'), byId('heroPreviewMobile')];
  const xInput = byId('heroFocusX'), yInput = byId('heroFocusY');
  const saveButton = byId('heroSaveButton'), resetButton = byId('heroResetButton');
  if (!input || !previews.every(Boolean)) return;
  let imageFile = null, previewObjectUrl = null, loadedSignature = '', hasUnsavedEdits = false, working = false;
  let imagePath = '';
  const validPath = p => typeof p === 'string' && /^images\/[\w./-]+\.(?:jpg|jpeg|png|webp)$/i.test(p);
  const limit = n => Math.max(0, Math.min(100, Number(n) || 0));
  function findStoredHero() {
    if (typeof categories === 'undefined' || !Array.isArray(categories)) return null;
    return categories.find(c => c && c.siteHero && typeof c.siteHero === 'object')?.siteHero || null;
  }
  function updatePreviews() {
    const url = previewObjectUrl || (validPath(imagePath) ? new URL('../' + imagePath, location.href).href : new URL('../images/khachapuri.jpg', location.href).href);
    for (const preview of previews) {
      preview.style.setProperty('--hero-preview-image', `url("${url}")`);
      preview.style.setProperty('--hero-preview-x', xInput.value + '%');
      preview.style.setProperty('--hero-preview-y', yInput.value + '%');
    }
    byId('heroFocusXValue').textContent = xInput.value + '%';
    byId('heroFocusYValue').textContent = yInput.value + '%';
  }
  function refreshFromMenu(force = false) {
    if (typeof menuReady === 'undefined' || !menuReady || (hasUnsavedEdits && !force)) return;
    const found = findStoredHero() || {};
    const signature = JSON.stringify(found);
    if (!force && loadedSignature === signature) return;
    loadedSignature = signature;
    imagePath = validPath(found.image) ? found.image : '';
    xInput.value = String(Number.isFinite(Number(found.x)) ? limit(found.x) : 50);
    yInput.value = String(Number.isFinite(Number(found.y)) ? limit(found.y) : 50);
    if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
    previewObjectUrl = null; imageFile = null; input.value = ''; hasUnsavedEdits = false;
    updatePreviews();
  }
  // Re-rendering existing Admin categories is a safe point to sync updated server state.
  if (typeof renderCategories === 'function') {
    const originalRender = renderCategories;
    renderCategories = function(...args) {
      const value = originalRender.apply(this, args);
      refreshFromMenu();
      return value;
    };
  }
  // The base Admin may have already loaded before this script runs.
  refreshFromMenu();
  for (const slider of [xInput, yInput]) slider.addEventListener('input', () => { hasUnsavedEdits = true; updatePreviews(); });
  for (const preview of previews) {
    let dragging = false;
    function move(event) {
      const bounds = preview.getBoundingClientRect();
      xInput.value = String(Math.round(limit((event.clientX - bounds.left) / bounds.width * 100)));
      yInput.value = String(Math.round(limit((event.clientY - bounds.top) / bounds.height * 100)));
      hasUnsavedEdits = true; updatePreviews();
    }
    preview.addEventListener('pointerdown', event => { dragging = true; preview.setPointerCapture(event.pointerId); move(event); });
    preview.addEventListener('pointermove', event => { if (dragging) move(event); });
    preview.addEventListener('pointerup', () => { dragging = false; });
    preview.addEventListener('pointercancel', () => { dragging = false; });
    preview.addEventListener('keydown', event => {
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) return;
      event.preventDefault(); const axis = ['ArrowLeft','ArrowRight'].includes(event.key) ? xInput : yInput;
      axis.value = String(limit(Number(axis.value) + (['ArrowRight','ArrowDown'].includes(event.key) ? 5 : -5)));
      hasUnsavedEdits = true; updatePreviews();
    });
  }
  // Keep aspect ratio, resize to maximum 1920px, compress under the Worker JPEG size limit.
  async function optimizeHero(file) {
    if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) throw new Error('Choose an image under 20 MB.');
    const raw = URL.createObjectURL(file);
    try {
      const bitmap = new Image(); bitmap.src = raw; await bitmap.decode();
      const longSide = Math.max(bitmap.naturalWidth, bitmap.naturalHeight);
      if (!longSide) throw new Error('Cannot read image.');
      for (const maxSide of [1920,1600,1400,1200,1000,800]) {
        const scale = Math.min(1,maxSide/longSide), canvas = document.createElement('canvas');
        canvas.width = Math.max(1,Math.round(bitmap.naturalWidth*scale));
        canvas.height = Math.max(1,Math.round(bitmap.naturalHeight*scale));
        const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable.');
        ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
        for (const quality of [.84,.74,.64,.54]) {
          const blob = await new Promise((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Image compression failed')),'image/jpeg',quality));
          if (blob.size <= 930000) return new File([blob],`cover-${Date.now()}.jpg`,{type:'image/jpeg'});
        }
      }
      throw new Error('This image is too complex to compress. Choose a different photo.');
    } finally { URL.revokeObjectURL(raw); }
  }
  input.addEventListener('change', async () => {
    const selected = input.files?.[0]; if (!selected) return;
    saveButton.disabled = true; status.textContent = 'Optimizing image…';
    try {
      const compressed = await optimizeHero(selected);
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      imageFile = compressed; previewObjectUrl = URL.createObjectURL(compressed);
      hasUnsavedEdits = true; updatePreviews();
      status.textContent = `Ready: ${(compressed.size/1024).toFixed(0)} KB. Adjust crop position, then Save.`;
    } catch (error) { input.value = ''; status.textContent = error.message; }
    finally { saveButton.disabled = false; }
  });
  async function persist(image, x, y) {
    if (typeof menuReady === 'undefined' || !menuReady || !categories.length) throw new Error('Log in and create at least one category first.');
    // Each category carries the same cover settings. Adding/reordering categories
    // does not lose them; deleting one category leaves the settings on the others.
    const result = await commitChange(() => {
      for (const cat of categories) cat.siteHero = { image, x, y };
    });
    if (!result) throw new Error('Menu save failed. Check the Admin error message and retry.');
    hasUnsavedEdits = false; loadedSignature = JSON.stringify({image,x,y});
  }
  saveButton.addEventListener('click', async () => {
    if (working) return; working = true; saveButton.disabled = true;
    status.textContent = 'Saving cover…';
    try {
      // Upload uses same authenticated Worker endpoint as dish images.
      if (imageFile) imagePath = await uploadImage(imageFile);
      await persist(imagePath, Number(xInput.value), Number(yInput.value));
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null; imageFile = null; input.value = '';
      updatePreviews(); status.textContent = 'Saved! Your new hero will appear after GitHub Pages publishes the menu update.';
    } catch(error) { status.textContent = 'Could not save: ' + error.message; }
    finally { saveButton.disabled = false; working = false; }
  });
  resetButton.addEventListener('click', async () => {
    if (working || !confirm('Restore the default hero image?')) return;
    working = true; saveButton.disabled = true; resetButton.disabled = true;
    try {
      await persist('',50,50); imagePath = '';
      if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
      previewObjectUrl = null; imageFile = null; input.value = ''; xInput.value = '50'; yInput.value = '50';
      updatePreviews(); status.textContent = 'Default cover restored.';
    } catch(error) { status.textContent = 'Could not restore: '+error.message; }
    finally { working = false; saveButton.disabled = false; resetButton.disabled = false; }
  });
})();
