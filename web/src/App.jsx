import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { assertSupabase, isConfigured, supabase } from './lib/supabase.js';
import { CLIENT_FILTERS, DAY_NAMES, KIND_LABEL, friendlyDbError, isInvitePending, matchesClientFilter, validateClient, buildRoutinePayload, equipmentLabel, exerciseKind, initials, muscleInfo, isNetworkError, localDate, statusClass, statusText, workoutVolume } from './lib/domain.js';

const NAV = [['dashboard','Resumen'],['clients','Pacientes'],['routines','Rutinas'],['exercises','Ejercicios'],['progress','Progreso']];
const MUSCLE_FILTERS = ['abs','pectorals','biceps','triceps','delts','lats','upper back','quads','glutes','hamstrings','calves'];
const EXERCISE_PAGE = 60;
const DRAFTS_KEY = 'fitcoach-admin-offline-drafts-v2';
const fallbackExercises = [
  { id:'local-squat', name:'Sentadilla con barra', category:'upper legs', equipment:'barbell', target:'quadriceps', secondary_muscles:['glúteos'] },
  { id:'local-press', name:'Press de pecho con barra', category:'chest', equipment:'barbell', target:'pectorals', secondary_muscles:['tríceps'] },
  { id:'local-row', name:'Remo con mancuerna', category:'back', equipment:'dumbbell', target:'dorsales', secondary_muscles:['bíceps'] },
];

const readDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFTS_KEY) || '[]'); } catch { return []; } };
const saveDrafts = (items) => localStorage.setItem(DRAFTS_KEY, JSON.stringify(items));
const formatDate = (value) => value ? new Intl.DateTimeFormat('es-MX',{dateStyle:'medium'}).format(new Date(value)) : '—';
function errorMessage(cause,fallback='No se pudo completar la operación.') {
  if(typeof cause==='string')return cause;
  if(!cause||typeof cause!=='object')return fallback;
  const friendly=friendlyDbError(cause);if(friendly)return friendly;
  return [cause.message,cause.details,cause.hint,cause.code&&`Código: ${cause.code}`].filter(Boolean).join(' · ')||fallback;
}
function tokenAppRole(session) {
  try {
    const payload=session?.access_token?.split('.')[1];
    if(!payload)return session?.user?.app_metadata?.role||'sin rol';
    const normalized=payload.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(payload.length/4)*4,'=');
    return JSON.parse(atob(normalized))?.app_metadata?.role||'sin rol';
  } catch { return session?.user?.app_metadata?.role||'sin rol'; }
}
async function functionErrorMessage(cause) {
  const fallback=errorMessage(cause,'Error desconocido de Supabase.');
  const response=cause?.context;
  if(!(response instanceof Response))return fallback;
  try{const body=await response.clone().json();return body?.error||body?.message||fallback;}catch{return fallback;}
}

function Modal({ title, subtitle, children, onClose, wide=false }) {
  return <div className="modal-backdrop" onMouseDown={(event)=>event.target===event.currentTarget&&onClose()}>
    <section className={`modal ${wide?'modal-wide':''}`} role="dialog" aria-modal="true">
      <div className="modal-header"><div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Cerrar">×</button></div>
      {children}
    </section>
  </div>;
}

function Login({ onReady }) {
  const [form,setForm]=useState({email:'',password:''});const [step,setStep]=useState('credentials');const [code,setCode]=useState('');const [factor,setFactor]=useState(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const pendingProfile=useRef(null);
  async function finish(){const {data}=await supabase.auth.getSession();onReady(data.session,pendingProfile.current);}
  async function startEnroll(client){
    const {data:all,error:listError}=await client.auth.mfa.listFactors();if(listError)throw listError;
    for(const old of (all.all||[]).filter(f=>f.factor_type==='totp'&&f.status==='unverified'))await client.auth.mfa.unenroll({factorId:old.id});
    const {data,error:enrollError}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'FitCoach'});if(enrollError)throw enrollError;
    setFactor({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret});setStep('enroll');
  }
  async function submit(event){event.preventDefault();setBusy(true);setError('');
    try{const client=assertSupabase();const {data,error:authError}=await client.auth.signInWithPassword(form);if(authError)throw authError;
      const {data:profile,error:profileError}=await client.from('fc_profiles').select('user_id,full_name,role').eq('user_id',data.user.id).single();
      if(profileError)throw profileError;if(!['admin','trainer'].includes(profile.role)){await client.auth.signOut();throw new Error('Esta cuenta no tiene acceso al panel del nutriólogo.');}
      pendingProfile.current=profile;
      if(profile.role==='admin'){ // las políticas RLS exigen MFA (aal2) para admin
        const {data:aal,error:aalError}=await client.auth.mfa.getAuthenticatorAssuranceLevel();if(aalError)throw aalError;
        if(aal.currentLevel!=='aal2'){
          if(aal.nextLevel==='aal2'){const {data:factors,error:factorError}=await client.auth.mfa.listFactors();if(factorError)throw factorError;const totp=factors.totp?.[0];if(!totp)throw new Error('No hay un factor de verificación activo.');setFactor({id:totp.id});setStep('mfa');}
          else await startEnroll(client);
          return;
        }
      }
      onReady(data.session,profile);
    }catch(cause){setError(errorMessage(cause,'No se pudo iniciar sesión.'));}finally{setBusy(false);}
  }
  async function verify(event){event.preventDefault();setBusy(true);setError('');
    try{const {error:verifyError}=await assertSupabase().auth.mfa.challengeAndVerify({factorId:factor.id,code:code.trim()});if(verifyError)throw verifyError;await finish();}
    catch(cause){setError(errorMessage(cause,'Código incorrecto. Inténtalo de nuevo.'));setCode('');}finally{setBusy(false);}
  }
  async function cancel(){await supabase?.auth.signOut();setStep('credentials');setFactor(null);setCode('');setError('');}
  const brand=<div className="brand"><span className="brand-mark">↗</span><span>FitCoach<small className="brand-subtitle">Administración</small></span></div>;
  if(step!=='credentials')return <main className="login"><form className="login-card" onSubmit={verify}>{brand}
    <h1>{step==='enroll'?'Activa la verificación en dos pasos':'Verificación en dos pasos'}</h1>
    {step==='enroll'?<><p>Escanea el código con tu app de autenticación (Google Authenticator, Authy…) y escribe el código de 6 dígitos.</p>{factor?.qr&&<img className="mfa-qr" src={factor.qr} alt="Código QR para tu app de autenticación"/>}{factor?.secret&&<p className="muted">¿No puedes escanear? Clave manual: <code>{factor.secret}</code></p>}</>:<p>Escribe el código de 6 dígitos de tu app de autenticación.</p>}
    {error&&<div className="status-banner error">{error}</div>}
    <div className="form-stack"><label>Código<input className="field" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required autoFocus value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label></div>
    <button className="button primary login-submit" disabled={busy||code.length!==6}>{busy?'Verificando…':'Verificar'}</button>
    <button type="button" className="button login-submit" onClick={cancel}>Cancelar</button>
  </form></main>;
  return <main className="login"><form className="login-card" onSubmit={submit}>{brand}
    <h1>Iniciar sesión</h1><p>Acceso exclusivo para el nutriólogo y personal autorizado.</p>
    {!isConfigured&&<div className="status-banner warn">Configura primero <code>.env.local</code>.</div>}
    {error&&<div className="status-banner error">{error}</div>}
    <div className="form-stack"><label>Correo<input className="field" type="email" required autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Contraseña<input className="field" type="password" required autoComplete="current-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label></div>
    <button className="button primary login-submit" disabled={!isConfigured||busy}>{busy?'Ingresando…':'Ingresar'}</button>
  </form></main>;
}

