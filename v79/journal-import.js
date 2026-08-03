'use strict';
(() => {
  const PROJECT_URL = 'https://txhzxbizjpinowepfjkm.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_Kto-qK3BBI21ZxwGzxAmKg_A01NLpdZ';
  const client = supabase.createClient(PROJECT_URL, PUBLISHABLE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  const MAX_ROWS = 5000;
  const CHUNK_SIZE = 200;
  const T = {
    ru: { import:'Импорт', template:'Шаблон', importing:'Импорт сделок…', done:(added,total,skipped)=>`Импорт завершён: добавлено ${added} из ${total}, пропущено дублей ${skipped}.`, empty:'В файле нет подходящих сделок.', bad:'Не удалось импортировать файл', login:'Для импорта войдите в аккаунт.', limit:`За один импорт разрешено не более ${MAX_ROWS} строк.`, draft:'Сигнал сканера перенесён в форму. Проверьте количество и цену входа перед сохранением.' },
    uk: { import:'Імпорт', template:'Шаблон', importing:'Імпорт угод…', done:(added,total,skipped)=>`Імпорт завершено: додано ${added} з ${total}, пропущено дублів ${skipped}.`, empty:'У файлі немає придатних угод.', bad:'Не вдалося імпортувати файл', login:'Для імпорту увійдіть в акаунт.', limit:`За один імпорт дозволено не більше ${MAX_ROWS} рядків.`, draft:'Сигнал сканера перенесено у форму. Перевірте кількість і ціну входу перед збереженням.' },
    en: { import:'Import', template:'Template', importing:'Importing trades…', done:(added,total,skipped)=>`Import complete: added ${added} of ${total}, duplicates skipped ${skipped}.`, empty:'The file contains no valid trades.', bad:'Could not import file', login:'Sign in before importing.', limit:`A single import is limited to ${MAX_ROWS} rows.`, draft:'The scanner signal was copied into the form. Check quantity and entry price before saving.' }
  };

  function language(){ return localStorage.getItem('cryptoLabLanguage') || document.documentElement.lang || 'ru'; }
  function tr(){ return T[language()] || T.ru; }
  function notice(message, bad=false){
    const box=document.getElementById('notice');
    if(!box)return;
    box.textContent=message;
    box.className='notice'+(bad?' bad':'');
    clearTimeout(notice.timer);
    notice.timer=setTimeout(()=>box.classList.add('hide'),8000);
  }
  function canonical(value){ return String(value||'').trim().toLowerCase().replace(/[^a-zа-яіїє0-9]+/g,''); }
  function mapRow(row){
    const mapped={};
    Object.entries(row||{}).forEach(([key,value])=>{mapped[canonical(key)]=value});
    return mapped;
  }
  function pick(row, aliases){
    for(const alias of aliases){
      const value=row[canonical(alias)];
      if(value!==undefined&&value!==null&&String(value).trim()!=='')return value;
    }
    return null;
  }
  function number(value, fallback=null){
    if(value===null||value===undefined||String(value).trim()==='')return fallback;
    let text=String(value).trim().replace(/\s/g,'');
    if(text.includes(',')&&text.includes('.'))text=text.replace(/,/g,'');
    else if(text.includes(','))text=text.replace(',','.');
    text=text.replace(/[^0-9eE+\-.]/g,'');
    const parsed=Number(text);
    return Number.isFinite(parsed)?parsed:fallback;
  }
  function timestamp(value, fallback=null){
    if(value===null||value===undefined||String(value).trim()==='')return fallback;
    const raw=String(value).trim();
    if(/^\d{10}$/.test(raw))return new Date(Number(raw)*1000).toISOString();
    if(/^\d{13}$/.test(raw))return new Date(Number(raw)).toISOString();
    const parsed=Date.parse(raw);
    return Number.isFinite(parsed)?new Date(parsed).toISOString():fallback;
  }
  function symbol(value){
    let result=String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
    for(const quote of ['USDT','BUSD','USDC','FDUSD','USD']){
      if(result.length>quote.length+1&&result.endsWith(quote)){result=result.slice(0,-quote.length);break}
    }
    return result.slice(0,20);
  }
  function direction(value){
    const side=String(value||'').toUpperCase();
    if(['LONG','BUY','B'].includes(side))return 'LONG';
    if(['SHORT','SELL','S'].includes(side))return 'SHORT';
    return null;
  }
  function timeframe(value){
    const raw=String(value||'1H').trim().toUpperCase().replace(/\s/g,'');
    const aliases={'1MIN':'1M','3MIN':'3M','5MIN':'5M','15MIN':'15M','30MIN':'30M','60MIN':'1H','1HR':'1H','2HR':'2H','4HR':'4H','6HR':'6H','8HR':'8H','12HR':'12H','1DAY':'1D','3DAY':'3D','1WEEK':'1W','1MONTH':'1MO'};
    const normalized=aliases[raw]||raw;
    return ['1M','3M','5M','15M','30M','1H','2H','4H','6H','8H','12H','1D','3D','1W','1MO'].includes(normalized)?normalized:'1H';
  }
  function tags(value){
    if(Array.isArray(value))return value.map(x=>String(x).trim().toLowerCase()).filter(Boolean).slice(0,20);
    return String(value||'').split(/[|,;]/).map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,20);
  }
  function csv(text){
    const rows=[];let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){
      const char=text[i],next=text[i+1];
      if(char==='"'){
        if(quoted&&next==='"'){field+='"';i++;}
        else quoted=!quoted;
      }else if(char===','&&!quoted){row.push(field);field='';}
      else if((char==='\n'||char==='\r')&&!quoted){
        if(char==='\r'&&next==='\n')i++;
        row.push(field);field='';
        if(row.some(value=>String(value).trim()!==''))rows.push(row);
        row=[];
      }else field+=char;
    }
    row.push(field);if(row.some(value=>String(value).trim()!==''))rows.push(row);
    if(rows.length<2)return [];
    const headers=rows[0].map(value=>String(value).replace(/^\ufeff/,'').trim());
    return rows.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
  }
  async function fingerprint(trade){
    const normalized=[trade.symbol,trade.direction,trade.status,trade.entry_time,trade.exit_time||'',trade.entry_price,trade.exit_price||'',trade.quantity,trade.fees].join('|');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));
    return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
  }
  async function normalize(raw,userId,index){
    const row=mapRow(raw);
    const asset=symbol(pick(row,['symbol','asset','pair','market','instrument']));
    const side=direction(pick(row,['direction','side','position side','positionside','type']));
    const entryPrice=number(pick(row,['entry_price','entry price','avg entry price','average entry price','open price','price']));
    const exitPrice=number(pick(row,['exit_price','exit price','avg exit price','average exit price','close price']));
    const quantity=number(pick(row,['quantity','qty','executed','executed qty','size','amount']),1);
    if(!asset||!side||!(entryPrice>0)||!(quantity>0))throw Error(`row ${index+2}: symbol/direction/entry/quantity`);
    const entryTime=timestamp(pick(row,['entry_time','entry time','open time','opened at','time','date']),new Date().toISOString());
    const exitTime=timestamp(pick(row,['exit_time','exit time','close time','closed at']));
    const requestedStatus=String(pick(row,['status'])||'').toUpperCase();
    const status=['OPEN','CLOSED','CANCELLED'].includes(requestedStatus)?requestedStatus:(exitPrice>0&&exitTime?'CLOSED':'OPEN');
    if(status==='CLOSED'&&(!(exitPrice>0)||!exitTime))throw Error(`row ${index+2}: closed trade requires exit price/time`);
    const trade={
      user_id:userId,
      symbol:asset,
      timeframe:timeframe(pick(row,['timeframe','tf','interval'])),
      direction:side,
      status,
      strategy:String(pick(row,['strategy'])||'Imported history').slice(0,120)||null,
      setup:String(pick(row,['setup'])||'').slice(0,250)||null,
      entry_time:entryTime,
      exit_time:status==='CLOSED'?exitTime:null,
      entry_price:entryPrice,
      exit_price:status==='CLOSED'?exitPrice:null,
      stop_price:number(pick(row,['stop_price','stop price','stop','sl'])),
      take_profit_price:number(pick(row,['take_profit_price','take profit price','take profit','tp'])),
      quantity,
      leverage:Math.min(125,Math.max(1,number(pick(row,['leverage']),1))),
      fees:Math.max(0,number(pick(row,['fees','fee','commission','commissions']),0)),
      notes:String(pick(row,['notes','note','comment'])||'').slice(0,4000)||null,
      tags:tags(pick(row,['tags','tag'])),
      source:'import',
      source_signal_id:null
    };
    trade.import_fingerprint=await fingerprint(trade);
    return trade;
  }
  async function parseFile(file){
    const text=await file.text();
    let raw;
    if(file.name.toLowerCase().endsWith('.json')||text.trim().startsWith('[')||text.trim().startsWith('{')){
      const data=JSON.parse(text);
      raw=Array.isArray(data)?data:(data.trades||data.rows||data.data||[]);
    }else raw=csv(text);
    if(!Array.isArray(raw))throw Error(tr().empty);
    if(raw.length>MAX_ROWS)throw Error(tr().limit);
    return raw;
  }
  async function importFile(file){
    const {data:{session}}=await client.auth.getSession();
    if(!session)throw Error(tr().login);
    const raw=await parseFile(file);
    const valid=[];const errors=[];
    for(let index=0;index<raw.length;index++){
      try{valid.push(await normalize(raw[index],session.user.id,index));}
      catch(error){if(errors.length<10)errors.push(error.message);}
    }
    if(!valid.length)throw Error(errors.length?errors.join('; '):tr().empty);
    let added=0;
    for(let index=0;index<valid.length;index+=CHUNK_SIZE){
      const chunk=valid.slice(index,index+CHUNK_SIZE);
      const {data,error}=await client.from('crypto_trade_journal').upsert(chunk,{onConflict:'user_id,import_fingerprint',ignoreDuplicates:true}).select('id');
      if(error)throw error;
      added+=Array.isArray(data)?data.length:0;
    }
    return {added,total:valid.length,skipped:valid.length-added,errors};
  }
  function downloadTemplate(){
    const header='entry_time,exit_time,symbol,timeframe,direction,status,entry_price,exit_price,stop_price,take_profit_price,quantity,leverage,fees,strategy,setup,tags,notes\n';
    const example='2026-08-01T09:00:00Z,2026-08-01T13:00:00Z,BTC,1H,LONG,CLOSED,65000,66000,64500,66000,0.01,3,0.65,EMA + RSI,Trend continuation,"trend|scanner",Example trade\n';
    const blob=new Blob(['\ufeff'+header+example],{type:'text/csv;charset=utf-8'}),link=document.createElement('a');
    link.href=URL.createObjectURL(blob);link.download='crypto-lab-journal-import-template.csv';link.click();URL.revokeObjectURL(link.href);
  }
  function enhanceScannerDraft(){
    const query=new URLSearchParams(location.search),signalId=query.get('sourceSignal');
    if(!signalId)return;
    const strategy=document.getElementById('strategy'),setup=document.getElementById('setup'),notes=document.getElementById('notes'),tagsInput=document.getElementById('tags'),entryTime=document.getElementById('entryTime');
    const low=number(query.get('entryLow')),high=number(query.get('entryHigh')),strength=query.get('strength'),status=query.get('signalStatus'),tp2=query.get('tp2'),tp3=query.get('tp3');
    if(strategy&&!strategy.value)strategy.value='CRYPTO LAB Scanner';
    if(setup)setup.value=[`Signal ${signalId}`,strength?`strength ${strength}`:null,status?`status ${status}`:null].filter(Boolean).join(' · ');
    if(notes&&!notes.value)notes.value=[low&&high?`Entry range: ${low}–${high}`:null,tp2?`TP2: ${tp2}`:null,tp3?`TP3: ${tp3}`:null].filter(Boolean).join('\n');
    if(tagsInput&&!tagsInput.value)tagsInput.value=['scanner',strength?`strength-${strength}`:null].filter(Boolean).join(', ');
    const signalTime=query.get('signalTime');if(entryTime&&signalTime)entryTime.value=new Date(new Date(signalTime).getTime()-new Date(signalTime).getTimezoneOffset()*60000).toISOString().slice(0,16);
    notice(tr().draft);
  }
  function install(){
    const lang=document.getElementById('lang');
    const input=document.createElement('input');input.type='file';input.accept='.csv,.json,text/csv,application/json';input.hidden=true;input.id='journalImportFile';
    const importButton=document.createElement('button');importButton.type='button';importButton.className='btn gold';importButton.id='journalImportBtn';
    const templateButton=document.createElement('button');templateButton.type='button';templateButton.className='btn';templateButton.id='journalTemplateBtn';
    function translate(){importButton.textContent=tr().import;templateButton.textContent=tr().template;}
    translate();
    if(lang){lang.before(templateButton,importButton,input);lang.addEventListener('change',()=>setTimeout(translate,0));}
    importButton.onclick=()=>input.click();templateButton.onclick=downloadTemplate;
    input.onchange=async()=>{
      const file=input.files&&input.files[0];if(!file)return;
      importButton.disabled=true;notice(tr().importing);
      try{const result=await importFile(file);notice(tr().done(result.added,result.total,result.skipped));document.getElementById('refreshBtn')?.click();}
      catch(error){notice(`${tr().bad}: ${error.message||error}`,true);}
      finally{importButton.disabled=false;input.value='';}
    };
    enhanceScannerDraft();
  }
  install();
})();