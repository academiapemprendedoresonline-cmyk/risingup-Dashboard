import { useState, useCallback } from "react";

// ─── USERS ─────────────────────────────────────────────────────────────────
const INITIAL_USERS = [
  { id: 0, email:"gabi@risingup.com",   password:"admin123",  role:"admin",     name:"Gabi",          avatar:"GA" },
  { id: 1, email:"vale@risingup.com",   password:"vale123",   role:"executive", name:"Valentina Ríos", avatar:"VR" },
  { id: 2, email:"marcos@risingup.com", password:"marcos123", role:"executive", name:"Marcos Díaz",    avatar:"MD" },
];

// ─── MOCK DATA ──────────────────────────────────────────────────────────────
const mk = (analysis, status, comment="") => ({
  uploaded: !!analysis, analysis, status, comment, images: [],
  history: analysis ? [{ date: new Date().toLocaleDateString("es-AR"), analysis, status, comment }] : []
});

const INITIAL_CLIENTS = [
  {
    id:1, name:"Spa Dental", executiveId:1, rubro:"salud",
    lastUpdate: new Date(Date.now()-2*86400000).toISOString(),
    kpis:{ leadsObjetivo:40, cplMin:400, cplMax:2000, roasObjetivo:0 },
    servicios:{ metaCampanas:3, googleCampanas:0, inversion:150000, detalle:"3 campañas Meta: tráfico, conversión y remarketing" },
    grupo:{ ejecutivo:"Valentina Ríos", filmmaker:"", clienteContacto:"Florencia" },
    globalAnalysis:null, adminNote:"",
    meta:     mk("Van 28 leads a CPL $1.450 — en camino al objetivo de 40. Presupuesto ejecutado 72%. Campaña saludable.", "green"),
    google:   mk(null, null),
    whatsapp: mk("Cliente satisfecho. Tono positivo. Preguntó por el informe mensual.", "green"),
  },
  {
    id:2, name:"DWS", executiveId:1, rubro:"servicios",
    lastUpdate: new Date(Date.now()-6*86400000).toISOString(),
    kpis:{ leadsObjetivo:20, cplMin:500, cplMax:3000, roasObjetivo:2.5 },
    servicios:{ metaCampanas:3, googleCampanas:3, inversion:500000, detalle:"3 Meta + 3 Google. Meta: tráfico, leads, remarketing. Google: branded, genérico, display." },
    grupo:{ ejecutivo:"Valentina Ríos", filmmaker:"Lucas Gómez", clienteContacto:"Martín DWS" },
    globalAnalysis:null, adminNote:"Vale: llamalo hoy. Coordiná reunión con los tres esta semana.",
    meta:     mk("ROAS 1.8x por debajo del objetivo 2.5x. CPL $3.800 supera el máximo de $3.000. Creativos quemados, frecuencia alta.", "red", "Hablé con el cliente, pidió nuevos creativos. Sesión de fotos el jueves."),
    google:   mk("CPC $12.4 elevado. Solo 6 de 20 conversiones objetivo. Palabras genéricas consumiendo sin convertir.", "yellow"),
    whatsapp: mk("Cliente expresó disconformidad directa: no está viendo retorno. Requiere atención urgente hoy.", "red", "Ya lo llamé. Reunión viernes con Gabi."),
  },
  {
    id:3, name:"Parrilla a Punto", executiveId:2, rubro:"gastronomia",
    lastUpdate: new Date(Date.now()-1*86400000).toISOString(),
    kpis:{ leadsObjetivo:30, cplMin:400, cplMax:2500, roasObjetivo:0 },
    servicios:{ metaCampanas:5, googleCampanas:0, inversion:80000, detalle:"5 campañas Meta: tráfico, engagement x2, conversión, remarketing." },
    grupo:{ ejecutivo:"Marcos Díaz", filmmaker:"", clienteContacto:"Roberto" },
    globalAnalysis:null, adminNote:"",
    meta:     mk("18 leads a CPL $1.900 — ritmo normal para mitad de mes. Objetivo 30 alcanzable.", "green", "Cuenta 2 días sin saldo. Pedí recarga, cliente confirmó hoy."),
    google:   mk(null, null),
    whatsapp: mk("Cliente confirmó recarga de saldo. Tono positivo y colaborativo.", "green"),
  },
];