function LineChart({ rows, field, color='var(--green)', suffix='' }) {
  const data=rows.filter(row=>Number.isFinite(Number(row[field]))).slice().sort((a,b)=>new Date(a.measured_on)-new Date(b.measured_on));
  if(!data.length)return <div className="chart-empty">Aún no hay registros para esta métrica.</div>;
  const values=data.map(row=>Number(row[field])); const min=Math.min(...values); const max=Math.max(...values); const span=max-min||1;
  const points=data.map((row,index)=>`${data.length===1?50:(index/(data.length-1))*100},${88-((Number(row[field])-min)/span)*70}`).join(' ');
  return <div className="chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`Gráfica de ${field}`}><line x1="0" y1="88" x2="100" y2="88" className="chart-axis"/><polyline points={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg><div className="chart-legend"><span>{min}{suffix}</span><strong>{values.at(-1)}{suffix}</strong><span>{max}{suffix}</span></div></div>;
}

function ClientForm({ client, onClose, onSave, onInvite }) {
  const [form,setForm]=useState(client||{full_name:'',email:'',phone:'',status:'active',goal:'',height_cm:'',birth_date:'',initial_weight_kg:'',notes:''}); const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const change=(e)=>setForm({...form,[e.target.name]:e.target.value});
  async function submit(e){e.preventDefault();setError('');const invalid=validateClient(form);if(invalid){setError(invalid);return;}setBusy(true);try{await onSave(form);onClose();}catch(cause){setError(errorMessage(cause,'No se pudo guardar el paciente.'));}finally{setBusy(false);}}
  async function resend(){setBusy(true);setError('');try{await onInvite(client);onClose();}catch(cause){setError(`No se pudo enviar la invitación: ${await functionErrorMessage(cause)}`);}finally{setBusy(false);}}
  return <Modal title={client?'Editar paciente':'Nuevo paciente'} subtitle={client?'Actualiza su expediente.':'Crea el expediente y, opcionalmente, envía la invitación.'} onClose={onClose}>
    <form onSubmit={submit}><div className="form-grid">
      <label>Nombre completo<input className="field" name="full_name" required minLength="2" value={form.full_name||''} onChange={change}/></label>
      <label>Correo<input className="field" name="email" type="email" required={!client} value={form.email||''} onChange={change}/></label>
      <label>Teléfono<input className="field" name="phone" value={form.phone||''} onChange={change}/></label>
      <label>Estado<select className="select" name="status" value={form.status||'active'} onChange={change}><option value="active">Activo</option><option value="paused">Pausado</option><option value="archived">Baja</option></select></label>
      <label>Estatura (cm)<input className="field" name="height_cm" type="number" min="50" max="280" step="0.01" value={form.height_cm||''} onChange={change}/></label>
      <label>Fecha de nacimiento<input className="field" name="birth_date" type="date" value={form.birth_date||''} onChange={change}/></label>
      {!client&&<label>Peso inicial (kg)<input className="field" name="initial_weight_kg" type="number" min="10" max="700" step="0.01" value={form.initial_weight_kg||''} onChange={change}/></label>}
      <label className="wide">Objetivo<input className="field" name="goal" value={form.goal||''} onChange={change}/></label>
      <label className="wide">Notas<textarea className="field textarea" name="notes" rows="4" value={form.notes||''} onChange={change}/></label>
    </div>{error&&<div className="status-banner error">{error}</div>}<div className="form-actions"><button type="button" className="button" onClick={onClose}>Cancelar</button>{client?.email&&!client.user_id&&<button disabled={busy} type="button" className="button" onClick={resend}>Reenviar invitación</button>}<button className="button primary" disabled={busy}>{busy?'Guardando…':'Guardar'}</button></div></form>
  </Modal>;
}

