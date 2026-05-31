import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import { LogOut, Plus, Monitor, QrCode, Users, Store, Megaphone, CheckCircle2, RotateCcw, SkipForward, Download, Copy, ExternalLink, Maximize2, Wrench, User, Shield, Sparkles, Eye, EyeOff, KeyRound, Printer } from 'lucide-react';
import { api, setToken, clearToken, getToken, ticketLabel, statusLabel } from './lib/api.js';
import './styles.css';

function usePath() {
  const [path, setPath] = useState(location.pathname);
  useEffect(() => {
    const onPop = () => setPath(location.pathname);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const nav = (to) => { history.pushState({}, '', to); setPath(to); };
  return [path, nav];
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`btn ${variant} ${className}`} {...props}>{children}</button>;
}
function Card({ children, className = '' }) { return <div className={`card ${className}`}>{children}</div>; }
function Input(props) { return <input className="input" {...props} />; }
function Select(props) { return <select className="input" {...props} />; }
function PasswordInput({ value, onChange, placeholder = '', required = false, autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return <div className="password-wrap">
    <Input type={show ? 'text' : 'password'} value={value} onChange={onChange} placeholder={placeholder} required={required} autoComplete={autoComplete}/>
    <button type="button" className="eye-btn" onClick={() => setShow(!show)} title={show ? 'Ocultar contraseña' : 'Ver contraseña'} aria-label={show ? 'Ocultar contraseña' : 'Ver contraseña'}>
      {show ? <EyeOff size={20}/> : <Eye size={20}/>}
    </button>
  </div>
}
function Pill({ children, tone = 'dark' }) { return <span className={`pill ${tone}`}>{children}</span>; }
function Toast({ msg }) { return msg ? <div className="toast">{msg}</div> : null; }

function Layout({ children, user, nav, title }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">TR</div><div><b>Turnero</b><small>Repuestos</small></div></div>
      {user && <div className="userbox"><Shield size={18}/><div><b>{user.name}</b><span>{user.role === 'super_admin' ? 'Super usuario' : user.role === 'admin_casa' ? 'Administrador' : 'Vendedor'}</span></div></div>}
      <nav>
        {user?.role === 'super_admin' && <button onClick={() => nav('/super')}><Store size={18}/> Casas</button>}
        {user?.storeSlug && user.role !== 'vendedor' && <button onClick={() => nav(`/admin/${user.storeSlug}`)}><Users size={18}/> Administración</button>}
        {user?.storeSlug && <button onClick={() => nav(`/panel/${user.storeSlug}`)}><Megaphone size={18}/> Panel vendedor</button>}
        {user?.storeSlug && <button onClick={() => window.open(`/tv/${user.storeSlug}`, '_blank')}><Monitor size={18}/> Abrir TV</button>}
      </nav>
      {user && <Button variant="ghost" onClick={() => { clearToken(); nav('/login'); }}><LogOut size={17}/> Salir</Button>}
    </aside>
    <main className="main"><header><h1>{title}</h1><p>Sistema web de turnos por QR, panel de atención y pantalla TV.</p></header>{children}</main>
  </div>
}

function Login({ nav, onUser }) {
  const [form, setForm] = useState({ username: 'super', password: 'super123' });
  const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setErr('');
    try {
      const data = await api('login', { method: 'POST', body: form, auth: false });
      setToken(data.token); onUser(data.user);
      if (data.user.role === 'super_admin') nav('/super');
      else nav(`/panel/${data.user.storeSlug}`);
    } catch (e) { setErr(e.message); }
  }
  return <div className="login-page">
    <div className="login-hero"><Sparkles/><h1>Turnero Repuestos</h1><p>Elegante, rápido y listo para QR, vendedores y TV.</p></div>
    <Card className="login-card"><h2>Ingresar</h2><p className="muted">Usuario inicial: <b>super</b> / clave: <b>super123</b></p><form onSubmit={submit} className="form">
      <label>Usuario<Input value={form.username} onChange={e=>setForm({...form, username:e.target.value})}/></label>
      <label>Contraseña<PasswordInput value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/></label>
      {err && <div className="error">{err}</div>}<Button>Entrar</Button>
    </form></Card>
  </div>
}

function SuperAdmin({ user, nav }) {
  const [stores, setStores] = useState([]); const [toast, setToast] = useState('');
  const [form, setForm] = useState({ name:'', address:'', adminUsername:'', adminPassword:'', puestos:'A,B,C' });
  async function load(){ const d = await api('stores'); setStores(d.stores); }
  useEffect(()=>{ load().catch(e=>setToast(e.message)); },[]);
  async function create(e){ e.preventDefault(); try{ const d=await api('create-store',{method:'POST',body:form}); setToast(`Casa creada. Admin: ${d.admin.username} / ${d.admin.password}`); setForm({ name:'', address:'', adminUsername:'', adminPassword:'', puestos:'A,B,C' }); await load(); }catch(e){setToast(e.message)} }
  return <Layout user={user} nav={nav} title="Panel Super Usuario"><Toast msg={toast}/>
    <div className="grid two"><Card><h2><Plus/> Crear casa de repuestos</h2><form className="form" onSubmit={create}>
      <label>Nombre de la casa<Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Ej: Repuestos Centro" required/></label>
      <label>Dirección<Input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
      <label>Usuario administrador<Input value={form.adminUsername} onChange={e=>setForm({...form,adminUsername:e.target.value})} placeholder="centro_admin"/></label>
      <label>Contraseña administrador<PasswordInput value={form.adminPassword} onChange={e=>setForm({...form,adminPassword:e.target.value})} placeholder="dejá vacío para sugerida" autoComplete="new-password"/></label>
      <label>Puestos<Input value={form.puestos} onChange={e=>setForm({...form,puestos:e.target.value})} placeholder="A,B,C"/></label>
      <Button><Store size={18}/> Crear estructura completa</Button>
    </form></Card>
    <Card><h2><Store/> Casas creadas</h2><div className="list">{stores.map(s=><StoreRow key={s.slug} store={s} nav={nav}/>)}</div>{!stores.length && <p className="muted">Todavía no hay casas creadas.</p>}</Card></div>
  </Layout>
}

function StoreRow({store, nav}){ return <div className="store-row"><div><b>{store.name}</b><span>{store.slug}</span></div><div className="row-actions"><Button variant="ghost" onClick={()=>nav(`/admin/${store.slug}`)}>Administrar</Button><Button variant="ghost" onClick={()=>window.open(store.tvUrl || `/tv/${store.slug}`,'_blank')}>TV</Button></div></div> }

function QRCard({ store }) {
  const [qr, setQr] = useState('');
  useEffect(()=>{ if(store?.qrUrl) QRCode.toDataURL(store.qrUrl, { width: 900, margin: 2, color: { dark: '#111827', light: '#ffffff' }}).then(setQr); },[store?.qrUrl]);
  function download(){ const a=document.createElement('a'); a.href=qr; a.download=`QR_${store.name.replace(/\s+/g,'_')}.png`; a.click(); }
  async function copy(){ await navigator.clipboard.writeText(store.qrUrl); }
  return <Card className="qr-card"><h2><QrCode/> QR propio</h2>{qr && <img src={qr} alt="QR"/>}<p className="linkline">{store.qrUrl}</p><div className="actions"><Button onClick={download}><Download size={17}/> Descargar PNG</Button><Button variant="secondary" onClick={copy}><Copy size={17}/> Copiar link</Button><Button variant="ghost" onClick={()=>window.open(store.qrUrl,'_blank')}><ExternalLink size={17}/> Probar</Button></div></Card>
}


function VendorPasswordEditor({ vendor, slug, onSaved }) {
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!password.trim()) return alert('Ingresá una nueva contraseña');
    setBusy(true);
    try {
      await api('update-user-password', { method: 'POST', body: { slug, userId: vendor.id, password } });
      setPassword('');
      onSaved?.('Contraseña actualizada');
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }
  return <div className="inline-password">
    <div className="mini-pass"><PasswordInput value={password} onChange={e=>setPassword(e.target.value)} placeholder="Nueva clave" autoComplete="new-password"/></div>
    <Button variant="secondary" className="small-btn" disabled={busy} onClick={save}><KeyRound size={16}/> Cambiar</Button>
  </div>
}

