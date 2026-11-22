export function centsOf(value) {
 const raw=String(value ?? '');
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(raw)) throw new Error('रकम में अधिकतम दो दशमलव होने चाहिए।');
 const [whole,frac='']=raw.split('.');
 const cents=Number(whole)*100+Number((frac+'00').slice(0,2));
 if(!Number.isSafeInteger(cents)) throw new Error('रकम सुरक्षित गणना सीमा से बाहर है।');
 return cents;
}
function signedCents(entry){
 const amount=centsOf(entry.amount);
 if(amount<=0) throw new Error('लेन-देन की रकम शून्य से अधिक होनी चाहिए।');
 if(entry.entry_type==='credit') return amount;
 if(entry.entry_type==='payment') return -amount;
 throw new Error('लेन-देन प्रकार समर्थित नहीं है।');
}
export function calculateLedgerBalance(entries){
 const byId=new Map(entries.map(x=>[x.id,x]));
 let balance=0;
 for(const entry of entries){
  if(entry.entry_type==='reversal'){
   const original=byId.get(entry.corrects_entry_id);
   if(!original||original.id===entry.id||original.entry_type==='reversal') throw new Error('रिवर्सल का मूल लेन-देन नहीं मिला।');
   const originalSigned=signedCents(original);
   if(centsOf(entry.amount)!==Math.abs(originalSigned)) throw new Error('रिवर्सल की रकम मूल लेन-देन से मेल नहीं खाती।');
   balance-=originalSigned;
  }else balance+=signedCents(entry);
 }
 return balance;
}
export function summarizeLedger(entries){
 let credit=0,payment=0,reversal=0;
 const byId=new Map(entries.map(x=>[x.id,x]));
 for(const entry of entries){
  if(entry.entry_type==='credit') credit+=centsOf(entry.amount);
  else if(entry.entry_type==='payment') payment+=centsOf(entry.amount);
  else if(entry.entry_type==='reversal'){
   const original=byId.get(entry.corrects_entry_id);
   if(!original||original.entry_type==='reversal') throw new Error('रिवर्सल का मूल लेन-देन नहीं मिला।');
   const signed=signedCents(original);
   if(centsOf(entry.amount)!==Math.abs(signed)) throw new Error('रिवर्सल की रकम मूल लेन-देन से मेल नहीं खाती।');
   reversal-=signed;
  }else throw new Error('लेन-देन प्रकार समर्थित नहीं है।');
 }
 return {credit,payment,reversal,balance:credit-payment+reversal};
}
