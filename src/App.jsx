import { useState, useEffect, useRef } from "react";

const STORAGE_KEYS = { deptos: "huesped_deptos", huespedes: "huesped_data", registros: "huesped_registros" };
const ADMIN_PASS = "admin123";
const TODAY = new Date().toISOString().slice(0, 10);

function parseCSVLine(line) {
  const result = []; let cur = ""; let inQ = false;
  for (let c of line) {
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
    else cur += c;
  }
  result.push(cur.trim()); return result;
}
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim().replace(/\s+/g,"_").replace(/[^a-z0-9_]/g,""));
  return { headers, rows: lines.slice(1).map(l => {
    const vals = parseCSVLine(l); const obj = {};
    headers.forEach((h,i) => obj[h] = (vals[i]||"").trim()); return obj;
  }).filter(r => Object.values(r).some(v => v)) };
}
function toISODate(str) {
  if (!str) return ""; const d = str.trim();
  const m1 = d.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  const m2 = d.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`; return d;
}
function findField(obj, candidates) {
  const keys = Object.keys(obj);
  for (let c of candidates) { const k = keys.find(k => k===c||k.includes(c)); if (k&&obj[k]) return obj[k]; } return "";
}
function fmtDate(iso) {
  if (!iso) return "—"; const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`;
}

const C = {
  bg:"#F4F6F9", white:"#FFFFFF", navy:"#1B2A4A", accent:"#3B6FD4", accentLight:"#EBF0FA",
  green:"#2E7D32", greenBg:"#E8F5E9", amber:"#B45309", amberBg:"#FEF3C7",
  red:"#B71C1C", redBg:"#FFEBEE", gray:"#555E6B", grayBg:"#F1F3F5",
  border:"#DDE2EA", text:"#1A1F2B", textSec:"#5A6270", textTer:"#8C95A0", cardGray:"#E8ECF0",
  // Colores de estado para globos de huéspedes
  checkinBg:"#1A3A6B",   // azul oscuro
  inhouseBg:"#1B5E20",   // verde oscuro
  checkoutBg:"#7B1515",  // rojo oscuro
};
const S = {
  input:{ width:"100%", boxSizing:"border-box", fontSize:14, padding:"8px 12px", borderRadius:8, border:`1px solid ${C.border}`, background:C.white, color:C.text },
  btnPrimary:{ background:C.accent, color:"#fff", border:"none", borderRadius:8, padding:"9px 18px", fontSize:14, fontWeight:600, cursor:"pointer" },
  btnSecondary:{ background:C.white, color:C.accent, border:`1px solid ${C.accent}`, borderRadius:8, padding:"8px 16px", fontSize:13, fontWeight:500, cursor:"pointer" },
  btnDanger:{ background:C.redBg, color:C.red, border:`1px solid #FFCDD2`, borderRadius:8, padding:"5px 12px", fontSize:12, fontWeight:500, cursor:"pointer" },
  card:{ background:C.white, borderRadius:12, border:`1px solid ${C.border}`, padding:"1rem 1.25rem" },
};

function getHuespedStatus(h, fecha) {
  if (h.ingreso === fecha) return "checkin";
  if (h.salida === fecha) return "checkout";
  return "inhouse";
}
function huespedBg(status) {
  if (status === "checkin")  return C.checkinBg;
  if (status === "checkout") return C.checkoutBg;
  return C.inhouseBg;
}
function huespedLabel(status) {
  if (status === "checkin")  return { text:"✓ Check-in hoy",  bg:"rgba(100,160,255,0.25)", color:"#90CAF9" };
  if (status === "checkout") return { text:"↑ Check-out hoy", bg:"rgba(255,100,100,0.25)", color:"#EF9A9A" };
  return                            { text:"● In-house",       bg:"rgba(100,200,100,0.25)", color:"#A5D6A7" };
}

