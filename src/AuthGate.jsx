import React, { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Store } from 'lucide-react';
import { hasSupabaseConfig, supabase } from './lib/supabase';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [shop, setShop] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(e) {
    e.preventDefault();
    setMessage('');
    if (password.length < 8) return setMessage('पासवर्ड कम से कम 8 अक्षर का रखें।');
    if (mode === 'signup') {
      if (!name.trim() || !shop.trim()) return setMessage('अपना नाम और दुकान का नाम भरें।');
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: name.trim(), shop_name: shop.trim() } }
      });
      if (error) setMessage(error.message);
      else setMessage('रजिस्ट्रेशन अनुरोध भेज दिया गया। ईमेल में पुष्टि लिंक देखें।');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
    }
  }

  if (loading) return <div className="auth-loading">सुरक्षित लॉगिन जाँचा जा रहा है…</div>;
  if (session) return <>{React.cloneElement(children, { mode: 'live', user: session.user })}<button className="signout-fab" onClick={() => supabase.auth.signOut()}>लॉग आउट</button></>;
  if (demo) return <>{React.cloneElement(children, { mode: 'demo', user: null })}<div className="demo-banner">डेमो मोड: नमूना डेटा ही दिखाया जा रहा है। <button onClick={() => setDemo(false)}>लॉगिन पर लौटें</button></div></>;

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span><ShieldCheck size={27}/></span><div><b>GLOBAL TRUST</b><small>NETWORK</small></div></div>
      <div className="auth-kicker"><Store size={14}/> दुकानदार पोर्टल</div>
      <h1>{mode === 'login' ? 'अपने खाते में प्रवेश करें' : 'अपनी दुकान का खाता बनाएँ'}</h1>
      <p className="auth-desc">उधार और जमा का हिसाब सुरक्षित और साफ तरीके से संभालें।</p>
      <form onSubmit={submit}>
        {mode === 'signup' && <>
          <label>आपका नाम</label><input value={name} onChange={e => setName(e.target.value)} placeholder="पूरा नाम" required/>
          <label>दुकान का नाम</label><input value={shop} onChange={e => setShop(e.target.value)} placeholder="दुकान का नाम" required/>
        </>}
        <label>ईमेल</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required/>
        <label>पासवर्ड</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="कम से कम 8 अक्षर" minLength="8" required/>
        {message && <div className="auth-message" role="status">{message}</div>}
        <button className="primary-btn auth-submit" type="submit">{mode === 'login' ? 'लॉगिन करें' : 'खाता बनाएँ'} <ArrowRight size={17}/></button>
      </form>
      <button className="auth-switch" onClick={() => {setMode(mode === 'login' ? 'signup' : 'login');setMessage('');}}>{mode === 'login' ? 'नया खाता बनाना है? रजिस्टर करें' : 'पहले से खाता है? लॉगिन करें'}</button>
      <div className="auth-foot"><ShieldCheck size={15}/> सुरक्षित कनेक्शन • निजी दुकान डेटा</div>
    </section>
    <button className="demo-link" onClick={() => setDemo(true)}>पहले डेमो देखें</button>
    {!hasSupabaseConfig && <p className="setup-warning">Supabase अभी कनेक्ट नहीं है। लॉगिन चालू करने के लिए .env.local में प्रोजेक्ट URL और anon key जोड़ें।</p>}
  </main>;
}
