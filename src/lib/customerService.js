import { supabase } from './supabase';
export async function listCustomers() {
 if (!supabase) throw new Error('Supabase कनेक्ट नहीं है।');
 const {data:shops,error:se}=await supabase.from('shops').select('id,shop_name').order('created_at').limit(1);
 if(se) throw se; if(!shops?.length) throw new Error('इस खाते की दुकान नहीं मिली। Supabase migration और दुकान रिकॉर्ड जाँचें।');
 const shop=shops[0];
 const {data,error}=await supabase.from('customers').select('id,shop_id,display_name,phone,notes,created_at').eq('shop_id',shop.id).order('created_at',{ascending:false});
 if(error) throw error; return {shop,customers:data||[]};
}
export async function addCustomer(shopId,userId,input) {
 const {data,error}=await supabase.from('customers').insert({shop_id:shopId,created_by:userId,display_name:input.name.trim(),phone:input.phone.trim()||null,notes:input.notes.trim()||null}).select('id,shop_id,display_name,phone,notes,created_at').single();
 if(error) throw error; return data;
}