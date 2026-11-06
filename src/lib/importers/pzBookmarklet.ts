/**
 * Favori « Envoyer vers Holothèque », lancé par l'utilisateur sur son profil Pokémon-Zone
 * (pokemon-zone.com/players/<id>/…), dans son propre navigateur.
 * Il fait ce que l'utilisateur ferait à la main, à un rythme humain :
 * un petit menu propose « Tout » (toutes les extensions, accueil, stats, collections à thème,
 * souhaits : première fois, ou après la sortie d'une extension), « Mise à jour rapide »
 * (accueil, souhaits, et l'extension affichée) ou « Seulement cette extension ».
 * Chaque page est ouverte dans un cadre invisible (même site), une à la fois avec une pause ;
 * pour une extension, il clique sur « Load More » jusqu'à la fin et relève les cartes (lien,
 * exemplaires, nom, image, rareté) ; pour les autres pages, il garde le contenu de `<main>`
 * (sans scripts ni styles), lu ensuite par l'appli (`lib/pzProfile`). Il ouvre enfin Holothèque avec ces données, compressées, dans
 * l'ancre de l'adresse (#…), qui n'est envoyée à aucun serveur.
 * Aucune requête vers le compte Nintendo ni vers un autre site.
 *
 * Le script reste volontairement « bête » : toute l'interprétation se fait dans l'appli
 * (`parsePzPayload`), pour ne pas devoir recréer le favori à chaque évolution.
 * `__SETS__` : codes des extensions connus de l'appli, si la liste du profil est illisible.
 */
