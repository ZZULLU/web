/* Footer editor — saved through the existing authenticated Cloudflare menu API.
   siteFooter is copied onto existing categories, never added as an invalid
   categorySettings key. Customer view reads one shared configuration. */
(() => {
  const $ = id => document.getElementById(id);
  const form = $('footerEditorForm');
  if (!form) return;
  const status = $('footerEditorStatus');
  const save = $('footerSaveButton');
  const rows = $('footerDaysRows');
  const WEEK = {
    ge: ['ორშაბათი','სამშაბათი','ოთხშაბათი','პარასკევი','შაბათი','კვირა'],
    en: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  };
  const labels = {
    en: {title:'Footer Information',intro:'Edit the restaurant name, contact details, social links and opening hours. The name also updates the customer menu header.',nameGe:'Restaurant name — Georgian',nameEn:'Restaurant name — English',phone:'Phone number',locationGe:'Location — Georgian',locationEn:'Location — English',map:'Google Maps URL (optional)',facebook:'Facebook link (optional)',instagram:'Instagram link (optional)',days:'Opening days and hours',hint:'Uncheck a day to mark it as closed.',from:'Opens',to:'Closes',save:'Save footer information',saving:'Saving...',saved:'Saved! The public menu will update when GitHub Pages publishes.',needCategory:'Add at least one category before saving footer settings.',invalid:'Please enter a valid http(s) link for:',invalidHours:'Closing time must be after opening time for:',closed:'Closed',failed:'Could not save. Check the status above and try again.'},
    ge: {title:'ფუტერის ინფორმაცია',intro:'შეცვალეთ რესტორნის სახელი, კონტაქტები, სოციალური ბმულები და სამუშაო საათები. სახელი მენიუს სათაურშიც შეიცვლება.',nameGe:'რესტორნის სახელი — ქართულად',nameEn:'რესტორნის სახელი — ინგლისურად',phone:'ტელეფონის ნომერი',locationGe:'მისამართი — ქართულად',locationEn:'მისამართი — ინგლისურად',map:'Google Maps ბმული (არასავალდებულო)',facebook:'Facebook ბმული (არასავალდებულო)',instagram:'Instagram ბმული (არასავალდებულო)',days:'სამუშაო დღეები და საათები',hint:'მოხსენით მონიშვნა, თუ ამ დღეს დახურულია.',from:'გახსნა',to:'დახურვა',save:'ფუტერის შენახვა',saving:'ინახება...',saved:'შენახულია! ცვლილება გამოჩნდება GitHub Pages-ის განახლების შემდეგ.',needCategory:'ჯერ დაამატეთ მინიმუმ ერთი კატეგორია.',invalid:'შეიყვანეთ სწორი http(s) ბმული:',invalidHours:'დახურვის დრო გახსნაზე გვიანი უნდა იყოს:',closed:'დაკეტილია',failed:'შენახვა ვერ მოხერხდა. შეამოწმეთ შეტყობინება ზემოთ.'}
  };
  const fieldNames = {
    nameGe:'footerNameGe', nameEn:'footerNameEn', phone:'footerEditPhone',
    locationGe:'footerLocationGe', locationEn:'footerLocationEn',mapUrl:'footerMapUrl',
    facebook:'footerFacebookUrl', instagram:'footerInstagramUrl'
  };
  const defaultConfig = () => ({
    nameGe:'Georgian House',nameEn:'Georgian House',phone:'+995 555 123 456',
    locationGe:'Tbilisi, Georgia',locationEn:'Tbilisi, Georgia',
    mapUrl:'',facebook:'',instagram:'',
    days:Array.from({length:7},()=>({open:true,from:'10:00',to:'23:00'}))
  });
  let lastSignature = null;
  let dirty = false;
  let busy = false;
  function isGe(){ return document.documentElement.lang === 'ka'; }
  function lang(){ return isGe()?'ge':'en'; }
  function t(){ return labels[lang()]; }
  function config(){
    if (typeof categories === 'undefined' || !Array.isArray(categories)) return null;
    return categories.find(c => c?.siteFooter && typeof c.siteFooter==='object')?.siteFooter || null;
  }
  function buildDays(){
    rows.replaceChildren();
    for(let i=0;i<7;i++){
      const row=document.createElement('div');row.className='footer-day-row';row.dataset.day=String(i);
      const label=document.createElement('label');label.className='footer-day-name';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.dataset.role='open';
      const day=document.createElement('span');day.dataset.role='weekday';day.textContent=WEEK[lang()][i];
      label.append(checkbox,day);
      const fromLabel=document.createElement('label');fromLabel.className='footer-day-time';
      const fromTitle=document.createElement('span');fromTitle.dataset.role='from-label';fromTitle.textContent=t().from;
      const from=document.createElement('input');from.type='time';from.value='10:00';from.dataset.role='from';from.required=true;
      fromLabel.append(fromTitle,from);
      const toLabel=document.createElement('label');toLabel.className='footer-day-time';
      const toTitle=document.createElement('span');toTitle.dataset.role='to-label';toTitle.textContent=t().to;
      const to=document.createElement('input');to.type='time';to.value='23:00';to.dataset.role='to';to.required=true;
      toLabel.append(toTitle,to);
      checkbox.addEventListener('change',()=>{
        from.disabled=to.disabled=!checkbox.checked;
        row.classList.toggle('is-closed',!checkbox.checked);
      });
      row.append(label,fromLabel,toLabel);
      rows.append(row);
    }
  }
  buildDays();
  function populate(data){
    const d={...defaultConfig(),...data};
    for(const [key,id] of Object.entries(fieldNames)) $(id).value=typeof d[key]==='string'?d[key]:'';
    const days=Array.isArray(data?.days)?data.days:defaultConfig().days;
    [...rows.children].forEach((row,i)=>{
      const day=days[i]||{};
      const open=row.querySelector('[data-role="open"]');
      const from=row.querySelector('[data-role="from"]');
      const to=row.querySelector('[data-role="to"]');
      open.checked=day.open!==false;
      from.value=/^\d{2}:\d{2}$/.test(day.from||'')?day.from:'10:00';
      to.value=/^\d{2}:\d{2}$/.test(day.to||'')?day.to:'23:00';
      from.disabled=to.disabled=!open.checked;
      row.classList.toggle('is-closed',!open.checked);
    });
  }
  function sync(force=false){
    if (typeof menuReady==='undefined' || !menuReady || (dirty&&!force)) return;
    const data=config();const sig=JSON.stringify(data||{});
    if(!force&&sig===lastSignature)return;
    lastSignature=sig;populate(data);status.textContent='';
  }
  // Existing admin.js refreshes the category list after login and each save.
  // Hooking that refresh avoids stale data without changing admin.js.
  if(typeof renderCategories==='function'){
    const original=renderCategories;
    renderCategories=function(...args){ const value=original.apply(this,args);sync();return value;};
  }
  function translate(){
    const dict=t();
    $('footerEditorTitle').textContent=dict.title;
    $('footerEditorIntro').textContent=dict.intro;
    for(const el of form.querySelectorAll('[data-footer-label]')){
      const key=el.dataset.footerLabel;
      if(key==='map')el.textContent=dict.map;
      else if(dict[key])el.textContent=dict[key];
    }
    $('footerDaysLegend').textContent=dict.days;
    $('footerDaysHint').textContent=dict.hint;
    [...rows.children].forEach((row,i)=>{
      row.querySelector('[data-role="weekday"]').textContent=WEEK[lang()][i];
      row.querySelector('[data-role="from-label"]').textContent=dict.from;
      row.querySelector('[data-role="to-label"]').textContent=dict.to;
    });
    if(!busy)save.textContent=dict.save;
  }
  form.addEventListener('input',()=>{dirty=true;});
  form.addEventListener('change',()=>{dirty=true;});
  function validLink(value,label){
    if(!value) return '';
    try{
      const url=new URL(value);
      if(!['http:','https:'].includes(url.protocol))throw Error('protocol');
      return url.href;
    } catch{throw new Error(t().invalid+' '+label);}
  }
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(busy)return;
    if(typeof menuReady==='undefined'||!menuReady||typeof categories==='undefined'||!categories.length){status.textContent=t().needCategory;return;}
    let draft;
    try{
      draft={};
      for(const [key,id] of Object.entries(fieldNames))draft[key]=$(id).value.trim();
      draft.mapUrl=validLink(draft.mapUrl,'Google Maps');
      draft.facebook=validLink(draft.facebook,'Facebook');
      draft.instagram=validLink(draft.instagram,'Instagram');
      draft.days=[...rows.children].map((row,i)=>{
        const open=row.querySelector('[data-role="open"]').checked;
        const from=row.querySelector('[data-role="from"]').value;
        const to=row.querySelector('[data-role="to"]').value;
        if(open&&(!from||!to))throw Error(t().invalidHours+' '+WEEK[lang()][i]);
        return {open,from:from||'10:00',to:to||'23:00'};
      });
      if(!draft.nameGe&&!draft.nameEn)throw Error(t().nameGe+' / '+t().nameEn);
    }catch(error){status.textContent=error.message;return;}
    if(typeof commitChange!=='function')return;
    busy=true;save.disabled=true;save.textContent=t().saving;status.textContent='';
    try{
      const ok=await commitChange(()=>{
        for(const category of categories)category.siteFooter=structuredClone(draft);
      });
      if(ok){dirty=false;lastSignature=JSON.stringify(draft);status.textContent=t().saved;}
      else status.textContent=t().failed;
    }catch(error){status.textContent=error?.message||t().failed;}
    finally{busy=false;save.disabled=false;save.textContent=t().save;}
  });
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  translate();sync();
})();