const RUBROS = ["ecommerce","salud","gastronomia","servicios","educacion","inmobiliaria","otro"];
const STATUS = {
  green:  { label:"OK",      color:"#22c55e", bg:"#f0fdf4", border:"#86efac" },
  yellow: { label:"Revisar", color:"#f59e0b", bg:"#fffbeb", border:"#fcd34d" },
  red:    { label:"Urgente", color:"#ef4444", bg:"#fef2f2", border:"#fca5a5" },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────
const daysSince = (iso) => Math.floor((Date.now()-new Date(iso))/86400000);
const computeStatus = (c) => {
  const days = daysSince(c.lastUpdate);
  const hasRed = ["meta","google","whatsapp"].some(k=>c[k].status==="red");
  if (hasRed||days>=5) return "red";
  const hasYellow = ["meta","google","whatsapp"].some(k=>c[k].status==="yellow");
  if (hasYellow||!c.meta.uploaded||!c.whatsapp.uploaded||days>=3) return "yellow";
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
  const c=STATUS[status];
  return <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:c.bg, color:c.color, border:`1px solid ${c.border}`, borderRadius:20, padding:"2px 9px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>
    <span style={{ width:6, height:6, borderRadius:"50%", background:c.color, display:"inline-block" }}/>{c.label}
  </span>;
}
function Pill({ children, active, onClick }) {
  return <button onClick={onClick} style={{ padding:"6px 16px", borderRadius:20, border:"none", cursor:"pointer", fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:500, background:active?"#0f172a":"transparent", color:active?"#fff":"#64748b" }}>{children}</button>;
}

// ─── LOGIN ──────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  const go = () => { const u=INITIAL_USERS.find(u=>u.email===email.trim()&&u.password===pass); u?onLogin(u):setErr("Email o contraseña incorrectos"); };
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
        {err&&<p style={{ margin:"0 0 10px", fontSize:12, color:"#ef4444", fontFamily:"'DM Mono',monospace" }}>{err}</p>}
        <button style={{ ...btn, width:"100%", padding:"11px", fontSize:13 }} onClick={go}>Ingresar</button>
        <div style={{ marginTop:20, padding:14, background:"#f8fafc", borderRadius:10, fontSize:11, fontFamily:"'DM Mono',monospace", color:"#94a3b8", lineHeight:1.9 }}>
          <p style={{ margin:"0 0 4px", fontWeight:600, color:"#64748b" }}>Usuarios demo:</p>
          <p style={{ margin:0 }}>gabi@risingup.com / admin123 (Admin)</p>
          <p style={{ margin:0 }}>vale@risingup.com / vale123 (Ejecutivo)</p>
          <p style={{ margin:0 }}>marcos@risingup.com / marcos123 (Ejecutivo)</p>
        </div>
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
        {history.length===0
          ? <p style={{ color:"#94a3b8", fontFamily:"'DM Mono',monospace", fontSize:12 }}>Sin reportes anteriores</p>
          : history.map((h,i)=>(
            <div key={i} style={{ marginBottom:16, padding:14, background:"#f8fafc", borderRadius:10, border:"1px solid #e2e8f0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <span style={{ fontFamily:"'DM Mono',monospace", fontSize:11, color:"#64748b" }}>{h.date}</span>
                <Badge status={h.status}/>
              </div>
              <p style={{ margin:0, fontSize:12, color:"#475569", fontFamily:"'Lora',serif", lineHeight:1.6 }}>{h.analysis}</p>
              {h.comment&&<p style={{ margin:"8px 0 0", fontSize:11, color:"#94a3b8", fontFamily:"'Lora',serif", fontStyle:"italic" }}>💬 "{h.comment}"</p>}
            </div>
          ))
        }
      </div>
    </div>
  );
}

// ─── PASTE ZONE ─────────────────────────────────────────────────────────────
function PasteZone({ label, icon, uploaded, analysis, status:zs, comment, history=[], images=[], onImage, onImages, onComment, loading, readOnly, isWhatsapp }) {
  const [active,setActive]=useState(false);
  const [editCom,setEditCom]=useState(false);
  const [draft,setDraft]=useState(comment||"");
  const [showHistory,setShowHistory]=useState(false);
  const [pendingImgs,setPendingImgs]=useState([]); // [{file, preview}] staged before sending

  const handlePaste = useCallback((e)=>{
    if (readOnly) return;
    const items=e.clipboardData?.items; if(!items) return;
    for (const item of items) {
      if(item.type.startsWith("image/")){
        const file=item.getAsFile();
        if (isWhatsapp) {
          // accumulate
          const preview=URL.createObjectURL(file);
          setPendingImgs(p=>[...p,{file,preview}]);
        } else {
          onImage(file);
        }
        break;
      }
    }
  },[onImage,onImages,readOnly,isWhatsapp]);

  const handleFileChange=(e)=>{
    const files=Array.from(e.target.files);
    if (!files.length) return;
    if (isWhatsapp) {
      const newImgs=files.map(f=>({file:f,preview:URL.createObjectURL(f)}));
      setPendingImgs(p=>[...p,...newImgs]);
    } else {
      onImage(files[0]);
    }
  };

  const removePending=(i)=>setPendingImgs(p=>p.filter((_,idx)=>idx!==i));
  const sendAll=()=>{ if(pendingImgs.length) { onImages(pendingImgs.map(p=>p.file)); setPendingImgs([]); } };

  const bc = active?"#6366f1":uploaded?(STATUS[zs]?.border||"#86efac"):"#e2e8f0";
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
              {uploaded&&zs&&<Badge status={zs}/>}
              {history.length>0&&(
                <button onClick={()=>setShowHistory(true)} style={{ ...bsm, fontSize:10, padding:"2px 8px", background:"none", border:"1px solid #e2e8f0" }}>
                  🕐 {history.length} reporte{history.length>1?"s":""}
                </button>
              )}
            </div>
            {!readOnly&&(
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                {!uploaded&&!pendingImgs.length&&<span style={{ fontSize:11, color:active?"#6366f1":"#94a3b8", fontFamily:"'DM Mono',monospace" }}>
                  {loading?"⏳ Analizando...":active?`📋 Ctrl+V para pegar${isWhatsapp?" (podés pegar varias)":""}`:"Clic aquí → Ctrl+V"}
                </span>}
                {(!uploaded||isWhatsapp)&&!loading&&<label style={{ ...bsm, display:"inline-block" }}>
                  {isWhatsapp?"+ Imagen":"Subir"}
                  <input type="file" accept="image/*" multiple={isWhatsapp} style={{ display:"none" }} onChange={handleFileChange} disabled={loading}/>
                </label>}
                {uploaded&&!isWhatsapp&&<button onClick={()=>onImage(null)} style={{ ...bsm, fontSize:10 }}>↺ Nuevo</button>}
              </div>
            )}
          </div>

          {/* Pending images staging area (WhatsApp only) */}
          {isWhatsapp&&pendingImgs.length>0&&!readOnly&&(
            <div style={{ marginTop:12, padding:12, background:"rgba(99,102,241,0.05)", borderRadius:8, border:"1px solid #e0e7ff" }}>
              <p style={{ margin:"0 0 8px", fontSize:11, fontFamily:"'DM Mono',monospace", color:"#6366f1", fontWeight:600 }}>
                📸 {pendingImgs.length} imagen{pendingImgs.length>1?"es":""} lista{pendingImgs.length>1?"s":""} — podés seguir pegando más
              </p>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:10 }}>
                {pendingImgs.map((img,i)=>(
                  <div key={i} style={{ position:"relative" }}>
                    <img src={img.preview} alt="" style={{ width:60, height:60, objectFit:"cover", borderRadius:6, border:"1px solid #e2e8f0" }}/>
                    <button onClick={()=>removePending(i)} style={{ position:"absolute", top:-6, right:-6, background:"#ef4444", color:"#fff", border:"none", borderRadius:"50%", width:18, height:18, fontSize:11, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", padding:0 }}>×</button>
                  </div>
                ))}
              </div>
              <button onClick={sendAll} disabled={loading} style={{ ...btn, fontSize:11, padding:"6px 14px" }}>
                {loading?"Analizando...":"🤖 Analizar conversación completa"}
              </button>
            </div>
          )}

          {analysis&&<p style={{ margin:"10px 0 0", fontSize:12, color:"#475569", lineHeight:1.6, fontFamily:"'Lora',serif", borderTop:"1px solid #e2e8f0", paddingTop:10 }}>{analysis}</p>}
        </div>

        {/* Comment */}
        <div style={{ borderTop:`1px solid ${uploaded?(STATUS[zs]?.border||"#86efac"):"#e2e8f0"}`, background:"rgba(255,255,255,0.6)", padding:"10px 16px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:8 }}>
            <span style={{ fontSize:13, marginTop:2 }}>💬</span>
            <div style={{ flex:1 }}>
              <p style={{ margin:"0 0 4px", fontSize:10, fontWeight:600, color:"#94a3b8", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.06em" }}>Comentario del ejecutivo</p>
              {editCom&&!readOnly?(
                <div>
                  <textarea value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Ej: Cuenta sin saldo. Pedí recarga al cliente." style={{ ...inp, minHeight:52, resize:"vertical", fontFamily:"'Lora',serif", fontStyle:"italic" }} autoFocus/>
                  <div style={{ display:"flex", gap:6, marginTop:6 }}>
                    <button onClick={()=>{onComment(draft);setEditCom(false);}} style={btn}>Guardar</button>
                    <button onClick={()=>{setDraft(comment||"");setEditCom(false);}} style={bsm}>Cancelar</button>
                  </div>
                </div>
              ):(
                <div onClick={()=>{if(!readOnly){setDraft(comment||"");setEditCom(true);}}} style={{ cursor:readOnly?"default":"pointer" }}>
                  {comment
                    ?<p style={{ margin:0, fontSize:12, color:"#475569", lineHeight:1.6, fontFamily:"'Lora',serif", fontStyle:"italic" }}>"{comment}"</p>
                    :<p style={{ margin:0, fontSize:12, color:"#cbd5e1", fontFamily:"'DM Mono',monospace" }}>{readOnly?"Sin comentario":"+ Agregar comentario de contexto..."}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── GLOBAL ANALYSIS ────────────────────────────────────────────────────────
function GlobalBox({ client, onAnalyze, loading }) {
  const hasData = client.meta.uploaded||client.whatsapp.uploaded;
  return (
    <div style={{ background:client.globalAnalysis?"#0f172a":"#f8fafc", borderRadius:14, padding:20, border:"1px solid #e2e8f0" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:client.globalAnalysis?12:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontSize:20 }}>🤖</span>
          <div>
            <p style={{ margin:0, fontSize:13, fontWeight:600, fontFamily:"'DM Mono',monospace", color:client.globalAnalysis?"#fff":"#0f172a" }}>Análisis global con contexto</p>
            <p style={{ margin:0, fontSize:11, color:client.globalAnalysis?"#64748b":"#94a3b8", fontFamily:"'DM Mono',monospace" }}>Claude cruza todos los reportes + comentarios</p>
          </div>
        </div>
        <button onClick={onAnalyze} disabled={loading||!hasData} style={{ ...btn, background:client.globalAnalysis?"#1e293b":"#0f172a", opacity:(!hasData||loading)?0.5:1, fontSize:11 }}>
          {loading?"Analizando...":client.globalAnalysis?"↺ Reanalizar":"Generar análisis"}
        </button>
      </div>
      {client.globalAnalysis&&(
        <div style={{ background:"#1e293b", borderRadius:10, padding:16 }}>
          <p style={{ margin:0, fontSize:13, color:"#e2e8f0", lineHeight:1.8, fontFamily:"'Lora',serif" }}>{client.globalAnalysis}</p>
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
      {emails.map((e,i)=>(
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
function ClientCard({ client, execName, onClick }) {
  const st=computeStatus(client); const days=daysSince(client.lastUpdate);
  const comments=["meta","google","whatsapp"].filter(k=>client[k].comment).length;
  return (
    <div onClick={onClick} style={{ background:"#fff", border:`1px solid ${st==="red"?"#fca5a5":st==="yellow"?"#fcd34d":"#e2e8f0"}`, borderRadius:14, padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", gap:14 }}
      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.08)"}
      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
      <Av initials={client.name.slice(0,2).toUpperCase()} size={40}/>
      <div style={{ flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
          <p style={{ margin:0, fontWeight:700, fontSize:14, fontFamily:"'Fraunces',serif", color:"#0f172a" }}>{client.name}</p>
          {client.adminNote&&<span title="Nota del admin">📌</span>}
        </div>
        <p style={{ margin:0, fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>
          {execName} · {client.rubro} · {days}d · {["meta","google","whatsapp"].filter(k=>client[k].uploaded).length}/3
          {comments>0&&<span style={{ color:"#6366f1" }}> · 💬{comments}</span>}
          {client.globalAnalysis&&<span style={{ color:"#22c55e" }}> · 🤖</span>}
        </p>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        <div style={{ display:"flex", gap:4 }}>
          {["meta","google","whatsapp"].map(k=><span key={k} style={{ width:7, height:7, borderRadius:"50%", background:client[k].uploaded?(STATUS[client[k].status]?.color||"#22c55e"):"#e2e8f0" }}/>)}
        </div>
        <Badge status={st}/>
        <span style={{ color:"#94a3b8" }}>›</span>
      </div>
    </div>
  );
}

// ─── CLIENT DETAIL ───────────────────────────────────────────────────────────
function ClientDetail({ client, executive, isAdmin, onBack, onUpload, onComment, onGlobal, onAdminNote, sendEmail, globalLoading }) {
  const [aKey,setAKey]=useState(null);
  const [editNote,setEditNote]=useState(false);
  const [draftNote,setDraftNote]=useState(client.adminNote||"");
  const st=computeStatus(client); const days=daysSince(client.lastUpdate);
  const {kpis,servicios}=client; const today=new Date().toLocaleDateString("es-AR");

  const buildPrompt = (type) => {
    const kpiTxt = `KPIs objetivo: ${kpis.leadsObjetivo} leads/mes, CPL $${kpis.cplMin}–$${kpis.cplMax}${kpis.roasObjetivo>0?`, ROAS ${kpis.roasObjetivo}x`:""}. Rubro: ${client.rubro}. Hoy: ${today}.`;
    const svcTxt = `Servicios contratados: ${servicios.detalle}. Inversión total pactada: $${servicios.inversion.toLocaleString("es-AR")}/mes.`;
    const ctx = client[type].comment?`\nContexto del ejecutivo: "${client[type].comment}"`:"";
    const base = `${kpiTxt}\n${svcTxt}${ctx}\n\n`;
    const instruccion = "Respondé en máximo 2 oraciones cortas en español, sin asteriscos ni markdown. Empezá con ✅ si está bien, con ⚠️ si necesita ajustes, o con 🔴 si hay un problema crítico. Sé muy directo y numérico.";
    if (type==="meta") return `${base}Analizá este screenshot de Meta Ads: extraé métricas clave, verificá si la fecha es reciente (advertí si tiene más de 7 días desde hoy), comparalas contra los KPIs y los servicios contratados. ${instruccion}`;
    if (type==="google") return `${base}Analizá este screenshot de Google Ads: extraé métricas clave, verificá fecha, comparalas contra KPIs y servicios. ${instruccion}`;
    return ""; // whatsapp uses buildWhatsappPrompt
  };

  const buildWhatsappPrompt = () => {
    const {ejecutivo="el ejecutivo",filmmaker="",clienteContacto="el cliente"}=client.grupo||{};
    const agencia=[ejecutivo,filmmaker].filter(Boolean).join(" y ");
    const ctx=client.whatsapp.comment?`\nContexto del ejecutivo: "${client.whatsapp.comment}"`:"";
    return `Rubro: ${client.rubro}. Hoy: ${today}.\nMiembros de nuestra agencia en el grupo de WhatsApp: ${agencia}. Contacto del cliente: ${clienteContacto}.${ctx}\n\nEstas imágenes son capturas consecutivas del mismo grupo de WhatsApp. Ignorá los mensajes enviados por ${agencia} (son de nuestra agencia). Analizá únicamente el comportamiento y tono de ${clienteContacto} (el cliente): ¿hay quejas o riesgo de churn? ¿cuál es el tono general? ¿hay algo urgente que resolver?\nRespondé en máximo 2 oraciones en español, sin asteriscos. Empezá con ✅ si está bien, ⚠️ si hay que prestar atención, o 🔴 si hay un problema urgente.`;
  };

  const handleImage = async (type, file) => {
    if (file===null) { onUpload(client.id,type,null,null); return; }
    setAKey(`${client.id}-${type}`);
    try {
      const b64 = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:300, messages:[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:file.type,data:b64}},
          {type:"text",text:buildPrompt(type)}
        ]}]})
      });
      const data=await resp.json();
      const text=data.content?.[0]?.text||"No se pudo analizar.";
      const zs=text.startsWith("🔴")?"red":text.startsWith("⚠️")?"yellow":"green";
      onUpload(client.id,type,text,zs);
    } catch { onUpload(client.id,type,"Error al analizar. Intentá de nuevo.","yellow"); }
    finally { setAKey(null); }
  };

  // Multi-image handler for WhatsApp
  const handleWhatsappImages = async (files) => {
    if (!files.length) return;
    setAKey(`${client.id}-whatsapp`);
    try {
      const contents = await Promise.all(files.map(async(file)=>{
        const b64=await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
        return {type:"image",source:{type:"base64",media_type:file.type,data:b64}};
      }));
      contents.push({type:"text",text:buildWhatsappPrompt()});
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:300, messages:[{role:"user",content:contents}]})
      });
      const data=await resp.json();
      const text=data.content?.[0]?.text||"No se pudo analizar.";
      const zs=text.startsWith("🔴")?"red":text.startsWith("⚠️")?"yellow":"green";
      onUpload(client.id,"whatsapp",text,zs);
    } catch { onUpload(client.id,"whatsapp","Error al analizar. Intentá de nuevo.","yellow"); }
    finally { setAKey(null); }
  };
    const secs = ["meta","google","whatsapp"].map(k=>{
      if (!client[k].uploaded) return null;
      return `[${k.toUpperCase()}]\nAnálisis: ${client[k].analysis}\nComentario ejecutivo: ${client[k].comment||"ninguno"}`;
    }).filter(Boolean).join("\n\n");
    return `Sos supervisor de una agencia de marketing. Diagnóstico global del cliente "${client.name}" (${client.rubro}).\nKPIs: ${kpis.leadsObjetivo} leads/mes · CPL $${kpis.cplMin}–$${kpis.cplMax}${kpis.roasObjetivo>0?` · ROAS ${kpis.roasObjetivo}x`:""}.\nServicios contratados: ${servicios.detalle}. Inversión pactada: $${servicios.inversion.toLocaleString()}/mes.\n\n${secs}\n\nCon toda esta información: 1) Estado real del cliente considerando el contexto completo incluyendo comentarios del ejecutivo. 2) ¿Hay riesgo de perder este cliente? 3) Acción concreta en las próximas 48hs.\nRespondé en 3 oraciones en español, sin asteriscos ni markdown. Empezá con ✅, ⚠️ o 🔴.`;
  };

  const handleImage = async (type, file) => {
    if (file===null) { onUpload(client.id,type,null,null); return; }
    setAKey(`${client.id}-${type}`);
    try {
      const b64 = await new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(file); });
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:300, messages:[{role:"user",content:[
          {type:"image",source:{type:"base64",media_type:file.type,data:b64}},
          {type:"text",text:buildPrompt(type)}
        ]}]})
      });
      const data=await resp.json();
      const text=data.content?.[0]?.text||"No se pudo analizar.";
      const zs=text.startsWith("🔴")?"red":text.startsWith("⚠️")?"yellow":"green";
      onUpload(client.id,type,text,zs);
    } catch { onUpload(client.id,type,"Error al analizar. Intentá de nuevo.","yellow"); }
    finally { setAKey(null); }
  };

  const buildGlobalPrompt = () => {
    const {ejecutivo="el ejecutivo",filmmaker="",clienteContacto="el cliente"}=client.grupo||{};
    const agencia=[ejecutivo,filmmaker].filter(Boolean).join(" y ");
    const secs = ["meta","google","whatsapp"].map(k=>{
      if (!client[k].uploaded) return null;
      return `[${k.toUpperCase()}]\nAnálisis: ${client[k].analysis}\nComentario ejecutivo: ${client[k].comment||"ninguno"}`;
    }).filter(Boolean).join("\n\n");
    return `Sos supervisor de una agencia de marketing. Diagnóstico global del cliente "${client.name}" (${client.rubro}).\nKPIs: ${kpis.leadsObjetivo} leads/mes · CPL $${kpis.cplMin}–$${kpis.cplMax}${kpis.roasObjetivo>0?` · ROAS ${kpis.roasObjetivo}x`:""}.\nServicios: ${servicios.detalle}. Inversión pactada: $${servicios.inversion.toLocaleString()}/mes.\nEn el grupo de WhatsApp: agencia representada por ${agencia}, cliente es ${clienteContacto}.\n\n${secs}\n\nDiagnóstico: 1) Estado real del cliente considerando todos los datos y comentarios. 2) ¿Riesgo de perder este cliente? 3) Acción concreta en las próximas 48hs.\nRespondé en 3 oraciones en español, sin asteriscos. Empezá con ✅, ⚠️ o 🔴.`;
  };

  const handleGlobal = async () => {
    onGlobal(client.id,null,true);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:400, messages:[{role:"user",content:buildGlobalPrompt()}]})
      });
      const data=await resp.json();
      onGlobal(client.id,data.content?.[0]?.text||"Error.",false);
    } catch { onGlobal(client.id,"Error al generar análisis global.",false); }
  };

  const saveNote = () => {
    onAdminNote(client.id,draftNote);
    setEditNote(false);
    if (draftNote.trim()) sendEmail({ to:executive?.email, subject:`📌 Nota de Gabi sobre "${client.name}"`, body:draftNote });
  };

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

      {/* KPI + Servicios chips */}
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
        {[
          `🎯 ${kpis.leadsObjetivo} leads/mes`,
          `💰 CPL $${kpis.cplMin.toLocaleString()}–$${kpis.cplMax.toLocaleString()}`,
          kpis.roasObjetivo>0?`📈 ROAS ${kpis.roasObjetivo}x`:null,
          servicios.metaCampanas>0?`📘 ${servicios.metaCampanas} camp. Meta`:null,
          servicios.googleCampanas>0?`🔍 ${servicios.googleCampanas} camp. Google`:null,
          `💵 $${servicios.inversion.toLocaleString()} inversión/mes`,
        ].filter(Boolean).map((t,i)=>(
          <span key={i} style={{ background:"#f1f5f9", color:"#475569", border:"1px solid #e2e8f0", borderRadius:20, padding:"3px 10px", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{t}</span>
        ))}
      </div>
      {servicios.detalle&&<p style={{ margin:"0 0 6px", fontSize:11, color:"#94a3b8", fontFamily:"'Lora',serif", fontStyle:"italic" }}>📋 {servicios.detalle}</p>}
      {client.grupo&&(client.grupo.ejecutivo||client.grupo.clienteContacto)&&(
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:14 }}>
          {client.grupo.ejecutivo&&<span style={{ background:"#ede9fe", color:"#6d28d9", border:"1px solid #ddd6fe", borderRadius:20, padding:"3px 10px", fontSize:11, fontFamily:"'DM Mono',monospace" }}>👤 Ejecutivo en WA: {client.grupo.ejecutivo}</span>}
          {client.grupo.filmmaker&&<span style={{ background:"#ede9fe", color:"#6d28d9", border:"1px solid #ddd6fe", borderRadius:20, padding:"3px 10px", fontSize:11, fontFamily:"'DM Mono',monospace" }}>🎬 Filmmaker en WA: {client.grupo.filmmaker}</span>}
          {client.grupo.clienteContacto&&<span style={{ background:"#f0fdf4", color:"#15803d", border:"1px solid #bbf7d0", borderRadius:20, padding:"3px 10px", fontSize:11, fontFamily:"'DM Mono',monospace" }}>🙋 Cliente: {client.grupo.clienteContacto}</span>}
        </div>
      )}

      {/* Alerta inactividad */}
      {days>=3&&(
        <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:10, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#dc2626", fontFamily:"'DM Mono',monospace", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span>⏰ Sin actualización hace {days} días</span>
          {isAdmin&&<button style={brd} onClick={()=>sendEmail({ to:executive?.email, subject:`⏰ Alerta: "${client.name}" sin actualización hace ${days} días`, body:`El cliente ${client.name} lleva ${days} días sin reporte.` })}>Alertar al ejecutivo</button>}
        </div>
      )}

      {/* Admin note */}
      {isAdmin&&(
        <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:editNote||client.adminNote?8:0 }}>
            <p style={{ margin:0, fontSize:10, fontWeight:600, color:"#854F0B", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.06em" }}>📌 Nota para el ejecutivo</p>
            {!editNote&&<button style={{ ...bsm, background:"#fef3c7", border:"1px solid #fcd34d", color:"#854F0B", fontSize:10 }} onClick={()=>{setDraftNote(client.adminNote||"");setEditNote(true);}}>{client.adminNote?"Editar":"+ Agregar"}</button>}
          </div>
          {editNote?(
            <div>
              <textarea value={draftNote} onChange={e=>setDraftNote(e.target.value)} placeholder="Ej: Vale, llamá al cliente hoy. Coordiná una reunión esta semana." style={{ ...inp, minHeight:56, resize:"vertical", fontFamily:"'Lora',serif", fontStyle:"italic", background:"#fffbeb", border:"1px solid #fcd34d" }} autoFocus/>
              <div style={{ display:"flex", gap:6, marginTop:8 }}>
                <button style={{ ...btn, background:"#854F0B" }} onClick={saveNote}>Guardar y enviar email</button>
                <button style={bsm} onClick={()=>setEditNote(false)}>Cancelar</button>
              </div>
            </div>
          ):client.adminNote?(
            <p style={{ margin:0, fontSize:12, color:"#854F0B", fontFamily:"'Lora',serif", fontStyle:"italic" }}>"{client.adminNote}"</p>
          ):null}
        </div>
      )}

      {/* Executive sees admin note read-only */}
      {!isAdmin&&client.adminNote&&(
        <div style={{ background:"#fffbeb", border:"1px solid #fcd34d", borderRadius:10, padding:"12px 14px", marginBottom:14 }}>
          <p style={{ margin:"0 0 4px", fontSize:10, fontWeight:600, color:"#854F0B", fontFamily:"'DM Mono',monospace", textTransform:"uppercase" }}>📌 Nota de Gabi</p>
          <p style={{ margin:0, fontSize:12, color:"#854F0B", fontFamily:"'Lora',serif", fontStyle:"italic" }}>"{client.adminNote}"</p>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:16 }}>
        {[["meta","📊","Meta Ads"],["google","🔍","Google Ads"],["whatsapp","💬","WhatsApp — Atención al cliente"]].map(([type,icon,label])=>(
          <PasteZone key={type} label={label} icon={icon} {...client[type]}
            onImage={isAdmin?()=>{}:(f)=>{ if(f===null){onUpload(client.id,type,null,null);}else{handleImage(type,f);} }}
            onImages={type==="whatsapp"&&!isAdmin?handleWhatsappImages:undefined}
            onComment={(c)=>onComment(client.id,type,c)}
            loading={aKey===`${client.id}-${type}`}
            readOnly={isAdmin}
            isWhatsapp={type==="whatsapp"}/>
        ))}
      </div>

      <GlobalBox client={client} onAnalyze={handleGlobal} loading={globalLoading}/>
    </div>
  );
}

