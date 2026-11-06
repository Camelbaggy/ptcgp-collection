/**
 * Favori « Envoyer vers Holothèque », lancé par l'utilisateur sur son profil Pokémon-Zone
 * (pokemon-zone.com/players/<id>/…), dans son propre navigateur.
 * Il fait ce que l'utilisateur ferait à la main, à un rythme humain :
 * - sur la page d'une extension : propose cette extension seule ou toutes ;
 * - ailleurs sur le profil : toutes les extensions ;
 * pour chacune, ouvre sa page (cadre invisible, même site), clique sur « Load More »
 * jusqu'à la fin, relève les cartes (lien, exemplaires, nom, image, rareté), puis fait une
 * pause avant la suivante. Il ouvre enfin Holothèque avec ces données, compressées, dans
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
let codes;
if(m[2]&&!confirm("Holothèque : importer TOUTES tes extensions ?\\n\\nOK = toutes (quelques minutes)\\nAnnuler = seulement celle-ci"))codes=[m[2]];
if(!codes){say("liste des extensions…");
try{const h=await(await fetch("/players/"+P+"/sets/",{credentials:"include"})).text();
codes=[...new Set([...h.matchAll(new RegExp("/players/"+P+"/sets/([A-Za-z0-9-]+)/","g"))].map(x=>x[1]))]}catch(e){codes=[]}
if(!codes.length)codes=known}
const pages=[];
for(let j=0;j<codes.length;j++){const c=codes[j],label=c+" ("+(j+1)+"/"+codes.length+")";say(label+"…");
let res;
if(codes.length===1&&m[2]===c)res=await grab(document,label);
else{const u="/players/"+P+"/sets/"+c+"/",f=await frame(u);try{res=await grab(f.contentDocument,label)}catch(e){res={more:true,rows:[]}}f.remove();
if(!res.rows.length){try{const d=new DOMParser().parseFromString(await(await fetch(u,{credentials:"include"})).text(),"text/html");res={more:[...d.querySelectorAll(MORE)].some(vis),rows:rowsOf(d)}}catch(e){}}
await sl(1500)}
if(res.rows.length)pages.push({set:c,more:res.more,rows:res.rows})}
if(!pages.length){say("aucune carte trouvée.");alert("Aucune carte trouvée. Vérifie que ton profil Pokémon-Zone est synchronisé.");box.remove();return}
say("ouverture de l'appli…");
const json=JSON.stringify({v:2,player:P,pages:pages});
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
