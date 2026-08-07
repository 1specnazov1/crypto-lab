'use strict';
(() => {
  const labels={ru:{refund:'Возвраты'},uk:{refund:'Повернення'},en:{refund:'Refunds'}};
  function currentLang(){return typeof lang==='string'&&labels[lang]?lang:'ru';}
  function apply(){
    const link=[...document.querySelectorAll('#commercialLegal a')].find(a=>/refund\.html/i.test(a.getAttribute('href')||''));
    if(link)link.textContent=labels[currentLang()].refund;
  }
  const observer=new MutationObserver(apply);observer.observe(document.documentElement,{childList:true,subtree:true});
  document.getElementById('lang')?.addEventListener('change',()=>setTimeout(apply,0));
  apply();
})();
