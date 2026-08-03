'use strict';
(() => {
  const query=new URLSearchParams(location.search),lang=query.get('lang')||localStorage.getItem('cryptoLabLanguage')||'ru';
  document.documentElement.lang=lang==='uk'?'uk':lang;
  const generic={ru:{chart:'Интерактивный график CRYPTO LAB',table:'Таблица данных',button:'Действие'},uk:{chart:'Інтерактивний графік CRYPTO LAB',table:'Таблиця даних',button:'Дія'},en:{chart:'CRYPTO LAB interactive chart',table:'Data table',button:'Action'}}[lang]||{chart:'Интерактивный график CRYPTO LAB',table:'Таблица данных',button:'Действие'};
  function clean(value){return String(value||'').replace(/\s+/g,' ').trim();}
  function humanize(value){return clean(String(value||'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[-_]+/g,' '));}
  function accessibleName(element){
    if(element.getAttribute('aria-label')||element.getAttribute('aria-labelledby')||element.getAttribute('title'))return true;
    if(element.id&&document.querySelector(`label[for="${CSS.escape(element.id)}"]`))return true;
    if(element.closest('label'))return true;
    return Boolean(clean(element.textContent));
  }
  function fieldLabel(element){
    const field=element.closest('.field,.form-field,.input-group,.control');
    const label=field?.querySelector('label');
    return clean(label?.textContent)||clean(element.getAttribute('placeholder'))||humanize(element.id||element.name);
  }
  function enhance(){
    let main=document.querySelector('main');
    if(!main){main=document.querySelector('.wrap,.main,.container');if(main)main.setAttribute('role','main');}
    document.querySelectorAll('input,select,textarea').forEach(element=>{if(!accessibleName(element)){const label=fieldLabel(element);if(label)element.setAttribute('aria-label',label);}});
    document.querySelectorAll('button').forEach(button=>{if(!accessibleName(button)){const label=humanize(button.id||button.name)||generic.button;button.setAttribute('aria-label',label);button.setAttribute('title',label);}});
    document.querySelectorAll('canvas').forEach(canvas=>{if(!canvas.getAttribute('aria-label')){const heading=canvas.closest('.card,.panel,section')?.querySelector('h1,h2,h3');canvas.setAttribute('role','img');canvas.setAttribute('aria-label',clean(heading?.textContent)||generic.chart);}});
    document.querySelectorAll('table').forEach(table=>{if(!table.getAttribute('aria-label')&&!table.querySelector('caption')){const heading=table.closest('.card,.panel,section')?.querySelector('h1,h2,h3');table.setAttribute('aria-label',clean(heading?.textContent)||generic.table);}});
    document.querySelectorAll('.msg,.status,.notice,#message,#msg,#status').forEach(node=>{node.setAttribute('role','status');node.setAttribute('aria-live','polite');});
    document.querySelectorAll('[aria-current="page"]').forEach(node=>node.setAttribute('tabindex','0'));
  }
  if(!document.getElementById('moduleA11yStyle')){const style=document.createElement('style');style.id='moduleA11yStyle';style.textContent=':where(button,a,input,select,textarea,[tabindex]):focus-visible{outline:3px solid #4d9fff!important;outline-offset:2px!important}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}';document.head.appendChild(style);}
  enhance();new MutationObserver(enhance).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','disabled']});
})();