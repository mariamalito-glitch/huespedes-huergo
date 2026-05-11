import { useState, useEffect, useRef } from "react";

// ─── FIREBASE ──────────────────────────────────────────────────────
let fbSet, fbListen;
async function initFirebase() {
  const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const { getDatabase, ref, set, onValue, off } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js");
  const cfg = {
    apiKey:"AIzaSyDlGAAviTBQTbm2rDY29cVaPCP8zvjLB7Q",
    authDomain:"huespedes-4fcdf.firebaseapp.com",
    databaseURL:"https://huespedes-4fcdf-default-rtdb.firebaseio.com",
    projectId:"huespedes-4fcdf",
    storageBucket:"huespedes-4fcdf.firebasestorage.app",
    messagingSenderId:"1047981839207",
    appId:"1:1047981839207:web:38711ce83c7e2846dcd5c2",
  };
  const app = initializeApp(cfg);
  const db  = getDatabase(app);
  fbSet    = (path, val) => set(ref(db, path), val);
  fbListen = (path, cb) => { const r=ref(db,path); onValue(r,s=>cb(s.exists()?s.val():null)); return ()=>off(r); };
}

const ADMIN_PASS = "admin123";
const TODAY = new Date().toISOString().slice(0,10);

function parseCSVLine(line) {
  const res=[]; let cur=""; let inQ=false;
  for (let c of line) { if(c==='"') inQ=!inQ; else if(c===','&&!inQ){res.push(cur.trim());cur="";}else cur+=c; }
  res.push(cur.trim()); return res;
}
function parseCSV(text) {
  const lines=text.split(/\r?\n/).filter(l=>l.trim());
  const headers=parseCSVLine(lines[0]).map(h=>h.toLowerCase().trim().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,""));
  return { headers, rows:lines.slice(1).map(l=>{ const vals=parseCSVLine(l); const obj={}; headers.forEach((h,i)=>obj[h]=(vals[i]||"").trim()); return obj; }).filter(r=>Object.values(r).some(v=>v)) };
}
function toISODate(str) {
  if(!str) return ""; const d=str.trim();
  const m1=d.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/); if(m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  const m2=d.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/); if(m2) return `${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`; return d;
}
function findField(obj, cands) { const keys=Object.keys(obj); for(let c of cands){const k=keys.find(k=>k===c||k.includes(c)); if(k&&obj[k])return obj[k];} return ""; }
function fmtDate(iso) { if(!iso) return "—"; const[y,m,d]=iso.split("-"); return `${d}/${m}/${y}`; }
function nowTimeStr() { const n=new Date(); return `${String(n.getHours()).padStart(2,'0')}:${String(n.getMinutes()).padStart(2,'0')}`; }
function safeKey(id) { return (id||"").replace(/[.#$/[\]]/g,"_"); }

const C = {
  bg:"#F4F6F9",white:"#FFFFFF",navy:"#1B2A4A",accent:"#3B6FD4",accentLight:"#EBF0FA",
  green:"#2E7D32",greenBg:"#E8F5E9",amber:"#B45309",amberBg:"#FEF3C7",
  red:"#B71C1C",redBg:"#FFEBEE",gray:"#555E6B",grayBg:"#F1F3F5",
  border:"#DDE2EA",text:"#1A1F2B",textSec:"#5A6270",textTer:"#8C95A0",cardGray:"#E8ECF0",
  checkinBg:"#1A3A6B",inhouseBg:"#1B5E20",checkoutBg:"#7B1515",checkedIn:"#0D3321",
};
const S = {
  input:{ width:"100%",boxSizing:"border-box",fontSize:14,padding:"8px 12px",borderRadius:8,border:`1px solid ${C.border}`,background:C.white,color:C.text },
  btnPrimary:{ background:C.accent,color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",fontSize:14,fontWeight:600,cursor:"pointer" },
  btnSecondary:{ background:C.white,color:C.accent,border:`1px solid ${C.accent}`,borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:500,cursor:"pointer" },
  btnDanger:{ background:C.redBg,color:C.red,border:`1px solid #FFCDD2`,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:500,cursor:"pointer" },
  btnEdit:{ background:"#FFF8E1",color:"#B45309",border:`1px solid #FFD54F`,borderRadius:8,padding:"5px 12px",fontSize:12,fontWeight:500,cursor:"pointer" },
  card:{ background:C.white,borderRadius:12,border:`1px solid ${C.border}`,padding:"1rem 1.25rem" },
};

function getStatus(h, fecha) {
  if (h.ingreso===fecha) return "checkin";
  if (h.salida===fecha)  return "checkout";
  return "inhouse";
}
function huespedBg(s) { return s==="checkin"?C.checkinBg:s==="checkout"?C.checkoutBg:C.inhouseBg; }
function huespedLabel(s) {
  if(s==="checkin")  return {text:"✓ Check-in hoy",  bg:"rgba(100,160,255,0.25)",color:"#90CAF9"};
  if(s==="checkout") return {text:"↑ Check-out hoy", bg:"rgba(255,100,100,0.25)",color:"#EF9A9A"};
  return                    {text:"● In-house",       bg:"rgba(100,200,100,0.25)",color:"#A5D6A7"};
}

function Badge({color,children}){
  const m={green:{bg:C.greenBg,c:C.green},amber:{bg:C.amberBg,c:C.amber},red:{bg:C.redBg,c:C.red},blue:{bg:C.accentLight,c:C.accent},gray:{bg:C.grayBg,c:C.gray}};
  const s=m[color]||m.gray;
  return <span style={{background:s.bg,color:s.c,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,whiteSpace:"nowrap"}}>{children}</span>;
}
function SectionHeader({title,subtitle}){
  return <div style={{marginBottom:"1.25rem"}}><h2 style={{margin:0,fontSize:18,fontWeight:700,color:C.navy}}>{title}</h2>{subtitle&&<p style={{margin:"4px 0 0",fontSize:13,color:C.textSec}}>{subtitle}</p>}</div>;
}
function Modal({title,onClose,children,wide}){
  return <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
    <div style={{background:C.white,borderRadius:14,border:`1px solid ${C.border}`,width:"100%",maxWidth:wide?720:560,maxHeight:"90vh",overflow:"auto",boxShadow:"0 8px 32px rgba(0,0,0,0.18)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"1rem 1.25rem",borderBottom:`1px solid ${C.border}`,background:C.navy,borderRadius:"14px 14px 0 0"}}>
        <span style={{fontWeight:600,fontSize:16,color:"#fff"}}>{title}</span>
        <button onClick={onClose} style={{background:"rgba(255,255,255,0.15)",border:"none",fontSize:18,cursor:"pointer",color:"#fff",borderRadius:6,width:28,height:28,lineHeight:"28px",textAlign:"center"}}>×</button>
      </div>
      <div style={{padding:"1.25rem"}}>{children}</div>
    </div>
  </div>;
}
function Field({label,children}){
  return <div style={{marginBottom:14}}>
    <div style={{fontSize:12,fontWeight:600,color:C.textSec,marginBottom:5,textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
    {children}
  </div>;
}
function Toast({msg,isError}){
  if(!msg) return null;
  return <div style={{background:isError?C.amberBg:C.greenBg,color:isError?C.amber:C.green,border:`1px solid ${isError?"#FCD34D":"#A5D6A7"}`,padding:"10px 1.5rem",fontSize:13,fontWeight:500}}>{msg}</div>;
}

// ─── MODAL DETALLE HUÉSPED (inhouse / checkout) ────────────────────
function DetalleHuespedModal({ huesped, fecha, registros, onClose }) {
  const reg = registros[safeKey(huesped.id)] || {};
  const status = getStatus(huesped, fecha);
  const lbl = huespedLabel(status);
  const [preview, setPreview] = useState(null);

  const rows = [
    ["ID / DNI", huesped.id && !huesped.id.startsWith("h") ? huesped.id : "—"],
    ["Nombre", `${huesped.nombre} ${huesped.apellido}`],
    ["Departamento", huesped.depto || "—"],
    ["Ingreso", fmtDate(huesped.ingreso)],
    ["Salida", fmtDate(huesped.salida)],
    ["Hora ingreso esperada", huesped.horaIngreso || "—"],
    ["Hora ingreso real", reg.horaIngreso || "—"],
    ["Hora salida real", reg.horaSalida || "—"],
    ["Cochera", huesped.cochera || "—"],
    ["Patente", huesped.patente || "—"],
    ["Vehículo", huesped.vehiculo || "—"],
    ["Comentarios", reg.comentario || "—"],
  ];

  return (
    <Modal title={`${huesped.nombre} ${huesped.apellido}`} onClose={onClose} wide>
      <div style={{marginBottom:14}}>
        <span style={{fontSize:12,fontWeight:700,background:lbl.bg.replace("rgba","rgba").replace("0.25","0.5"),color:lbl.color,padding:"4px 12px",borderRadius:12,border:`1px solid ${lbl.color}33`}}>{lbl.text}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 20px",marginBottom:16}}>
        {rows.map(([label,val])=>(
          <div key={label} style={{padding:"7px 0",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:11,fontWeight:600,color:C.textTer,textTransform:"uppercase",letterSpacing:0.4}}>{label}</div>
            <div style={{fontSize:13,color:C.text,marginTop:2,fontWeight:val==="—"?400:500}}>{val}</div>
          </div>
        ))}
      </div>

      {reg.fotos && reg.fotos.length > 0 && (
        <div style={{marginTop:8}}>
          <div style={{fontSize:12,fontWeight:600,color:C.textSec,marginBottom:8,textTransform:"uppercase",letterSpacing:0.5}}>Documentos ({reg.fotos.length})</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:8}}>
            {reg.fotos.map((p,i)=>(
              <div key={i} style={{position:"relative",borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>setPreview(p.dataUrl)}>
                <img src={p.dataUrl} alt={p.name} style={{width:"100%",height:100,objectFit:"cover",display:"block"}} />
                <div style={{fontSize:10,padding:"3px 5px",background:"rgba(0,0,0,0.5)",color:"#fff",position:"absolute",bottom:0,left:0,right:0,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button onClick={onClose} style={{...S.btnSecondary,width:"100%",marginTop:20}}>Cerrar</button>

      {preview && (
        <div onClick={()=>setPreview(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <img src={preview} alt="preview" style={{maxWidth:"100%",maxHeight:"90vh",borderRadius:10,boxShadow:"0 4px 32px rgba(0,0,0,0.5)"}} />
          <button onClick={()=>setPreview(null)} style={{position:"absolute",top:20,right:20,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:24,cursor:"pointer",borderRadius:"50%",width:36,height:36}}>×</button>
        </div>
      )}
    </Modal>
  );
}

// ─── MODAL EDITAR HUÉSPED (con foto de documento) ─────────────────
function EditHuespedModal({ huesped, onSave, onClose, registros, onUpdateReg }) {
  const [form, setForm]     = useState({...huesped});
  const [photos, setPhotos] = useState([]);
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    const reg = registros[safeKey(huesped.id)] || {};
    if (reg.fotos) setPhotos(reg.fotos);
  }, []);

  const labels = { id:"ID / DNI", nombre:"Nombre", apellido:"Apellido", depto:"Departamento", ingreso:"Fecha ingreso", salida:"Fecha salida", horaIngreso:"Hora ingreso", cochera:"Cochera asignada", patente:"Patente", vehiculo:"Marca/Modelo" };
  const fields = ["id","nombre","apellido","depto","ingreso","salida","horaIngreso","cochera","patente","vehiculo"];

  const handlePhoto = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => {
        setPhotos(prev => [...prev, { name: f.name, dataUrl: ev.target.result }]);
      };
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  };

  const removePhoto = (idx) => setPhotos(p => p.filter((_,i)=>i!==idx));

  const handleSave = () => {
    onUpdateReg(huesped.id, { fotos: photos });
    onSave(form);
  };

  return (
    <Modal title={`Editar: ${huesped.nombre} ${huesped.apellido}`} onClose={onClose} wide>
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 20px"}}>
        <div>
          {fields.map(k=>(
            <Field key={k} label={labels[k]}>
              <input value={form[k]||""} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={S.input}
                type={k==="ingreso"||k==="salida"?"date":k==="horaIngreso"?"time":"text"} />
            </Field>
          ))}
        </div>
        <div>
          <Field label="Foto(s) de documento">
            <div style={{border:`2px dashed ${C.border}`,borderRadius:10,padding:"1rem",background:C.bg,textAlign:"center",marginBottom:10}}>
              <div style={{fontSize:28,marginBottom:6}}>📷</div>
              <div style={{fontSize:13,color:C.textSec,marginBottom:10}}>Subí la foto del DNI, pasaporte u otro documento</div>
              <button onClick={()=>fileRef.current.click()} style={{...S.btnSecondary}}>Seleccionar imagen(es)</button>
              <input ref={fileRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={handlePhoto} />
            </div>
            {photos.length > 0 && (
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))", gap:8}}>
                {photos.map((p,i)=>(
                  <div key={i} style={{position:"relative",borderRadius:8,overflow:"hidden",border:`1px solid ${C.border}`,cursor:"pointer"}} onClick={()=>setPreview(p.dataUrl)}>
                    <img src={p.dataUrl} alt={p.name} style={{width:"100%",height:100,objectFit:"cover",display:"block"}} />
                    <button onClick={e=>{e.stopPropagation();removePhoto(i);}}
                      style={{position:"absolute",top:4,right:4,background:"rgba(0,0,0,0.6)",border:"none",color:"#fff",borderRadius:"50%",width:22,height:22,fontSize:12,cursor:"pointer",lineHeight:"22px",textAlign:"center"}}>×</button>
                    <div style={{fontSize:10,padding:"3px 5px",background:"rgba(0,0,0,0.5)",color:"#fff",position:"absolute",bottom:0,left:0,right:0,overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{p.name}</div>
                  </div>
                ))}
              </div>
            )}
            {photos.length===0 && <div style={{fontSize:12,color:C.textTer,textAlign:"center",marginTop:4}}>Sin fotos cargadas</div>}
          </Field>
        </div>
      </div>
      <div style={{display:"flex",gap:10,marginTop:12}}>
        <button onClick={onClose} style={{...S.btnSecondary,flex:1}}>Cancelar</button>
        <button onClick={handleSave} style={{...S.btnPrimary,flex:1}}>Guardar cambios</button>
      </div>

      {preview && (
        <div onClick={()=>setPreview(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
          <img src={preview} alt="preview" style={{maxWidth:"100%",maxHeight:"90vh",borderRadius:10,boxShadow:"0 4px 32px rgba(0,0,0,0.5)"}} />
          <button onClick={()=>setPreview(null)} style={{position:"absolute",top:20,right:20,background:"rgba(255,255,255,0.15)",border:"none",color:"#fff",fontSize:24,cursor:"pointer",borderRadius:"50%",width:36,height:36}}>×</button>
        </div>
      )}
    </Modal>
  );
}

// ─── GLOBO DE HUÉSPED ──────────────────────────────────────────────
function HuespedGlobo({ h, fecha, registros, onMarcarIngreso, onMarcarSalida, onEditar, onVerDetalle }) {
  const status = getStatus(h, fecha);
  const bg     = huespedBg(status);
  const lbl    = huespedLabel(status);
  const reg    = registros[safeKey(h.id)] || {};
  const yaIngreso = !!reg.ingresado;
  const yaSalida  = !!reg.salido;
  const tieneDoc  = reg.fotos && reg.fotos.length > 0;

  const cardBg  = yaIngreso ? C.checkedIn : yaSalida ? "#4A1010" : bg;
  const border  = yaIngreso ? "2px solid #4CAF50" : yaSalida ? "2px solid #EF5350" : "2px solid transparent";

  // Globo es clickeable para ver detalle en inhouse/checkout
  const isClickable = onVerDetalle && (status === "inhouse" || status === "checkout");

  return (
    <div
      onClick={isClickable ? () => onVerDetalle(h) : undefined}
      style={{background:cardBg,borderRadius:10,padding:"10px 14px",border,transition:"background 0.3s",cursor:isClickable?"pointer":"default"}}
      title={isClickable ? "Clic para ver información completa" : undefined}
    >
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontWeight:700,fontSize:14,color:"#fff"}}>{h.nombre} {h.apellido}</span>
            <span style={{fontSize:11,fontWeight:700,background:lbl.bg,color:lbl.color,padding:"2px 8px",borderRadius:12}}>{lbl.text}</span>
            {yaIngreso && <span style={{fontSize:11,fontWeight:700,background:"rgba(76,175,80,0.3)",color:"#A5D6A7",padding:"2px 8px",borderRadius:12}}>🏠 Ingresó {reg.horaIngreso?`a las ${reg.horaIngreso}`:""}</span>}
            {yaSalida  && <span style={{fontSize:11,fontWeight:700,background:"rgba(239,83,80,0.3)",color:"#EF9A9A",padding:"2px 8px",borderRadius:12}}>🚪 Salió {reg.horaSalida?`a las ${reg.horaSalida}`:""}</span>}
            {tieneDoc  && <span style={{fontSize:11,fontWeight:700,background:"rgba(255,255,255,0.2)",color:"#fff",padding:"2px 8px",borderRadius:12}}>📷 {reg.fotos.length} doc.</span>}
            {isClickable && <span style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontStyle:"italic"}}>↗ ver detalle</span>}
          </div>
          <div style={{fontSize:12,color:"rgba(255,255,255,0.75)",display:"flex",flexWrap:"wrap",gap:6,alignItems:"center"}}>
            {h.id&&!h.id.startsWith("h")
              ? <span style={{background:"rgba(255,255,255,0.22)",padding:"2px 8px",borderRadius:5,color:"#fff",fontWeight:700}}>🪪 {h.id}</span>
              : <span style={{color:"rgba(255,255,255,0.4)",fontStyle:"italic",fontSize:11}}>Sin ID</span>}
            {h.horaIngreso && <span>· Ingreso: {h.horaIngreso}</span>}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:5}}>
          <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Estadía</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.9)",fontWeight:500}}>{fmtDate(h.ingreso)} → {fmtDate(h.salida)}</div>
          </div>
          {onEditar && (
            <button onClick={e=>{e.stopPropagation();onEditar(h);}} style={{background:"rgba(255,255,255,0.18)",border:"1px solid rgba(255,255,255,0.35)",color:"#fff",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
              ✏️ Editar
            </button>
          )}
          {onMarcarIngreso && (
            <button onClick={e=>{e.stopPropagation();onMarcarIngreso(h);}} style={{background:yaIngreso?"rgba(76,175,80,0.25)":"rgba(255,255,255,0.18)",border:yaIngreso?"1px solid rgba(76,175,80,0.5)":"1px solid rgba(255,255,255,0.35)",color:yaIngreso?"#A5D6A7":"#fff",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
              {yaIngreso?"✓ Ingresado":"🔑 Marcar ingreso"}
            </button>
          )}
          {onMarcarSalida && (
            <button onClick={e=>{e.stopPropagation();onMarcarSalida(h);}} style={{background:yaSalida?"rgba(239,83,80,0.25)":"rgba(255,255,255,0.18)",border:yaSalida?"1px solid rgba(239,83,80,0.5)":"1px solid rgba(255,255,255,0.35)",color:yaSalida?"#EF9A9A":"#fff",borderRadius:7,padding:"4px 10px",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>
              {yaSalida?"✓ Salida marcada":"🚪 Marcar salida"}
            </button>
          )}
        </div>
      </div>
      {(h.cochera||h.patente||h.vehiculo) && (
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:7}}>
          {h.cochera  && <span style={{fontSize:11,background:"rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.85)",padding:"2px 8px",borderRadius:6}}>🚗 Cochera {h.cochera}</span>}
          {h.patente  && <span style={{fontSize:11,background:"rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.85)",padding:"2px 8px",borderRadius:6}}>Patente: {h.patente}</span>}
          {h.vehiculo && <span style={{fontSize:11,background:"rgba(255,255,255,0.15)",color:"rgba(255,255,255,0.85)",padding:"2px 8px",borderRadius:6}}>{h.vehiculo}</span>}
        </div>
      )}
    </div>
  );
}

function Login({onLogin}){
  const [pass,setPass]=useState(""); const [err,setErr]=useState("");
  const submit=()=>{ pass===ADMIN_PASS?onLogin("admin"):setErr("Contraseña incorrecta."); };
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.white,borderRadius:16,border:`1px solid ${C.border}`,padding:"2rem",width:"100%",maxWidth:360,boxShadow:"0 4px 24px rgba(0,0,0,0.08)"}}>
        <div style={{textAlign:"center",marginBottom:"1.75rem"}}>
          <div style={{fontSize:32,marginBottom:8}}>🔐</div>
          <h1 style={{margin:0,fontSize:20,fontWeight:700,color:C.navy}}>Acceso Administrador</h1>
          <p style={{margin:"6px 0 0",fontSize:13,color:C.textSec}}>Ingresá la contraseña de admin</p>
        </div>
        <Field label="Contraseña">
          <input type="password" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&submit()} style={S.input} placeholder="••••••••" autoFocus />
        </Field>
        {err&&<div style={{color:C.red,fontSize:13,marginBottom:10}}>{err}</div>}
        <button onClick={submit} style={{...S.btnPrimary,width:"100%",padding:"11px 0",marginTop:4}}>Ingresar</button>
      </div>
    </div>
  );
}

// ─── APP ───────────────────────────────────────────────────────────
export default function App() {
  const [userRole,setUserRole] = useState("general");
  const [tab,setTab]           = useState("deptos");
  const [deptos,setDeptos]     = useState([]);
  const [huespedes,setHuespedes] = useState([]);
  const [registros,setRegistros] = useState({});
  const [selectedDepto,setSelectedDepto] = useState(null);
  const [viewDate,setViewDate] = useState(TODAY);
  const [showAddH,setShowAddH] = useState(false);
  const [showImportH,setShowImportH] = useState(false);
  const [showAdminLogin,setShowAdminLogin] = useState(false);
  const [showConfirmBorrar,setShowConfirmBorrar] = useState(false);
  const [showCSVModal,setShowCSVModal] = useState(null);
  const [editHuesped,setEditHuesped] = useState(null);
  const [editDia,setEditDia]     = useState(null);
  // NUEVO: modal detalle para inhouse/checkout
  const [detalleHuesped,setDetalleHuesped] = useState(null);
  const [importMsg,setImportMsg] = useState("");
  const [importError,setImportError] = useState(false);
  const [loading,setLoading]   = useState(true);
  const [searchDeptos,setSearchDeptos] = useState("");
  const [searchAdmin,setSearchAdmin]   = useState("");
  const [searchDia,setSearchDia]       = useState("");
  // NUEVO: filtro de estado en pestaña huéspedes por día
  const [filtroEstado,setFiltroEstado] = useState("todos"); // "todos" | "checkin" | "inhouse" | "checkout"
  const fileDRef = useRef();

  useEffect(()=>{
    initFirebase().then(()=>{
      let loaded=0; const done=()=>{ loaded++; if(loaded>=3)setLoading(false); };
      fbListen("deptos",    v=>{setDeptos(v?Object.values(v):[]);done();});
      fbListen("huespedes", v=>{setHuespedes(v?Object.values(v):[]);done();});
      fbListen("registros", v=>{setRegistros(v||{});done();});
    });
  },[]);

  const saveD = list => fbSet("deptos",    Object.fromEntries(list.map(d=>[safeKey(d.id),d])));
  const saveH = list => fbSet("huespedes", Object.fromEntries(list.map(h=>[safeKey(h.id),h])));
  const saveR = obj  => fbSet("registros", obj);
  const setD = v => saveD(v);
  const setH = v => saveH(v);
  const updateReg = (hid, patch) => {
    const k=safeKey(hid);
    const u={...registros,[k]:{...(registros[k]||{}),...patch}};
    saveR(u); setRegistros(u);
  };
  const toast=(msg,isError=false)=>{ setImportError(isError); setImportMsg(msg); setTimeout(()=>setImportMsg(""),5000); };
  const isAdmin = userRole==="admin";

  // ── Acciones ────────────────────────────────────────────────────
  const handleMarcarIngreso = h => {
    const reg=registros[safeKey(h.id)]||{};
    if(reg.ingresado){ updateReg(h.id,{ingresado:false,horaIngreso:""}); toast("Ingreso desmarcado."); }
    else { const hora=nowTimeStr(); updateReg(h.id,{ingresado:true,horaIngreso:hora}); toast(`✓ Ingreso registrado a las ${hora}`); }
  };
  const handleMarcarSalida = h => {
    const reg=registros[safeKey(h.id)]||{};
    if(reg.salido){ updateReg(h.id,{salido:false,horaSalida:""}); toast("Salida desmarcada."); }
    else { const hora=nowTimeStr(); updateReg(h.id,{salido:true,horaSalida:hora}); toast(`✓ Salida registrada a las ${hora}`); }
  };

  const handleEditSave = updated => {
    setH(huespedes.map(h=>h.id===editHuesped.id?updated:h));
    setEditHuesped(null); toast("✓ Huésped actualizado.");
  };
  const handleEditDiaSave = updated => {
    setH(huespedes.map(h=>h.id===editDia.id?updated:h));
    setEditDia(null); toast("✓ Datos actualizados.");
  };

  // ── CSV import ───────────────────────────────────────────────────
  function importDeptos(text) {
    const {rows}=parseCSV(text);
    const list=rows.map(r=>({
      id:findField(r,["id","codigo","code","numero","num"])||findField(r,[Object.keys(r)[0]]),
      nombre:findField(r,["nombre","name","descripcion","depto","apt"])||findField(r,[Object.keys(r)[0]]),
      piso:findField(r,["piso","floor","nivel"]),
    })).filter(r=>r.id||r.nombre).map(d=>({...d,id:d.id||d.nombre}));
    setD(list); toast(`✓ ${list.length} departamentos cargados.`);
  }
  function parseHuesped(r,i){
    const nc=findField(r,["nombre_y_apellido","nombre_apellido"]);
    let nombre="",apellido="";
    if(nc){const p=nc.trim().split(/\s+/);nombre=p[0]||"";apellido=p.slice(1).join(" ")||"";}
    else{nombre=findField(r,["nombre","name","first"]);apellido=findField(r,["apellido","last","surname"]);}
    const keys=Object.keys(r);
    const idKey=keys.find(k=>k==="id")||keys.find(k=>k.startsWith("id"));
    const docId=(idKey&&r[idKey])?r[idKey]:findField(r,["dni","pasaporte","documento","passport","doc"]);
    const rawI=findField(r,["fecha_ingreso","fecha_de_ingreso","ingreso","checkin","check_in","entrada","from","inicio"]);
    const rawS=findField(r,["fecha_salida","fecha_de_salida","salida","checkout","check_out","hasta","to","fin"]);
    const horaI=findField(r,["hora_ingreso","hora_de_ingreso","hora"]);
    const cRaw=findField(r,["usa_cochera","cochera"]);
    const pat=findField(r,["patente"]);
    const veh=findField(r,["marca_o_modelo","modelo","vehiculo","auto"]);
    const cochera=(cRaw&&cRaw!=="0"&&cRaw.toLowerCase()!=="false")?cRaw:"";
    return {
      id:docId||`h${Date.now()}${i}`,nombre,apellido,
      depto:String(findField(r,["depto","dept","apartamento","apt","habitacion","unit"])||"").replace(/\.0$/,""),
      ingreso:toISODate(rawI),salida:toISODate(rawS),
      horaIngreso:horaI||"",cochera,
      patente:pat&&pat!=="0"?pat:"",vehiculo:veh&&veh!=="0"?veh:"",
    };
  }
  function importHuespedes(text,replace=false){
    const {rows}=parseCSV(text);
    const incoming=rows.map((r,i)=>parseHuesped(r,i)).filter(r=>r.nombre||r.apellido);
    if(replace){setH(incoming);toast(`✓ ${incoming.length} huéspedes cargados.`);return;}
    const eIds=new Set(huespedes.filter(h=>!h.id.startsWith("h")).map(h=>h.id));
    const nuevos=[],dups=[];
    incoming.forEach(h=>{ if(!h.id.startsWith("h")&&eIds.has(h.id))dups.push(h); else nuevos.push(h); });
    if(nuevos.length===0){toast(`⚠️ No se agregaron huéspedes: los ${dups.length} del CSV ya estaban cargados.`,true);return;}
    setH([...huespedes,...nuevos]);
    if(dups.length>0)toast(`✓ ${nuevos.length} huésped(es) agregado(s). Se omitieron ${dups.length} duplicado(s).`);
    else toast(`✓ ${nuevos.length} huésped(es) agregado(s).`);
  }

  function huespedesEnFecha(f){return huespedes.filter(h=>h.ingreso&&h.salida&&h.ingreso<=f&&h.salida>=f);}
  function huespedesDeDepto(dId,f){
    const tid=(dId||"").trim().toLowerCase();
    return huespedes.filter(h=>{if((h.depto||"").trim().toLowerCase()!==tid)return false;if(!h.ingreso||!h.salida)return true;return h.ingreso<=f&&h.salida>=f;});
  }
  function deptoStatus(dId){
    if(huespedesDeDepto(dId,TODAY).length>0)return "ocupado";
    const in3=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
    if(huespedes.some(h=>(h.depto||"").trim().toLowerCase()===dId.trim().toLowerCase()&&h.ingreso>TODAY&&h.ingreso<=in3))return "proximo";
    return "libre";
  }
  function generarCSV(){
    const lista=huespedesEnFecha(viewDate);
    if(!lista.length){toast("No hay huéspedes para esta fecha.",true);return;}
    const cols=["Depto","Nombre","Apellido","ID/DNI","Ingreso","Salida","Hora Ingreso","Cochera","Patente","Vehículo","Estado"];
    const rows=lista.map(h=>[h.depto,h.nombre,h.apellido,h.id.startsWith("h")?"":h.id,fmtDate(h.ingreso),fmtDate(h.salida),h.horaIngreso||"",h.cochera||"",h.patente||"",h.vehiculo||"",getStatus(h,viewDate)]);
    const csv=[cols,...rows].map(r=>r.join(",")).join("\n");
    setShowCSVModal({csv,fecha:viewDate,count:lista.length});
  }

  if(showAdminLogin) return <Login onLogin={role=>{setUserRole(role);setShowAdminLogin(false);setTab("admin");}}/>;
  if(loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center",color:C.textSec}}>
        <div style={{fontSize:32,marginBottom:12}}>🏢</div>
        <div style={{fontSize:15,fontWeight:600,color:C.navy}}>Conectando con Firebase...</div>
      </div>
    </div>
  );

  const tabs=[
    {id:"deptos",label:"🏠 Departamentos"},
    {id:"huespedes",label:"👥 Huéspedes por día"},
    isAdmin?{id:"admin",label:"⚙️ Administración"}:{id:"adminLogin",label:"🔐 Admin"},
  ];

  const filteredDeptos=deptos.filter(d=>!searchDeptos||(d.id+d.nombre+d.piso).toLowerCase().includes(searchDeptos.toLowerCase()));
  const hoyEnFecha=huespedesEnFecha(viewDate);

  // Contadores para los botones de filtro
  const cuentas = {
    todos: hoyEnFecha.length,
    checkin: hoyEnFecha.filter(h=>getStatus(h,viewDate)==="checkin").length,
    inhouse: hoyEnFecha.filter(h=>getStatus(h,viewDate)==="inhouse").length,
    checkout: hoyEnFecha.filter(h=>getStatus(h,viewDate)==="checkout").length,
  };

  // Aplicar filtro de búsqueda y estado
  const filteredPorEstado = filtroEstado==="todos" ? hoyEnFecha : hoyEnFecha.filter(h=>getStatus(h,viewDate)===filtroEstado);
  const filteredDia = searchDia
    ? filteredPorEstado.filter(h=>{ const q=searchDia.toLowerCase(); return `${h.nombre} ${h.apellido}`.toLowerCase().includes(q)||(h.depto||"").toLowerCase().includes(q); })
    : filteredPorEstado;

  const filteredAdmin=searchAdmin ? huespedes.filter(h=>{ const q=searchAdmin.toLowerCase(); return `${h.nombre} ${h.apellido}`.toLowerCase().includes(q)||(h.depto||"").toLowerCase().includes(q)||(h.id||"").toLowerCase().includes(q); }) : huespedes;
  const handleTab=id=>{ if(id==="adminLogin"){setShowAdminLogin(true);return;} setTab(id); };

  const globoProps = (h, fecha) => ({
    h, fecha, registros,
    onMarcarIngreso: getStatus(h,fecha)==="checkin" ? handleMarcarIngreso : null,
    onMarcarSalida:  getStatus(h,fecha)==="checkout" ? handleMarcarSalida : null,
    onEditar:        null,
    onVerDetalle:    null,
  });
  const globoPropsDia = (h) => ({
    ...globoProps(h, viewDate),
    onEditar: getStatus(h,viewDate)==="checkin" ? setEditDia : null,
    // NUEVO: inhouse y checkout abren modal detalle al clickear el globo
    onVerDetalle: (getStatus(h,viewDate)==="inhouse" || getStatus(h,viewDate)==="checkout") ? setDetalleHuesped : null,
  });

  return (
    <div style={{fontFamily:"'Inter',system-ui,sans-serif",background:C.bg,minHeight:"100vh",color:C.text}}>

      {/* HEADER */}
      <div style={{background:C.navy,padding:"0 1.5rem"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 0 0"}}>
          <div>
            <div style={{fontSize:11,color:"rgba(255,255,255,0.5)",letterSpacing:1,textTransform:"uppercase"}}>Sistema de Gestión</div>
            <div style={{fontSize:20,fontWeight:700,color:"#fff",marginTop:2}}>Control de Huéspedes</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Badge color={isAdmin?"amber":"blue"}>{isAdmin?"Admin":"General"}</Badge>
            {isAdmin&&<button onClick={()=>{setUserRole("general");setTab("deptos");}} style={{background:"rgba(255,255,255,0.12)",border:"none",color:"#fff",fontSize:12,padding:"6px 12px",borderRadius:7,cursor:"pointer",fontWeight:500}}>Salir</button>}
          </div>
        </div>
        <div style={{display:"flex",gap:4,marginTop:12}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>handleTab(t.id)} style={{padding:"9px 18px",fontSize:13,fontWeight:600,border:"none",cursor:"pointer",borderRadius:"8px 8px 0 0",background:tab===t.id?C.bg:"transparent",color:tab===t.id?C.navy:"rgba(255,255,255,0.65)"}}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <Toast msg={importMsg} isError={importError} />
      <div style={{padding:"1.5rem"}}>

        {/* ── DEPARTAMENTOS ── */}
        {tab==="deptos" && (
          <div>
            <SectionHeader title="Departamentos" subtitle={`Estado al día de hoy · ${deptos.length} departamentos`} />
            <div style={{display:"flex",gap:8,marginBottom:"1rem",flexWrap:"wrap",alignItems:"center"}}>
              <input placeholder="🔍  Buscar depto..." value={searchDeptos} onChange={e=>setSearchDeptos(e.target.value)} style={{...S.input,width:220,flex:"0 0 auto"}} />
              <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                <span style={{fontSize:12,fontWeight:600,background:C.accentLight,color:C.accent,padding:"4px 12px",borderRadius:20}}>🔵 Check-in</span>
                <span style={{fontSize:12,fontWeight:600,background:C.greenBg,color:C.green,padding:"4px 12px",borderRadius:20}}>🟢 In-house</span>
                <span style={{fontSize:12,fontWeight:600,background:C.redBg,color:C.red,padding:"4px 12px",borderRadius:20}}>🔴 Check-out</span>
                <Badge color="amber">● Próximo (3d)</Badge>
                <Badge color="gray">● Libre</Badge>
              </div>
            </div>
            {deptos.length===0 ? (
              <div style={{...S.card,textAlign:"center",padding:"3rem",color:C.textSec,fontSize:14}}>
                {isAdmin?<>No hay departamentos. Andá a <b>Administración</b> para cargar el CSV.</>:"No hay departamentos cargados aún."}
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {filteredDeptos.map(d=>{
                  const status=deptoStatus(d.id);
                  const hList=huespedesDeDepto(d.id,TODAY);
                  const sc=status==="ocupado"?"green":status==="proximo"?"amber":"gray";
                  return (
                    <div key={d.id} onClick={()=>setSelectedDepto(d)}
                      style={{...S.card,background:C.cardGray,cursor:"pointer",padding:"14px 16px"}}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.10)"}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}
                    >
                      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:hList.length>0?12:0}}>
                        <div style={{minWidth:90}}>
                          <div style={{fontWeight:700,fontSize:16,color:C.navy}}>{d.nombre||d.id}</div>
                          {d.piso&&<div style={{fontSize:11,color:C.textTer,marginTop:2}}>Piso {d.piso}</div>}
                        </div>
                        <div style={{flex:1,fontSize:13,color:C.textSec}}>
                          {hList.length===0&&<span>Sin huésped hoy</span>}
                          {hList.length>0&&<span style={{fontWeight:500,color:C.text}}>{hList.length} huésped{hList.length>1?"es":""} alojado{hList.length>1?"s":""}</span>}
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <Badge color={sc}>{status==="ocupado"?"Ocupado":status==="proximo"?"Próximo":"Libre"}</Badge>
                          <span style={{color:C.textTer,fontSize:18}}>›</span>
                        </div>
                      </div>
                      {hList.length>0&&(
                        <div style={{display:"flex",flexDirection:"column",gap:8}} onClick={e=>e.stopPropagation()}>
                          {hList.map(h=><HuespedGlobo key={h.id} {...globoProps(h,TODAY)} />)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── HUÉSPEDES POR DÍA ── */}
        {tab==="huespedes" && (
          <div>
            <SectionHeader title="Huéspedes por día" subtitle="Vista de todos los departamentos ocupados en la fecha seleccionada" />
            <div style={{...S.card,display:"flex",alignItems:"center",gap:16,marginBottom:"1rem",flexWrap:"wrap",background:C.accentLight,borderColor:"#C3D5F5"}}>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:C.accent,marginBottom:4,textTransform:"uppercase",letterSpacing:0.5}}>Fecha</div>
                <input type="date" value={viewDate} onChange={e=>setViewDate(e.target.value)} style={{...S.input,width:"auto",border:`1px solid ${C.accent}`}} />
              </div>
              <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap"}}>
                {[{label:"total",val:cuentas.todos,color:C.navy},{label:"check-in",val:cuentas.checkin,color:C.accent},{label:"in-house",val:cuentas.inhouse,color:C.green},{label:"check-out",val:cuentas.checkout,color:C.red}].map(s=>(
                  <div key={s.label} style={{textAlign:"center"}}>
                    <div style={{fontSize:24,fontWeight:800,color:s.color}}>{s.val}</div>
                    <div style={{fontSize:11,color:C.textSec}}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{marginLeft:"auto"}}>
                <button onClick={generarCSV} style={{...S.btnPrimary,display:"flex",alignItems:"center",gap:6,whiteSpace:"nowrap"}}>⬇ Descargar listado</button>
              </div>
            </div>

            {/* Búsqueda + filtros de estado */}
            <div style={{display:"flex",gap:10,marginBottom:"1rem",flexWrap:"wrap",alignItems:"center"}}>
              <input placeholder="🔍  Buscar por nombre o depto..." value={searchDia} onChange={e=>setSearchDia(e.target.value)} style={{...S.input,maxWidth:280}} />
              {/* NUEVO: botones de filtro por estado */}
              {[
                {key:"todos",   label:`Todos (${cuentas.todos})`,    bg:C.navy,    active:"#fff",inactiveText:"rgba(255,255,255,0.6)"},
                {key:"checkin", label:`Check-in (${cuentas.checkin})`, bg:C.accent, active:"#fff",inactiveText:"rgba(59,111,212,0.7)"},
                {key:"inhouse", label:`In-house (${cuentas.inhouse})`, bg:C.green,  active:"#fff",inactiveText:"rgba(46,125,50,0.7)"},
                {key:"checkout",label:`Check-out (${cuentas.checkout})`,bg:C.red,   active:"#fff",inactiveText:"rgba(183,28,28,0.7)"},
              ].map(f=>(
                <button key={f.key} onClick={()=>setFiltroEstado(f.key)}
                  style={{
                    border:"none",borderRadius:20,padding:"6px 16px",fontSize:12,fontWeight:700,cursor:"pointer",
                    background: filtroEstado===f.key ? f.bg : C.white,
                    color: filtroEstado===f.key ? f.active : f.bg,
                    boxShadow: filtroEstado===f.key ? "0 2px 8px rgba(0,0,0,0.18)" : "none",
                    border: `2px solid ${f.bg}`,
                    transition:"all 0.15s",
                  }}
                >{f.label}</button>
              ))}
            </div>

            {/* Leyenda con nota de edición */}
            <div style={{display:"flex",gap:10,marginBottom:"1.25rem",flexWrap:"wrap",alignItems:"center"}}>
              <span style={{fontSize:12,fontWeight:600,background:C.accentLight,color:C.accent,padding:"4px 12px",borderRadius:20}}>🔵 Check-in hoy — editables</span>
              <span style={{fontSize:12,fontWeight:600,background:C.greenBg,color:C.green,padding:"4px 12px",borderRadius:20}}>🟢 In-house — clic para ver detalle</span>
              <span style={{fontSize:12,fontWeight:600,background:C.redBg,color:C.red,padding:"4px 12px",borderRadius:20}}>🔴 Check-out hoy — clic para ver detalle</span>
            </div>

            {filteredDia.length===0 ? (
              <div style={{...S.card,textAlign:"center",padding:"3rem",color:C.textSec,fontSize:14}}>
                {hoyEnFecha.length===0?"Sin huéspedes alojados para esta fecha.":"Sin resultados para la búsqueda o el filtro seleccionado."}
              </div>
            ) : (() => {
              const grouped={};
              filteredDia.forEach(h=>{ const k=h.depto||"Sin depto"; if(!grouped[k])grouped[k]=[]; grouped[k].push(h); });
              const entries=Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));
              return (
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))",gap:14}}>
                  {entries.map(([dep,hs])=>{
                    const hasCheckout=hs.some(h=>getStatus(h,viewDate)==="checkout");
                    const hasCheckin=hs.some(h=>getStatus(h,viewDate)==="checkin");
                    const cardBorder=hasCheckout?C.red:hasCheckin?C.accent:C.green;
                    return (
                      <div key={dep} style={{background:C.cardGray,borderRadius:14,border:`2px solid ${cardBorder}`,overflow:"hidden",boxShadow:"0 1px 6px rgba(0,0,0,0.06)"}}>
                        <div style={{background:"#3A4252",padding:"10px 14px"}}>
                          <span style={{fontWeight:700,fontSize:15,color:"#fff"}}>Depto {dep}</span>
                        </div>
                        <div style={{padding:"10px 12px",display:"flex",flexDirection:"column",gap:8}}>
                          {hs.map(h=><HuespedGlobo key={h.id} {...globoPropsDia(h)} />)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── ADMINISTRACIÓN ── */}
        {tab==="admin"&&isAdmin&&(
          <div>
            <SectionHeader title="Administración" subtitle="Carga y gestión de datos del sistema" />
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:"1.75rem"}}>
              <div style={{...S.card,borderTop:`4px solid ${C.navy}`}}>
                <div style={{fontWeight:700,fontSize:15,color:C.navy,marginBottom:4}}>🏢 Departamentos</div>
                <div style={{fontSize:13,color:C.textSec,marginBottom:14}}>{deptos.length} cargados</div>
                <button onClick={()=>fileDRef.current.click()} style={{...S.btnPrimary,width:"100%",marginBottom:8}}>Subir CSV de deptos</button>
                <input ref={fileDRef} type="file" accept=".csv" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{importDeptos(ev.target.result);e.target.value="";};r.readAsText(f);}} />
                <div style={{fontSize:11,color:C.textTer}}>Columnas: id/numero, nombre, piso</div>
              </div>
              <div style={{...S.card,borderTop:`4px solid ${C.accent}`}}>
                <div style={{fontWeight:700,fontSize:15,color:C.navy,marginBottom:4}}>👤 Huéspedes</div>
                <div style={{fontSize:13,color:C.textSec,marginBottom:14}}>{huespedes.length} cargados</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <button onClick={()=>setShowImportH("add")} style={{...S.btnSecondary,width:"100%"}}>＋ Agregar CSV</button>
                  <button onClick={()=>setShowImportH("replace")} style={{...S.btnSecondary,width:"100%"}}>↺ Reemplazar CSV</button>
                  <button onClick={()=>setShowAddH(true)} style={{...S.btnPrimary,width:"100%"}}>+ Agregar manualmente</button>
                  <button onClick={()=>setShowConfirmBorrar(true)} style={{...S.btnDanger,width:"100%",padding:"9px 18px",fontSize:14,fontWeight:600}}>🗑 Borrar todos los huéspedes</button>
                </div>
                <div style={{fontSize:11,color:C.textTer,marginTop:8}}>Columnas: Nombre y Apellido · Depto · Fecha Ingreso · Fecha Salida · ID · Hora ingreso · Usa Cochera · Patente · Marca o Modelo</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem",flexWrap:"wrap",gap:10}}>
              <div style={{fontWeight:700,fontSize:16,color:C.navy}}>Listado de huéspedes ({filteredAdmin.length})</div>
              <input placeholder="🔍  Buscar por nombre, depto o ID..." value={searchAdmin} onChange={e=>setSearchAdmin(e.target.value)} style={{...S.input,maxWidth:320,width:"auto"}} />
            </div>
            {filteredAdmin.length===0 ? (
              <div style={{...S.card,textAlign:"center",padding:"2rem",color:C.textSec,fontSize:14}}>{huespedes.length===0?"Sin datos.":"Sin resultados para la búsqueda."}</div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {filteredAdmin.map(h=>(
                  <div key={h.id} style={{...S.card,display:"flex",gap:10,alignItems:"center",padding:"10px 14px",flexWrap:"wrap"}}>
                    <div style={{background:h.id.startsWith("h")?C.grayBg:C.accentLight,color:h.id.startsWith("h")?C.textTer:C.accent,fontSize:11,fontWeight:700,padding:"3px 9px",borderRadius:6,whiteSpace:"nowrap"}}>
                      🪪 {h.id.startsWith("h")?"Sin ID":h.id}
                    </div>
                    <div style={{flex:1,fontWeight:600,fontSize:14}}>{h.nombre} {h.apellido}</div>
                    <Badge color="blue">Depto {h.depto}</Badge>
                    <div style={{fontSize:12,color:C.textSec}}>{fmtDate(h.ingreso)} → {fmtDate(h.salida)}</div>
                    {h.cochera&&<Badge color="gray">🚗 {h.cochera}</Badge>}
                    <button onClick={()=>setEditHuesped(h)} style={S.btnEdit}>✏️ Editar</button>
                    <button onClick={()=>setH(huespedes.filter(x=>x.id!==h.id))} style={S.btnDanger}>Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: confirmar borrar todos */}
      {showConfirmBorrar&&(
        <Modal title="⚠️ Confirmar borrado" onClose={()=>setShowConfirmBorrar(false)}>
          <p style={{fontSize:14,color:C.text,marginTop:0}}>Estás por eliminar <b>todos los huéspedes</b> ({huespedes.length} registros). Esta acción no se puede deshacer.</p>
          <div style={{display:"flex",gap:10,marginTop:8}}>
            <button onClick={()=>setShowConfirmBorrar(false)} style={{...S.btnSecondary,flex:1}}>Cancelar</button>
            <button onClick={()=>{setH([]);setShowConfirmBorrar(false);toast("✓ Todos los huéspedes fueron eliminados.");}} style={{...S.btnDanger,flex:1,padding:"9px 18px",fontSize:14,fontWeight:600}}>Sí, borrar todo</button>
          </div>
        </Modal>
      )}

      {/* MODAL: detalle depto */}
      {selectedDepto&&(()=>{
        const d=selectedDepto;
        const hList=huespedesDeDepto(d.id,TODAY);
        const reg=hList.length>0?(registros[safeKey(hList[0].id)]||{}):{};
        return (
          <Modal title={`Depto ${d.nombre||d.id}${d.piso?` · Piso ${d.piso}`:""}`} onClose={()=>setSelectedDepto(null)}>
            {hList.length>0?(
              <>
                <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                  {hList.map(h=><HuespedGlobo key={h.id} {...globoProps(h,TODAY)} />)}
                </div>
                <Field label="Hora de ingreso real"><input type="time" defaultValue={reg.horaIngreso||""} onChange={e=>updateReg(hList[0].id,{horaIngreso:e.target.value})} style={S.input} /></Field>
                <Field label="Hora de salida real"><input type="time" defaultValue={reg.horaSalida||""} onChange={e=>updateReg(hList[0].id,{horaSalida:e.target.value})} style={S.input} /></Field>
                <Field label="Comentarios"><textarea defaultValue={reg.comentario||""} onChange={e=>updateReg(hList[0].id,{comentario:e.target.value})} style={{...S.input,resize:"vertical",minHeight:80,fontFamily:"inherit"}} placeholder="Notas de ingreso, pedidos especiales, etc." /></Field>
              </>
            ):(
              <>
                <div style={{fontSize:14,color:C.textSec,marginBottom:14}}>Sin huésped activo hoy.</div>
                {huespedes.filter(hx=>(hx.depto||"").trim().toLowerCase()===d.id.trim().toLowerCase()).length>0&&(
                  <div>
                    <div style={{fontWeight:600,fontSize:13,marginBottom:8,color:C.navy}}>Reservas registradas:</div>
                    {huespedes.filter(hx=>(hx.depto||"").trim().toLowerCase()===d.id.trim().toLowerCase()).map(hx=>(
                      <div key={hx.id} style={{fontSize:13,color:C.textSec,padding:"6px 0",borderBottom:`1px solid ${C.border}`}}>{hx.nombre} {hx.apellido} &nbsp;·&nbsp; {fmtDate(hx.ingreso)} → {fmtDate(hx.salida)}</div>
                    ))}
                  </div>
                )}
              </>
            )}
            <button onClick={()=>setSelectedDepto(null)} style={{...S.btnSecondary,width:"100%",marginTop:16}}>Cerrar</button>
          </Modal>
        );
      })()}

      {/* MODAL: agregar huésped */}
      {showAddH&&(()=>{
        const AddForm=()=>{
          const [form,setForm]=useState({id:"",nombre:"",apellido:"",depto:"",ingreso:"",salida:"",horaIngreso:"",cochera:"",patente:"",vehiculo:""});
          const labels={id:"ID / DNI",nombre:"Nombre",apellido:"Apellido",depto:"Departamento",ingreso:"Fecha ingreso",salida:"Fecha salida",horaIngreso:"Hora ingreso",cochera:"Cochera asignada",patente:"Patente",vehiculo:"Marca/Modelo"};
          return (
            <Modal title="Agregar huésped" onClose={()=>setShowAddH(false)}>
              {["id","nombre","apellido","depto","ingreso","salida","horaIngreso","cochera","patente","vehiculo"].map(k=>(
                <Field key={k} label={labels[k]}><input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={S.input} type={k==="ingreso"||k==="salida"?"date":k==="horaIngreso"?"time":"text"} /></Field>
              ))}
              <button onClick={()=>{setH([...huespedes,{...form,id:form.id||`h${Date.now()}`}]);setShowAddH(false);}} style={{...S.btnPrimary,width:"100%",marginTop:8}}>Guardar huésped</button>
            </Modal>
          );
        };
        return <AddForm />;
      })()}

      {/* MODAL: importar CSV */}
      {showImportH&&(
        <Modal title={showImportH==="replace"?"Reemplazar huéspedes (CSV)":"Agregar huéspedes (CSV)"} onClose={()=>setShowImportH(false)}>
          <p style={{fontSize:13,color:C.textSec,marginTop:0}}>{showImportH==="replace"?"⚠️ Esto reemplazará todos los huéspedes actuales.":"Solo se agregarán los huéspedes nuevos. Los que ya existan (mismo ID) se omitirán automáticamente."}</p>
          <div style={{background:C.bg,borderRadius:8,padding:"10px 12px",fontSize:12,color:C.textSec,marginBottom:14}}><b>Columnas reconocidas:</b><br/>Nombre y Apellido · Depto · Fecha Ingreso · Fecha Salida · ID · Hora ingreso · Usa Cochera · Patente · Marca o Modelo</div>
          <input type="file" accept=".csv" onChange={e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{importHuespedes(ev.target.result,showImportH==="replace");setShowImportH(false);};r.readAsText(f);}} style={{fontSize:14,marginBottom:12}} />
          <button onClick={()=>setShowImportH(false)} style={{...S.btnSecondary,width:"100%",marginTop:8}}>Cancelar</button>
        </Modal>
      )}

      {/* MODAL: CSV listado del día */}
      {showCSVModal&&(
        <Modal title={`📋 Listado ${showCSVModal.fecha} · ${showCSVModal.count} huéspedes`} onClose={()=>setShowCSVModal(null)}>
          <p style={{fontSize:13,color:C.textSec,margin:"0 0 10px"}}>Copiá el contenido y pegalo en Excel o Google Sheets.</p>
          <textarea readOnly value={showCSVModal.csv} onFocus={e=>e.target.select()} style={{...S.input,fontFamily:"monospace",fontSize:11,minHeight:240,resize:"vertical",background:C.bg}} />
          <button onClick={()=>{navigator.clipboard.writeText(showCSVModal.csv);toast("✓ Copiado al portapapeles");}} style={{...S.btnPrimary,width:"100%",marginTop:10}}>📋 Copiar al portapapeles</button>
          <button onClick={()=>setShowCSVModal(null)} style={{...S.btnSecondary,width:"100%",marginTop:8}}>Cerrar</button>
        </Modal>
      )}

      {/* MODAL: editar desde admin */}
      {editHuesped&&(
        <EditHuespedModal huesped={editHuesped} onSave={handleEditSave} onClose={()=>setEditHuesped(null)} registros={registros} onUpdateReg={updateReg} />
      )}

      {/* MODAL: editar desde huéspedes por día (solo check-in) */}
      {editDia&&(
        <EditHuespedModal huesped={editDia} onSave={handleEditDiaSave} onClose={()=>setEditDia(null)} registros={registros} onUpdateReg={updateReg} />
      )}

      {/* MODAL: ver detalle huésped (inhouse / checkout) */}
      {detalleHuesped&&(
        <DetalleHuespedModal huesped={detalleHuesped} fecha={viewDate} registros={registros} onClose={()=>setDetalleHuesped(null)} />
      )}
    </div>
  );
}