function AdminCasa({ user, nav, slug }) {
  const [data, setData] = useState(null); const [toast,setToast]=useState('');
  const [vendor,setVendor]=useState({username:'',password:'',name:'',puesto:'A'});
  async function load(){ const d=await api('store-detail',{query:{slug}}); setData(d); setVendor(v=>({...v, puesto:d.store.puestos?.[0]||'A'})); }
  useEffect(()=>{ load().catch(e=>setToast(e.message)); },[slug]);
  async function addVendor(e){ e.preventDefault(); try{ await api('create-vendor',{method:'POST',body:{...vendor,slug}}); setToast('Vendedor creado'); setVendor({username:'',password:'',name:'',puesto:data.store.puestos?.[0]||'A'}); await load(); }catch(e){setToast(e.message)} }
  async function reset(){ if(confirm('¿Reiniciar todos los turnos del día?')){ await api('reset-day',{method:'POST',body:{slug}}); setToast('Día reiniciado'); }}
  if(!data) return <Layout user={user} nav={nav} title="Administración"><Toast msg={toast}/></Layout>
  const {store, users}=data;
  return <Layout user={user} nav={nav} title={store.name}><Toast msg={toast}/>
    <div className="grid two"><QRCard store={store}/><Card><h2><Users/> Crear vendedor</h2><form className="form" onSubmit={addVendor}>
      <label>Nombre<Input value={vendor.name} onChange={e=>setVendor({...vendor,name:e.target.value})} placeholder="Ej: Rubén"/></label>
      <label>Usuario<Input value={vendor.username} onChange={e=>setVendor({...vendor,username:e.target.value})} required/></label>
      <label>Contraseña<PasswordInput value={vendor.password} onChange={e=>setVendor({...vendor,password:e.target.value})} required autoComplete="new-password"/></label>
      <label>Puesto<Select value={vendor.puesto} onChange={e=>setVendor({...vendor,puesto:e.target.value})}>{store.puestos.map(p=><option key={p}>{p}</option>)}</Select></label>
      <Button><Plus size={17}/> Crear vendedor</Button>
    </form></Card></div>
    <div className="grid two"><Card><h2>Usuarios de esta casa</h2><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Puesto</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.username}</td><td>{u.role}</td><td>{u.puesto||'-'}</td></tr>)}</tbody></table></Card>
    <Card><h2><KeyRound/> Cambiar clave de vendedores</h2><p className="muted">El administrador puede modificar la contraseña de cada vendedor desde acá.</p><div className="password-list">{users.filter(u=>u.role==='vendedor').map(u=><div className="password-row" key={u.id}><div><b>{u.name}</b><span>{u.username} · Puesto {u.puesto || '-'}</span></div><VendorPasswordEditor vendor={u} slug={slug} onSaved={(m)=>setToast(m)} /></div>)}{!users.some(u=>u.role==='vendedor') && <p className="muted">Todavía no hay vendedores creados.</p>}</div></Card></div>
    <Card><h2>Accesos rápidos</h2><div className="big-actions"><Button onClick={()=>nav(`/panel/${slug}`)}><Megaphone/> Panel vendedor</Button><Button variant="secondary" onClick={()=>window.open(`/tv/${slug}`,'_blank')}><Monitor/> Pantalla TV</Button><Button variant="danger" onClick={reset}><RotateCcw/> Reiniciar día</Button></div></Card>
  </Layout>
}

