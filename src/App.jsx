import { useState, useEffect, useRef } from "react"
import { storageSet, storageSubscribe } from "./firebase"

const STORAGE_KEYS = { deptos: "huesped_deptos", huespedes: "huesped_data", registros: "huesped_registros" }
const ADMIN_PASS = "admin123"
const TODAY = new Date().toISOString().slice(0, 10)

function parseCSVLine(line) {
  const result = []; let cur = ""; let inQ = false
  for (let c of line) {
    if (c === '"') inQ = !inQ
    else if (c === ',' && !inQ) { result.push(cur.trim()); cur = "" }
    else cur += c
  }
  result.push(cur.trim()); return result
}
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim())
  const rawHeaders = parseCSVLine(lines[0])
  const headers = rawHeaders.map(h => h.toLowerCase().trim().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""))
  return { headers, rows: lines.slice(1).map(l => {
    const vals = parseCSVLine(l); const obj = {}
    headers.forEach((h, i) => obj[h] = (vals[i] || "").trim())
    return obj
  }).filter(r => Object.values(r).some(v => v)) }
}
function toISODate(str) {
  if (!str) return ""; const d = str.trim()
  const m1 = d.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  const m2 = d.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/)
  if (m2) return `${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`
  return d
}
function findField(obj, candidates) {
  const keys = Object.keys(obj)
  for (let c of candidates) {
    const k = keys.find(k => k === c || k.includes(c))
    if (k && obj[k]) return obj[k]
  }
  return ""
}
function fmtDate(iso) {
  if (!iso) return "—"; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`
}
function fmtDateShort(iso) {
  if (!iso) return "—"; const [, m, d] = iso.split("-"); return `${d}/${m}`
}

const C = {
  bg: "#F4F6F9", white: "#FFFFFF", navy: "#1B2A4A", accent: "#3B6FD4", accentLight: "#EBF0FA",
  green: "#2E7D32", greenBg: "#E8F5E9", amber: "#B45309", amberBg: "#FEF3C7",
  red: "#B71C1C", redBg: "#FFEBEE", gray: "#555E6B", grayBg: "#F1F3F5",
  border: "#DDE2EA", text: "#1A1F2B", textSec: "#5A6270", textTer: "#8C95A0",
}
const S = {
  input: { width: "100%", boxSizing: "border-box", fontSize: 14, padding: "8px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, color: C.text },
  btnPrimary: { background: C.accent, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnSecondary: { background: C.white, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" },
  btnDanger: { background: C.redBg, color: C.red, border: `1px solid #FFCDD2`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer" },
  card: { background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: "1rem 1.25rem" },
}

function Badge({ color, children }) {
  const m = { green: { bg: C.greenBg, c: C.green }, amber: { bg: C.amberBg, c: C.amber }, red: { bg: C.redBg, c: C.red }, blue: { bg: C.accentLight, c: C.accent }, gray: { bg: C.grayBg, c: C.gray } }
  const s = m[color] || m.gray
  return <span style={{ background: s.bg, color: s.c, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap", letterSpacing: 0.3 }}>{children}</span>
}
function SectionHeader({ title, subtitle }) {
  return <div style={{ marginBottom: "1.25rem" }}>
    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: C.navy }}>{title}</h2>
    {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textSec }}>{subtitle}</p>}
  </div>
}
function Modal({ title, onClose, children }) {
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
    <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 1.25rem", borderBottom: `1px solid ${C.border}`, background: C.navy, borderRadius: "14px 14px 0 0" }}>
        <span style={{ fontWeight: 600, fontSize: 16, color: "#fff" }}>{title}</span>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "none", fontSize: 18, cursor: "pointer", color: "#fff", borderRadius: 6, width: 28, height: 28, lineHeight: "28px", textAlign: "center" }}>×</button>
      </div>
      <div style={{ padding: "1.25rem" }}>{children}</div>
    </div>
  </div>
}
function Field({ label, children }) {
  return <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 5, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    {children}
  </div>
}
function Toast({ msg }) {
  if (!msg) return null
  return <div style={{ background: C.greenBg, color: C.green, border: `1px solid #A5D6A7`, padding: "10px 1.5rem", fontSize: 13, fontWeight: 500 }}>{msg}</div>
}

function cardBgForHuesped(h, fecha, reg) {
  const isCheckout = h.salida === fecha
  const isCheckin  = h.ingreso === fecha
  const ingresoMarcado = reg && reg.ingresoMarcado
  if (isCheckout)      return { bg: "#4A1B1B", border: "1.5px solid #6A2D2D" }
  if (ingresoMarcado)  return { bg: "#1B4332", border: "1.5px solid #2D6A4F" }
  if (isCheckin)       return { bg: "#1B2A4A", border: "1.5px solid #2D4070" }
  return { bg: "#1B4332", border: "1.5px solid #2D6A4F" }
}

