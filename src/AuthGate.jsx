import React, { useEffect, useState } from 'react';
import { ArrowRight, ShieldCheck, Store } from 'lucide-react';
import { App as CapacitorApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { hasSupabaseConfig, supabase } from './lib/supabase';
import { redeemCustomerLinkInvite } from './lib/customerService';
import { shouldApplyInitialSession } from './lib/sessionGuards';

function friendlyAuthError(error) {
  const raw = String(error?.message || error || '').toLowerCase();
  if (raw.includes('email rate limit') || raw.includes('over_email_send_rate_limit') || raw.includes('rate limit exceeded')) {
    return 'ईमेल भेजने की Supabase सीमा पूरी हो गई है। अभी बार-बार कोशिश न करें। SMTP सेवा कॉन्फ़िगर होने तक नया पुष्टि ईमेल नहीं भेजा जा सकेगा।';
  }
  if (raw.includes('failed to fetch') || raw.includes('networkerror') || raw.includes('load failed') || raw.includes('fetch')) {
    return 'Supabase सर्वर तक कनेक्शन नहीं बन पाया। इंटरनेट जाँचें और कुछ देर बाद फिर प्रयास करें।';
  }
  if (raw.includes('email not confirmed') || raw.includes('email_not_confirmed')) {
    return 'इस ईमेल की पुष्टि बाकी है। Inbox और Spam में पुष्टि लिंक देखें।';
  }
  if (raw.includes('invalid login credentials')) return 'ईमेल या पासवर्ड सही नहीं है।';
  if (raw.includes('user already registered')) return 'इस ईमेल से खाता पहले से मौजूद है। लॉगिन करें या पासवर्ड रीसेट करें।';
  if (raw.includes('password should be at least')) return 'पासवर्ड कम से कम 8 अक्षर का रखें।';
  return error?.message || 'लॉगिन सेवा से अनुरोध पूरा नहीं हो पाया। कुछ देर बाद फिर प्रयास करें।';
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(hasSupabaseConfig);
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [shop, setShop] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMethod, setAuthMethod] = useState('email');
  const [phone, setPhone] = useState('+977');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [message, setMessage] = useState('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [demo, setDemo] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accountType, setAccountType] = useState('shop_owner');
  const [inviteCode, setInviteCode] = useState('');
  const [googleSetup, setGoogleSetup] = useState(() => { try { return Boolean(localStorage.getItem('gtn_google_signup_profile')); } catch { return false; } });
  const googleSetupUserRef = React.useRef(null);
  const googleRedirectTo = 'com.rajendra.globaltrustnetwork://login-callback';
  const appAuthRedirectTo = googleRedirectTo;

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    let authEventReceived = false;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventReceived = true;
      if (!mounted) return;
      setSession(nextSession);
      setSubmitting(false);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) setMessage('लॉगिन स्थिति जाँची नहीं जा सकी। दोबारा प्रयास करें।');
      // An auth event may have delivered a newer login/logout while getSession was pending.
      if (shouldApplyInitialSession(authEventReceived)) setSession(data?.session || null);
      setLoading(false);
    }).catch(() => {
      if (!mounted) return;
      setMessage('इंटरनेट या लॉगिन सेवा में समस्या है।');
      setLoading(false);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    let active = true;
    const completeGoogleRedirect = async (event) => {
      const callbackUrl = event?.url;
      if (!callbackUrl || !callbackUrl.startsWith(appAuthRedirectTo)) return;
      try {
        try { await Browser.close(); } catch {}
        const parsed = new URL(callbackUrl);
        const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
        const queryParams = parsed.searchParams;
        const errorDescription = hashParams.get('error_description') || queryParams.get('error_description');
        if (errorDescription) throw new Error(errorDescription.replace(/\\+/g, ' '));

        // PKCE callback handles both OAuth sign-in and email confirmation.
        const code = queryParams.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          return;
        }

        // Support Supabase confirmation links that return token_hash + type.
        const tokenHash = queryParams.get('token_hash') || hashParams.get('token_hash');
        const otpType = queryParams.get('type') || hashParams.get('type');
        if (tokenHash && otpType) {
          const allowedTypes = ['signup', 'email', 'recovery', 'invite', 'magiclink', 'email_change'];
          if (!allowedTypes.includes(otpType)) throw new Error('ईमेल पुष्टि लिंक का प्रकार मान्य नहीं है।');
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
          if (error) throw error;
          return;
        }

        // Keep compatibility with existing implicit-flow callbacks.
        const access_token = hashParams.get('access_token') || queryParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token') || queryParams.get('refresh_token');
        if (!access_token || !refresh_token) throw new Error('लॉगिन या ईमेल पुष्टि टोकन नहीं मिला। लिंक पुराना हो सकता है।');
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) throw error;
      } catch (error) {
        if (active) {
          setGoogleSetup(false);
          setMessage(error?.message || 'Google लॉगिन पूरा नहीं हुआ।');
          try { localStorage.removeItem('gtn_google_signup_profile'); } catch {}
        }
      }
    };
    const listenerPromise = Capacitor.isNativePlatform()
      ? CapacitorApp.addListener('appUrlOpen', completeGoogleRedirect)
      : Promise.resolve(null);
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.getLaunchUrl().then((launch) => completeGoogleRedirect(launch)).catch(() => {});
    }
    return () => {
      active = false;
      listenerPromise.then((listener) => listener?.remove()).catch(() => {});
    };
  }, []);

  useEffect(() => {
    const pending = (() => { try { return JSON.parse(localStorage.getItem('gtn_google_signup_profile') || 'null'); } catch { return null; } })();
    if (!session?.user?.id || !pending || !supabase || googleSetupUserRef.current === session.user.id) return;
    googleSetupUserRef.current = session.user.id;
    setGoogleSetup(true);
    (async () => {
      try {
        const { error } = await supabase.functions.invoke('ensure-google-account', { body: pending });
        if (error) throw error;
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            full_name: pending.fullName,
            account_type: pending.accountType,
            ...(pending.accountType === 'shop_owner' ? { shop_name: pending.shopName } : {})
          }
        });
        if (metadataError) throw metadataError;
        localStorage.removeItem('gtn_google_signup_profile');
        setGoogleSetup(false);
        setMessage('Google खाता सफलतापूर्वक तैयार हो गया।');
      } catch (error) {
        setGoogleSetup(false);
        googleSetupUserRef.current = null;
        setMessage(error?.message || 'Google खाता तैयार नहीं हो पाया। फिर प्रयास करें।');
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
      }
    })();
  }, [session?.user?.id]);

  async function signInWithGoogle() {
    if (submitting || !supabase || !hasSupabaseConfig) {
      if (!supabase) setMessage('Google लॉगिन के लिए Supabase कनेक्शन जरूरी है।');
      return;
    }
    setSubmitting(true);
    setMessage('');
    let pendingProfile = null;
    try {
      if (mode === 'signup') {
        if (!name.trim()) throw new Error('Google से खाता बनाने से पहले अपना नाम लिखें।');
        if (accountType === 'shop_owner' && !shop.trim()) throw new Error('दुकान का नाम लिखें।');
        pendingProfile = {
          fullName: name.trim(),
          accountType,
          shopName: accountType === 'shop_owner' ? shop.trim() : ''
        };
        localStorage.setItem('gtn_google_signup_profile', JSON.stringify(pendingProfile));
        setGoogleSetup(true);
      }
      const native = Capacitor.isNativePlatform();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          ...(native ? { redirectTo: googleRedirectTo, skipBrowserRedirect: true } : {}),
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) throw error;
      if (native) {
        if (!data?.url) throw new Error('Google लॉगिन लिंक नहीं मिला।');
        await Browser.open({ url: data.url });
        setSubmitting(false);
        setGoogleSetup(false);
      } else if (!data?.url) {
        throw new Error('Google लॉगिन लिंक नहीं मिला।');
      }
    } catch (error) {
      if (pendingProfile) {
        try { localStorage.removeItem('gtn_google_signup_profile'); } catch {}
        setGoogleSetup(false);
      }
      setMessage(error?.message || 'Google लॉगिन शुरू नहीं हो पाया। Supabase में Google Provider सेटिंग जाँचें।');
      setSubmitting(false);
    }
  }

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds > 0]);

  async function resendVerificationEmail() {
    if (!supabase || !pendingVerificationEmail || submitting || resendSeconds > 0) return;
    setSubmitting(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: pendingVerificationEmail,
        options: { emailRedirectTo: Capacitor.isNativePlatform() ? appAuthRedirectTo : window.location.origin }
      });
      if (error) throw error;
      setResendSeconds(60);
      setMessage('पुष्टि ईमेल फिर से भेज दिया गया है। Inbox और Spam फ़ोल्डर देखें।');
    } catch (error) {
      const raw = String(error?.message || '').toLowerCase();
      if (raw.includes('rate') || raw.includes('too many') || raw.includes('after')) {
        setResendSeconds(300);
        setMessage(friendlyAuthError(error) + ' पाँच मिनट बाद ही दोबारा प्रयास करें।');
      } else {
        setMessage(friendlyAuthError(error));
      }
    } finally { setSubmitting(false); }
  }

  async function signOut() {
    if (!supabase || signingOut) return;
    setSigningOut(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setDemo(false);
      setPassword('');
      setInviteCode('');
      setEmail('');
      setName('');
      setShop('');
    } catch (error) {
      setMessage(error?.message || 'लॉग आउट पूरा नहीं हुआ। इंटरनेट जाँचकर फिर कोशिश करें।');
    } finally {
      setSigningOut(false);
    }
  }

  function normalizedPhone() {
    const compact = phone.replace(/[\\s()-]/g, '');
    if (/^9[78]\\d{8}$/.test(compact)) return `+977${compact}`;
    if (/^\\+?[1-9]\\d{7,14}$/.test(compact)) return compact.startsWith('+') ? compact : `+${compact}`;
    throw new Error('देश कोड सहित सही मोबाइल नंबर लिखें, जैसे +97798XXXXXXXX।');
  }

  async function sendWhatsappOtp(e) {
    e.preventDefault();
    if (submitting || !supabase) return;
    setMessage('');
    if (mode === 'signup' && (!name.trim() || (accountType === 'shop_owner' && !shop.trim()))) {
      setMessage('अपना नाम भरें। दुकानदार के लिए दुकान का नाम भी भरें।');
      return;
    }
    setSubmitting(true);
    try {
      const targetPhone = normalizedPhone();
      const { error } = await supabase.auth.signInWithOtp({
        phone: targetPhone,
        options: {
          channel: 'whatsapp',
          shouldCreateUser: mode === 'signup',
          data: mode === 'signup'
            ? { full_name: name.trim(), account_type: accountType, ...(accountType === 'shop_owner' ? { shop_name: shop.trim() } : {}) }
            : undefined
        }
      });
      if (error) throw error;
      setPhone(targetPhone);
      setPhoneOtpSent(true);
      setPhoneOtp('');
      setResendSeconds(60);
      setMessage('WhatsApp पर OTP भेजने का अनुरोध सफल रहा। WhatsApp में आया 6 अंकों का कोड यहाँ भरें।');
    } catch (error) {
      const raw = String(error?.message || '').toLowerCase();
      if (raw.includes('rate') || raw.includes('too many')) {
        setResendSeconds(60);
        setMessage('OTP भेजने की सीमा पूरी हुई है। कुछ समय बाद फिर कोशिश करें।');
      } else if (raw.includes('fetch')) {
        setMessage('सर्वर से संपर्क नहीं हो पाया। इंटरनेट और Supabase कनेक्शन जाँचें।');
      } else {
        setMessage(error?.message || 'WhatsApp OTP नहीं भेजा जा सका। Supabase में Phone/WhatsApp Provider सेटिंग जाँचें।');
      }
    } finally { setSubmitting(false); }
  }

  async function verifyWhatsappOtp(e) {
    e.preventDefault();
    if (submitting || !supabase) return;
    if (!/^\\d{6}$/.test(phoneOtp.trim())) {
      setMessage('WhatsApp पर मिला 6 अंकों का OTP लिखें।');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone(),
        token: phoneOtp.trim(),
        type: 'sms'
      });
      if (error) throw error;
      setMessage('मोबाइल नंबर सत्यापित हो गया। लॉगिन पूरा हो रहा है।');
      setPhoneOtpSent(false);
      setPhoneOtp('');
    } catch (error) {
      setMessage(error?.message || 'OTP गलत या समाप्त हो चुका है। नया OTP मँगाकर फिर प्रयास करें।');
    } finally { setSubmitting(false); }
  }

  async function submit(e) {
    e.preventDefault();
    if (submitting) return;
    setMessage('');
    if (!supabase || !hasSupabaseConfig) return setMessage('Supabase कनेक्ट नहीं है। अभी डेमो मोड इस्तेमाल करें।');
    if (password.length < 8) return setMessage('पासवर्ड कम से कम 8 अक्षर का रखें।');
    if (mode === 'signup' && (!name.trim() || (accountType === 'shop_owner' && !shop.trim()))) {
      return setMessage('अपना नाम भरें। दुकानदार के लिए दुकान का नाम भी भरें।');
    }

    setSubmitting(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: Capacitor.isNativePlatform() ? appAuthRedirectTo : window.location.origin,
            data: { full_name: name.trim(), account_type: accountType, ...(accountType === 'shop_owner' ? { shop_name: shop.trim() } : {}) }
          }
        });
        if (error) throw error;
        setPendingVerificationEmail(email.trim());
        setResendSeconds(60);
        setMessage('रजिस्ट्रेशन अनुरोध भेज दिया गया। ईमेल में पुष्टि लिंक देखें। जरूरत हो तो 60 सेकंड बाद नीचे से दोबारा भेज सकते हैं।');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (error) throw error;
      }
    } catch (error) {
      const raw = String(error?.message || '').toLowerCase();
      if (raw.includes('email not confirmed') || raw.includes('email_not_confirmed')) {
        setPendingVerificationEmail(email.trim());
        setMessage('इस ईमेल की पुष्टि अभी बाकी है। Inbox/Spam देखें या नीचे से पुष्टि ईमेल दोबारा भेजें।');
      } else {
        setMessage(friendlyAuthError(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function redeemInvite(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true); setMessage('');
    try {
      const result = await redeemCustomerLinkInvite(inviteCode);
      setInviteCode('');
      setMessage(result.message || 'अनुरोध जमा हो गया है। अभी दुकान का हिसाब उपलब्ध नहीं है।');
    } catch (error) {
      setMessage(error?.message || 'निमंत्रण कोड इस्तेमाल नहीं हो सका।');
    } finally { setSubmitting(false); }
  }

  if (loading || (googleSetup && session?.user)) return <div className="auth-loading">{googleSetup ? 'Google खाता सुरक्षित रूप से तैयार किया जा रहा है…' : 'सुरक्षित लॉगिन जाँचा जा रहा है…'}</div>;
  if (session && session.user?.user_metadata?.account_type === 'customer') return <main className="auth-screen"><section className="auth-card"><div className="auth-brand"><span><ShieldCheck size={27}/></span><div><b>GLOBAL TRUST</b><small>NETWORK</small></div></div><div className="auth-kicker"><ShieldCheck size={14}/> ग्राहक पोर्टल</div><h1>अपना ग्राहक रिकॉर्ड जोड़ें</h1><p className="auth-desc">दुकानदार से मिला एक बार का निमंत्रण कोड यहाँ दर्ज करें। अनुरोध जमा होने पर भी दुकान का बैलेंस या लेन-देन नहीं दिखेगा। पहले दुकानदार की जाँच और सुरक्षित मंजूरी जरूरी है।</p><form onSubmit={redeemInvite}><label>निमंत्रण कोड</label><input value={inviteCode} onChange={e=>setInviteCode(e.target.value.trim())} placeholder="दुकानदार से मिला कोड" minLength="40" maxLength="50" autoComplete="off" required/><button className="primary-btn auth-submit" type="submit" disabled={submitting}>{submitting?'जाँच हो रही है…':'निमंत्रण कोड जमा करें'} <ArrowRight size={17}/></button></form>{message&&<div className="auth-message" role="status">{message}</div>}<button className="auth-switch" onClick={signOut} disabled={signingOut}>{signingOut?'लॉग आउट हो रहा है…':'लॉग आउट'}</button></section></main>
  if (session) return <>{React.cloneElement(children, { mode: 'live', user: session.user })}<button className="signout-fab" onClick={signOut} disabled={signingOut}>{signingOut?'लॉग आउट हो रहा है…':'लॉग आउट'}</button></>;
  if (demo) return <>{React.cloneElement(children, { mode: 'demo', user: null })}<div className="demo-banner">डेमो मोड: नमूना डेटा ही दिखाया जा रहा है। <button onClick={() => setDemo(false)}>लॉगिन पर लौटें</button></div></>;

  return <main className="auth-screen">
    <section className="auth-card">
      <div className="auth-brand"><span><ShieldCheck size={27}/></span><div><b>GLOBAL TRUST</b><small>NETWORK</small></div></div>
      <div className="auth-kicker"><Store size={14}/> {accountType === 'customer' ? 'ग्राहक पोर्टल' : 'दुकानदार पोर्टल'}</div>
      <h1>{mode === 'login' ? 'अपने खाते में प्रवेश करें' : accountType === 'customer' ? 'ग्राहक खाता बनाएँ' : 'अपनी दुकान का खाता बनाएँ'}</h1>
      <p className="auth-desc">उधार और जमा का हिसाब सुरक्षित और साफ तरीके से संभालें।</p>
      <div className="type-switch auth-method-switch">
        <button type="button" className={authMethod === 'email' ? 'chosen' : ''} onClick={() => {setAuthMethod('email');setMessage('');}}>ईमेल</button>
        <button type="button" className={authMethod === 'whatsapp' ? 'chosen' : ''} onClick={() => {setAuthMethod('whatsapp');setMessage('');}}>WhatsApp OTP</button>
      </div>
      {mode === 'signup' && <>
        <label htmlFor="account-type">खाते का प्रकार</label>
        <select id="account-type" value={accountType} onChange={e => setAccountType(e.target.value)} required>
          <option value="shop_owner">दुकानदार</option>
          <option value="customer">ग्राहक</option>
        </select>
        <label>आपका नाम</label><input value={name} onChange={e => setName(e.target.value)} placeholder="पूरा नाम" required/>
        {accountType === 'shop_owner' && <><label>दुकान का नाम</label><input value={shop} onChange={e => setShop(e.target.value)} placeholder="दुकान का नाम" required/></>}
      </>}
      {authMethod === 'email' ? <form onSubmit={submit}>
        <label>ईमेल</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required/>
        <label>पासवर्ड</label><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="कम से कम 8 अक्षर" minLength="8" required/>
        {message && <div className="auth-message" role="status">{message}</div>}
        {pendingVerificationEmail && <button className="auth-switch" type="button" onClick={resendVerificationEmail} disabled={submitting || resendSeconds > 0}>{submitting ? 'ईमेल भेजा जा रहा है…' : resendSeconds > 0 ? `फिर भेजें (${resendSeconds}s बाद)` : 'पुष्टि ईमेल दोबारा भेजें'}</button>}
        <button className="primary-btn auth-submit" type="submit" disabled={submitting}>{submitting ? 'कृपया प्रतीक्षा करें…' : mode === 'login' ? 'लॉगिन करें' : 'खाता बनाएँ'} <ArrowRight size={17}/></button>
      </form> : <form onSubmit={phoneOtpSent ? verifyWhatsappOtp : sendWhatsappOtp}>
        <label>मोबाइल नंबर (देश कोड सहित)</label>
        <input type="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+97798XXXXXXXX" autoComplete="tel" required disabled={phoneOtpSent}/>
        {phoneOtpSent && <>
          <label>WhatsApp OTP</label>
          <input type="text" inputMode="numeric" autoComplete="one-time-code" value={phoneOtp} onChange={e => setPhoneOtp(e.target.value.replace(/\\D/g, '').slice(0, 6))} placeholder="6 अंकों का OTP" maxLength="6" required/>
        </>}
        {message && <div className="auth-message" role="status">{message}</div>}
        <button className="primary-btn auth-submit" type="submit" disabled={submitting || (phoneOtpSent && resendSeconds > 0 && !phoneOtp)}>{submitting ? 'कृपया प्रतीक्षा करें…' : phoneOtpSent ? 'OTP सत्यापित करके लॉगिन करें' : 'WhatsApp पर OTP भेजें'} <ArrowRight size={17}/></button>
        {phoneOtpSent && <button className="auth-switch" type="button" onClick={sendWhatsappOtp} disabled={submitting || resendSeconds > 0}>{resendSeconds > 0 ? `नया OTP (${resendSeconds}s बाद)` : 'OTP दोबारा भेजें'}</button>}
      </form>}
      <div className="auth-divider"><span>या</span></div>
      <button className="google-auth-btn" type="button" onClick={signInWithGoogle} disabled={submitting || googleSetup}>
        <span className="google-mark">G</span>{submitting ? 'कृपया प्रतीक्षा करें…' : mode === 'login' ? 'Google से लॉगिन करें' : 'Google से खाता बनाएँ'}
      </button>
      <button className="auth-switch" onClick={() => {setMode(mode === 'login' ? 'signup' : 'login');setMessage('');}}>{mode === 'login' ? 'नया खाता बनाना है? रजिस्टर करें' : 'पहले से खाता है? लॉगिन करें'}</button>
      <div className="auth-foot"><ShieldCheck size={15}/> सुरक्षित कनेक्शन • निजी दुकान डेटा</div>
    </section>
    <button className="demo-link" onClick={() => setDemo(true)}>पहले डेमो देखें</button>
    {!hasSupabaseConfig && <p className="setup-warning">Supabase अभी कनेक्ट नहीं है। लॉगिन चालू करने के लिए .env.local में प्रोजेक्ट URL और anon key जोड़ें।</p>}
  </main>;
}
