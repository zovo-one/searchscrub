(function(root){'use strict';
const LICENSE='subscription',CAMPAIGN="zovo.membership.searchscrub.v1",PRODUCT="SearchScrub",CARD="Keep search focused. Help me keep improving SearchScrub.",DAYS30=30*86400000;
function subscriptionKind(record){
 if(record===undefined||record===null)return 'free';
 if(typeof record!=='object'||Array.isArray(record))return 'unknown';
 if(typeof record.tier==='string'&&record.tier&&record.tier!=='free')return 'member';
 if(record.isPro===true||record.valid===true)return 'member';
 if(record.licenseKey!==undefined&&record.licenseKey!==null&&record.licenseKey!=='')return 'unknown';
 if(record.tier!=='free')return 'unknown';
 const started=record.trialStarted,expires=record.trialExpires;
 if(started!==undefined&&started!==null||expires!==undefined&&expires!==null){
  if(typeof started!=='number'||!Number.isFinite(started)||started<=0||started>Date.now()||typeof expires!=='number'||!Number.isFinite(expires)||expires<=started)return 'unknown';
  if(expires>Date.now())return 'trial';
 }

 for(const key of ['expiresAt','lastVerified','cachedUntil'])if(record[key]!==undefined&&record[key]!==null&&typeof record[key]!=='number')return 'unknown';
 return 'free';
}
function classify(record,state,now){const kind=subscriptionKind(record);if(kind!=='free')return kind;
 if(state!==undefined&&state!==null){if(typeof state!=='object'||Array.isArray(state))return 'unknown';if(state.memberSeen)return 'member';if(state.recoverySeen)return 'unknown';if(state.hidden===true)return 'dismissed';if(state.dismissedAt!==undefined&&(typeof state.dismissedAt!=='number'||!Number.isFinite(state.dismissedAt)))return 'unknown';if(state.dismissedAt&&now-state.dismissedAt<DAYS30)return 'dismissed';}return 'free';}
const MEMBER=CAMPAIGN+'.memberSeen',RECOVERY=CAMPAIGN+'.recoverySeen',TRIAL=CAMPAIGN+'.trialUntil',PORT=CAMPAIGN+'.status';
// Dedicated flags are monotonic and cannot be overwritten by a dismissal RMW.
function requestWorkerStatus(){return new Promise(resolve=>{let port,done=false;const finish=status=>{if(done)return;done=true;clearTimeout(timer);try{port?.disconnect();}catch{}resolve(status);};const timer=setTimeout(()=>finish('unknown'),2500);try{port=chrome.runtime.connect({name:PORT});port.onMessage.addListener(message=>{finish(message&&message.campaign===CAMPAIGN&&['free','member','trial','unknown'].includes(message.status)?message.status:'unknown');});port.onDisconnect.addListener(()=>{void chrome.runtime.lastError;finish('unknown');});port.postMessage({request:'status'});}catch{finish('unknown');}});}
async function read(){try{const data=await chrome.storage.local.get([LICENSE,CAMPAIGN,MEMBER,RECOVERY,TRIAL]);const localKind=classify(data[LICENSE],data[CAMPAIGN],Date.now());if(data[MEMBER]===true)return 'member';if(data[RECOVERY]===true)return 'unknown';if(data[TRIAL]!==undefined&&(typeof data[TRIAL]!=='number'||!Number.isFinite(data[TRIAL])))return 'unknown';if(data[TRIAL]>Date.now())return 'trial';const workerKind=await requestWorkerStatus();if(workerKind!=='free')return workerKind;return localKind;}catch{return 'unknown';}}
async function dismiss(forever){const data=await chrome.storage.local.get(CAMPAIGN);await chrome.storage.local.set({[CAMPAIGN]:{...(data[CAMPAIGN]||{}),dismissedAt:Date.now(),hidden:forever===true}});}
root.ZovoSubscriptionMembership={LICENSE,CAMPAIGN,PRODUCT,CARD,classify,subscriptionKind,read,dismiss,MEMBER,RECOVERY,TRIAL,PORT};
})(globalThis);