function MeasurementForm({clients,initialClientId,onClose,onSave}){
  const [form,setForm]=useState({client_id:initialClientId==='all'?(clients[0]?.id||''):initialClientId,measured_on:localDate(),weight_kg:'',body_fat_percent:'',muscle_mass_kg:'',waist_cm:'',notes:''});const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const change=e=>setForm({...form,[e.target.name]:e.target.value});
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{await onSave(form);onClose();}catch(cause){setError(errorMessage(cause,'No se pudo guardar la medición.'));}finally{setBusy(false);}}
  return <Modal title="Nueva medición" subtitle="Registra la evolución corporal del paciente." onClose={onClose}><form onSubmit={submit}><div className="form-grid">
    <label>Paciente<select className="select" name="client_id" required value={form.client_id} onChange={change}><option value="">Selecciona un paciente</option>{clients.filter(c=>c.status!=='archived').map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select></label>
    <label>Fecha<input className="field" name="measured_on" type="date" required value={form.measured_on} onChange={change}/></label>
    <label>Peso (kg)<input className="field" name="weight_kg" type="number" min="10" max="700" step="0.01" value={form.weight_kg} onChange={change}/></label>
    <label>Grasa corporal (%)<input className="field" name="body_fat_percent" type="number" min="0" max="100" step="0.01" value={form.body_fat_percent} onChange={change}/></label>
    <label>Masa muscular (kg)<input className="field" name="muscle_mass_kg" type="number" min="0" max="500" step="0.01" value={form.muscle_mass_kg} onChange={change}/></label>
    <label>Cintura (cm)<input className="field" name="waist_cm" type="number" min="20" max="400" step="0.01" value={form.waist_cm} onChange={change}/></label>
    <label className="wide">Notas<textarea className="field textarea" name="notes" rows="3" value={form.notes} onChange={change}/></label>
  </div>{error&&<div className="status-banner error">{error}</div>}<div className="form-actions"><button type="button" className="button" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy||(!form.weight_kg&&!form.body_fat_percent&&!form.muscle_mass_kg&&!form.waist_cm)}>{busy?'Guardando…':'Guardar medición'}</button></div></form></Modal>;
}

function RoutineForm({clients,exercises,onClose,onSave}){
  const [name,setName]=useState('');const [clientId,setClientId]=useState(clients[0]?.id||'');const [days,setDays]=useState([1]);const [activeDay,setActiveDay]=useState(1);const [sessionMinutes,setSessionMinutes]=useState(60);const [query,setQuery]=useState('');const [pickedByDay,setPickedByDay]=useState({1:[]});const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [aiNotice,setAiNotice]=useState(false);
  const results=useMemo(()=>exercises.filter(x=>!query||[x.name,x.target,x.category].join(' ').toLowerCase().includes(query.toLowerCase())).slice(0,20),[exercises,query]);
  const picked=pickedByDay[activeDay]||[];
  function toggleDay(day){if(days.includes(day)){const next=days.filter(x=>x!==day);setDays(next);if(activeDay===day)setActiveDay(next[0]||1);}else{setDays([...days,day].sort());setPickedByDay(current=>({...current,[day]:current[day]||[]}));setActiveDay(day);}}
  function addExercise(exercise){if(picked.some(item=>item.id===exercise.id))return;setPickedByDay(current=>({...current,[activeDay]:[...(current[activeDay]||[]),{...exercise,sets:3,reps_min:10,reps_max:12,rest_seconds:90}]}));}
  function updateExercise(index,patch){setPickedByDay(current=>({...current,[activeDay]:(current[activeDay]||[]).map((item,i)=>i===index?{...item,...patch}:item)}));}
  function removeExercise(index){setPickedByDay(current=>({...current,[activeDay]:(current[activeDay]||[]).filter((_,i)=>i!==index)}));}
  async function submit(e){e.preventDefault();setError('');const emptyDays=days.filter(day=>!(pickedByDay[day]||[]).length);if(!days.length)return setError('Selecciona al menos un día.');if(emptyDays.length)return setError(`Agrega ejercicios para: ${emptyDays.map(day=>DAY_NAMES[day]).join(', ')}.`);setBusy(true);try{await onSave({name,client_id:Number(clientId),session_minutes:Number(sessionMinutes),days:days.map(day=>({day,exercises:pickedByDay[day]}))});onClose();}catch(cause){setError(errorMessage(cause,'No se pudo guardar la rutina.'));}finally{setBusy(false);}}
  return <Modal wide title="Constructor de rutina" subtitle="Define días, ejercicios, series, repeticiones y descansos." onClose={onClose}><form onSubmit={submit}>
    <div className="form-grid"><label>Nombre<input className="field" required placeholder="Ej. Rutina semanal" value={name} onChange={e=>setName(e.target.value)}/></label><label>Paciente<select className="select" required value={clientId} onChange={e=>setClientId(e.target.value)}>{clients.filter(x=>x.status!=='archived').map(x=><option key={x.id} value={x.id}>{x.full_name}</option>)}</select></label><label>Duración por sesión<select className="select" required value={sessionMinutes} onChange={e=>setSessionMinutes(Number(e.target.value))}><option value="30">30 minutos</option><option value="45">45 minutos</option><option value="60">60 minutos</option><option value="90">90 minutos</option></select></label><label>Asistente<button type="button" className="button ai-button" onClick={()=>setAiNotice(true)}>✦ Generar con IA <span>Próximamente</span></button></label><label className="wide">Días de entrenamiento<div className="day-picker">{DAY_NAMES.slice(1).map((label,index)=>{const day=index+1;return <button type="button" key={day} className={`button small ${days.includes(day)?'selected':''}`} onClick={()=>toggleDay(day)}>{label.slice(0,3)}</button>})}</div></label></div>
    {aiNotice&&<div className="status-banner warn">La generación con IA se habilitará cuando conectemos el proveedor. La rutina manual seguirá siendo editable antes de asignarla.</div>}
    {!!days.length&&<div className="routine-day-tabs">{days.map(day=><button type="button" key={day} className={`routine-day-tab ${activeDay===day?'active':''}`} onClick={()=>setActiveDay(day)}><strong>{DAY_NAMES[day]}</strong><span>{(pickedByDay[day]||[]).length} ejercicio(s)</span></button>)}</div>}
    <div className="active-day-heading"><div><p className="eyebrow">Editando</p><h3>{DAY_NAMES[activeDay]||'Selecciona un día'}</h3></div><span className="muted">Los ejercicios se asignan solamente a este día.</span></div>
    <div className="builder-layout"><div><input className="field" placeholder={`Buscar ejercicio para ${DAY_NAMES[activeDay]}…`} value={query} onChange={e=>setQuery(e.target.value)}/><div className="list builder-results">{results.map(x=><button type="button" className="list-row" key={x.id} disabled={!days.includes(activeDay)||picked.some(p=>p.id===x.id)} onClick={()=>addExercise(x)}><span className="initials">{picked.some(p=>p.id===x.id)?'✓':'+'}</span><span className="row-content"><strong>{x.name}</strong><p>{x.target||x.category} · {x.equipment}</p></span></button>)}</div></div>
      <div><h3>Ejercicios del {DAY_NAMES[activeDay]?.toLowerCase()}</h3><div className="selected-exercises">{picked.length?picked.map((x,index)=><div className="exercise-config" key={x.id}><strong>{index+1}. {x.name}</strong><div><label>Series<input type="number" min="1" max="20" value={x.sets} onChange={e=>updateExercise(index,{sets:Number(e.target.value)})}/></label><label>Reps<input type="number" min="1" max="200" value={x.reps_min} onChange={e=>updateExercise(index,{reps_min:Number(e.target.value),reps_max:Number(e.target.value)})}/></label><label>Descanso<input type="number" min="0" max="900" step="5" value={x.rest_seconds} onChange={e=>updateExercise(index,{rest_seconds:Number(e.target.value)})}/></label></div><button type="button" onClick={()=>removeExercise(index)}>Quitar</button></div>):<p className="builder-empty">Agrega ejercicios desde la lista de la izquierda.</p>}</div></div></div>
    {error&&<div className="status-banner error">{error}</div>}<div className="form-actions"><button type="button" className="button" onClick={onClose}>Cancelar</button><button className="button primary" disabled={busy||!clientId||!name.trim()||!days.length}>{busy?'Guardando…':'Guardar rutina semanal'}</button></div>
  </form></Modal>;
}

