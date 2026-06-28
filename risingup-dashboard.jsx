import { useState, useCallback, useEffect } from "react";

// ─── SUPABASE CONFIG ────────────────────────────────────────────────────────
const SUPABASE_URL = "https://ppbqygqpwxjtzusqisnd.supabase.co";
const SUPABASE_KEY = "sb_publishable_1G2GkaJK-eblL7of1FfWLA_hERDKesF";

// Usuarios de fallback cuando Supabase no es accesible (artifact de Claude.ai)
const FALLBACK_USERS = [
  { id:"0", email:"gabi@risingup.com",    password:"admin123",   role:"admin",     name:"Gabi",           avatar:"GA" },
  { id:"1", email:"vale@risingup.com",    password:"vale123",    role:"executive", name:"Valentina Rios",  avatar:"VR" },
  { id:"2", email:"marcos@risingup.com",  password:"marcos123",  role:"executive", name:"Marcos Diaz",     avatar:"MD" },
  { id:"3", email:"lucas@risingup.com",   password:"lucas123",   role:"filmmaker", name:"Lucas Filmmaker", avatar:"LF" },
];

const mkR = (clientId, type, analysis, status, comment="") => ({
  id: `${clientId}-${type}`,
  client_id: clientId,
  type, analysis, status, comment,
  created_at: new Date(Date.now() - Math.random()*3*86400000).toISOString()
});

const FALLBACK_CLIENTS = [
  {
    id:"c1", name:"Spa Dental", executive_id:"1", rubro:"salud",
    last_update: new Date(Date.now()-2*86400000).toISOString(),
    kpis:{ leadsObjetivo:40, cplMin:400, cplMax:2000, roasObjetivo:0 },
    servicios:{ metaCampanas:3, googleCampanas:0, inversion:150000, detalle:"3 campanas Meta: trafico, conversion y remarketing" },
    grupo:{ ejecutivo:"Valentina Rios", filmmaker:"", clienteContacto:"Florencia" },
    global_analysis:null, admin_note:""
  },
  {
    id:"c2", name:"DWS", executive_id:"1", rubro:"servicios",
    last_update: new Date(Date.now()-6*86400000).toISOString(),
    kpis:{ leadsObjetivo:20, cplMin:500, cplMax:3000, roasObjetivo:2.5 },
    servicios:{ metaCampanas:3, googleCampanas:3, inversion:500000, detalle:"3 Meta + 3 Google. Meta: trafico, leads, remarketing. Google: branded, generico, display." },
    grupo:{ ejecutivo:"Valentina Rios", filmmaker:"Lucas Gomez", clienteContacto:"Martin DWS" },
    global_analysis:null, admin_note:"Vale: llamalo hoy. Coordina reunion con los tres esta semana."
  },
  {
    id:"c3", name:"Parrilla a Punto", executive_id:"2", rubro:"gastronomia",
    last_update: new Date(Date.now()-1*86400000).toISOString(),
    kpis:{ leadsObjetivo:30, cplMin:400, cplMax:2500, roasObjetivo:0 },
    servicios:{ metaCampanas:5, googleCampanas:0, inversion:80000, detalle:"5 campanas Meta: trafico, engagement x2, conversion, remarketing." },
    grupo:{ ejecutivo:"Marcos Diaz", filmmaker:"", clienteContacto:"Roberto" },
    global_analysis:null, admin_note:""
  },
];

const FALLBACK_REPORTS = [
  mkR("c1","meta","Van 28 leads a CPL $1.450 — en camino al objetivo de 40. Presupuesto ejecutado 72%. Campana saludable.","green"),
  mkR("c1","whatsapp","Cliente satisfecho. Tono positivo. Pregunto por el informe mensual.","green"),
  mkR("c2","meta","ROAS 1.8x por debajo del objetivo 2.5x. CPL $3.800 supera el maximo de $3.000. Creativos quemados, frecuencia alta.","red","Hable con el cliente, pidio nuevos creativos. Sesion de fotos el jueves."),
  mkR("c2","google","CPC $12.4 elevado. Solo 6 de 20 conversiones objetivo. Palabras genericas consumiendo sin convertir.","yellow"),
  mkR("c2","whatsapp","Cliente expreso disconformidad directa: no esta viendo retorno. Requiere atencion urgente hoy.","red","Ya lo llame. Reunion viernes con Gabi."),
  mkR("c3","meta","18 leads a CPL $1.900 — ritmo normal para mitad de mes. Objetivo 30 alcanzable.","green","Cuenta 2 dias sin saldo. Pedi recarga, cliente confirmo hoy."),
  mkR("c3","whatsapp","Cliente confirmo recarga de saldo. Tono positivo y colaborativo.","green"),
];

const sb = async (path, options = {}) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      "Content-Type": "application/json",
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Prefer": options.prefer || "return=representation",
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

const db = {
  // USERS
  getUsers: () => sb("users?select=*"),
  addUser: (u) => sb("users", { method: "POST", body: JSON.stringify(u) }),

  // CLIENTS
  getClients: () => sb("clients?select=*"),
  addClient: (c) => sb("clients", { method: "POST", body: JSON.stringify(c) }),
  updateClient: (id, data) => sb(`clients?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data), prefer: "return=minimal" }),

  // REPORTS
  getReports: () => sb("reports?select=*&order=created_at.desc"),
  addReport: (r) => sb("reports", { method: "POST", body: JSON.stringify(r) }),
  updateReport: (id, data) => sb(`reports?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(data), prefer: "return=minimal" }),
  deleteReport: (clientId, type) => sb(`reports?client_id=eq.${clientId}&type=eq.${type}`, { method: "DELETE", prefer: "return=minimal" }),
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
const RUBROS = ["ecommerce","salud","gastronomia","servicios","educacion","inmobiliaria","otro"];
const STATUS = {
  green:  { label:"OK",      color:"#22c55e", bg:"#f0fdf4", border:"#86efac" },
  yellow: { label:"Revisar", color:"#f59e0b", bg:"#fffbeb", border:"#fcd34d" },
  red:    { label:"Urgente", color:"#ef4444", bg:"#fef2f2", border:"#fca5a5" },
};

const daysSince = (iso) => Math.floor((Date.now() - new Date(iso)) / 86400000);

const getLatestReport = (reports, clientId, type) =>
  reports.find(r => r.client_id === clientId && r.type === type);

const getHistory = (reports, clientId, type) =>
  reports.filter(r => r.client_id === clientId && r.type === type)
         .sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

const computeStatus = (client, reports) => {
  const days = daysSince(client.last_update || client.created_at);
  const types = ["meta","google","whatsapp"];
  const hasRed = types.some(t => getLatestReport(reports, client.id, t)?.status === "red");
  if (hasRed || days >= 5) return "red";
  const hasYellow = types.some(t => getLatestReport(reports, client.id, t)?.status === "yellow");
  const metaUp = !!getLatestReport(reports, client.id, "meta");
  const waUp   = !!getLatestReport(reports, client.id, "whatsapp");
  if (hasYellow || !metaUp || !waUp || days >= 3) return "yellow";
  return "green";
};

