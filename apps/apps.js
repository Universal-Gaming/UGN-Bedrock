(() => {
  'use strict';
  const releaseApi='https://api.github.com/repos/Universal-Gaming/UGN-Bedrock/releases/tags/apps-preview';
  const releasePage='https://github.com/Universal-Gaming/UGN-Bedrock/releases/tag/apps-preview';
  const platforms=[
    {id:'windows',test:a=>/\.exe$/i.test(a.name) && /win/i.test(a.name)},
    {id:'mac-intel',test:a=>/\.dmg$/i.test(a.name) && /x64/i.test(a.name)},
    {id:'mac-apple',test:a=>/\.dmg$/i.test(a.name) && /arm64/i.test(a.name)},
    {id:'android',test:a=>/\.apk$/i.test(a.name)}
  ];
  const message=document.getElementById('apps-status');
  const setLink=(id,asset)=>{
    const link=document.getElementById('download-'+id);
    if(!link)return;
    if(asset && /^https:\/\/github\.com\/Universal-Gaming\/UGN-Bedrock\/releases\/download\//.test(asset.browser_download_url)){
      link.href=asset.browser_download_url;
      link.textContent='DOWNLOAD '+(id==='android'?'APK':id==='windows'?'EXE':'DMG')+' ↗';
      link.classList.add('available');
      link.setAttribute('aria-label','Download '+asset.name);
    }else{
      link.href=releasePage;
      link.textContent='CHECK BUILD STATUS ↗';
      link.classList.remove('available');
    }
  };
  platforms.forEach(p=>setLink(p.id,null));
  fetch(releaseApi,{headers:{Accept:'application/vnd.github+json'},cache:'no-store'})
    .then(r=>{if(!r.ok)throw Error('Not yet published');return r.json()})
    .then(data=>{
      if(!Array.isArray(data.assets))throw Error('No release assets');
      let count=0;
      for(const p of platforms){
        const asset=data.assets.find(a=>p.test(a)&&a.state==='uploaded'&&a.size>10000);
        setLink(p.id,asset);
        if(asset)count++;
      }
      if(message)message.textContent=count
        ? count+' verified installer'+(count!==1?'s':'')+' available in UGN Apps Preview.'
        : 'Installers are being prepared. Browser play remains available.';
    })
    .catch(()=>{if(message)message.textContent='Installers are not published yet. Check the app build status.'});
  let promptEvent=null;
  const install=document.getElementById('install-web-app');
  window.addEventListener('beforeinstallprompt',event=>{
    event.preventDefault();
    promptEvent=event;
    if(install){install.hidden=false;install.disabled=false;}
  });
  install?.addEventListener('click',async()=>{
    if(!promptEvent)return;
    const prompt=promptEvent;promptEvent=null;
    await prompt.prompt();
    await prompt.userChoice;
    install.hidden=true;
  });
})();
