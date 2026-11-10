import { PM_CORE } from '../pocketMads/extract.ts'

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
 * Lancé sur la tier list PocketMads (app.pocketmads.com/tier-list), il ouvre les tiers repliés,
 * relève les decks (`pocketMads/extract.ts`) et les envoie à l'écran Méta (`#/meta?pm=…`).
 *
 * Le script reste volontairement « bête » : toute l'interprétation se fait dans l'appli
 * (`parsePzPayload`), pour ne pas devoir recréer le favori à chaque évolution.
 * `__SETS__` : codes des extensions connus de l'appli, si la liste du profil est illisible.
 */
const SCRIPT = `(async()=>{
const app=__APP__,known=__SETS__;
const sl=t=>new Promise(r=>setTimeout(r,t));
if(location.hostname==="app.pocketmads.com"){
if(!/^\\/tier-list/.test(location.pathname)){alert("Ouvre d'abord la tier list PocketMads (app.pocketmads.com/tier-list), puis relance le favori Holothèque.");return}
__PM__
const pb=document.createElement("div");pb.style.cssText="position:fixed;z-index:2147483647;left:12px;right:12px;bottom:12px;padding:14px 16px;border-radius:14px;background:#1d1838;color:#fff;font:600 15px/1.4 system-ui,sans-serif";pb.textContent="Holothèque : lecture de la tier list…";document.body.appendChild(pb);
await pmExpand(document);const r=pmRead(document);
if(!r.tiers.some(t=>t.decks.length)){pb.remove();alert("Holothèque : aucun deck trouvé sur cette page.");return}
const b=new TextEncoder().encode(JSON.stringify(r));let t="";for(let i=0;i<b.length;i+=8192)t+=String.fromCharCode.apply(null,b.subarray(i,i+8192));
location.href=app+"#/meta?pm="+btoa(t).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"");return}
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
let W=null;
const frame=src=>new Promise(ok=>{const f=document.createElement("iframe");f.style.cssText="position:fixed;left:-20000px;top:0;width:420px;height:900px;border:0";
let done=false;const fin=()=>{if(!done){done=true;ok(f)}};f.onload=fin;setTimeout(fin,20000);f.src=src;document.body.appendChild(f)});
const settle=async d=>{let l=-1,k=0;for(let t=0;t<60&&k<3;t++){await sl(400);let n=0;try{n=(d.querySelector("main")||{textContent:""}).textContent.length}catch(e){}if(n>200&&n===l)k++;else k=0;l=n}};
const same=(a,b)=>a.toLowerCase().replace(/\\/$/,"")===b.toLowerCase().replace(/\\/$/,"");
const open=async u=>{
if(same(location.pathname,u))return{doc:document,done:()=>{}};
if(W&&!W.closed){try{W.location.href=u}catch(e){}
for(let t=0;t<120;t++){await sl(300);try{const d=W.document;if(same(W.location.pathname,u)&&d.readyState==="complete"&&d.querySelector("main"))return{doc:d,done:()=>{}}}catch(e){}}}
const f=await frame(u);try{if(f.contentDocument&&f.contentDocument.querySelector("main"))return{doc:f.contentDocument,done:()=>f.remove()}}catch(e){}f.remove();
try{return{doc:new DOMParser().parseFromString(await(await fetch(u,{credentials:"include"})).text(),"text/html"),done:()=>{}}}catch(e){return null}};
const ask=()=>new Promise(ok=>{box.textContent="";const h=document.createElement("div");h.textContent="Holothèque : que veux-tu importer ?";h.style.marginBottom="6px";box.appendChild(h);
const opt=(l,v,main)=>{const b=document.createElement("button");b.textContent=l;b.style.cssText="display:block;width:100%;margin:8px 0 0;padding:12px;border:0;border-radius:10px;cursor:pointer;font:700 15px/1.3 system-ui,sans-serif;"+(main?"background:#34d6a8;color:#11102a":"background:#3a3460;color:#fff");
b.onclick=()=>{if(v&&v!=="one"){try{W=window.open("about:blank","holotheque")}catch(e){W=null}}ok(v)};box.appendChild(b)};
opt("Tout : extensions, accueil, stats, collections à thème, souhaits (quelques minutes)","all",1);
opt("Mise à jour rapide : accueil et souhaits"+(m[2]?" + extension "+m[2]:""),"quick");
if(m[2])opt("Seulement l'extension "+m[2],"one");
opt("Annuler","")});
const mode=await ask();
if(!mode){box.remove();return}
say(W?"un onglet Pokémon-Zone s'ouvre : laisse-le travailler, il se fermera tout seul. Reviens ensuite sur cet onglet si besoin.":"c'est parti…");
await sl(W?2500:0);
let codes=m[2]?[m[2]]:[];
if(mode==="all"){say("liste des extensions…");codes=[];
const r=await open("/players/"+P+"/sets/");
if(r){await settle(r.doc);try{codes=[...new Set([...r.doc.querySelectorAll("a[href*='/sets/']")].map(a=>((a.getAttribute("href")||"").match(new RegExp("/players/"+P+"/sets/([A-Za-z0-9-]+)/"))||[])[1]).filter(Boolean))]}catch(e){}r.done()}
if(!codes.length)codes=known}
const subs=mode==="all"?[["home",""],["stats","stats/"],["themed","themed-collections/"],["wishlist","wishlist/"]]:mode==="quick"?[["home",""],["wishlist","wishlist/"]]:[];
const html={};
for(const[k,sub]of subs){const u="/players/"+P+"/"+sub;say({home:"accueil",stats:"statistiques",themed:"collections à thème",wishlist:"souhaits"}[k]+"…");
const r=await open(u);if(!r)continue;
await settle(r.doc);let main=null;try{main=r.doc.querySelector("main");if(main)main=main.cloneNode(true)}catch(e){}r.done();
if(main){main.querySelectorAll("script,style,svg,noscript").forEach(e=>e.remove());html[k]=main.outerHTML}
if(r.doc!==document)await sl(1000)}
const pages=[];
for(let j=0;j<codes.length;j++){const c=codes[j],label=c+" ("+(j+1)+"/"+codes.length+")";say(label+"…");
let res={more:true,rows:[]};
const r=await open("/players/"+P+"/sets/"+c+"/");
if(r){try{res=await grab(r.doc,label)}catch(e){}r.done()}
if(r&&r.doc!==document)await sl(1500);
if(res.rows.length)pages.push({set:c,more:res.more,rows:res.rows})}
if(W&&!W.closed)try{W.close()}catch(e){}
if(!pages.length&&!Object.keys(html).length){say("rien trouvé.");alert("Rien trouvé. Vérifie que ton profil Pokémon-Zone est synchronisé.");box.remove();return}
say("ouverture de l'appli…");
const json=JSON.stringify({v:3,player:P,pages:pages,html:html});
let hash="pz="+encodeURIComponent(json);
try{const b=new Uint8Array(await new Response(new Blob([json]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer());
let t="";for(let i=0;i<b.length;i+=8192)t+=String.fromCharCode.apply(null,b.subarray(i,i+8192));
hash="pzz="+btoa(t).replace(/\\+/g,"-").replace(/\\//g,"_").replace(/=+$/,"")}catch(e){}
location.href=app+"#/ajout?onglet=pz&"+hash
})().catch(e=>alert("Holothèque : erreur, "+(e&&e.message||e)))`

