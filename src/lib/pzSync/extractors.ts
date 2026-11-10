/**
 * Scripts évalués dans la page Pokémon-Zone affichée par la fenêtre intégrée de l'appli Android
 * (voir `native/holo-native` : `PzWebView`). Chacun est une expression qui produit une chaîne.
 * Les travaux longs (clics sur « Load More ») démarrent en tâche de fond et s'interrogent ensuite :
 * la page ne reçoit aucune interface native, et l'appli ne lit que ce que le script lui rend.
 */

/** État de la page : adresse, titre, vérification de sécurité en cours, contenu présent. */
export const PROBE_JS = String.raw`(function(){try{
var d=document,t=d.title||"",b=(d.body&&d.body.innerText)||"",m=d.querySelector("main");
var ch=/just a moment|un instant|attention required|verify you are human|vérifiez que vous êtes/i.test(t)
||!!d.querySelector("#challenge-form,.cf-turnstile,#cf-challenge-running,iframe[src*='challenges.cloudflare.com']")
||(!m&&/verify you are human|checking your browser|vérification/i.test(b.slice(0,800)));
var more=[].some.call(d.querySelectorAll(".data-infinite-scroller__more"),function(e){return !e.classList.contains("d-none")});
return JSON.stringify({host:location.host,path:location.pathname,title:t,challenge:ch,main:m?m.textContent.length:0,cards:d.querySelectorAll(".player-expansion-collection-card").length,more:more})
}catch(e){return JSON.stringify({error:String(e)})}})()`

/** Garde le contenu de `<main>` (sans scripts, styles, images vectorielles) dans `window.__holo.out`. */
export const GRAB_MAIN_JS = String.raw`(function(){try{
var m=document.querySelector("main");if(!m)return JSON.stringify({ok:false,size:0});
var c=m.cloneNode(true);c.querySelectorAll("script,style,svg,noscript").forEach(function(e){e.remove()});
window.__holo={state:"done",n:0,out:c.outerHTML};
return JSON.stringify({ok:true,size:window.__holo.out.length})
}catch(e){return JSON.stringify({ok:false,size:0,error:String(e)})}})()`

/**
 * Page d'une extension : clique sur « Load More » jusqu'à la fin (comme le fait l'utilisateur),
 * puis garde les cartes [lien, exemplaires, nom, image, rareté] dans `window.__holo.out` (JSON).
 */
export const GRAB_SET_JS = String.raw`(function(){
var Q=".player-expansion-collection-card",MORE=".data-infinite-scroller__more";
var st=window.__holo={state:"run",n:0,out:"",more:false};
var sl=function(t){return new Promise(function(r){setTimeout(r,t)})};
var vis=function(e){return !e.classList.contains("d-none")};
var rows=function(){return [].map.call(document.querySelectorAll(Q),function(c){
var a=c.querySelector("a[href*='/cards/']"),i=c.querySelector(".game-card-image__img"),q=c.querySelector(".player-expansion-collection-card__count"),t=c.querySelector(".player-expansion-collection-card__name-text"),r=c.querySelector("[class*='rarity-icon--rarity-']");
var h=((a&&a.getAttribute("href"))||"").match(/\/cards\/[^/]+\/[^/]+\//);
var rr=((r&&r.getAttribute("class")||"").match(/rarity-icon--rarity-([A-Z]+)/)||[])[1]||"";
var s=i?(i.getAttribute("src")||""):"";
return [h?h[0]:"",q?Number(q.textContent.trim())||0:0,t?t.textContent.trim():"",s.split("/").pop().split("?")[0],rr]}).filter(function(x){return x[0]})};
(async function(){try{
var n=function(){return document.querySelectorAll(Q).length};
for(var t=0;t<50&&!n()&&!document.querySelector(MORE);t++)await sl(200);
for(var i=0;i<40;i++){
var w=[].filter.call(document.querySelectorAll(MORE),vis)[0],b=w&&w.querySelector("button");
if(!b)break;
var k=n();b.click();st.n=k;
for(var u=0;u<75&&n()===k;u++)await sl(200);
if(n()===k)break;
await sl(500)}
var r=rows();st.more=[].some.call(document.querySelectorAll(MORE),vis);st.out=JSON.stringify(r);st.n=r.length;st.state="done"
}catch(e){st.state="error";st.err=String(e)}})();
return "started"})()`

/** Avancement de la tâche de fond (`GRAB_SET_JS`) ou du contenu gardé. */
export const POLL_JS = String.raw`(function(){var h=window.__holo;return JSON.stringify(h?{state:h.state,n:h.n,size:h.out.length,more:!!h.more,err:h.err||""}:{state:"none",n:0,size:0,more:false,err:""})})()`

/** Efface le résultat gardé avant une nouvelle page. */
export const RESET_JS = `(function(){window.__holo=null;return "ok"})()`

/** Lit une tranche du résultat gardé (les très gros résultats passent en plusieurs morceaux). */
export function readChunkJs(offset: number, length: number): string {
  return `(function(){var h=window.__holo;return h?h.out.substr(${Math.max(0, Math.floor(offset))},${Math.max(1, Math.floor(length))}):""})()`
}

/** Codes des extensions listées sur la page « Sets » du profil. */
export function setCodesJs(player: string): string {
  const p = player.replace(/[^0-9]/g, '')
  return String.raw`(function(){var o=[],s={};[].forEach.call(document.querySelectorAll("a[href*='/sets/']"),function(a){
var m=(a.getAttribute("href")||"").match(/\/players\/${p}\/sets\/([A-Za-z0-9-]+)\//);if(m&&!s[m[1]]){s[m[1]]=1;o.push(m[1])}});
return JSON.stringify(o)})()`
}
