'use strict';
(() => {
  const frame=document.getElementById('frame');
  const reset=()=>{
    try{window.scrollTo(0,0)}catch{}
    try{document.scrollingElement.scrollTop=0}catch{}
    try{
      document.querySelectorAll('.view').forEach(view=>{
        if(!view.classList.contains('hide')){view.scrollTop=0;view.scrollLeft=0;}
      });
    }catch{}
    try{
      if(frame?.contentWindow){frame.contentWindow.scrollTo(0,0);}
      const doc=frame?.contentDocument;
      if(doc?.documentElement){doc.documentElement.scrollTop=0;doc.documentElement.scrollLeft=0;}
      if(doc?.body){doc.body.scrollTop=0;doc.body.scrollLeft=0;}
    }catch{}
  };
  const scheduleReset=()=>{
    reset();
    requestAnimationFrame(reset);
    setTimeout(reset,40);
    setTimeout(reset,180);
  };
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest('[data-route],[data-r],[data-quick]'):null;
    if(target)scheduleReset();
  },true);
  frame?.addEventListener('load',scheduleReset);
  if(frame){
    new MutationObserver(mutations=>{
      if(mutations.some(m=>m.type==='attributes'&&m.attributeName==='src'))scheduleReset();
    }).observe(frame,{attributes:true,attributeFilter:['src']});
  }
  window.addEventListener('popstate',scheduleReset);
})();