function PanelVendedor({ user, nav, slug }) {
  const [tickets,setTickets]=useState([]); const [store,setStore]=useState(null); const [toast,setToast]=useState(''); const [puesto,setPuesto]=useState(user?.puesto || 'A');
  const pending = tickets.filter(t=>t.status==='pendiente');
  const called = tickets.filter(t=>t.status==='llamado').sort((a,b)=>(b.calledAt||'').localeCompare(a.calledAt||''));
  async function load(){ const [d,s] = await Promise.all([api('tickets',{query:{slug}}), api('store-detail',{query:{slug}})]); setTickets(d.tickets); setStore(s.store); if(!puesto) setPuesto(s.store.puestos?.[0]||'A'); }
  useEffect(()=>{ load().catch(e=>setToast(e.message)); const i=setInterval(()=>load().catch(()=>{}),2500); return()=>clearInterval(i); },[slug]);
  async function action(name, body={}){ try{ const d=await api(name,{method:'POST',body:{slug,puesto,...body}}); setToast(d.ticket ? `Turno ${d.ticket.code}: ${statusLabel(d.ticket.status)}` : 'Listo'); await load(); }catch(e){setToast(e.message)} }
  function openFloating(){
    const html = `<!doctype html><html><head><meta charset='utf-8'><style>body{margin:0;font-family:Arial;background:#111827;color:white}.box{padding:14px}.t{font-size:13px;color:#a7f3d0}.code{font-size:28px;font-weight:900;margin:8px 0}button{display:block;width:100%;margin:7px 0;padding:12px;border:0;border-radius:12px;font-weight:800;cursor:pointer}.p{background:#22c55e}.s{background:#e5e7eb}.d{background:#ef4444;color:white}select{width:100%;padding:10px;border-radius:10px;margin:6px 0}</style></head><body><div class='box'><div class='t'>${store?.name||''}</div><div class='code'>Panel flotante</div><select id='puesto'>${(store?.puestos||['A']).map(p=>`<option ${p===puesto?'selected':''}>${p}</option>`).join('')}</select><button class='p' onclick='call("call-next")'>LLAMAR SIGUIENTE</button><button class='s' onclick='location.reload()'>ACTUALIZAR</button><button class='d' onclick='window.close()'>CERRAR</button><div id='msg'></div></div><script>const token=${JSON.stringify(getToken())};async function call(action){const puesto=document.getElementById('puesto').value;const res=await fetch('/.netlify/functions/api?action='+action,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({slug:${JSON.stringify(slug)},puesto})});const data=await res.json();document.getElementById('msg').innerText=data.ticket?('Llamado '+data.ticket.code):(data.error||'Listo')}</script></body></html>`;
    if ('documentPictureInPicture' in window) {
      window.documentPictureInPicture.requestWindow({width:260,height:330}).then(w=>{w.document.write(html); w.document.close();}).catch(()=>popup(html));
    } else popup(html);
  }
  function popup(html){ const w=window.open('', 'turnero_flotante', 'width=280,height=380'); w.document.write(html); w.document.close(); }
  return <Layout user={user} nav={nav} title="Panel vendedor"><Toast msg={toast}/>
    <div className="toolbar"><div><b>{store?.name}</b><span> Puesto </span><Select value={puesto} onChange={e=>setPuesto(e.target.value)}>{(store?.puestos||['A']).map(p=><option key={p}>{p}</option>)}</Select></div><Button variant="secondary" onClick={openFloating}><Maximize2 size={17}/> Modo flotante</Button></div>
    <div className="grid three"><Card className="metric"><b>{pending.length}</b><span>Pendientes</span></Card><Card className="metric"><b>{called.length}</b><span>Llamados</span></Card><Card className="metric"><b>{tickets.filter(t=>t.status==='atendido').length}</b><span>Atendidos</span></Card></div>
    <div className="hero-call"><Button className="call-btn" onClick={()=>action('call-next')}><Megaphone/> LLAMAR SIGUIENTE</Button></div>
    <div className="grid vendor-work"><Card><h2>Turnos pendientes</h2><TicketList tickets={pending} actions={false}/></Card><Card><h2>Últimos llamados</h2><TicketList tickets={called} onFinish={t=>action('finish-ticket',{ticketId:t.id})} onSkip={t=>action('skip-ticket',{ticketId:t.id})} onRecall={t=>action('recall',{ticketId:t.id})}/></Card>{store && <QRCard store={store}/>}</div>
  </Layout>
}