/** Script complet, publié avec l'appli (`pz-favori.js`) et chargé par le favori. */
export function pzFavoriScript(setCodes: string[] = []): string {
  const codes = setCodes.filter((c) => /^[A-Za-z0-9-]+$/.test(c))
  // adresse de l'appli = dossier du script (lue avant le premier await, tant que currentScript existe)
  const app = '(document.currentScript&&document.currentScript.src||"").replace(/[^/]*$/,"")'
  return SCRIPT.replace('__APP__', app).replace('__SETS__', JSON.stringify(codes)).replace('__PM__', () => PM_CORE) + '\n'
}

/**
 * Code du favori (adresse `javascript:…`) pour l'appli publiée à `appUrl`. Court (certains
 * navigateurs mobiles ignorent les favoris trop longs) : il charge `pz-favori.js` depuis
 * l'appli, toujours à jour, sans devoir recréer le favori.
 */
export function pzBookmarklet(appUrl: string): string {
  const code = `(()=>{const s=document.createElement("script");s.src=${JSON.stringify(appUrl + 'pz-favori.js')}+"?t="+Date.now();s.onerror=()=>alert("Holothèque : impossible de charger le favori sur cette page.");document.body.appendChild(s)})()`
  return 'javascript:' + encodeURIComponent(code).replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%2F/g, '/')
}