const SCRIPT = `(async()=>{
const app=__APP__,known=__SETS__;
const sl=t=>new Promise(r=>setTimeout(r,t));
const m=location.pathname.match(/\\/players\\/([^/]+)(?:\\/sets\\/([^/]+))?/);
if(!/(^|\\.)pokemon-zone\\.com$/.test(location.hostname)||!m){alert("Ouvre d'abord ton profil Pokémon-Zone (pokemon-zone.com/players/…), puis relance le favori Holothèque.");return}
const P=m[1],Q=".player-expansion-collection-card",MORE=".data-infinite-scroller__more";
const box=document.createElement("div");
box.style.cssText="position:fixed;z-index:2147483647;left:12px;right:12px;bottom:12px;padding:14px 16px;border-radius:14px;background:#1d1838;color:#fff;font:600 15px/1.4 system-ui,sans-serif;box-shadow:0 6px 30px #0008";
const say=t=>{box.textContent="Holothèque : "+t};
document.body.appendChild(box);
const vis=e=>!e.classList.contains("d-none");
const rowsOf=doc=>[...doc.querySelectorAll(Q)].map(c=>{
const a=c.querySelector("a[href*='/cards/']"),i=c.querySelector(".game-card-image__img"),q=c.querySelector(".player-expansion-collection-card__count"),t=c.querySelector(".player-expansion-collection-card__name-text"),r=c.querySelector("[class*='rarity-icon--rarity-']");
const h=((a&&a.getAttribute("href"))||"").match(/\\/cards\\/[^/]+\\/[^/]+\\//);
const rr=((r&&r.getAttribute("class")||"").match(/rarity-icon--rarity-([A-Z]+)/)||[])[1]||"";
const s=i?(i.getAttribute("src")||""):"";
return[h?h[0]:"",q?Number(q.textContent.trim())||0:0,t?t.textContent.trim():"",s.split("/").pop().split("?")[0],rr]}).filter(x=>x[0]);
const grab=async(doc,label)=>{
const n=()=>doc.querySelectorAll(Q).length;
for(let t=0;t<50&&!n()&&!doc.querySelector(MORE);t++)await sl(200);
for(let i=0;i<40;i++){
const w=[...doc.querySelectorAll(MORE)].find(vis);
const b=w&&w.querySelector("button");
if(!b)break;
const k=n();b.click();say(label+" · "+k+" cartes…");
for(let t=0;t<75&&n()===k;t++)await sl(200);
if(n()===k)break;
await sl(500)}
return{more:[...doc.querySelectorAll(MORE)].some(vis),rows:rowsOf(doc)}};
const frame=src=>new Promise(ok=>{const f=document.createElement("iframe");f.style.cssText="position:fixed;left:-20000px;top:0;width:420px;height:900px;border:0";
let done=false;const fin=()=>{if(!done){done=true;ok(f)}};f.onload=fin;setTimeout(fin,20000);f.src=src;document.body.appendChild(f)});
const ask=()=>new Promise(ok=>{box.textContent="";const h=document.createElement("div");h.textContent="Holothèque : que veux-tu importer ?";h.style.marginBottom="6px";box.appendChild(h);
const opt=(l,v,main)=>{const b=document.createElement("button");b.textContent=l;b.style.cssText="display:block;width:100%;margin:8px 0 0;padding:12px;border:0;border-radius:10px;cursor:pointer;font:700 15px/1.3 system-ui,sans-serif;"+(main?"background:#34d6a8;color:#11102a":"background:#3a3460;color:#fff");b.onclick=()=>ok(v);box.appendChild(b)};
opt("Tout : extensions, accueil, stats, collections à thème, souhaits (quelques minutes)","all",1);
opt("Mise à jour rapide : accueil et souhaits"+(m[2]?" + extension "+m[2]:""),"quick");
if(m[2])opt("Seulement l'extension "+m[2],"one");
opt("Annuler","")});
const mode=await ask();
if(!mode){box.remove();return}
say("c'est parti…");
let codes=m[2]?[m[2]]:[];
if(mode==="all"){say("liste des extensions…");
try{const h=await(await fetch("/players/"+P+"/sets/",{credentials:"include"})).text();
codes=[...new Set([...h.matchAll(new RegExp("/players/"+P+"/sets/([A-Za-z0-9-]+)/","g"))].map(x=>x[1]))]}catch(e){codes=[]}
if(!codes.length)codes=known}
const subs=mode==="all"?[["home",""],["stats","stats/"],["themed","themed-collections/"],["wishlist","wishlist/"]]:mode==="quick"?[["home",""],["wishlist","wishlist/"]]:[];
const html={};
for(const[k,sub]of subs){const u="/players/"+P+"/"+sub;say({home:"accueil",stats:"statistiques",themed:"collections à thème",wishlist:"souhaits"}[k]+"…");
let main=null;
if(location.pathname===u){main=document.querySelector("main");if(main)main=main.cloneNode(true)}
else{const f=await frame(u);try{const d=f.contentDocument;for(let t=0;t<50&&!(d.querySelector("main")&&d.querySelector("main").textContent.length>200);t++)await sl(200);await sl(800);main=d.querySelector("main");if(main)main=main.cloneNode(true)}catch(e){}f.remove();
if(!main){try{main=new DOMParser().parseFromString(await(await fetch(u,{credentials:"include"})).text(),"text/html").querySelector("main")}catch(e){}}
await sl(1200)}
if(main){main.querySelectorAll("script,style,svg,noscript").forEach(e=>e.remove());html[k]=main.outerHTML}}
const pages=[];
for(let j=0;j<codes.length;j++){const c=codes[j],label=c+" ("+(j+1)+"/"+codes.length+")";say(label+"…");
let res;
if(m[2]===c)res=await grab(document,label);
else{const u="/players/"+P+"/sets/"+c+"/",f=await frame(u);try{res=await grab(f.contentDocument,label)}catch(e){res={more:true,rows:[]}}f.remove();
if(!res.rows.length){try{const d=new DOMParser().parseFromString(await(await fetch(u,{credentials:"include"})).text(),"text/html");res={more:[...d.querySelectorAll(MORE)].some(vis),rows:rowsOf(d)}}catch(e){}}
await sl(1500)}
if(res.rows.length)pages.push({set:c,more:res.more,rows:res.rows})}
if(!pages.length&&!Object.keys(html).length){say("rien trouvé.");alert("Rien trouvé. Vérifie que ton profil Pokémon-Zone est synchronisé.");box.remove();return}
say("ouverture de l'appli…");
const json=JSON.stringify({v:3,player:P,pages:pages,html:html});
let hash="pz="+encodeURIComponent(json);
try{const b=new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
let t="";for(let i=0;i<b.length;i+=8192)t+=String.fromCharCode.apply(null,b.subarray(i,i+8192));
hash="pzz="+btoa(t).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"")}catch(e){}
location.href=app+"#/ajout?onglet=pz&"+hash
})()`

/**
 * Code du favori (adresse `javascript:…`) pour l'appli publiée à `appUrl`.
 * `setCodes` : codes Pokémon-Zone des extensions connues (repli si la liste du profil est illisible).
 */
export function pzBookmarklet(appUrl: string, setCodes: string[] = []): string {
  const codes = setCodes.filter((c) => /^[A-Za-z0-9-]+$/.test(c))
  const code = SCRIPT.replace('__APP__', JSON.stringify(appUrl)).replace('__SETS__', JSON.stringify(codes)).replace(/\n/g, '')
  return 'javascript:' + encodeURIComponent(code).replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%2F/g, '/')
}