// ─── ADMIN DASHBOARD ─────────────────────────────────────────────────────────
function AdminDash({ clients, users, onAddUser, onAddClient, onOpen, sendEmail }) {
  const [tab,setTab]=useState("clients");
  const [showUF,setShowUF]=useState(false);
  const [showCF,setShowCF]=useState(false);
  const [uf,setUf]=useState({name:"",email:"",password:""});
  const [cf,setCf]=useState({ name:"",executiveId:"",rubro:"servicios",
    kpis:{leadsObjetivo:30,cplMin:400,cplMax:2500,roasObjetivo:0},
    servicios:{metaCampanas:3,googleCampanas:0,inversion:100000,detalle:""},
    grupo:{ejecutivo:"",filmmaker:"",clienteContacto:""}});
  const execs=users.filter(u=>u.role==="executive");
  const enriched=clients.map(c=>({...c,st:computeStatus(c)}));
  const reds=enriched.filter(c=>c.st==="red").length;
  const yellows=enriched.filter(c=>c.st==="yellow").length;

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

      {tab==="clients"&&<>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <p style={{ margin:0, fontSize:12, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{clients.length} clientes</p>
          <button style={btn} onClick={()=>setShowCF(!showCF)}>+ Nuevo cliente</button>
        </div>
        {showCF&&(
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:14, padding:18, marginBottom:14 }}>
            <p style={{ margin:"0 0 12px", fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:600 }}>Nuevo cliente</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              {[["Nombre","name","text","Nombre del cliente"],["Rubro","rubro","select",""],["Ejecutivo","executiveId","exec",""]].map(([lbl,key,t,ph])=>(
                <div key={key}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                  {t==="select"?<select style={inp} value={cf.rubro} onChange={e=>setCf({...cf,rubro:e.target.value})}>{RUBROS.map(r=><option key={r} value={r}>{r}</option>)}</select>
                  :t==="exec"?<select style={inp} value={cf.executiveId} onChange={e=>setCf({...cf,executiveId:e.target.value})}><option value="">Seleccionar...</option>{execs.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select>
                  :<input style={inp} placeholder={ph} value={cf[key]||""} onChange={e=>setCf({...cf,[key]:e.target.value})}/>}
                </div>
              ))}
            </div>
            <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>KPIs objetivo</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
              {[["Leads/mes","leadsObjetivo","30"],["CPL mín $","cplMin","400"],["CPL máx $","cplMax","2500"],["ROAS (0=N/A)","roasObjetivo","0"]].map(([lbl,key,ph])=>(
                <div key={key}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                  <input type="number" style={inp} placeholder={ph} value={cf.kpis[key]||""} onChange={e=>setCf({...cf,kpis:{...cf.kpis,[key]:parseFloat(e.target.value)||0}})}/>
                </div>
              ))}
            </div>
            <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Servicios contratados</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
              {[["Campañas Meta","metaCampanas","3"],["Campañas Google","googleCampanas","0"],["Inversión $/mes","inversion","100000"]].map(([lbl,key,ph])=>(
                <div key={key}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                  <input type="number" style={inp} placeholder={ph} value={cf.servicios[key]||""} onChange={e=>setCf({...cf,servicios:{...cf.servicios,[key]:parseFloat(e.target.value)||0}})}/>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:12 }}>
              <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>Detalle de campañas</p>
              <input style={inp} placeholder="Ej: 3 Meta (tráfico, conversión, remarketing) + 3 Google (branded, genérico, display)" value={cf.servicios.detalle} onChange={e=>setCf({...cf,servicios:{...cf.servicios,detalle:e.target.value}})}/>
            </div>
            <p style={{ margin:"0 0 8px", fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace" }}>Participantes del grupo WhatsApp</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              {[["Ejecutivo en grupo","ejecutivo","Nombre del ejecutivo"],["Filmmaker en grupo (opcional)","filmmaker","Nombre del filmmaker"],["Contacto del cliente","clienteContacto","Nombre del cliente en WA"]].map(([lbl,key,ph])=>(
                <div key={key}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                  <input style={inp} placeholder={ph} value={cf.grupo[key]||""} onChange={e=>setCf({...cf,grupo:{...cf.grupo,[key]:e.target.value}})}/>
                </div>
              ))}
            </div>
            <button style={btn} disabled={!cf.name||!cf.executiveId}
              onClick={()=>{ onAddClient(cf); setCf({name:"",executiveId:"",rubro:"servicios",kpis:{leadsObjetivo:30,cplMin:400,cplMax:2500,roasObjetivo:0},servicios:{metaCampanas:3,googleCampanas:0,inversion:100000,detalle:""},grupo:{ejecutivo:"",filmmaker:"",clienteContacto:""}}); setShowCF(false); }}>
              Crear cliente
            </button>
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {enriched.map(c=><ClientCard key={c.id} client={c} execName={users.find(u=>u.id===c.executiveId)?.name} onClick={()=>onOpen(c.id)}/>)}
        </div>
      </>}

      {tab==="executives"&&<>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <p style={{ margin:0, fontSize:12, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{execs.length} ejecutivos</p>
          <button style={btn} onClick={()=>setShowUF(!showUF)}>+ Nuevo ejecutivo</button>
        </div>
        {showUF&&(
          <div style={{ background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:14, padding:18, marginBottom:14 }}>
            <p style={{ margin:"0 0 12px", fontFamily:"'DM Mono',monospace", fontSize:13, fontWeight:600 }}>Nuevo ejecutivo</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
              {[["Nombre","name","text","Nombre completo"],["Email","email","email","email@risingup.com"],["Contraseña","password","password","••••••••"]].map(([lbl,key,t,ph])=>(
                <div key={key}>
                  <p style={{ margin:"0 0 4px", fontSize:10, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{lbl}</p>
                  <input style={inp} type={t} placeholder={ph} value={uf[key]} onChange={e=>setUf({...uf,[key]:e.target.value})}/>
                </div>
              ))}
            </div>
            <button style={btn} disabled={!uf.name||!uf.email||!uf.password}
              onClick={()=>{ onAddUser(uf); setUf({name:"",email:"",password:""}); setShowUF(false); }}>
              Crear ejecutivo
            </button>
          </div>
        )}
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {execs.map(exec=>{
            const mc=clients.filter(c=>c.executiveId===exec.id);
            const cr=mc.filter(c=>computeStatus(c)==="red").length;
            return (
              <div key={exec.id} style={{ background:"#fff", border:"1px solid #e2e8f0", borderRadius:12, padding:"14px 18px", display:"flex", alignItems:"center", gap:14 }}>
                <Av initials={exec.avatar||exec.name.slice(0,2).toUpperCase()} size={40} color="#6366f1"/>
                <div style={{ flex:1 }}>
                  <p style={{ margin:"0 0 2px", fontWeight:700, fontSize:14, fontFamily:"'Fraunces',serif", color:"#0f172a" }}>{exec.name}</p>
                  <p style={{ margin:0, fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>{exec.email} · {mc.length} clientes</p>
                </div>
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  {cr>0&&<Badge status="red"/>}
                  {cr>0&&<button style={brd} onClick={()=>sendEmail({ to:exec.email, subject:`⚠️ Tenés ${cr} cliente(s) en estado Urgente`, body:`Hay ${cr} clientes que requieren atención urgente.` })}>Alertar</button>}
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
function ExecDash({ user, clients, onOpen }) {
  const my=clients.filter(c=>c.executiveId===user.id);
  const reds=my.filter(c=>computeStatus(c)==="red").length;
  return (
    <div>
      <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:12, padding:"14px 18px", marginBottom:20, display:"flex", alignItems:"center", gap:12 }}>
        <Av initials={user.avatar} size={42} color="#16a34a"/>
        <div>
          <p style={{ margin:"0 0 2px", fontWeight:700, fontSize:15, fontFamily:"'Fraunces',serif", color:"#0f172a" }}>Hola, {user.name.split(" ")[0]} 👋</p>
          <p style={{ margin:0, fontSize:11, color:"#64748b", fontFamily:"'DM Mono',monospace" }}>{my.length} clientes activos{reds>0?` · ${reds} urgentes`:""}</p>
        </div>
      </div>
      <p style={{ margin:"0 0 12px", fontSize:10, color:"#94a3b8", fontFamily:"'DM Mono',monospace", textTransform:"uppercase", letterSpacing:"0.08em" }}>Tus clientes</p>
      {my.length===0
        ?<div style={{ background:"#f8fafc", border:"1px dashed #e2e8f0", borderRadius:12, padding:40, textAlign:"center" }}><p style={{ margin:0, fontSize:12, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>Sin clientes asignados todavía</p></div>
        :<div style={{ display:"flex", flexDirection:"column", gap:8 }}>{my.map(c=><ClientCard key={c.id} client={c} execName={user.name} onClick={()=>onOpen(c.id)}/>)}</div>}
    </div>
  );
}

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [user,setUser]=useState(null);
  const [users,setUsers]=useState(INITIAL_USERS);
  const [clients,setClients]=useState(INITIAL_CLIENTS);
  const [selId,setSelId]=useState(null);
  const [gLoading,setGLoading]=useState(false);
  const [emails,setEmails]=useState([]);

  const sendEmail=(e)=>setEmails(p=>[...p,e]);
  const dismissEmail=(i)=>setEmails(p=>p.filter((_,idx)=>idx!==i));

  const addUser=({name,email,password})=>{
    const avatar=name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
    setUsers(p=>[...p,{id:Date.now(),email,password,role:"executive",name,avatar}]);
  };

  const addClient=(cf)=>{
    setClients(p=>[...p,{
      id:Date.now(), name:cf.name, executiveId:parseInt(cf.executiveId), rubro:cf.rubro,
      lastUpdate:new Date().toISOString(), kpis:cf.kpis, servicios:cf.servicios,
      grupo:cf.grupo||{ejecutivo:"",filmmaker:"",clienteContacto:""},
      globalAnalysis:null, adminNote:"",
      meta:mk(null,null), google:mk(null,null), whatsapp:mk(null,null),
    }]);
  };

  const handleUpload=(clientId,type,analysis,zs)=>{
    setClients(p=>p.map(c=>{
      if(c.id!==clientId) return c;
      if(analysis===null) return {...c,globalAnalysis:null,[type]:mk(null,null)};
      const newEntry={date:new Date().toLocaleDateString("es-AR"),analysis,status:zs,comment:c[type].comment||""};
      const history=[newEntry,...(c[type].history||[])].slice(0,6);
      return {...c,lastUpdate:new Date().toISOString(),globalAnalysis:null,
        [type]:{...c[type],uploaded:true,analysis,status:zs,history}};
    }));
  };

  const handleComment=(clientId,type,comment)=>{
    setClients(p=>p.map(c=>c.id!==clientId?c:{...c,globalAnalysis:null,[type]:{...c[type],comment}}));
  };

  const handleGlobal=(clientId,result,loading)=>{
    setGLoading(loading);
    if(!loading) setClients(p=>p.map(c=>c.id===clientId?{...c,globalAnalysis:result}:c));
  };

  const handleAdminNote=(clientId,note)=>{
    setClients(p=>p.map(c=>c.id!==clientId?c:{...c,adminNote:note}));
  };

  const sel=clients.find(c=>c.id===selId);
  const isAdmin=user?.role==="admin";

  if(!user) return(<><link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700;900&family=DM+Mono:wght@400;500;600&family=Lora:ital@0;1&display=swap" rel="stylesheet"/><Login onLogin={setUser}/></>);

  return(
    <div style={{ minHeight:"100vh", background:"#f8fafc", fontFamily:"'DM Mono',monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;700;900&family=DM+Mono:wght@400;500;600&family=Lora:ital@0;1&display=swap" rel="stylesheet"/>
      <div style={{ background:"#0f172a", padding:"0 24px" }}>
        <div style={{ maxWidth:820, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:56 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:18 }}>⚡</span>
            <span style={{ fontFamily:"'Fraunces',serif", fontSize:16, color:"#fff", fontWeight:700 }}>RisingUp</span>
            <span style={{ fontSize:10, color:"#475569", marginLeft:2 }}>/ {isAdmin?"Admin":"Ejecutivo"}</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {selId&&<button onClick={()=>setSelId(null)} style={{ ...bsm, background:"#1e293b", color:"#94a3b8", border:"none", fontSize:11 }}>← Dashboard</button>}
            <Av initials={user.avatar} size={28} color={isAdmin?"#6366f1":"#16a34a"}/>
            <span style={{ fontSize:11, color:"#94a3b8", fontFamily:"'DM Mono',monospace" }}>{user.name.split(" ")[0]}</span>
            <button onClick={()=>{setUser(null);setSelId(null);}} style={{ ...bsm, background:"#1e293b", color:"#64748b", border:"none", fontSize:11 }}>Salir</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth:820, margin:"0 auto", padding:"24px 18px" }}>
        {!selId
          ?(isAdmin
            ?<AdminDash clients={clients} users={users} onAddUser={addUser} onAddClient={addClient} onOpen={setSelId} sendEmail={sendEmail}/>
            :<ExecDash user={user} clients={clients} onOpen={setSelId}/>)
          :<ClientDetail client={sel} executive={users.find(u=>u.id===sel.executiveId)}
              isAdmin={isAdmin} onBack={()=>setSelId(null)}
              onUpload={handleUpload} onComment={handleComment}
              onGlobal={handleGlobal} onAdminNote={handleAdminNote}
              sendEmail={sendEmail} globalLoading={gLoading}/>}
      </div>
      <EmailToast emails={emails} onDismiss={dismissEmail}/>
    </div>
  );
}
