(()=>{
  let promptEvent;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;});
  document.addEventListener('DOMContentLoaded',()=>{
    const button=document.getElementById('installBtn');if(standalone())button.hidden=true;
    button.addEventListener('click',async()=>{
      if(promptEvent){await promptEvent.prompt();await promptEvent.userChoice;promptEvent=null;return;}
      const tr=window.MHI18n.t,dialog=document.createElement('dialog');dialog.className='install-dialog';
      const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
      dialog.innerHTML=`<h2>${tr('Install Market Hunter','نصب مارکت هانتر')}</h2><p>${ios?tr('Open this site in Safari. Tap Share, then Add to Home Screen, then Add.','این سایت را در Safari باز کن. دکمهٔ اشتراک‌گذاری را بزن، سپس Add to Home Screen و بعد Add را انتخاب کن.'):tr('Open your browser menu and choose Install app or Add to Home Screen.','از منوی مرورگر گزینهٔ نصب برنامه یا Add to Home Screen را انتخاب کن.')}</p><button class="btn">${tr('Got it','متوجه شدم')}</button>`;
      document.body.append(dialog);dialog.querySelector('button').onclick=()=>{dialog.close();dialog.remove()};dialog.showModal();
    });
    addEventListener('appinstalled',()=>{button.hidden=true});
  });
})();
