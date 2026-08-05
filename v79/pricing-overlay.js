'use strict';
(() => {
  const COPY={
    ru:{month:'/ мес.',inactive:'Оплата пока не активирована.'},
    uk:{month:'/ міс.',inactive:'Оплату ще не активовано.'},
    en:{month:'/ month',inactive:'Payment is not active yet.'}
  };
  let prices=[],scheduled=false,loading=false;

  const locale=()=>typeof lang==='string'&&lang==='uk'?'uk-UA':typeof lang==='string'&&lang==='en'?'en-US':'ru-RU';
  const copy=()=>COPY[typeof lang==='string'?lang:'ru']||COPY.ru;
  const money=(minor,currency)=>new Intl.NumberFormat(locale(),{
    style:'currency',
    currency:currency||'USD',
    minimumFractionDigits:0,
    maximumFractionDigits:2
  }).format(Number(minor||0)/100);
  const byPlan=plan=>prices.find(item=>item.plan===plan&&item.interval==='month'&&item.amount_minor!=null);

  function setText(element,value){
    if(element&&element.textContent!==value)element.textContent=value;
  }

  function apply(){
    scheduled=false;
    if(!prices.length)return;
    const c=copy();

    document.querySelectorAll('#plans .plan').forEach(card=>{
      const plan=card.querySelector('.plan-name')?.textContent?.trim();
      const price=byPlan(plan);
      if(!price)return;
      let row=card.querySelector('.owner-plan-price');
      if(!row){
        row=document.createElement('div');
        row.className='owner-plan-price';
        row.style.cssText='font-size:18px;font-weight:950;color:#ffe58f;margin:7px 0 3px';
        card.querySelector('.plan-name')?.after(row);
      }
      setText(row,`${money(price.amount_minor,price.currency)} ${c.month}`);
      let note=card.querySelector('.owner-plan-price-note');
      if(!note){
        note=document.createElement('small');
        note.className='owner-plan-price-note';
        note.style.display='block';
        card.appendChild(note);
      }
      setText(note,c.inactive);
    });

    document.querySelectorAll('#commercialPlans .commercial-plan').forEach(card=>{
      const plan=card.querySelector('b')?.textContent?.trim();
      const price=byPlan(plan);
      if(!price)return;
      const status=card.querySelector('.commercial-status');
      if(status){
        status.classList.remove('ready');
        status.classList.add('blocked');
        setText(status,`${money(price.amount_minor,price.currency)} ${c.month}`);
      }
      let note=card.querySelector('.owner-commercial-price-note');
      if(!note){
        note=document.createElement('div');
        note.className='owner-commercial-price-note muted';
        note.style.marginTop='4px';
        card.querySelector('.commercial-plan-head')?.after(note);
      }
      setText(note,c.inactive);
    });
  }

  function schedule(){
    if(scheduled)return;
    scheduled=true;
    queueMicrotask(apply);
  }

  async function load(){
    if(loading||typeof client==='undefined')return;
    loading=true;
    try{
      const {data,error}=await client.rpc('get_my_crypto_commercial_state');
      if(error)throw error;
      prices=Array.isArray(data?.prices)?data.prices.filter(item=>['BASIC','PRO'].includes(item.plan)&&item.currency==='USD'):[];
      schedule();
    }catch(error){
      console.warn('Pricing overlay unavailable',error);
    }finally{
      loading=false;
    }
  }

  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  document.getElementById('lang')?.addEventListener('change',schedule);
  if(typeof client!=='undefined'){
    client.auth.onAuthStateChange((_event,current)=>{
      if(current)load();
      else prices=[];
    });
  }
  if(typeof account!=='undefined'&&account&&typeof session!=='undefined'&&session)load();
  setTimeout(load,0);
})();
