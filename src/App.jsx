import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ── Constants ─────────────────────────────────────────────────────────────────
const ROOM_TYPES = ["Двойна", "Семейна", "Тройна", "Апартамент"];
const PALETTE    = ["#2563EB","#059669","#7C3AED","#DB2777","#0891B2","#D97706","#DC2626","#65A30D","#9333EA","#0284C7","#B45309","#15803D","#BE123C","#1D4ED8","#6D28D9"];
const STATUS_MAP = { confirmed: { bg:"#DCFCE7", color:"#166534", label:"Потвърдена" },
                     pending:   { bg:"#FEF9C3", color:"#854D0E", label:"Очаква депозит" },
                     cancelled: { bg:"#FEE2E2", color:"#991B1B", label:"Анулирана"  } };

const DEFAULT_USERS = [
  { id:"u1", name:"Администратор", username:"admin", password:"admin123", role:"admin" },
  { id:"u2", name:"Рецепция",      username:"staff", password:"staff123", role:"staff" },
];
const DEFAULT_ROOMS = [
  { id:"r1",  name:"Стая 101", type:"Двойна",     color:PALETTE[0]  },
  { id:"r2",  name:"Стая 102", type:"Двойна",     color:PALETTE[1]  },
  { id:"r3",  name:"Стая 103", type:"Двойна",     color:PALETTE[2]  },
  { id:"r4",  name:"Стая 201", type:"Двойна",     color:PALETTE[3]  },
  { id:"r5",  name:"Стая 202", type:"Двойна",     color:PALETTE[4]  },
  { id:"r6",  name:"Стая 203", type:"Семейна",    color:PALETTE[5]  },
  { id:"r7",  name:"Стая 204", type:"Тройна",     color:PALETTE[6]  },
  { id:"r8",  name:"Стая 205", type:"Двойна",     color:PALETTE[7]  },
  { id:"r9",  name:"Стая 301", type:"Апартамент", color:PALETTE[8]  },
  { id:"r10", name:"Стая 302", type:"Семейна",    color:PALETTE[9]  },
  { id:"r11", name:"Стая 303", type:"Двойна",     color:PALETTE[10] },
  { id:"r12", name:"Стая 304", type:"Тройна",     color:PALETTE[11] },
  { id:"r13", name:"Стая 305", type:"Двойна",     color:PALETTE[12] },
  { id:"r14", name:"Апарт. 1", type:"Апартамент", color:PALETTE[13] },
  { id:"r15", name:"Апарт. 2", type:"Апартамент", color:PALETTE[14] },
];
const DEFAULT_RATES = [
  { id:"sr1", name:"Лятно върхово натоварване", startDate:"2025-07-01", endDate:"2025-08-31", multiplier:1.4 },
  { id:"sr2", name:"Коледа и Нова година",       startDate:"2025-12-20", endDate:"2025-12-31", multiplier:1.6 },
  { id:"sr3", name:"Нисък сезон",                startDate:"2025-11-01", endDate:"2025-11-30", multiplier:0.8 },
];
const BG_MONTHS = ["Януари","Февруари","Март","Април","Май","Юни","Юли","Август","Септември","Октомври","Ноември","Декември"];

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2,"0"); }
function fmt(d) { return d instanceof Date?`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`:d; }
function addDays(d,n) { const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function nightsBetween(a,b) { return Math.round((new Date(b)-new Date(a))/86400000); }

// ── Supabase data operations ──────────────────────────────────────────────────
async function dbUpsert(table, record) {
  const { error } = await supabase.from(table).upsert(record);
  if (error) console.error(`Error upserting into ${table}:`, error);
  return !error;
}
async function dbDelete(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) console.error(`Error deleting from ${table}:`, error);
  return !error;
}
async function dbSelect(table) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) console.error(`Error selecting from ${table}:`, error);
  return data || [];
}