function Badge({ color, children }) {
  const m = { green:{bg:C.greenBg,c:C.green}, amber:{bg:C.amberBg,c:C.amber}, red:{bg:C.redBg,c:C.red}, blue:{bg:C.accentLight,c:C.accent}, gray:{bg:C.grayBg,c:C.gray} };
  const s = m[color]||m.gray;
  return <span style={{ background:s.bg, color:s.c, fontSize:11, fontWeight:600, padding:"3px 10px", borderRadius:20, whiteSpace:"nowrap" }}>{children}</span>;
}
function SectionHeader({ title, subtitle }) {
  return <div style={{ marginBottom:"1.25rem" }}>
    <h2 style={{ margin:0, fontSize:18, fontWeight:700, color:C.navy }}>{title}</h2>
    {subtitle && <p style={{ margin:"4px 0 0", fontSize:13, color:C.textSec }}>{subtitle}</p>}
  </div>;
}
function Modal({ title, onClose, children }) {
  return <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
    <div style={{ background:C.white, borderRadius:14, border:`1px solid ${C.border}`, width:"100%", maxWidth:560, maxHeight:"90vh", overflow:"auto", boxShadow:"0 8px 32px rgba(0,0,0,0.18)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1rem 1.25rem", borderBottom:`1px solid ${C.border}`, background:C.navy, borderRadius:"14px 14px 0 0" }}>
        <span style={{ fontWeight:600, fontSize:16, color:"#fff" }}>{title}</span>
        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.15)", border:"none", fontSize:18, cursor:"pointer", color:"#fff", borderRadius:6, width:28, height:28, lineHeight:"28px", textAlign:"center" }}>×</button>
      </div>
      <div style={{ padding:"1.25rem" }}>{children}</div>
    </div>
  </div>;
}
function Field({ label, children }) {
  return <div style={{ marginBottom:14 }}>
    <div style={{ fontSize:12, fontWeight:600, color:C.textSec, marginBottom:5, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</div>
    {children}
  </div>;
}
function Toast({ msg }) {
  if (!msg) return null;
  return <div style={{ background:C.greenBg, color:C.green, border:`1px solid #A5D6A7`, padding:"10px 1.5rem", fontSize:13, fontWeight:500 }}>{msg}</div>;
}

// ── Globo de huésped con color según estado ───────────────────────────────────
function HuespedGlobo({ h, fecha, showId=false }) {
  const status = getHuespedStatus(h, fecha);
  const bg = huespedBg(status);
  const lbl = huespedLabel(status);
  return (
    <div style={{ background:bg, borderRadius:10, padding:"10px 14px" }}>
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:8 }}>
        <div style={{ flex:1 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ fontWeight:700, fontSize:14, color:"#fff" }}>{h.nombre} {h.apellido}</span>
            <span style={{ fontSize:11, fontWeight:700, background:lbl.bg, color:lbl.color, padding:"2px 8px", borderRadius:12 }}>{lbl.text}</span>
          </div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", display:"flex", flexWrap:"wrap", gap:6 }}>
            {showId && h.id && <span style={{ background:"rgba(255,255,255,0.15)", padding:"1px 7px", borderRadius:5, color:"rgba(255,255,255,0.9)", fontWeight:600 }}>DNI: {h.id}</span>}
            {h.horaIngreso && <span>Ingreso: {h.horaIngreso}</span>}
          </div>
        </div>
        <div style={{ textAlign:"right", whiteSpace:"nowrap" }}>
          <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)" }}>Estadía</div>
          <div style={{ fontSize:12, color:"rgba(255,255,255,0.9)", fontWeight:500 }}>{fmtDate(h.ingreso)} → {fmtDate(h.salida)}</div>
        </div>
      </div>
      {(h.cochera||h.patente||h.vehiculo) && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:7 }}>
          {h.cochera  && <span style={{ fontSize:11, background:"rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.85)", padding:"2px 8px", borderRadius:6 }}>🚗 Cochera {h.cochera}</span>}
          {h.patente  && <span style={{ fontSize:11, background:"rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.85)", padding:"2px 8px", borderRadius:6 }}>Patente: {h.patente}</span>}
          {h.vehiculo && <span style={{ fontSize:11, background:"rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.85)", padding:"2px 8px", borderRadius:6 }}>{h.vehiculo}</span>}
        </div>
      )}
    </div>
  );
}