function TicketList({tickets,onFinish,onSkip,onRecall}){ if(!tickets.length) return <p className="muted">Sin turnos.</p>; return <div className="ticket-list">{tickets.map(t=><div className="ticket" key={t.id}><div className="ticket-code">{t.code}</div><div><b>{t.name}</b><span>{ticketLabel(t.type)} · {statusLabel(t.status)} {t.puesto?`· Puesto ${t.puesto}`:''}</span></div><div className="ticket-actions">{onRecall&&<button onClick={()=>onRecall(t)}><Megaphone size={16}/></button>}{onFinish&&<button onClick={()=>onFinish(t)}><CheckCircle2 size={16}/></button>}{onSkip&&<button onClick={()=>onSkip(t)}><SkipForward size={16}/></button>}</div></div>)}</div> }

function TurnoCliente({ slug }) {
  const [store,setStore]=useState(null); const [form,setForm]=useState({name:'',type:'particular'}); const [ticket,setTicket]=useState(null); const [err,setErr]=useState('');
  useEffect(()=>{ api('public-store',{auth:false,query:{slug}}).then(d=>setStore(d.store)).catch(e=>setErr(e.message)); },[slug]);
  async function submit(e){ e.preventDefault(); setErr(''); try{ const d=await api('take-ticket',{auth:false,method:'POST',body:{slug,...form}}); setTicket(d.ticket); }catch(e){setErr(e.message)} }
  return <div className="client-page"><Card className="client-card"><div className="client-logo"><Wrench/> {store?.name||'Turnero'}</div>{ticket ? <div className="ticket-result"><p>Tu turno es</p><h1>{ticket.code}</h1><h2>{ticket.name}</h2><Pill>{ticketLabel(ticket.type)}</Pill><p>Aguardá a ser llamado en pantalla.</p><Button variant="secondary" onClick={()=>{setTicket(null);setForm({name:'',type:'particular'})}}>Sacar otro turno</Button></div> : <><h1>Sacá tu turno</h1><p className="muted">Ingresá tu nombre y elegí el tipo de atención.</p><form className="form" onSubmit={submit}><label>Nombre<Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Tu nombre o taller" required autoFocus/></label><div className="type-grid"><button type="button" className={form.type==='particular'?'selected':''} onClick={()=>setForm({...form,type:'particular'})}><User/> Particular</button><button type="button" className={form.type==='mecanico'?'selected':''} onClick={()=>setForm({...form,type:'mecanico'})}><Wrench/> Mecánico</button></div>{err&&<div className="error">{err}</div>}<Button>SACAR TURNO</Button></form></>}</Card></div>
}

function PantallaTV({ slug }) {
  const [data,setData]=useState({called:[],pending:[],lastCalled:null,store:null});
  useEffect(()=>{ const load=()=>api('public-tickets',{auth:false,query:{slug}}).then(setData).catch(()=>{}); load(); const i=setInterval(load,2000); return()=>clearInterval(i); },[slug]);
  const last=data.lastCalled;
  return <div className="tv-page"><div className="tv-top"><h1>{data.store?.name || 'Turnero'}</h1><span>{new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span></div><div className="tv-grid"><section className="tv-last"><p>Último llamado</p>{last ? <><h2>{last.code}</h2><h3>{last.name}</h3><div>Puesto {last.puesto || '-'}</div><Pill>{ticketLabel(last.type)}</Pill></> : <h3>Aguardando turnos</h3>}</section><section className="tv-table"><h2>Turnos llamados</h2><table><thead><tr><th>Turno</th><th>Nombre</th><th>Puesto</th><th>Atención</th></tr></thead><tbody>{data.called.map(t=><tr key={t.id}><td>{t.code}</td><td>{t.name}</td><td>{t.puesto}</td><td>{ticketLabel(t.type)}</td></tr>)}</tbody></table></section></div></div>
}

function App(){ const [path,nav]=usePath(); const [user,setUser]=useState(null); const parts=path.split('/').filter(Boolean); useEffect(()=>{ if(getToken()) api('me').then(d=>setUser(d.user)).catch(()=>{}); },[]);
  if(parts[0]==='turno' && parts[1]) return <TurnoCliente slug={parts[1]}/>;
  if(parts[0]==='tv' && parts[1]) return <PantallaTV slug={parts[1]}/>;
  if(path==='/' || path==='/login') return <Login nav={nav} onUser={setUser}/>;
  if(!user) return <Login nav={nav} onUser={setUser}/>;
  if(parts[0]==='super') return <SuperAdmin user={user} nav={nav}/>;
  if(parts[0]==='admin' && parts[1]) { if(user.role === 'vendedor') return <PanelVendedor user={user} nav={nav} slug={parts[1]}/>; return <AdminCasa user={user} nav={nav} slug={parts[1]}/>; }
  if(parts[0]==='panel' && parts[1]) return <PanelVendedor user={user} nav={nav} slug={parts[1]}/>;
  return <Login nav={nav} onUser={setUser}/>;
}

createRoot(document.getElementById('root')).render(<App/>);