// ── Multi-select dropdown ─────────────────────────────────────────────────────
function MultiSelect({ label, options, selected, onChange }) {
  const [open,setOpen] = useState(false);
  const ref = useRef();
  useEffect(() => {
    function h(e){ if(ref.current&&!ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown",h); return ()=>document.removeEventListener("mousedown",h);
  },[]);
  const allSelected = selected.length===0;
  function toggle(id){ if(selected.includes(id)) onChange(selected.filter(x=>x!==id)); else onChange([...selected,id]); }
  return (
    <div ref={ref} style={{position:"relative",userSelect:"none"}}>
      <button onClick={()=>setOpen(o=>!o)} style={{
        display:"flex",alignItems:"center",gap:8,padding:"7px 12px",border:"1px solid #E2E8F0",
        borderRadius:8,background:"#fff",fontSize:13,fontWeight:500,color:"#1E293B",cursor:"pointer",
        whiteSpace:"nowrap",minWidth:170
      }}>
        <span style={{flex:1,textAlign:"left"}}>{label}: <strong>{allSelected?"Всички":`${selected.length} избрани`}</strong></span>
        <span style={{fontSize:10,color:"#94A3B8"}}>{open?"▲":"▼"}</span>
      </button>
      {open && (
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,zIndex:50,background:"#fff",
          border:"1px solid #E2E8F0",borderRadius:10,boxShadow:"0 8px 24px rgba(0,0,0,.12)",
          minWidth:210,maxHeight:300,overflowY:"auto"}}>
          <div onClick={()=>onChange([])} style={{padding:"9px 14px",fontSize:13,cursor:"pointer",
            fontWeight:allSelected?700:400,color:allSelected?"#D97706":"#1E293B",
            borderBottom:"1px solid #F1F5F9",background:allSelected?"#FFF7ED":"transparent"}}>
            Всички стаи
          </div>
          {options.map(o=>{
            const checked=selected.includes(o.id);
            return (
              <div key={o.id} onClick={()=>toggle(o.id)} style={{display:"flex",alignItems:"center",
                gap:10,padding:"8px 14px",fontSize:13,cursor:"pointer",
                background:checked?"#F0FDF4":"transparent",color:checked?"#166534":"#374151"}}>
                <span style={{width:14,height:14,borderRadius:3,
                  border:`2px solid ${checked?"#16A34A":"#CBD5E1"}`,
                  background:checked?"#16A34A":"transparent",display:"flex",
                  alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {checked&&<span style={{color:"#fff",fontSize:9,fontWeight:900}}>✓</span>}
                </span>
                <span style={{width:10,height:10,borderRadius:"50%",background:o.color,flexShrink:0}}/>
                {o.name}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [ready,    setReady]    = useState(false);
  const [user,     setUser]     = useState(()=>{ try{ const s=localStorage.getItem("hoteldesk_user"); return s?JSON.parse(s):null; }catch{ return null; } });
  const [users,    setUsers]    = useState([]);
  const [rooms,    setRooms]    = useState([]);
  const [bookings, setBookings] = useState([]);
  const [rates,    setRates]    = useState([]);
  const [view,     setView]     = useState("calendar");
  const [modal,    setModal]    = useState(null);
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calFilter,  setCalFilter]  = useState([]);
  const [bkgFilter,  setBkgFilter]  = useState([]);

  // Load all data from Supabase on mount
  useEffect(()=>{
    (async()=>{
      const [u, r, b, rt] = await Promise.all([
        dbSelect("users"),
        dbSelect("rooms"),
        dbSelect("bookings"),
        dbSelect("rates"),
      ]);
      // Seed defaults if tables are empty (first run)
      if (!u.length) {
        await Promise.all(DEFAULT_USERS.map(x => dbUpsert("users", x)));
        setUsers(DEFAULT_USERS);
      } else {
        setUsers(u);
      }
      if (!r.length) {
        await Promise.all(DEFAULT_ROOMS.map(x => dbUpsert("rooms", x)));
        setRooms(DEFAULT_ROOMS);
      } else {
        setRooms(r);
      }
      if (!rt.length) {
        await Promise.all(DEFAULT_RATES.map(x => dbUpsert("rates", x)));
        setRates(DEFAULT_RATES);
      } else {
        setRates(rt);
      }
      setBookings(b);
      setReady(true);
    })();
  },[]);


  // ── Data helpers ─────────────────────────────────────────────────────────────
  async function saveUser(u) {
    await dbUpsert("users", u);
    setUsers(prev => [...prev, u]);
  }
  async function removeUser(id) {
    await dbDelete("users", id);
    setUsers(prev => prev.filter(x => x.id !== id));
  }
  async function saveRoom(r) {
    await dbUpsert("rooms", r);
    setRooms(prev => prev.find(x=>x.id===r.id) ? prev.map(x=>x.id===r.id?r:x) : [...prev, r]);
  }
  async function removeRoom(id) {
    await dbDelete("rooms", id);
    setRooms(prev => prev.filter(x => x.id !== id));
  }
  async function saveBooking(b) {
    await dbUpsert("bookings", b);
    setBookings(prev => prev.find(x=>x.id===b.id) ? prev.map(x=>x.id===b.id?b:x) : [...prev, b]);
  }
  async function cancelBooking(b) {
    const updated = { ...b, status: "cancelled" };
    await dbUpsert("bookings", updated);
    setBookings(prev => prev.map(x => x.id === b.id ? updated : x));
  }
  async function removeBooking(id) {
    await dbDelete("bookings", id);
    setBookings(prev => prev.filter(x => x.id !== id));
  }
  async function saveRate(r) {
    await dbUpsert("rates", r);
    setRates(prev => prev.find(x=>x.id===r.id) ? prev.map(x=>x.id===r.id?r:x) : [...prev, r]);
  }
  async function removeRate(id) {
    await dbDelete("rates", id);
    setRates(prev => prev.filter(x => x.id !== id));
  }

  if(!ready) return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",gap:14,background:"#1E293B"}}><div style={{width:12,height:12,borderRadius:"50%",background:"#D97706"}}/><span style={{color:"#64748B",fontSize:14}}>Зареждане…</span></div>;
  if(!user) return <LoginScreen users={users} onLogin={u=>{ localStorage.setItem("hoteldesk_user",JSON.stringify(u)); setUser(u); }}/>;

  const today=fmt(new Date());
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const days=Array.from({length:daysInMonth},(_,i)=>i+1);
  const visCalRooms = calFilter.length===0?rooms:rooms.filter(r=>calFilter.includes(r.id));
  const visBkgList  = (() => { let b=[...bookings].sort((a,bb)=>a.checkIn<bb.checkIn?1:-1); if(bkgFilter.length) b=b.filter(x=>bkgFilter.includes(x.roomId)); return b; })();
  const occupied    = bookings.filter(b=>b.checkIn<=today&&b.checkOut>today&&b.status!=="cancelled").length;
  const monthCount  = bookings.filter(b=>{ const ms=`${calYear}-${pad(calMonth+1)}-01`,me=`${calYear}-${pad(calMonth+1)}-${pad(daysInMonth)}`; return b.checkIn<=me&&b.checkOut>ms&&b.status!=="cancelled"; }).length;
  const monthRev    = bookings.filter(b=>b.checkIn.startsWith(`${calYear}-${pad(calMonth+1)}`)&&b.status!=="cancelled").reduce((s,b)=>s+b.totalPrice,0);

  const navItems=[{id:"calendar",label:"Календар",icon:"📅"},{id:"bookings",label:"Резервации",icon:"📋"},{id:"rooms",label:"Стаи",icon:"🛏️"},{id:"rates",label:"Тарифи",icon:"💰"},...(user.role==="admin"?[{id:"staff",label:"Персонал",icon:"👥"}]:[])];

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'DM Sans',sans-serif",background:"#F8FAFC",overflow:"hidden"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:wght@300;400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}html,body,#root{width:100%;height:100%;}body{font-family:'DM Sans',sans-serif;}::-webkit-scrollbar{width:6px;height:6px;}::-webkit-scrollbar-thumb{background:#CBD5E1;border-radius:3px;}input,select,textarea{font-family:inherit;}.nbtn:hover{background:rgba(255,255,255,.08)!important;color:#E2E8F0!important;}.rowhov:hover td{background:#F8FAFC!important;}.tlc:hover{background:#EFF6FF!important;}`}</style>

      {/* SIDEBAR */}
      <aside style={{width:220,background:"#1E293B",display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"20px 16px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          <span style={{fontSize:26}}>🏨</span>
          <div><div style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#F1F5F9"}}>HotelDesk</div>
          <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:".08em",marginTop:2}}>Управление</div></div>
        </div>
        <nav style={{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:2}}>
          {navItems.map(item=>(
            <button key={item.id} className="nbtn" onClick={()=>setView(item.id)} style={{
              display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,border:"none",
              background:view===item.id?"rgba(217,119,6,.18)":"transparent",
              color:view===item.id?"#FBBF24":"#94A3B8",fontSize:13,fontWeight:500,cursor:"pointer",textAlign:"left",transition:"all .15s"
            }}><span>{item.icon}</span><span>{item.label}</span></button>
          ))}
        </nav>
        <div style={{padding:"12px 10px",borderTop:"1px solid rgba(255,255,255,.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"#334155",color:"#CBD5E1",fontWeight:700,fontSize:13,display:"flex",alignItems:"center",justifyContent:"center"}}>{user.name[0]}</div>
            <div><div style={{color:"#E2E8F0",fontSize:13,fontWeight:600}}>{user.name}</div><div style={{color:"#64748B",fontSize:11}}>{user.role==="admin"?"Администратор":"Служител"}</div></div>
          </div>
          <button onClick={()=>{ localStorage.removeItem("hoteldesk_user"); setUser(null); }} style={{width:"100%",background:"transparent",border:"1px solid #334155",borderRadius:7,color:"#64748B",fontSize:12,padding:"6px 0",cursor:"pointer"}}>Изход</button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <header style={{height:54,background:"#fff",borderBottom:"1px solid #E2E8F0",display:"flex",alignItems:"center",padding:"0 22px",gap:14,flexShrink:0}}>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:700,color:"#1E293B",flex:1}}>{navItems.find(n=>n.id===view)?.label}</h1>
          {(view==="calendar"||view==="bookings") && <button onClick={()=>setModal({type:"booking",data:{}})} style={S.primaryBtn}>+ Нова резервация</button>}
          {view==="rooms" && <button onClick={()=>setModal({type:"room",data:{}})} style={S.primaryBtn}>+ Добави стая</button>}
          {view==="rates" && <button onClick={()=>setModal({type:"rate",data:{}})} style={S.primaryBtn}>+ Добави тарифа</button>}
          {view==="staff"&&user.role==="admin" && <button onClick={()=>setModal({type:"staff",data:{}})} style={S.primaryBtn}>+ Добави служител</button>}
        </header>

        <div style={{flex:1,overflow:"auto",padding:"20px 22px"}}>

          {/* ══ CALENDAR ══════════════════════════════════════════════ */}
          {view==="calendar" && <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
              {[["Общо стаи",`${rooms.length}`,"в хотела"],["Заети днес",`${occupied}`,`от ${rooms.length} стаи`],["Резервации",`${monthCount}`,`за ${BG_MONTHS[calMonth]}`],["Приходи",`€${monthRev.toLocaleString()}`,"потвърдени"]].map(([l,v,s])=>(
                <div key={l} style={{background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:"1.2px",textTransform:"uppercase",color:"#94A3B8",marginBottom:6}}>{l}</div>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:26,color:"#1E293B"}}>{v}</div>
                  <div style={{fontSize:12,color:"#D97706",fontWeight:600,marginTop:4}}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
              <button onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}} style={S.navBtn}>‹</button>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,color:"#1E293B",minWidth:200,textAlign:"center"}}>{BG_MONTHS[calMonth]} {calYear}</span>
              <button onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}} style={S.navBtn}>›</button>
              <MultiSelect label="Стаи" options={rooms} selected={calFilter} onChange={setCalFilter}/>
              <button onClick={()=>{const t=new Date();setCalMonth(t.getMonth());setCalYear(t.getFullYear());}} style={{...S.navBtn,marginLeft:"auto"}}>Днес</button>
            </div>

            <div style={{overflowX:"auto",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,.06)",border:"1px solid #E2E8F0",background:"#fff"}}>
              <table style={{borderCollapse:"collapse",minWidth:"100%"}}>
                <thead>
                  <tr>
                    <th style={{background:"#1E293B",color:"#94A3B8",padding:"10px 14px",fontSize:12,fontWeight:600,textAlign:"left",whiteSpace:"nowrap",position:"sticky",left:0,zIndex:3,minWidth:130,borderRight:"1px solid #0f1a27"}}>Стая</th>
                    {days.map(d=>{
                      const ds=`${calYear}-${pad(calMonth+1)}-${pad(d)}`;
                      const isToday=ds===today;
                      const dow=new Date(ds).getDay();
                      const isWe=dow===0||dow===6;
                      return <th key={d} style={{background:isToday?"#D97706":isWe?"#243150":"#1E293B",color:isToday?"#fff":isWe?"#94A3B8":"#64748B",padding:"6px 2px",fontSize:10,fontWeight:700,textAlign:"center",minWidth:32,width:32,borderRight:"1px solid #0f1a27"}}>{d}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visCalRooms.map(room=>{
                    const rBkgs=bookings.filter(b=>b.roomId===room.id&&b.status!=="cancelled"&&b.checkOut>`${calYear}-${pad(calMonth+1)}-01`&&b.checkIn<=`${calYear}-${pad(calMonth+1)}-${pad(daysInMonth)}`);
                    return (
                      <tr key={room.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                        <td style={{background:"#F8FAFC",padding:"7px 14px",whiteSpace:"nowrap",position:"sticky",left:0,zIndex:2,borderRight:"1px solid #E2E8F0",verticalAlign:"middle"}}>
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <span style={{width:8,height:8,borderRadius:"50%",background:room.color,flexShrink:0}}/>
                            <div><div style={{fontWeight:700,fontSize:12,color:"#1E293B"}}>{room.name}</div><div style={{fontSize:10,color:"#94A3B8"}}>{room.type}</div></div>
                          </div>
                        </td>
                        {days.map(d=>{
                          const ds=`${calYear}-${pad(calMonth+1)}-${pad(d)}`;
                          const isToday=ds===today;
                          const cellBkgs=rBkgs.filter(b=>b.checkIn<=ds&&b.checkOut>ds);
                          const hasBooking=cellBkgs.length>0;
                          const isStart=b=>b.checkIn===ds||(b.checkIn<`${calYear}-${pad(calMonth+1)}-01`&&d===1);
                          const starters=cellBkgs.filter(b=>isStart(b));
                          return (
                            <td key={d} className="tlc" style={{background:isToday&&!hasBooking?"#FFFBEB":"transparent",borderRight:"1px solid #F1F5F9",height:36,padding:"2px 1px",verticalAlign:"middle",cursor:"pointer",transition:"background .1s",position:"relative"}}
                              onClick={()=>{ if(cellBkgs.length) setModal({type:"viewBooking",data:cellBkgs[0]}); else setModal({type:"booking",data:{roomId:room.id,checkIn:ds}}); }}
                              title={cellBkgs.length?cellBkgs.map(b=>b.guestName).join(", "):"Натиснете за резервация"}>
                              {hasBooking && (
                                <div style={{position:"absolute",inset:"3px 0px",background:starters.length?room.color:room.color+"99",borderRadius:starters.length?"4px 0 0 4px":"0",display:"flex",alignItems:"center",overflow:"hidden"}}>
                                  {starters.map(b=><span key={b.id} style={{color:"#fff",fontSize:10,fontWeight:700,padding:"0 5px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{b.guestName}</span>)}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                  {visCalRooms.length===0&&<tr><td colSpan={daysInMonth+1} style={{textAlign:"center",padding:32,color:"#94A3B8",fontSize:14}}>Няма избрани стаи</td></tr>}
                </tbody>
              </table>
            </div>
            <p style={{marginTop:10,fontSize:12,color:"#94A3B8",textAlign:"center"}}>Натиснете клетка за нова резервация · Натиснете резервация за преглед</p>
          </>}

          {/* ══ BOOKINGS ══════════════════════════════════════════════ */}
          {view==="bookings" && <>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
              <span style={{fontSize:14,color:"#64748B"}}>{visBkgList.length} резервации</span>
              <MultiSelect label="Стаи" options={rooms} selected={bkgFilter} onChange={setBkgFilter}/>
            </div>
            <div style={{background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
              {visBkgList.length===0
                ? <div style={{textAlign:"center",padding:52,color:"#CBD5E1",fontSize:15}}>Няма резервации</div>
                : <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead><tr>{["Гост","Стая","Настаняване","Напускане","Нощ.","Депозит","Статус",""].map(h=>(
                      <th key={h} style={{textAlign:"left",padding:"10px 14px",background:"#F8FAFC",color:"#94A3B8",fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",borderBottom:"1px solid #E2E8F0"}}>{h}</th>
                    ))}</tr></thead>
                    <tbody>
                      {visBkgList.map(b=>{
                        const room=rooms.find(r=>r.id===b.roomId);
                        const st=STATUS_MAP[b.status]||STATUS_MAP.confirmed;
                        return (
                          <tr key={b.id} className="rowhov" style={{borderBottom:"1px solid #F1F5F9"}}>
                            <td style={{padding:"12px 14px",fontWeight:600,color:"#1E293B"}}>{b.guestName}</td>
                            <td style={{padding:"12px 14px"}}><div style={{fontWeight:600,color:"#1E293B"}}>{room?.name||"—"}</div><div style={{fontSize:11,color:"#94A3B8"}}>{room?.type||""}</div></td>
                            <td style={{padding:"12px 14px",color:"#374151"}}>{b.checkIn}</td>
                            <td style={{padding:"12px 14px",color:"#374151"}}>{b.checkOut}</td>
                            <td style={{padding:"12px 14px",color:"#374151"}}>{nightsBetween(b.checkIn,b.checkOut)}</td>
                            <td style={{padding:"12px 14px"}}>{b.depositReceived?<span style={{color:"#166534",fontWeight:600}}>€{b.depositAmount}</span>:<span style={{color:"#94A3B8"}}>—</span>}</td>
                            <td style={{padding:"12px 14px"}}><span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:999,background:st.bg,color:st.color}}>{st.label}</span></td>
                            <td style={{padding:"12px 14px"}}><button onClick={()=>setModal({type:"viewBooking",data:b})} style={S.outlineBtn}>Преглед</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
              }
            </div>
          </>}

          {/* ══ ROOMS ═════════════════════════════════════════════════ */}
          {view==="rooms" && (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:16}}>
              {rooms.map(room=>(
                <div key={room.id} style={{background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.04)",display:"flex",flexDirection:"column"}}>
                  <div style={{height:5,background:room.color}}/>
                  <div style={{padding:"16px",flex:1}}>
                    <div style={{fontFamily:"'Playfair Display',serif",fontWeight:700,fontSize:15,color:"#1E293B"}}>{room.name}</div>
                    <div style={{fontSize:11,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".06em",margin:"3px 0 10px"}}>{room.type}</div>
                  </div>
                  <div style={{padding:"12px 16px",borderTop:"1px solid #F1F5F9",display:"flex",gap:8}}>
                    <button onClick={()=>setModal({type:"room",data:{...room}})} style={S.outlineBtn}>Редактирай</button>
                    {user.role==="admin"&&<button onClick={()=>{if(confirm("Изтриете тази стая?")) removeRoom(room.id);}} style={S.dangerBtn}>Изтрий</button>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ══ RATES ═════════════════════════════════════════════════ */}
          {view==="rates" && (
            <div style={{maxWidth:640,background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
              <div style={{padding:"16px 20px",borderBottom:"1px solid #F1F5F9",fontFamily:"'Playfair Display',serif",fontSize:16,fontWeight:700,color:"#1E293B"}}>Сезонни тарифи</div>
              <div style={{padding:"8px 20px 16px"}}>
                <p style={{fontSize:13,color:"#64748B",margin:"8px 0 16px"}}>Коефициентите умножават основната цена. 1.4 означава +40%.</p>
                {rates.length===0&&<div style={{textAlign:"center",padding:32,color:"#CBD5E1"}}>Няма добавени тарифи</div>}
                {rates.map(rate=>(
                  <div key={rate.id} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 0",borderBottom:"1px solid #F8FAFC"}}>
                    <div style={{padding:"5px 13px",borderRadius:20,background:"#FFF7ED",color:"#B45309",fontWeight:700,fontSize:13,flexShrink:0}}>×{rate.multiplier}</div>
                    <div style={{flex:1}}><div style={{fontWeight:600,fontSize:14,color:"#1E293B"}}>{rate.name}</div><div style={{fontSize:12,color:"#94A3B8"}}>{rate.startDate} → {rate.endDate}</div></div>
                    <button onClick={()=>setModal({type:"rate",data:{...rate}})} style={S.outlineBtn}>Редактирай</button>
                    <button onClick={()=>removeRate(rate.id)} style={S.dangerBtn}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ══ STAFF ════════════════════════════════════════════════ */}
          {view==="staff"&&user.role==="admin" && (
            <div style={{maxWidth:600,background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                <thead><tr>{["Иmе","Потребителско иmе","Роля",""].map(h=><th key={h} style={{textAlign:"left",padding:"10px 14px",background:"#F8FAFC",color:"#94A3B8",fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",borderBottom:"1px solid #E2E8F0"}}>{h}</th>)}</tr></thead>
                <tbody>{users.map(u=>(
                  <tr key={u.id} className="rowhov" style={{borderBottom:"1px solid #F1F5F9"}}>
                    <td style={{padding:"12px 14px",fontWeight:600,color:"#1E293B"}}>{u.name}</td>
                    <td style={{padding:"12px 14px",color:"#374151"}}>{u.username}</td>
                    <td style={{padding:"12px 14px"}}><span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:999,background:u.role==="admin"?"#DCFCE7":"#F1F5F9",color:u.role==="admin"?"#166534":"#475569"}}>{u.role==="admin"?"Администратор":"Служител"}</span></td>
                    <td style={{padding:"12px 14px"}}>{u.id!==user.id&&<button onClick={()=>{if(confirm("Премахнете служителя?")) removeUser(u.id);}} style={S.dangerBtn}>Премахни</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16}}
          onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          {modal.type==="booking"&&<BookingModal rooms={rooms} bookings={bookings} initial={modal.data} user={user} onSave={b=>{saveBooking(b);setModal(null);}} onClose={()=>setModal(null)}/>}
          {modal.type==="viewBooking"&&<ViewBookingModal booking={modal.data} rooms={rooms} user={user} onEdit={()=>setModal({type:"booking",data:modal.data})} onCancel={b=>{cancelBooking(b);setModal(null);}} onDelete={b=>{removeBooking(b.id);setModal(null);}} onClose={()=>setModal(null)}/>}
          {modal.type==="room"&&<RoomModal initial={modal.data} rooms={rooms} onSave={r=>{saveRoom(r);setModal(null);}} onClose={()=>setModal(null)}/>}
          {modal.type==="rate"&&<RateModal initial={modal.data} onSave={r=>{saveRate(r);setModal(null);}} onClose={()=>setModal(null)}/>}
          {modal.type==="staff"&&<StaffModal users={users} onSave={u=>{saveUser(u);setModal(null);}} onClose={()=>setModal(null)}/>}
        </div>
      )}
    </div>
  );
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function LoginScreen({users,onLogin}) {
  const [form,setForm]=useState({username:"",password:""});
  const [err,setErr]=useState("");
  function doLogin(){ const u=users.find(u=>u.username===form.username&&u.password===form.password); if(u) onLogin(u); else setErr("Грешно потребителско иmе или парола."); }
  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;600&display=swap');*{box-sizing:border-box;margin:0;padding:0;}html,body,#root{width:100%;height:100%;}`}</style>
      <div style={{background:"#fff",borderRadius:20,padding:"38px 34px",width:"100%",maxWidth:370,boxShadow:"0 30px 80px rgba(0,0,0,.4)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:44,marginBottom:8}}>🏨</div>
          <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:"#1E293B"}}>HotelDesk</h1>
          <p style={{fontSize:12,color:"#94A3B8",marginTop:4,letterSpacing:".06em",textTransform:"uppercase"}}>Портал за персонал</p>
        </div>
        {err&&<div style={{background:"#FEE2E2",color:"#991B1B",fontSize:13,padding:"10px 12px",borderRadius:8,marginBottom:14}}>{err}</div>}
        {[["Потребителско иmе","username","text"],["Парола","password","password"]].map(([label,key,type])=>(
          <div key={key} style={{marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:600,color:"#475569",marginBottom:5}}>{label}</div>
            <input type={type} value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&doLogin()} style={{width:"100%",border:"1px solid #E2E8F0",borderRadius:8,padding:"9px 12px",fontSize:14,outline:"none",background:"#FAFAFA",color:"#1E293B"}}/>
          </div>
        ))}
        <button onClick={doLogin} style={{...S.primaryBtn,width:"100%",padding:"11px"}}>Вход →</button>
        <p style={{textAlign:"center",fontSize:11,color:"#CBD5E1",marginTop:14}}>admin/admin123 · staff/staff123</p>
      </div>
    </div>
  );
}

// ── BOOKING MODAL ─────────────────────────────────────────────────────────────
const SOURCES = ["Booking.com","По телефона","WhatsApp","Поща","Друг"];
function BookingModal({rooms,bookings,initial,user,onSave,onClose}) {
  const isEdit=!!initial.id;
  const todayStr=fmt(new Date());
  const [f,setF]=useState({
    id:           initial.id||`b${Date.now()}`,
    guestName:    initial.guestName||"",
    phone:        initial.phone||"",
    email:        initial.email||"",
    bookingDate:  initial.bookingDate||todayStr,
    source:       initial.source||SOURCES[0],
    roomId:       initial.roomId||rooms[0]?.id||"",
    checkIn:      initial.checkIn||"",
    checkOut:     initial.checkOut||"",
    pricePerNight:initial.pricePerNight||"",
    status:       initial.status||"confirmed",
    depositReceived: initial.depositReceived||false,
    depositAmount:   initial.depositAmount||"",
    depositDate:     initial.depositDate||"",
    fullyPaid:    initial.fullyPaid||false,
    notes:        initial.notes||"",
    createdBy:    initial.createdBy||user.name,
  });
  const [err,setErr]=useState("");
  const nights   = f.checkIn&&f.checkOut&&f.checkOut>f.checkIn ? nightsBetween(f.checkIn,f.checkOut) : 0;
  const total    = nights>0&&f.pricePerNight ? Math.round(nights*Number(f.pricePerNight)) : 0;
  const deposit  = f.depositReceived&&f.depositAmount ? Number(f.depositAmount) : 0;
  const remaining= f.fullyPaid ? 0 : Math.max(0, total - deposit);

  function save(){
    if(!f.guestName.trim()) return setErr("Въведете иmе на госта.");
    if(!f.checkIn||!f.checkOut) return setErr("Задайте дати на настаняване и напускане.");
    if(f.checkOut<=f.checkIn) return setErr("Датата на напускане трябва да е след настаняването.");
    if(!f.pricePerNight||Number(f.pricePerNight)<=0) return setErr("Въведете цена на нощ.");
    const conflict=bookings.find(b=>b.id!==f.id&&b.roomId===f.roomId&&b.status!=="cancelled"&&b.checkIn<f.checkOut&&b.checkOut>f.checkIn);
    if(conflict) return setErr(`Стаята е вече резервирана (${conflict.guestName}).`);
    onSave({...f, pricePerNight:Number(f.pricePerNight), totalPrice:total, depositAmount:f.depositReceived?Number(f.depositAmount):0, remaining });
  }

  return (
    <div style={S.modal}>
      <div style={S.modalHeader}><span style={S.modalTitle}>{isEdit?"Редактирай резервация":"Нова резервация"}</span><button onClick={onClose} style={S.closeBtn}>×</button></div>
      <div style={{padding:"18px 20px",overflowY:"auto",maxHeight:"calc(90vh - 130px)"}}>

        {/* Guest info */}
        <Fld label="Иmе на госта"><input value={f.guestName} onChange={e=>setF(x=>({...x,guestName:e.target.value}))} style={S.input} placeholder="Пълно иmе"/></Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Телефон"><input value={f.phone} onChange={e=>setF(x=>({...x,phone:e.target.value}))} style={S.input} placeholder="+359…"/></Fld>
          <Fld label="Имейл"><input type="email" value={f.email} onChange={e=>setF(x=>({...x,email:e.target.value}))} style={S.input} placeholder="guest@email.com"/></Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Дата на резервацията"><input type="date" value={f.bookingDate} onChange={e=>setF(x=>({...x,bookingDate:e.target.value}))} style={S.input}/></Fld>
          <Fld label="Източник"><select value={f.source} onChange={e=>setF(x=>({...x,source:e.target.value}))} style={S.input}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select></Fld>
        </div>

        {/* Room & dates */}
        <Fld label="Стая"><select value={f.roomId} onChange={e=>setF(x=>({...x,roomId:e.target.value}))} style={S.input}>{rooms.map(r=><option key={r.id} value={r.id}>{r.name} — {r.type}</option>)}</select></Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Настаняване"><input type="date" value={f.checkIn} onChange={e=>setF(x=>({...x,checkIn:e.target.value}))} style={S.input}/></Fld>
          <Fld label="Напускане">  <input type="date" value={f.checkOut} onChange={e=>setF(x=>({...x,checkOut:e.target.value}))} style={S.input}/></Fld>
        </div>
        <Fld label="Цена на нощ (€)"><input type="number" min="1" value={f.pricePerNight} onChange={e=>setF(x=>({...x,pricePerNight:e.target.value}))} style={S.input} placeholder="напр. 90"/></Fld>

        {/* Live totals summary */}
        {nights>0&&Number(f.pricePerNight)>0&&(
          <div style={{background:"#EFF6FF",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #BFDBFE"}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#1D4ED8",marginBottom:4}}>
              <span>{nights} нощ{nights!==1?"увки":"увка"} × €{f.pricePerNight}</span>
              <span style={{fontWeight:700}}>Общо: €{total}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#059669"}}>
              <span>Депозит</span><span style={{fontWeight:700}}>€{deposit}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,marginTop:6,paddingTop:6,borderTop:"1px solid #BFDBFE",color:remaining===0?"#166534":"#DC2626"}}>
              <span>Остава за плащане</span><span>€{remaining}</span>
            </div>
          </div>
        )}

        <Fld label="Статус"><select value={f.status} onChange={e=>setF(x=>({...x,status:e.target.value}))} style={S.input}>
          <option value="confirmed">Потвърдена</option>
          <option value="pending">Очаква депозит</option>
          <option value="cancelled">Анулирана</option>
        </select></Fld>

        {/* Payment */}
        <div style={{background:"#F8FAFC",borderRadius:10,padding:"14px",marginBottom:14,border:"1px solid #E2E8F0"}}>
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:8}}>
            <input type="checkbox" checked={f.fullyPaid} onChange={e=>setF(x=>({...x,fullyPaid:e.target.checked,depositReceived:e.target.checked?x.depositReceived:x.depositReceived}))} style={{width:16,height:16,accentColor:"#059669"}}/>
            <span style={{fontWeight:600,fontSize:13,color:"#1E293B"}}>Изцяло платена</span>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:f.depositReceived?14:0}}>
            <input type="checkbox" checked={f.depositReceived} onChange={e=>setF(x=>({...x,depositReceived:e.target.checked}))} style={{width:16,height:16,accentColor:"#D97706"}}/>
            <span style={{fontWeight:600,fontSize:13,color:"#1E293B"}}>Получен депозит</span>
          </label>
          {f.depositReceived&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <Fld label="Сума (€)"><input type="number" min="0" value={f.depositAmount} onChange={e=>setF(x=>({...x,depositAmount:e.target.value}))} style={S.input} placeholder="0"/></Fld>
              <Fld label="Дата на депозита"><input type="date" value={f.depositDate} onChange={e=>setF(x=>({...x,depositDate:e.target.value}))} style={S.input}/></Fld>
            </div>
          )}
        </div>

        {/* Remaining amount — always visible once total is known */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderRadius:10,marginBottom:14,border:`2px solid ${remaining===0?"#BBF7D0":"#FECACA"}`,background:remaining===0?"#F0FDF4":"#FFF5F5"}}>
          <span style={{fontWeight:700,fontSize:14,color:remaining===0?"#166534":"#991B1B"}}>Остава за плащане</span>
          <span style={{fontWeight:800,fontSize:18,color:remaining===0?"#166534":"#DC2626"}}>€{remaining}</span>
        </div>

        <Fld label="Забележки"><input value={f.notes} onChange={e=>setF(x=>({...x,notes:e.target.value}))} style={S.input} placeholder="По желание…"/></Fld>
        <div style={{fontSize:12,color:"#94A3B8",marginTop:4}}>Добавена от: <strong style={{color:"#475569"}}>{f.createdBy}</strong></div>
        {err&&<div style={{color:"#DC2626",fontSize:13,marginTop:10}}>{err}</div>}
      </div>
      <div style={{padding:"14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={S.outlineBtn}>Откажи</button>
        <button onClick={save} style={S.primaryBtn}>{isEdit?"Запази промените":"Създай резервация"}</button>
      </div>
    </div>
  );
}

// ── VIEW BOOKING MODAL ────────────────────────────────────────────────────────
function ViewBookingModal({booking:b,rooms,user,onEdit,onCancel,onDelete,onClose}) {
  const room=rooms.find(r=>r.id===b.roomId);
  const nights=nightsBetween(b.checkIn,b.checkOut);
  const st=STATUS_MAP[b.status]||STATUS_MAP.confirmed;
  const remaining=b.fullyPaid?0:Math.max(0,(b.totalPrice||0)-(b.depositReceived?b.depositAmount||0:0));
  const rows=[
    ["Гост",           b.guestName],
    ["Телефон",        b.phone||"—"],
    ["Имейл",          b.email||"—"],
    ["Дата на резервацията", b.bookingDate||"—"],
    ["Източник",       b.source||"—"],
    ["Стая",           room?.name||"—"],
    ["Тип",            room?.type||"—"],
    ["Настаняване",    b.checkIn],
    ["Напускане",      b.checkOut],
    ["Нощувки",        nights],
    ["Цена/нощ",       b.pricePerNight?`€${b.pricePerNight}`:"—"],
    ["Обща сума",      `€${b.totalPrice||0}`],
    ["Депозит",        b.depositReceived?`€${b.depositAmount} (${b.depositDate})`:"Не е получен"],
    ["Изцяло платена", b.fullyPaid?<span style={{color:"#166534",fontWeight:700}}>✓ Да</span>:<span style={{color:"#94A3B8"}}>Не</span>],
    ["Остава за плащане", <span style={{fontWeight:700,color:remaining===0?"#166534":"#DC2626"}}>€{remaining}</span>],
    ["Статус",         <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:999,background:st.bg,color:st.color}}>{st.label}</span>],
    ["Забележки",      b.notes||"—"],
    ["Добавена от",    b.createdBy||"—"],
  ];
  return (
    <div style={S.modal}>
      <div style={S.modalHeader}><span style={S.modalTitle}>Детайли за резервацията</span><button onClick={onClose} style={S.closeBtn}>×</button></div>
      <div style={{padding:"18px 20px",overflowY:"auto",maxHeight:"calc(90vh - 130px)"}}>
        {rows.map(([label,val])=>(
          <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #F1F5F9",fontSize:14}}>
            <span style={{color:"#64748B",fontSize:12,fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase"}}>{label}</span>
            <span style={{fontWeight:600,color:"#1E293B",maxWidth:220,textAlign:"right"}}>{val}</span>
          </div>
        ))}
      </div>
      <div style={{padding:"14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        {b.status!=="cancelled"&&<button onClick={()=>onCancel(b)} style={S.outlineBtn}>Анулирай</button>}
        {user.role==="admin"&&<button onClick={()=>onDelete(b)} style={S.dangerBtn}>Изтрий</button>}
        <button onClick={onEdit} style={S.primaryBtn}>Редактирай</button>
      </div>
    </div>
  );
}

// ── ROOM MODAL ────────────────────────────────────────────────────────────────
function RoomModal({initial,rooms,onSave,onClose}) {
  const isEdit=!!initial.id;
  const [f,setF]=useState({id:initial.id||`r${Date.now()}`,name:initial.name||"",type:initial.type||ROOM_TYPES[0],color:initial.color||PALETTE[rooms.length%PALETTE.length]});
  const [err,setErr]=useState("");
  function save(){ if(!f.name.trim()) return setErr("Въведете иmе на стаята."); onSave(f); }
  return (
    <div style={S.modal}>
      <div style={S.modalHeader}><span style={S.modalTitle}>{isEdit?"Редактирай стая":"Добави стая"}</span><button onClick={onClose} style={S.closeBtn}>×</button></div>
      <div style={{padding:"18px 20px"}}>
        <Fld label="Иmе / Номер"><input value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))} style={S.input} placeholder="напр. Стая 205"/></Fld>
        <Fld label="Тип"><select value={f.type} onChange={e=>setF(x=>({...x,type:e.target.value}))} style={S.input}>{ROOM_TYPES.map(t=><option key={t}>{t}</option>)}</select></Fld>
        <Fld label="Цвят"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{PALETTE.map(c=><div key={c} onClick={()=>setF(x=>({...x,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:f.color===c?"3px solid #1E293B":"3px solid transparent",transition:"border .1s"}}/>)}</div></Fld>
        {err&&<div style={{color:"#DC2626",fontSize:13,marginTop:4}}>{err}</div>}
      </div>
      <div style={{padding:"14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={S.outlineBtn}>Откажи</button>
        <button onClick={save} style={S.primaryBtn}>{isEdit?"Запази":"Добави стая"}</button>
      </div>
    </div>
  );
}

// ── RATE MODAL ────────────────────────────────────────────────────────────────
function RateModal({initial,onSave,onClose}) {
  const isEdit=!!initial.id;
  const [f,setF]=useState({id:initial.id||`sr${Date.now()}`,name:initial.name||"",startDate:initial.startDate||"",endDate:initial.endDate||"",multiplier:initial.multiplier||1.2});
  const [err,setErr]=useState("");
  function save(){ if(!f.name.trim()) return setErr("Въведете иmе."); if(!f.startDate||!f.endDate) return setErr("Задайте дати."); if(f.endDate<f.startDate) return setErr("Крайната дата трябва да е след началната."); onSave({...f,multiplier:Number(f.multiplier)}); }
  return (
    <div style={S.modal}>
      <div style={S.modalHeader}><span style={S.modalTitle}>{isEdit?"Редактирай тарифа":"Добави тарифа"}</span><button onClick={onClose} style={S.closeBtn}>×</button></div>
      <div style={{padding:"18px 20px"}}>
        <Fld label="Наименование"><input value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))} style={S.input} placeholder="напр. Летен сезон"/></Fld>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <Fld label="Начална дата"><input type="date" value={f.startDate} onChange={e=>setF(x=>({...x,startDate:e.target.value}))} style={S.input}/></Fld>
          <Fld label="Крайна дата"> <input type="date" value={f.endDate}   onChange={e=>setF(x=>({...x,endDate:e.target.value}))} style={S.input}/></Fld>
        </div>
        <Fld label="Коефициент (1.5 = +50%)"><input type="number" step="0.05" min="0.1" max="5" value={f.multiplier} onChange={e=>setF(x=>({...x,multiplier:e.target.value}))} style={S.input}/></Fld>
        {f.multiplier&&<p style={{fontSize:12,color:"#64748B",marginBottom:8}}>→ Стая за €100/нощ ще струва <strong>€{Math.round(Number(f.multiplier)*100)}/нощ</strong> в този период.</p>}
        {err&&<div style={{color:"#DC2626",fontSize:13}}>{err}</div>}
      </div>
      <div style={{padding:"14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={S.outlineBtn}>Откажи</button>
        <button onClick={save} style={S.primaryBtn}>{isEdit?"Запази":"Добави тарифа"}</button>
      </div>
    </div>
  );
}

// ── STAFF MODAL ───────────────────────────────────────────────────────────────
function StaffModal({users,onSave,onClose}) {
  const [f,setF]=useState({id:`u${Date.now()}`,name:"",username:"",password:"",role:"staff"});
  const [err,setErr]=useState("");
  function save(){ if(!f.name.trim()||!f.username.trim()||!f.password.trim()) return setErr("Всички полета са задължителни."); if(users.find(u=>u.username===f.username)) return setErr("Потребителското иmе вече е заето."); onSave(f); }
  return (
    <div style={S.modal}>
      <div style={S.modalHeader}><span style={S.modalTitle}>Добави служител</span><button onClick={onClose} style={S.closeBtn}>×</button></div>
      <div style={{padding:"18px 20px"}}>
        <Fld label="Пълно иmе">        <input value={f.name}     onChange={e=>setF(x=>({...x,name:e.target.value}))}     style={S.input} placeholder="напр. Мария Иванова"/></Fld>
        <Fld label="Потребителско иmе"><input value={f.username} onChange={e=>setF(x=>({...x,username:e.target.value}))} style={S.input}/></Fld>
        <Fld label="Парола">           <input type="password" value={f.password} onChange={e=>setF(x=>({...x,password:e.target.value}))} style={S.input}/></Fld>
        <Fld label="Роля"><select value={f.role} onChange={e=>setF(x=>({...x,role:e.target.value}))} style={S.input}><option value="staff">Служител</option><option value="admin">Администратор</option></select></Fld>
        {err&&<div style={{color:"#DC2626",fontSize:13}}>{err}</div>}
      </div>
      <div style={{padding:"14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={S.outlineBtn}>Откажи</button>
        <button onClick={save} style={S.primaryBtn}>Добави служител</button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Fld({label,children}) {
  return <div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:600,color:"#475569",marginBottom:5,letterSpacing:".03em"}}>{label}</div>{children}</div>;
}

const S={
  primaryBtn:{background:"#D97706",color:"#fff",border:"none",borderRadius:9,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap"},
  outlineBtn:{background:"transparent",color:"#1E293B",border:"1px solid #CBD5E1",borderRadius:9,padding:"7px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap"},
  dangerBtn: {background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:9,padding:"7px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",whiteSpace:"nowrap"},
  navBtn:    {background:"#F1F5F9",border:"none",borderRadius:8,padding:"7px 14px",fontSize:16,cursor:"pointer",color:"#475569"},
  input:     {width:"100%",border:"1px solid #E2E8F0",borderRadius:8,padding:"8px 11px",fontSize:14,fontFamily:"'DM Sans',sans-serif",outline:"none",background:"#FAFAFA",color:"#1E293B"},
  modal:     {background:"#fff",borderRadius:16,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.25)",maxHeight:"92vh",display:"flex",flexDirection:"column"},
  modalHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid #E2E8F0"},
  modalTitle:{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700,color:"#1E293B"},
  closeBtn:  {background:"transparent",border:"none",fontSize:20,cursor:"pointer",color:"#94A3B8",padding:"4px 8px",borderRadius:6},
};