function Login({ onLogin }) {
  const [pass, setPass] = useState(""); const [err, setErr] = useState("");
  const submit = () => { pass===ADMIN_PASS ? onLogin("admin") : setErr("Contraseña incorrecta."); };
  return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
      <div style={{ background:C.white, borderRadius:16, border:`1px solid ${C.border}`, padding:"2rem", width:"100%", maxWidth:360, boxShadow:"0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign:"center", marginBottom:"1.75rem" }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🔐</div>
          <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:C.navy }}>Acceso Administrador</h1>
          <p style={{ margin:"6px 0 0", fontSize:13, color:C.textSec }}>Ingresá la contraseña de admin</p>
        </div>
        <Field label="Contraseña">
          <input type="password" value={pass} onChange={e=>{setPass(e.target.value);setErr("");}}
            onKeyDown={e=>e.key==="Enter"&&submit()} style={S.input} placeholder="••••••••" autoFocus />
        </Field>
        {err && <div style={{ color:C.red, fontSize:13, marginBottom:10 }}>{err}</div>}
        <button onClick={submit} style={{ ...S.btnPrimary, width:"100%", padding:"11px 0", marginTop:4 }}>Ingresar</button>
      </div>
    </div>
  );
}

const memStore = {};
const storage = {
  get: async k => { try { const v=localStorage.getItem(k); return v?{value:v}:null; } catch { return memStore[k]?{value:memStore[k]}:null; } },
  set: async (k,v) => { try { localStorage.setItem(k,v); } catch {} memStore[k]=v; },
};

