'use strict';
(() => {
  if(window.CryptoLabRuntimePerformance)return;
  const state={version:'7930speed2',frameUnloads:0};
  window.CryptoLabRuntimePerformance=state;
  const $=id=>document.getElementById(id);

  // Canonical public brand in the browser tab / installed app shell.
  document.title='CRYPTO LAB — Crypto Market Intelligence';
  let description=document.querySelector('meta[name="description"]');
  if(!description){
    description=document.createElement('meta');
    description.name='description';
    document.head.appendChild(description);
  }
  description.content='CRYPTO LAB — real-time crypto market intelligence, analytics, scanner, AI, portfolio, risk and market-moving news.';

  if(!document.getElementById('cryptoRuntimePerformanceStyles')){
    const style=document.createElement('style');
    style.id='cryptoRuntimePerformanceStyles';
    style.textContent=`
      #homeView.ih .ih-grid2,#homeView.ih .ih-grid3,#homeView.ih .ih-heat{content-visibility:auto;contain-intrinsic-size:260px}
      #homeView.ih .ih-card{contain:layout paint style}
      body.crypto-page-hidden .market-news-track{animation-play-state:paused!important}
      .frame-view.hide iframe{visibility:hidden}
    `;
    document.head.appendChild(style);
  }

  function unloadHiddenFrame(){
    const frame=$('frame'),view=$('frameView');
    if(!frame||!view||!view.classList.contains('hide'))return;
    const raw=frame.getAttribute('src')||'';
    if(raw&&raw!=='about:blank'){
      frame.src='about:blank';
      state.frameUnloads++;
    }
  }

  try{
    const baseOpen=open;
    open=function performanceOpen(route,signal){
      const result=baseOpen(route,signal);
      requestAnimationFrame(unloadHiddenFrame);
      return result;
    };
  }catch(error){console.warn('CRYPTO LAB route performance guard unavailable',error)}

  function visibility(){document.body.classList.toggle('crypto-page-hidden',document.hidden)}
  document.addEventListener('visibilitychange',visibility,{passive:true});
  visibility();

  if('requestIdleCallback' in window)requestIdleCallback(unloadHiddenFrame,{timeout:1200});
  else setTimeout(unloadHiddenFrame,250);
})();
