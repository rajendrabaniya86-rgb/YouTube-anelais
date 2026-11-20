import { useMemo, useState } from 'react';
import {
  Activity, ArrowDownLeft, ArrowUpRight, Bell, BookOpen, Check,
  ChevronDown, CircleHelp, Download, HandCoins, LayoutDashboard,
  Plus, Search, ShieldCheck, Sparkles, Store, Users, Wallet
} from 'lucide-react';

const initialCustomers = [
  { id: 1, name: 'राम प्रसाद', phone: '98•••••421', balance: 2450, status: 'बाकी', initials: 'रा', color: 'peach', last: 'आज, 10:42' },
  { id: 2, name: 'सीता देवी', phone: '98•••••815', balance: 0, status: 'क्लियर', initials: 'सी', color: 'violet', last: 'कल, 18:20' },
  { id: 3, name: 'मोहन कुमार', phone: '97•••••203', balance: 780, status: 'बाकी', initials: 'मो', color: 'mint', last: '18 नवम्बर' },
  { id: 4, name: 'गीता थापा', phone: '98•••••672', balance: 1250, status: 'बाकी', initials: 'गी', color: 'blue', last: '17 नवम्बर' }
];

const money = n => 'रु ' + new Intl.NumberFormat('en-IN').format(n);

export default function App() {
  const [customers, setCustomers] = useState(initialCustomers);
  const [active, setActive] = useState('overview');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState('');
  const [selected, setSelected] = useState(initialCustomers[0]);
  const [amount, setAmount] = useState('');
  const [entryType, setEntryType] = useState('credit');
  const [notice, setNotice] = useState('');

  const total = useMemo(() => customers.reduce((sum, c) => sum + c.balance, 0), [customers]);
  const filtered = customers.filter(c => c.name.toLowerCase().includes(query.toLowerCase()));

  function saveEntry(e) {
    e.preventDefault();
    const value = Number(amount);
    if (!value || value <= 0) return;
    setCustomers(list => list.map(c => c.id !== selected.id ? c : {
      ...c, balance: Math.max(0, c.balance + (entryType === 'credit' ? value : -value)),
      status: Math.max(0, c.balance + (entryType === 'credit' ? value : -value)) === 0 ? 'क्लियर' : 'बाकी',
      last: 'अभी'
    }));
    setModal('');
    setAmount('');
    setNotice('डेमो एंट्री सेव हो गई। यह अभी इसी डिवाइस पर है।');
    setTimeout(() => setNotice(''), 3500);
  }

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><ShieldCheck size={23}/></div><div><b>GLOBAL TRUST</b><span>NETWORK</span></div></div>
      <div className="workspace"><div className="shop-icon"><Store size={18}/></div><div><b>अपनी दुकान</b><small>दुकानदार डैशबोर्ड</small></div><ChevronDown size={15}/></div>
      <p className="nav-label">मुख्य मेन्यू</p>
      <nav>
        <button className={active === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('overview')}><LayoutDashboard/>ओवरव्यू</button>
        <button className={active === 'customers' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('customers')}><Users/>ग्राहक और खाते</button>
        <button className={active === 'activity' ? 'nav-item active' : 'nav-item'} onClick={() => setActive('activity')}><Activity/>लेन-देन इतिहास</button>
      </nav>
      <div className="sidebar-bottom"><div className="privacy-card"><ShieldCheck size={19}/><b>आपका डेटा, आपका नियंत्रण</b><p>ग्राहक की अनुमति के बिना निजी हिसाब साझा नहीं होगा।</p></div><button className="nav-item"><CircleHelp/>मदद और सहायता</button><div className="profile"><div className="avatar owner">दु</div><div><b>दुकान मालिक</b><small>डेमो अकाउंट</small></div><ChevronDown size={15}/></div></div>
    </aside>

    <main className="main">
      <header className="topbar"><div className="breadcrumb">दुकान <span>/</span> {active === 'overview' ? 'ओवरव्यू' : active === 'customers' ? 'ग्राहक और खाते' : 'लेन-देन इतिहास'}</div><div className="top-actions"><span className="demo-pill"><span/> डेमो मोड</span><button className="icon-btn" aria-label="सूचनाएँ"><Bell size={19}/></button><div className="avatar owner">दु</div></div></header>
      <section className="content">
        <div className="welcome-row"><div><div className="eyebrow">गुरुवार, 20 नवम्बर 2026</div><h1>{active === 'overview' ? 'नमस्ते, आपका हिसाब तैयार है।' : active === 'customers' ? 'ग्राहक और खाते' : 'लेन-देन इतिहास'}</h1><p className="subtitle">अपनी दुकान का उधार और जमा एक ही जगह आसानी से संभालें।</p></div><button className="primary-btn" onClick={() => {setSelected(customers[0]);setModal('entry')}}><Plus size={18}/> नई एंट्री</button></div>

        {active === 'overview' && <>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-top"><span>कुल बाकी रकम</span><div className="stat-icon indigo"><Wallet/></div></div><strong>{money(total)}</strong><small className="muted">सभी ग्राहकों का कुल बकाया</small></div>
            <div className="stat-card"><div className="stat-top"><span>कुल ग्राहक</span><div className="stat-icon green"><Users/></div></div><strong>{customers.length}</strong><small className="positive"><Activity size={13}/> सक्रिय खाते</small></div>
            <div className="stat-card"><div className="stat-top"><span>क्लियर खाते</span><div className="stat-icon gold"><Check/></div></div><strong>{customers.filter(c => c.balance === 0).length}</strong><small className="muted">जिनका बाकी शून्य है</small></div>
          </div>
          <div className="section-heading"><div><h2>ग्राहक खाते</h2><p>अपने ग्राहकों का ताजा हिसाब देखें।</p></div><button className="text-btn" onClick={() => setActive('customers')}>सभी ग्राहक देखें <span>→</span></button></div>
          <CustomerTable customers={filtered} onSelect={c => {setSelected(c);setModal('detail')}} onEntry={c => {setSelected(c);setModal('entry')}}/>
          <div className="bottom-grid"><div className="insight-card"><div className="insight-icon"><Sparkles size={19}/></div><div><b>Global Trust AI रिपोर्ट</b><p>आगे चलकर सत्यापित रिकॉर्ड का सरल सार और रुझान दिखेंगे। AI किसी ग्राहक को अपने-आप अच्छा या खराब घोषित नहीं करेगा।</p><span className="coming">जल्द उपलब्ध</span></div></div><div className="trust-card"><ShieldCheck size={22}/><div><b>प्राइवेसी पहले</b><p>हर साझा रिपोर्ट के लिए ग्राहक की स्पष्ट अनुमति जरूरी होगी।</p></div></div></div>
        </>}
        {active === 'customers' && <><div className="toolbar"><div className="searchbox"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ग्राहक का नाम खोजें..."/></div><span className="result-count">{filtered.length} ग्राहक</span></div><CustomerTable customers={filtered} onSelect={c => {setSelected(c);setModal('detail')}} onEntry={c => {setSelected(c);setModal('entry')}}/></>}
        {active === 'activity' && <div className="empty-state"><div className="empty-icon"><BookOpen size={28}/></div><h3>लेन-देन इतिहास तैयार हो रहा है</h3><p>अगले चरण में हर उधार, जमा, रसीद और बदलाव का समय सहित ऑडिट इतिहास जोड़ा जाएगा।</p></div>}
        <footer>© 2026 Global Trust Network <span>सुरक्षित हिसाब • स्पष्ट भरोसा</span></footer>
      </section>
    </main>

    {notice && <div className="toast"><Check size={17}/>{notice}</div>}
    {modal && <div className="modal-backdrop" onClick={() => setModal('')}><div className="modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={() => setModal('')}>×</button>
      {modal === 'entry' ? <><div className="modal-symbol"><HandCoins/></div><h2>नई लेन-देन एंट्री</h2><p className="modal-sub">डेमो खाते में उधार या जमा दर्ज करें।</p><div className="type-switch"><button className={entryType === 'credit' ? 'chosen' : ''} onClick={() => setEntryType('credit')}><ArrowUpRight size={16}/> उधार दिया</button><button className={entryType === 'payment' ? 'chosen payment' : ''} onClick={() => setEntryType('payment')}><ArrowDownLeft size={16}/> जमा मिला</button></div><label>ग्राहक चुनें</label><select value={selected.id} onChange={e => setSelected(customers.find(c => c.id === Number(e.target.value)))}>{customers.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select><label>रकम (रु)</label><input className="amount-input" type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="उदाहरण: 500"/><button className="primary-btn full" onClick={saveEntry}>एंट्री सेव करें</button></> :
      <><div className="avatar large">{selected.initials}</div><h2>{selected.name}</h2><p className="modal-sub">खाता विवरण • {selected.phone}</p><div className="detail-balance"><small>बाकी रकम</small><strong>{money(selected.balance)}</strong><span className={selected.balance === 0 ? 'status clear' : 'status due'}>{selected.status}</span></div><button className="primary-btn full" onClick={() => setModal('entry')}>लेन-देन जोड़ें</button></>}
      <p className="demo-note">यह केवल शुरुआती प्रोटोटाइप है। डेटा अभी सर्वर पर सेव नहीं होता।</p>
    </div></div>}
  </div>;
}

function CustomerTable({ customers, onSelect, onEntry }) {
  return <div className="table-card"><div className="table-wrap"><table><thead><tr><th>ग्राहक</th><th>बाकी रकम</th><th>स्थिति</th><th>आखिरी गतिविधि</th><th></th></tr></thead><tbody>{customers.map(c => <tr key={c.id}><td><button className="customer-cell" onClick={() => onSelect(c)}><span className={'avatar '+c.color}>{c.initials}</span><span><b>{c.name}</b><small>{c.phone}</small></span></button></td><td className="balance">{money(c.balance)}</td><td><span className={c.balance === 0 ? 'status clear' : 'status due'}><i/>{c.status}</span></td><td className="last-seen">{c.last}</td><td><button className="row-action" onClick={() => onEntry(c)}>एंट्री जोड़ें</button></td></tr>)}</tbody></table>{customers.length === 0 && <div className="no-results">कोई ग्राहक नहीं मिला।</div>}</div><div className="table-foot"><span>डेमो डेटा • {customers.length} खाते</span><span><Download size={14}/> रिपोर्ट निर्यात बाद में उपलब्ध होगा</span></div></div>;
}
