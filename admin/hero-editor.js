/* Hero crop workflow. Uses the existing Admin commitChange/uploadImage functions. */
(() => {
  const $ = id => document.getElementById(id);
  const input=$('heroPhotoInput'), save=$('heroSaveButton'), reset=$('heroResetButton');
  const modal=$('heroCropModal'), stage=$('heroCropStage'), img=$('heroCropSource'), frame=$('heroCropFrame');
  const status=$('heroSaveStatus'), next=$('heroCropNext'), back=$('heroCropBack');
  const previewDesktop=$('heroPreviewDesktop'), previewMobile=$('heroPreviewMobile');
  if (![input,save,reset,modal,stage,img,frame,next,back].every(Boolean)) return;
  const matchesPath = value => typeof value === 'string' && /^images\/[\w./-]+\.(?:jpe?g|png|webp)$/i.test(value);
  let current = {image:'', mobileImage:'', x:50,y:50}, loadingSignature='';
  let srcURL='', naturalW=0,naturalH=0, rects=[null,null], step=0, pending=[null,null], dirty=false, busy=false;
  let cropSourceWasLoadedFromSaved=false;
  const ratio=[16/7,4/5];
  const bound=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  function config(){return typeof categories !== 'undefined' && Array.isArray(categories) ? categories.find(c=>c?.siteHero)?.siteHero || {} : {};}
  function updatePreview(){
    const desktop= pending[0]?.url || (matchesPath(current.image)?new URL('../'+current.image,location.href).href:null);
    const mobile= pending[1]?.url || (matchesPath(current.mobileImage)?new URL('../'+current.mobileImage,location.href).href:null) || desktop;
    for(const [el,url] of [[previewDesktop,desktop],[previewMobile,mobile]]) {
      el.style.backgroundImage=url?`linear-gradient(120deg,#131b1b80,#131b1b33),url("${url}")`:'';
      el.style.backgroundSize='cover';el.style.backgroundPosition='center';
    }
  }
  function sync(force=false){
    if (typeof menuReady==='undefined'||!menuReady||(dirty&&!force)) return;
    const data=config(), sig=JSON.stringify(data);
    if(!force&&sig===loadingSignature)return;
    loadingSignature=sig;
    current={image:matchesPath(data.image)?data.image:'',mobileImage:matchesPath(data.mobileImage)?data.mobileImage:'',x:data.x??50,y:data.y??50};
    updatePreview();
  }
  if(typeof renderCategories==='function'){
    const previous=renderCategories;
    renderCategories=function(...args){const result=previous.apply(this,args);sync();return result;};
  }
  sync();
  function cropRectFor(w,h,r){
    const width=Math.min(w,h*r)*.82, height=width/r;
    return {x:(w-width)/2,y:(h-height)/2,w:width,h:height};
  }
  function stageSizes(){return {w:img.clientWidth,h:img.clientHeight};}
  function renderFrame(){
    const r=rects[step],z=stageSizes();if(!r||!z.w||!z.h)return;
    Object.assign(frame.style,{left:(r.x/z.w*100)+'%',top:(r.y/z.h*100)+'%',width:(r.w/z.w*100)+'%',height:(r.h/z.h*100)+'%'});
  }
  function goStep(n){
    const old=step;step=n;
    const {w,h}=stageSizes();if(!rects[step]&&w&&h)rects[step]=cropRectFor(w,h,ratio[step]);
    $('heroCropTitle').textContent=step===0?'1. Desktop crop — 16:7':'2. Mobile crop — 4:5';
    $('heroCropStep').textContent=`Step ${step+1} of 2`;
    next.textContent=step===0?'Continue to mobile →':'Use these crops ✓';
    back.hidden=step===0;
    renderFrame();
  }
  let drag=null;
  frame.addEventListener('pointerdown',e=>{
    if(!rects[step])return;
    e.preventDefault();
    const r=rects[step];drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,base:{...r},kind:e.target.closest('.hero-crop-handle')?'resize':'move'};
    frame.setPointerCapture(e.pointerId);
  });
  frame.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const z=stageSizes(),dx=e.clientX-drag.sx,dy=e.clientY-drag.sy,b=drag.base;
    if(drag.kind==='move'){
      rects[step]={...b,x:bound(b.x+dx,0,z.w-b.w),y:bound(b.y+dy,0,z.h-b.h)};
    }else{
      const minW=Math.min(60,z.w*.25),maxW=Math.min(z.w-b.x,(z.h-b.y)*ratio[step]);
      const width=bound(Math.max(b.w+dx,(b.h+dy)*ratio[step]),Math.min(minW,maxW),maxW);
      rects[step]={...b,w:width,h:width/ratio[step]};
    }
    renderFrame();
  });
  for(const eventName of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(eventName,()=>{drag=null;});
  frame.addEventListener('keydown',e=>{
    if(!rects[step]||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
    e.preventDefault();const z=stageSizes(),r=rects[step],d=e.shiftKey?10:2;
    if(e.key==='ArrowUp')r.y=bound(r.y-d,0,z.h-r.h);
    if(e.key==='ArrowDown')r.y=bound(r.y+d,0,z.h-r.h);
    if(e.key==='ArrowLeft')r.x=bound(r.x-d,0,z.w-r.w);
    if(e.key==='ArrowRight')r.x=bound(r.x+d,0,z.w-r.w);
    renderFrame();
  });
  function showModal(){step=0;modal.hidden=false;document.body.style.overflow='hidden';requestAnimationFrame(()=>{const z=stageSizes();if(!rects[0]||!rects[1])rects=[cropRectFor(z.w,z.h,ratio[0]),cropRectFor(z.w,z.h,ratio[1])];goStep(0);});}
  function hideModal(){modal.hidden=true;document.body.style.overflow='';}
  $('heroCropCancel').addEventListener('click',hideModal);
  modal.addEventListener('pointerdown',e=>{if(e.target===modal)hideModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.hidden)hideModal();});
  back.addEventListener('click',()=>goStep(0));
  async function decode(file){
    if(file.size>25*1024*1024)throw new Error('Maximum file size is 25 MB.');
    const url=URL.createObjectURL(file),test=new Image();test.src=url;
    try{await test.decode();return {url,w:test.naturalWidth,h:test.naturalHeight};}
    catch{URL.revokeObjectURL(url);throw new Error('Your browser cannot decode this image format. For HEIC/HEIF, convert to JPG or PNG first.');}
  }
  async function chooseFile(file){
    if(!file)return;
    status.textContent='Reading image…';
    try{
      const parsed=await decode(file);
      if(srcURL)URL.revokeObjectURL(srcURL);
      srcURL=parsed.url;naturalW=parsed.w;naturalH=parsed.h;cropSourceWasLoadedFromSaved=false;
      img.src=srcURL;await img.decode();rects=[null,null];
      showModal();status.textContent='Adjust desktop and mobile crop frames, then save.';
    }catch(error){status.textContent=error.message;input.value='';}
  }
  input.addEventListener('change',()=>chooseFile(input.files?.[0]));
  async function restoreCropSourceFromSaved() {
    // If the original file is no longer in memory (e.g. after a reload),
    // open the already-saved cover rather than asking for another upload.
    const url = pending[0]?.url || (matchesPath(current.image) ? new URL('../' + current.image, location.href).href : null)
             || pending[1]?.url || (matchesPath(current.mobileImage) ? new URL('../' + current.mobileImage, location.href).href : null);
    if (!url) throw new Error('Choose a cover image first.');
    const picture = new Image(); picture.src=url;
    await picture.decode();
    if (srcURL && srcURL.startsWith('blob:')) URL.revokeObjectURL(srcURL);
    srcURL=url; naturalW=picture.naturalWidth; naturalH=picture.naturalHeight;
    cropSourceWasLoadedFromSaved=true;
    img.src=url; await img.decode();
  }
  $('heroRecropButton').addEventListener('click',async()=>{
    if (busy) return;
    try {
      if (!srcURL) await restoreCropSourceFromSaved();
      if (img.src!==srcURL) { img.src=srcURL; await img.decode(); }
      showModal();
      status.textContent=cropSourceWasLoadedFromSaved
        ? 'Re-cropping the saved cover. Areas outside its original crop cannot be recovered; select a new source to access them.'
        : 'Adjust the same selected photograph; no need to upload it again.';
    } catch(error) { status.textContent=error.message; }
  });
  function dataURLForCrop(r){
    const z=stageSizes();
    return {sx:Math.round(r.x/z.w*naturalW),sy:Math.round(r.y/z.h*naturalH),sw:Math.round(r.w/z.w*naturalW),sh:Math.round(r.h/z.h*naturalH)};
  }
  async function createCroppedFile(r,kind){
    const crop=dataURLForCrop(r),maxWidth=kind===0?1600:900;
    for(const w of [maxWidth,1200,950,720,560].filter((w,i)=>kind===0||w<=900)){
      const width=Math.min(w,crop.sw),height=Math.round(width/ratio[kind]);
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
      ctx.drawImage(img,crop.sx,crop.sy,crop.sw,crop.sh,0,0,width,height);
      for(const quality of [.85,.72,.58,.43]){
        const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Could not convert image')),'image/jpeg',quality));
        if(blob.size<930000)return new File([blob],`hero-${kind?'mobile':'desktop'}-${Date.now()}.jpg`,{type:'image/jpeg'});
      }
    }
    throw Error('Image cannot be compressed below the upload limit.');
  }
  next.addEventListener('click',async()=>{
    if(step===0){goStep(1);return;}
    next.disabled=true;$('heroCropHint').textContent='Preparing both cropped images…';
    try{
      const desktop=await createCroppedFile(rects[0],0),mobile=await createCroppedFile(rects[1],1);
      for(const item of pending)if(item?.url)URL.revokeObjectURL(item.url);
      pending=[{file:desktop,url:URL.createObjectURL(desktop)},{file:mobile,url:URL.createObjectURL(mobile)}];
      dirty=true;updatePreview();hideModal();status.textContent='Both crops ready. Click Save cover to publish.';
    }catch(error){status.textContent=error.message;}
    finally{next.disabled=false;$('heroCropHint').textContent='Drag the crop frame to move it. Drag the corner to resize.';}
  });
  async function persist(data){
    if(typeof menuReady==='undefined'||!menuReady||typeof categories==='undefined'||!categories.length)throw Error('Log in and create at least one category first.');
    const ok=await commitChange(()=>{for(const category of categories)category.siteHero={...data};});
    if(!ok)throw Error('Could not save menu settings.');
    dirty=false;current={...data};loadingSignature=JSON.stringify(data);
  }
  save.addEventListener('click',async()=>{
    if(busy)return;busy=true;save.disabled=true;status.textContent='Uploading and saving cover images…';
    try{
      let desktop=current.image,mobile=current.mobileImage;
      if(pending[0])desktop=await uploadImage(pending[0].file);
      if(pending[1])mobile=await uploadImage(pending[1].file);
      await persist({image:desktop,mobileImage:mobile,x:50,y:50});
      for(const item of pending)if(item?.url)URL.revokeObjectURL(item.url);
      pending=[null,null];updatePreview();status.textContent='Saved. The new images will appear after deployment.';
    }catch(error){status.textContent='Save failed: '+error.message;}
    finally{busy=false;save.disabled=false;}
  });
  reset.addEventListener('click',async()=>{
    if(busy||!confirm('Restore the default hero image?'))return;
    busy=true;save.disabled=true;
    try{await persist({image:'',mobileImage:'',x:50,y:50});updatePreview();status.textContent='Default cover restored.';}
    catch(error){status.textContent='Reset failed: '+error.message;}
    finally{busy=false;save.disabled=false;}
  });
})();
