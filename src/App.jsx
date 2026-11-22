import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Activity,Bell,BookOpen,Check,CircleHelp,Download,LayoutDashboard,Plus,Search,ShieldCheck,Store,Users,Wallet,X,Wifi,WifiOff} from 'lucide-react';
import {addCustomer,listCustomers,addLedgerEntry,listPaymentReminders,addPaymentReminder,updatePaymentReminder,syncOfflineLedgerDraft,listPendingCustomerClaims,reviewCustomerLinkClaim,createCustomerLinkInvite} from './lib/customerService';
import {saveOfflineLedgerDraft,listOfflineLedgerDrafts,removeOfflineLedgerDraft} from './lib/offlineQueue';
import {calculateLedgerBalance,summarizeLedger} from './lib/ledgerMath';
import {isCurrentScope,filterDraftsForScope} from './lib/sessionGuards';
const sample=[{id:'d1',display_name:'राम प्रसाद',phone:'98•••••421',notes:''},{id:'d2',display_name:'सीता देवी',phone:'98•••••815',notes:''},{id:'d3',display_name:'मोहन कुमार',phone:'97•••••203',notes:''}];
const money=n=>'रु '+new Intl.NumberFormat('en-IN').format(n||0);
const initials=n=>(n||'?').trim().slice(0,2);
const phoneView=p=>p?p.replace(/(\d{2})\d+(\d{2})$/,'$1••••$2'):'फोन नहीं दिया';
export default function App({mode='demo',user=null}){
 const demo=mode!=='live';
 const currentScopeRef=useRef({userId:user?.id||null,shopId:null,demo});
 const [customers,setCustomers]=useState(()=>{if(!demo)return [];try{return JSON.parse(localStorage.getItem('gtn-demo-customers'))||sample}catch{return sample}});
 const [shop,setShop]=useState(null),[active,setActive]=useState('overview'),[query,setQuery]=useState('');
 const [loadedUserId,setLoadedUserId]=useState(null);
 currentScopeRef.current={userId:user?.id||null,shopId:shop?.id||null,demo};
 const liveDataReady=demo||(Boolean(user?.id)&&loadedUserId===user.id&&Boolean(shop?.id));
 const [entries,setEntries]=useState(()=>{if(!demo)return [];try{return JSON.parse(localStorage.getItem('gtn-demo-entries'))||[]}catch{return []}}),[entryForm,setEntryForm]=useState({type:'credit',amount:'',note:''});
 const [reminders,setReminders]=useState(()=>{if(!demo)return [];try{return JSON.parse(localStorage.getItem('gtn-demo-reminders'))||[]}catch{return []}});
 const [reminderForm,setReminderForm]=useState({dueAt:'',message:'भुगतान की याद दिलाने के लिए संपर्क करें।'});
 const [reportFrom,setReportFrom]=useState('');const [reportTo,setReportTo]=useState('');
 const [modal,setModal]=useState(''),[selected,setSelected]=useState(null),[form,setForm]=useState({name:'',phone:'',notes:''});
 const [claims,setClaims]=useState([]),[claimsLoading,setClaimsLoading]=useState(false),[claimsLoaded,setClaimsLoaded]=useState(false);
 const [inviteResult,setInviteResult]=useState(null),[inviteHours,setInviteHours]=useState(24);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [online,setOnline]=useState(()=>typeof navigator==='undefined'?true:navigator.onLine);const [pendingDrafts,setPendingDrafts]=useState([]);const [syncingDraft,setSyncingDraft]=useState(false);
 useEffect(()=>{const up=()=>setOnline(true),down=()=>setOnline(false);window.addEventListener('online',up);window.addEventListener('offline',down);return()=>{window.removeEventListener('online',up);window.removeEventListener('offline',down)}},[]);
 useEffect(()=>{if(demo){try{localStorage.setItem('gtn-demo-customers',JSON.stringify(customers));localStorage.setItem('gtn-demo-entries',JSON.stringify(entries));localStorage.setItem('gtn-demo-reminders',JSON.stringify(reminders))}catch{};}},[demo,customers,entries,reminders]);
 useLayoutEffect(()=>{
  if(demo){
   try{
    setCustomers(JSON.parse(localStorage.getItem('gtn-demo-customers'))||sample);
    setEntries(JSON.parse(localStorage.getItem('gtn-demo-entries'))||[]);
    setReminders(JSON.parse(localStorage.getItem('gtn-demo-reminders'))||[]);
   }catch{setCustomers(sample);setEntries([]);setReminders([]);}
   setLoadedUserId(null);setShop(null);setPendingDrafts([]);setClaims([]);
   setSelected(null);setModal('');setInviteResult(null);setError('');setNotice('');
   setForm({name:'',phone:'',notes:''});setEntryForm({type:'credit',amount:'',note:''});setReminderForm({dueAt:'',message:'भुगतान की याद दिलाने के लिए संपर्क करें।'});setReportFrom('');setReportTo('');setActive('overview');setBusy(false);setSyncingDraft(false);
   return;
  }
  setLoadedUserId(null);
  setShop(null);setCustomers([]);setEntries([]);setReminders([]);setPendingDrafts([]);
  setClaims([]);setClaimsLoaded(false);setClaimsLoading(false);
  setSelected(null);setModal('');setInviteResult(null);setQuery('');
  setForm({name:'',phone:'',notes:''});setEntryForm({type:'credit',amount:'',note:''});setReminderForm({dueAt:'',message:'भुगतान की याद दिलाने के लिए संपर्क करें।'});setReportFrom('');setReportTo('');setActive('overview');setSyncingDraft(false);
  setError('');setNotice('');setBusy(false);
 },[demo,user?.id]);
 useEffect(()=>{
  if(demo||!user?.id)return;
  let live=true;
  setBusy(true);setError('');
  (async()=>{
   try{
    const customerData=await listCustomers(user.id);
    const [reminderData]=await Promise.all([listPaymentReminders(customerData.shop.id)]);
    if(!live)return;
    setShop(customerData.shop);
    setCustomers(customerData.customers||[]);
    setEntries(customerData.entries||[]);
    setReminders(reminderData||[]);
    setLoadedUserId(user.id);
   }catch(e){
    if(!live)return;
    setShop(null);setCustomers([]);setEntries([]);setReminders([]);setPendingDrafts([]);
    setLoadedUserId(null);
    setError(e.message||'रिकॉर्ड लोड नहीं हुए।');
   }finally{if(live)setBusy(false);}
  })();
  return()=>{live=false};
 },[demo,user?.id]);
 useEffect(()=>{if(demo||!user?.id||!shop?.id)return;let live=true;const scopeUserId=user.id,scopeShopId=shop.id;const stillCurrent=()=>live&&isCurrentLiveScope(scopeUserId,scopeShopId);listOfflineLedgerDrafts(scopeUserId,scopeShopId).then(rows=>{if(stillCurrent())setPendingDrafts(filterDraftsForScope(rows,scopeUserId,scopeShopId))}).catch(e=>{if(stillCurrent())setError(e.message||'ऑफलाइन ड्राफ्ट नहीं पढ़े जा सके।')});return()=>{live=false}},[demo,user?.id,shop?.id]);
 function isCurrentLiveScope(scopeUserId,scopeShopId){
  return isCurrentScope(currentScopeRef.current,{userId:scopeUserId,shopId:scopeShopId});
 }
 async function makeCustomerInvite(){
  if(demo||!online||!user?.id||!shop?.id||!selected?.id)return;
  const scopeUserId=user.id,scopeShopId=shop.id,customerId=selected.id;
  setBusy(true);setError('');setInviteResult(null);
  try{const result=await createCustomerLinkInvite(scopeShopId,customerId,inviteHours);if(!isCurrentLiveScope(scopeUserId,scopeShopId))return;setInviteResult(result);}
  catch(e){if(isCurrentLiveScope(scopeUserId,scopeShopId))setError(e.message||'निमंत्रण कोड नहीं बन पाया।')}
  finally{if(isCurrentLiveScope(scopeUserId,scopeShopId))setBusy(false);}
 }
 async function copyInviteCode(){
  if(!inviteResult?.inviteCode)return;
  try{await navigator.clipboard.writeText(inviteResult.inviteCode);setNotice('निमंत्रण कोड कॉपी हो गया।');}
  catch{setError('कॉपी नहीं हुआ। कोड को दबाकर चुनें और कॉपी करें।')}
 }
 async function refreshClaims(){
  if(demo||!user?.id||!shop?.id||!online){setClaims([]);return;}
  const scopeUserId=user.id,scopeShopId=shop.id;
  setClaimsLoading(true);setError('');
  try{const rows=await listPendingCustomerClaims(scopeShopId);if(!isCurrentLiveScope(scopeUserId,scopeShopId))return;setClaims(rows);setClaimsLoaded(true);}
  catch(e){if(isCurrentLiveScope(scopeUserId,scopeShopId))setError(e.message||'ग्राहक लिंक अनुरोध लोड नहीं हुए।')}
  finally{if(isCurrentLiveScope(scopeUserId,scopeShopId))setClaimsLoading(false);}
 }
 useEffect(()=>{if(active==='claims'&&!demo&&shop?.id&&online)refreshClaims();},[active,demo,shop?.id,online]);
 async function reviewClaim(item,decision){
  if(demo||!online||busy||!user?.id||!shop?.id)return;
  const scopeUserId=user.id,scopeShopId=shop.id;
  const approving=decision==='approved';
  const prompt=approving
   ? 'इस अनुरोध को मंजूर करें? यह केवल दुकानदार की प्रारंभिक रिकॉर्ड-जाँच है। इससे ग्राहक को बैलेंस या लेजर का एक्सेस नहीं मिलेगा। ग्राहक की अलग, स्पष्ट सहमति और पहचान-जाँच अभी भी जरूरी होगी।'
   : 'इस ग्राहक लिंक अनुरोध को अस्वीकार करें?';
  if(!window.confirm(prompt))return;
  setBusy(true);setError('');
  try{
   await reviewCustomerLinkClaim(item.id,decision);
   if(!isCurrentLiveScope(scopeUserId,scopeShopId))return;
   setClaims(old=>old.filter(row=>row.id!==item.id));
   setNotice(approving?'अनुरोध मंजूर हुआ। ग्राहक की सहमति के बिना कोई हिसाब साझा नहीं होगा।':'अनुरोध अस्वीकार हुआ।');
   setTimeout(()=>{if(isCurrentLiveScope(scopeUserId,scopeShopId))setNotice('')},4500);
  }catch(e){if(isCurrentLiveScope(scopeUserId,scopeShopId))setError(e.message||'अनुरोध अपडेट नहीं हुआ।')}
  finally{if(isCurrentLiveScope(scopeUserId,scopeShopId))setBusy(false);}
 }
 
 async function syncPendingDrafts(){
  if(demo||!online||!user?.id||!shop?.id||syncingDraft)return;
  const scopeUserId=user.id,scopeShopId=shop.id;
  setSyncingDraft(true);setError('');setNotice('');
  let synced=0,failed=0;const failureMessages=[];
  const stillSameScope=()=>!currentScopeRef.current.demo&&currentScopeRef.current.userId===scopeUserId&&currentScopeRef.current.shopId===scopeShopId;
  try{
   const storedDrafts=await listOfflineLedgerDrafts(scopeUserId,scopeShopId);
   if(!stillSameScope())return;
   const drafts=filterDraftsForScope(storedDrafts,scopeUserId,scopeShopId);
   setPendingDrafts(drafts);
   for(const draft of drafts){
    if(!stillSameScope())break;
    try{
     const result=await syncOfflineLedgerDraft(scopeShopId,scopeUserId,draft);
     const removed=await removeOfflineLedgerDraft(draft.id,scopeUserId,scopeShopId);
     if(!removed)throw new Error('ड्राफ्ट की दुकान/लॉगिन जाँच पूरी नहीं हुई। ड्राफ्ट सुरक्षित रखा गया है।');
     if(!stillSameScope())break;
     setPendingDrafts(old=>old.filter(x=>x.id!==draft.id));
     setEntries(old=>old.some(x=>x.client_ref===draft.id||x.id===result.row.id)?old:[result.row,...old]);
     synced++;
    }catch(err){
     failed++;
     failureMessages.push(err.message||'कारण उपलब्ध नहीं');
     // Keep this draft pending and continue with the remaining independent drafts.
    }
   }
   if(!stillSameScope())return;
   if(synced)setNotice(synced+' ऑफलाइन लेन-देन सर्वर से सिंक हुए।');
   if(failed)setError(failed+' ड्राफ्ट अभी सिंक नहीं हुए और सुरक्षित रखे गए हैं। '+failureMessages.slice(0,2).join(' | '));
   if(!failed&&!synced)setNotice('सिंक करने के लिए कोई नया ड्राफ्ट नहीं मिला।');
  }catch(err){
   if(stillSameScope())setError(err.message||'ड्राफ्ट सिंक नहीं हो सके।');
  }finally{
   if(stillSameScope())setSyncingDraft(false);
  }
 }
 const filtered=useMemo(()=>customers.filter(c=>(c.display_name||'').toLowerCase().includes(query.toLowerCase())||(c.phone||'').includes(query)),[customers,query]);
 const reportEntries=useMemo(()=>entries.filter(x=>{const t=new Date(x.created_at).getTime();const from=reportFrom?new Date(reportFrom+'T00:00:00').getTime():-Infinity;const to=reportTo?new Date(reportTo+'T23:59:59.999').getTime():Infinity;return t>=from&&t<=to}),[entries,reportFrom,reportTo]);
 const reportTotals=useMemo(()=>summarizeLedger(reportEntries),[reportEntries]);
 const scopedPendingDrafts=useMemo(()=>filterDraftsForScope(pendingDrafts,user?.id,shop?.id),[pendingDrafts,user?.id,shop?.id]);
 function exportReport(){const rows=[['तारीख','ग्राहक','प्रकार','रकम','नोट'],...reportEntries.map(x=>[new Date(x.created_at).toLocaleString('hi-IN'),customers.find(c=>c.id===x.customer_id)?.display_name||'ग्राहक',x.entry_type==='credit'?'उधार':x.entry_type==='payment'?'जमा':'रिवर्सल',x.amount,x.note||''])];const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='global-trust-ledger-report.csv';a.click();URL.revokeObjectURL(url);setNotice('हिसाब रिपोर्ट डाउनलोड हो गई।');setTimeout(()=>setNotice(''),3500)}
 async function saveEntry(e){
  e.preventDefault();const amount=Number(entryForm.amount);
  if(!selected?.id||!Number.isFinite(amount)||amount<=0)return setError('सही रकम लिखें।');
  const scopeUserId=user?.id||null,scopeShopId=shop?.id||null,customerId=selected.id;
  const stillCurrent=()=>demo||isCurrentLiveScope(scopeUserId,scopeShopId);
  if(!demo&&!online){
   if(!scopeUserId||!scopeShopId)return setError('ऑफलाइन ड्राफ्ट के लिए लॉगिन और दुकान की जानकारी जरूरी है।');
   try{
    await saveOfflineLedgerDraft({userId:scopeUserId,shopId:scopeShopId,customerId,type:entryForm.type,amount,note:entryForm.note||''});
    if(!stillCurrent())return;
    const drafts=await listOfflineLedgerDrafts(scopeUserId,scopeShopId);
    if(!stillCurrent())return;
    setPendingDrafts(drafts);setNotice('लेन-देन ऑफलाइन ड्राफ्ट में सेव हुआ। इंटरनेट लौटने पर इसे सिंक करना बाकी है।');
    setModal('detail');setEntryForm({type:'credit',amount:'',note:''});setError('');
   }catch(err){if(stillCurrent())setError(err.message||'ऑफलाइन ड्राफ्ट सेव नहीं हुआ।')}
   return;
  }
  setBusy(true);setError('');
  try{
   let row;
   if(demo){
    row={id:'de'+Date.now(),customer_id:customerId,entry_type:entryForm.type,amount,note:entryForm.note,created_at:new Date().toISOString()};
    setEntries(old=>{const next=[row,...old];try{localStorage.setItem('gtn-demo-entries',JSON.stringify(next))}catch{}return next});
    setNotice('डेमो लेन-देन डिवाइस पर सेव हुआ।');
   }else{
    if(!scopeUserId||!scopeShopId)throw Error('लॉगिन या दुकान की जानकारी नहीं मिली।');
    row=await addLedgerEntry(scopeShopId,scopeUserId,customerId,entryForm);
    if(!stillCurrent())return;
    setEntries(old=>[row,...old]);setNotice('लेन-देन डेटाबेस में सेव हुआ।');
   }
   if(!stillCurrent())return;
   setModal('detail');setEntryForm({type:'credit',amount:'',note:''});
   setTimeout(()=>{if(stillCurrent())setNotice('')},3500);
  }catch(e){if(stillCurrent())setError(e.message||'सेव नहीं हुआ।')}
  finally{if(stillCurrent())setBusy(false)}
 }
 async function saveReminder(e){
  e.preventDefault();if(!selected?.id)return;
  if(!demo&&!online)return setError('रिमाइंडर सेव करने के लिए इंटरनेट चाहिए।');
  const scopeUserId=user?.id||null,scopeShopId=shop?.id||null,customerId=selected.id;
  const stillCurrent=()=>demo||isCurrentLiveScope(scopeUserId,scopeShopId);
  setBusy(true);setError('');
  try{
   let row;
   if(demo){
    const dt=new Date(reminderForm.dueAt);
    if(!Number.isFinite(dt.getTime())||dt.getTime()<=Date.now())throw Error('भविष्य की तारीख और समय चुनें।');
    row={id:'dr'+Date.now(),customer_id:customerId,due_at:dt.toISOString(),message:reminderForm.message,status:'pending',created_at:new Date().toISOString()};
   }else{
    if(!scopeUserId||!scopeShopId)throw Error('लॉगिन या दुकान की जानकारी नहीं मिली।');
    row=await addPaymentReminder(scopeShopId,scopeUserId,customerId,reminderForm);
    if(!stillCurrent())return;
   }
   if(!stillCurrent())return;
   setReminders(old=>[row,...old]);setModal('detail');setNotice('भुगतान रिमाइंडर सेव हो गया।');
   setTimeout(()=>{if(stillCurrent())setNotice('')},3500);
  }catch(e){if(stillCurrent())setError(e.message||'रिमाइंडर सेव नहीं हुआ।')}
  finally{if(stillCurrent())setBusy(false)}
 }
 async function finishReminder(item){
  const scopeUserId=user?.id||null,scopeShopId=shop?.id||null;
  const stillCurrent=()=>demo||isCurrentLiveScope(scopeUserId,scopeShopId);
  try{
   if(!demo){
    if(!scopeUserId||!scopeShopId)return;
    await updatePaymentReminder(item.id,'completed');
    if(!stillCurrent())return;
   }
   setReminders(old=>old.map(x=>x.id===item.id?{...x,status:'completed',completed_at:new Date().toISOString()}:x));
   setNotice('रिमाइंडर पूरा चिह्नित हुआ।');
  }catch(e){if(stillCurrent())setError(e.message||'अपडेट नहीं हुआ।')}
 }
 async function save(e){
  e.preventDefault();if(!demo&&!online)return setError('इंटरनेट वापस आने पर ही लाइव ग्राहक रिकॉर्ड सेव होगा।');
  if(!form.name.trim())return;
  const scopeUserId=user?.id||null,scopeShopId=shop?.id||null;
  const stillCurrent=()=>demo||isCurrentLiveScope(scopeUserId,scopeShopId);
  setBusy(true);setError('');
  try{
   let row;
   if(demo)row={...form,id:'d'+Date.now(),display_name:form.name.trim(),created_at:new Date().toISOString()};
   else{
    if(!scopeShopId||!scopeUserId)throw Error('दुकान या लॉगिन जानकारी नहीं मिली।');
    row=await addCustomer(scopeShopId,scopeUserId,form);
    if(!stillCurrent())return;
   }
   if(!stillCurrent())return;
   setCustomers(old=>[row,...old]);setNotice(demo?'डेमो रिकॉर्ड इसी डिवाइस पर सेव हुआ।':'ग्राहक रिकॉर्ड डेटाबेस में सेव हो गया।');
   setForm({name:'',phone:'',notes:''});setModal('');
   setTimeout(()=>{if(stillCurrent())setNotice('')},3500);
  }catch(e){if(stillCurrent())setError(e.message||'सेव नहीं हुआ।')}
  finally{if(stillCurrent())setBusy(false)}
 }
 return <div className="app-shell"><aside className="sidebar">
 <div className="brand"><div className="brand-mark"><ShieldCheck size={23}/></div><div><b>GLOBAL TRUST</b><span>NETWORK</span></div></div>
 <div className="workspace"><div className="shop-icon"><Store size={18}/></div><div><b>{shop?.shop_name||'अपनी दुकान'}</b><small>दुकानदार डैशबोर्ड</small></div></div>
 <p className="nav-label">मुख्य मेन्यू</p><nav>
 <button className={'nav-item '+(active==='overview'?'active':'')} onClick={()=>setActive('overview')}><LayoutDashboard/>ओवरव्यू</button>
 <button className={'nav-item '+(active==='customers'?'active':'')} onClick={()=>setActive('customers')}><Users/>ग्राहक और खाते</button>
 <button className={'nav-item '+(active==='activity'?'active':'')} onClick={()=>setActive('activity')}><Activity/>लेन-देन इतिहास</button><button className={'nav-item '+(active==='reports'?'active':'')} onClick={()=>setActive('reports')}><Download/>रिपोर्ट और निर्यात</button><button className={'nav-item '+(active==='reminders'?'active':'')} onClick={()=>setActive('reminders')}><Bell/>भुगतान रिमाइंडर</button><button className={'nav-item '+(active==='claims'?'active':'')} onClick={()=>setActive('claims')}><Users/>ग्राहक लिंक अनुरोध</button><button className={'nav-item '+(active==='pending'?'active':'')} onClick={()=>setActive('pending')}><WifiOff/>ऑफलाइन ड्राफ्ट {scopedPendingDrafts.length?`(${scopedPendingDrafts.length})`:''}</button></nav>
 <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={19}/><b>आपका डेटा, आपका नियंत्रण</b><p>ग्राहक की अनुमति के बिना निजी हिसाब साझा नहीं होगा।</p></div><button className="nav-item"><CircleHelp/>मदद और सहायता</button><div className="profile"><div className="avatar owner">दु</div><div><b>{user?.email||'दुकान मालिक'}</b><small>{demo?'डेमो अकाउंट':'सुरक्षित लॉगिन'}</small></div></div></div></aside>
 <main className="main"><header className="topbar"><div className="breadcrumb">दुकान <span>/</span> {active==='overview'?'ओवरव्यू':active==='customers'?'ग्राहक और खाते':active==='reminders'?'भुगतान रिमाइंडर':active==='reports'?'रिपोर्ट और निर्यात':active==='pending'?'ऑफलाइन ड्राफ्ट':active==='claims'?'ग्राहक लिंक अनुरोध':'लेन-देन इतिहास'}</div><div className="top-actions"><span className="demo-pill"><span/>{demo?'डेमो मोड':'लाइव खाता'}</span><span className={'connection-pill '+(online?'is-online':'is-offline')}>{online?<Wifi size={13}/>:<WifiOff size={13}/>}{online?'ऑनलाइन':'ऑफलाइन'}</span><button className="icon-btn"><Bell size={19}/></button></div></header>
 <section className="content">{!online&&<div className="network-banner" role="status"><WifiOff size={17}/><div><b>इंटरनेट कनेक्शन उपलब्ध नहीं है</b><small>{demo?'डेमो डेटा इसी डिवाइस पर उपलब्ध रहेगा।':'लाइव डेटा सर्वर से नहीं खुलेगा। नया लेन-देन करने से पहले कनेक्शन लौटने दें।'}</small></div></div>}{!liveDataReady?<div className="no-results" role="status">{user?.id?'नई दुकान और उसके रिकॉर्ड की पुष्टि हो रही है…':'लाइव रिकॉर्ड देखने के लिए सुरक्षित लॉगिन जरूरी है।'}</div>:<><div className="welcome-row"><div><div className="eyebrow">ग्राहक रिकॉर्ड</div><h1>{active==='overview'?'नमस्ते, आपका हिसाब तैयार है।':active==='customers'?'ग्राहक और खाते':active==='reminders'?'भुगतान रिमाइंडर':active==='reports'?'रिपोर्ट और निर्यात':active==='pending'?'ऑफलाइन ड्राफ्ट':active==='claims'?'ग्राहक लिंक अनुरोध':'लेन-देन इतिहास'}</h1><p className="subtitle">अपनी दुकान के ग्राहक रिकॉर्ड सुरक्षित रूप से संभालें।</p></div><button className="primary-btn" onClick={()=>{setError('');setModal('add')}}><Plus size={18}/> ग्राहक जोड़ें</button></div>
 {error&&<div className="auth-message" role="alert">{error}</div>}
 {active==='claims'&&<div className="table-card reminder-card"><div className="reminder-heading"><h2>ग्राहक खाते जोड़ने के अनुरोध</h2><p>यह सूची केवल आपकी दुकान के लंबित अनुरोध दिखाती है। फोन नंबर आंशिक रूप से छिपा है।</p></div>{demo?<div className="no-results">डेमो मोड में वास्तविक ग्राहक अनुरोध उपलब्ध नहीं हैं। सुरक्षित लाइव खाते में लॉगिन करें।</div>:!online?<div className="no-results">अनुरोध देखने के लिए इंटरनेट कनेक्शन जरूरी है।</div>:<><div className="toolbar"><span className="result-count">{claims.length} लंबित अनुरोध</span><button className="secondary-btn" onClick={refreshClaims} disabled={claimsLoading||busy}>{claimsLoading?'लोड हो रहा है…':'रिफ्रेश करें'}</button></div>{claimsLoading&&!claimsLoaded?<div className="no-results">अनुरोध लोड हो रहे हैं…</div>:claims.map(item=><div className="reminder-row" key={item.id}><div><b>{item.customer?.displayName||'ग्राहक रिकॉर्ड'}</b><small>फोन: {item.customer?.phoneMasked||'उपलब्ध नहीं'}</small><p>अनुरोध मिला: {new Date(item.submittedAt).toLocaleString('hi-IN')}</p><small>स्थिति: दुकानदार की जाँच बाकी</small></div><div className="toolbar"><button className="secondary-btn" onClick={()=>reviewClaim(item,'rejected')} disabled={busy}>अस्वीकार</button><button className="primary-btn" onClick={()=>reviewClaim(item,'approved')} disabled={busy||!item.customer}>मंजूर करें</button></div></div>)}{!claimsLoading&&claimsLoaded&&!claims.length&&<div className="no-results">अभी कोई लंबित अनुरोध नहीं है।</div>}<div className="auth-message">मंजूरी केवल दुकानदार की प्रारंभिक रिकॉर्ड-जाँच है। ग्राहक की पहचान और अलग, स्पष्ट सहमति की प्रक्रिया पूरी होने तक कोई बैलेंस, लेजर या अन्य निजी हिसाब साझा नहीं होगा।</div></>}</div>}{active==='pending'&&<div className="table-card reminder-card"><div className="reminder-heading"><h2>सिंक होने की प्रतीक्षा में</h2><p>ये ड्राफ्ट सिर्फ इस लॉगिन और दुकान के हैं। सर्वर पर सफल पुष्टि मिलने के बाद ही डिवाइस से हटेंगे।</p></div><div className="toolbar"><span className="result-count">{scopedPendingDrafts.length} बाकी ड्राफ्ट</span><button className="primary-btn" onClick={syncPendingDrafts} disabled={!online||demo||syncingDraft||!scopedPendingDrafts.length}>{syncingDraft?'सिंक हो रहा है…':'सभी सिंक करें'}</button></div>{scopedPendingDrafts.map(d=><div className="reminder-row" key={d.id}><div><b>{customers.find(c=>c.id===d.customerId)?.display_name||'ग्राहक रिकॉर्ड'}</b><small>{new Date(d.createdAt).toLocaleString('hi-IN')}</small><p>{d.type==='credit'?'उधार':'जमा'} · {money(d.amount)}{d.note?' · '+d.note:''}</p><small>स्थिति: सिंक बाकी</small></div><button className="secondary-btn" onClick={async()=>{if(!online||syncingDraft||!user?.id||!shop?.id)return;const scopeUserId=user.id,scopeShopId=shop.id;const stillSameScope=()=>!currentScopeRef.current.demo&&currentScopeRef.current.userId===scopeUserId&&currentScopeRef.current.shopId===scopeShopId;if(d.userId!==scopeUserId||d.shopId!==scopeShopId||!stillSameScope())return;setSyncingDraft(true);setError('');try{const result=await syncOfflineLedgerDraft(scopeShopId,scopeUserId,d);const removed=await removeOfflineLedgerDraft(d.id,scopeUserId,scopeShopId);if(!removed)throw new Error('ड्राफ्ट की दुकान/लॉगिन जाँच पूरी नहीं हुई। ड्राफ्ट सुरक्षित रखा गया है।');if(!stillSameScope())return;setPendingDrafts(old=>old.filter(x=>x.id!==d.id));setEntries(old=>[result.row,...old.filter(x=>x.id!==result.row.id)]);setNotice('ड्राफ्ट सर्वर से सिंक हो गया।')}catch(err){if(stillSameScope())setError(err.message||'ड्राफ्ट सिंक नहीं हुआ। इसे सुरक्षित रखा गया है।')}finally{if(stillSameScope())setSyncingDraft(false)}}} disabled={!online||demo||syncingDraft}>अभी सिंक करें</button></div>)}{!scopedPendingDrafts.length&&<div className="no-results">कोई लंबित ऑफलाइन ड्राफ्ट नहीं है।</div>}{!online&&<div className="no-results">सिंक करने के लिए इंटरनेट कनेक्शन जरूरी है।</div>}</div>}{active==='overview'&&<><div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>कुल ग्राहक</span><div className="stat-icon indigo"><Users/></div></div><strong>{customers.length}</strong><small className="muted">इस दुकान के रिकॉर्ड</small></div><div className="stat-card"><div className="stat-top"><span>रिकॉर्ड स्थिति</span><div className="stat-icon green"><Check/></div></div><strong>{busy?'…':'तैयार'}</strong><small className="positive"><Activity size={13}/>{demo?'डिवाइस पर सेव':'डेटाबेस से लोड'}</small></div><div className="stat-card"><div className="stat-top"><span>डेटा मोड</span><div className="stat-icon gold"><ShieldCheck/></div></div><strong>{demo?'डेमो':'लाइव'}</strong><small className="muted">दुकान के अनुसार अलग रिकॉर्ड</small></div></div><div className="section-heading"><div><h2>ग्राहक रिकॉर्ड</h2><p>नाम, संपर्क और नोट्स देखें।</p></div><button className="text-btn" onClick={()=>setActive('customers')}>सभी ग्राहक देखें →</button></div><CustomerTable customers={filtered} select={c=>{setSelected(c);setModal('detail')}}/></>}
 {active==='customers'&&<><div className="toolbar"><div className="searchbox"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="नाम या फोन खोजें..."/></div><span className="result-count">{filtered.length} ग्राहक</span></div><CustomerTable customers={filtered} select={c=>{setSelected(c);setModal('detail')}}/></>}
 {active==='reminders'&&<div className="table-card reminder-card"><div className="reminder-heading"><h2>भुगतान की यादें</h2><p>तारीख के अनुसार आपकी दुकान के रिमाइंडर।</p></div>{[...reminders].sort((a,b)=>new Date(a.due_at)-new Date(b.due_at)).map(item=><div className="reminder-row" key={item.id}><div><b>{customers.find(c=>c.id===item.customer_id)?.display_name||'ग्राहक'}</b><small>{new Date(item.due_at).toLocaleString('hi-IN')}</small><p>{item.message||'कोई नोट नहीं'}</p><small>स्थिति: {item.status==='completed'?'पूरा':item.status==='cancelled'?'रद्द':new Date(item.due_at).getTime()<Date.now()?'समय निकल गया':'बाकी'}</small></div>{item.status==='pending'&&<button className="secondary-btn" onClick={()=>finishReminder(item)}>पूरा करें</button>}</div>)}{!reminders.length&&<div className="no-results">अभी कोई रिमाइंडर नहीं है। ग्राहक के विवरण से नया रिमाइंडर बनाएँ।</div>}</div>}{active==='reports'&&<><div className="table-card"><div className="reminder-heading"><h2>रिपोर्ट की अवधि चुनें</h2><p>तारीख चुनने से नीचे के आँकड़े और CSV उसी अवधि के होंगे।</p></div><div className="toolbar"><label>शुरू <input className="form-input" type="date" value={reportFrom} max={reportTo||undefined} onChange={e=>setReportFrom(e.target.value)}/></label><label>अंत <input className="form-input" type="date" value={reportTo} min={reportFrom||undefined} onChange={e=>setReportTo(e.target.value)}/></label><button className="secondary-btn" onClick={()=>{setReportFrom('');setReportTo('')}}>सभी तारीखें</button></div></div><div className="stats-grid"><div className="stat-card"><div className="stat-top"><span>कुल उधार</span><div className="stat-icon gold"><Wallet/></div></div><strong>{money(reportTotals.credit/100)}</strong><small className="muted">चुनी अवधि में</small></div><div className="stat-card"><div className="stat-top"><span>कुल जमा</span><div className="stat-icon green"><Check/></div></div><strong>{money(reportTotals.payment/100)}</strong><small className="muted">चुनी अवधि में</small></div><div className="stat-card"><div className="stat-top"><span>नेट अंतर</span><div className="stat-icon indigo"><Activity/></div></div><strong>{money(reportTotals.balance/100)}</strong><small className="muted">इस अवधि का उधार घटा जमा</small></div></div><div className="table-card"><div className="reminder-heading"><h2>ग्राहक के अनुसार हिसाब</h2><p>चुनी अवधि में दर्ज लेन-देन का सारांश।</p></div><div className="table-wrap"><table><thead><tr><th>ग्राहक</th><th>उधार</th><th>जमा</th><th>अंतर</th></tr></thead><tbody>{customers.map(customer=>{const list=reportEntries.filter(x=>x.customer_id===customer.id);const totals=summarizeLedger(list);const cr=totals.credit;const pay=totals.payment;return <tr key={customer.id}><td>{customer.display_name}</td><td>{money(cr/100)}</td><td>{money(pay/100)}</td><td>{money(totals.balance/100)}</td></tr>})}</tbody></table>{!reportEntries.length&&<div className="no-results">इस अवधि में कोई लेन-देन नहीं मिला।</div>}</div></div><div className="table-card"><div className="reminder-heading"><h2>हिसाब रिपोर्ट डाउनलोड</h2><p>{reportEntries.length} लेन-देन चुने गए हैं।</p></div><button className="primary-btn" onClick={exportReport} disabled={!reportEntries.length}><Download size={17}/> CSV रिपोर्ट डाउनलोड करें</button></div></>}{active==='activity'&&<div className="table-card"><div className="table-wrap"><table><thead><tr><th>ग्राहक</th><th>प्रकार</th><th>रकम</th><th>तारीख</th></tr></thead><tbody>{entries.map(x=><tr key={x.id}><td>{customers.find(c=>c.id===x.customer_id)?.display_name||'ग्राहक'}</td><td>{x.entry_type==='credit'?'उधार':x.entry_type==='payment'?'जमा':'रिवर्सल'}</td><td>{money(x.amount)}</td><td>{new Date(x.created_at).toLocaleString('hi-IN')}</td></tr>)}</tbody></table>{!entries.length&&<div className="no-results">अभी कोई लेन-देन नहीं है।</div>}</div></div>}
 <footer>© 2026 Global Trust Network <span>सुरक्षित हिसाब • स्पष्ट भरोसा</span></footer></>}</section></main>
 {notice&&<div className="toast"><Check size={17}/>{notice}</div>}
 {modal&&liveDataReady&&<div className="modal-backdrop" onClick={()=>setModal('')}><div className="modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={()=>setModal('')} aria-label="बंद करें"><X size={17}/></button>
 {modal==='invite'?<><div className="modal-symbol"><Users/></div><h2>ग्राहक लिंक निमंत्रण</h2><p className="modal-sub">यह एक बार इस्तेमाल होने वाला कोड है। इससे अभी कोई बैलेंस या लेन-देन साझा नहीं होगा।</p>{!inviteResult?<><label>कोड कितने घंटे मान्य रहे?</label><select className="form-input" value={inviteHours} onChange={e=>setInviteHours(Number(e.target.value))}><option value={1}>1 घंटा</option><option value={6}>6 घंटे</option><option value={24}>24 घंटे</option><option value={48}>48 घंटे</option><option value={72}>72 घंटे</option></select><button className="primary-btn full" disabled={busy||demo||!online} onClick={makeCustomerInvite}>{busy?'कोड बन रहा है…':'एक बार का कोड बनाएँ'}</button></>:<><div className="auth-message" role="status">कोड बन गया। इसे ग्राहक को सुरक्षित तरीके से दें। यह स्क्रीन बंद करने के बाद दोबारा नहीं दिखेगा।</div><div className="invite-code" style={{fontSize:'1.1rem',fontWeight:700,overflowWrap:'anywhere',padding:'14px',background:'var(--surface, #f3f5f7)',borderRadius:'10px',userSelect:'all'}}>{inviteResult.inviteCode}</div><p className="modal-sub">समाप्ति: {new Date(inviteResult.expiresAt).toLocaleString('hi-IN')}</p><button className="primary-btn full" onClick={copyInviteCode}>कोड कॉपी करें</button></>}</>:modal==='reminder'?<><div className="modal-symbol"><Bell/></div><h2>भुगतान रिमाइंडर</h2><p className="modal-sub">{selected?.display_name} के लिए याद दिलाने की तारीख चुनें। संदेश अपने आप नहीं भेजा जाएगा।</p><form onSubmit={saveReminder}><label>तारीख और समय *</label><input className="form-input" type="datetime-local" required min={new Date(Date.now()+60000).toISOString().slice(0,16)} value={reminderForm.dueAt} onChange={e=>setReminderForm({...reminderForm,dueAt:e.target.value})}/><label>नोट</label><textarea className="form-input" rows="3" maxLength="250" value={reminderForm.message} onChange={e=>setReminderForm({...reminderForm,message:e.target.value})}/><button className="primary-btn full" disabled={busy}>रिमाइंडर सेव करें</button></form></>:modal==='statement'?<><div className="statement-head"><div className="brand-mark"><ShieldCheck size={20}/></div><h2>ग्राहक हिसाब विवरण</h2><p>{selected?.display_name} · {new Date().toLocaleDateString('hi-IN')}</p></div><div className="statement-summary"><span>कुल बाकी</span><b>{money(calculateLedgerBalance(entries.filter(x=>x.customer_id===selected?.id))/100)}</b></div><div className="statement-list"><table><thead><tr><th>तारीख</th><th>विवरण</th><th>रकम</th><th>बाकी</th></tr></thead><tbody>{(()=>{let balance=0;return [...entries].filter(x=>x.customer_id===selected?.id).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(x=>{balance+=x.entry_type==='credit'?Number(x.amount):-Number(x.amount);return <tr key={x.id}><td>{new Date(x.created_at).toLocaleDateString('hi-IN')}</td><td>{x.entry_type==='credit'?'उधार':'जमा'}{x.note?' · '+x.note:''}</td><td>{money(x.amount)}</td><td>{money(balance)}</td></tr>})})()}</tbody></table>{!entries.some(x=>x.customer_id===selected?.id)&&<p className="no-results">अभी कोई लेन-देन दर्ज नहीं है।</p>}</div><div className="statement-actions"><button className="secondary-btn" onClick={()=>window.print()}>रसीद प्रिंट / PDF</button><button className="primary-btn" onClick={()=>setModal('detail')}>वापस</button></div></>:modal==='entry'?<><div className="modal-symbol"><Wallet/></div><h2>{entryForm.type==='credit'?'उधार दर्ज करें':'जमा दर्ज करें'}</h2><form onSubmit={saveEntry}><label>रकम (रु) *</label><input className="form-input" type="number" min="0.01" step="0.01" required value={entryForm.amount} onChange={e=>setEntryForm({...entryForm,amount:e.target.value})}/><label>नोट (वैकल्पिक)</label><textarea className="form-input" rows="2" maxLength="300" value={entryForm.note} onChange={e=>setEntryForm({...entryForm,note:e.target.value})}/><button className="primary-btn full" disabled={busy}>लेन-देन सेव करें</button></form></>:modal==='add'?<><div className="modal-symbol"><Users/></div><h2>नया ग्राहक रिकॉर्ड</h2><p className="modal-sub">केवल जरूरी जानकारी भरें। फोन और नोट वैकल्पिक हैं।</p><form onSubmit={save}><label>ग्राहक का नाम *</label><input className="form-input" required maxLength="80" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="नाम लिखें"/><label>फोन नंबर (वैकल्पिक)</label><input className="form-input" maxLength="20" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="फोन नंबर"/><label>नोट (वैकल्पिक)</label><textarea className="form-input" rows="3" maxLength="500" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="संवेदनशील निजी जानकारी न लिखें"/><button className="primary-btn full" disabled={busy}>{busy?'सेव हो रहा है…':'ग्राहक सेव करें'}</button></form></>:<><div className="avatar large">{initials(selected?.display_name)}</div><h2>{selected?.display_name}</h2><p className="modal-sub">ग्राहक हिसाब</p><div className="detail-balance"><small>बाकी हिसाब</small><strong>{money(calculateLedgerBalance(entries.filter(x=>x.customer_id===selected?.id))/100)}</strong><small>फोन: {phoneView(selected?.phone)}</small></div><div className="type-switch"><button className="chosen" onClick={()=>{setEntryForm({type:'credit',amount:'',note:''});setModal('entry')}}>उधार जोड़ें</button><button className="chosen payment" onClick={()=>{setEntryForm({type:'payment',amount:'',note:''});setModal('entry')}}>जमा जोड़ें</button></div>{entries.filter(x=>x.customer_id===selected?.id).map(x=><div className="ledger-row" key={x.id}><span>{x.entry_type==='credit'?'उधार':'जमा'}</span><b>{money(x.amount)}</b></div>)}<button className="secondary-btn full" onClick={()=>{setInviteResult(null);setInviteHours(24);setModal('invite')}} disabled={demo||!online}>ग्राहक लिंक निमंत्रण बनाएँ</button><button className="secondary-btn full" onClick={()=>setModal('statement')}>पूरा हिसाब / रसीद देखें</button><button className="secondary-btn full" onClick={()=>{setReminderForm({dueAt:'',message:'भुगतान की याद दिलाने के लिए संपर्क करें।'});setModal('reminder')}}>भुगतान रिमाइंडर बनाएँ</button><button className="primary-btn full" onClick={()=>setModal('')}>बंद करें</button></>}
 <p className="demo-note">{demo?'डेमो रिकॉर्ड केवल इस डिवाइस पर सेव होता है।':'लाइव रिकॉर्ड दुकान के सुरक्षित डेटाबेस में सेव होता है।'}</p></div></div>}</div>
}
function CustomerTable({customers,select}){return <div className="table-card"><div className="table-wrap"><table><thead><tr><th>ग्राहक</th><th>फोन</th><th>रिकॉर्ड</th><th></th></tr></thead><tbody>{customers.map(c=><tr key={c.id}><td><button className="customer-cell" onClick={()=>select(c)}><span className="avatar mint">{initials(c.display_name)}</span><span><b>{c.display_name}</b><small>ग्राहक</small></span></button></td><td className="last-seen">{phoneView(c.phone)}</td><td><span className="status clear">सेव</span></td><td><button className="row-action" onClick={()=>select(c)}>विवरण देखें</button></td></tr>)}</tbody></table>{!customers.length&&<div className="no-results">अभी कोई ग्राहक नहीं है। “ग्राहक जोड़ें” दबाएँ।</div>}</div><div className="table-foot"><span>{customers.length} ग्राहक रिकॉर्ड</span><span>नाम और फोन से खोज सकते हैं</span></div></div>}
