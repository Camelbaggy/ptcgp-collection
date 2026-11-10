/**
 * Lecture de la tier list PocketMads (https://app.pocketmads.com/tier-list) dans la page affichée
 * par un vrai navigateur : fenêtre intégrée de l'appli Android (`PzWebView`) ou favori Holothèque.
 * Le script fait ce que ferait l'utilisateur : il ouvre les tiers repliés (Tier 3, Sleepers…), puis
 * relève les decks affichés. Aucune requête vers l'API de PocketMads (interdite par leur robots.txt).
 *
 * Résultat brut (`PmRaw`), interprété par `parsePmRaw` : le script reste simple et stable.
 */

/** Corps commun : `pmExpand(doc)` (asynchrone) puis `pmRead(doc)` → objet `PmRaw`. */
export const PM_CORE = String.raw`
var pmSl=function(t){return new Promise(function(r){setTimeout(r,t)})};
var pmTxt=function(e){return e?(e.textContent||"").replace(/\s+/g," ").trim():""};
var pmLinks=function(doc){return doc.querySelectorAll("a[href*='/meta-game/']").length};
var pmHeads=function(doc){return [].filter.call(doc.querySelectorAll("section > button[aria-expanded]"),function(b){return /tier|sleeper/i.test(pmTxt(b))})};
var pmExpand=async function(doc){
for(var t=0;t<75&&!pmHeads(doc).length;t++)await pmSl(200);
var hs=pmHeads(doc);
for(var i=0;i<hs.length;i++){var b=hs[i];
if(b.getAttribute("aria-expanded")==="true")continue;
var c=pmTxt(b.querySelector(".rounded-full"));if(c==="0")continue;
var k=pmLinks(doc);b.click();
for(var u=0;u<25&&pmLinks(doc)===k;u++)await pmSl(200);
await pmSl(300)}
var l=-1,s=0;for(var v=0;v<20&&s<2;v++){await pmSl(250);var n=pmLinks(doc);if(n===l)s++;else s=0;l=n}};
var pmRead=function(doc){
var tiers=pmHeads(doc).map(function(b){
var sec=b.parentElement,sp=b.querySelectorAll("span span");
var decks=[].map.call(sec.querySelectorAll("a[href*='/meta-game/']"),function(a){
var h=a.getAttribute("href")||"",st={};
[].forEach.call(a.querySelectorAll(".grid > div"),function(c){var d=c.children;if(d.length>=2)st[pmTxt(d[0])]=pmTxt(d[1])});
var h3=a.querySelector("h3"),dl=a.querySelector("[title*='Score change']"),card=a.parentElement;
return {name:h3?(h3.getAttribute("title")||pmTxt(h3)):"",href:h,stats:st,delta:pmTxt(dl),shift:/tier shift/i.test(pmTxt(card))}});
return {label:pmTxt(sp[0])||pmTxt(b),sub:pmTxt(sp[1]),count:pmTxt(b.querySelector(".rounded-full")),open:b.getAttribute("aria-expanded")==="true",decks:decks}});
var body=pmTxt(doc.body),up=body.match(/Updated\s+(.{4,40}?\d{1,2}:\d{2})/);
return {v:1,url:String(doc.location&&doc.location.href||""),updated:up?up[1]:"",tiers:tiers}};
`

/** Expression pour la fenêtre intégrée : lance l'ouverture des tiers et la lecture en tâche de fond. */
export const PM_GRAB_JS = `(function(){${PM_CORE}
var st=window.__holo={state:"run",n:0,out:"",more:false};
(async function(){try{await pmExpand(document);var r=pmRead(document);st.out=JSON.stringify(r);
st.n=r.tiers.reduce(function(n,t){return n+t.decks.length},0);st.state="done"}catch(e){st.state="error";st.err=String(e)}})();
return "started"})()`

/** État de la page PocketMads : hôte, vérification de sécurité, nombre d'en-têtes de tiers. */
export const PM_PROBE_JS = `(function(){try{${PM_CORE}
var d=document,t=d.title||"";
var ch=/just a moment|un instant|attention required|verify you are human/i.test(t)||!!d.querySelector("#challenge-form,.cf-turnstile,iframe[src*='challenges.cloudflare.com']");
return JSON.stringify({host:location.host,path:location.pathname,challenge:ch,heads:pmHeads(d).length,links:pmLinks(d)})
}catch(e){return JSON.stringify({error:String(e)})}})()`