export default function App(){
  const [session,setSession]=useState(null);const [profile,setProfile]=useState(null);const [loading,setLoading]=useState(true);const [view,setView]=useState('dashboard');const [clients,setClients]=useState([]);const [routines,setRoutines]=useState([]);const [measurements,setMeasurements]=useState([]);const [sessions,setSessions]=useState([]);const [exercises,setExercises]=useState(fallbackExercises);const [modal,setModal]=useState(null);const [toast,setToast]=useState('');const [filter,setFilter]=useState('');const [exerciseFilter,setExerciseFilter]=useState('');const [draftCount,setDraftCount]=useState(0);const [selectedClient,setSelectedClient]=useState('all');const [online,setOnline]=useState(navigator.onLine);
  const notify=useCallback((message)=>{setToast(message);window.clearTimeout(window.__fitToast);window.__fitToast=setTimeout(()=>setToast(''),3500);},[]);

  const loadData=useCallback(async()=>{
    if(!supabase||!session)return;
    const [clientResult,routineResult,measureResult,sessionResult]=await Promise.all([
      supabase.from('fc_clients').select('*').order('created_at',{ascending:false}),
      supabase.from('fc_routines').select('*,fc_routine_days(*),fc_routine_exercises(*,exercise:fc_exercises(*))').is('archived_at',null).order('created_at',{ascending:false}),
      supabase.from('fc_body_measurements').select('*').order('measured_on',{ascending:true}),
      supabase.from('fc_workout_sessions').select('*,fc_set_logs(*)').eq('status','completed').order('completed_at',{ascending:false}),
    ]);
    const failure=[clientResult,routineResult,measureResult,sessionResult].find(x=>x.error);if(failure)throw failure.error;
    setClients(clientResult.data||[]);setRoutines(routineResult.data||[]);setMeasurements(measureResult.data||[]);setSessions(sessionResult.data||[]);
  },[session]);

  useEffect(()=>{fetch('/data/exercises.json').then(r=>r.json()).then(setExercises).catch(()=>{});},[]);
  useEffect(()=>{if(!supabase){setLoading(false);return;}(async()=>{try{const {data}=await supabase.auth.getSession();const current=data.session;if(current){const {data:p,error:pe}=await supabase.from('fc_profiles').select('*').eq('user_id',current.user.id).maybeSingle();if(pe)throw pe;if(['admin','trainer'].includes(p?.role)){if(p.role==='admin'){const {data:aal}=await supabase.auth.mfa.getAuthenticatorAssuranceLevel();if(aal?.currentLevel!=='aal2'){await supabase.auth.signOut();throw new Error('Tu sesión de administrador requiere verificación en dos pasos. Inicia sesión de nuevo.');}}setSession(current);setProfile(p);}else await supabase.auth.signOut();}}catch(cause){if(!navigator.onLine&&(await supabase.auth.getSession()).data.session){const cached=(await supabase.auth.getSession()).data.session;setSession(cached);setProfile({user_id:cached.user.id,full_name:cached.user.email,role:cached.user.app_metadata?.role});}else notify(errorMessage(cause,'No se pudo restaurar la sesión.'));}finally{setLoading(false);}})();const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{if(!next){setSession(null);setProfile(null);setClients([]);setRoutines([]);setMeasurements([]);setSessions([]);setModal(null);setFilter('');setExerciseFilter('');setSelectedClient('all');}});return()=>subscription.unsubscribe();},[notify]);
  useEffect(()=>{if(session)loadData().catch(e=>notify(e.message));},[session,loadData,notify]);
  useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);addEventListener('online',on);addEventListener('offline',off);return()=>{removeEventListener('online',on);removeEventListener('offline',off);};},[]);

  const mineDrafts=()=>readDrafts().filter(d=>d.userId===session?.user?.id);
  function queueDraft(draft){saveDrafts([...readDrafts(),{id:crypto.randomUUID(),queuedAt:new Date().toISOString(),userId:session.user.id,...draft}]);setDraftCount(mineDrafts().length);}
  /** Ejecuta `run` en línea; si no hay red (o falla la red a medio camino) guarda el cambio como borrador. Devuelve true si se encoló. */
  async function runOrQueue(draft,run){
    if(!online){queueDraft(draft);return true;}
    try{await run();return false;}catch(cause){if(isNetworkError(cause)){queueDraft(draft);return true;}throw cause;}
  }
  const clientRpcArgs=(p)=>({p_full_name:p.full_name,p_email:p.email,p_phone:p.phone,p_goal:p.goal,p_height_cm:p.height_cm,p_birth_date:p.birth_date,p_notes:p.notes});
  const measurementRpcArgs=(f)=>{const n=v=>v===''||v==null?null:Number(v);return {p_client_id:Number(f.client_id),p_measured_on:f.measured_on,p_weight_kg:n(f.weight_kg),p_body_fat_percent:n(f.body_fat_percent),p_muscle_mass_kg:n(f.muscle_mass_kg),p_waist_cm:n(f.waist_cm),p_notes:f.notes?.trim()||null};};
  async function recordMeasurement(form){const {error}=await supabase.rpc('fc_record_body_measurement',measurementRpcArgs(form));if(error)throw error;}
  async function saveClient(form){
    const payload={full_name:form.full_name.trim(),email:form.email?.trim()||null,phone:form.phone?.trim()||null,status:form.status,goal:form.goal?.trim()||null,height_cm:form.height_cm?Number(form.height_cm):null,birth_date:form.birth_date||null,notes:form.notes?.trim()||null,archived_at:form.status==='archived'?(form.archived_at||new Date().toISOString()):null};
    if(!['trainer','admin'].includes(tokenAppRole(session)))throw new Error(`La sesión tiene rol "${tokenAppRole(session)}" en lugar de "trainer". Cierra sesión y vuelve a entrar.`);
    const draft={type:'client',action:form.id?'update':'insert',recordId:form.id,payload};
    const queued=await runOrQueue(draft,async()=>{
      if(form.id){let q=supabase.from('fc_clients').update(payload).eq('id',form.id);if(form.updated_at)q=q.eq('updated_at',form.updated_at);const {data:rows,error}=await q.select('id');if(error)throw error;if(!rows?.length)throw new Error('No se guardó: el expediente cambió desde que lo abriste o no tienes permiso. Recarga e inténtalo de nuevo.');return;}
      const {data:created,error}=await supabase.rpc('fc_create_client',clientRpcArgs(payload));if(error)throw error;
      if(form.initial_weight_kg)await recordMeasurement({client_id:created.id,measured_on:localDate(),weight_kg:form.initial_weight_kg});
      if(created?.email){try{await invite(created);}catch(cause){await loadData();throw new Error(`Paciente creado, pero la invitación falló: ${await functionErrorMessage(cause)}`);}}
    });
    if(queued){notify('Sin conexión: el cambio se enviará automáticamente cuando vuelva Internet.');return;}
    await loadData();notify(form.id?'Paciente guardado.':'Paciente creado e invitación enviada.');
  }
  async function saveMeasurement(form){
    const queued=await runOrQueue({type:'measurement',payload:measurementRpcArgs(form)},()=>recordMeasurement(form));
    if(queued){notify('Sin conexión: la medición se enviará cuando vuelva Internet.');return;}
    await loadData();notify('Medición guardada.');
  }

  async function invite(client){const {error}=await supabase.functions.invoke('invite-patient',{body:{client_id:client.id,email:client.email,full_name:client.full_name}});if(error)throw error;await loadData();notify('Invitación enviada por correo.');}
  async function archive(client){if(!confirm(`¿Dar de baja a ${client.full_name}? Sus datos se conservarán.`))return;const {data:rows,error}=await supabase.from('fc_clients').update({status:'archived',archived_at:new Date().toISOString()}).eq('id',client.id).select('id');if(error)throw error;if(!rows?.length)throw new Error('No se pudo dar de baja: sin permiso o el paciente ya no existe.');await loadData();notify('Paciente dado de baja.');}
  async function reactivate(client){const {data:rows,error}=await supabase.from('fc_clients').update({status:'active',archived_at:null}).eq('id',client.id).select('id');if(error)throw error;if(!rows?.length)throw new Error('No se pudo reactivar: sin permiso.');await loadData();notify('Paciente reactivado.');}
  async function saveRoutine(routine){
    const args=buildRoutinePayload(routine);
    const queued=await runOrQueue({type:'routine',payload:args},async()=>{const {error}=await supabase.rpc('fc_create_routine',args);if(error)throw error;});
    if(queued){notify('Sin conexión: la rutina se enviará cuando vuelva Internet.');return;}
    await loadData();notify('Rutina asignada.');
  }
  const syncing=useRef(false);
  const draftLabel=(d)=>({client:'Paciente',routine:'Rutina',measurement:'Medición'}[d.type]||d.type);
  async function sendDraft(draft){const p=draft.payload;let result;
    if(draft.type==='client')result=draft.action==='update'?await supabase.from('fc_clients').update(p).eq('id',draft.recordId).select('id'):await supabase.rpc('fc_create_client',clientRpcArgs(p));
    else if(draft.type==='routine')result=await supabase.rpc('fc_create_routine',p);
    else if(draft.type==='measurement')result=await supabase.rpc('fc_record_body_measurement',p);
    else throw new Error(`Tipo de borrador desconocido: ${draft.type}`);
    if(result.error)throw result.error;
    if(draft.type==='client'&&draft.action==='update'&&!result.data?.length)throw new Error('El paciente ya no existe o no tienes permiso para modificarlo.');}
  /** Envía los borradores uno por uno. Un error de red detiene el envío; un error de datos marca ese borrador y continúa. */
  async function syncDrafts(silent=false){if(syncing.current||!supabase||!session)return;syncing.current=true;let done=0,failed=0;
    try{if(!mineDrafts().length){if(!silent)notify('No hay borradores pendientes.');return;}
      for(const draft of mineDrafts()){
        try{await sendDraft(draft);saveDrafts(readDrafts().filter(d=>d.id!==draft.id));done++;}
        catch(cause){if(isNetworkError(cause))throw cause;failed++;saveDrafts(readDrafts().map(d=>d.id===draft.id?{...d,error:errorMessage(cause)}:d));}
      }
      setDraftCount(mineDrafts().length);if(done)await loadData();
      notify(failed?`${done} enviado(s); ${failed} requieren revisión en Ajustes.`:`${done} cambio(s) sincronizado(s).`);
    }finally{syncing.current=false;setDraftCount(mineDrafts().length);}}
  const discardDraft=(id)=>{saveDrafts(readDrafts().filter(d=>d.id!==id));setDraftCount(mineDrafts().length);};
  useEffect(()=>{setDraftCount(mineDrafts().length);},[session]);
  const [clientStatus,setClientStatus]=useState('all');const [menuOpen,setMenuOpen]=useState(false);const menuRef=useRef(null);
  const [exerciseMuscle,setExerciseMuscle]=useState('');const [exerciseLimit,setExerciseLimit]=useState(EXERCISE_PAGE);
  useEffect(()=>{if(!menuOpen)return;const close=(e)=>{if(e.type==='keydown'?e.key==='Escape':!menuRef.current?.contains(e.target))setMenuOpen(false);};document.addEventListener('mousedown',close);document.addEventListener('keydown',close);return()=>{document.removeEventListener('mousedown',close);document.removeEventListener('keydown',close);};},[menuOpen]);
  useEffect(()=>{if(online&&session&&mineDrafts().length)syncDrafts(true).catch(e=>notify(errorMessage(e)));},[online,session]);

  if(loading)return <main className="login"><div className="login-card">Cargando FitCoach…</div></main>;
  if(!session)return <Login onReady={(s,p)=>{setSession(s);setProfile(p);}}/>;
  const visible=clients.filter(c=>matchesClientFilter(c,clientStatus)&&(!filter||[c.full_name,c.email,c.phone,c.goal].join(' ').toLowerCase().includes(filter.toLowerCase())));const active=clients.filter(c=>c.status==='active').length;const invited=clients.filter(isInvitePending).length;const archived=clients.filter(c=>c.status==='archived').length;const selected=selectedClient==='all'?measurements:measurements.filter(x=>String(x.client_id)===String(selectedClient));
  const topbar=(title,eyebrow,actions)=><header className="page-head"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div><div className="top-actions">{actions}{title==='Progreso'&&<button className="button primary" disabled={!clients.some(c=>c.status!=='archived')} onClick={()=>setModal({type:'measurement'})}>+ Nueva medición</button>}</div></header>;
  return <div className="app-shell"><header className="appbar"><div className="appbar-inner"><div className="brand"><span className="brand-mark">↗</span><span>FitCoach</span></div><nav className="nav" aria-label="Secciones">{NAV.map(([id,label])=><button key={id} className={view===id?'active':''} aria-current={view===id?'page':undefined} onClick={()=>setView(id)}>{label}</button>)}</nav><div className="appbar-right"><span className={`status-pill ${online?'':'offline'}`} title={online?'Con conexión':'Sin conexión: los cambios se guardan en este equipo'}><span className={`online-dot ${online?'':'offline-dot'}`}/>{online?'En línea':'Sin conexión'}{draftCount>0&&<b>{draftCount}</b>}</span><div className="user-menu" ref={menuRef}><button className="user-button" aria-haspopup="menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(v=>!v)}><span className="avatar">{initials(profile?.full_name||session.user.email)}</span><span className="user-name">{profile?.full_name||session.user.email}<small>{profile?.role==='admin'?'Administrador':'Nutriólogo'}</small></span><span className="caret" aria-hidden="true">▾</span></button>{menuOpen&&<div className="menu" role="menu"><div className="menu-head">{session.user.email}</div><button role="menuitem" onClick={()=>{setView('settings');setMenuOpen(false);}}>Ajustes</button><button role="menuitem" onClick={()=>{setMenuOpen(false);syncDrafts().catch(e=>notify(errorMessage(e)));}}>Sincronizar{draftCount>0?` (${draftCount})`:''}</button><button role="menuitem" className="danger" onClick={()=>{setMenuOpen(false);supabase.auth.signOut();}}>Cerrar sesión</button></div>}</div></div></div></header><main className="main">
    {view==='dashboard'&&<>{topbar('Resumen','Administración de FitCoach',<><button className="button" onClick={()=>syncDrafts().catch(e=>notify(errorMessage(e)))}>Sincronizar</button><button className="button primary" onClick={()=>setModal({type:'client'})}>+ Nuevo paciente</button></>)}<section className="grid-metrics"><button className="metric green" onClick={()=>setView('clients')}><span className="metric-label">Pacientes activos</span><span className="metric-value">{active}</span></button><button className="metric amber"><span className="metric-label">Invitaciones pendientes</span><span className="metric-value">{invited}</span></button><button className="metric red"><span className="metric-label">Bajas</span><span className="metric-value">{archived}</span></button><button className="metric"><span className="metric-label">Sesiones completadas</span><span className="metric-value">{sessions.length}</span></button></section><section className="content-grid"><div className="card"><div className="card-header"><div><h2>Pacientes recientes</h2><p>Expedientes y seguimiento.</p></div></div><div className="list">{clients.slice(0,6).map(c=><button className="list-row" key={c.id} onClick={()=>setModal({type:'detail',client:c})}><span className="initials">{initials(c.full_name)}</span><span className="row-content"><strong>{c.full_name}</strong><p>{c.goal||'Sin objetivo definido'}</p></span><span className={`pill ${statusClass(c.status)}`}>{statusText(c.status)}</span></button>)}</div></div><div className="card"><div className="card-header"><div><h2>Actividad</h2><p>Datos reales de entrenamiento</p></div></div>{sessions.slice(0,6).map(s=><div className="activity" key={s.id}><i className="activity-dot"/><div><strong>{clients.find(c=>c.id===s.client_id)?.full_name||'Paciente'}</strong><p>{formatDate(s.completed_at)} · {Math.round((s.duration_seconds||0)/60)} minutos</p></div></div>)}</div></section></>}
    {view==='clients'&&<>{topbar('Pacientes','Expedientes y administración',<button className="button primary" onClick={()=>setModal({type:'client'})}>+ Nuevo paciente</button>)}<section className="card"><div className="toolbar"><input className="field" placeholder="Buscar paciente…" value={filter} onChange={e=>setFilter(e.target.value)}/><span className="muted">{visible.length} resultado(s)</span></div><div className="chips" role="group" aria-label="Filtrar por estado">{CLIENT_FILTERS.map(([id,label])=><button key={id} type="button" className={`chip${clientStatus===id?' active':''}`} onClick={()=>setClientStatus(id)}>{label}</button>)}</div></section><section className="card table-card"><div className="table-wrap"><table className="table"><thead><tr><th>Paciente</th><th>Contacto</th><th>Objetivo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visible.map(c=><tr key={c.id}><td><button className="link-button" onClick={()=>setModal({type:'detail',client:c})}>{c.full_name}</button><br/><span className="muted">{c.height_cm?`${c.height_cm} cm`:'Sin estatura'}</span></td><td>{c.email||'Sin correo'}<br/><span className="muted">{c.phone||'Sin teléfono'}</span></td><td>{c.goal||'Sin objetivo'}</td><td><span className={`pill ${statusClass(c.status)}`}>{statusText(c.status)}</span>{isInvitePending(c)&&<><br/><span className="muted">Invitación pendiente</span></>}</td><td><div className="row-actions"><button className="button small" onClick={()=>setModal({type:'client',client:c})}>Editar</button>{c.email&&!c.user_id&&<button className="button small" onClick={()=>invite(c).catch(e=>notify(errorMessage(e)))}>Invitar</button>}{c.status!=='archived'?<button className="button small danger" onClick={()=>archive(c).catch(e=>notify(errorMessage(e)))}>Baja</button>:<button className="button small" onClick={()=>reactivate(c).catch(e=>notify(errorMessage(e)))}>Reactivar</button>}</div></td></tr>)}</tbody></table>{!visible.length&&<p className="empty-row">{clients.length?'Ningún paciente coincide con la búsqueda o el filtro.':'Aún no hay pacientes. Usa “+ Nuevo paciente” para registrar el primero.'}</p>}</div></section></>}
    {view==='routines'&&<>{topbar('Rutinas','Planes de entrenamiento',<button className="button primary" onClick={()=>setModal({type:'routine'})}>+ Crear rutina</button>)}<section className="routine-grid">{routines.map(r=><article className="card" key={r.id}><div className="card-header"><div><h2>{r.name}</h2><p>{clients.find(c=>c.id===r.client_id)?.full_name||'Sin paciente'}</p></div><span className="pill active">Activa</span></div><div className="detail-list"><div className="detail-line"><span>Días</span><strong>{r.days_per_week}</strong></div><div className="detail-line"><span>Duración</span><strong>{r.session_minutes} min</strong></div><div className="detail-line"><span>Ejercicios</span><strong>{r.fc_routine_exercises?.length||0}</strong></div></div>{r.fc_routine_days?.map(d=><div className="routine-day" key={d.day_of_week}><strong>{d.label||DAY_NAMES[d.day_of_week]}</strong><ol>{r.fc_routine_exercises?.filter(x=>x.day_of_week===d.day_of_week).map(x=><li key={x.id}>{x.exercise?.name} · {x.sets}×{x.reps_min}{x.reps_max!==x.reps_min?`-${x.reps_max}`:''}</li>)}</ol></div>)}</article>)}</section></>}
    {view==='exercises'&&(()=>{const q=exerciseFilter.trim().toLowerCase();const list=exercises.filter(x=>(!exerciseMuscle||x.target===exerciseMuscle)&&(!q||[x.name,x.target,muscleInfo(x.target).es,x.category,x.equipment].join(' ').toLowerCase().includes(q)));return <>{topbar('Ejercicios','Biblioteca disponible sin conexión')}<section className="card exercise-tools"><div className="toolbar"><input className="field" placeholder="Buscar por nombre, músculo o equipo…" value={exerciseFilter} onChange={e=>{setExerciseFilter(e.target.value);setExerciseLimit(EXERCISE_PAGE);}}/><span className="muted">{list.length.toLocaleString('es-MX')} de {exercises.length.toLocaleString('es-MX')} ejercicios</span></div><div className="chips" role="group" aria-label="Filtrar por músculo"><button className={`chip ${!exerciseMuscle?'active':''}`} onClick={()=>{setExerciseMuscle('');setExerciseLimit(EXERCISE_PAGE);}}>Todos</button>{MUSCLE_FILTERS.map(m=><button key={m} className={`chip tone-${muscleInfo(m).tone} ${exerciseMuscle===m?'active':''}`} aria-pressed={exerciseMuscle===m} onClick={()=>{setExerciseMuscle(exerciseMuscle===m?'':m);setExerciseLimit(EXERCISE_PAGE);}}>{muscleInfo(m).es}</button>)}</div></section>{list.length?<section className="exercise-grid">{list.slice(0,exerciseLimit).map(x=>{const m=muscleInfo(x.target);const kind=exerciseKind(x);return <article className="exercise-card" key={x.id}><div className={`exercise-visual tone-${m.tone}`}><span className="monogram">{m.abbr}</span><span className={`kind-badge kind-${kind}`}>{KIND_LABEL[kind]}</span></div><div className="exercise-content"><h3>{x.name}</h3><div className="tags"><span className={`tag tone-${m.tone}`}>{m.es}</span><span className="tag neutral">{equipmentLabel(x.equipment)}</span></div></div></article>;})}</section>:<div className="empty">No hay ejercicios con ese filtro.</div>}{list.length>exerciseLimit&&<div className="load-more"><button className="button" onClick={()=>setExerciseLimit(n=>n+EXERCISE_PAGE)}>Mostrar más ({Math.min(EXERCISE_PAGE,list.length-exerciseLimit)})</button></div>}</>;})()}
    {view==='progress'&&<>{topbar('Progreso','Pesos, medidas y entrenamiento',<select className="select" value={selectedClient} onChange={e=>setSelectedClient(e.target.value)}><option value="all">Todos los pacientes</option>{clients.map(c=><option key={c.id} value={c.id}>{c.full_name}</option>)}</select>)}<section className="progress-grid"><article className="card"><div className="card-header"><div><h2>Peso corporal</h2><p>Evolución registrada</p></div></div><LineChart rows={selected} field="weight_kg" suffix=" kg"/></article><article className="card"><div className="card-header"><div><h2>Grasa corporal</h2><p>Porcentaje</p></div></div><LineChart rows={selected} field="body_fat_percent" color="var(--amber)" suffix="%"/></article><article className="card"><div className="card-header"><div><h2>Masa muscular</h2><p>Evolución en kilogramos</p></div></div><LineChart rows={selected} field="muscle_mass_kg" suffix=" kg"/></article><article className="card"><div className="card-header"><div><h2>Volumen levantado</h2><p>Peso × repeticiones</p></div></div><div className="metric-value">{sessions.filter(s=>selectedClient==='all'||String(s.client_id)===selectedClient).reduce((sum,s)=>sum+workoutVolume(s),0).toLocaleString('es-MX')} kg</div></article></section><section className="card"><div className="table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Paciente</th><th>Duración</th><th>Series</th><th>Repeticiones</th><th>Volumen</th></tr></thead><tbody>{sessions.filter(s=>selectedClient==='all'||String(s.client_id)===selectedClient).map(s=><tr key={s.id}><td>{formatDate(s.completed_at)}</td><td>{clients.find(c=>c.id===s.client_id)?.full_name||'—'}</td><td>{Math.round((s.duration_seconds||0)/60)} min</td><td>{s.fc_set_logs?.length||0}</td><td>{(s.fc_set_logs||[]).reduce((n,x)=>n+Number(x.reps_completed||0),0)}</td><td>{workoutVolume(s).toLocaleString('es-MX')} kg</td></tr>)}</tbody></table></div></section></>}
    {view==='settings'&&<>{topbar('Ajustes','Configuración del panel')}<section className="content-grid"><div className="card"><div className="card-header"><div><h2>Supabase</h2><p>Conexión y seguridad</p></div></div><div className="detail-list"><div className="detail-line"><span>Estado</span><strong>{isConfigured?'Conectado':'Sin configurar'}</strong></div><div className="detail-line"><span>Cuenta</span><strong>{session.user.email}</strong></div><div className="detail-line"><span>Rol del perfil</span><strong>{profile?.role}</strong></div><div className="detail-line"><span>Rol de la sesión</span><strong>{tokenAppRole(session)}</strong></div><div className="detail-line"><span>Clave secreta en navegador</span><strong>No</strong></div></div><div className="form-actions"><button className="button danger" onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button></div></div><div className="card"><div className="card-header"><div><h2>Sin conexión</h2><p>Cola de cambios locales</p></div></div><p className="muted">Hay {draftCount} cambio(s) pendientes.</p>{mineDrafts().map(d=><div className="detail-line" key={d.id}><span>{draftLabel(d)} · {formatDate(d.queuedAt)}{d.error&&<><br/><small className="draft-error">{d.error}</small></>}</span>{d.error&&<button className="button small danger" onClick={()=>discardDraft(d.id)}>Descartar</button>}</div>)}<button className="button primary" onClick={()=>syncDrafts().catch(e=>notify(e.message))}>Sincronizar ahora</button></div></section></>}
  </main>{modal?.type==='client'&&<ClientForm client={modal.client} onClose={()=>setModal(null)} onSave={saveClient} onInvite={invite}/>} {modal?.type==='measurement'&&<MeasurementForm clients={clients} initialClientId={selectedClient} onClose={()=>setModal(null)} onSave={saveMeasurement}/>} {modal?.type==='routine'&&<RoutineForm clients={clients} exercises={exercises} onClose={()=>setModal(null)} onSave={saveRoutine}/>} {modal?.type==='detail'&&<Modal title={modal.client.full_name} subtitle="Expediente del paciente" onClose={()=>setModal(null)}><div className="detail-list"><div className="detail-line"><span>Correo</span><strong>{modal.client.email||'—'}</strong></div><div className="detail-line"><span>Teléfono</span><strong>{modal.client.phone||'—'}</strong></div><div className="detail-line"><span>Objetivo</span><strong>{modal.client.goal||'—'}</strong></div><div className="detail-line"><span>Estado</span><strong>{statusText(modal.client.status)}</strong></div><div className="detail-line"><span>Estatura</span><strong>{modal.client.height_cm?`${modal.client.height_cm} cm`:'—'}</strong></div><div className="detail-line"><span>Nacimiento</span><strong>{modal.client.birth_date?formatDate(modal.client.birth_date):'—'}</strong></div><div className="detail-line"><span>Último peso</span><strong>{(()=>{const m=measurements.filter(x=>x.client_id===modal.client.id&&x.weight_kg!=null).sort((a,b)=>String(b.measured_on).localeCompare(String(a.measured_on)))[0];return m?`${m.weight_kg} kg · ${formatDate(m.measured_on)}`:'—';})()}</strong></div><div className="detail-line"><span>Rutinas</span><strong>{routines.filter(r=>r.client_id===modal.client.id).length}</strong></div><div className="detail-line"><span>Alta</span><strong>{formatDate(modal.client.created_at)}</strong></div></div><h3 className="notes-title">Notas</h3><p className="muted">{modal.client.notes||'Sin notas registradas.'}</p><div className="form-actions"><button className="button" onClick={()=>setModal(null)}>Cerrar</button><button className="button primary" onClick={()=>setModal({type:'client',client:modal.client})}>Editar</button></div></Modal>}{toast&&<div className="statusbar">{toast}</div>}</div>;
}
