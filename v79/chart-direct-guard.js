'use strict';
(() => {
  const host=location.hostname;
  if(host==='localhost'||host==='127.0.0.1')return;
  const KEY='cryptoLabChartQuota';
  let granted=false;
  try{
    const raw=sessionStorage.getItem(KEY),data=raw?JSON.parse(raw):null;
    granted=!!(data&&Number.isFinite(Number(data.at))&&Date.now()-Number(data.at)<60000);
    if(granted)sessionStorage.removeItem(KEY);
  }catch{}
  if(granted)return;
  const p=new URLSearchParams(location.search);
  p.set('quotaTarget','chart.html');
  location.replace('./chart-gate.html'+(p.toString()?'?'+p.toString():''));
})();
