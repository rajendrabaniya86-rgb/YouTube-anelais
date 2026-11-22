import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AuthGate from './AuthGate.jsx';
import './index.css';

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Global Trust Network render error:', error, info?.componentStack);
  }
  render() {
    if (this.state.error) {
      const message = String(this.state.error?.message || this.state.error || 'अज्ञात त्रुटि');
      return (
        <main style={{ minHeight: '100vh', padding: '28px 18px', background: '#f3f6fa', color: '#172437', fontFamily: 'sans-serif' }}>
          <section style={{ maxWidth: 520, margin: '8vh auto', padding: 24, background: '#fff', border: '1px solid #e5eaf0', borderRadius: 16 }}>
            <h2 style={{ marginTop: 0 }}>ऐप खुलने में समस्या हुई</h2>
            <p style={{ lineHeight: 1.6 }}>सफेद स्क्रीन दिखने के बजाय अब त्रुटि का कारण यहाँ दिखाई देगा। इस संदेश का स्क्रीनशॉट सहायता के लिए भेजें।</p>
            <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', padding: 12, background: '#f5f7fa', borderRadius: 8, fontSize: 12 }}>{message}</pre>
            <button onClick={() => window.location.reload()} style={{ padding: '12px 18px', border: 0, borderRadius: 9, background: '#192b40', color: '#fff', fontWeight: 600 }}>ऐप दोबारा खोलें</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

function StartupDiagnostics() {
  React.useEffect(() => {
    const showError = (message) => {
      console.error('Global Trust Network startup error:', message);
    };
    const onError = (event) => showError(event?.error?.message || event?.message || 'JavaScript startup error');
    const onRejection = (event) => showError(event?.reason?.message || event?.reason || 'Unhandled startup promise');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <StartupDiagnostics />
      <AuthGate><App /></AuthGate>
    </AppErrorBoundary>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration skipped:', error);
    });
  });
}
