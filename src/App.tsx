import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react';
import { Sprout, Network, UsersRound, BookHeart, Plus, Search, ChevronDown, ChevronRight, ArrowUpRight, ArrowRight, X, Menu, MapPin, CalendarDays, Pencil, Trash2, Download, Check, ShieldCheck, LogIn, LogOut, Settings2, CircleHelp, Heart, Sparkles, Trees, List, Leaf, CheckCircle2 } from 'lucide-react';
import FamilyCanvas, { Avatar } from './FamilyCanvas';
import AuthPage from './AuthPage';
import ChildPicker from './ChildPicker';
import PersonFields from './PersonFields';
import PhotoPicker from './PhotoPicker';
import { authRoute, redirectPath, navigate as navigateRoute, usePathname } from './routes';
import { api, accountTrees, currentProfile, ApiError } from './api';
import { restoreActiveTree, rememberActiveTree, canEditWorkspace } from './workspace';
import { savePersonToTree, removePersonFromTree } from './domain';
import { type Person, type Tree, type Profile, demoTree, blankPerson, fullName, personLocation, matchesPerson, years, generationMap } from './data';
type View = 'tree' | 'people' | 'memories';
type Modal = 'new-tree' | 'auth' | 'settings' | 'help' | null;
const KEY = 'ridni-demo-v1';
function readSaved(): {trees: Tree[]; activeId: string; profile: Profile | null} {
  try { const data = JSON.parse(localStorage.getItem(KEY) || 'null'); if (data && Array.isArray(data.trees) && data.trees.length && data.trees.every((t: Tree) => typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.people))) return data; } catch { /* Use demo when storage is unavailable. */ }
  return { trees: [demoTree()], activeId: 'demo-tree', profile: null };
}
function ModalShell({ title, eyebrow, onClose, children, wide = false }: {title:string; eyebrow?:string; onClose:()=>void; children:React.ReactNode; wide?:boolean}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const focusable = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]') || []).filter(el => !el.hasAttribute('disabled'));
    focusable()[0]?.focus();
    const handler = (e: KeyboardEvent) => { if(e.key === 'Escape') onClose(); if(e.key === 'Tab') {const els = focusable(); const first=els[0],last=els[els.length-1]; if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();} else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}} };
    document.addEventListener('keydown', handler);
    return () => { document.body.style.overflow=overflow;document.removeEventListener('keydown',handler);previous?.focus(); };
  },[onClose]);
  return <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) onClose();}}><div ref={ref} className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div><button className="icon-button" aria-label="Закрити" onClick={onClose}><X size={21}/></button></div>{children}</div></div>;
}
export default function App() {
  const pathname=usePathname();
  const [initial] = useState(readSaved);
  const [backend,setBackend] = useState<'checking'|'ready'|'demo'|'offline'>(location.protocol==='file:'?'demo':'checking');
  const [cloud,setCloud] = useState(false);
  const [pending,setPending] = useState(false);
  const [trees, setTrees] = useState(initial.trees);
  const [activeId,setActiveId] = useState(initial.activeId);
  const [profile,setProfile] = useState<Profile|null>(initial.profile);
  const [view,setView] = useState<View>('tree');
  const [query,setQuery] = useState('');
  const [modal,setModal] = useState<Modal>(null);
  const [person,setPerson] = useState<Person|null>(null);
  const [editing,setEditing] = useState(false);
  const [photoProcessing,setPhotoProcessing] = useState(false);
  const [draft,setDraft] = useState<Person|null>(null);
  const [linkParent,setLinkParent] = useState<Person|null>(null);
  const [childIds,setChildIds] = useState<string[]>([]);
  const [formError,setFormError] = useState('');
  const [toast,setToast] = useState('');
  const [menuOpen,setMenuOpen] = useState(false);
  const [treeMenu,setTreeMenu] = useState(false);
  const [deleteConfirm,setDeleteConfirm] = useState(false);
  const [makeRoot,setMakeRoot] = useState(false);
  const [authMode,setAuthMode] = useState<'register'|'login'>('register');
  const [storageOk,setStorageOk] = useState(true);
  const tree = trees.find(t => t.id === activeId) || trees[0];
  const levels = generationMap(tree.people);
  const generations = tree.people.length ? Math.max(...levels.values()) + 1 : 0;
  const filtered = tree.people.filter(p => matchesPerson(p,query));
  const stories = filtered.filter(p => p.bio);
  useEffect(() => { if(cloud || backend==='checking')return;try {localStorage.setItem(KEY,JSON.stringify({trees,activeId,profile})); setStorageOk(true);} catch {setStorageOk(false);} },[trees,activeId,profile,cloud,backend]);
  useEffect(() => {
    if(location.protocol==='file:')return;
    let cancelled=false;
    async function connect(){
      try {
        const status=await api<{configured:boolean}>('/status');
        if(cancelled)return;
        if(!status.configured){setBackend('offline');setProfile(null);return;}
        try {
          const {profile:account}=await currentProfile();
          const {trees:remote}=await accountTrees();
          if(cancelled)return;
          if(!remote.length)throw new Error('У вашому акаунті немає дерев. Зверніться до адміністратора.');
          setTrees(remote);setActiveId(restoreActiveTree(remote,account,localStorage));setProfile(account);setCloud(true);
        }catch(error){if(cancelled)return;if(!(error instanceof ApiError && error.status===401))throw error;setProfile(null);}
        setBackend('ready');
      }catch {if(!cancelled){setBackend('offline');setProfile(null);setToast('Не вдалося завантажити ваші дерева. Зміни тимчасово недоступні.');}}
    }
    void connect();return()=>{cancelled=true;};
  },[]);
  useEffect(()=>{if(cloud&&profile)rememberActiveTree(activeId,profile,localStorage);},[cloud,profile,activeId]);
  function requireAccount():boolean {
    if(canEditWorkspace(backend,cloud))return true;
    if(backend==='ready'){
      closePerson();setProfile(null);navigateRoute('/register');setFormError('Увійдіть або зареєструйтеся, щоб зберегти власне дерево в акаунті.');
    }else{setToast('Сервер недоступний. Зміни не збережено. Перевірте підключення й оновіть сторінку.');}
    return false;
  }
  function openNewTree(){if(!requireAccount())return;setFormError('');setModal('new-tree');}
  useEffect(()=>{
    if(backend==='checking'||backend==='demo')return;
    const redirect=redirectPath(pathname,cloud);
    if(redirect)navigateRoute(redirect,true);
  },[backend,cloud,pathname]);
  function completeAuth(account:Profile,remote:Tree[]){
    setTrees(remote);setActiveId(restoreActiveTree(remote,account,localStorage));setProfile(account);setCloud(true);setQuery('');setView('tree');setModal(null);setFormError('');navigateRoute('/',true);
  }
  async function perform(action:()=>Promise<void>){
    setPending(true);setFormError('');
    try {await action();}catch(error){setFormError(error instanceof Error?error.message:'Не вдалося зберегти зміни.');}finally{setPending(false);}
  }
  async function createTree(e:FormEvent<HTMLFormElement>){
    e.preventDefault();if(!requireAccount())return;const data=new FormData(e.currentTarget);const name=String(data.get('name')).trim();if(!name)return;
    await perform(async()=>{
      let next:Tree={id:crypto.randomUUID(),name,description:String(data.get('description')).trim(),people:[],rootId:'',createdAt:new Date().toISOString()};
      if(cloud)next=(await api<{tree:Tree}>('/trees','POST',next)).tree;
      setTrees(prev=>[...prev,next]);setActiveId(next.id);setView('tree');setQuery('');closeModal();setToast('Нове дерево створено. Додайте першу людину.');
    });
  }
  async function authenticate(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const data=new FormData(e.currentTarget);
    await perform(async()=>{
      const input={name:String(data.get('name')||'').trim(),email:String(data.get('email')).trim(),password:String(data.get('password')||''),familyName:String(data.get('familyName')||'').trim()};
      if(backend==='offline'||backend==='checking')throw new Error('Сервер недоступний. Перевірте його запуск і спробуйте ще раз.');
      if(backend==='ready'){
        if(modal==='settings'){
          const result=await api<{profile:Profile}>('/auth/profile','PATCH',{name:input.name});setProfile(result.profile);
        }else{
          const result=await api<{profile:Profile}>(authMode==='register'?'/auth/register':'/auth/login','POST',input);
          const {trees:remote}=await accountTrees();
          if(!remote.length)throw new Error('Не знайдено дерева акаунта. Оновіть сторінку.');
          setTrees(remote);setActiveId(restoreActiveTree(remote,result.profile,localStorage));setProfile(result.profile);setCloud(true);setQuery('');setView('tree');
        }
      }else{setProfile({name:input.name||'Мій профіль',email:input.email});}
      closeModal();setToast(backend==='ready'?'Обліковий запис готовий':'Демонстраційний профіль готовий');
    });
  }
  async function logout(){await perform(async()=>{
    if(cloud)await api('/auth/logout','POST');
    const local=readSaved();setTrees(local.trees);setActiveId(local.activeId);setProfile(null);setCloud(false);setQuery('');setView('tree');closePerson();closeModal();setToast('Ви вийшли з облікового запису');
  });}
  async function importDemo(){await perform(async()=>{
    const local=readSaved();const result=await api<{trees:Tree[]}>('/trees/import','POST',{trees:local.trees});
    setTrees(prev=>[...prev,...result.trees]);setActiveId(result.trees[0].id);closeModal();setToast('Демонстраційні дерева перенесено в акаунт');
  });}

  useEffect(() => { if(toast) {const timer=setTimeout(()=>setToast(''),4000);return ()=>clearTimeout(timer);} },[toast]);
  const closeModal = useCallback(() => {setModal(null);setFormError('');},[]);
  const closePerson = useCallback(() => {setPerson(null);setDraft(null);setLinkParent(null);setChildIds([]);setPhotoProcessing(false);setEditing(false);setDeleteConfirm(false);setFormError('');},[]);
  const selectPerson = useCallback((p:Person) => {setPerson(p);setEditing(false);setDeleteConfirm(false);setFormError('');},[]);
  function navigate(next:View){setView(next);setQuery('');setMenuOpen(false);}
  async function updateTree(next:Tree){if(!canEditWorkspace(backend,cloud))throw new Error('Увійдіть до акаунта для збереження дерева.');const saved=cloud?(await api<{tree:Tree}>(`/trees/${next.id}`,'PUT',next)).tree:next;setTrees(prev=>prev.map(t=>t.id===saved.id?saved:t));}
  function addPerson(relative?: Person, relation?: 'parent'|'child'|'partner') {
    if(!requireAccount())return;
    const p = blankPerson(); p.lastName = relative?.lastName || tree.people.find(p=>p.id===tree.rootId)?.lastName || '';
    if(relative && relation==='child') p.parents = [relative.id, ...(relative.partner ? [relative.partner] : [])];
    if(relative && relation==='partner') p.partner=relative.id;
    setDraft(p);setPerson(null);setLinkParent(null);setChildIds([]);setPhotoProcessing(false);setEditing(true);setMakeRoot(!tree.people.length);setFormError('');setDeleteConfirm(false);
    // A newly added parent is linked after saving, through this temporary reference.
    setParentOf(relative && relation==='parent' ? relative.id : '');
  }
  const [parentOf,setParentOf] = useState('');
  function editPerson(p:Person){if(!requireAccount())return;setChildIds(tree.people.filter(child=>child.parents.includes(p.id)).map(child=>child.id));setLinkParent(null);setPhotoProcessing(false);setDraft({...p,parents:[...p.parents]});setPerson(null);setEditing(true);setMakeRoot(p.id===tree.rootId);setFormError('');setParentOf('');}
  async function savePerson(e:FormEvent){
    e.preventDefault();if(!draft||photoProcessing)return;
    await perform(async()=>{
      const isNew=!tree.people.some(p=>p.id===draft.id);
      await updateTree(savePersonToTree(tree,draft,{makeRoot,parentOf,children:parentOf?undefined:childIds}));
      closePerson();setToast(isNew?'Нову людину додано до вашої історії':'Зміни збережено');
    });
  }
  function chooseChild(parent:Person){
    if(!requireAccount())return;
    setLinkParent(parent);setChildIds(tree.people.filter(child=>child.parents.includes(parent.id)).map(child=>child.id));setPerson(null);setDraft(null);setEditing(false);setFormError('');
  }
  async function saveChildren(e:FormEvent){
    e.preventDefault();if(!linkParent)return;
    await perform(async()=>{await updateTree(savePersonToTree(tree,linkParent,{children:childIds}));closePerson();setToast('Родинні зв’язки збережено');});
  }
  async function removePerson(){if(!person)return;await perform(async()=>{await updateTree(removePersonFromTree(tree,person.id));closePerson();setToast('Людину та її зв’язки видалено');});}
  function exportTree(){const blob=new Blob([JSON.stringify(tree,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${tree.name}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setToast('Копію дерева завантажено');}
  const displayName=profile?.name || (backend==='demo'?'Демонстраційний профіль':'Увійти до акаунта');
  if(backend==='checking')return <div className="auth-loading" role="status"><Sprout size={35}/><p>Відкриваємо ваш родинний простір…</p></div>;
  if(!cloud&&backend!=='demo')return <AuthPage key={authRoute(pathname)} route={authRoute(pathname)} available={backend==='ready'} onAuthenticated={completeAuth}/>;
  return <div className="app-shell">
    {pending&&<div className="pending-overlay" role="status" aria-live="polite"><span>{pending?'Збереження…':'Підключення…'}</span></div>}
    {menuOpen && <div className="sidebar-scrim" onClick={()=>setMenuOpen(false)}/>}
    <aside className={`sidebar ${menuOpen?'open':''}`}>
      <a className="brand" href="#" onClick={e=>{e.preventDefault();navigate('tree');}}><span className="brand-icon"><Sprout size={29} strokeWidth={1.6}/></span><span>рідні<span className="brand-period">.</span></span></a>
      <span className="brand-tagline">У кожного є своя історія</span>
      <div className="workspace-label">ВАШ ПРОСТІР</div>
      <div className="tree-switch-wrap"><button className="tree-switch" onClick={()=>setTreeMenu(!treeMenu)} aria-expanded={treeMenu}><span className="tree-switch-icon"><Trees size={20}/></span><span><small>Сімейне дерево</small><strong>{tree.name}</strong></span><ChevronDown size={15}/></button>{treeMenu && <div className="tree-dropdown">{trees.map(t=><button key={t.id} onClick={()=>{setActiveId(t.id);setTreeMenu(false);setQuery('');}}>{t.name}{t.id===tree.id&&<Check size={15}/>}</button>)}<button onClick={()=>{openNewTree();setTreeMenu(false);}}><Plus size={16}/>Створити нове дерево</button></div>}</div>
      <nav className="main-nav" aria-label="Основна навігація">
        <button className={view==='tree'?'active':''} onClick={()=>navigate('tree')}><Network size={20}/><span>Моє дерево</span><ChevronRight size={16}/></button>
        <button className={view==='people'?'active':''} onClick={()=>navigate('people')}><UsersRound size={20}/><span>Рідні люди</span><span className="nav-count">{tree.people.length}</span></button>
        <button className={view==='memories'?'active':''} onClick={()=>navigate('memories')}><BookHeart size={20}/><span>Історії та спогади</span></button>
      </nav>
      <button className="new-tree-button" onClick={()=>{openNewTree();setMenuOpen(false);}}><Plus size={17}/>Створити дерево</button>
      <div className="sidebar-bottom">
        <div className="heritage-card"><span className="heritage-illustration"><Sprout size={46} strokeWidth={1}/><Leaf className="leaf-one" size={17}/><Leaf className="leaf-two" size={12}/></span><h3>Коріння об’єднує.</h3><p>Збережіть історію родини<br/>для тих, хто буде після нас.</p><button onClick={()=>setModal('help')}>З чого почати <ArrowUpRight size={15}/></button></div>
        <button className="sidebar-help" onClick={()=>setModal('help')}><CircleHelp size={18}/>Допомога та поради<ArrowUpRight size={14}/></button>
        <button className="profile-button" onClick={()=>setModal(profile?'settings':'auth')}><span className="profile-avatar">{profile?displayName.split(' ').map(p=>p[0]).slice(0,2).join(''):<LogIn size={16}/>}</span><span><strong>{displayName}</strong><small>{cloud?'Особистий простір':backend==='demo'?'Демонстраційний профіль':'Створіть свою родинну історію'}</small></span><Settings2 size={17}/></button>
      </div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumbs"><button className="mobile-menu icon-button" onClick={()=>setMenuOpen(true)} aria-label="Відкрити меню"><Menu size={21}/></button><span className="breadcrumb-home">Мій простір</span><ChevronRight size={13}/><strong>{view==='tree'?'Сімейне дерево':view==='people'?'Рідні люди':'Історії та спогади'}</strong></div><div className="topbar-right"><span className="demo-badge"><span/>{cloud?'Мій акаунт':backend==='offline'?'Сервер недоступний':'Демо-версія'}</span><button className="topbar-login" onClick={()=>setModal(profile?'settings':'auth')}>{profile?<Settings2 size={16}/>:<LogIn size={16}/>}<span>{profile?'Мій профіль':'Увійти'}</span></button>{!cloud&&backend==='ready'&&<button className="topbar-register" onClick={()=>{setFormError('');setAuthMode('register');setModal('auth');}}>Реєстрація</button>}</div></header>
      <main>
        <div className="page-intro"><div><div className="eyebrow"><span className="eyebrow-line"/>ТЕ, ЩО НАС ПОЄДНУЄ</div><h1>{view==='tree'?'Ваша родина. Ваша історія.':view==='people'?'Люди, з яких починається все.':'Маленькі миті. Велика історія.'}</h1><p>{view==='tree'?'Збережіть найцінніше — зв’язок між поколіннями.':view==='people'?'Кожне ім’я — частина вашої великої родинної історії.':'Збережіть голоси, традиції та спогади ваших рідних.'}</p></div><button className="btn primary intro-add" onClick={()=>addPerson()}><Plus size={17}/>Додати людину</button></div>
        <div className="stats-row"><div className="stat-card"><span className="stat-icon sage"><UsersRound size={22}/></span><div><strong>{tree.people.length}<span>рідних людей</span></strong><small>Кожен — частина вашої історії</small></div><span className="stat-decoration"><UsersRound size={53} strokeWidth={0.7}/></span></div><div className="stat-card"><span className="stat-icon sand"><Network size={22}/></span><div><strong>{generations}<span>покоління</span></strong><small>Від коріння до нових гілок</small></div><span className="stat-decoration"><Network size={53} strokeWidth={0.7}/></span></div><div className="stat-card"><span className="stat-icon lilac"><BookHeart size={22}/></span><div><strong>{tree.people.filter(p=>p.bio).length}<span>родинних історій</span></strong><small>Спогади, що живуть далі</small></div><span className="stat-decoration"><BookHeart size={53} strokeWidth={0.7}/></span></div></div>
        <section className={`tree-panel ${view!=='tree'?'content-panel':''}`}>
          <div className="panel-heading"><div><div className="panel-title"><h2>{tree.name}</h2><span className="private-badge"><ShieldCheck size={12}/>Приватне</span></div><p>{tree.description || 'Історія, яку ми пишемо разом.'}</p></div><button className="btn secondary export-button" onClick={exportTree}><Download size={15}/><span>Експорт дерева</span></button></div>
          <div className="panel-toolbar"><div className="view-tabs"><button className={view==='tree'?'selected':''} onClick={()=>navigate('tree')}><Network size={16}/><span>Дерево</span></button><button className={view==='people'?'selected':''} onClick={()=>navigate('people')}><List size={16}/><span>Список</span></button><button className={view==='memories'?'selected':''} onClick={()=>navigate('memories')}><BookHeart size={16}/><span>Історії</span></button></div><label className="search-field"><Search size={16}/><input aria-label="Пошук у родині" placeholder="Знайти в родині…" value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<button aria-label="Очистити пошук" onClick={()=>setQuery('')}><X size={14}/></button>}</label></div>
          {view==='tree'?<FamilyCanvas tree={tree} query={query} onSelect={selectPerson} onAdd={()=>addPerson()}/>:view==='people'?<div className="people-grid">{filtered.map(p=><button className="people-card" key={p.id} onClick={()=>selectPerson(p)}><Avatar person={p} size="large"/><div><h3>{fullName(p)}</h3><p>{years(p)}</p><span><MapPin size={13}/>{personLocation(p) || 'Місце не вказано'}</span></div><ChevronRight size={18}/>{p.id===tree.rootId&&<span className="people-root"><Sprout size={12}/>Корінь</span>}</button>)}{!filtered.length&&<div className="empty-state"><Search size={30}/><h3>{query?'Нікого не знайдено':'Знайомство починається з імені'}</h3><p>{query?'Спробуйте інше ім’я або місце.':'Додайте першу людину до вашої родини.'}</p><button className="btn secondary" onClick={()=>query?setQuery(''):addPerson()}>{query?'Очистити пошук':'Додати людину'}</button></div>}</div>:<div className="stories-grid">{stories.map((p,i)=><button key={p.id} className={`story-card story-${i%3}`} onClick={()=>selectPerson(p)}><span className="story-top"><span><BookHeart size={16}/>РОДИННА ІСТОРІЯ</span><ArrowUpRight size={19}/></span><span className="story-quote">“</span><p>{p.bio}</p><span className="story-author"><Avatar person={p}/><span><strong>{fullName(p)}</strong><small>{personLocation(p)}</small></span></span></button>)}{!stories.length&&<div className="empty-state"><BookHeart size={32}/><h3>{query?'Історій не знайдено':'Ваші спогади мають значення'}</h3><p>{query?'Спробуйте інше слово.':'Відкрийте картку рідної людини й додайте її історію.'}</p><button className="btn secondary" onClick={()=>query?setQuery(''):navigate('people')}>{query?'Очистити пошук':'Переглянути рідних'}</button></div>}</div>}
        </section>
        <div className="below-panel"><div className="gentle-note"><span className="note-icon"><Sparkles size={19}/></span><div><strong>Дерево росте разом із вашими спогадами</strong><p>Додайте історію, яку знаєте тільки ви. Вона стане частиною чогось більшого.</p></div><button onClick={()=>navigate('memories')} aria-label="Переглянути історії"><ArrowRight size={20}/></button></div><div className="save-note"><span className={storageOk?'saved-dot':'unsaved-dot'}/>{cloud?'Збережено у вашому акаунті':storageOk?'Збережено в цьому браузері':'Браузер не дозволяє збереження'}<span>{cloud?'Приватне дерево':'Демонстраційні дані'}</span></div></div>
        <footer><span className="footer-brand"><Sprout size={15}/>рідні.</span><span>Усе починається з родини.</span><span>Зроблено з турботою <Heart size={12}/></span></footer>
      </main>
    </div>
    {toast&&<div className="toast" role="status"><CheckCircle2 size={19}/>{toast}<button onClick={()=>setToast('')} aria-label="Закрити сповіщення"><X size={15}/></button></div>}
    {modal==='new-tree'&&<ModalShell title="Посадіть своє родинне дерево" eyebrow="НОВА ІСТОРІЯ" onClose={closeModal}><p className="modal-description">Дайте йому ім’я. Решту історії напишете разом.</p><form onSubmit={createTree}><label className="form-field">Назва дерева<input name="name" required maxLength={80} placeholder="Наприклад, родина Шевченків"/></label><label className="form-field">Кілька слів про вашу родину<textarea name="description" rows={3} maxLength={300} placeholder="Тут починається наша історія…"/></label><div className="form-note"><ShieldCheck size={17}/>{cloud?'Ваше дерево буде збережено у вашому акаунті.':'Ваше дерево зберігається лише в цьому браузері.'}</div>{formError&&<p className="form-error" role="alert">{formError}</p>}<button className="btn primary full-width" type="submit" disabled={pending}><Sprout size={17}/>Створити дерево</button></form></ModalShell>}
    {(modal==='auth'||modal==='settings')&&<ModalShell title={modal==='settings'?'Ваш особистий простір':authMode==='register'?'Родинні історії починаються тут':'Раді бачити вас знову'} eyebrow={backend==='ready'?'РІДНІ · ОСОБИСТИЙ АКАУНТ':'РІДНІ · ДЕМОНСТРАЦІЯ'} onClose={closeModal}>
      <div className="demo-notice"><Sprout size={20}/><p>{backend==='ready'?'Створіть особистий акаунт, щоб зберігати дерева й продовжувати свою історію на різних пристроях.':backend==='offline'?'Немає з’єднання із сервером. Вхід стане доступним після його запуску.':'Це демонстрація профілю. Дані зберігаються лише на цьому пристрої.'}</p></div>
      {modal==='auth'&&<div className="auth-tabs"><button className={authMode==='register'?'active':''} onClick={()=>{setAuthMode('register');setFormError('');}}>Реєстрація</button><button className={authMode==='login'?'active':''} onClick={()=>{setAuthMode('login');setFormError('');}}>Вхід</button></div>}
      <form onSubmit={authenticate}>
        {(authMode==='register'||modal==='settings'||backend!=='ready')&&<label className="form-field">Ваше ім’я<input name="name" defaultValue={profile?.name||''} placeholder="Ім’я та прізвище" required maxLength={80} autoComplete="name"/></label>}
        <label className="form-field">Електронна пошта<input type="email" name="email" defaultValue={profile?.email||''} placeholder="you@example.com" required maxLength={254} readOnly={cloud&&modal==='settings'} autoComplete="email"/></label>
        {backend==='ready'&&modal==='auth'&&authMode==='register'&&<label className="form-field">Назва вашої родини<input name="familyName" placeholder="Наприклад, родина Шевченків" maxLength={80} required/></label>}
        {backend==='ready'&&modal==='auth'&&<label className="form-field">Пароль<input type="password" name="password" required minLength={8} maxLength={128} placeholder="Щонайменше 8 символів" autoComplete={authMode==='register'?'new-password':'current-password'}/></label>}
        {formError&&<p className="form-error" role="alert">{formError}</p>}
        <button className="btn primary full-width" type="submit" disabled={pending||backend==='offline'}>{modal==='settings'?'Зберегти зміни':backend==='ready'?(authMode==='register'?'Створити акаунт':'Увійти'):(authMode==='register'?'Спробувати реєстрацію':'Спробувати вхід')}<ArrowRight size={16}/></button>
      </form>
      {modal==='settings'&&cloud&&<div className="import-demo"><h3>Перенести локальні дерева</h3><p>Скопіюйте дерева з демоверсії цього браузера в акаунт. Наявні дерева залишаться. Кожне натискання створює окремі копії.</p><button className="btn secondary full-width" onClick={importDemo} disabled={pending}>Імпортувати дерева з демо</button></div>}
      {modal==='settings'&&<button className="logout-button" onClick={logout} disabled={pending}><LogOut size={16}/>Вийти з профілю</button>}
      <p className="auth-footnote">{backend==='ready'?'Ваші дерева доступні тільки після входу у ваш акаунт.':'Демонстраційний профіль не створює захищений обліковий запис.'}</p>
    </ModalShell>}
    {modal==='help'&&<ModalShell title="Ваша історія — крок за кроком" eyebrow="ТРОХИ НАТХНЕННЯ" onClose={closeModal}><div className="help-steps">{[['01','Почніть із себе','Створіть дерево та додайте першу людину. Позначте її коренем дерева.'],['02','Поєднайте покоління','Відкрийте картку людини й додайте батьків, дитину або партнера. Наявних родичів можна прив’язати в редагуванні.'],['03','Збережіть живі спогади','Запишіть біографію, сімейний рецепт або улюблену історію в картці людини.'],['04','Майте копію під рукою',cloud?'Дерева зберігаються у вашому акаунті. Також можна завантажити окрему JSON-копію.':'Експортуйте дерево у JSON. У демоверсії зміни залишаються в браузері; очищення його даних видалить їх.']].map(([n,t,d])=><div key={n}><span>{n}</span><div><h3>{t}</h3><p>{d}</p></div></div>)}</div><button className="btn primary full-width" onClick={closeModal}>Почати свою історію<ArrowRight size={16}/></button></ModalShell>}
    {person&&!editing&&<ModalShell title={fullName(person)} eyebrow="ЧАСТИНА ВАШОЇ РОДИНИ" onClose={closePerson}><div className="person-detail-top"><Avatar person={person} size="detail"/><div><span className="detail-dates"><CalendarDays size={16}/>{years(person)}</span><span className="detail-place"><MapPin size={16}/>{person.place||'Місце не вказано'}</span>{person.region&&<span className="detail-place"><MapPin size={16}/>Область: {person.region}</span>}{person.id===tree.rootId&&<span className="root-label"><Sprout size={13}/>Корінь дерева</span>}</div></div><h3 className="detail-section-title"><BookHeart size={17}/>Історія життя</h3><p className="biography">{person.bio||'Тут поки немає історії. Збережіть спогад про цю людину — навіть кілька слів мають значення.'}</p><h3 className="detail-section-title"><Network size={17}/>Родинні зв’язки</h3><div className="relationship-list">{tree.people.filter(p=>person.parents.includes(p.id)||p.id===person.partner||p.parents.includes(person.id)).map(p=><button key={p.id} onClick={()=>selectPerson(p)}><Avatar person={p}/><span><strong>{fullName(p)}</strong><small>{person.parents.includes(p.id)?p.gender==='female'?'Мати':'Батько':p.id===person.partner?'Партнер / партнерка':'Дитина'}</small></span><ChevronRight size={16}/></button>)}</div><div className="relative-actions">{person.parents.length<2&&<button onClick={()=>addPerson(person,'parent')}><Plus size={14}/>Батьки</button>}<button onClick={()=>chooseChild(person)}><Plus size={14}/>Дитина</button>{!person.partner&&<button onClick={()=>addPerson(person,'partner')}><Plus size={14}/>Партнер</button>}</div><div className="detail-actions"><button className="btn primary" onClick={()=>editPerson(person)}><Pencil size={16}/>Редагувати</button><button className="icon-button danger" aria-label="Видалити людину" onClick={()=>{if(requireAccount())setDeleteConfirm(true);}}><Trash2 size={18}/></button></div>{deleteConfirm&&<div className="delete-confirm">{formError&&<p className="form-error" role="alert">{formError}</p>}<p>Видалити {fullName(person)} з дерева? Її зв’язки буде прибрано.</p><button onClick={removePerson}>Так, видалити</button><button onClick={()=>setDeleteConfirm(false)}>Скасувати</button></div>}</ModalShell>}
    {linkParent&&<ModalShell title="Пов’яжіть із дитиною" eyebrow={fullName(linkParent)} onClose={closePerson}>
      <p className="modal-description">Виберіть дитину, яка вже є у вашому дереві, або створіть нову картку.</p>
      <form onSubmit={saveChildren}><ChildPicker people={tree.people} parent={linkParent} value={childIds} onChange={setChildIds}/>{formError&&<p className="form-error" role="alert">{formError}</p>}<div className="form-actions"><button type="button" className="btn secondary" onClick={closePerson}>Скасувати</button><button type="submit" className="btn primary" disabled={pending}><Check size={17}/>Зберегти зв’язки</button></div></form>
      <div className="new-child-alternative"><p>Дитини ще немає в дереві?</p><button className="btn secondary full-width" onClick={()=>addPerson(linkParent,'child')}><Plus size={16}/>Створити нову людину</button></div>
    </ModalShell>}
    {editing&&draft&&<ModalShell title={tree.people.some(p=>p.id===draft.id)?'Збережіть деталі історії':'Нова гілочка вашої родини'} eyebrow={tree.people.some(p=>p.id===draft.id)?'РЕДАГУВАННЯ ЛЮДИНИ':'ДОДАТИ ЛЮДИНУ'} onClose={closePerson} wide><form onSubmit={savePerson}><PhotoPicker person={draft} onChange={photo=>setDraft(current=>current?{...current,photo}:current)} onProcessing={setPhotoProcessing}/><PersonFields person={draft} onChange={setDraft}/><h3 className="form-section"><Network size={16}/>Поєднайте з родиною</h3><div className="form-row">{[0,1].map(i=><label className="form-field" key={i}>{i===0?'Батько / мати':'Другий з батьків'}<select value={draft.parents[i]||''} onChange={e=>{const parents=[...draft.parents];parents[i]=e.target.value;setDraft({...draft,parents});}}><option value="">Не вказано</option>{tree.people.filter(p=>p.id!==draft.id).map(p=><option key={p.id} value={p.id}>{fullName(p)}</option>)}</select></label>)}</div><label className="form-field">Партнер / партнерка<select value={draft.partner} onChange={e=>setDraft({...draft,partner:e.target.value})}><option value="">Не вказано</option>{tree.people.filter(p=>p.id!==draft.id).map(p=><option key={p.id} value={p.id}>{fullName(p)}</option>)}</select></label><>{!parentOf&&<><h3 className="form-section"><UsersRound size={16}/>Діти</h3><ChildPicker people={tree.people} parent={draft} value={childIds} onChange={setChildIds}/></>}</><label className="form-field">Історія життя<textarea value={draft.bio} onChange={e=>setDraft({...draft,bio:e.target.value})} rows={3} maxLength={5000} placeholder="Якою ви пам’ятаєте цю людину? Що варто знати наступним поколінням?"/></label><label className="checkbox-field"><input type="checkbox" checked={makeRoot} disabled={!tree.people.length || draft.id===tree.rootId} onChange={e=>setMakeRoot(e.target.checked)}/><span>Зробити коренем дерева</span><Sprout size={16}/></label>{formError&&<p className="form-error" role="alert">{formError}</p>}<div className="form-actions"><button type="button" className="btn secondary" onClick={closePerson}>Скасувати</button><button type="submit" className="btn primary" disabled={pending||photoProcessing}><Check size={17}/>Зберегти людину</button></div></form></ModalShell>}
  </div>;
}
