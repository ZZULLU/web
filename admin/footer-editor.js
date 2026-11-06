/* Restaurant footer and hero text editor, connected to the existing admin save flow. */
(() => {
  const $ = id => document.getElementById(id);
  const form=$('footerEditorForm');if(!form)return;
  const status=$('footerEditorStatus'), save=$('footerSaveButton'), daysContainer=$('footerDaysRows');
  const phonesContainer=$('footerPhonesRows'), locationsContainer=$('footerLocationsRows');
  const WEEK={
    ge:['ორშაბათი','სამშაბათი','ოთხშაბათი','ხუთშაბათი','პარასკევი','შაბათი','კვირა'],
    en:['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
  };
  const I={
    en:{title:'Footer Information',intro:'Update the restaurant name, hero subtitle, phone numbers, locations, social links and opening hours.',nameGe:'Restaurant name — Georgian',nameEn:'Restaurant name — English',subtitleGe:'Hero subtitle — Georgian',subtitleEn:'Hero subtitle — English',facebook:'Facebook URL (optional)',instagram:'Instagram URL (optional)',phones:'Phone numbers',locations:'Locations',addPhone:'+ Add phone number',addLocation:'+ Add location',phone:'Phone number',locationGe:'Address — Georgian',locationEn:'Address — English',map:'Google Maps link (optional)',remove:'Remove',days:'Opening days and hours',hint:'Uncheck a day to mark it closed.',from:'Opens',to:'Closes',save:'Save footer information',saving:'Saving...',saved:'Saved! Public changes appear after GitHub Pages publishes.',needCategory:'Add at least one category first.',invalid:'Enter a valid http(s) link for:',invalidHours:'Check opening and closing times for:',failed:'Could not save. Try again.'},
    ge:{title:'ფუტერის ინფორმაცია',intro:'შეცვალეთ რესტორნის სახელი, მთავარი ფოტოს ქვედა ტექსტი, ტელეფონები, მისამართები, სოციალური ბმულები და სამუშაო საათები.',nameGe:'რესტორნის სახელი — ქართულად',nameEn:'რესტორნის სახელი — ინგლისურად',subtitleGe:'მთავარი ქვესათაური — ქართულად',subtitleEn:'მთავარი ქვესათაური — ინგლისურად',facebook:'Facebook ბმული (არასავალდებულო)',instagram:'Instagram ბმული (არასავალდებულო)',phones:'ტელეფონის ნომრები',locations:'მისამართები',addPhone:'+ ნომრის დამატება',addLocation:'+ მისამართის დამატება',phone:'ტელეფონის ნომერი',locationGe:'მისამართი — ქართულად',locationEn:'მისამართი — ინგლისურად',map:'Google Maps ბმული (არასავალდებულო)',remove:'წაშლა',days:'სამუშაო დღეები და საათები',hint:'მოხსენით მონიშვნა, თუ ამ დღეს დახურულია.',from:'გახსნა',to:'დახურვა',save:'ფუტერის შენახვა',saving:'ინახება...',saved:'შენახულია! მენიუ შეიცვლება GitHub Pages-ის განახლების შემდეგ.',needCategory:'ჯერ დაამატეთ მინიმუმ ერთი კატეგორია.',invalid:'შეიყვანეთ სწორი http(s) ბმული:',invalidHours:'შეამოწმეთ სამუშაო საათები:',failed:'შენახვა ვერ მოხერხდა.'}
  };
  const fields={nameGe:'footerNameGe',nameEn:'footerNameEn',subtitleGe:'footerSubtitleGe',subtitleEn:'footerSubtitleEn',facebook:'footerFacebookUrl',instagram:'footerInstagramUrl'};
  let dirty=false,busy=false,lastSignature=null;
  const lang=()=>document.documentElement.lang==='ka'?'ge':'en';
  const t=()=>I[lang()];
  function stored(){return typeof categories!=='undefined'&&Array.isArray(categories)?categories.find(c=>c?.siteFooter&&typeof c.siteFooter==='object')?.siteFooter||null:null;}
  function defaults(){return {nameGe:'Georgian House',nameEn:'Georgian House',subtitleGe:'ტრადიციული ქართული სამზარეულო',subtitleEn:'Traditional Georgian Cuisine',phones:['+995 555 123 456'],locations:[{ge:'თბილისი, საქართველო',en:'Tbilisi, Georgia',mapUrl:''}],facebook:'',instagram:'',days:Array.from({length:7},()=>({open:true,from:'10:00',to:'23:00'}))};}
  function markDirty(){dirty=true;}
  function rowInput(placeholder,value,type='text'){
    const el=document.createElement('input');el.type=type;el.placeholder=placeholder;el.value=value||'';el.addEventListener('input',markDirty);return el;
  }
  function makeButton(){const b=document.createElement('button');b.type='button';b.className='footer-remove-row';b.textContent=t().remove;b.addEventListener('click',()=>{b.closest('.footer-repeat-row').remove();markDirty();});return b;}
  function addPhone(value=''){
    const row=document.createElement('div');row.className='footer-repeat-row footer-phone-row';
    const input=rowInput(t().phone,value,'tel');input.dataset.field='phone';input.maxLength=45;
    row.append(input,makeButton());phonesContainer.append(row);
  }
  function addLocation(loc={}){
    const row=document.createElement('div');row.className='footer-repeat-row footer-location-row';
    for(const [key,placeholder] of [['ge',t().locationGe],['en',t().locationEn],['mapUrl',t().map]]){
      const inp=rowInput(placeholder,loc[key]||'',key==='mapUrl'?'url':'text');inp.dataset.field=key;inp.maxLength=key==='mapUrl'?1000:240;
      const label=document.createElement('label');const cap=document.createElement('span');cap.dataset.locationLabel=key;cap.textContent=placeholder;label.append(cap,inp);row.append(label);
    }
    row.append(makeButton());locationsContainer.append(row);
  }
  function buildDays(){
    daysContainer.replaceChildren();
    for(let i=0;i<7;i++){
      const row=document.createElement('div');row.className='footer-day-row';row.dataset.day=String(i);
      const label=document.createElement('label');label.className='footer-day-name';
      const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=true;checkbox.dataset.role='open';
      const text=document.createElement('span');text.dataset.role='weekday';text.textContent=WEEK[lang()][i];label.append(checkbox,text);
      const controls=[];
      for(const role of ['from','to']){
        const wrapper=document.createElement('label');wrapper.className='footer-day-time';
        const title=document.createElement('span');title.dataset.role=role+'-label';title.textContent=t()[role];
        const inp=document.createElement('input');inp.type='time';inp.value=role==='from'?'10:00':'23:00';inp.dataset.role=role;
        wrapper.append(title,inp);controls.push(wrapper);
      }
      checkbox.addEventListener('change',()=>{row.querySelectorAll('input[type="time"]').forEach(el=>el.disabled=!checkbox.checked);row.classList.toggle('is-closed',!checkbox.checked);markDirty();});
      row.append(label,...controls);daysContainer.append(row);
    }
  }
  function populate(data){
    const d={...defaults(),...(data||{})};
    for(const [key,id] of Object.entries(fields))$(id).value=typeof d[key]==='string'?d[key]:'';
    const phones=Array.isArray(data?.phones)?data.phones:(typeof data?.phone==='string'?[data.phone]:d.phones);
    const locations=Array.isArray(data?.locations)?data.locations:((data?.locationGe||data?.locationEn)?[{ge:data.locationGe||'',en:data.locationEn||'',mapUrl:data.mapUrl||''}]:d.locations);
    phonesContainer.replaceChildren();locationsContainer.replaceChildren();
    phones.forEach(phone=>addPhone(phone));locations.forEach(loc=>addLocation(loc));
    const days=Array.isArray(data?.days)?data.days:d.days;
    [...daysContainer.children].forEach((row,i)=>{
      const day=days[i]||{};const open=row.querySelector('[data-role="open"]');const from=row.querySelector('[data-role="from"]');const to=row.querySelector('[data-role="to"]');
      open.checked=day.open!==false;from.value=/^\d{2}:\d{2}$/.test(day.from||'')?day.from:'10:00';to.value=/^\d{2}:\d{2}$/.test(day.to||'')?day.to:'23:00';
      from.disabled=to.disabled=!open.checked;row.classList.toggle('is-closed',!open.checked);
    });
  }
  function sync(force=false){if(typeof menuReady==='undefined'||!menuReady||(dirty&&!force))return;const data=stored();const sig=JSON.stringify(data||{});if(!force&&sig===lastSignature)return;lastSignature=sig;populate(data);status.textContent='';}
  if(typeof renderCategories==='function'){
    const original=renderCategories;renderCategories=function(...args){const result=original.apply(this,args);sync();return result;};
  }
  function translate(){const d=t();$('footerEditorTitle').textContent=d.title;$('footerEditorIntro').textContent=d.intro;
    form.querySelectorAll('[data-footer-label]').forEach(el=>{if(d[el.dataset.footerLabel])el.textContent=d[el.dataset.footerLabel];});
    $('footerPhonesLegend').textContent=d.phones;$('footerLocationsLegend').textContent=d.locations;
    $('footerAddPhone').textContent=d.addPhone;$('footerAddLocation').textContent=d.addLocation;
    phonesContainer.querySelectorAll('.footer-phone-row input').forEach(el=>el.placeholder=d.phone);
    locationsContainer.querySelectorAll('[data-location-label]').forEach(el=>el.textContent=d[el.dataset.locationLabel==='ge'?'locationGe':el.dataset.locationLabel==='en'?'locationEn':'map']);
    form.querySelectorAll('.footer-remove-row').forEach(b=>b.textContent=d.remove);
    $('footerDaysLegend').textContent=d.days;$('footerDaysHint').textContent=d.hint;
    [...daysContainer.children].forEach((row,i)=>{row.querySelector('[data-role="weekday"]').textContent=WEEK[lang()][i];row.querySelector('[data-role="from-label"]').textContent=d.from;row.querySelector('[data-role="to-label"]').textContent=d.to;});
    if(!busy)save.textContent=d.save;
  }
  function validLink(value,label){if(!value)return '';try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol))throw Error();return u.href;}catch{throw Error(t().invalid+' '+label);}}
  buildDays();
  $('footerAddPhone').addEventListener('click',()=>{addPhone();markDirty();});
  $('footerAddLocation').addEventListener('click',()=>{addLocation();markDirty();});
  form.addEventListener('input',markDirty);form.addEventListener('change',markDirty);
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy)return;
    if(typeof menuReady==='undefined'||!menuReady||typeof categories==='undefined'||!categories.length){status.textContent=t().needCategory;return;}
    let draft;
    try{
      draft={};for(const [key,id] of Object.entries(fields))draft[key]=$(id).value.trim();
      draft.facebook=validLink(draft.facebook,'Facebook');draft.instagram=validLink(draft.instagram,'Instagram');
      draft.phones=[...phonesContainer.querySelectorAll('[data-field="phone"]')].map(el=>el.value.trim()).filter(Boolean);
      draft.locations=[...locationsContainer.children].map(row=>{
        const o={};row.querySelectorAll('[data-field]').forEach(el=>o[el.dataset.field]=el.value.trim());
        o.mapUrl=validLink(o.mapUrl,'Google Maps');return o;
      }).filter(loc=>loc.ge||loc.en);
      // Legacy fields retained for compatibility with older public script versions.
      draft.phone=draft.phones[0]||'';
      draft.locationGe=draft.locations[0]?.ge||'';draft.locationEn=draft.locations[0]?.en||'';draft.mapUrl=draft.locations[0]?.mapUrl||'';
      draft.days=[...daysContainer.children].map((row,i)=>{
        const open=row.querySelector('[data-role="open"]').checked;const from=row.querySelector('[data-role="from"]').value;const to=row.querySelector('[data-role="to"]').value;
        if(open&&(!from||!to))throw Error(t().invalidHours+' '+WEEK[lang()][i]);return {open,from:from||'10:00',to:to||'23:00'};
      });
      if(!draft.nameGe&&!draft.nameEn)throw Error(t().nameGe+' / '+t().nameEn);
    }catch(error){status.textContent=error.message;return;}
    if(typeof commitChange!=='function'){status.textContent=t().failed;return;}
    busy=true;save.disabled=true;save.textContent=t().saving;status.textContent='';
    try{
      const ok=await commitChange(()=>{for(const category of categories)category.siteFooter=structuredClone(draft);});
      if(ok){dirty=false;lastSignature=JSON.stringify(draft);status.textContent=t().saved;}
      else status.textContent=t().failed;
    }catch(error){status.textContent=error?.message||t().failed;}
    finally{busy=false;save.disabled=false;save.textContent=t().save;}
  });
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  translate();sync();
})();
