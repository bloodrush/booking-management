import { useState, useEffect, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import "./App.css";

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

const BG_MONTHS = ["Януари","Февруари","Март","Април","Май","Юни","Юли","Август","Септември","Октомври","Ноември","Декември"];
const GUEST_STATUS = {
  regular:     { label:"Редовен",      bg:"#EFF6FF", color:"#1D4ED8" },
  vip:         { label:"VIP",          bg:"#FEF9C3", color:"#854D0E" },
  problematic: { label:"Проблемен",    bg:"#FEE2E2", color:"#991B1B" },
  blacklisted: { label:"Черен списък", bg:"#1E293B", color:"#F8FAFC" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2,"0"); }
function fmt(d) { return d instanceof Date?`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`:d; }
function addDays(d,n) { const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function nightsBetween(a,b) { return Math.round((new Date(b)-new Date(a))/86400000); }

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportBookingsToCSV(bookings, rooms) {
  const headers = [
    "ID", "Гост", "Телефон", "Имейл", "Националност",
    "Стая", "Тип стая", "Настаняване", "Напускане", "Нощувки",
    "Цена/нощ (€)", "Обща сума (€)", "Депозит получен", "Сума депозит (€)",
    "Дата депозит", "Изцяло платена", "Остава (€)", "Статус",
    "Дата резервация", "Източник", "Добавена от", "Забележки"
  ];

  const rows = bookings.map(b => {
    const room = rooms.find(r => r.id === b.roomId);
    const nights = b.checkIn && b.checkOut ? nightsBetween(b.checkIn, b.checkOut) : 0;
    const remaining = b.fullyPaid ? 0 : Math.max(0, (b.totalPrice || 0) - (b.depositReceived ? b.depositAmount || 0 : 0));
    return [
      b.id,
      b.guestName,
      b.phone || "",
      b.email || "",
      b.nationality || "",
      room?.name || "",
      room?.type || "",
      b.checkIn,
      b.checkOut,
      nights,
      b.pricePerNight || "",
      b.totalPrice || 0,
      b.depositReceived ? "Да" : "Не",
      b.depositReceived ? b.depositAmount || 0 : "",
      b.depositDate || "",
      b.fullyPaid ? "Да" : "Не",
      remaining,
      STATUS_MAP[b.status]?.label || b.status,
      b.bookingDate || "",
      b.source || "",
      b.createdBy || "",
      b.notes || "",
    ];
  });

  const escape = val => {
    const s = String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"` 
      : s;
  };

  const csvContent = [
    headers.map(escape).join(","),
    ...rows.map(row => row.map(escape).join(","))
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `резервации_${fmt(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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

// ── Toast component ───────────────────────────────────────────────────────────
function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position:"fixed", top:16, right:16, left:16, zIndex:9999, display:"flex", flexDirection:"column", gap:8, pointerEvents:"none", maxWidth:400, marginLeft:"auto" }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === "error" ? "#FEE2E2" : "#DCFCE7",
          color:      t.type === "error" ? "#991B1B" : "#166534",
          border:     `1px solid ${t.type === "error" ? "#FECACA" : "#BBF7D0"}`,
          borderRadius: 10,
          padding: "11px 18px",
          fontSize: 13,
          fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,.12)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          animation: "toastIn .2s ease",
          fontFamily: "'Inter', sans-serif",
        }}>
          <span>{t.type === "error" ? "✕" : "✓"}</span>
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ── Nationality list ──────────────────────────────────────────────────────────
const NATIONALITIES = [
  "Австрия","Австралия","Азербайджан","Албания","Алжир","Аржентина","Армения",
  "Беларус","Белгия","Босна и Херцеговина","Бразилия","България",
  "Великобритания","Венецуела","Виетнам","Гватемала","Германия","Гърция",
  "Дания","Египет","Естония","Израел","Индия","Индонезия","Ирак","Иран","Ирландия",
  "Испания","Италия","Йордания","Казахстан","Канада","Катар","Китай","Кипър",
  "Колумбия","Косово","Латвия","Ливан","Литва","Люксембург","Македония",
  "Малайзия","Малта","Мароко","Мексико","Молдова","Монтенегро",
  "Нидерландия","Норвегия","ОАЕ","Пакистан","Полша","Португалия","Румъния",
  "Русия","САЩ","Саудитска Арабия","Сингапур","Словакия","Словения","Сърбия",
  "Тайланд","Тунис","Турция","Украйна","Унгария","Филипини","Финландия",
  "Франция","Хърватия","Черна гора","Чехия","Чили","Швейцария","Швеция",
  "Япония","Друго",
];

// ── NationalitySelect ─────────────────────────────────────────────────────────
function NationalitySelect({ value, onChange, inputStyle }) {
  const [query, setQuery]   = useState(value || "");
  const [open,  setOpen]    = useState(false);
  const ref = useRef();

  useEffect(() => { setQuery(value || ""); }, [value]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = NATIONALITIES.filter(n =>
    n.toLowerCase().includes(query.toLowerCase())
  );

  function select(nation) {
    setQuery(nation);
    onChange(nation);
    setOpen(false);
  }

  function handleInput(e) {
    setQuery(e.target.value);
    onChange(e.target.value);
    setOpen(true);
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        style={{ ...inputStyle, paddingRight: 28 }}
        placeholder="Търси или въведи националност…"
        autoComplete="off"
      />
      <span style={{
        position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
        fontSize:10, color:"#94A3B8", pointerEvents:"none"
      }}>{open ? "▲" : "▼"}</span>

      {open && filtered.length > 0 && (
        <div style={{
          position:"absolute", top:"calc(100% + 3px)", left:0, right:0, zIndex:200,
          background:"#fff", border:"1px solid #E2E8F0", borderRadius:8,
          boxShadow:"0 8px 24px rgba(0,0,0,.12)", maxHeight:220, overflowY:"auto",
        }}>
          {filtered.map(n => (
            <div
              key={n}
              onMouseDown={e => { e.preventDefault(); select(n); }}
              style={{
                padding:"8px 12px", fontSize:13, cursor:"pointer",
                color: n === value ? "#D97706" : "#1E293B",
                fontWeight: n === value ? 700 : 400,
                background: n === value ? "#FFF7ED" : "transparent",
              }}
              onMouseEnter={e => e.currentTarget.style.background = n === value ? "#FFF7ED" : "#F8FAFC"}
              onMouseLeave={e => e.currentTarget.style.background = n === value ? "#FFF7ED" : "transparent"}
            >
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
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

  const [guests,   setGuests]   = useState([]);
  const [view, setView] = useState(()=>localStorage.getItem("hoteldesk_view")||"calendar");
  function navigate(v){ setView(v); localStorage.setItem("hoteldesk_view",v); setSidebarOpen(false); }
  const [modal,    setModal]    = useState(null);
  const [calYear,  setCalYear]  = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calFilter,  setCalFilter]  = useState([]);
  const [bkgFilter,  setBkgFilter]  = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [toasts, setToasts] = useState([]);

  function showToast(message, type = "success") {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }

  useEffect(()=>{
    (async()=>{
      const [u, r, b, g] = await Promise.all([
        dbSelect("users"),
        dbSelect("rooms"),
        dbSelect("bookings"),
        dbSelect("guests"),
      ]);
      if (!u.length) { await Promise.all(DEFAULT_USERS.map(x => dbUpsert("users", x))); setUsers(DEFAULT_USERS); } else { setUsers(u); }
      if (!r.length) { await Promise.all(DEFAULT_ROOMS.map(x => dbUpsert("rooms", x))); setRooms(DEFAULT_ROOMS); } else { setRooms(r); }

      let guestList = [...g];
      const updatedBookings = [...b];
      const bookingsWithoutGuest = b.filter(bk => !bk.guestId && bk.phone);
      for (const bk of bookingsWithoutGuest) {
        const phone = bk.phone.trim();
        let existing = guestList.find(gx => gx.phone?.trim() === phone);
        if (!existing) {
          existing = { id:`g${Date.now()}_${Math.random().toString(36).slice(2,6)}`, name:bk.guestName, phone, email:bk.email||"", nationality:bk.nationality||"", status:"regular", notes:"", createdAt:bk.bookingDate||fmt(new Date()) };
          await dbUpsert("guests", existing);
          guestList.push(existing);
        }
        const updated = { ...bk, guestId: existing.id };
        await dbUpsert("bookings", updated);
        const idx = updatedBookings.findIndex(x => x.id === bk.id);
        if (idx !== -1) updatedBookings[idx] = updated;
      }
      setGuests(guestList);
      setBookings(updatedBookings);
      setReady(true);
    })();
  },[]);


  async function saveUser(u) {
    const ok = await dbUpsert("users", u);
    if (ok) {
      setUsers(prev => [...prev, u]);
      showToast("Служителят е добавен успешно.");
    } else {
      showToast("Грешка при запис.", "error");
    }
  }
  async function removeUser(id) {
    await dbDelete("users", id);
    setUsers(prev => prev.filter(x => x.id !== id));
  }
  async function saveRoom(r) {
    const ok = await dbUpsert("rooms", r);
    if (ok) {
      setRooms(prev => prev.find(x=>x.id===r.id) ? prev.map(x=>x.id===r.id?r:x) : [...prev, r]);
      showToast("Стаята е записана успешно.");
    } else {
      showToast("Грешка при запис на стаята.", "error");
    }
  }
  async function removeRoom(id) {
    await dbDelete("rooms", id);
    setRooms(prev => prev.filter(x => x.id !== id));
  }
  async function saveGuest(g) {
    const ok = await dbUpsert("guests", g);
    if (ok) {
      setGuests(prev => prev.find(x=>x.id===g.id) ? prev.map(x=>x.id===g.id?g:x) : [...prev, g]);
      showToast("Профилът на госта е записан.");
    } else {
      showToast("Грешка при запис на госта.", "error");
    }
  }
  async function removeGuest(id) {
    await dbDelete("guests", id);
    setGuests(prev => prev.filter(x => x.id !== id));
  }

  async function updateGuestStats(guestId, updatedBookings) {
    const gBkgs = updatedBookings.filter(b => b.guestId === guestId && b.status !== "cancelled");
    const totalSpent = gBkgs.reduce((s, b) => s + Number(b.totalPrice || 0), 0);
    const seenGroups = new Set();
    const totalStays = gBkgs.filter(b => {
      if (!b.groupId) return true;
      if (seenGroups.has(b.groupId)) return false;
      seenGroups.add(b.groupId);
      return true;
    }).length;
    const lastVisit = gBkgs.map(b => b.checkIn).sort().reverse()[0] || "";
    setGuests(prev => prev.map(g => {
      if (g.id !== guestId) return g;
      const updated = { ...g, totalSpent, totalStays, lastVisit };
      dbUpsert("guests", updated);
      return updated;
    }));
  }

  async function saveGroupBookingDirect(shared, roomsList, guestId) {
    const groupId = roomsList.length > 1 ? (shared.groupId || `grp_${Date.now()}`) : null;
    const depositAmount = shared.depositReceived ? Number(shared.depositAmount) || 0 : 0;
    const nights = shared.checkIn&&shared.checkOut ? nightsBetween(shared.checkIn, shared.checkOut) : 0;
    const grandTotal = roomsList.reduce((s, r) => {
      return s + (nights > 0 ? Math.round(nights * Number(r.pricePerNight)) : 0);
    }, 0);
    const remaining = shared.fullyPaid ? 0 : Math.max(0, grandTotal - depositAmount);

    const savedRecords = [];
    for (const room of roomsList) {
      const roomTotal = nights > 0 ? Math.round(nights * Number(room.pricePerNight)) : 0;
      const record = {
        id: room.bookingId,
        guestId,
        guestName:       shared.guestName,
        phone:           shared.phone,
        email:           shared.email,
        bookingDate:     shared.bookingDate,
        source:          shared.source,
        nationality:     shared.nationality,
        status:          shared.status,
        depositReceived: shared.depositReceived,
        depositAmount,
        depositDate:     shared.depositDate,
        fullyPaid:       shared.fullyPaid,
        notes:           shared.notes,
        createdBy:       shared.createdBy,
        groupId,
        roomId:          room.roomId,
        checkIn:         shared.checkIn,
        checkOut:        shared.checkOut,
        pricePerNight:   Number(room.pricePerNight),
        totalPrice:      roomTotal,
        remaining:       roomsList.length === 1 ? remaining : 0,
      };
      const ok = await dbUpsert("bookings", record);
      if (!ok) { showToast("Грешка при запис на резервацията.", "error"); return false; }
      savedRecords.push(record);
    }

    let updated = [...bookings];
    for (const rec of savedRecords) {
      const exists = updated.findIndex(x => x.id === rec.id);
      if (exists !== -1) updated[exists] = rec; else updated = [...updated, rec];
    }
    setBookings(updated);
    if (guestId) await updateGuestStats(guestId, updated);
    return true;
  }

  async function saveGroupBooking(shared, roomsList, onConflict) {
    let guestId = shared.guestId;

    if (shared.phone) {
      const phone = shared.phone.trim();
      const existing = guests.find(g => g.phone?.trim() === phone);
      if (existing) {
        if (existing.name.trim().toLowerCase() !== shared.guestName.trim().toLowerCase()) {
          if (onConflict) { onConflict(existing, shared, roomsList); return false; }
        }
        guestId = existing.id;
        if (shared.nationality && shared.nationality !== existing.nationality) {
          const updatedGuest = { ...existing, nationality: shared.nationality };
          await dbUpsert("guests", updatedGuest);
          setGuests(prev => prev.map(g => g.id === existing.id ? updatedGuest : g));
        }
      } else {
        const newGuest = {
          id: `g${Date.now()}`, name: shared.guestName, phone,
          email: shared.email||"", nationality: shared.nationality||"",
          status: "regular", notes: "", totalSpent: 0, totalStays: 0,
          lastVisit: "", createdAt: fmt(new Date()),
        };
        await dbUpsert("guests", newGuest);
        setGuests(prev => [...prev, newGuest]);
        guestId = newGuest.id;
      }
    }

    const isNew = !bookings.find(x => x.id === roomsList[0].bookingId);
    const ok = await saveGroupBookingDirect(shared, roomsList, guestId);
    if (!ok) return false;
    showToast(isNew ? "Резервацията е създадена успешно." : "Резервацията е обновена успешно.");
    return true;
  }

  async function cancelBooking(b) {
    const toCancel = b.groupId
      ? bookings.filter(x => x.groupId === b.groupId)
      : [b];
    const updates = toCancel.map(x => ({ ...x, status: "cancelled" }));
    await Promise.all(updates.map(u => dbUpsert("bookings", u)));
    const updatedBookings = bookings.map(x => updates.find(u => u.id === x.id) || x);
    setBookings(updatedBookings);
    if (b.guestId) await updateGuestStats(b.guestId, updatedBookings);
    showToast("Резервацията е анулирана.");
  }

  async function removeBooking(b) {
    const toDelete = b.groupId
      ? bookings.filter(x => x.groupId === b.groupId)
      : [b];
    await Promise.all(toDelete.map(x => dbDelete("bookings", x.id)));
    const deletedIds = new Set(toDelete.map(x => x.id));
    setBookings(prev => prev.filter(x => !deletedIds.has(x.id)));
    showToast("Резервацията е изтрита.");
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

  const navItems=[{id:"calendar",label:"Календар",icon:"📅"},{id:"bookings",label:"Резервации",icon:"📋"},{id:"rooms",label:"Стаи",icon:"🛏️"},{id:"guests",label:"Гости",icon:"👤"},...(user.role==="admin"?[{id:"staff",label:"Персонал",icon:"👥"}]:[])];

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Inter',sans-serif",background:"#F8FAFC",overflow:"hidden"}}>
      <ToastContainer toasts={toasts} />

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside style={{
        width: 220,
        background: "#1E293B",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        position: window.innerWidth <= 768 ? "fixed" : "relative",
        left: window.innerWidth <= 768 ? (sidebarOpen ? 0 : -220) : 0,
        top: 0,
        bottom: 0,
        zIndex: 99,
        transition: "left 0.3s ease"
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"20px 16px",borderBottom:"1px solid rgba(255,255,255,.07)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:26}}>🏨</span>
            <div><div style={{fontFamily:"'Inter',sans-serif",fontSize:17,fontWeight:700,color:"#F1F5F9"}}>HotelDesk</div>
            <div style={{fontSize:10,color:"#475569",textTransform:"uppercase",letterSpacing:".08em",marginTop:2}}>Управление</div></div>
          </div>
          <button 
            className="mobile-only"
            onClick={() => setSidebarOpen(false)} 
            style={{background:"transparent",border:"none",color:"#94A3B8",fontSize:24,cursor:"pointer",padding:0,lineHeight:1}}>
            ×
          </button>
        </div>
        <nav style={{flex:1,padding:"12px 8px",display:"flex",flexDirection:"column",gap:2}}>
          {navItems.map(item=>(
            <button key={item.id} className="nbtn" onClick={()=>navigate(item.id)} style={{
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
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",marginLeft:window.innerWidth <= 768 ? 0 : undefined}}>
        <header style={{height:54,background:"#fff",borderBottom:"1px solid #E2E8F0",display:"flex",alignItems:"center",padding:"0 16px",gap:14,flexShrink:0}}>
          <button 
            className="mobile-only hamburger"
            onClick={() => setSidebarOpen(true)}
            style={{background:"transparent",border:"none",marginRight:4}}>
            <span></span>
            <span></span>
            <span></span>
          </button>
          <h1 style={{fontFamily:"'Inter',sans-serif",fontSize:window.innerWidth <= 768 ? 16 : 19,fontWeight:700,color:"#1E293B",flex:1}}>{navItems.find(n=>n.id===view)?.label}</h1>
          <div className="mobile-header-actions">
            {(view==="calendar"||view==="bookings") && <button onClick={()=>setModal({type:"booking",data:{}})} style={{...S.primaryBtn,fontSize:window.innerWidth <= 768 ? 12 : 13,padding:window.innerWidth <= 768 ? "6px 10px" : "8px 16px"}}>+ {window.innerWidth <= 768 ? "Нова" : "Нова резервация"}</button>}
            {view==="bookings" && window.innerWidth > 768 && (
              <button
                onClick={() => exportBookingsToCSV(bookings, rooms)}
                style={{ ...S.outlineBtn, display:"flex", alignItems:"center", gap:6 }}
                title="Изтегли всички резервации като CSV файл"
              >
                ↓ Експорт CSV
              </button>
            )}
            {view==="rooms" && <button onClick={()=>setModal({type:"room",data:{}})} style={{...S.primaryBtn,fontSize:window.innerWidth <= 768 ? 12 : 13,padding:window.innerWidth <= 768 ? "6px 10px" : "8px 16px"}}>+ {window.innerWidth <= 768 ? "Стая" : "Добави стая"}</button>}
            {view==="staff"&&user.role==="admin" && <button onClick={()=>setModal({type:"staff",data:{}})} style={{...S.primaryBtn,fontSize:window.innerWidth <= 768 ? 12 : 13,padding:window.innerWidth <= 768 ? "6px 10px" : "8px 16px"}}>+ {window.innerWidth <= 768 ? "Служител" : "Добави служител"}</button>}
          </div>
        </header>

        <div style={{flex:1,overflow:"auto",padding:window.innerWidth <= 768 ? "12px" : "20px 22px"}}>

          {/* ══ CALENDAR ══════════════════════════════════════════════ */}
          {view==="calendar" && <>
            <div className="stats-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}}>
              {[["Общо стаи",`${rooms.length}`,"в хотела"],["Заети днес",`${occupied}`,`от ${rooms.length} стаи`],["Резервации",`${monthCount}`,`за ${BG_MONTHS[calMonth]}`],["Приходи",`€${monthRev.toLocaleString()}`,"потвърдени"]].map(([l,v,s])=>(
                <div key={l} style={{background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",padding:"16px 18px",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
                  <div style={{fontSize:11,fontWeight:700,letterSpacing:"1.2px",textTransform:"uppercase",color:"#94A3B8",marginBottom:6}}>{l}</div>
                  <div style={{fontFamily:"'Inter',sans-serif",fontSize:window.innerWidth <= 768 ? 20 : 26,color:"#1E293B"}}>{v}</div>
                  <div style={{fontSize:12,color:"#D97706",fontWeight:600,marginTop:4}}>{s}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
              <button onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}} style={S.navBtn}>‹</button>
              <span style={{fontFamily:"'Inter',sans-serif",fontSize:window.innerWidth <= 768 ? 16 : 20,fontWeight:700,color:"#1E293B",minWidth:window.innerWidth <= 768 ? 150 : 200,textAlign:"center"}}>{BG_MONTHS[calMonth]} {calYear}</span>
              <button onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}} style={S.navBtn}>›</button>
              {window.innerWidth > 768 && <MultiSelect label="Стаи" options={rooms} selected={calFilter} onChange={setCalFilter}/>}
              <button onClick={()=>{const t=new Date();setCalMonth(t.getMonth());setCalYear(t.getFullYear());}} style={{...S.navBtn,marginLeft:"auto"}}>Днес</button>
            </div>
            {window.innerWidth <= 768 && (
              <div style={{marginBottom:12}}>
                <MultiSelect label="Стаи" options={rooms} selected={calFilter} onChange={setCalFilter}/>
              </div>
            )}

            <div style={{overflowX:"auto",borderRadius:12,boxShadow:"0 1px 4px rgba(0,0,0,.06)",border:"1px solid #E2E8F0",background:"#fff"}}>
              <table style={{borderCollapse:"collapse",minWidth:"100%"}}>
                <thead>
                  <tr>
                    <th style={{background:"#1E293B",color:"#94A3B8",padding:"10px 14px",fontSize:12,fontWeight:600,textAlign:"left",whiteSpace:"nowrap",position:"sticky",left:0,zIndex:3,minWidth:window.innerWidth <= 768 ? 80 : 130,borderRight:"1px solid #0f1a27"}}>Стая</th>
                    {days.map(d=>{
                      const ds=`${calYear}-${pad(calMonth+1)}-${pad(d)}`;
                      const isToday=ds===today;
                      const dow=new Date(ds).getDay();
                      const isWe=dow===0||dow===6;
                      return <th key={d} style={{background:isToday?"#D97706":isWe?"#243150":"#1E293B",color:isToday?"#fff":isWe?"#94A3B8":"#64748B",padding:"6px 2px",fontSize:10,fontWeight:700,textAlign:"center",minWidth:window.innerWidth <= 768 ? 28 : 32,width:window.innerWidth <= 768 ? 28 : 32,borderRight:"1px solid #0f1a27"}}>{d}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visCalRooms.map(room=>{
                    const monthStart=`${calYear}-${pad(calMonth+1)}-01`;
                    const monthEnd=`${calYear}-${pad(calMonth+1)}-${pad(daysInMonth)}`;
                    const rBkgs=bookings.filter(b=>b.roomId===room.id&&b.status!=="cancelled"&&b.checkOut>monthStart&&b.checkIn<=monthEnd);

                    const dayBooking={};
                    rBkgs.forEach(b=>{
                      days.forEach(d=>{
                        const ds=`${calYear}-${pad(calMonth+1)}-${pad(d)}`;
                        if(b.checkIn<=ds&&b.checkOut>ds) dayBooking[d]=b;
                      });
                    });

                    const cells=[];
                    let d=1;
                    while(d<=daysInMonth){
                      const ds=`${calYear}-${pad(calMonth+1)}-${pad(d)}`;
                      const isToday=ds===today;
                      const b=dayBooking[d];

                      if(!b){
                        cells.push(
                          <td key={d} className="tlc"
                            onClick={()=>setModal({type:"booking",data:{roomId:room.id,checkIn:ds}})}
                            title="Натиснете за резервация"
                            style={{background:isToday?"#FFFBEB":"transparent",borderRight:"1px solid #F1F5F9",height:36,padding:0,verticalAlign:"middle",cursor:"pointer",transition:"background .1s",minWidth:window.innerWidth <= 768 ? 28 : 32,width:window.innerWidth <= 768 ? 28 : 32}}>
                          </td>
                        );
                        d++;
                      } else {
                        let span=0;
                        let dd=d;
                        while(dd<=daysInMonth&&dayBooking[dd]?.id===b.id){
                          span++;
                          dd++;
                        }
                        const continuesFromPrev = b.checkIn < monthStart;
                        const continuesNext = b.checkOut > monthEnd;

                        const borderRadius=`${continuesFromPrev?0:5}px ${continuesNext?0:5}px ${continuesNext?0:5}px ${continuesFromPrev?0:5}px`;

                        cells.push(
                          <td key={d} colSpan={span}
                            onClick={()=>setModal({type:"viewBooking",data:b})}
                            title={b.guestName}
                            style={{
                              background:room.color,
                              borderRadius,
                              height:36,
                              padding:"0 7px",
                              verticalAlign:"middle",
                              cursor:"pointer",
                              borderRight:continuesNext?"none":"2px solid #fff",
                              borderLeft:continuesFromPrev?"none":"2px solid #fff",
                              overflow:"hidden",
                              maxWidth:0,
                            }}>
                            <span style={{color:"#fff",fontSize:10,fontWeight:700,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"block"}}>
                              {b.groupId?"🔗 ":""}{b.guestName}
                            </span>
                          </td>
                        );
                        d+=span;
                      }
                    }

                    return (
                      <tr key={room.id} style={{borderBottom:"1px solid #F1F5F9"}}>
                        <td style={{background:"#F8FAFC",padding:"7px 14px",whiteSpace:"nowrap",position:"sticky",left:0,zIndex:2,borderRight:"1px solid #E2E8F0",verticalAlign:"middle"}}>
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <span style={{width:8,height:8,borderRadius:"50%",background:room.color,flexShrink:0}}/>
                            <div><div style={{fontWeight:700,fontSize:window.innerWidth <= 768 ? 11 : 12,color:"#1E293B"}}>{room.name}</div>{window.innerWidth > 768 && <div style={{fontSize:10,color:"#94A3B8"}}>{room.type}</div>}</div>
                          </div>
                        </td>
                        {cells}
                      </tr>
                    );
                  })}
                  {visCalRooms.length===0&&<tr><td colSpan={daysInMonth+1} style={{textAlign:"center",padding:32,color:"#94A3B8",fontSize:14}}>Няма избрани стаи</td></tr>}
                </tbody>
              </table>
            </div>
            <p style={{marginTop:10,fontSize:window.innerWidth <= 768 ? 11 : 12,color:"#94A3B8",textAlign:"center"}}>Натиснете клетка за нова резервация · Натиснете резервация за преглед</p>
          </>}

          {/* ══ BOOKINGS ══════════════════════════════════════════════ */}
          {view==="bookings" && <>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
              <span style={{fontSize:14,color:"#64748B"}}>{visBkgList.length} резервации</span>
              <MultiSelect label="Стаи" options={rooms} selected={bkgFilter} onChange={setBkgFilter}/>
              {window.innerWidth <= 768 && (
                <button
                  onClick={() => exportBookingsToCSV(bookings, rooms)}
                  style={{ ...S.outlineBtn, fontSize:12, padding:"6px 10px" }}
                >
                  ↓ CSV
                </button>
              )}
            </div>
            <div style={{background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
              {visBkgList.length===0
                ? <div style={{textAlign:"center",padding:52,color:"#CBD5E1",fontSize:15}}>Няма резервации</div>
                : <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:window.innerWidth <= 768 ? 12 : 13}}>
                    <thead><tr>{(window.innerWidth <= 768 ? ["Гост","Стая","Дати","Статус",""] : ["Гост","Стая","Настаняване","Напускане","Нощ.","Депозит","Статус",""]).map(h=>(
                      <th key={h} style={{textAlign:"left",padding:window.innerWidth <= 768 ? "8px 10px" : "10px 14px",background:"#F8FAFC",color:"#94A3B8",fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",borderBottom:"1px solid #E2E8F0",whiteSpace:"nowrap"}}>{h}</th>
                    ))}</tr></thead>
                    <tbody>
                      {(()=>{
                        const seen=new Set();
                        return visBkgList.filter(b=>{
                          if(!b.groupId) return true;
                          if(seen.has(b.groupId)) return false;
                          seen.add(b.groupId); return true;
                        }).map(b=>{
                          const room=rooms.find(r=>r.id===b.roomId);
                          const st=STATUS_MAP[b.status]||STATUS_MAP.confirmed;
                          const groupSize=b.groupId?bookings.filter(x=>x.groupId===b.groupId).length:1;
                          return (
                            <tr key={b.id} className="rowhov" style={{borderBottom:"1px solid #F1F5F9"}}>
                              <td style={{padding:window.innerWidth <= 768 ? "10px 8px" : "12px 14px",fontWeight:600,color:"#1E293B",whiteSpace:"nowrap"}}>{b.guestName}</td>
                              <td style={{padding:window.innerWidth <= 768 ? "10px 8px" : "12px 14px"}}>
                                <div style={{display:"flex",alignItems:"center",gap:6}}>
                                  <div>
                                    <div style={{fontWeight:600,color:"#1E293B",fontSize:window.innerWidth <= 768 ? 11 : 13}}>{room?.name||"—"}</div>
                                    {window.innerWidth > 768 && <div style={{fontSize:11,color:"#94A3B8"}}>{room?.type||""}</div>}
                                  </div>
                                  {groupSize>1&&<span style={{fontSize:10,fontWeight:700,background:"#EFF6FF",color:"#1D4ED8",borderRadius:6,padding:"2px 6px",whiteSpace:"nowrap"}}>+{groupSize-1}</span>}
                                </div>
                              </td>
                              {window.innerWidth <= 768 ? (
                                <td style={{padding:"10px 8px",color:"#374151",fontSize:11,whiteSpace:"nowrap"}}>
                                  <div>{b.checkIn}</div>
                                  <div>{b.checkOut}</div>
                                </td>
                              ) : (
                                <>
                                  <td style={{padding:"12px 14px",color:"#374151"}}>{b.checkIn}</td>
                                  <td style={{padding:"12px 14px",color:"#374151"}}>{b.checkOut}</td>
                                  <td style={{padding:"12px 14px",color:"#374151"}}>{nightsBetween(b.checkIn,b.checkOut)}</td>
                                  <td style={{padding:"12px 14px"}}>{b.depositReceived?<span style={{color:"#166534",fontWeight:600}}>€{b.depositAmount}</span>:<span style={{color:"#94A3B8"}}>—</span>}</td>
                                </>
                              )}
                              <td style={{padding:window.innerWidth <= 768 ? "10px 8px" : "12px 14px"}}><span style={{fontSize:window.innerWidth <= 768 ? 10 : 11,fontWeight:600,padding:"3px 9px",borderRadius:999,background:st.bg,color:st.color,whiteSpace:"nowrap"}}>{st.label}</span></td>
                              <td style={{padding:window.innerWidth <= 768 ? "10px 8px" : "12px 14px"}}><button onClick={()=>setModal({type:"viewBooking",data:b})} style={{...S.outlineBtn,fontSize:window.innerWidth <= 768 ? 11 : 13,padding:window.innerWidth <= 768 ? "5px 10px" : "7px 14px"}}>Преглед</button></td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </>}

          {/* ══ ROOMS ═════════════════════════════════════════════════ */}
          {view==="rooms" && (
            <div style={{display:"grid",gridTemplateColumns:window.innerWidth <= 768 ? "1fr" : "repeat(auto-fill,minmax(240px,1fr))",gap:16}}>
              {rooms.map(room=>(
                <div key={room.id} style={{background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.04)",display:"flex",flexDirection:"column"}}>
                  <div style={{height:5,background:room.color}}/>
                  <div style={{padding:"16px",flex:1}}>
                    <div style={{fontFamily:"'Inter',sans-serif",fontWeight:700,fontSize:15,color:"#1E293B"}}>{room.name}</div>
                    <div style={{fontSize:11,color:"#94A3B8",textTransform:"uppercase",letterSpacing:".06em",margin:"3px 0 10px"}}>{room.type}</div>
                  </div>
                  <div className="action-buttons" style={{padding:"12px 16px",borderTop:"1px solid #F1F5F9",display:"flex",gap:8}}>
                    <button onClick={()=>setModal({type:"room",data:{...room}})} style={S.outlineBtn}>Редактирай</button>
                    {user.role==="admin"&&<button onClick={()=>{if(confirm("Изтриете тази стая?")) removeRoom(room.id);}} style={S.dangerBtn}>Изтрий</button>}
                  </div>
                </div>
              ))}
            </div>
          )}


          {/* ══ STAFF ════════════════════════════════════════════════ */}
          {view==="staff"&&user.role==="admin" && (
            <div style={{maxWidth:window.innerWidth <= 768 ? "100%" : 600,background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:window.innerWidth <= 768 ? 12 : 13}}>
                <thead><tr>{["Иmе","Потребителско иmе","Роля",""].map(h=><th key={h} style={{textAlign:"left",padding:window.innerWidth <= 768 ? "8px 10px" : "10px 14px",background:"#F8FAFC",color:"#94A3B8",fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",borderBottom:"1px solid #E2E8F0"}}>{h}</th>)}</tr></thead>
                <tbody>{users.map(u=>(
                  <tr key={u.id} className="rowhov" style={{borderBottom:"1px solid #F1F5F9"}}>
                    <td style={{padding:window.innerWidth <= 768 ? "10px 8px" : "12px 14px",fontWeight:600,color:"#1E293B"}}>{u.name}</td>
                    <td style={{padding:window.innerWidth <= 768 ? "10px 8px" : "12px 14px",color:"#374151"}}>{u.username}</td>
                    <td style={{padding:window.innerWidth <= 768 ? "10px 8px" : "12px 14px"}}><span style={{fontSize:window.innerWidth <= 768 ? 10 : 11,fontWeight:600,padding:"3px 9px",borderRadius:999,background:u.role==="admin"?"#DCFCE7":"#F1F5F9",color:u.role==="admin"?"#166534":"#475569"}}>{u.role==="admin"?"Администратор":"Служител"}</span></td>
                    <td style={{padding:window.innerWidth <= 768 ? "10px 8px" : "12px 14px"}}>{u.id!==user.id&&<button onClick={()=>{if(confirm("Премахнете служителя?")) removeUser(u.id);}} style={{...S.dangerBtn,fontSize:window.innerWidth <= 768 ? 11 : 13,padding:window.innerWidth <= 768 ? "5px 10px" : "7px 14px"}}>Премахни</button>}</td>
                  </tr>
                ))}</tbody>
              </table>
              </div>
            </div>
          )}
          {/* ══ GUESTS ════════════════════════════════════════════════ */}
          {view==="guests" && <GuestDirectory guests={guests} onEdit={g=>setModal({type:"guest",data:g})} onDelete={user.role==="admin"?id=>{ if(confirm("Изтриете госта?")) removeGuest(id); }:null}/>}

        </div>
      </div>

      {/* MODALS */}
      {modal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,23,42,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:16,colorScheme:"light"}}
          onClick={e=>{if(e.target===e.currentTarget)setModal(null);}}>
          {modal.type==="booking"&&<BookingModal rooms={rooms} bookings={bookings} initial={modal.data} user={user}
            onSave={async ({shared, rooms:roomsList})=>{
              const success = await saveGroupBooking(
                shared,
                roomsList,
                (existingGuest, shared, rooms)=>setModal({type:"guestConflict", existingGuest, shared, rooms})
              );
              if (success) setModal(null);
            }}
            onClose={()=>setModal(null)}/>}
          {modal.type==="guestConflict"&&<GuestConflictModal
            existingGuest={modal.existingGuest} booking={{...modal.shared}}
            onUseExisting={async ()=>{
              const ok = await saveGroupBookingDirect(modal.shared, modal.rooms, modal.existingGuest.id);
              if (ok) {
                showToast("Резервацията е свързана с existing госта.");
                setModal(null);
              } else {
                showToast("Грешка при запис.", "error");
              }
            }}
            onCreateNew={async ()=>{
              const ng={id:`g${Date.now()}`,name:modal.shared.guestName,phone:modal.shared.phone,email:modal.shared.email||"",status:"regular",notes:"",createdAt:fmt(new Date())};
              await dbUpsert("guests",ng);
              setGuests(prev=>[...prev,ng]);
              const ok = await saveGroupBookingDirect(modal.shared, modal.rooms, ng.id);
              if (ok) {
                showToast("Нов профил създаден и резервацията е записана.");
                setModal(null);
              } else {
                showToast("Грешка при запис.", "error");
              }
            }}
            onClose={()=>setModal(null)}/>}
          {modal.type==="viewBooking"&&<ViewBookingModal booking={modal.data} bookings={bookings} rooms={rooms} user={user}
            onEdit={()=>setModal({type:"booking",data:modal.data})}
            onCancel={b=>{cancelBooking(b);setModal(null);}}
            onDelete={b=>{removeBooking(b);setModal(null);}}
            onClose={()=>setModal(null)}/>}
          {modal.type==="room"&&<RoomModal initial={modal.data} rooms={rooms} onSave={async r=>{await saveRoom(r);setModal(null);}} onClose={()=>setModal(null)}/>}
          {modal.type==="staff"&&<StaffModal users={users} onSave={u=>{saveUser(u);setModal(null);}} onClose={()=>setModal(null)}/>}
          {modal.type==="guest"&&<GuestModal initial={modal.data} bookings={bookings} rooms={rooms} onSave={g=>{saveGuest(g);setModal(null);}} onClose={()=>setModal(null)}/>}
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
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0F172A 0%,#1E3A5F 100%)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Inter',sans-serif",padding:"20px"}}>
      <div style={{background:"#fff",borderRadius:20,padding:"38px 34px",width:"100%",maxWidth:370,boxShadow:"0 30px 80px rgba(0,0,0,.4)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:44,marginBottom:8}}>🏨</div>
          <h1 style={{fontFamily:"'Inter',sans-serif",fontSize:26,fontWeight:700,color:"#1E293B"}}>HotelDesk</h1>
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

  const [roomsList, setRoomsList] = useState(()=>{
    if (isEdit && initial.groupId) {
      return bookings
        .filter(b=>b.groupId===initial.groupId)
        .map(b=>({ bookingId:b.id, roomId:b.roomId, pricePerNight:b.pricePerNight||"" }));
    }
    return [{ bookingId:initial.id||`b${Date.now()}`, roomId:initial.roomId||rooms[0]?.id||"", pricePerNight:initial.pricePerNight||"" }];
  });

  const [shared, setShared] = useState(()=>({
    guestName:       initial.guestName||"",
    phone:           initial.phone||"",
    email:           initial.email||"",
    checkIn:         initial.checkIn||"",
    checkOut:        initial.checkOut||"",
    bookingDate:     initial.bookingDate||todayStr,
    source:          initial.source||SOURCES[0],
    nationality:     initial.nationality||"",
    status:          initial.status||"confirmed",
    depositReceived: initial.depositReceived||false,
    depositAmount:   initial.depositAmount||"",
    depositDate:     initial.depositDate||"",
    fullyPaid:       initial.fullyPaid||false,
    notes:           initial.notes||"",
    createdBy:       initial.createdBy||user.name,
    groupId:         initial.groupId||null,
  }));

  const [err, setErr] = useState("");

  const nights    = shared.checkIn&&shared.checkOut&&shared.checkOut>shared.checkIn ? nightsBetween(shared.checkIn,shared.checkOut) : 0;
  const roomTotals = roomsList.map(r=>({
    price: nights>0&&r.pricePerNight ? Math.round(nights*Number(r.pricePerNight)) : 0
  }));
  const grandTotal = roomTotals.reduce((s,t)=>s+t.price, 0);
  const deposit    = shared.depositReceived&&shared.depositAmount ? Number(shared.depositAmount) : 0;
  const remaining  = shared.fullyPaid ? 0 : Math.max(0, grandTotal - deposit);

  function updateRoom(idx, field, value) {
    setRoomsList(prev=>prev.map((r,i)=>i===idx?{...r,[field]:value}:r));
  }
  function addRoom() {
    setRoomsList(prev=>[...prev, { bookingId:`b${Date.now()}_${prev.length}`, roomId:rooms[0]?.id||"", pricePerNight:"" }]);
  }
  function removeRoom(idx) {
    setRoomsList(prev=>prev.filter((_,i)=>i!==idx));
  }

  function save() {
    if (!shared.guestName.trim())                           return setErr("Въведете иmе на госта.");
    if (!shared.checkIn||!shared.checkOut)                  return setErr("Задайте дати на настаняване и напускане.");
    if (shared.checkOut<=shared.checkIn)                    return setErr("Датата на напускане трябва да е след настаняването.");
    for (let i=0; i<roomsList.length; i++) {
      const r=roomsList[i];
      const label=roomsList.length>1?` (Стая ${i+1})`:"";
      if (!r.pricePerNight||Number(r.pricePerNight)<=0)    return setErr(`Въведете цена на нощ${label}.`);
      const siblingIds=new Set(roomsList.map(x=>x.bookingId));
      const conflict=bookings.find(b=>!siblingIds.has(b.id)&&b.roomId===r.roomId&&b.status!=="cancelled"&&b.checkIn<shared.checkOut&&b.checkOut>shared.checkIn);
      if (conflict) {
        const roomName=rooms.find(rm=>rm.id===r.roomId)?.name||"стаята";
        return setErr(`${roomName} е вече резервирана за тези дати (${conflict.guestName}).`);
      }
      for (let j=0; j<i; j++) {
        if (roomsList[j].roomId===r.roomId) return setErr(`Стаята е добавена два пъти.`);
      }
    }
    onSave({ shared, rooms:roomsList });
  }

  const isMobile = window.innerWidth <= 768;

  return (
    <div style={{...S.modal, maxWidth:isMobile ? "100%" : 560, maxHeight:isMobile ? "100%" : "92vh"}}>
      <div style={S.modalHeader}>
        <span style={{...S.modalTitle,fontSize:isMobile ? 15 : 17}}>{isEdit?"Редактирай резервация":"Нова резервация"}</span>
        <button onClick={onClose} style={S.closeBtn}>×</button>
      </div>
      <div style={{padding:isMobile ? "14px 16px" : "18px 20px",overflowY:"auto",maxHeight:isMobile ? "calc(100vh - 130px)" : "calc(90vh - 130px)"}}>

        <Fld label="Иmе на госта"><input value={shared.guestName} onChange={e=>setShared(x=>({...x,guestName:e.target.value}))} style={S.input} placeholder="Пълно иmе"/></Fld>
        <div style={{display:"grid",gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr",gap:12}}>
          <Fld label="Телефон"><input value={shared.phone} onChange={e=>setShared(x=>({...x,phone:e.target.value}))} style={S.input} placeholder="+359…"/></Fld>
          <Fld label="Имейл"><input type="email" value={shared.email} onChange={e=>setShared(x=>({...x,email:e.target.value}))} style={S.input} placeholder="guest@email.com"/></Fld>
        </div>
        <Fld label="Националност">
          <NationalitySelect value={shared.nationality} onChange={v=>setShared(x=>({...x,nationality:v}))} inputStyle={S.input}/>
        </Fld>
        <div style={{display:"grid",gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr",gap:12}}>
          <Fld label="Дата на резервацията"><input type="date" value={shared.bookingDate} onChange={e=>setShared(x=>({...x,bookingDate:e.target.value}))} style={S.input}/></Fld>
          <Fld label="Източник"><select value={shared.source} onChange={e=>setShared(x=>({...x,source:e.target.value}))} style={S.input}>{SOURCES.map(s=><option key={s}>{s}</option>)}</select></Fld>
        </div>

        <div style={{display:"grid",gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr",gap:12}}>
          <Fld label="Настаняване"><input type="date" value={shared.checkIn}  onChange={e=>setShared(x=>({...x,checkIn:e.target.value}))}  style={S.input}/></Fld>
          <Fld label="Напускане">  <input type="date" value={shared.checkOut} onChange={e=>setShared(x=>({...x,checkOut:e.target.value}))} style={S.input}/></Fld>
        </div>

        <div style={{marginTop:4}}>
          {roomsList.map((room,idx)=>{
            const {price}=roomTotals[idx];
            return (
              <div key={room.bookingId} style={{background:"#F8FAFC",borderRadius:10,border:"1px solid #E2E8F0",marginBottom:12,overflow:"hidden"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 14px",borderBottom:"1px solid #E2E8F0",background:"#F1F5F9"}}>
                  <span style={{fontSize:11,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:".06em"}}>Стая {idx+1}</span>
                  {roomsList.length>1&&<button onClick={()=>removeRoom(idx)} style={{background:"transparent",border:"none",color:"#94A3B8",cursor:"pointer",fontSize:18,padding:"0 4px",lineHeight:1,fontFamily:"inherit"}}>×</button>}
                </div>
                <div style={{padding:"12px 14px"}}>
                  <div style={{display:"grid",gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr",gap:12,alignItems:"end"}}>
                    <Fld label="Стая">
                      <select value={room.roomId} onChange={e=>updateRoom(idx,"roomId",e.target.value)} style={S.input}>
                        {rooms.map(r=><option key={r.id} value={r.id}>{r.name} — {r.type}</option>)}
                      </select>
                    </Fld>
                    <Fld label="Цена на нощ (€)">
                      <input type="number" min="1" value={room.pricePerNight} onChange={e=>updateRoom(idx,"pricePerNight",e.target.value)} style={S.input} placeholder="напр. 90"/>
                    </Fld>
                  </div>
                  {nights>0&&Number(room.pricePerNight)>0&&(
                    <div style={{fontSize:12,color:"#64748B",marginTop:4}}>
                      {nights} нощ{nights!==1?"увки":"увка"} × €{room.pricePerNight} = <strong style={{color:"#1E293B"}}>€{price}</strong>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <button onClick={addRoom} style={{...S.outlineBtn,width:"100%",marginBottom:14,color:"#059669",borderColor:"#BBF7D0",background:"#F0FDF4"}}>+ Добави стая</button>
        </div>

        {grandTotal>0&&(
          <div style={{background:"#EFF6FF",borderRadius:10,padding:"12px 14px",marginBottom:14,border:"1px solid #BFDBFE"}}>
            {roomsList.length>1&&roomTotals.map((rt,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#3B82F6",marginBottom:3}}>
                <span>{rooms.find(r=>r.id===roomsList[i].roomId)?.name||`Стая ${i+1}`}: {nights} нощ{nights!==1?"увки":"увка"} × €{roomsList[i].pricePerNight}</span>
                <span>€{rt.price}</span>
              </div>
            ))}
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#1D4ED8",marginBottom:4,borderTop:roomsList.length>1?"1px solid #BFDBFE":"none",paddingTop:roomsList.length>1?8:0}}>
              <span>{roomsList.length===1?`${nights} нощ${nights!==1?"увки":"увка"} × €${roomsList[0].pricePerNight}`:"Обща сума"}</span>
              <span style={{fontWeight:700}}>Общо: €{grandTotal}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:"#059669"}}>
              <span>Депозит</span><span style={{fontWeight:700}}>€{deposit}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:14,fontWeight:700,marginTop:6,paddingTop:6,borderTop:"1px solid #BFDBFE",color:remaining===0?"#166534":"#DC2626"}}>
              <span>Остава за плащане</span><span>€{remaining}</span>
            </div>
          </div>
        )}

        <Fld label="Статус"><select value={shared.status} onChange={e=>setShared(x=>({...x,status:e.target.value}))} style={S.input}>
          <option value="confirmed">Потвърдена</option>
          <option value="pending">Очаква депозит</option>
          <option value="cancelled">Анулирана</option>
        </select></Fld>

        <div style={{background:"#F8FAFC",borderRadius:10,padding:"14px",marginBottom:14,border:"1px solid #E2E8F0"}}>
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:8}}>
            <input type="checkbox" checked={shared.fullyPaid} onChange={e=>setShared(x=>({...x,fullyPaid:e.target.checked}))} style={{width:16,height:16,accentColor:"#059669"}}/>
            <span style={{fontWeight:600,fontSize:13,color:"#1E293B"}}>Изцяло платена</span>
          </label>
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",marginBottom:shared.depositReceived?14:0}}>
            <input type="checkbox" checked={shared.depositReceived} onChange={e=>setShared(x=>({...x,depositReceived:e.target.checked}))} style={{width:16,height:16,accentColor:"#D97706"}}/>
            <span style={{fontWeight:600,fontSize:13,color:"#1E293B"}}>Получен депозит</span>
          </label>
          {shared.depositReceived&&(
            <div style={{display:"grid",gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr",gap:12}}>
              <Fld label="Сума (€)"><input type="number" min="0" value={shared.depositAmount} onChange={e=>setShared(x=>({...x,depositAmount:e.target.value}))} style={S.input} placeholder="0"/></Fld>
              <Fld label="Дата на депозита"><input type="date" value={shared.depositDate} onChange={e=>setShared(x=>({...x,depositDate:e.target.value}))} style={S.input}/></Fld>
            </div>
          )}
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderRadius:10,marginBottom:14,border:`2px solid ${remaining===0?"#BBF7D0":"#FECACA"}`,background:remaining===0?"#F0FDF4":"#FFF5F5"}}>
          <span style={{fontWeight:700,fontSize:isMobile ? 13 : 14,color:remaining===0?"#166534":"#991B1B"}}>Остава за плащане</span>
          <span style={{fontWeight:800,fontSize:isMobile ? 16 : 18,color:remaining===0?"#166534":"#DC2626"}}>€{remaining}</span>
        </div>

        <Fld label="Забележки"><input value={shared.notes} onChange={e=>setShared(x=>({...x,notes:e.target.value}))} style={S.input} placeholder="По желание…"/></Fld>
        <div style={{fontSize:12,color:"#94A3B8",marginTop:4}}>Добавена от: <strong style={{color:"#475569"}}>{shared.createdBy}</strong></div>
        {err&&<div style={{color:"#DC2626",fontSize:13,marginTop:10}}>{err}</div>}
      </div>
      <div className="action-buttons" style={{padding:isMobile ? "12px 16px" : "14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={S.outlineBtn}>Откажи</button>
        <button onClick={save} style={S.primaryBtn}>{isEdit?"Запази промените":"Създай резервация"}</button>
      </div>
    </div>
  );
}

// ── VIEW BOOKING MODAL ────────────────────────────────────────────────────────
function ViewBookingModal({booking:b, bookings, rooms, user, onEdit, onCancel, onDelete, onClose}) {
  const groupBookings = b.groupId
    ? bookings.filter(x => x.groupId === b.groupId).sort((a,c)=>a.checkIn<c.checkIn?-1:1)
    : [b];
  const groupTotal = groupBookings.reduce((s,gb)=>s+Number(gb.totalPrice||0),0);
  const deposit    = b.depositReceived ? Number(b.depositAmount)||0 : 0;
  const remaining  = b.fullyPaid ? 0 : Math.max(0, groupTotal - deposit);
  const st = STATUS_MAP[b.status]||STATUS_MAP.confirmed;

  const sharedRows=[
    ["Гост",                b.guestName],
    ["Телефон",             b.phone||"—"],
    ["Имейл",               b.email||"—"],
    ["Националност",        b.nationality||"—"],
    ["Дата на резервацията",b.bookingDate||"—"],
    ["Източник",            b.source||"—"],
  ];
  const paymentRows=[
    ["Обща сума",           `€${groupTotal}`],
    ["Депозит",             b.depositReceived?`€${b.depositAmount} (${b.depositDate})`:"Не е получен"],
    ["Изцяло платена",      b.fullyPaid?<span style={{color:"#166534",fontWeight:700}}>✓ Да</span>:<span style={{color:"#94A3B8"}}>Не</span>],
    ["Остава за плащане",   <span style={{fontWeight:700,color:remaining===0?"#166534":"#DC2626"}}>€{remaining}</span>],
    ["Статус",              <span style={{fontSize:11,fontWeight:600,padding:"3px 9px",borderRadius:999,background:st.bg,color:st.color}}>{st.label}</span>],
    ["Забележки",           b.notes||"—"],
    ["Добавена от",         b.createdBy||"—"],
  ];

  function Row({label,val}) {
    return (
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #F1F5F9",fontSize:window.innerWidth <= 768 ? 13 : 14}}>
        <span style={{color:"#64748B",fontSize:window.innerWidth <= 768 ? 11 : 12,fontWeight:700,letterSpacing:"0.5px",textTransform:"uppercase"}}>{label}</span>
        <span style={{fontWeight:600,color:"#1E293B",maxWidth:220,textAlign:"right",fontSize:window.innerWidth <= 768 ? 12 : 14}}>{val}</span>
      </div>
    );
  }

  const isMobile = window.innerWidth <= 768;

  return (
    <div style={{...S.modal, maxWidth:isMobile ? "100%" : undefined, maxHeight:isMobile ? "100%" : "92vh"}}>
      <div style={S.modalHeader}>
        <span style={{...S.modalTitle,fontSize:isMobile ? 15 : 17}}>
          Детайли за резервацията
          {b.groupId&&<span style={{fontSize:11,fontWeight:700,background:"#EFF6FF",color:"#1D4ED8",borderRadius:6,padding:"2px 8px",marginLeft:10}}>🔗 {groupBookings.length} стаи</span>}
        </span>
        <button onClick={onClose} style={S.closeBtn}>×</button>
      </div>
      <div style={{padding:isMobile ? "14px 16px" : "18px 20px",overflowY:"auto",maxHeight:isMobile ? "calc(100vh - 130px)" : "calc(90vh - 130px)"}}>
        {sharedRows.map(([label,val])=><Row key={label} label={label} val={val}/>)}

        <div style={{margin:"14px 0 4px"}}>
          <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",textTransform:"uppercase",letterSpacing:"1px",marginBottom:8}}>
            {groupBookings.length>1?"Стаи":"Стая"}
          </div>
          {groupBookings.map((gb,i)=>{
            const room=rooms.find(r=>r.id===gb.roomId);
            const n=nightsBetween(gb.checkIn,gb.checkOut);
            return (
              <div key={gb.id} style={{background:"#F8FAFC",borderRadius:10,padding:"12px 14px",marginBottom:8,border:"1px solid #E2E8F0"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{width:10,height:10,borderRadius:"50%",background:room?.color||"#94A3B8",display:"inline-block",flexShrink:0}}/>
                    <span style={{fontWeight:700,fontSize:isMobile ? 13 : 14,color:"#1E293B"}}>{room?.name||"—"}</span>
                    <span style={{fontSize:11,color:"#94A3B8"}}>{room?.type}</span>
                  </div>
                  <span style={{fontWeight:700,color:"#1E293B"}}>€{gb.totalPrice||0}</span>
                </div>
                <div style={{fontSize:isMobile ? 11 : 12,color:"#64748B"}}>
                  {gb.checkIn} → {gb.checkOut} · {n} нощ{n!==1?"увки":"увка"} × €{gb.pricePerNight}
                </div>
              </div>
            );
          })}
        </div>

        {paymentRows.map(([label,val])=><Row key={label} label={label} val={val}/>)}
      </div>
      <div className="action-buttons" style={{padding:isMobile ? "12px 16px" : "14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end",flexWrap:"wrap"}}>
        {b.status!=="cancelled"&&<button onClick={()=>onCancel(b)} style={{...S.outlineBtn,fontSize:isMobile ? 12 : 13}}>Анулирай{b.groupId?" всички":""}</button>}
        <button onClick={()=>{ if(confirm("Изтриете тази резервация? Действието е необратимо.")) onDelete(b); }} style={{...S.dangerBtn,fontSize:isMobile ? 12 : 13}}>Изтрий{b.groupId?" всички":""}</button>
        <button onClick={onEdit} style={{...S.primaryBtn,fontSize:isMobile ? 12 : 13}}>Редактирай</button>
      </div>
    </div>
  );
}

// ── ROOM MODAL ────────────────────────────────────────────────────────────────
function RoomModal({initial,rooms,onSave,onClose}) {
  const isEdit=!!initial.id;
  const [f,setF]=useState({...initial, id:initial.id||`r${Date.now()}`,name:initial.name||"",type:initial.type||ROOM_TYPES[0],color:initial.color||PALETTE[rooms.length%PALETTE.length]});
  const [err,setErr]=useState("");
  function save(){ if(!f.name.trim()) return setErr("Въведете иmе на стаята."); onSave(f); }
  
  const isMobile = window.innerWidth <= 768;
  
  return (
    <div style={{...S.modal, maxWidth:isMobile ? "100%" : undefined}}>
      <div style={S.modalHeader}><span style={{...S.modalTitle,fontSize:isMobile ? 15 : 17}}>{isEdit?"Редактирай стая":"Добави стая"}</span><button onClick={onClose} style={S.closeBtn}>×</button></div>
      <div style={{padding:isMobile ? "14px 16px" : "18px 20px"}}>
        <Fld label="Иmе / Номер"><input value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))} style={S.input} placeholder="напр. Стая 205"/></Fld>
        <Fld label="Тип"><select value={f.type} onChange={e=>setF(x=>({...x,type:e.target.value}))} style={S.input}>{ROOM_TYPES.map(t=><option key={t}>{t}</option>)}</select></Fld>
        <Fld label="Цвят"><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{PALETTE.map(c=><div key={c} onClick={()=>setF(x=>({...x,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",border:f.color===c?"3px solid #1E293B":"3px solid transparent",transition:"border .1s"}}/>)}</div></Fld>
        {err&&<div style={{color:"#DC2626",fontSize:13,marginTop:4}}>{err}</div>}
      </div>
      <div className="action-buttons" style={{padding:isMobile ? "12px 16px" : "14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={S.outlineBtn}>Откажи</button>
        <button onClick={save} style={S.primaryBtn}>{isEdit?"Запази":"Добави стая"}</button>
      </div>
    </div>
  );
}

// ── STAFF MODAL ───────────────────────────────────────────────────────────────
function StaffModal({users,onSave,onClose}) {
  const [f,setF]=useState({id:`u${Date.now()}`,name:"",username:"",password:"",role:"staff"});
  const [err,setErr]=useState("");
  function save(){ if(!f.name.trim()||!f.username.trim()||!f.password.trim()) return setErr("Всички полета са задължителни."); if(users.find(u=>u.username===f.username)) return setErr("Потребителското иmе вече е заето."); onSave(f); }
  
  const isMobile = window.innerWidth <= 768;
  
  return (
    <div style={{...S.modal, maxWidth:isMobile ? "100%" : undefined}}>
      <div style={S.modalHeader}><span style={{...S.modalTitle,fontSize:isMobile ? 15 : 17}}>Добави служител</span><button onClick={onClose} style={S.closeBtn}>×</button></div>
      <div style={{padding:isMobile ? "14px 16px" : "18px 20px"}}>
        <Fld label="Пълно иmе">        <input value={f.name}     onChange={e=>setF(x=>({...x,name:e.target.value}))}     style={S.input} placeholder="напр. Мария Иванова"/></Fld>
        <Fld label="Потребителско иmе"><input value={f.username} onChange={e=>setF(x=>({...x,username:e.target.value}))} style={S.input}/></Fld>
        <Fld label="Парола">           <input type="password" value={f.password} onChange={e=>setF(x=>({...x,password:e.target.value}))} style={S.input}/></Fld>
        <Fld label="Роля"><select value={f.role} onChange={e=>setF(x=>({...x,role:e.target.value}))} style={S.input}><option value="staff">Служител</option><option value="admin">Администратор</option></select></Fld>
        {err&&<div style={{color:"#DC2626",fontSize:13}}>{err}</div>}
      </div>
      <div className="action-buttons" style={{padding:isMobile ? "12px 16px" : "14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={S.outlineBtn}>Откажи</button>
        <button onClick={save} style={S.primaryBtn}>Добави служител</button>
      </div>
    </div>
  );
}

// ── GUEST DIRECTORY ───────────────────────────────────────────────────────────
function GuestDirectory({guests,onEdit,onDelete}) {
  const [search,setSearch]=useState("");
  const [statusFilter,setStatusFilter]=useState("all");
  const filtered=guests.filter(g=>{
    const matchSearch=!search||g.name.toLowerCase().includes(search.toLowerCase())||g.phone?.includes(search)||g.email?.toLowerCase().includes(search.toLowerCase());
    const matchStatus=statusFilter==="all"||g.status===statusFilter;
    return matchSearch&&matchStatus;
  });
  
  const isMobile = window.innerWidth <= 768;
  
  return (
    <div>
      <div style={{display:"flex",gap:12,marginBottom:18,flexWrap:"wrap",alignItems:"center",flexDirection:isMobile ? "column" : "row"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Търси по иmе, телефон, имейл…" style={{...S.input,maxWidth:isMobile ? "100%" : 280,width:isMobile ? "100%" : undefined}}/>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...S.input,maxWidth:isMobile ? "100%" : 180,width:isMobile ? "100%" : undefined}}>
          <option value="all">Всички статуси</option>
          {Object.entries(GUEST_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        <span style={{fontSize:13,color:"#94A3B8",marginLeft:isMobile ? 0 : "auto"}}>{filtered.length} гости</span>
      </div>
      <div style={{background:"#fff",borderRadius:12,border:"1px solid #E2E8F0",overflow:"hidden",boxShadow:"0 1px 3px rgba(0,0,0,.04)"}}>
        {filtered.length===0
          ? <div style={{textAlign:"center",padding:52,color:"#CBD5E1",fontSize:15}}>Няма намерени гости</div>
          : <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:isMobile ? 12 : 13}}>
              <thead><tr>{(isMobile ? ["Гост","Престои","Статус",""] : ["Гост","Телефон","Имейл","Престои","Изразходвано","Последно посещение","Статус",""]).map(h=>(
                <th key={h} style={{textAlign:"left",padding:isMobile ? "8px 10px" : "10px 14px",background:"#F8FAFC",color:"#94A3B8",fontSize:11,fontWeight:700,letterSpacing:"1px",textTransform:"uppercase",borderBottom:"1px solid #E2E8F0",whiteSpace:"nowrap"}}>{h}</th>
              ))}</tr></thead>
              <tbody>
                {filtered.map(g=>{
                  const st=GUEST_STATUS[g.status]||GUEST_STATUS.regular;
                  return (
                    <tr key={g.id} className="rowhov" style={{borderBottom:"1px solid #F1F5F9"}}>
                      <td style={{padding:isMobile ? "10px 8px" : "12px 14px",fontWeight:600,color:"#1E293B"}}>
                        <div>{g.name}</div>
                        {isMobile && <div style={{fontSize:10,color:"#64748B",marginTop:2}}>{g.phone||"—"}</div>}
                      </td>
                      {!isMobile && (
                        <>
                          <td style={{padding:"12px 14px",color:"#374151"}}>{g.phone||"—"}</td>
                          <td style={{padding:"12px 14px",color:"#374151"}}>{g.email||"—"}</td>
                        </>
                      )}
                      <td style={{padding:isMobile ? "10px 8px" : "12px 14px",color:"#374151",textAlign:"center"}}>{g.totalStays||0}</td>
                      {!isMobile && (
                        <>
                          <td style={{padding:"12px 14px",fontWeight:600,color:"#1E293B"}}>€{g.totalSpent||0}</td>
                          <td style={{padding:"12px 14px",color:"#374151"}}>{g.lastVisit||"—"}</td>
                        </>
                      )}
                      <td style={{padding:isMobile ? "10px 8px" : "12px 14px"}}><span style={{fontSize:isMobile ? 10 : 11,fontWeight:600,padding:"3px 9px",borderRadius:999,background:st.bg,color:st.color,whiteSpace:"nowrap"}}>{st.label}</span></td>
                      <td style={{padding:isMobile ? "10px 8px" : "12px 14px",display:"flex",gap:6}}>
                        <button onClick={()=>onEdit(g)} style={{...S.outlineBtn,fontSize:isMobile ? 11 : 13,padding:isMobile ? "5px 10px" : "7px 14px"}}>Редактирай</button>
                        {onDelete&&<button onClick={()=>onDelete(g.id)} style={{...S.dangerBtn,fontSize:isMobile ? 11 : 13,padding:isMobile ? "5px 10px" : "7px 14px"}}>×</button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
        }
      </div>
    </div>
  );
}

// ── GUEST CONFLICT MODAL ──────────────────────────────────────────────────────
function GuestConflictModal({existingGuest,booking,onUseExisting,onCreateNew,onClose}) {
  const isMobile = window.innerWidth <= 768;
  
  return (
    <div style={{...S.modal, maxWidth:isMobile ? "100%" : undefined}}>
      <div style={S.modalHeader}><span style={{...S.modalTitle,fontSize:isMobile ? 15 : 17}}>⚠️ Възможен дубликат</span><button onClick={onClose} style={S.closeBtn}>×</button></div>
      <div style={{padding:isMobile ? "16px" : "20px"}}>
        <p style={{fontSize:isMobile ? 13 : 14,color:"#374151",marginBottom:16}}>Открит е гост с телефон <strong>{booking.phone}</strong>, но с различно иmе:</p>
        <div style={{display:"grid",gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr",gap:12,marginBottom:20}}>
          <div style={{background:"#F8FAFC",borderRadius:10,padding:"14px",border:"1px solid #E2E8F0"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",marginBottom:6,textTransform:"uppercase"}}>Съществуващ гост</div>
            <div style={{fontWeight:700,color:"#1E293B",fontSize:isMobile ? 13 : 14}}>{existingGuest.name}</div>
            <div style={{fontSize:12,color:"#64748B"}}>{existingGuest.phone}</div>
          </div>
          <div style={{background:"#FFF7ED",borderRadius:10,padding:"14px",border:"1px solid #FED7AA"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#94A3B8",marginBottom:6,textTransform:"uppercase"}}>Ново иmе</div>
            <div style={{fontWeight:700,color:"#1E293B",fontSize:isMobile ? 13 : 14}}>{booking.guestName}</div>
            <div style={{fontSize:12,color:"#64748B"}}>{booking.phone}</div>
          </div>
        </div>
        <p style={{fontSize:isMobile ? 12 : 13,color:"#64748B",marginBottom:16}}>Изберете как да продължите:</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <button onClick={()=>onUseExisting(booking)} style={{...S.outlineBtn,textAlign:"left",padding:"12px 14px"}}>
            <div style={{fontWeight:700,color:"#1E293B",fontSize:isMobile ? 13 : 14}}>Свържи с „{existingGuest.name}"</div>
            <div style={{fontSize:isMobile ? 11 : 12,color:"#64748B",marginTop:2}}>Tа е същия гост — резервацията ще се добави към неговия профил</div>
          </button>
          <button onClick={()=>onCreateNew(booking)} style={{...S.outlineBtn,textAlign:"left",padding:"12px 14px"}}>
            <div style={{fontWeight:700,color:"#1E293B",fontSize:isMobile ? 13 : 14}}>Създай нов профил за „{booking.guestName}"</div>
            <div style={{fontSize:isMobile ? 11 : 12,color:"#64748B",marginTop:2}}>Това е различен гост — ще се създаде отделен профил</div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── GUEST MODAL ───────────────────────────────────────────────────────────────
function GuestModal({initial,bookings,rooms,onSave,onClose}) {
  const [f,setF]=useState({...initial});
  const gBkgs=bookings.filter(b=>b.guestId===initial.id&&b.status!=="cancelled").sort((a,b)=>a.checkIn<b.checkIn?1:-1);
  const totalSpent=gBkgs.reduce((s,b)=>s+Number(b.totalPrice||0),0);
  
  const isMobile = window.innerWidth <= 768;
  
  return (
    <div style={{...S.modal,maxWidth:isMobile ? "100%" : 560, maxHeight:isMobile ? "100%" : "92vh"}}>
      <div style={S.modalHeader}><span style={{...S.modalTitle,fontSize:isMobile ? 15 : 17}}>{f.name}</span><button onClick={onClose} style={S.closeBtn}>×</button></div>
      <div style={{padding:isMobile ? "14px 16px" : "18px 20px",overflowY:"auto",maxHeight:isMobile ? "calc(100vh - 130px)" : "calc(90vh - 130px)"}}>
        <div style={{display:"grid",gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr",gap:12}}>
          <Fld label="Иmе"><input value={f.name} onChange={e=>setF(x=>({...x,name:e.target.value}))} style={S.input}/></Fld>
          <Fld label="Статус"><select value={f.status} onChange={e=>setF(x=>({...x,status:e.target.value}))} style={S.input}>
            {Object.entries(GUEST_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select></Fld>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isMobile ? "1fr" : "1fr 1fr",gap:12}}>
          <Fld label="Телефон"><input value={f.phone||""} onChange={e=>setF(x=>({...x,phone:e.target.value}))} style={S.input}/></Fld>
          <Fld label="Имейл"><input value={f.email||""} onChange={e=>setF(x=>({...x,email:e.target.value}))} style={S.input}/></Fld>
        </div>
        <Fld label="Националност"><input value={f.nationality||""} onChange={e=>setF(x=>({...x,nationality:e.target.value}))} style={S.input} placeholder="напр. Германия, Великобритания…"/></Fld>
        <Fld label="Бележки за госта"><textarea value={f.notes||""} onChange={e=>setF(x=>({...x,notes:e.target.value}))} style={{...S.input,minHeight:70,resize:"vertical"}} placeholder="VIP клиент, предпочитания, важна информация…"/></Fld>

        <div style={{marginTop:8,borderTop:"1px solid #F1F5F9",paddingTop:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <span style={{fontSize:12,fontWeight:700,color:"#475569",textTransform:"uppercase",letterSpacing:".06em"}}>История на престоите</span>
            <span style={{fontSize:12,color:"#94A3B8"}}>{gBkgs.length} престоя · €{totalSpent} общо</span>
          </div>
          {gBkgs.length===0
            ? <div style={{textAlign:"center",padding:"20px 0",color:"#CBD5E1",fontSize:13}}>Няма записани престои</div>
            : gBkgs.map(b=>{
                const room=rooms.find(r=>r.id===b.roomId);
                return (
                  <div key={b.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:"1px solid #F8FAFC",fontSize:isMobile ? 12 : 13}}>
                    <div><div style={{fontWeight:600,color:"#1E293B"}}>{room?.name||"—"}</div><div style={{fontSize:11,color:"#94A3B8"}}>{b.checkIn} → {b.checkOut}</div></div>
                    <div style={{textAlign:"right"}}><div style={{fontWeight:700}}>€{b.totalPrice}</div><div style={{fontSize:11,color:"#94A3B8"}}>{b.source||"—"}</div></div>
                  </div>
                );
              })
          }
        </div>
      </div>
      <div className="action-buttons" style={{padding:isMobile ? "12px 16px" : "14px 20px",borderTop:"1px solid #E2E8F0",display:"flex",gap:10,justifyContent:"flex-end"}}>
        <button onClick={onClose} style={S.outlineBtn}>Откажи</button>
        <button onClick={()=>onSave(f)} style={S.primaryBtn}>Запази</button>
      </div>
    </div>
  );
}


// ── Helpers ───────────────────────────────────────────────────────────────────
function Fld({label,children}) {
  return <div style={{marginBottom:14}}><div style={{fontSize:12,fontWeight:600,color:"#475569",marginBottom:5,letterSpacing:".03em"}}>{label}</div>{children}</div>;
}

const S={
  primaryBtn:{background:"#D97706",color:"#fff",border:"none",borderRadius:9,padding:"8px 16px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"},
  outlineBtn:{background:"transparent",color:"#1E293B",border:"1px solid #CBD5E1",borderRadius:9,padding:"7px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"},
  dangerBtn: {background:"#FEE2E2",color:"#991B1B",border:"none",borderRadius:9,padding:"7px 14px",fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"},
  navBtn:    {background:"#F1F5F9",border:"none",borderRadius:8,padding:"7px 14px",fontSize:16,cursor:"pointer",color:"#475569"},
  input:     {width:"100%",border:"1px solid #E2E8F0",borderRadius:8,padding:"8px 11px",fontSize:14,fontFamily:"'Inter',sans-serif",outline:"none",background:"#FAFAFA",color:"#1E293B",height:38,boxSizing:"border-box"},
  modal:     {background:"#fff",borderRadius:16,width:"100%",maxWidth:480,boxShadow:"0 20px 60px rgba(0,0,0,.25)",maxHeight:"92vh",display:"flex",flexDirection:"column"},
  modalHeader:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid #E2E8F0"},
  modalTitle:{fontFamily:"'Inter',sans-serif",fontSize:17,fontWeight:700,color:"#1E293B"},
  closeBtn:  {background:"transparent",border:"none",fontSize:20,cursor:"pointer",color:"#94A3B8",padding:"4px 8px",borderRadius:6},
};