function HuespedCard({ h, reg = {}, fecha = TODAY, onUpdate, onUpdateReg, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({ ...h })
  const { bg, border } = cardBgForHuesped(h, fecha, reg)

  const save = () => { onUpdate && onUpdate(form); setEditing(false) }
  const cancel = () => { setForm({ ...h }); setEditing(false) }

  const inp = (key, type = "text") => (
    <input type={type} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      style={{ ...S.input, fontSize: 12, padding: "5px 8px", background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", flex: 1 }} />
  )

  return (
    <div style={{ background: bg, border, borderRadius: 10, padding: "10px 14px", cursor: editing ? "default" : "pointer" }}
      onClick={!editing ? () => setEditing(true) : undefined}>
      {!editing ? (
        <>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>{h.nombre} {h.apellido}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 3, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {h.id && <span style={{ background: "rgba(255,255,255,0.15)", padding: "1px 7px", borderRadius: 5 }}>DNI: {h.id}</span>}
                {h.horaIngreso && <span>Ingreso: {h.horaIngreso}</span>}
              </div>
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>Estadía</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>{fmtDateShort(h.ingreso)} → {fmtDateShort(h.salida)}</div>
            </div>
          </div>
          {(h.cochera || h.patente || h.vehiculo) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
              {h.cochera  && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", padding: "2px 8px", borderRadius: 6 }}>🚗 Cochera {h.cochera}</span>}
              {h.patente  && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", padding: "2px 8px", borderRadius: 6 }}>Patente: {h.patente}</span>}
              {h.vehiculo && <span style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.85)", padding: "2px 8px", borderRadius: 6 }}>{h.vehiculo}</span>}
            </div>
          )}
          {(reg.ingresoMarcado || reg.salidaMarcada) && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
              {reg.ingresoMarcado && <span style={{ fontSize: 11, background: "rgba(46,125,50,0.5)", color: "#A5D6A7", padding: "2px 8px", borderRadius: 6 }}>✓ Ingresó {reg.horaIngresoReal || ""}</span>}
              {reg.salidaMarcada  && <span style={{ fontSize: 11, background: "rgba(183,28,28,0.4)", color: "#EF9A9A", padding: "2px 8px", borderRadius: 6 }}>✓ Salió {reg.horaSalidaReal || ""}</span>}
            </div>
          )}
          {/* Botones de acción visibles siempre */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            {h.ingreso === fecha && !reg.ingresoMarcado && onUpdateReg && (
              <button
                onClick={e => { e.stopPropagation(); const hora = new Date().toTimeString().slice(0,5); onUpdateReg({ ingresoMarcado: true, horaIngresoReal: hora }) }}
                style={{ flex: 1, fontSize: 13, fontWeight: 700, padding: "9px 0", borderRadius: 8, border: "2px solid #81C784", background: "rgba(46,125,50,0.5)", color: "#fff", cursor: "pointer", letterSpacing: 0.3 }}>
                ✓ Marcar ingreso
              </button>
            )}
            {h.salida === fecha && !reg.salidaMarcada && onUpdateReg && (
              <button
                onClick={e => { e.stopPropagation(); const hora = new Date().toTimeString().slice(0,5); onUpdateReg({ salidaMarcada: true, horaSalidaReal: hora }) }}
                style={{ flex: 1, fontSize: 13, fontWeight: 700, padding: "9px 0", borderRadius: 8, border: "2px solid #EF9A9A", background: "rgba(183,28,28,0.5)", color: "#fff", cursor: "pointer", letterSpacing: 0.3 }}>
                ↑ Marcar salida
              </button>
            )}
          </div>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>✏ Tocá para editar</span>
            {!confirmDelete ? (
              <button
                onClick={e => { e.stopPropagation(); setConfirmDelete(true) }}
                style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(255,80,80,0.5)", background: "rgba(183,28,28,0.25)", color: "#EF9A9A", cursor: "pointer", fontWeight: 600 }}>
                🗑 Eliminar
              </button>
            ) : (
              <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#EF9A9A" }}>¿Confirmar?</span>
                <button onClick={() => onDelete && onDelete()}
                  style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "none", background: C.red, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
                  Sí, eliminar
                </button>
                <button onClick={() => setConfirmDelete(false)}
                  style={{ fontSize: 11, padding: "3px 10px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </>
      ) : (
        <div onClick={e => e.stopPropagation()}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 10 }}>✏ Editando huésped</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            {[["Nombre","nombre","text"],["Apellido","apellido","text"],["DNI / ID","id","text"],["Departamento","depto","text"],
              ["Fecha ingreso","ingreso","date"],["Fecha salida","salida","date"],["Hora ingreso","horaIngreso","time"],
              ["Cochera","cochera","text"],["Patente","patente","text"],["Vehículo","vehiculo","text"]
            ].map(([label, key, type]) => (
              <div key={key}>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
                {inp(key, type)}
              </div>
            ))}
          </div>
          {onUpdateReg && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginBottom: 3, textTransform: "uppercase", letterSpacing: 0.4 }}>Comentario</div>
              <textarea defaultValue={reg.comentario || ""} onChange={e => onUpdateReg({ comentario: e.target.value })}
                style={{ ...S.input, fontSize: 12, padding: "5px 8px", background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", resize: "vertical", minHeight: 52, fontFamily: "inherit" }} />
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
            <button onClick={save} style={{ flex: 1, fontSize: 12, fontWeight: 700, padding: "7px 0", borderRadius: 7, border: "none", background: "#2E7D32", color: "#fff", cursor: "pointer" }}>✓ Guardar</button>
            <button onClick={cancel} style={{ fontSize: 12, padding: "7px 14px", borderRadius: 7, border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  )
}

function HuespedEditForm({ h, onSave, onCancel }) {
  const [form, setForm] = useState({ ...h })
  const inp = (key, type, label) => (
    <div key={key} style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textSec, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
      <input type={type} value={form[key] || ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={S.input} />
    </div>
  )
  return (
    <div style={{ background: C.accentLight, border: `1px solid #C3D5F5`, borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        {inp("nombre","text","Nombre")}{inp("apellido","text","Apellido")}
        {inp("id","text","DNI / ID")}{inp("depto","text","Departamento")}
        {inp("ingreso","date","Fecha ingreso")}{inp("salida","date","Fecha salida")}
        {inp("horaIngreso","time","Hora ingreso")}{inp("cochera","text","Cochera")}
        {inp("patente","text","Patente")}{inp("vehiculo","text","Vehículo")}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button onClick={() => onSave(form)} style={{ ...S.btnPrimary, fontSize: 13, padding: "7px 18px" }}>✓ Guardar</button>
        <button onClick={onCancel} style={{ ...S.btnSecondary, fontSize: 13, padding: "7px 14px" }}>Cancelar</button>
      </div>
    </div>
  )
}

function Login({ onLogin }) {
  const [pass, setPass] = useState(""); const [err, setErr] = useState("")
  const submit = () => { pass === ADMIN_PASS ? onLogin("admin") : setErr("Contraseña incorrecta.") }
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "2rem", width: "100%", maxWidth: 360, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}>
        <div style={{ textAlign: "center", marginBottom: "1.75rem" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: C.navy }}>Acceso Administrador</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: C.textSec }}>Ingresá la contraseña de admin</p>
        </div>
        <Field label="Contraseña">
          <input type="password" value={pass} onChange={e => { setPass(e.target.value); setErr("") }}
            onKeyDown={e => e.key === "Enter" && submit()} style={S.input} placeholder="••••••••" autoFocus />
        </Field>
        {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <button onClick={submit} style={{ ...S.btnPrimary, width: "100%", padding: "11px 0", marginTop: 4 }}>Ingresar</button>
      </div>
    </div>
  )
}

export default function App() {
  const [userRole, setUserRole] = useState("general")
  const [tab, setTab] = useState("deptos")
  const [deptos, setDeptos] = useState([])
  const [huespedes, setHuespedes] = useState([])
  const [registros, setRegistros] = useState({})
  const [selectedDepto, setSelectedDepto] = useState(null)
  const [viewDate, setViewDate] = useState(TODAY)
  const [showAddH, setShowAddH] = useState(false)
  const [showImportH, setShowImportH] = useState(false)
  const [showAdminLogin, setShowAdminLogin] = useState(false)
  const [importMsg, setImportMsg] = useState("")
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [searchDepto, setSearchDepto] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [editingHId, setEditingHId] = useState(null)
  const [searchAdmin, setSearchAdmin] = useState("")
  const [searchAdminMode, setSearchAdminMode] = useState("huesped") // "huesped" | "depto"
  const fileDRef = useRef()

  // ── Suscripciones en tiempo real a Firestore ──
  useEffect(() => {
    const u1 = storageSubscribe(STORAGE_KEYS.deptos,    v => { if (v) setDeptos(v) })
    const u2 = storageSubscribe(STORAGE_KEYS.huespedes, v => { if (v) setHuespedes(v) })
    const u3 = storageSubscribe(STORAGE_KEYS.registros, v => { if (v) setRegistros(v) })
    const t  = setTimeout(() => setLoading(false), 1500)
    return () => { u1(); u2(); u3(); clearTimeout(t) }
  }, [])

  const persist = (key, val) => storageSet(key, JSON.stringify(val))
  const setD = v => { setDeptos(v);    persist(STORAGE_KEYS.deptos,    v) }
  const setH = v => { setHuespedes(v); persist(STORAGE_KEYS.huespedes, v) }
  const setR = v => { setRegistros(v); persist(STORAGE_KEYS.registros, v) }

  const deleteHuesped = (id) => {
    setHuespedes(prev => {
      const next = prev.filter(h => h.id !== id)
      persist(STORAGE_KEYS.huespedes, next)
      return next
    })
  }
  const updateHuesped = (id, patch) => {
    setHuespedes(prev => {
      const next = prev.map(h => h.id === id ? { ...h, ...patch } : h)
      persist(STORAGE_KEYS.huespedes, next)
      return next
    })
  }
  const updateReg = (hid, patch) => {
    setRegistros(prev => {
      const next = { ...prev, [hid]: { ...(prev[hid] || {}), ...patch } }
      persist(STORAGE_KEYS.registros, next)
      return next
    })
  }
  const toast = msg => { setImportMsg(msg); setTimeout(() => setImportMsg(""), 4000) }
  const isAdmin = userRole === "admin"

  function importDeptos(text) {
    const { rows } = parseCSV(text)
    const nuevos = rows.map(r => ({
      id:     findField(r, ["id","codigo","code","numero","num"]) || findField(r, [Object.keys(r)[0]]),
      nombre: findField(r, ["nombre","name","descripcion","depto","apt"]) || findField(r, [Object.keys(r)[0]]),
      piso:   findField(r, ["piso","floor","nivel"]),
    })).filter(r => r.id || r.nombre).map(d => ({ ...d, id: d.id || d.nombre }))

    // Merge: si ya existe un depto con el mismo id, lo actualiza; si no, lo agrega
    const merged = [...deptos]
    let agregados = 0, actualizados = 0
    nuevos.forEach(nd => {
      const idx = merged.findIndex(d => d.id === nd.id)
      if (idx >= 0) { merged[idx] = { ...merged[idx], ...nd }; actualizados++ }
      else { merged.push(nd); agregados++ }
    })
    setD(merged)
    toast(`✓ ${agregados} nuevos · ${actualizados} actualizados · ${merged.length} total`)
  }

  function importHuespedes(text, replace = false) {
    const { rows } = parseCSV(text)
    const nuevos = rows.map((r, i) => {
      const nombreCompleto = findField(r, ["nombre_y_apellido","nombre_apellido","nombre"])
      let nombre = "", apellido = ""
      if (nombreCompleto) { const p = nombreCompleto.trim().split(/\s+/); nombre = p[0] || ""; apellido = p.slice(1).join(" ") || "" }
      else { nombre = findField(r, ["nombre","name","first"]); apellido = findField(r, ["apellido","last","surname"]) }
      const rawIngreso  = findField(r, ["fecha_ingreso","fecha_de_ingreso","ingreso","checkin","check_in","entrada","from","inicio"])
      const rawSalida   = findField(r, ["fecha_salida","fecha_de_salida","salida","checkout","check_out","hasta","to","fin"])
      const horaIngreso = findField(r, ["hora_ingreso","hora_de_ingreso","hora"])
      const cocheraRaw  = findField(r, ["usa_cochera","cochera"])
      const patente     = findField(r, ["patente"])
      const vehiculo    = findField(r, ["marca_o_modelo","modelo","vehiculo","auto"])
      let cochera = ""
      if (cocheraRaw && cocheraRaw !== "0" && cocheraRaw.toLowerCase() !== "false") cochera = cocheraRaw
      return {
        id: findField(r, ["id"]) || `h${Date.now()}${i}`,
        nombre, apellido,
        depto: String(findField(r, ["depto","dept","apartamento","apt","habitacion","unit"]) || "").replace(/\.0$/, ""),
        ingreso: toISODate(rawIngreso), salida: toISODate(rawSalida),
        horaIngreso: horaIngreso || "", cochera,
        patente:  patente  && patente  !== "0" ? patente  : "",
        vehiculo: vehiculo && vehiculo !== "0" ? vehiculo : "",
      }
    }).filter(r => r.nombre || r.apellido)

    if (replace) {
      setH(nuevos)
      toast(`✓ ${nuevos.length} huéspedes cargados (reemplazo total).`)
      return
    }

    // Merge: detecta duplicado por id + depto + ingreso + salida
    const base = [...huespedes]
    let agregados = 0, omitidos = 0
    nuevos.forEach(nh => {
      const esDuplicado = base.some(h =>
        h.id === nh.id ||
        (h.nombre === nh.nombre && h.apellido === nh.apellido && h.depto === nh.depto && h.ingreso === nh.ingreso && h.salida === nh.salida)
      )
      if (esDuplicado) { omitidos++; return }
      base.push(nh); agregados++
    })
    setH(base)
    toast(`✓ ${agregados} agregados · ${omitidos} duplicados omitidos · ${base.length} total`)
  }

  // Extrae todos los bloques numéricos de un string: "310 H475" → ["310", "475"]
  function extractNums(val) {
    return ((val || "").match(/\d+/g) || [])
  }
  // Dos deptos coinciden si comparten AL MENOS un bloque numérico
  function deptoMatch(deptoId, hDepto) {
    if (!deptoId || !hDepto) return false
    const a = (deptoId || "").trim().toLowerCase()
    const b = (hDepto  || "").trim().toLowerCase()
    if (a === b) return true
    const numsA = extractNums(a)
    const numsB = extractNums(b)
    return numsA.length > 0 && numsB.length > 0 && numsA.some(n => numsB.includes(n))
  }
  function huespedesEnFecha(fecha) {
    return huespedes.filter(h => h.ingreso && h.salida && h.ingreso <= fecha && h.salida >= fecha)
  }
  function huespedesDeDepto(deptoId, fecha) {
    return huespedes.filter(h => {
      if (!deptoMatch(deptoId, h.depto)) return false
      if (!h.ingreso || !h.salida) return true
      return h.ingreso <= fecha && h.salida >= fecha
    })
  }
  function deptoStatus(dId) {
    if (huespedesDeDepto(dId, TODAY).length > 0) return "ocupado"
    const in3 = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10)
    if (huespedes.some(h => deptoMatch(dId, h.depto) && h.ingreso && h.ingreso > TODAY && h.ingreso <= in3)) return "proximo"
    return "libre"
  }
  function getHuespedStatus(h, fecha) {
    if (h.salida  === fecha) return "checkout"
    if (h.ingreso === fecha) return "checkin"
    return "inhouse"
  }
  function downloadInhouse() {
    const fecha = viewDate
    const inhouse = huespedesEnFecha(fecha).filter(h => getHuespedStatus(h, fecha) === "inhouse")
    if (inhouse.length === 0) { toast("No hay huéspedes in-house para esta fecha."); return }
    const cols = ["Depto","Nombre","Apellido","ID/DNI","Ingreso","Salida","Hora Ingreso","Cochera","Patente","Vehículo"]
    const rows = inhouse.map(h => [h.depto,h.nombre,h.apellido,h.id,fmtDate(h.ingreso),fmtDate(h.salida),h.horaIngreso||"",h.cochera||"",h.patente||"",h.vehiculo||""])
    const csv = [cols,...rows].map(r => r.map(v => `"${(v||"").toString().replace(/"/g,'""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `inhouse_${fecha}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast(`✓ Descargado: ${inhouse.length} huéspedes in-house.`)
  }

  if (showAdminLogin) return <Login onLogin={role => { setUserRole(role); setShowAdminLogin(false); setTab("admin") }} />

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: C.textSec }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏢</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.navy }}>Cargando datos...</div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: "deptos",   label: "🏠 Departamentos" },
    { id: "huespedes",label: "👥 Huéspedes por día" },
    isAdmin ? { id: "admin", label: "⚙️ Administración" } : { id: "adminLogin", label: "🔐 Admin" },
  ]
  const filteredDeptos = deptos.filter(d => !search || (d.id+d.nombre+d.piso).toLowerCase().includes(search.toLowerCase()))
  const hoyEnFecha = huespedesEnFecha(viewDate)
  const handleTab = id => { if (id === "adminLogin") { setShowAdminLogin(true); return }; setTab(id) }

  const FILTROS = [
    { key: "todos",    label: "Todos",        color: C.navy   },
    { key: "checkin",  label: "✈ Check-in",   color: C.accent },
    { key: "checkout", label: "🚪 Check-out",  color: C.red    },
    { key: "inhouse",  label: "🏠 In-house",   color: C.green  },
  ]
  const filtrados = hoyEnFecha.filter(h => {
    const st = getHuespedStatus(h, viewDate)
    if (filtroEstado !== "todos" && st !== filtroEstado) return false
    if (searchDepto.trim() && !(h.depto || "").toLowerCase().includes(searchDepto.trim().toLowerCase())) return false
    return true
  })
  const grouped = {}
  filtrados.forEach(h => { const k = h.depto || "Sin depto"; if (!grouped[k]) grouped[k] = []; grouped[k].push(h) })
  const entries = Object.entries(grouped).sort(([a],[b]) => a.localeCompare(b, undefined, { numeric: true }))

  return (
    <div style={{ fontFamily: "'Inter',system-ui,sans-serif", background: C.bg, minHeight: "100vh", color: C.text }}>

      {/* HEADER */}
      <div style={{ background: C.navy, padding: "0 1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0 0" }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: 1, textTransform: "uppercase" }}>Sistema de Gestión</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#fff", marginTop: 2 }}>Control de Huéspedes</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge color={isAdmin ? "amber" : "blue"}>{isAdmin ? "Admin" : "General"}</Badge>
            {isAdmin && <button onClick={() => { setUserRole("general"); setTab("deptos") }} style={{ background: "rgba(255,255,255,0.12)", border: "none", color: "#fff", fontSize: 12, padding: "6px 12px", borderRadius: 7, cursor: "pointer", fontWeight: 500 }}>Salir</button>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => handleTab(t.id)} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", borderRadius: "8px 8px 0 0", background: tab === t.id ? C.bg : "transparent", color: tab === t.id ? C.navy : "rgba(255,255,255,0.65)" }}>{t.label}</button>
          ))}
        </div>
      </div>

      <Toast msg={importMsg} />
      <div style={{ padding: "1.5rem" }}>

        {/* ── DEPARTAMENTOS ── */}
        {tab === "deptos" && (
          <div>
            <SectionHeader title="Departamentos" subtitle={`Estado al día de hoy · ${deptos.length} departamentos`} />
            <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <input placeholder="🔍  Buscar..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...S.input, width: 220, flex: "0 0 auto" }} />
              <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                <Badge color="green">● Ocupado</Badge><Badge color="amber">● Próximo (3d)</Badge><Badge color="gray">● Libre</Badge>
              </div>
            </div>
            {deptos.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "3rem", color: C.textSec, fontSize: 14 }}>
                {isAdmin ? <>No hay departamentos. Andá a <b>Administración</b> para cargar el CSV.</> : "No hay departamentos cargados aún."}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredDeptos.map(d => {
                  const status = deptoStatus(d.id)
                  const hList  = huespedesDeDepto(d.id, TODAY)
                  const statusColor = status === "ocupado" ? "green" : status === "proximo" ? "amber" : "gray"
                  const rowBg = status === "ocupado" ? "#F0FAF0" : status === "proximo" ? "#FFFBEB" : C.white
                  return (
                    <div key={d.id} onClick={() => setSelectedDepto(d)}
                      style={{ ...S.card, background: rowBg, cursor: "pointer", padding: "14px 16px" }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: hList.length > 0 ? 12 : 0 }}>
                        <div style={{ minWidth: 90 }}>
                          <div style={{ fontWeight: 700, fontSize: 16, color: C.navy }}>{d.nombre || d.id}</div>
                          {d.piso && <div style={{ fontSize: 11, color: C.textTer, marginTop: 2 }}>Piso {d.piso}</div>}
                        </div>
                        <div style={{ flex: 1, fontSize: 13, color: C.textSec }}>
                          {hList.length === 0 ? <span>Sin huésped hoy</span> : <span style={{ fontWeight: 500, color: C.text }}>{hList.length} huésped{hList.length > 1 ? "es" : ""} alojado{hList.length > 1 ? "s" : ""}</span>}
                        </div>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <Badge color={statusColor}>{status === "ocupado" ? "Ocupado" : status === "proximo" ? "Próximo" : "Libre"}</Badge>
                          <span style={{ color: C.textTer, fontSize: 18 }}>›</span>
                        </div>
                      </div>
                      {hList.length > 0 && (
                        <div onClick={e => e.stopPropagation()}>
                          {hList.map((h, idx) => (
                            <div key={h.id} style={{ marginBottom: idx < hList.length - 1 ? 8 : 0 }}>
                              <HuespedCard h={h} reg={registros[h.id] || {}} fecha={TODAY}
                                onUpdate={patch => updateHuesped(h.id, patch)}
                                onUpdateReg={patch => updateReg(h.id, patch)}
                                onDelete={() => deleteHuesped(h.id)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── HUÉSPEDES POR DÍA ── */}
        {tab === "huespedes" && (
          <div>
            <SectionHeader title="Huéspedes por día" subtitle="Vista de todos los departamentos ocupados en la fecha seleccionada" />
            <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 16, marginBottom: "1rem", flexWrap: "wrap", background: C.accentLight, borderColor: "#C3D5F5" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>Fecha</div>
                <input type="date" value={viewDate} onChange={e => setViewDate(e.target.value)} style={{ ...S.input, width: "auto", border: `1px solid ${C.accent}` }} />
              </div>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                {[
                  { label: "total",      val: hoyEnFecha.length, color: C.navy   },
                  { label: "check-in",   val: hoyEnFecha.filter(h => getHuespedStatus(h, viewDate) === "checkin").length,  color: C.accent },
                  { label: "check-out",  val: hoyEnFecha.filter(h => getHuespedStatus(h, viewDate) === "checkout").length, color: C.red    },
                  { label: "in-house",   val: hoyEnFecha.filter(h => getHuespedStatus(h, viewDate) === "inhouse").length,  color: C.green  },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
                    <div style={{ fontSize: 11, color: C.textSec }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginLeft: "auto" }}>
                <button onClick={downloadInhouse} style={{ ...S.btnPrimary, whiteSpace: "nowrap" }}>⬇ Descargar In-house</button>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
              <input placeholder="🔍 Buscar depto..." value={searchDepto} onChange={e => setSearchDepto(e.target.value)} style={{ ...S.input, width: 180, flex: "0 0 auto" }} />
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {FILTROS.map(f => (
                  <button key={f.key} onClick={() => setFiltroEstado(f.key)}
                    style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 20, border: `2px solid ${f.color}`, cursor: "pointer",
                      background: filtroEstado === f.key ? f.color : "transparent", color: filtroEstado === f.key ? "#fff" : f.color }}>
                    {f.label} ({hoyEnFecha.filter(h => f.key === "todos" || getHuespedStatus(h, viewDate) === f.key).length})
                  </button>
                ))}
              </div>
            </div>
            {filtrados.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "3rem", color: C.textSec, fontSize: 14 }}>
                {hoyEnFecha.length === 0 ? "Sin huéspedes alojados para esta fecha." : "Sin resultados para el filtro seleccionado."}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))", gap: 14 }}>
                {entries.map(([dep, hs]) => {
                  const hasCheckout = hs.some(h => getHuespedStatus(h, viewDate) === "checkout")
                  const hasCheckin  = hs.some(h => getHuespedStatus(h, viewDate) === "checkin")
                  const cardBorder  = hasCheckout ? C.red : hasCheckin ? C.accent : C.green
                  return (
                    <div key={dep} style={{ background: "#E8ECF0", borderRadius: 14, border: `2px solid ${cardBorder}`, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                      <div style={{ background: "#3A4252", padding: "10px 14px" }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>Depto {dep}</span>
                      </div>
                      <div style={{ padding: "10px 12px" }}>
                        {hs.map((h, idx) => (
                          <div key={h.id} style={{ marginBottom: idx < hs.length - 1 ? 8 : 0 }}>
                            <HuespedCard h={h} reg={registros[h.id] || {}} fecha={viewDate}
                              onUpdate={patch => updateHuesped(h.id, patch)}
                              onUpdateReg={patch => updateReg(h.id, patch)}
                              onDelete={() => deleteHuesped(h.id)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ADMINISTRACIÓN ── */}
        {tab === "admin" && isAdmin && (
          <div>
            <SectionHeader title="Administración" subtitle="Carga y gestión de datos del sistema" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: "1.75rem" }}>
              <div style={{ ...S.card, borderTop: `4px solid ${C.navy}` }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 4 }}>🏢 Departamentos</div>
                <div style={{ fontSize: 13, color: C.textSec, marginBottom: 14 }}>{deptos.length} cargados</div>
                <button onClick={() => fileDRef.current.click()} style={{ ...S.btnPrimary, width: "100%", marginBottom: 8 }}>Subir CSV de deptos</button>
                <input ref={fileDRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => {
                  const f = e.target.files[0]; if (!f) return
                  const r = new FileReader(); r.onload = ev => { importDeptos(ev.target.result); e.target.value = "" }; r.readAsText(f)
                }} />
                <div style={{ fontSize: 11, color: C.textTer }}>Columnas: id/numero, nombre, piso</div>
              </div>
              <div style={{ ...S.card, borderTop: `4px solid ${C.accent}` }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 4 }}>👤 Huéspedes</div>
                <div style={{ fontSize: 13, color: C.textSec, marginBottom: 14 }}>{huespedes.length} cargados</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <button onClick={() => setShowImportH("add")}     style={{ ...S.btnSecondary, width: "100%" }}>＋ Agregar CSV</button>
                  <button onClick={() => setShowImportH("replace")} style={{ ...S.btnSecondary, width: "100%" }}>↺ Reemplazar CSV</button>
                  <button onClick={() => setShowAddH(true)}         style={{ ...S.btnPrimary,   width: "100%" }}>+ Agregar manualmente</button>
                </div>
                <div style={{ fontSize: 11, color: C.textTer, marginTop: 8 }}>
                  Columnas: Nombre y Apellido · Depto · Fecha Ingreso · Fecha Salida · ID · Hora ingreso · Usa Cochera · Patente · Marca o Modelo
                </div>
              </div>
            </div>
            {/* ── BUSCADOR ── */}
            <div style={{ ...S.card, marginBottom: "1.5rem", borderTop: `4px solid ${C.accent}` }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: C.navy, marginBottom: 12 }}>🔍 Buscador</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <button onClick={() => setSearchAdminMode("huesped")} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 20, border: `2px solid ${C.accent}`, cursor: "pointer", background: searchAdminMode === "huesped" ? C.accent : "transparent", color: searchAdminMode === "huesped" ? "#fff" : C.accent }}>👤 Por huésped</button>
                <button onClick={() => setSearchAdminMode("depto")} style={{ fontSize: 13, fontWeight: 600, padding: "7px 16px", borderRadius: 20, border: `2px solid ${C.navy}`, cursor: "pointer", background: searchAdminMode === "depto" ? C.navy : "transparent", color: searchAdminMode === "depto" ? "#fff" : C.navy }}>🏠 Por depto</button>
              </div>
              <input
                placeholder={searchAdminMode === "huesped" ? "🔍  Buscar por nombre, apellido o DNI..." : "🔍  Buscar por número o nombre de departamento..."}
                value={searchAdmin}
                onChange={e => setSearchAdmin(e.target.value)}
                style={{ ...S.input, marginBottom: 14 }}
              />
              {searchAdmin.trim().length > 0 && (() => {
                const q = searchAdmin.trim().toLowerCase()
                if (searchAdminMode === "huesped") {
                  const resultados = huespedes.filter(h =>
                    (h.nombre || "").toLowerCase().includes(q) ||
                    (h.apellido || "").toLowerCase().includes(q) ||
                    (h.id || "").toLowerCase().includes(q)
                  ).sort((a, b) => (b.ingreso || "").localeCompare(a.ingreso || ""))
                  return resultados.length === 0
                    ? <div style={{ textAlign: "center", padding: "1.5rem", color: C.textSec, fontSize: 14 }}>Sin resultados para "{searchAdmin}".</div>
                    : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>{resultados.length} resultado{resultados.length !== 1 ? "s" : ""}</div>
                        {resultados.map(h => {
                          const reg = registros[h.id] || {}
                          const pasado = h.salida < TODAY
                          const futuro = h.ingreso > TODAY
                          const statusColor = pasado ? "gray" : futuro ? "amber" : "green"
                          const statusLabel = pasado ? "Finalizado" : futuro ? "Próximo" : "Activo"
                          return (
                            <div key={h.id} style={{ ...S.card, padding: "12px 14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{h.nombre} {h.apellido}</div>
                                  <div style={{ fontSize: 12, color: C.textSec, marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                    {h.id && <span>DNI: {h.id}</span>}
                                    <span style={{ fontWeight: 600, color: C.accent }}>Depto {h.depto || "—"}</span>
                                    <span>{fmtDate(h.ingreso)} → {fmtDate(h.salida)}</span>
                                    {h.horaIngreso && <span>Hora: {h.horaIngreso}</span>}
                                    {h.cochera && <span>🚗 Cochera {h.cochera}</span>}
                                    {h.patente && <span>Patente: {h.patente}</span>}
                                  </div>
                                  {(reg.ingresoMarcado || reg.salidaMarcada || reg.comentario) && (
                                    <div style={{ fontSize: 11, color: C.textSec, marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
                                      {reg.ingresoMarcado && <span style={{ color: C.green }}>✓ Ingresó {reg.horaIngresoReal || ""}</span>}
                                      {reg.salidaMarcada  && <span style={{ color: C.amber }}>↑ Salió {reg.horaSalidaReal || ""}</span>}
                                      {reg.comentario     && <span style={{ fontStyle: "italic" }}>💬 {reg.comentario}</span>}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                                  <Badge color={statusColor}>{statusLabel}</Badge>
                                  <div style={{ display: "flex", gap: 6 }}>
                                    <button onClick={() => setEditingHId(h.id)} style={{ ...S.btnSecondary, fontSize: 12, padding: "5px 10px" }}>✏ Editar</button>
                                    <button onClick={() => deleteHuesped(h.id)} style={S.btnDanger}>Eliminar</button>
                                  </div>
                                </div>
                              </div>
                              {editingHId === h.id && (
                                <div style={{ marginTop: 10 }}>
                                  <HuespedEditForm h={h}
                                    onSave={patch => { updateHuesped(h.id, patch); setEditingHId(null); toast("✓ Huésped actualizado.") }}
                                    onCancel={() => setEditingHId(null)} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                }
                const resultadosDeptos = deptos.filter(d =>
                  (d.id || "").toLowerCase().includes(q) ||
                  (d.nombre || "").toLowerCase().includes(q) ||
                  (d.piso || "").toLowerCase().includes(q)
                )
                const sinDepto = resultadosDeptos.length === 0
                  ? huespedes.filter(h => (h.depto || "").toLowerCase().includes(q))
                    .map(h => h.depto).filter((v, i, a) => a.indexOf(v) === i)
                    .map(id => ({ id, nombre: id, piso: "" }))
                  : []
                const todos = [...resultadosDeptos, ...sinDepto]
                return todos.length === 0
                  ? <div style={{ textAlign: "center", padding: "1.5rem", color: C.textSec, fontSize: 14 }}>Sin resultados para "{searchAdmin}".</div>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 12, color: C.textSec, marginBottom: 4 }}>{todos.length} departamento{todos.length !== 1 ? "s" : ""}</div>
                      {todos.map(d => {
                        const status = deptoStatus(d.id)
                        const statusColor = status === "ocupado" ? "green" : status === "proximo" ? "amber" : "gray"
                        const hActual = huespedesDeDepto(d.id, TODAY)
                        const hProximos = huespedes.filter(hx => deptoMatch(d.id, hx.depto) && hx.ingreso && hx.ingreso > TODAY).sort((a, b) => a.ingreso.localeCompare(b.ingreso))
                        const hHistorial = huespedes.filter(hx => deptoMatch(d.id, hx.depto) && hx.salida && hx.salida < TODAY).sort((a, b) => b.salida.localeCompare(a.salida))
                        return (
                          <div key={d.id} style={{ ...S.card, padding: "14px 16px", borderLeft: `4px solid ${status === "ocupado" ? C.green : status === "proximo" ? C.amber : C.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                              <div>
                                <span style={{ fontWeight: 700, fontSize: 16, color: C.navy }}>{d.nombre || d.id}</span>
                                {d.piso && <span style={{ fontSize: 12, color: C.textTer, marginLeft: 8 }}>Piso {d.piso}</span>}
                              </div>
                              <Badge color={statusColor}>{status === "ocupado" ? "Ocupado" : status === "proximo" ? "Próximo" : "Libre"}</Badge>
                            </div>
                            {hActual.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Huésped actual</div>
                                {hActual.map(h => (
                                  <div key={h.id} style={{ background: C.greenBg, border: `1px solid #A5D6A7`, borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, color: C.navy }}>{h.nombre} {h.apellido}</span>
                                    {h.id && <span style={{ color: C.textSec, marginLeft: 8 }}>DNI: {h.id}</span>}
                                    <span style={{ color: C.textSec, marginLeft: 8 }}>{fmtDate(h.ingreso)} → {fmtDate(h.salida)}</span>
                                    {h.cochera && <span style={{ color: C.textSec, marginLeft: 8 }}>🚗 {h.cochera}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {hProximos.length > 0 && (
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Próximas reservas ({hProximos.length})</div>
                                {hProximos.slice(0, 3).map(h => (
                                  <div key={h.id} style={{ background: C.amberBg, border: `1px solid #FCD34D`, borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, color: C.navy }}>{h.nombre} {h.apellido}</span>
                                    <span style={{ color: C.textSec, marginLeft: 8 }}>{fmtDate(h.ingreso)} → {fmtDate(h.salida)}</span>
                                    <span style={{ color: C.amber, fontWeight: 600, marginLeft: 8 }}>en {Math.round((new Date(h.ingreso) - new Date(TODAY)) / 86400000)}d</span>
                                  </div>
                                ))}
                                {hProximos.length > 3 && <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>+ {hProximos.length - 3} más...</div>}
                              </div>
                            )}
                            {hHistorial.length > 0 && (
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Historial ({hHistorial.length} estadías)</div>
                                {hHistorial.slice(0, 2).map(h => (
                                  <div key={h.id} style={{ background: C.grayBg, border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 600, color: C.navy }}>{h.nombre} {h.apellido}</span>
                                    <span style={{ color: C.textSec, marginLeft: 8 }}>{fmtDate(h.ingreso)} → {fmtDate(h.salida)}</span>
                                  </div>
                                ))}
                                {hHistorial.length > 2 && <div style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>+ {hHistorial.length - 2} estadías anteriores...</div>}
                              </div>
                            )}
                            {hActual.length === 0 && hProximos.length === 0 && hHistorial.length === 0 && (
                              <div style={{ fontSize: 13, color: C.textTer, fontStyle: "italic" }}>Sin reservas registradas.</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
              })()}
            </div>

            <div style={{ fontWeight: 700, fontSize: 16, color: C.navy, marginBottom: "1rem" }}>Listado de huéspedes</div>
            {huespedes.length === 0 ? (
              <div style={{ ...S.card, textAlign: "center", padding: "2rem", color: C.textSec, fontSize: 14 }}>Sin datos.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {huespedes.map(h => (
                  <div key={h.id}>
                    {editingHId !== h.id ? (
                      <div style={{ ...S.card, display: "flex", gap: 10, alignItems: "center", padding: "10px 14px", flexWrap: "wrap" }}>
                        <div style={{ fontSize: 11, color: C.textTer, minWidth: 60 }}>#{h.id}</div>
                        <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{h.nombre} {h.apellido}</div>
                        <Badge color="blue">Depto {h.depto}</Badge>
                        <div style={{ fontSize: 12, color: C.textSec }}>{fmtDate(h.ingreso)} → {fmtDate(h.salida)}</div>
                        {h.cochera && <Badge color="gray">🚗 Cochera {h.cochera}</Badge>}
                        <button onClick={() => setEditingHId(h.id)} style={{ ...S.btnSecondary, fontSize: 12, padding: "5px 12px" }}>✏ Editar</button>
                        <button onClick={() => deleteHuesped(h.id)} style={S.btnDanger}>Eliminar</button>
                      </div>
                    ) : (
                      <HuespedEditForm h={h}
                        onSave={patch => { updateHuesped(h.id, patch); setEditingHId(null); toast("✓ Huésped actualizado.") }}
                        onCancel={() => setEditingHId(null)} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL: detalle depto */}
      {selectedDepto && (() => {
        const d = selectedDepto
        const hActual    = huespedesDeDepto(d.id, TODAY)
        const hProximos  = huespedes.filter(hx => deptoMatch(d.id, hx.depto) && hx.ingreso && hx.ingreso > TODAY).sort((a,b) => a.ingreso.localeCompare(b.ingreso))
        const hHistorial = huespedes.filter(hx => deptoMatch(d.id, hx.depto) && hx.salida  && hx.salida  <= TODAY && !(hx.ingreso <= TODAY && hx.salida >= TODAY)).sort((a,b) => b.salida.localeCompare(a.salida))
        const status     = deptoStatus(d.id)

        const ModalDetalle = () => {
          const [modalTab, setModalTab] = useState(hActual.length > 0 ? "actual" : hProximos.length > 0 ? "proximos" : "historial")
          const tabStyle = key => ({ padding: "7px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", borderRadius: "7px 7px 0 0", background: modalTab === key ? C.white : "transparent", color: modalTab === key ? C.navy : C.textSec, borderBottom: modalTab === key ? `2px solid ${C.accent}` : "2px solid transparent" })
          return (
            <Modal title={`Depto ${d.nombre || d.id}${d.piso ? ` · Piso ${d.piso}` : ""}`} onClose={() => setSelectedDepto(null)}>
              <div style={{ marginBottom: 12, display: "flex", gap: 8, alignItems: "center" }}>
                <Badge color={status === "ocupado" ? "green" : status === "proximo" ? "amber" : "gray"}>
                  {status === "ocupado" ? "● Ocupado ahora" : status === "proximo" ? "● Próxima reserva" : "● Libre"}
                </Badge>
              </div>
              <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
                <button style={tabStyle("actual")}   onClick={() => setModalTab("actual")}>🏠 Actual {hActual.length > 0 && <span style={{ background: C.greenBg, color: C.green, borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: 4 }}>{hActual.length}</span>}</button>
                <button style={tabStyle("proximos")} onClick={() => setModalTab("proximos")}>📅 Próximos {hProximos.length > 0 && <span style={{ background: C.amberBg, color: C.amber, borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: 4 }}>{hProximos.length}</span>}</button>
                <button style={tabStyle("historial")}onClick={() => setModalTab("historial")}>🗂 Historial {hHistorial.length > 0 && <span style={{ background: C.grayBg, color: C.gray, borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: 4 }}>{hHistorial.length}</span>}</button>
              </div>

              {modalTab === "actual" && (
                hActual.length > 0 ? (
                  <div>
                    {hActual.map((h, idx) => (
                      <div key={h.id} style={{ marginBottom: idx < hActual.length - 1 ? 8 : 0 }}>
                        <HuespedCard h={h} reg={registros[h.id] || {}} fecha={TODAY}
                          onUpdate={patch => updateHuesped(h.id, patch)}
                          onUpdateReg={patch => updateReg(h.id, patch)} />
                      </div>
                    ))}
                  </div>
                ) : <div style={{ textAlign: "center", padding: "2rem 0", color: C.textSec, fontSize: 14 }}>Sin huésped activo hoy.</div>
              )}

              {modalTab === "proximos" && (
                hProximos.length === 0
                  ? <div style={{ textAlign: "center", padding: "2rem 0", color: C.textSec, fontSize: 14 }}>Sin reservas futuras.</div>
                  : <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {hProximos.map(hx => {
                      const dias = Math.round((new Date(hx.ingreso) - new Date(TODAY)) / 86400000)
                      return (
                        <div key={hx.id} style={{ background: C.amberBg, border: `1px solid #FCD34D`, borderRadius: 10, padding: "12px 14px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{hx.nombre} {hx.apellido}</div>
                              <div style={{ fontSize: 12, color: C.textSec, marginTop: 3 }}>
                                {hx.id && <span style={{ marginRight: 8 }}>DNI: {hx.id}</span>}
                                {hx.cochera && <span>🚗 Cochera {hx.cochera}</span>}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>en {dias}d</div>
                              <div style={{ fontSize: 11, color: C.textSec }}>{fmtDate(hx.ingreso)} → {fmtDate(hx.salida)}</div>
                            </div>
                          </div>
                          {hx.horaIngreso && <div style={{ fontSize: 11, color: C.textSec, marginTop: 5 }}>Hora estimada: {hx.horaIngreso}</div>}
                        </div>
                      )
                    })}
                  </div>
              )}

              {modalTab === "historial" && (
                hHistorial.length === 0
                  ? <div style={{ textAlign: "center", padding: "2rem 0", color: C.textSec, fontSize: 14 }}>Sin historial de reservas.</div>
                  : <>
                    <div style={{ fontSize: 12, color: C.textSec, marginBottom: 10 }}>
                      {hHistorial.length} reserva{hHistorial.length !== 1 ? "s" : ""} anteriores
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {hHistorial.map((hx, idx) => {
                        const regHx = registros[hx.id] || {}
                        const noches = hx.ingreso && hx.salida
                          ? Math.round((new Date(hx.salida) - new Date(hx.ingreso)) / 86400000)
                          : null
                        return (
                          <div key={hx.id} style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
                            {/* Cabecera con fechas */}
                            <div style={{ background: C.navy, padding: "7px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                                {fmtDate(hx.ingreso)} → {fmtDate(hx.salida)}
                              </span>
                              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                {noches !== null && (
                                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>{noches} noche{noches !== 1 ? "s" : ""}</span>
                                )}
                                <span style={{ fontSize: 10, background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)", padding: "2px 8px", borderRadius: 10 }}>
                                  #{idx + 1}
                                </span>
                              </div>
                            </div>
                            {/* Datos del huésped */}
                            <div style={{ padding: "10px 14px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{hx.nombre} {hx.apellido}</div>
                                  <div style={{ fontSize: 12, color: C.textSec, marginTop: 3, display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {hx.id      && <span>DNI: {hx.id}</span>}
                                    {hx.cochera && <span>🚗 Cochera {hx.cochera}</span>}
                                    {hx.patente && <span>Patente: {hx.patente}</span>}
                                    {hx.vehiculo&& <span>{hx.vehiculo}</span>}
                                  </div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                  {hx.horaIngreso && <div style={{ fontSize: 11, color: C.textSec }}>Hora estimada: {hx.horaIngreso}</div>}
                                  {regHx.horaIngresoReal && <div style={{ fontSize: 11, color: C.green }}>✓ Ingresó: {regHx.horaIngresoReal}</div>}
                                  {regHx.horaSalidaReal  && <div style={{ fontSize: 11, color: C.amber }}>↑ Salió: {regHx.horaSalidaReal}</div>}
                                </div>
                              </div>
                              {regHx.comentario && (
                                <div style={{ marginTop: 8, fontSize: 12, color: C.textSec, fontStyle: "italic", borderTop: `1px solid ${C.border}`, paddingTop: 7 }}>
                                  💬 {regHx.comentario}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
              )}
              <button onClick={() => setSelectedDepto(null)} style={{ ...S.btnSecondary, width: "100%", marginTop: 16 }}>Cerrar</button>
            </Modal>
          )
        }
        return <ModalDetalle />
      })()}

      {/* MODAL: agregar huésped */}
      {showAddH && (() => {
        const AddForm = () => {
          const [form, setForm] = useState({ id: "", nombre: "", apellido: "", depto: "", ingreso: "", salida: "", horaIngreso: "", cochera: "", patente: "", vehiculo: "" })
          const labels = { id: "ID / DNI", nombre: "Nombre", apellido: "Apellido", depto: "Departamento", ingreso: "Fecha ingreso", salida: "Fecha salida", horaIngreso: "Hora ingreso", cochera: "Cochera asignada", patente: "Patente", vehiculo: "Marca/Modelo" }
          return (
            <Modal title="Agregar huésped" onClose={() => setShowAddH(false)}>
              {["id","nombre","apellido","depto","ingreso","salida","horaIngreso","cochera","patente","vehiculo"].map(k => (
                <Field key={k} label={labels[k]}>
                  <input value={form[k]} onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
                    style={S.input} type={k === "ingreso" || k === "salida" ? "date" : k === "horaIngreso" ? "time" : "text"} />
                </Field>
              ))}
              <button onClick={() => { setH([...huespedes, { ...form, id: form.id || `h${Date.now()}` }]); setShowAddH(false) }}
                style={{ ...S.btnPrimary, width: "100%", marginTop: 8 }}>Guardar huésped</button>
            </Modal>
          )
        }
        return <AddForm />
      })()}

      {/* MODAL: importar CSV */}
      {showImportH && (
        <Modal title={showImportH === "replace" ? "Reemplazar huéspedes (CSV)" : "Agregar huéspedes (CSV)"} onClose={() => setShowImportH(false)}>
          <p style={{ fontSize: 13, color: C.textSec, marginTop: 0 }}>
            {showImportH === "replace" ? "⚠️ Esto reemplazará todos los huéspedes actuales." : "Los del CSV se sumarán a los existentes."}
          </p>
          <div style={{ background: C.bg, borderRadius: 8, padding: "10px 12px", fontSize: 12, color: C.textSec, marginBottom: 14 }}>
            <b>Columnas reconocidas automáticamente:</b><br />
            Nombre y Apellido · Depto · Fecha Ingreso · Fecha salida · ID · Hora ingreso · Usa Cochera · Patente · Marca o Modelo
          </div>
          <input type="file" accept=".csv" onChange={e => {
            const f = e.target.files[0]; if (!f) return
            const r = new FileReader(); r.onload = ev => { importHuespedes(ev.target.result, showImportH === "replace"); setShowImportH(false) }; r.readAsText(f)
          }} style={{ fontSize: 14, marginBottom: 12 }} />
          <button onClick={() => setShowImportH(false)} style={{ ...S.btnSecondary, width: "100%", marginTop: 8 }}>Cancelar</button>
        </Modal>
      )}
    </div>
  )
}