// ─── SHARED UI ──────────────────────────────────────────────────────────────
const inp = { padding:"9px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontFamily:"'DM Mono',monospace", fontSize:12, width:"100%", boxSizing:"border-box" };
const btn = { background:"#0f172a", color:"#fff", border:"none", borderRadius:10, padding:"8px 18px", fontSize:12, fontFamily:"'DM Mono',monospace", cursor:"pointer", fontWeight:600 };
const bsm = { background:"#f1f5f9", color:"#334155", border:"1px solid #e2e8f0", borderRadius:8, padding:"6px 12px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer" };
const brd = { background:"#fef2f2", color:"#ef4444", border:"1px solid #fca5a5", borderRadius:8, padding:"6px 12px", fontSize:11, fontFamily:"'DM Mono',monospace", cursor:"pointer", fontWeight:600 };

function Av({ initials, size=36, color="#0f172a" }) {
  return <div style={{ width:size, height:size, borderRadius:"50%", background:color, color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Mono',monospace", fontSize:size*0.35, fontWeight:600, flexShrink:0 }}>{initials}</div>;
}
function Badge({ status }) {
  if (!status) return null;
  const c = STATUS[status];
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:c.bg, color:c.color, border:`1px solid ${c.border}`, borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>
    <span style={{ width:6, height:6, borderRadius:"50%", background:c.color, display:"inline-block" }}/>{c.label}
  </span>;
}
function Pill({ children, active, onClick }) {
  return <button onClick={onClick} style={{ padding:"6px 16px", borderRadius:20, border:"none", cursor:"pointer", fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:500, background:active?"#0f172a":"transparent", color:active?"#fff":"#64748b" }}>{children}</button>;
}
function Spinner() {
  return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60 }}>
    <div style={{ width:32, height:32, border:"3px solid #e2e8f0", borderTopColor:"#0f172a", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

// ─── LOGIN ──────────────────────────────────────────────────────────────────
function Login({ onLogin, users }) {
  const [email,setEmail] = useState("");
  const [pass,setPass]   = useState("");
  const [err,setErr]     = useState("");
  const [loading,setLoading] = useState(false);

  const go = async () => {
    setLoading(true);
    const u = users.find(u => u.email === email.trim() && u.password === pass);
    if (u) { onLogin(u); }
    else { setErr("Email o contraseña incorrectos"); }
    setLoading(false);
  };

  return (
    <div style={{ minHeight:"100vh", background:"#0f172a", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"#fff", borderRadius:20, padding:"40px 36px", width:"100%", maxWidth:380, boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:28 }}>
          <span style={{ fontSize:28 }}>⚡</span>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:24, fontWeight:700, color:"#0f172a" }}>RisingUp</span>
        </div>
        <p style={{ margin:"0 0 20px", fontSize:12, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Supervisor IA — Ingresá con tu cuenta</p>
        <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
          {[["EMAIL","email","tu@email.com",email,setEmail],["CONTRASEÑA","password","••••••••",pass,setPass]].map(([lbl,t,ph,v,set])=>(
            <div key={lbl}>
              <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
              <input style={inp} type={t} placeholder={ph} value={v} onChange={e=>{set(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&go()}/>
            </div>
          ))}
        </div>
        {err && <p style={{ margin:"0 0 10px", fontSize:12, color:"#ef4444", fontFamily:"'DM Mono',monospace" }}>{err}</p>}
        <button style={{ ...btn, width:"100%", padding:"11px", fontSize:13, opacity:loading?0.6:1 }} onClick={go} disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </div>
    </div>
  );
}

// ─── HISTORY DRAWER ─────────────────────────────────────────────────────────
function HistoryDrawer({ history, onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex" }}>
      <div style={{ flex:1, background:"rgba(0,0,0,0.4)" }} onClick={onClose}/>
      <div style={{ width:380, background:"#fff", overflowY:"auto", padding:24, boxShadow:"-4px 0 30px rgba(0,0,0,0.15)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <p style={{ margin:0, fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:700 }}>Historial de reportes</p>
          <button onClick={onClose} style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#94a3b8" }}>×</button>
        </div>
        {history.length === 0
          ? <p style={{ color:"#94a3b8", fontFamily:"'DM Mono',monospace", fontSize:12 }}>Sin reportes anteriores</p>
          : history.map((h,i) => (
            <div key={i} style={{ marginBottom:16, padding:14, background:"#f8fafc", borderRadius:10, border:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#64748b" }}>
                  {new Date(h.created_at).toLocaleDateString("es-AR")}
                </span>
                <Badge status={h.status}/>
              </div>
              <p style={{ margin:0, fontSize:12, color:"#475569", fontFamily:"'Lora',serif", lineHeight:1.6 }}>{h.analysis}</p>
              {h.comment && <p style={{ margin:"8px 0 0", fontSize:11, color:"#94a3b8", fontFamily:"'Lora',serif", fontStyle:"italic" }}>💬 "{h.comment}"</p>}
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── PASTE ZONE ─────────────────────────────────────────────────────────────
function PasteZone({ label, icon, report, history, onImage, onImages, onComment, loading, readOnly, isWhatsapp }) {
  const [active,setActive]   = useState(false);
  const [editCom,setEditCom] = useState(false);
  const [draft,setDraft]     = useState(report?.comment || "");
  const [showHistory,setShowHistory] = useState(false);
  const [pending,setPending] = useState([]);

  const uploaded = !!report;
  const zs = report?.status;
  const analysis = report?.analysis;
  const comment  = report?.comment || "";

  const handlePaste = useCallback((e) => {
    if (readOnly) return;
    const items = e.clipboardData?.items; if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (isWhatsapp) { setPending(p => [...p, { file, preview: URL.createObjectURL(file) }]); }
        else { onImage(file); }
        break;
      }
    }
  }, [onImage, readOnly, isWhatsapp]);

  const handleFile = (e) => {
    const files = Array.from(e.target.files); if (!files.length) return;
    if (isWhatsapp) { setPending(p => [...p, ...files.map(f => ({ file:f, preview:URL.createObjectURL(f) }))]); }
    else { onImage(files[0]); }
  };

  const bc = active?"#6366f1": uploaded?(STATUS[zs]?.border||"#86efac"):"#e2e8f0";
  const bg = uploaded?(zs==="red"?"#fef2f2":zs==="yellow"?"#fffbeb":"#f0fdf4"):active?"#f5f3ff":"#f8fafc";

  return (
    <>
      {showHistory && <HistoryDrawer history={history} onClose={()=>setShowHistory(false)}/>}
      <div style={{ border:`1.5px dashed ${bc}`, borderRadius:12, background:bg, overflow:"hidden", transition:"all 0.2s" }}>
        <div tabIndex={readOnly?-1:0} onFocus={()=>setActive(true)} onBlur={()=>setActive(false)} onPaste={handlePaste} style={{ padding:"14px 16px", outline:"none" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>{icon}</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:600, color:"#334155" }}>{label}</span>
              {uploaded && zs && <Badge status={zs}/>}
              {history.length > 0 && (
                <button onClick={()=>setShowHistory(true)} style={{ ...bsm, fontSize:10, padding:"2px 8px", background:"none", border:"1px solid #e2e8f0" }}>
                  🕐 {history.length} reporte{history.length>1?"s":""}
                </button>
              )}
            </div>
            {!readOnly && (
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {!pending.length && <span style={{ fontSize:11, color:active?"#6366f1":"#94a3b8", fontFamily:"'DM Mono',monospace" }}>
                  {loading?"⏳ Analizando...":active?`📋 Ctrl+V${isWhatsapp?" (varias)":""}`:"Clic → Ctrl+V"}
                </span>}
                <label style={{ ...bsm, display:"inline-block" }}>
                  {isWhatsapp?"+ Imagen":"Subir"}
                  <input type="file" accept="image/*" multiple={isWhatsapp} style={{ display:"none" }} onChange={handleFile} disabled={loading}/>
                </label>
                {uploaded && !isWhatsapp && <button onClick={()=>onImage(null)} style={{ ...bsm, fontSize:10 }}>↺</button>}
              </div>
            )}
          </div>

          {isWhatsapp && pending.length > 0 && !readOnly && (
            <div style={{ marginTop:12, padding:12, background:"rgba(99,102,241,0.05)", borderRadius:8, border:"1px solid #e0e7ff" }}>
              <p style={{ margin:"0 0 8px", fontSize:11, fontFamily:"'DM Mono',monospace", color:"#6366f1", fontWeight:600 }}>
                📸 {pending.length} imagen{pending.length>1?"es":""} — podés seguir pegando más
              </p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                {pending.map((img,i) => (
                  <div key={i} style={{ position:"relative" }}>
                    <img src={img.preview} alt="" style={{ width:60, height:60, objectFit:"cover", borderRadius:6, border:"1px solid #e2e8f0" }}/>
                    <button onClick={()=>setPending(p=>p.filter((_,idx)=>idx!==i))} style={{ position:"absolute", top:-6, right:-6, background:"#ef4444", color:"#fff", border:"none", borderRadius:"50%", width:18, height:18, fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>×</button>
                  </div>
                ))}
              </div>
              <button onClick={()=>{ onImages(pending.map(p=>p.file)); setPending([]); }} disabled={loading} style={{ ...btn, fontSize:11, padding:"6px 14px" }}>
                {loading?"Analizando...":"🤖 Analizar conversación completa"}
              </button>
            </div>
          )}

          {analysis && <p style={{ margin:"10px 0 0", fontSize:12, color:"#475569", lineHeight:1.6, fontFamily:"'Lora',serif", borderTop:"1px solid #e2e8f0", paddingTop:10 }}>{analysis}</p>}
        </div>

        <div style={{ borderTop:`1px solid ${uploaded?(STATUS[zs]?.border||"#86efac"):"#e2e8f0"}`, background:"rgba(255,255,255,0.6)", padding:"10px 16px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
            <span style={{ fontSize:13, marginTop:2 }}>💬</span>
            <div style={{ flex:1 }}>
              <p style={{ margin:"0 0 4px", fontSize:10, fontWeight:600, color:"#94a3b8", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.06em" }}>Comentario del ejecutivo</p>
              {editCom && !readOnly ? (
                <div>
                  <textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ej: Cuenta sin saldo. Pedí recarga al cliente."
                    style={{ ...inp, minHeight:52, resize:"vertical", fontFamily:"'Lora',serif", fontStyle:"italic" }} autoFocus/>
                  <div style={{ display:"flex", gap:6, marginTop:6 }}>
                    <button onClick={()=>{ onComment(draft); setEditCom(false); }} style={btn}>Guardar</button>
                    <button onClick={()=>{ setDraft(comment); setEditCom(false); }} style={bsm}>Cancelar</button>
                  </div>
                </div>
              ) : (
                <div onClick={()=>{ if(!readOnly){ setDraft(comment); setEditCom(true); }}} style={{ cursor:readOnly?"default":"pointer" }}>
                  {comment
                    ? <p style={{ margin:0, fontSize:12, color:"#475569", lineHeight:1.6, fontFamily:"'Lora',serif", fontStyle:"italic" }}>"{comment}"</p>
                    : <p style={{ margin:0, fontSize:12, color:"#cbd5e1", fontFamily:"'DM Mono',monospace" }}>{readOnly?"Sin comentario":"+ Agregar comentario..."}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── GLOBAL ANALYSIS BOX ────────────────────────────────────────────────────
function GlobalBox({ client, loading }) {
  if (!client.global_analysis && !loading) return null;
  return (
    <div style={{ background:"#0f172a", borderRadius:14, padding:20, border:"1px solid #1e293b" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <span style={{ fontSize:20 }}>🤖</span>
        <div>
          <p style={{ margin:0, fontSize:13, fontWeight:600, fontFamily:"'DM Mono',monospace", color:"#fff" }}>
            Análisis global con contexto
          </p>
          <p style={{ margin:0, fontSize:11, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>
            {loading ? "Actualizando..." : "Actualizado automáticamente"}
          </p>
        </div>
        {loading && <div style={{ marginLeft:"auto", width:16, height:16, border:"2px solid #334155", borderTopColor:"#94a3b8", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>}
      </div>
      {client.global_analysis && !loading && (
        <div style={{ background:"#1e293b", borderRadius:10, padding:16 }}>
          <p style={{ margin:0, fontSize:13, color:"#e2e8f0", lineHeight:1.8, fontFamily:"'Lora',serif" }}>{client.global_analysis}</p>
        </div>
      )}
      {loading && (
        <div style={{ background:"#1e293b", borderRadius:10, padding:16 }}>
          <p style={{ margin:0, fontSize:13, color:"#475569", fontFamily:"'DM Mono',monospace" }}>Analizando todos los reportes...</p>
        </div>
      )}
    </div>
  );
}

// ─── EMAIL TOAST ─────────────────────────────────────────────────────────────
function EmailToast({ emails, onDismiss }) {
  if (!emails.length) return null;
  return (
    <div style={{ position:"fixed", bottom:20, right:20, zIndex:300, display:"flex", flexDirection:"column", gap:8, maxWidth:320 }}>
      {emails.map((e,i) => (
        <div key={i} style={{ background:"#0f172a", borderRadius:12, padding:"12px 14px", boxShadow:"0 8px 30px rgba(0,0,0,0.3)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
            <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace", color:"#22c55e", fontWeight:600 }}>📧 EMAIL ENVIADO</span>
            <button onClick={()=>onDismiss(i)} style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:14, padding:0 }}>×</button>
          </div>
          <p style={{ margin:"0 0 2px", fontSize:11, color:"#e2e8f0", fontFamily:"'DM Mono',monospace" }}>Para: {e.to}</p>
          <p style={{ margin:0, fontSize:11, color:"#94a3b8", fontFamily:"'Lora',serif", fontStyle:"italic" }}>{e.subject}</p>
        </div>
      ))}
    </div>
  );
}

// ─── CLIENT CARD ─────────────────────────────────────────────────────────────
function ClientCard({ client, execName, reports, onClick }) {
  const st = computeStatus(client, reports);
  const days = daysSince(client.last_update || client.created_at);
  const metaR = getLatestReport(reports, client.id, "meta");
  const goolR = getLatestReport(reports, client.id, "google");
  const waR   = getLatestReport(reports, client.id, "whatsapp");
  const comments = [metaR,goolR,waR].filter(r=>r?.comment).length;

  return (
    <div onClick={onClick} style={{ background:"#fff", border:`1px solid ${st==="red"?"#fca5a5":st==="yellow"?"#fcd34d":"#e2e8f0"}`, borderRadius:14, padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.08)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
      <Av initials={client.name.slice(0,2).toUpperCase()} size={40}/>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
          <p style={{ margin:0, fontWeight:700, fontSize:14, fontFamily:"'Fraunces',serif", color:"#0f172a" }}>{client.name}</p>
          {client.admin_note && <span title="Nota del admin">📌</span>}
        </div>
        <p style={{ margin:0, fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>
          {execName} · {client.rubro} · {days}d
          · {[metaR,goolR,waR].filter(Boolean).length}/3
          {comments>0 && <span style={{ color:"#6366f1" }}> · 💬{comments}</span>}
          {client.global_analysis && <span style={{ color:"#22c55e" }}> · 🤖</span>}
        </p>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ display:"flex", gap:4 }}>
          {[metaR,goolR,waR].map((r,i) => (
            <span key={i} style={{ width:7, height:7, borderRadius:"50%", background:r?(STATUS[r.status]?.color||"#22c55e"):"#e2e8f0" }}/>
          ))}
        </div>
        <Badge status={st}/>
        <span style={{ color:"#94a3b8" }}>›</span>
      </div>
    </div>
  );
}

// ─── CLIENT DETAIL ───────────────────────────────────────────────────────────
function ClientDetail({ client, executive, reports, isAdmin, onBack, onUpload, onComment, onGlobal, onAdminNote, sendEmail, globalLoading, onReportsChange }) {
  const [aKey,setAKey]       = useState(null);
  const [editNote,setEditNote] = useState(false);
  const [draftNote,setDraftNote] = useState(client.admin_note||"");

  const st   = computeStatus(client, reports);
  const days = daysSince(client.last_update || client.created_at);
  const kpis = client.kpis || {};
  const servicios = client.servicios || {};
  const grupo = client.grupo || {};
  const today = new Date().toLocaleDateString("es-AR");

  const metaR   = getLatestReport(reports, client.id, "meta");
  const googleR = getLatestReport(reports, client.id, "google");
  const waR     = getLatestReport(reports, client.id, "whatsapp");
  const metaH   = getHistory(reports, client.id, "meta");
  const googleH = getHistory(reports, client.id, "google");
  const waH     = getHistory(reports, client.id, "whatsapp");

  const buildPrompt = (type) => {
    const kpiTxt = `KPIs objetivo: ${kpis.leadsObjetivo} leads/mes, CPL $${kpis.cplMin}–${kpis.cplMax}${kpis.roasObjetivo>0?`, ROAS ${kpis.roasObjetivo}x`:""}. Rubro: ${client.rubro}. Hoy: ${today}.`;
    const svcTxt = `Servicios contratados: ${servicios.detalle}. Inversión pactada: $${(servicios.inversion||0).toLocaleString("es-AR")}/mes.`;
    const rep = type==="meta"?metaR:type==="google"?googleR:waR;
    const ctx = rep?.comment ? `\n\nCONTEXTO CLAVE DEL EJECUTIVO (tiene prioridad sobre lo visual): "${rep.comment}"` : "";
    const reglas = `
REGLAS DE ANÁLISIS IMPORTANTES:
- El comentario del ejecutivo es información privilegiada que explica el contexto real. Si explica una anomalía visual (campañas pausadas, números bajos, errores), tomalo como válido y ajustá tu diagnóstico.
- Campañas con "Error en el anuncio" pero con $0 gastado = no están corriendo, no son un problema activo si el cliente o el ejecutivo lo saben.
- Si el cliente pidió expresamente pausar campañas o tener solo X activas y eso se cumple, es ✅.
- Campañas con resultados buenos en las que están activas pesan más que campañas pausadas sin gasto.
- El período del screenshot puede ser de pocos días; si los resultados proyectan bien al mes completo, consideralo positivo.
- Solo usá 🔴 si hay un problema real que el ejecutivo NO mencionó ni explicó.`;
    const instruccion = "Respondé en máximo 2 oraciones en español, sin asteriscos ni markdown. Empezá con ✅ si está bien o bajo control, ⚠️ si hay algo a monitorear, o 🔴 solo si hay un problema real no explicado. Sé directo y considerá siempre el contexto del ejecutivo.";
    if (type==="meta")   return `${kpiTxt}\n${svcTxt}${ctx}\n${reglas}\n\nAnalizá este screenshot de Meta Ads. Considerá solo las campañas ACTIVAS con gasto real. Ignorá campañas pausadas o con error si tienen $0 gastado. Verificá si los resultados de las campañas activas van bien contra los KPIs. ${instruccion}`;
    if (type==="google") return `${kpiTxt}\n${svcTxt}${ctx}\n${reglas}\n\nAnalizá este screenshot de Google Ads. Considerá los resultados de las campañas activas. Si el ejecutivo aclaró el CPL u otro dato en su comentario, tomalo como válido. ${instruccion}`;
    return "";
  };

  const buildWhatsappPrompt = () => {
    const agencia = [grupo.ejecutivo, grupo.filmmaker].filter(Boolean).join(" y ");
    const ctx = waR?.comment ? `\n\nCONTEXTO DEL EJECUTIVO: "${waR.comment}"` : "";
    return `Rubro: ${client.rubro}. Hoy: ${today}.
Miembros de nuestra agencia: ${agencia||"el ejecutivo"}. Contacto(s) del cliente: ${grupo.clienteContacto||"el cliente"}.${ctx}

Estas imágenes son capturas de pantalla del celular del ejecutivo en WhatsApp Web o la app de WhatsApp.

CÓMO IDENTIFICAR QUIÉN ES QUIÉN (MUY IMPORTANTE):
- Las burbujas de color VERDE CLARO (alineadas a la derecha) son siempre del EJECUTIVO — es el dueño del dispositivo desde donde se tomó la captura. Sus mensajes aparecen en verde sin importar si su nombre está visible o no.
- Cuando el ejecutivo cita o responde un mensaje de otra persona, ese mensaje citado aparece dentro de su burbuja verde — pero sigue siendo el ejecutivo quien habla.
- Las burbujas BLANCAS o GRISES (alineadas a la izquierda) son de los demás participantes: clientes, otros miembros del grupo.
- El nombre que aparece sobre cada burbuja blanca/gris identifica al participante.
- Si hay varios participantes del lado izquierdo, el cliente principal es: ${grupo.clienteContacto||"el indicado en el contexto"}.

QUÉ ANALIZAR:
Ignorá completamente los mensajes verdes (son del ejecutivo de nuestra agencia). Analizá ÚNICAMENTE el tono, actitud y contenido de los mensajes blancos/grises del cliente (${grupo.clienteContacto||"el cliente"}) y otros participantes externos.

REGLAS DE DIAGNÓSTICO:
- Cliente con tono positivo, celebrando resultados, coordinando, respondiendo bien → ✅
- Cliente neutro, con preguntas normales o temas menores pendientes → ⚠️
- Solo 🔴 si el cliente expresa queja directa, enojo, amenaza con irse o hay silencio prolongado preocupante.
- Preguntas sobre resultados, leads o campañas son señal de interés positivo, no de problema.

Respondé en máximo 2 oraciones en español, sin asteriscos. Empezá con ✅, ⚠️ o 🔴.`;
  };

  const buildGlobalPrompt = () => {
    const agencia = [grupo.ejecutivo, grupo.filmmaker].filter(Boolean).join(" y ");
    const secs = [
      metaR   ? `[META]\nAnálisis: ${metaR.analysis}\nComentario: ${metaR.comment||"ninguno"}` : null,
      googleR ? `[GOOGLE]\nAnálisis: ${googleR.analysis}\nComentario: ${googleR.comment||"ninguno"}` : null,
      waR     ? `[WHATSAPP]\nAnálisis: ${waR.analysis}\nComentario: ${waR.comment||"ninguno"}` : null,
    ].filter(Boolean).join("\n\n");
    return `Sos supervisor de una agencia de marketing digital. Necesito un diagnóstico global HONESTO del cliente "${client.name}" (${client.rubro}).

KPIs objetivo: ${kpis.leadsObjetivo} leads/mes · CPL $${kpis.cplMin}–${kpis.cplMax}${kpis.roasObjetivo>0?` · ROAS ${kpis.roasObjetivo}x`:""}.
Servicios contratados: ${servicios.detalle}. Inversión pactada: $${(servicios.inversion||0).toLocaleString()}/mes.
En el grupo de WhatsApp nuestra agencia está representada por ${agencia}, el cliente es ${grupo.clienteContacto||"el cliente"}.

DATOS RECOPILADOS:
${secs}

INSTRUCCIONES PARA EL DIAGNÓSTICO:
- Los comentarios del ejecutivo son contexto privilegiado que explica la situación real — dales máxima prioridad.
- Si el ejecutivo explica por qué hay campañas pausadas, errores o números bajos, aceptalo como válido.
- Si el cliente solicitó cambios (pausar campañas, reducir activas) y el ejecutivo lo confirma, eso es cumplimiento, no problema.
- Evaluá el estado REAL del cliente considerando todo el contexto, no solo los números crudos.
- Solo marcá riesgo de perder al cliente si hay evidencia concreta de insatisfacción no resuelta.

Respondé en exactamente 3 oraciones en español, sin asteriscos ni markdown:
1) Estado real del cliente considerando todos los datos y comentarios del ejecutivo.
2) ¿Hay riesgo real de perder este cliente? ¿Por qué sí o por qué no?
3) La acción más importante a hacer en las próximas 48hs.
Empezá con ✅ si está bien, ⚠️ si hay algo a monitorear, o 🔴 si hay un problema urgente.`
  };

  const callClaude = async (contents) => {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:300, messages:[{role:"user",content:contents}] })
    });
    const data = await resp.json();
    return data.content?.[0]?.text || "No se pudo analizar.";
  };

  const fileToB64 = (file) => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });

  const handleImage = async (type, file) => {
    if (file === null) { await db.deleteReport(client.id, type); onReportsChange(); return; }
    setAKey(`${client.id}-${type}`);
    try {
      const b64  = await fileToB64(file);
      const text = await callClaude([
        { type:"image", source:{ type:"base64", media_type:file.type, data:b64 } },
        { type:"text",  text: buildPrompt(type) }
      ]);
      const zs = text.startsWith("🔴")?"red":text.startsWith("⚠️")?"yellow":"green";
      await onUpload(client.id, type, text, zs);
      // Auto-trigger global analysis after upload
      handleGlobal(true);
    } catch { await onUpload(client.id, type, "Error al analizar. Intentá de nuevo.", "yellow"); }
    finally { setAKey(null); }
  };

  const handleWhatsappImages = async (files) => {
    setAKey(`${client.id}-whatsapp`);
    try {
      const imgContents = await Promise.all(files.map(async f => ({ type:"image", source:{ type:"base64", media_type:f.type, data:await fileToB64(f) } })));
      imgContents.push({ type:"text", text:buildWhatsappPrompt() });
      const text = await callClaude(imgContents);
      const zs = text.startsWith("🔴")?"red":text.startsWith("⚠️")?"yellow":"green";
      await onUpload(client.id, "whatsapp", text, zs);
      // Auto-trigger global analysis after upload
      handleGlobal(true);
    } catch { await onUpload(client.id, "whatsapp", "Error al analizar.", "yellow"); }
    finally { setAKey(null); }
  };

  const handleGlobal = async (auto = false) => {
    // Only auto-run if we have at least one report
    const hasData = metaR || googleR || waR;
    if (!hasData) return;
    onGlobal(client.id, null, true);
    // Small delay on auto so the new report is saved first
    if (auto) await new Promise(r => setTimeout(r, 800));
    try {
      const text = await callClaude([{ type:"text", text:buildGlobalPrompt() }]);
      onGlobal(client.id, text, false);
    } catch { onGlobal(client.id, "Error al generar análisis global.", false); }
  };

  const saveNote = async () => {
    await onAdminNote(client.id, draftNote);
    setEditNote(false);
    if (draftNote.trim()) sendEmail({ to:executive?.email, subject:`📌 Nota de Gabi sobre "${client.name}"`, body:draftNote });
  };

  const clientWithMeta = { ...client, _meta:metaR, _google:googleR, _whatsapp:waR };

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", fontFamily:"'DM Mono',monospace", fontSize:12, padding:0, marginBottom:18, display:"flex", alignItems:"center", gap:6 }}>← Volver</button>

      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
        <Av initials={client.name.slice(0,2).toUpperCase()} size={50}/>
        <div style={{ flex:1 }}>
          <h2 style={{ margin:"0 0 3px", fontFamily:"'Fraunces',serif", fontSize:20, color:"#0f172a" }}>{client.name}</h2>
          <p style={{ margin:0, fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>{executive?.name} · {client.rubro} · actualizado hace {days}d</p>
        </div>
        <Badge status={st}/>
      </div>

      {/* KPI chips */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
        {[
          kpis.leadsObjetivo && `🎯 ${kpis.leadsObjetivo} leads/mes`,
          kpis.cplMin && `💰 CPL $${kpis.cplMin?.toLocaleString()}–$${kpis.cplMax?.toLocaleString()}`,
          kpis.roasObjetivo>0 && `📈 ROAS ${kpis.roasObjetivo}x`,
          servicios.metaCampanas>0 && `📘 ${servicios.metaCampanas} camp. Meta`,
          servicios.googleCampanas>0 && `🔍 ${servicios.googleCampanas} camp. Google`,
          servicios.inversion && `💵 $${servicios.inversion?.toLocaleString()}/mes`,
        ].filter(Boolean).map((t,i)=>(
          <span key={i} style={{ background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0", borderRadius:20, padding:"3px 10px", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{t}</span>
        ))}
      </div>
      {servicios.detalle && <p style={{ margin:"0 0 8px", fontSize:11, color:"#94a3b8", fontFamily:"'Lora',serif", fontStyle:"italic" }}>📋 {servicios.detalle}</p>}

      {/* Grupo chips */}
      {(grupo.ejecutivo||grupo.clienteContacto) && (
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {grupo.ejecutivo && <span style={{ background:"#ede9fe", color:"#6d28d9", border:"1px solid #ddd6fe", borderRadius:20, padding:"3px 10px", fontSize:11, fontFamily:"'DM Mono',monospace" }}>👤 {grupo.ejecutivo}</span>}
          {grupo.filmmaker && <span style={{ background:"#ede9fe", color:"#6d28d9", border:"1px solid #ddd6fe", borderRadius:20, padding:"3px 10px", fontSize:11, fontFamily:"'DM Mono',monospace" }}>🎬 {grupo.filmmaker}</span>}
          {grupo.clienteContacto && <span style={{ background:"#f0fdf4", color:"#15803d", border:"1px solid #bbf7d0", borderRadius:20, padding:"3px 10px", fontSize:11, fontFamily:"'DM Mono',monospace" }}>🙋 {grupo.clienteContacto}</span>}
        </div>
      )}

      {/* Alerta inactividad */}
      {days >= 3 && (
        <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#dc2626", fontFamily:"'DM Mono',monospace", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>⏰ Sin actualización hace {days} días</span>
          {isAdmin && <button style={brd} onClick={()=>sendEmail({ to:executive?.email, subject:`⏰ Alerta: "${client.name}" sin actualización hace ${days} días`, body:`El cliente ${client.name} lleva ${days} días sin reporte.` })}>Alertar al ejecutivo</button>}
        </div>
      )}

      {/* Nota admin */}
      {isAdmin && (
        <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:editNote||client.admin_note?8:0 }}>
            <p style={{ margin:0, fontSize:10, fontWeight:600, color:"#854F0B", fontFamily:"'DM Mono',monospace", textTransform:"uppercase" }}>📌 Nota para el ejecutivo</p>
            {!editNote && <button style={{ ...bsm, background:"#fef3c7", border:"1px solid #fcd34d", color:"#854F0B", fontSize:10 }} onClick={()=>{ setDraftNote(client.admin_note||""); setEditNote(true); }}>{client.admin_note?"Editar":"+ Agregar"}</button>}
          </div>
          {editNote ? (
            <div>
              <textarea value={draftNote} onChange={e=>setDraftNote(e.target.value)} placeholder="Ej: Vale, llamá al cliente hoy."
                style={{ ...inp, minHeight:56, resize:"vertical", fontFamily:"'Lora',serif", fontStyle:"italic", background:"#fffbeb", border:"1px solid #fcd34d" }} autoFocus/>
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                <button style={{ ...btn, background:"#854F0B" }} onClick={saveNote}>Guardar y enviar email</button>
                <button style={bsm} onClick={()=>setEditNote(false)}>Cancelar</button>
              </div>
            </div>
          ) : client.admin_note ? (
            <p style={{ margin:0, fontSize:12, color:"#854F0B", fontFamily:"'Lora',serif", fontStyle:"italic" }}>"{client.admin_note}"</p>
          ) : null}
        </div>
      )}

      {/* Nota admin visible para ejecutivo */}
      {!isAdmin && client.admin_note && (
        <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
          <p style={{ margin:"0 0 4px", fontSize:10, fontWeight:600, color:"#854F0B", fontFamily:"'DM Mono',monospace", textTransform:"uppercase" }}>📌 Nota de Gabi</p>
          <p style={{ margin:0, fontSize:12, color:"#854F0B", fontFamily:"'Lora',serif", fontStyle:"italic" }}>"{client.admin_note}"</p>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
        <PasteZone label="Meta Ads" icon="📊" report={metaR} history={metaH}
          onImage={isAdmin?()=>{}:(f)=>handleImage("meta",f)}
          onComment={async(c)=>{ await onComment(client.id,"meta",c,metaR); handleGlobal(true); }}
          loading={aKey===`${client.id}-meta`} readOnly={isAdmin} isWhatsapp={false}/>
        <PasteZone label="Google Ads" icon="🔍" report={googleR} history={googleH}
          onImage={isAdmin?()=>{}:(f)=>handleImage("google",f)}
          onComment={async(c)=>{ await onComment(client.id,"google",c,googleR); handleGlobal(true); }}
          loading={aKey===`${client.id}-google`} readOnly={isAdmin} isWhatsapp={false}/>
        <PasteZone label="WhatsApp — Atención al cliente" icon="💬" report={waR} history={waH}
          onImage={isAdmin?()=>{}:(f)=>handleImage("whatsapp",f)}
          onImages={!isAdmin?handleWhatsappImages:undefined}
          onComment={async(c)=>{ await onComment(client.id,"whatsapp",c,waR); handleGlobal(true); }}
          loading={aKey===`${client.id}-whatsapp`} readOnly={isAdmin} isWhatsapp={true}/>
      </div>

      <GlobalBox client={clientWithMeta} loading={globalLoading}/>
    </div>
  );
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDash({ clients, users, reports, onAddUser, onAddClient, onOpen, sendEmail }) {
  const [tab,setTab]       = useState("clients");
  const [showUF,setShowUF] = useState(false);
  const [showCF,setShowCF] = useState(false);
  const [uf,setUf] = useState({ name:"",email:"",password:"",role:"executive" });
  const [cf,setCf] = useState({ name:"",executiveId:"",rubro:"servicios",
    kpis:{ leadsObjetivo:30,cplMin:400,cplMax:2500,roasObjetivo:0 },
    servicios:{ metaCampanas:3,googleCampanas:0,inversion:100000,detalle:"" },
    grupo:{ ejecutivo:"",filmmaker:"",clienteContacto:"" } });
  const [saving,setSaving] = useState(false);

  const execs = users.filter(u=>u.role==="executive"||u.role==="filmmaker");
  const reds    = clients.filter(c=>computeStatus(c,reports)==="red").length;
  const yellows = clients.filter(c=>computeStatus(c,reports)==="yellow").length;

  const handleAddClient = async () => {
    if (!cf.name||!cf.executiveId) return;
    setSaving(true);
    await onAddClient(cf);
    setCf({ name:"",executiveId:"",rubro:"servicios", kpis:{ leadsObjetivo:30,cplMin:400,cplMax:2500,roasObjetivo:0 }, servicios:{ metaCampanas:3,googleCampanas:0,inversion:100000,detalle:"" }, grupo:{ ejecutivo:"",filmmaker:"",clienteContacto:"" } });
    setShowCF(false); setSaving(false);
  };

  const handleAddUser = async () => {
    if (!uf.name||!uf.email||!uf.password) return;
    setSaving(true);
    await onAddUser(uf);
    setUf({ name:"",email:"",password:"" }); setShowUF(false); setSaving(false);
  };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:24 }}>
        {[{label:"Clientes activos",value:clients.length,color:"#0f172a"},{label:"Requieren atención",value:reds+yellows,color:"#f59e0b"},{label:"Estado crítico",value:reds,color:"#ef4444"}].map((k,i)=>(
          <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"16px 18px" }}>
            <p style={{ margin:"0 0 4px", fontSize:10, color:"#94a3b8", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.08em" }}>{k.label}</p>
            <p style={{ margin:0, fontSize:30, fontWeight:700, color:k.color, fontFamily:"'Fraunces',serif" }}>{k.value}</p>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:4, background:"#f1f5f9", borderRadius:24, padding:4, marginBottom:18, width:"fit-content" }}>
        <Pill active={tab==="clients"} onClick={()=>setTab("clients")}>Clientes</Pill>
        <Pill active={tab==="executives"} onClick={()=>setTab("executives")}>Ejecutivos</Pill>
      </div>

      {tab==="clients" && <>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <p style={{ margin:0, fontSize:12, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{clients.length} clientes</p>
          <button style={btn} onClick={()=>setShowCF(!showCF)}>+ Nuevo cliente</button>
        </div>

        {showCF && (
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:14, padding:18, marginBottom:14 }}>
            <p style={{ margin:"0 0 12px", fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:600 }}>Nuevo cliente</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              {[["Nombre","name","Nombre del cliente"],["Rubro","rubro",""],["Ejecutivo","exec",""]].map(([lbl,key])=>(
                <div key={key}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                  {key==="rubro"
                    ? <select style={inp} value={cf.rubro} onChange={e=>setCf({...cf,rubro:e.target.value})}>{RUBROS.map(r=><option key={r} value={r}>{r}</option>)}</select>
                    : key==="exec"
                    ? <select style={inp} value={cf.executiveId} onChange={e=>setCf({...cf,executiveId:e.target.value})}><option value="">Seleccionar...</option>{execs.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
                    : <input style={inp} placeholder="Nombre del cliente" value={cf.name} onChange={e=>setCf({...cf,name:e.target.value})}/>}
                </div>
              ))}
            </div>
            <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>KPIs objetivo</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
              {[["Leads/mes","leadsObjetivo"],["CPL mín $","cplMin"],["CPL máx $","cplMax"],["ROAS (0=N/A)","roasObjetivo"]].map(([lbl,key])=>(
                <div key={key}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                  <input type="number" style={inp} value={cf.kpis[key]||""} onChange={e=>setCf({...cf,kpis:{...cf.kpis,[key]:parseFloat(e.target.value)||0}})}/>
                </div>
              ))}
            </div>
            <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Servicios contratados</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
              {[["Camp. Meta","metaCampanas"],["Camp. Google","googleCampanas"],["Inversión $/mes","inversion"]].map(([lbl,key])=>(
                <div key={key}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                  <input type="number" style={inp} value={cf.servicios[key]||""} onChange={e=>setCf({...cf,servicios:{...cf.servicios,[key]:parseFloat(e.target.value)||0}})}/>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:12 }}>
              <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Detalle campañas</p>
              <input style={inp} placeholder="Ej: 3 Meta (tráfico, conversión, remarketing)" value={cf.servicios.detalle} onChange={e=>setCf({...cf,servicios:{...cf.servicios,detalle:e.target.value}})}/>
            </div>
            <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Participantes grupo WhatsApp</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
              {[["Ejecutivo en WA","ejecutivo"],["Filmmaker (opcional)","filmmaker"],["Contacto del cliente","clienteContacto"]].map(([lbl,key])=>(
                <div key={key}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                  <input style={inp} placeholder={lbl} value={cf.grupo[key]||""} onChange={e=>setCf({...cf,grupo:{...cf.grupo,[key]:e.target.value}})}/>
                </div>
              ))}
            </div>
            <button style={{ ...btn, opacity:saving?0.6:1 }} disabled={saving||!cf.name||!cf.executiveId} onClick={handleAddClient}>
              {saving?"Guardando...":"Crear cliente"}
            </button>
          </div>
        )}

        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {clients.map(c=>(
            <ClientCard key={c.id} client={c} reports={reports}
              execName={users.find(u=>u.id===c.executive_id)?.name}
              onClick={()=>onOpen(c.id)}/>
          ))}
        </div>
      </>}

      {tab==="executives" && <>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <p style={{ margin:0, fontSize:12, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{execs.length} ejecutivos</p>
          <button style={btn} onClick={()=>setShowUF(!showUF)}>+ Nuevo ejecutivo</button>
        </div>
        {showUF && (
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:14, padding:18, marginBottom:14 }}>
            <p style={{ margin:"0 0 12px", fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:600 }}>Nuevo usuario</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              {[["Nombre","name","text"],["Email","email","email"],["Contraseña","password","password"]].map(([lbl,key,t])=>(
                <div key={key}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                  <input style={inp} type={t} placeholder={lbl} value={uf[key]} onChange={e=>setUf({...uf,[key]:e.target.value})}/>
                </div>
              ))}
              <div>
                <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Rol</p>
                <select style={inp} value={uf.role||"executive"} onChange={e=>setUf({...uf,role:e.target.value})}>
                  <option value="executive">Ejecutivo</option>
                  <option value="filmmaker">Filmmaker</option>
                </select>
              </div>
            </div>
            <button style={{ ...btn, opacity:saving?0.6:1 }} disabled={saving||!uf.name||!uf.email||!uf.password} onClick={handleAddUser}>
              {saving?"Guardando...":"Crear usuario"}
            </button>
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {execs.map(exec=>{
            const mc = clients.filter(c=>c.executive_id===exec.id);
            const cr = mc.filter(c=>computeStatus(c,reports)==="red").length;
            return (
              <div key={exec.id} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
                <Av initials={exec.avatar} size={40} color="#6366f1"/>
                <div style={{ flex:1 }}>
                  <p style={{ margin:"0 0 2px", fontWeight:700, fontSize:14, fontFamily:"'Fraunces',serif", color:"#0f172a" }}>{exec.name}</p>
                  <p style={{ margin:0, fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>{exec.email} · {mc.length} clientes</p>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {cr>0 && <Badge status="red"/>}
                  {cr>0 && <button style={brd} onClick={()=>sendEmail({ to:exec.email, subject:`⚠️ Tenés ${cr} cliente(s) en estado Urgente`, body:`Hay ${cr} clientes urgentes.` })}>Alertar</button>}
                </div>
              </div>
            );
          })}
        </div>
      </>}
    </div>
  );
}

// ─── EXECUTIVE DASHBOARD ─────────────────────────────────────────────────────
function ExecDash({ user, clients, reports, onOpen, onAddClient, users, sendEmail }) {
  const my      = clients.filter(c=>c.executive_id===user.id);
  const reds    = my.filter(c=>computeStatus(c,reports)==="red").length;
  const yellows = my.filter(c=>computeStatus(c,reports)==="yellow").length;
  const atrasados = my.filter(c=>daysSince(c.last_update||c.created_at)>=3);

  const [showCF, setShowCF] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cf, setCf] = useState({
    name:"", rubro:"servicios",
    kpis:{ leadsObjetivo:30, cplMin:400, cplMax:2500, roasObjetivo:0 },
    servicios:{ metaCampanas:3, googleCampanas:0, inversion:100000, detalle:"" },
    grupo:{ ejecutivo:user.name, filmmaker:"", clienteContacto:"" }
  });

  const handleAdd = async () => {
    if (!cf.name) return;
    setSaving(true);
    await onAddClient({ ...cf, executiveId: user.id, filmmaker_id: null });
    setCf({ name:"", rubro:"servicios", kpis:{ leadsObjetivo:30,cplMin:400,cplMax:2500,roasObjetivo:0 }, servicios:{ metaCampanas:3,googleCampanas:0,inversion:100000,detalle:"" }, grupo:{ ejecutivo:user.name, filmmaker:"", clienteContacto:"" } });
    setShowCF(false); setSaving(false);
  };

  return (
    <div>
      {/* KPI blocks */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
        {[
          { label:"Clientes activos",   value:my.length,    color:"#0f172a" },
          { label:"Requieren atención", value:reds+yellows, color:"#f59e0b" },
          { label:"Estado crítico",     value:reds,         color:"#ef4444" },
        ].map((k,i)=>(
          <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"14px 16px" }}>
            <p style={{ margin:"0 0 4px", fontSize:10, color:"#94a3b8", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.07em" }}>{k.label}</p>
            <p style={{ margin:0, fontSize:28, fontWeight:700, color:k.color, fontFamily:"'Fraunces',serif" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Alertas de atraso */}
      {atrasados.length > 0 && (
        <div style={{ marginBottom:16, display:"flex", flexDirection:"column", gap:8 }}>
          {atrasados.map(c => {
            const days = daysSince(c.last_update||c.created_at);
            return (
              <div key={c.id} style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ fontSize:16 }}>⏰</span>
                  <p style={{ margin:0, fontSize:12, color:"#dc2626", fontFamily:"'DM Mono',monospace" }}>
                    <strong>Falta enviar estado de {c.name}</strong> — hace {days} días sin actualizar
                  </p>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <button style={{ ...btn, fontSize:10, padding:"4px 10px", background:"#dc2626" }}
                    onClick={()=>onOpen(c.id)}>
                    Actualizar ahora
                  </button>
                  <button style={{ ...bsm, fontSize:10 }}
                    onClick={()=>sendEmail({ to:user.email, subject:`⏰ Recordatorio: falta enviar estado de "${c.name}"`, body:`Hace ${days} días que no actualizás el estado de ${c.name}. Por favor ingresá al dashboard y cargá los reportes.` })}>
                    Reenviar alerta
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Saludo */}
      <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
        <Av initials={user.avatar} size={36} color="#16a34a"/>
        <p style={{ margin:0, fontWeight:600, fontSize:14, fontFamily:"'Fraunces',serif", color:"#0f172a" }}>
          Hola, {user.name.split(" ")[0]} 👋 — {my.length} cliente{my.length!==1?"s":""} asignado{my.length!==1?"s":""}
        </p>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <p style={{ margin:0, fontSize:10, color:"#94a3b8", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.08em" }}>Tus clientes</p>
        <button style={btn} onClick={()=>setShowCF(!showCF)}>+ Nuevo cliente</button>
      </div>

      {showCF && (
        <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:14, padding:18, marginBottom:14 }}>
          <p style={{ margin:"0 0 12px", fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:600 }}>Nuevo cliente</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Nombre del cliente</p>
              <input style={inp} placeholder="Nombre del cliente" value={cf.name} onChange={e=>setCf({...cf,name:e.target.value})}/>
            </div>
            <div>
              <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Rubro</p>
              <select style={inp} value={cf.rubro} onChange={e=>setCf({...cf,rubro:e.target.value})}>
                {RUBROS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>KPIs objetivo</p>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
            {[["Leads/mes","leadsObjetivo"],["CPL mín $","cplMin"],["CPL máx $","cplMax"],["ROAS (0=N/A)","roasObjetivo"]].map(([lbl,key])=>(
              <div key={key}>
                <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                <input type="number" style={inp} value={cf.kpis[key]||""} onChange={e=>setCf({...cf,kpis:{...cf.kpis,[key]:parseFloat(e.target.value)||0}})}/>
              </div>
            ))}
          </div>
          <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Servicios contratados</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
            {[["Camp. Meta","metaCampanas"],["Camp. Google","googleCampanas"],["Inversión $/mes","inversion"]].map(([lbl,key])=>(
              <div key={key}>
                <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                <input type="number" style={inp} value={cf.servicios[key]||""} onChange={e=>setCf({...cf,servicios:{...cf.servicios,[key]:parseFloat(e.target.value)||0}})}/>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:12 }}>
            <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Detalle campañas</p>
            <input style={inp} placeholder="Ej: 3 Meta (tráfico, conversión, remarketing)" value={cf.servicios.detalle} onChange={e=>setCf({...cf,servicios:{...cf.servicios,detalle:e.target.value}})}/>
          </div>
          <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Participantes grupo WhatsApp</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:14 }}>
            {[["Ejecutivo en WA","ejecutivo"],["Filmmaker (opcional)","filmmaker"],["Contacto del cliente","clienteContacto"]].map(([lbl,key])=>(
              <div key={key}>
                <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                <input style={inp} placeholder={lbl} value={cf.grupo[key]||""} onChange={e=>setCf({...cf,grupo:{...cf.grupo,[key]:e.target.value}})}/>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...btn, opacity:saving?0.6:1 }} disabled={saving||!cf.name} onClick={handleAdd}>
              {saving?"Guardando...":"Crear cliente"}
            </button>
            <button style={bsm} onClick={()=>setShowCF(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {my.length===0 && !showCF
        ? <div style={{ background:"#f8fafc", border:"1px dashed #e2e8f0", borderRadius:12, padding:40, textAlign:"center" }}><p style={{ margin:0, fontSize:12, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>Sin clientes asignados todavía — agregá el primero</p></div>
        : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>{my.map(c=><ClientCard key={c.id} client={c} reports={reports} execName={user.name} onClick={()=>onOpen(c.id)}/>)}</div>}
    </div>
  );
}


// ─── FILMMAKER PASTE ZONE ────────────────────────────────────────────────────
function FilmPasteZone({ label, icon, report, history, onImage, onComment, loading }) {
  const [active,setActive]   = useState(false);
  const [editCom,setEditCom] = useState(false);
  const [draft,setDraft]     = useState(report?.comment||"");
  const [showHistory,setShowHistory] = useState(false);
  const [pending,setPending] = useState([]);

  const uploaded = !!report;
  const zs = report?.status;

  const handlePaste = useCallback((e)=>{
    const items=e.clipboardData?.items; if(!items) return;
    for (const item of items){
      if(item.type.startsWith("image/")){
        const file=item.getAsFile();
        setPending(p=>[...p,{file,preview:URL.createObjectURL(file)}]);
        break;
      }
    }
  },[]);

  const handleFileChange=(e)=>{
    const files=Array.from(e.target.files);
    if(!files.length) return;
    setPending(p=>[...p,...files.map(f=>({file:f,preview:URL.createObjectURL(f)}))]);
  };

  const sendAll=()=>{ if(pending.length){ onImage(pending.map(p=>p.file)); setPending([]); } };

  const bc = active?"#6366f1":uploaded?(STATUS[zs]?.border||"#86efac"):pending.length?"#6366f1":"#e2e8f0";
  const bg = uploaded?(zs==="red"?"#fef2f2":zs==="yellow"?"#fffbeb":"#f0fdf4"):active?"#f5f3ff":"#f8fafc";

  return (
    <>
      {showHistory && <HistoryDrawer history={history} onClose={()=>setShowHistory(false)}/>}
      <div style={{ border:`1.5px dashed ${bc}`, borderRadius:12, background:bg, overflow:"hidden" }}>
        <div tabIndex={0} onFocus={()=>setActive(true)} onBlur={()=>setActive(false)} onPaste={handlePaste} style={{ padding:"14px 16px", outline:"none" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:6 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:18 }}>{icon}</span>
              <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:600, color:"#334155" }}>{label}</span>
              {uploaded&&zs&&<Badge status={zs}/>}
              {history.length>0&&(
                <button onClick={()=>setShowHistory(true)} style={{ ...bsm, fontSize:10, padding:"2px 8px", background:"none", border:"1px solid #e2e8f0" }}>
                  🕐 {history.length} entrega{history.length>1?"s":""}
                </button>
              )}
            </div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              {!pending.length&&<span style={{ fontSize:11, color:active?"#6366f1":"#94a3b8", fontFamily:"'DM Mono',monospace" }}>
                {loading?"⏳ Analizando...":active?"📋 Ctrl+V (podés pegar varias)":"Clic aquí → Ctrl+V"}
              </span>}
              <label style={{ ...bsm, display:"inline-block" }}>
                + Imagen<input type="file" accept="image/*" multiple style={{ display:"none" }} onChange={handleFileChange} disabled={loading}/>
              </label>
              {uploaded&&!pending.length&&<button onClick={()=>onImage(null)} style={{ ...bsm, fontSize:10 }}>↺</button>}
            </div>
          </div>

          {/* Staging area */}
          {pending.length>0&&!loading&&(
            <div style={{ marginTop:12, padding:12, background:"rgba(99,102,241,0.05)", borderRadius:8, border:"1px solid #e0e7ff" }}>
              <p style={{ margin:"0 0 8px", fontSize:11, fontFamily:"'DM Mono',monospace", color:"#6366f1", fontWeight:600 }}>
                📸 {pending.length} captura{pending.length>1?"s":""} — Claude las analizará en conjunto
              </p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                {pending.map((img,i)=>(
                  <div key={i} style={{ position:"relative" }}>
                    <img src={img.preview} alt="" style={{ width:60, height:60, objectFit:"cover", borderRadius:6, border:"1px solid #e2e8f0" }}/>
                    <button onClick={()=>setPending(p=>p.filter((_,idx)=>idx!==i))} style={{ position:"absolute", top:-6, right:-6, background:"#ef4444", color:"#fff", border:"none", borderRadius:"50%", width:18, height:18, fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>×</button>
                  </div>
                ))}
              </div>
              <button onClick={sendAll} disabled={loading} style={{ ...btn, fontSize:11, padding:"6px 14px", background:"#7c3aed" }}>
                🤖 Analizar evidencia
              </button>
            </div>
          )}

          {report?.analysis&&<p style={{ margin:"10px 0 0", fontSize:12, color:"#475569", lineHeight:1.6, fontFamily:"'Lora',serif", borderTop:"1px solid #e2e8f0", paddingTop:10 }}>{report.analysis}</p>}
        </div>
        <div style={{ borderTop:`1px solid ${uploaded?(STATUS[zs]?.border||"#86efac"):"#e2e8f0"}`, background:"rgba(255,255,255,0.6)", padding:"10px 16px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
            <span style={{ fontSize:13, marginTop:2 }}>💬</span>
            <div style={{ flex:1 }}>
              <p style={{ margin:"0 0 4px", fontSize:10, fontWeight:600, color:"#94a3b8", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.06em" }}>Comentario del filmmaker</p>
              {editCom?(
                <div>
                  <textarea value={draft} onChange={e=>setDraft(e.target.value)}
                    placeholder="Ej: 2 videos para feed, 1 para campaña. Cliente aprobó el guión."
                    style={{ ...inp, minHeight:52, resize:"vertical", fontFamily:"'Lora',serif", fontStyle:"italic" }} autoFocus/>
                  <div style={{ display:"flex", gap:6, marginTop:6 }}>
                    <button onClick={()=>{onComment(draft);setEditCom(false);}} style={btn}>Guardar</button>
                    <button onClick={()=>{setDraft(report?.comment||"");setEditCom(false);}} style={bsm}>Cancelar</button>
                  </div>
                </div>
              ):(
                <div onClick={()=>{setDraft(report?.comment||"");setEditCom(true);}} style={{ cursor:"pointer" }}>
                  {report?.comment
                    ?<p style={{ margin:0, fontSize:12, color:"#475569", lineHeight:1.6, fontFamily:"'Lora',serif", fontStyle:"italic" }}>"{report.comment}"</p>
                    :<p style={{ margin:0, fontSize:12, color:"#cbd5e1", fontFamily:"'DM Mono',monospace" }}>+ Agregar comentario de entrega...</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── FILMMAKER CLIENT DETAIL ──────────────────────────────────────────────────
function FilmClientDetail({ client, filmerId, reports, onBack, onUpload, onComment, sendEmail }) {
  const [aKey,setAKey] = useState(null);
  const today = new Date().toLocaleDateString("es-AR");
  const plan  = client.plan_videos || { cantidad:1, frecuencia:"semanal", dias:["lunes"] };
  const grupo = client.grupo || {};

  // Get filmmaker reports
  const filmReports = reports.filter(r=>r.client_id===client.id&&String(r.filmmaker_id)===String(filmerId));
  const feedR    = filmReports.filter(r=>r.type==="feed").sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const campR    = filmReports.filter(r=>r.type==="campania").sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const waR      = reports.find(r=>r.client_id===client.id&&r.type==="whatsapp"&&String(r.filmmaker_id)===String(filmerId));
  const waH      = reports.filter(r=>r.client_id===client.id&&r.type==="whatsapp"&&String(r.filmmaker_id)===String(filmerId));

  // Count deliveries this week
  const oneWeekAgo = Date.now() - 7*86400000;
  const feedThisWeek = feedR.filter(r=>new Date(r.created_at)>oneWeekAgo).length;
  const campThisWeek = campR.filter(r=>new Date(r.created_at)>oneWeekAgo).length;
  const totalThisWeek = feedThisWeek + campThisWeek;
  const cumplimiento = Math.min(100, Math.round((totalThisWeek/plan.cantidad)*100));

  const fileToB64 = (file) => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });

  const buildFilmPrompt = (type, imageCount=1) => {
    const planTxt = `Plan contratado: ${plan.cantidad} video${plan.cantidad>1?"s":""} por semana (${plan.frecuencia}). Días de entrega: ${plan.dias?.join(", ")||"a definir"}. Rubro: ${client.rubro}. Hoy: ${today}.`;
    const ctxFeed = feedR[0]?.comment ? `\nContexto del filmmaker: "${feedR[0].comment}"` : "";
    const ctxCamp = campR[0]?.comment ? `\nContexto del filmmaker: "${campR[0].comment}"` : "";
    const estadoActual = `Estado actual esta semana: ${feedThisWeek} en feed + ${campThisWeek} para campaña = ${totalThisWeek}/${plan.cantidad} del plan.`;
    const multiImg = imageCount > 1 ? `\nSe adjuntan ${imageCount} capturas — analizalas en conjunto como evidencia de la misma semana.` : "";

    const fuentesPosibles = `
FUENTES DE EVIDENCIA POSIBLES (identificá cuál es):
- Metricool, Later, Hootsuite u otra herramienta de scheduling: muestra publicaciones programadas o publicadas con fecha y plataforma.
- Feed de Instagram, TikTok, Facebook, YouTube: muestra el video ya publicado en el perfil.
- WhatsApp con cliente (burbujas verdes = filmmaker/agencia, blancas = cliente): aprobación de guión o confirmación.
- WhatsApp con ejecutivo: entrega de archivos de video para campaña.
- Meta Ads o Google Ads: video corriendo en campaña.
- Editor de video (CapCut, Premiere, etc.): video listo para entregar.`;

    if (type==="feed") return `${planTxt}\n${estadoActual}${multiImg}${ctxFeed}\n${fuentesPosibles}

Analizá esta${imageCount>1?" secuencia de":""} captura${imageCount>1?"s":""} como evidencia de entregas en FEED (Instagram, TikTok, YouTube, Facebook).

TU TAREA:
1. Identificá QUÉ tipo de captura es.
2. Contá cuántos videos distintos se pueden confirmar como publicados o listos esta semana — prestá atención a fechas, títulos y plataformas visibles.
3. Si es un calendario como Metricool, contá las publicaciones de esta semana (semana del ${today}).
4. Evaluá si esa cantidad cumple con el plan de ${plan.cantidad} video${plan.cantidad>1?"s":""}/semana.

Respondé en 2 oraciones en español, sin asteriscos.
Empezá con ✅ si cumple el plan, ⚠️ si cumple parcialmente, o 🔴 si no hay evidencia suficiente.
Indicá cuántos videos detectaste: ej. "Se detectan 2 publicaciones esta semana..."`;

    if (type==="campania") return `${planTxt}\n${estadoActual}${multiImg}${ctxCamp}\n${fuentesPosibles}

Analizá esta${imageCount>1?" secuencia de":""} captura${imageCount>1?"s":""} como evidencia de entregas de videos para CAMPAÑA PUBLICITARIA.

TU TAREA:
1. Identificá QUÉ tipo de captura es.
2. Verificá si se ve claramente que el video fue entregado al ejecutivo o está corriendo en campaña.
3. Si es WhatsApp, las burbujas VERDES son del filmmaker — verificá si compartió archivos de video.
4. Contá cuántos videos distintos se identifican como entregados.

Respondé en 2 oraciones en español, sin asteriscos.
Empezá con ✅ si la entrega está confirmada, ⚠️ si es parcial, o 🔴 si no hay evidencia clara.
Indicá cuántos videos detectaste: ej. "Se detectan 2 videos entregados..."`;

    // WhatsApp atención al cliente
    const agencia = [grupo.ejecutivo, grupo.filmmaker].filter(Boolean).join(" y ");
    const ctxWa = waR?.comment ? `\nContexto: "${waR.comment}"` : "";
    return `Rubro: ${client.rubro}. Hoy: ${today}.${multiImg}
Miembros de nuestra agencia: ${agencia||"el filmmaker"}. Cliente: ${grupo.clienteContacto||"el cliente"}.${ctxWa}

IDENTIFICACIÓN EN WHATSAPP:
- Burbujas VERDES (derecha) = siempre el filmmaker o ejecutivo. IGNORAR COMPLETAMENTE.
- Burbujas BLANCAS/GRISES (izquierda) = cliente y externos. ANALIZAR SOLO ESTOS.

Analizá ÚNICAMENTE el tono del CLIENTE (burbujas blancas):
- Aprueba contenido, hace comentarios positivos, coordina bien → ✅
- Preguntas o pedidos pendientes menores → ⚠️
- Quejas, disconformidad o silencio prolongado → 🔴

Respondé en 2 oraciones en español, sin asteriscos. Empezá con ✅, ⚠️ o 🔴.`;
  };

  const handleUploadFilm = async (type, files) => {
    // files can be a single File or array of Files
    const fileArr = Array.isArray(files) ? files : (files === null ? null : [files]);
    if (fileArr === null) { onUpload(client.id, type, null, null, filmerId); return; }
    setAKey(type);
    try {
      const imgContents = await Promise.all(fileArr.map(async f => ({
        type:"image", source:{ type:"base64", media_type:f.type, data:await fileToB64(f) }
      })));
      imgContents.push({ type:"text", text:buildFilmPrompt(type, fileArr.length) });
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:400, messages:[{role:"user",content:imgContents}]})
      });
      const data = await resp.json();
      const text = data.content?.[0]?.text||"No se pudo analizar.";
      const zs   = text.startsWith("🔴")?"red":text.startsWith("⚠️")?"yellow":"green";
      onUpload(client.id, type, text, zs, filmerId);
    } catch { onUpload(client.id, type, "Error al analizar.", "yellow", filmerId); }
    finally { setAKey(null); }
  };

  const handleCommentFilm = (type, comment, currentReport) => {
    if (currentReport) onComment(currentReport.id, comment);
  };

  const cumColor = cumplimiento>=100?"#22c55e":cumplimiento>=50?"#f59e0b":"#ef4444";

  return (
    <div>
      <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", color:"#64748b", fontFamily:"'DM Mono',monospace", fontSize:12, padding:0, marginBottom:18, display:"flex", alignItems:"center", gap:6 }}>← Volver</button>

      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
        <Av initials={client.name.slice(0,2).toUpperCase()} size={50} color="#7c3aed"/>
        <div style={{ flex:1 }}>
          <h2 style={{ margin:"0 0 3px", fontFamily:"'Fraunces',serif", fontSize:20, color:"#0f172a" }}>{client.name}</h2>
          <p style={{ margin:0, fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>{client.rubro} · Plan: {plan.cantidad} video{plan.cantidad>1?"s":""}/semana · {plan.frecuencia}</p>
        </div>
      </div>

      {/* Cumplimiento semanal */}
      <div style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"16px 18px", marginBottom:14 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
          <p style={{ margin:0, fontSize:12, fontWeight:600, fontFamily:"'DM Mono',monospace", color:"#334155" }}>📊 Cumplimiento esta semana</p>
          <span style={{ fontFamily:"'Fraunces',serif", fontSize:22, fontWeight:700, color:cumColor }}>{totalThisWeek}/{plan.cantidad}</span>
        </div>
        <div style={{ height:8, background:"#f1f5f9", borderRadius:4, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${cumplimiento}%`, background:cumColor, borderRadius:4, transition:"width 0.5s" }}/>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
          <span style={{ fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>🎬 Feed: {feedThisWeek} · 📢 Campaña: {campThisWeek}</span>
          <span style={{ fontSize:11, fontWeight:600, color:cumColor, fontFamily:"'DM Mono',monospace" }}>{cumplimiento}% cumplido</span>
        </div>
        <p style={{ margin:"8px 0 0", fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>
          Días de entrega: {plan.dias.join(", ")} · Total histórico: {feedR.length+campR.length} entregas
        </p>
      </div>

      {/* Días sin primera entrega alert */}
      {feedR.length===0&&campR.length===0&&(()=>{
        const dias = daysSince(client.created_at||client.last_update);
        if (dias>=7) return (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#dc2626", fontFamily:"'DM Mono',monospace" }}>
            🚨 <strong>Cliente hace {dias} días sin primera entrega.</strong> El plazo máximo es 9 días hábiles.
          </div>
        );
        if (dias>=5) return (
          <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#854F0B", fontFamily:"'DM Mono',monospace" }}>
            ⚠️ <strong>Faltan {9-dias} días para el límite de primera entrega.</strong> Coordiná con el cliente.
          </div>
        );
        return null;
      })()}

      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
        {/* Feed videos */}
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
            <p style={{ margin:0, fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace", color:"#334155" }}>🎬 ENTREGAS EN FEED</p>
            <span style={{ fontSize:10, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>{feedR.length} entrega{feedR.length!==1?"s":""} totales</span>
          </div>
          <FilmPasteZone label="Subir entrega — Feed (Instagram / TikTok / YouTube)" icon="📱"
            report={feedR[0]||null} history={feedR}
            onImage={(f)=>handleUploadFilm("feed",f)}
            onComment={(c)=>handleCommentFilm("feed",c,feedR[0])}
            loading={aKey==="feed"}/>
        </div>

        {/* Campaign videos */}
        <div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
            <p style={{ margin:0, fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace", color:"#334155" }}>📢 ENTREGAS PARA CAMPAÑA</p>
            <span style={{ fontSize:10, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>{campR.length} entrega{campR.length!==1?"s":""} totales</span>
          </div>
          <FilmPasteZone label="Subir entrega — Video para campaña publicitaria" icon="🎥"
            report={campR[0]||null} history={campR}
            onImage={(f)=>handleUploadFilm("campania",f)}
            onComment={(c)=>handleCommentFilm("campania",c,campR[0])}
            loading={aKey==="campania"}/>
        </div>

        {/* WhatsApp atención al cliente */}
        <div>
          <p style={{ margin:"0 0 6px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace", color:"#334155" }}>💬 ATENCIÓN AL CLIENTE — WhatsApp</p>
          <FilmPasteZone label="WhatsApp con el cliente" icon="💬"
            report={waR||null} history={waH}
            onImage={(f)=>handleUploadFilm("whatsapp",f)}
            onComment={(c)=>handleCommentFilm("whatsapp",c,waR)}
            loading={aKey==="whatsapp"}/>
        </div>
      </div>
    </div>
  );
}

// ─── FILMMAKER DASHBOARD ──────────────────────────────────────────────────────
function FilmDash({ user, clients, reports, onOpen, onAddClient }) {
  const myClients = clients.filter(c=>String(c.filmmaker_id)===String(user.id));
  const [showCF, setShowCF] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cf, setCf] = useState({
    name:"", rubro:"servicios",
    kpis:{ leadsObjetivo:0, cplMin:0, cplMax:0, roasObjetivo:0 },
    servicios:{ metaCampanas:0, googleCampanas:0, inversion:0, detalle:"" },
    grupo:{ ejecutivo:"", filmmaker:user.name, clienteContacto:"" },
    plan_videos:{ cantidad:1, frecuencia:"semanal", dias:["lunes"] },
  });

  const handleAdd = async () => {
    if (!cf.name) return;
    setSaving(true);
    await onAddClient({ ...cf, filmmaker_id: user.id });
    setCf({ name:"", rubro:"servicios", kpis:{ leadsObjetivo:0,cplMin:0,cplMax:0,roasObjetivo:0 }, servicios:{ metaCampanas:0,googleCampanas:0,inversion:0,detalle:"" }, grupo:{ ejecutivo:"",filmmaker:user.name,clienteContacto:"" }, plan_videos:{ cantidad:1,frecuencia:"semanal",dias:["lunes"] } });
    setShowCF(false); setSaving(false);
  };

  // Overdue clients
  const atrasados = myClients.filter(c=>{
    const filmR = reports.filter(r=>r.client_id===c.id&&String(r.filmmaker_id)===String(user.id)&&["feed","campania"].includes(r.type));
    const lastR = filmR.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
    return !lastR || daysSince(lastR.created_at)>=(c.plan_videos?.cantidad===3?3:7);
  });

  return (
    <div>
      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:16 }}>
        {[
          { label:"Clientes activos", value:myClients.length, color:"#0f172a" },
          { label:"Con entregas pendientes", value:atrasados.length, color:"#f59e0b" },
          { label:"Sin primera entrega", value:myClients.filter(c=>{ const r=reports.filter(x=>x.client_id===c.id&&String(x.filmmaker_id)===String(user.id)&&["feed","campania"].includes(x.type)); return r.length===0&&daysSince(c.created_at||c.last_update)>=7; }).length, color:"#ef4444" },
        ].map((k,i)=>(
          <div key={i} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"14px 16px" }}>
            <p style={{ margin:"0 0 4px", fontSize:10, color:"#94a3b8", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.07em" }}>{k.label}</p>
            <p style={{ margin:0, fontSize:28, fontWeight:700, color:k.color, fontFamily:"'Fraunces',serif" }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Alertas */}
      {atrasados.length>0 && (
        <div style={{ marginBottom:16, display:"flex", flexDirection:"column", gap:8 }}>
          {atrasados.map(c=>(
            <div key={c.id} style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <p style={{ margin:0, fontSize:12, color:"#dc2626", fontFamily:"'DM Mono',monospace" }}>
                ⏰ <strong>Falta enviar entrega de {c.name}</strong>
              </p>
              <button style={{ ...btn, fontSize:10, padding:"4px 10px", background:"#dc2626" }} onClick={()=>onOpen(c.id)}>
                Cargar ahora
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Saludo */}
      <div style={{ background:"#f5f3ff", border:"1px solid #ddd6fe", borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:12 }}>
        <Av initials={user.avatar} size={36} color="#7c3aed"/>
        <p style={{ margin:0, fontWeight:600, fontSize:14, fontFamily:"'Fraunces',serif", color:"#0f172a" }}>
          Hola, {user.name.split(" ")[0]} 👋 — {myClients.length} cliente{myClients.length!==1?"s":""} asignado{myClients.length!==1?"s":""}
        </p>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <p style={{ margin:0, fontSize:10, color:"#94a3b8", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.08em" }}>Tus clientes</p>
        <button style={{ ...btn, background:"#7c3aed" }} onClick={()=>setShowCF(!showCF)}>+ Nuevo cliente</button>
      </div>

      {showCF && (
        <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:14, padding:18, marginBottom:14 }}>
          <p style={{ margin:"0 0 12px", fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:600 }}>Nuevo cliente</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Nombre</p>
              <input style={inp} placeholder="Nombre del cliente" value={cf.name} onChange={e=>setCf({...cf,name:e.target.value})}/>
            </div>
            <div>
              <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Rubro</p>
              <select style={inp} value={cf.rubro} onChange={e=>setCf({...cf,rubro:e.target.value})}>
                {RUBROS.map(r=><option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Plan de videos</p>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div>
              <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Videos por semana</p>
              <select style={inp} value={cf.plan_videos.cantidad} onChange={e=>setCf({...cf,plan_videos:{...cf.plan_videos,cantidad:parseInt(e.target.value),frecuencia:e.target.value==="1"?"semanal":"lunes-miercoles-viernes",dias:e.target.value==="1"?["lunes"]:["lunes","miercoles","viernes"]}})}>
                <option value="1">1 video — semanal</option>
                <option value="3">3 videos — lunes, miércoles y viernes</option>
              </select>
            </div>
            <div>
              <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Contacto del cliente en WA</p>
              <input style={inp} placeholder="Nombre del cliente" value={cf.grupo.clienteContacto} onChange={e=>setCf({...cf,grupo:{...cf.grupo,clienteContacto:e.target.value}})}/>
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button style={{ ...btn, background:"#7c3aed", opacity:saving?0.6:1 }} disabled={saving||!cf.name} onClick={handleAdd}>
              {saving?"Guardando...":"Crear cliente"}
            </button>
            <button style={bsm} onClick={()=>setShowCF(false)}>Cancelar</button>
          </div>
        </div>
      )}

      {myClients.length===0&&!showCF
        ? <div style={{ background:"#f8fafc", border:"1px dashed #e2e8f0", borderRadius:12, padding:40, textAlign:"center" }}><p style={{ margin:0, fontSize:12, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>Sin clientes asignados todavía</p></div>
        : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {myClients.map(c=>{
              const filmR = reports.filter(r=>r.client_id===c.id&&String(r.filmmaker_id)===String(user.id)&&["feed","campania"].includes(r.type));
              const lastR = filmR.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
              const days  = lastR ? daysSince(lastR.created_at) : daysSince(c.created_at||c.last_update);
              const plan  = c.plan_videos||{cantidad:1};
              const oneWeekAgo = Date.now()-7*86400000;
              const thisWeek = filmR.filter(r=>new Date(r.created_at)>oneWeekAgo).length;
              const ok = thisWeek>=plan.cantidad;
              return (
                <div key={c.id} onClick={()=>onOpen(c.id)}
                  style={{ background:"#fff", border:`1px solid ${ok?"#e2e8f0":"#fcd34d"}`, borderRadius:14, padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}
                  onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.08)"}
                  onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                  <Av initials={c.name.slice(0,2).toUpperCase()} size={40} color="#7c3aed"/>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:"0 0 2px", fontWeight:700, fontSize:14, fontFamily:"'Fraunces',serif", color:"#0f172a" }}>{c.name}</p>
                    <p style={{ margin:0, fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>
                      {c.rubro} · Plan {plan.cantidad}v/sem · {thisWeek}/{plan.cantidad} esta semana · {days}d
                    </p>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontFamily:"'Fraunces',serif", fontSize:18, fontWeight:700, color:ok?"#22c55e":"#f59e0b" }}>{thisWeek}/{plan.cantidad}</span>
                    <Badge status={ok?"green":thisWeek>0?"yellow":"red"}/>
                    <span style={{ color:"#94a3b8" }}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser,setCurrentUser] = useState(null);
  const [users,setUsers]     = useState([]);
  const [clients,setClients] = useState([]);
  const [reports,setReports] = useState([]);
  const [selectedId,setSelectedId]   = useState(null);
  const [globalLoading,setGlobalLoading] = useState(false);
  const [emails,setEmails]   = useState([]);
  const [appLoading,setAppLoading] = useState(true);
  const isFilmmaker = currentUser?.role === "filmmaker";

  const sendEmail = (e) => setEmails(p=>[...p,e]);
  const dismissEmail = (i) => setEmails(p=>p.filter((_,idx)=>idx!==i));

  // Cargar datos de Supabase al iniciar
  const loadAll = async () => {
    try {
      const [u,c,r] = await Promise.all([db.getUsers(), db.getClients(), db.getReports()]);
      setUsers(u.length ? u : FALLBACK_USERS);
      setClients(c);
      setReports(r);
    } catch(e) {
      console.warn("Supabase no disponible, usando modo local:", e.message);
      setUsers(FALLBACK_USERS);
      setClients(FALLBACK_CLIENTS);
      setReports(FALLBACK_REPORTS);
    }
    finally { setAppLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  // Auto-send email alerts when executive logs in and has overdue clients
  useEffect(() => {
    if (!currentUser || currentUser.role !== "executive") return;
    const myClients = clients.filter(c=>c.executive_id===currentUser.id);
    const overdue = myClients.filter(c=>daysSince(c.last_update||c.created_at)>=3);
    overdue.forEach(c => {
      const days = daysSince(c.last_update||c.created_at);
      sendEmail({
        to: currentUser.email,
        subject: `⏰ Falta enviar estado de "${c.name}" — ${days} días sin actualizar`,
        body: `Hace ${days} días que no actualizás el estado de ${c.name}. Por favor ingresá al dashboard y cargá los reportes de Meta Ads, Google Ads y WhatsApp.`
      });
    });
  }, [currentUser]);

  const addUser = async ({ name, email, password }) => {
    const avatar = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    const userRole = role || "executive";
    try {
      const [u] = await db.addUser({ email, password, role:userRole, name, avatar });
      setUsers(p=>[...p,u]);
    } catch {
      // Modo local
      const u = { id:`local-${Date.now()}`, email, password, role:userRole, name, avatar };
      setUsers(p=>[...p,u]);
    }
  };

  const addClient = async ({ name, executiveId, rubro, kpis, servicios, grupo, filmmaker_id, plan_videos }) => {
    const newClient = {
      name,
      executive_id: executiveId || null,
      filmmaker_id: filmmaker_id || null,
      plan_videos: plan_videos || { cantidad:1, frecuencia:"semanal", dias:["lunes"] },
      rubro, kpis, servicios, grupo,
      last_update: new Date().toISOString(),
      created_at: new Date().toISOString(),
      global_analysis: null, admin_note: ""
    };
    try {
      const [c] = await db.addClient(newClient);
      setClients(p=>[...p,c]);
    } catch {
      // Modo local
      const c = { id:`local-${Date.now()}`, ...newClient };
      setClients(p=>[...p,c]);
    }
  };

  const handleFilmUpload = async (clientId, type, analysis, zs, filmerId) => {
    if (analysis===null) {
      setReports(p=>p.filter(r=>!(r.client_id===clientId&&r.type===type&&r.filmmaker_id===filmerId)));
      return;
    }
    const newR = { id:`film-${Date.now()}`, client_id:clientId, type, analysis, status:zs, comment:"", created_at:new Date().toISOString(), filmmaker_id:filmerId };
    setReports(p=>[newR,...p]);
  };

  const handleFilmComment = (reportId, comment) => {
    setReports(p=>p.map(r=>r.id===reportId?{...r,comment}:r));
  };

  const handleUpload = async (clientId, type, analysis, zs) => {
    const existing = getLatestReport(reports, clientId, type);
    const reportData = { client_id:clientId, type, analysis, status:zs, comment:existing?.comment||"" };
    try {
      const [r] = await db.addReport(reportData);
      setReports(p=>[r,...p]);
      await db.updateClient(clientId, { last_update: new Date().toISOString(), global_analysis: null });
    } catch {
      // Modo local
      const r = { id:`local-${Date.now()}`, ...reportData, created_at: new Date().toISOString() };
      setReports(p=>[r,...p.filter(x=>!(x.client_id===clientId&&x.type===type&&x.id===existing?.id))]);
    }
    setClients(p=>p.map(c=>c.id===clientId?{...c,last_update:new Date().toISOString(),global_analysis:null}:c));
  };

  const handleComment = async (clientId, type, comment, currentReport) => {
    if (!currentReport) return;
    try {
      await db.updateReport(currentReport.id, { comment });
    } catch { /* modo local, continua */ }
    setReports(p=>p.map(r=>r.id===currentReport.id?{...r,comment}:r));
    setClients(p=>p.map(c=>c.id===clientId?{...c,global_analysis:null}:c));
  };

  const handleGlobal = async (clientId, result, loading) => {
    setGlobalLoading(loading);
    if (!loading) {
      try { await db.updateClient(clientId, { global_analysis: result }); } catch { /* modo local */ }
      setClients(p=>p.map(c=>c.id===clientId?{...c,global_analysis:result}:c));
    }
  };

  const handleAdminNote = async (clientId, note) => {
    try { await db.updateClient(clientId, { admin_note: note }); } catch { /* modo local */ }
    setClients(p=>p.map(c=>c.id===clientId?{...c,admin_note:note}:c));
  };

  const isAdmin = currentUser?.role === "admin";
  const selectedClient = clients.find(c=>c.id===selectedId);

  if (appLoading) return (
    <div style={{ minHeight:"100vh", background:"#0f172a", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700;900&family=DM+Mono:wght@400;500;600&family=Lora:ital@0;1&display=swap" rel="stylesheet"/>
      <div style={{ textAlign:"center" }}>
        <span style={{ fontSize:40 }}>⚡</span>
        <p style={{ color:"#94a3b8", fontFamily:"'DM Mono',monospace", fontSize:13, marginTop:16 }}>Cargando RisingUp...</p>
        <Spinner/>
      </div>
    </div>
  );

  if (!currentUser) return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700;900&family=DM+Mono:wght@400;500;600&family=Lora:ital@0;1&display=swap" rel="stylesheet"/>
      <Login onLogin={setCurrentUser} users={users}/>
    </>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'DM Mono',monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700;900&family=DM+Mono:wght@400;500;600&family=Lora:ital@0;1&display=swap" rel="stylesheet"/>

      <div style={{ background:"#0f172a", padding:"0 24px" }}>
        <div style={{ maxWidth:820, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:56 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>⚡</span>
            <span style={{ fontFamily:"'Fraunces',serif", fontSize:16, color:"#fff", fontWeight:700 }}>RisingUp</span>
            <span style={{ fontSize:10, color:"#475569", marginLeft:2 }}>/ {isAdmin?"Admin":isFilmmaker?"Filmmaker":"Ejecutivo"}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {selectedId && <button onClick={()=>setSelectedId(null)} style={{ ...bsm, background:"#1e293b", color:"#94a3b8", border:"none", fontSize:11 }}>← Dashboard</button>}
            <Av initials={currentUser.avatar} size={28} color={isAdmin?"#6366f1":isFilmmaker?"#7c3aed":"#16a34a"}/>
            <span style={{ fontSize:11, color:"#94a3b8" }}>{currentUser.name.split(" ")[0]}</span>
            <button onClick={()=>{ setCurrentUser(null); setSelectedId(null); }} style={{ ...bsm, background:"#1e293b", color:"#64748b", border:"none", fontSize:11 }}>Salir</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:820, margin:"0 auto", padding:"24px 18px" }}>
        {!selectedId ? (
          isAdmin
            ? <AdminDash clients={clients} users={users} reports={reports} onAddUser={addUser} onAddClient={addClient} onOpen={setSelectedId} sendEmail={sendEmail}/>
            : isFilmmaker
            ? <FilmDash user={currentUser} clients={clients} reports={reports} onOpen={setSelectedId} onAddClient={addClient}/>
            : <ExecDash user={currentUser} clients={clients} reports={reports} onOpen={setSelectedId} onAddClient={addClient} users={users} sendEmail={sendEmail}/>
        ) : isFilmmaker ? (
          <FilmClientDetail
            client={selectedClient}
            filmerId={currentUser.id}
            reports={reports}
            onBack={()=>setSelectedId(null)}
            onUpload={handleFilmUpload}
            onComment={handleFilmComment}
            sendEmail={sendEmail}
          />
        ) : (
          <ClientDetail
            client={selectedClient}
            executive={users.find(u=>u.id===selectedClient.executive_id)}
            reports={reports}
            isAdmin={isAdmin}
            onBack={()=>setSelectedId(null)}
            onUpload={handleUpload}
            onComment={handleComment}
            onGlobal={handleGlobal}
            onAdminNote={handleAdminNote}
            sendEmail={sendEmail}
            globalLoading={globalLoading}
            onReportsChange={loadAll}
          />
        )}
      </div>

      <EmailToast emails={emails} onDismiss={dismissEmail}/>
    </div>
  );
}