export default function App() {
  const [userRole, setUserRole] = useState("general");
  const [tab, setTab] = useState("deptos");
  const [deptos, setDeptos] = useState([]);
  const [huespedes, setHuespedes] = useState([]);
  const [registros, setRegistros] = useState({});
  const [selectedDepto, setSelectedDepto] = useState(null);
  const [viewDate, setViewDate] = useState(TODAY);
  const [showAddH, setShowAddH] = useState(false);
  const [showImportH, setShowImportH] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const fileDRef = useRef();

  useEffect(() => {
    async function load() {
      try { const d=await storage.get(STORAGE_KEYS.deptos); if(d) setDeptos(JSON.parse(d.value)); } catch {}
      try { const h=await storage.get(STORAGE_KEYS.huespedes); if(h) setHuespedes(JSON.parse(h.value)); } catch {}
      try { const r=await storage.get(STORAGE_KEYS.registros); if(r) setRegistros(JSON.parse(r.value)); } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const persist = async (key,val) => { try { await storage.set(key,JSON.stringify(val)); } catch {} };
  const setD = v => { setDeptos(v); persist(STORAGE_KEYS.deptos,v); };
  const setH = v => { setHuespedes(v); persist(STORAGE_KEYS.huespedes,v); };
  const setR = v => { setRegistros(v); persist(STORAGE_KEYS.registros,v); };
  const updateReg = (hid,patch) => { const u={...registros,[hid]:{...(registros[hid]||{}),...patch}}; setR(u); };
  const toast = msg => { setImportMsg(msg); setTimeout(()=>setImportMsg(""),4000); };
  const isAdmin = userRole==="admin";

  function importDeptos(text) {
    const {rows} = parseCSV(text);
    const list = rows.map(r=>({
      id: findField(r,["id","codigo","code","numero","num"])||findField(r,[Object.keys(r)[0]]),
      nombre: findField(r,["nombre","name","descripcion","depto","apt"])||findField(r,[Object.keys(r)[0]]),
      piso: findField(r,["piso","floor","nivel"]),
    })).filter(r=>r.id||r.nombre).map(d=>({...d,id:d.id||d.nombre}));
    setD(list); toast(`✓ ${list.length} departamentos cargados.`);
  }

  function importHuespedes(text, replace=false) {
    const {rows} = parseCSV(text);
    const mapped = rows.map((r,i) => {
      const nombreCompleto = findField(r,["nombre_y_apellido","nombre_apellido","nombre"]);
      let nombre="", apellido="";
      if (nombreCompleto) { const p=nombreCompleto.trim().split(/\s+/); nombre=p[0]||""; apellido=p.slice(1).join(" ")||""; }
      else { nombre=findField(r,["nombre","name","first"]); apellido=findField(r,["apellido","last","surname"]); }
      const rawIngreso = findField(r,["fecha_ingreso","fecha_de_ingreso","ingreso","checkin","check_in","entrada","from","inicio"]);
      const rawSalida  = findField(r,["fecha_salida","fecha_de_salida","salida","checkout","check_out","hasta","to","fin"]);
      const horaIngreso = findField(r,["hora_ingreso","hora_de_ingreso","hora"]);
      const cocheraRaw  = findField(r,["usa_cochera","cochera"]);
      const patente     = findField(r,["patente"]);
      const vehiculo    = findField(r,["marca_o_modelo","modelo","vehiculo","auto"]);
      const cochera = (cocheraRaw&&cocheraRaw!=="0"&&cocheraRaw.toLowerCase()!=="false") ? cocheraRaw : "";
      return {
        id: findField(r,["id"])||`h${Date.now()}${i}`,
        nombre, apellido,
        depto: String(findField(r,["depto","dept","apartamento","apt","habitacion","unit"])||"").replace(/\.0$/,""),
        ingreso: toISODate(rawIngreso), salida: toISODate(rawSalida),
        horaIngreso: horaIngreso||"", cochera,
        patente: patente&&patente!=="0"?patente:"",
        vehiculo: vehiculo&&vehiculo!=="0"?vehiculo:"",
      };
    }).filter(r=>r.nombre||r.apellido);
    setH(replace?mapped:[...huespedes,...mapped]);
    toast(`✓ ${mapped.length} huéspedes ${replace?"reemplazados":"agregados"}.`);
  }

  function huespedesEnFecha(fecha) {
    return huespedes.filter(h=>h.ingreso&&h.salida&&h.ingreso<=fecha&&h.salida>=fecha);
  }
  function huespedesDeDepto(deptoId, fecha) {
    const tid=(deptoId||"").trim().toLowerCase();
    return huespedes.filter(h=>{
      if ((h.depto||"").trim().toLowerCase()!==tid) return false;
      if (!h.ingreso||!h.salida) return true;
      return h.ingreso<=fecha&&h.salida>=fecha;
    });
  }
  function deptoStatus(dId) {
    if (huespedesDeDepto(dId,TODAY).length>0) return "ocupado";
    const in3=new Date(Date.now()+3*86400000).toISOString().slice(0,10);
    if (huespedes.some(h=>(h.depto||"").trim().toLowerCase()===dId.trim().toLowerCase()&&h.ingreso>TODAY&&h.ingreso<=in3)) return "proximo";
    return "libre";
  }

  function downloadInhouse() {
    const inhouse = huespedesEnFecha(viewDate);
    if (!inhouse.length) { toast("No hay huéspedes para esta fecha."); return; }
    const cols = ["Depto","Nombre","Apellido","ID/DNI","Ingreso","Salida","Hora Ingreso","Cochera","Patente","Vehículo","Estado"];
    const rows = inhouse.map(h=>[h.depto,h.nombre,h.apellido,h.id,fmtDate(h.ingreso),fmtDate(h.salida),h.horaIngreso||"",h.cochera||"",h.patente||"",h.vehiculo||"",getHuespedStatus(h,viewDate)]);
    const csv = [cols,...rows].map(r=>r.map(v=>`"${(v||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url; a.download=`inhouse_${viewDate}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast(`✓ Descargado: ${inhouse.length} huéspedes.`);
  }

  if (showAdminLogin) return <Login onLogin={role=>{setUserRole(role);setShowAdminLogin(false);setTab("admin");}} />;
  if (loading) return (
    <div style={{ minHeight:"100vh", background:C.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ textAlign:"center", color:C.textSec }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🏢</div>
        <div style={{ fontSize:15, fontWeight:600, color:C.navy }}>Cargando datos...</div>
      </div>
    </div>
  );

  const tabs = [
    {id:"deptos", label:"🏠 Departamentos"},
    {id:"huespedes", label:"👥 Huéspedes por día"},
    isAdmin ? {id:"admin", label:"⚙️ Administración"} : {id:"adminLogin", label:"🔐 Admin"},
  ];
  const filteredDeptos = deptos.filter(d=>!search||(d.id+d.nombre+d.piso).toLowerCase().includes(search.toLowerCase()));
  const hoyEnFecha = huespedesEnFecha(viewDate);
  const handleTab = id => { if (id==="adminLogin"){setShowAdminLogin(true);return;} setTab(id); };

  return (
    <div style={{ fontFamily:"'Inter',system-ui,sans-serif", background:C.bg, minHeight:"100vh", color:C.text }}>

      {/* HEADER */}
      <div style={{ background:C.navy, padding:"0 1.5rem" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 0 0" }}>
          <div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.5)", letterSpacing:1, textTransform:"uppercase" }}>Sistema de Gestión</div>
            <div style={{ fontSize:20, fontWeight:700, color:"#fff", marginTop:2 }}>Control de Huéspedes</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Badge color={isAdmin?"amber":"blue"}>{isAdmin?"Admin":"General"}</Badge>
            {isAdmin && <button onClick={()=>{setUserRole("general");setTab("deptos");}} style={{ background:"rgba(255,255,255,0.12)", border:"none", color:"#fff", fontSize:12, padding:"6px 12px", borderRadius:7, cursor:"pointer", fontWeight:500 }}>Salir</button>}
          </div>
        </div>
        <div style={{ display:"flex", gap:4, marginTop:12 }}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>handleTab(t.id)} style={{
              padding:"9px 18px", fontSize:13, fontWeight:600, border:"none", cursor:"pointer",
              borderRadius:"8px 8px 0 0", background:tab===t.id?C.bg:"transparent",
              color:tab===t.id?C.navy:"rgba(255,255,255,0.65)"
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <Toast msg={importMsg} />
      <div style={{ padding:"1.5rem" }}>

        {/* ── DEPARTAMENTOS ── */}
        {tab==="deptos" && (
          <div>
            <SectionHeader title="Departamentos" subtitle={`Estado al día de hoy · ${deptos.length} departamentos`} />
            {/* leyenda colores */}
            <div style={{ display:"flex", gap:8, marginBottom:"1rem", flexWrap:"wrap", alignItems:"center" }}>
              <input placeholder="🔍  Buscar..." value={search} onChange={e=>setSearch(e.target.value)} style={{ ...S.input, width:220, flex:"0 0 auto" }} />
              <div style={{ marginLeft:"auto", display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                <span style={{ fontSize:12, fontWeight:600, background:C.accentLight, color:C.accent, padding:"4px 12px", borderRadius:20 }}>🔵 Check-in</span>
                <span style={{ fontSize:12, fontWeight:600, background:C.greenBg, color:C.green, padding:"4px 12px", borderRadius:20 }}>🟢 In-house</span>
                <span style={{ fontSize:12, fontWeight:600, background:C.redBg, color:C.red, padding:"4px 12px", borderRadius:20 }}>🔴 Check-out</span>
                <Badge color="amber">● Próximo (3d)</Badge>
                <Badge color="gray">● Libre</Badge>
              </div>
            </div>
            {deptos.length===0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:"3rem", color:C.textSec, fontSize:14 }}>
                {isAdmin?<>No hay departamentos. Andá a <b>Administración</b> para cargar el CSV.</>:"No hay departamentos cargados aún."}
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {filteredDeptos.map(d => {
                  const status = deptoStatus(d.id);
                  const hList = huespedesDeDepto(d.id, TODAY);
                  const statusColor = status==="ocupado"?"green":status==="proximo"?"amber":"gray";
                  return (
                    <div key={d.id} onClick={()=>setSelectedDepto(d)}
                      style={{ ...S.card, background:C.cardGray, cursor:"pointer", padding:"14px 16px", transition:"box-shadow 0.15s" }}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow="0 2px 12px rgba(0,0,0,0.10)"}
                      onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}
                    >
                      {/* header del depto */}
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:hList.length>0?12:0 }}>
                        <div style={{ minWidth:90 }}>
                          <div style={{ fontWeight:700, fontSize:16, color:C.navy }}>{d.nombre||d.id}</div>
                          {d.piso && <div style={{ fontSize:11, color:C.textTer, marginTop:2 }}>Piso {d.piso}</div>}
                        </div>
                        <div style={{ flex:1, fontSize:13, color:C.textSec }}>
                          {hList.length===0 && <span>Sin huésped hoy</span>}
                          {hList.length>0 && <span style={{ fontWeight:500, color:C.text }}>{hList.length} huésped{hList.length>1?"es":""} alojado{hList.length>1?"s":""}</span>}
                        </div>
                        <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                          <Badge color={statusColor}>{status==="ocupado"?"Ocupado":status==="proximo"?"Próximo":"Libre"}</Badge>
                          <span style={{ color:C.textTer, fontSize:18 }}>›</span>
                        </div>
                      </div>
                      {/* globos de huéspedes con color según estado */}
                      {hList.length>0 && (
                        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                          {hList.map(h => <HuespedGlobo key={h.id} h={h} fecha={TODAY} />)}
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
            {/* panel selector */}
            <div style={{ ...S.card, display:"flex", alignItems:"center", gap:16, marginBottom:"1.5rem", flexWrap:"wrap", background:C.accentLight, borderColor:"#C3D5F5" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:C.accent, marginBottom:4, textTransform:"uppercase", letterSpacing:0.5 }}>Fecha</div>
                <input type="date" value={viewDate} onChange={e=>setViewDate(e.target.value)} style={{ ...S.input, width:"auto", border:`1px solid ${C.accent}` }} />
              </div>
              <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
                {[
                  {label:"total alojados", val:hoyEnFecha.length, color:C.navy},
                  {label:"check-in",       val:hoyEnFecha.filter(h=>getHuespedStatus(h,viewDate)==="checkin").length,  color:C.accent},
                  {label:"in-house",       val:hoyEnFecha.filter(h=>getHuespedStatus(h,viewDate)==="inhouse").length,  color:C.green},
                  {label:"check-out",      val:hoyEnFecha.filter(h=>getHuespedStatus(h,viewDate)==="checkout").length, color:C.red},
                ].map(s=>(
                  <div key={s.label} style={{ textAlign:"center" }}>
                    <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.val}</div>
                    <div style={{ fontSize:11, color:C.textSec }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginLeft:"auto" }}>
                <button onClick={downloadInhouse} style={{ ...S.btnPrimary, display:"flex", alignItems:"center", gap:6, whiteSpace:"nowrap" }}>⬇ Descargar CSV</button>
              </div>
            </div>

            {/* leyenda */}
            <div style={{ display:"flex", gap:10, marginBottom:"1.25rem", flexWrap:"wrap" }}>
              <span style={{ fontSize:12, fontWeight:600, background:C.accentLight, color:C.accent, padding:"4px 12px", borderRadius:20 }}>🔵 Check-in hoy</span>
              <span style={{ fontSize:12, fontWeight:600, background:C.greenBg, color:C.green, padding:"4px 12px", borderRadius:20 }}>🟢 In-house</span>
              <span style={{ fontSize:12, fontWeight:600, background:C.redBg, color:C.red, padding:"4px 12px", borderRadius:20 }}>🔴 Check-out hoy</span>
            </div>

            {hoyEnFecha.length===0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:"3rem", color:C.textSec, fontSize:14 }}>Sin huéspedes alojados para esta fecha.</div>
            ) : (() => {
              const grouped = {};
              hoyEnFecha.forEach(h=>{ const k=h.depto||"Sin depto"; if(!grouped[k]) grouped[k]=[]; grouped[k].push(h); });
              const entries = Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b,undefined,{numeric:true}));
              return (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(300px, 1fr))", gap:14 }}>
                  {entries.map(([dep,hs])=>{
                    // borde del card según estado predominante
                    const hasCheckout = hs.some(h=>getHuespedStatus(h,viewDate)==="checkout");
                    const hasCheckin  = hs.some(h=>getHuespedStatus(h,viewDate)==="checkin");
                    const cardBorder  = hasCheckout?C.red:hasCheckin?C.accent:C.green;
                    return (
                      <div key={dep} style={{ background:C.cardGray, borderRadius:14, border:`2px solid ${cardBorder}`, overflow:"hidden", boxShadow:"0 1px 6px rgba(0,0,0,0.06)" }}>
                        <div style={{ background:"#3A4252", padding:"10px 14px" }}>
                          <span style={{ fontWeight:700, fontSize:15, color:"#fff" }}>Depto {dep}</span>
                        </div>
                        <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", gap:8 }}>
                          {hs.map(h=><HuespedGlobo key={h.id} h={h} fecha={viewDate} showId={true} />)}
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
        {tab==="admin" && isAdmin && (
          <div>
            <SectionHeader title="Administración" subtitle="Carga y gestión de datos del sistema" />
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginBottom:"1.75rem" }}>
              <div style={{ ...S.card, borderTop:`4px solid ${C.navy}` }}>
                <div style={{ fontWeight:700, fontSize:15, color:C.navy, marginBottom:4 }}>🏢 Departamentos</div>
                <div style={{ fontSize:13, color:C.textSec, marginBottom:14 }}>{deptos.length} cargados</div>
                <button onClick={()=>fileDRef.current.click()} style={{ ...S.btnPrimary, width:"100%", marginBottom:8 }}>Subir CSV de deptos</button>
                <input ref={fileDRef} type="file" accept=".csv" style={{ display:"none" }} onChange={e=>{
                  const f=e.target.files[0]; if(!f) return;
                  const r=new FileReader(); r.onload=ev=>{importDeptos(ev.target.result);e.target.value="";}; r.readAsText(f);
                }} />
                <div style={{ fontSize:11, color:C.textTer }}>Columnas: id/numero, nombre, piso</div>
              </div>
              <div style={{ ...S.card, borderTop:`4px solid ${C.accent}` }}>
                <div style={{ fontWeight:700, fontSize:15, color:C.navy, marginBottom:4 }}>👤 Huéspedes</div>
                <div style={{ fontSize:13, color:C.textSec, marginBottom:14 }}>{huespedes.length} cargados</div>
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <button onClick={()=>setShowImportH("add")} style={{ ...S.btnSecondary, width:"100%" }}>＋ Agregar CSV</button>
                  <button onClick={()=>setShowImportH("replace")} style={{ ...S.btnSecondary, width:"100%" }}>↺ Reemplazar CSV</button>
                  <button onClick={()=>setShowAddH(true)} style={{ ...S.btnPrimary, width:"100%" }}>+ Agregar manualmente</button>
                </div>
                <div style={{ fontSize:11, color:C.textTer, marginTop:8 }}>
                  Columnas: Nombre y Apellido · Depto · Fecha Ingreso · Fecha Salida · ID · Hora ingreso · Usa Cochera · Patente · Marca o Modelo
                </div>
              </div>
            </div>
            <div style={{ fontWeight:700, fontSize:16, color:C.navy, marginBottom:"1rem" }}>Listado de huéspedes</div>
            {huespedes.length===0 ? (
              <div style={{ ...S.card, textAlign:"center", padding:"2rem", color:C.textSec, fontSize:14 }}>Sin datos.</div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {huespedes.map(h=>(
                  <div key={h.id} style={{ ...S.card, display:"flex", gap:10, alignItems:"center", padding:"10px 14px", flexWrap:"wrap" }}>
                    <div style={{ fontSize:11, color:C.textTer, minWidth:60 }}>#{h.id}</div>
                    <div style={{ flex:1, fontWeight:600, fontSize:14 }}>{h.nombre} {h.apellido}</div>
                    <Badge color="blue">Depto {h.depto}</Badge>
                    <div style={{ fontSize:12, color:C.textSec }}>{fmtDate(h.ingreso)} → {fmtDate(h.salida)}</div>
                    {h.cochera && <Badge color="gray">🚗 Cochera {h.cochera}</Badge>}
                    <button onClick={()=>setH(huespedes.filter(x=>x.id!==h.id))} style={S.btnDanger}>Eliminar</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: detalle depto */}
      {selectedDepto && (() => {
        const d = selectedDepto;
        const hList = huespedesDeDepto(d.id, TODAY);
        const reg = hList.length>0 ? (registros[hList[0].id]||{}) : {};
        return (
          <Modal title={`Depto ${d.nombre||d.id}${d.piso?` · Piso ${d.piso}`:""}`} onClose={()=>setSelectedDepto(null)}>
            {hList.length>0 ? (
              <>
                <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:16 }}>
                  {hList.map(h=><HuespedGlobo key={h.id} h={h} fecha={TODAY} showId={true} />)}
                </div>
                <Field label="Hora de ingreso real">
                  <input type="time" defaultValue={reg.horaIngreso||""} onChange={e=>updateReg(hList[0].id,{horaIngreso:e.target.value})} style={S.input} />
                </Field>
                <Field label="Hora de salida real">
                  <input type="time" defaultValue={reg.horaSalida||""} onChange={e=>updateReg(hList[0].id,{horaSalida:e.target.value})} style={S.input} />
                </Field>
                <Field label="Comentarios">
                  <textarea defaultValue={reg.comentario||""} onChange={e=>updateReg(hList[0].id,{comentario:e.target.value})}
                    style={{ ...S.input, resize:"vertical", minHeight:80, fontFamily:"inherit" }} placeholder="Notas de ingreso, pedidos especiales, etc." />
                </Field>
              </>
            ) : (
              <>
                <div style={{ fontSize:14, color:C.textSec, marginBottom:14 }}>Sin huésped activo hoy.</div>
                {huespedes.filter(hx=>(hx.depto||"").trim().toLowerCase()===d.id.trim().toLowerCase()).length>0 && (
                  <div>
                    <div style={{ fontWeight:600, fontSize:13, marginBottom:8, color:C.navy }}>Reservas registradas:</div>
                    {huespedes.filter(hx=>(hx.depto||"").trim().toLowerCase()===d.id.trim().toLowerCase()).map(hx=>(
                      <div key={hx.id} style={{ fontSize:13, color:C.textSec, padding:"6px 0", borderBottom:`1px solid ${C.border}` }}>
                        {hx.nombre} {hx.apellido} &nbsp;·&nbsp; {fmtDate(hx.ingreso)} → {fmtDate(hx.salida)}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            <button onClick={()=>setSelectedDepto(null)} style={{ ...S.btnSecondary, width:"100%", marginTop:16 }}>Cerrar</button>
          </Modal>
        );
      })()}

      {/* MODAL: agregar huésped */}
      {showAddH && (() => {
        const AddForm = () => {
          const [form, setForm] = useState({ id:"", nombre:"", apellido:"", depto:"", ingreso:"", salida:"", horaIngreso:"", cochera:"", patente:"", vehiculo:"" });
          const labels = { id:"ID / DNI", nombre:"Nombre", apellido:"Apellido", depto:"Departamento", ingreso:"Fecha ingreso", salida:"Fecha salida", horaIngreso:"Hora ingreso", cochera:"Cochera asignada", patente:"Patente", vehiculo:"Marca/Modelo" };
          return (
            <Modal title="Agregar huésped" onClose={()=>setShowAddH(false)}>
              {["id","nombre","apellido","depto","ingreso","salida","horaIngreso","cochera","patente","vehiculo"].map(k=>(
                <Field key={k} label={labels[k]}>
                  <input value={form[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))}
                    style={S.input} type={k==="ingreso"||k==="salida"?"date":k==="horaIngreso"?"time":"text"} />
                </Field>
              ))}
              <button onClick={()=>{setH([...huespedes,{...form,id:form.id||`h${Date.now()}`}]);setShowAddH(false);}}
                style={{ ...S.btnPrimary, width:"100%", marginTop:8 }}>Guardar huésped</button>
            </Modal>
          );
        };
        return <AddForm />;
      })()}

      {/* MODAL: importar CSV */}
      {showImportH && (
        <Modal title={showImportH==="replace"?"Reemplazar huéspedes (CSV)":"Agregar huéspedes (CSV)"} onClose={()=>setShowImportH(false)}>
          <p style={{ fontSize:13, color:C.textSec, marginTop:0 }}>
            {showImportH==="replace"?"⚠️ Esto reemplazará todos los huéspedes actuales.":"Los del CSV se sumarán a los existentes."}
          </p>
          <div style={{ background:C.bg, borderRadius:8, padding:"10px 12px", fontSize:12, color:C.textSec, marginBottom:14 }}>
            <b>Columnas reconocidas:</b><br/>
            Nombre y Apellido · Depto · Fecha Ingreso · Fecha Salida · ID · Hora ingreso · Usa Cochera · Patente · Marca o Modelo
          </div>
          <input type="file" accept=".csv" onChange={e=>{
            const f=e.target.files[0]; if(!f) return;
            const r=new FileReader(); r.onload=ev=>{importHuespedes(ev.target.result,showImportH==="replace");setShowImportH(false);}; r.readAsText(f);
          }} style={{ fontSize:14, marginBottom:12 }} />
          <button onClick={()=>setShowImportH(false)} style={{ ...S.btnSecondary, width:"100%", marginTop:8 }}>Cancelar</button>
        </Modal>
      )}
    </div>
  );
}
