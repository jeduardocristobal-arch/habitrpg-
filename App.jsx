import { useState, useEffect, useCallback } from "react";

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const XP_PER_HABIT = 40;
const XP_LOSS_PER_DAY = 20;
const HP_LOSS_PER_DAY = 15;
const HP_LOSS_UNCOMPLETED = 8;
const STREAK_BONUS_XP = 15;
const MAX_STREAK_BONUS = 5;
const HP_PER_HABIT = 8;
const HP_PER_STREAK_DAY = 3;
const MAX_STREAK_HP_BONUS = 10;
const HP_STREAK_MILESTONE = 15;

// ─── INFINITE LEVEL SYSTEM ───────────────────────────────────────────────────
// XP needed to reach level N (from 0): floor(100 * N^1.6)
function xpForLevel(n) {
  if (n <= 1) return 0;
  return Math.floor(100 * Math.pow(n - 1, 1.6));
}

function getLevelFromXP(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  return level;
}

function getLevelInfo(xp) {
  const level = getLevelFromXP(xp);
  const currentXpNeeded = xpForLevel(level);
  const nextXpNeeded = xpForLevel(level + 1);
  const progress = ((xp - currentXpNeeded) / (nextXpNeeded - currentXpNeeded)) * 100;
  const title = getLevelTitle(level);
  return {
    current: { level, xpNeeded: currentXpNeeded, title },
    next: { level: level + 1, xpNeeded: nextXpNeeded },
    progress: Math.min(Math.max(progress, 0), 100),
  };
}

function getLevelTitle(level) {
  if (level < 5)   return "Aprendiz";
  if (level < 10)  return "Iniciado";
  if (level < 20)  return "Aventurero";
  if (level < 30)  return "Guerrero";
  if (level < 40)  return "Veterano";
  if (level < 50)  return "Héroe";
  if (level < 60)  return "Campeón";
  if (level < 75)  return "Maestro";
  if (level < 90)  return "Gran Maestro";
  if (level < 100) return "Leyenda";
  if (level < 125) return "Semidiós";
  if (level < 150) return "Dios Menor";
  if (level < 200) return "Dios Mayor";
  return "Ser Supremo";
}

// ─── EVOLUTION TIERS (wide gaps) ─────────────────────────────────────────────
// Brackets: 1-4, 5-9, 10-19, 20-29, 30-39, 40-49, 50-59, 60-74, 75-89, 90-99,
//           100-124, 125-149, 150-199, 200+
const EVOLUTIONS = [
  { minLevel:1,   maxLevel:4,   name:"Huevo Roto",       emoji:"🥚", color:"#94a3b8", aura:"rgba(148,163,184,0.2)", description:"Tu viaje apenas comienza. Cada gran historia empieza aquí." },
  { minLevel:5,   maxLevel:9,   name:"Slime Despertado", emoji:"🫧", color:"#67e8f9", aura:"rgba(103,232,249,0.3)", description:"Algo dentro de ti ha despertado. El potencial es real." },
  { minLevel:10,  maxLevel:19,  name:"Lobo de las Sombras", emoji:"🐺", color:"#a78bfa", aura:"rgba(167,139,250,0.35)", description:"El instinto te guía. Eres peligroso cuando te lo propones." },
  { minLevel:20,  maxLevel:29,  name:"Dragón Joven",     emoji:"🐉", color:"#34d399", aura:"rgba(52,211,153,0.35)", description:"Las llamas comienzan a arder. Tu poder es palpable." },
  { minLevel:30,  maxLevel:39,  name:"Fénix Ardiente",   emoji:"🔥", color:"#fb923c", aura:"rgba(251,146,60,0.4)", description:"Renaces más fuerte cada día. El fuego nunca miente." },
  { minLevel:40,  maxLevel:49,  name:"Titán de Hierro",  emoji:"⚡", color:"#facc15", aura:"rgba(250,204,21,0.4)", description:"La disciplina te forjó en acero. Nada te detiene." },
  { minLevel:50,  maxLevel:59,  name:"Arcángel",         emoji:"🪽", color:"#f0abfc", aura:"rgba(240,171,252,0.45)", description:"La luz emana de ti. Tu constancia es sagrada." },
  { minLevel:60,  maxLevel:74,  name:"Kraken Ancestral", emoji:"🦑", color:"#38bdf8", aura:"rgba(56,189,248,0.45)", description:"Dominas las profundidades del tiempo y la voluntad." },
  { minLevel:75,  maxLevel:89,  name:"Dragón Cósmico",   emoji:"🌌", color:"#c084fc", aura:"rgba(192,132,252,0.5)", description:"El cosmos se inclina ante tu disciplina infinita." },
  { minLevel:90,  maxLevel:99,  name:"Lich Eterno",      emoji:"💀", color:"#e879f9", aura:"rgba(232,121,249,0.5)", description:"Has trascendido la muerte misma. Eres inmortal." },
  { minLevel:100, maxLevel:124, name:"Semidiós",         emoji:"⚜️", color:"#fde68a", aura:"rgba(253,230,138,0.55)", description:"Los mortales te miran con reverencia. Eres más que humano." },
  { minLevel:125, maxLevel:149, name:"Dios del Orden",   emoji:"🏛️", color:"#bfdbfe", aura:"rgba(191,219,254,0.55)", description:"La realidad misma se dobla ante tu voluntad." },
  { minLevel:150, maxLevel:199, name:"Dios Mayor",       emoji:"🌠", color:"#fca5a5", aura:"rgba(252,165,165,0.6)", description:"Eres una fuerza primordial. El universo te reconoce." },
  { minLevel:200, maxLevel:Infinity, name:"El Absoluto", emoji:"🌟", color:"#fbbf24", aura:"rgba(251,191,36,0.7)", description:"Más allá de los dioses. El Absoluto. El fin y el principio." },
];

function getEvolution(level) {
  return EVOLUTIONS.find(e => level >= e.minLevel && level <= e.maxLevel) || EVOLUTIONS[0];
}

// Check if this level triggers a NEW evolution (crossed a threshold)
function crossedEvolution(oldLevel, newLevel) {
  const oldEvo = getEvolution(oldLevel);
  const newEvo = getEvolution(newLevel);
  return oldEvo.name !== newEvo.name ? newEvo : null;
}

const todayKey = () => new Date().toISOString().split("T")[0];

function loadState() {
  try {
    const raw = localStorage.getItem("habitrpg_v3");
    if (raw) return JSON.parse(raw);
  } catch (_) {}
  return null;
}

function saveState(s) {
  try { localStorage.setItem("habitrpg_v3", JSON.stringify(s)); } catch (_) {}
}

const defaultState = () => ({
  xp: 0,
  hp: 100,
  maxHp: 100,
  streak: 0,
  lastDate: todayKey(),
  habits: [],
  completedToday: {},
  dead: false,
  log: [],
  notifications: [],
  totalDays: 1,
});

// ─── TOAST COMPONENT ────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div style={{
      position:"fixed", bottom: 90, left:"50%", transform:"translateX(-50%)",
      background: msg.type === "gain" ? "linear-gradient(135deg,#22c55e,#16a34a)"
                : msg.type === "loss" ? "linear-gradient(135deg,#ef4444,#b91c1c)"
                : msg.type === "level" ? "linear-gradient(135deg,#f59e0b,#d97706)"
                : "linear-gradient(135deg,#6366f1,#4f46e5)",
      color:"#fff", padding:"10px 20px", borderRadius:24, fontWeight:700,
      fontSize:14, zIndex:9999, boxShadow:"0 8px 32px rgba(0,0,0,0.4)",
      whiteSpace:"nowrap", animation:"slideUp 0.3s ease",
    }}>
      {msg.text}
    </div>
  );
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function HabitRPG() {
  const [state, setState] = useState(() => {
    const saved = loadState();
    if (!saved) return defaultState();

    // Day transition logic on load
    const today = todayKey();
    if (saved.lastDate !== today && !saved.dead) {
      const daysPassed = Math.max(1, Math.ceil(
        (new Date(today) - new Date(saved.lastDate)) / 86400000
      ));
      let { xp, hp, streak, completedToday, habits, log, totalDays } = saved;
      const incompleteCount = habits.filter(h => !completedToday[h.id]).length;

      let hpLoss = HP_LOSS_PER_DAY * daysPassed + HP_LOSS_UNCOMPLETED * incompleteCount;
      let xpLoss = XP_LOSS_PER_DAY * daysPassed;

      // streak logic
      const allDone = habits.length > 0 && incompleteCount === 0;
      streak = allDone ? streak + 1 : 0;
      // Streak HP bonus applied at day end if all done
      const streakHpHeal = allDone ? Math.min(streak, MAX_STREAK_HP_BONUS) * HP_PER_STREAK_DAY + HP_STREAK_MILESTONE : 0;

      hp = Math.max(0, hp - hpLoss + streakHpHeal);
      xp = Math.max(0, xp - xpLoss);
      totalDays = (totalDays || 1) + daysPassed;

      const newLog = [
        `📅 Nuevo día. HP -${hpLoss}${streakHpHeal > 0 ? ` +${streakHpHeal}` : ""} | XP -${xpLoss}`,
        allDone && streak > 1 ? `🔥 ¡Racha de ${streak} días! +${streakHpHeal} HP recuperados` : null,
      ].filter(Boolean);

      return {
        ...saved,
        xp, hp, streak,
        completedToday: {},
        lastDate: today,
        dead: hp <= 0,
        log: [...newLog, ...(log || [])].slice(0, 50),
        totalDays,
      };
    }
    return saved;
  });

  const [toast, setToast] = useState(null);
  const [tab, setTab] = useState("home"); // home | habits | log | shop
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabit, setNewHabit] = useState({ name: "", xp: XP_PER_HABIT, emoji: "⭐" });
  const [showDead, setShowDead] = useState(state.dead);
  const [showEvolution, setShowEvolution] = useState(null);

  const pushToast = (text, type = "info") => setToast({ text, type });

  const update = useCallback((fn) => {
    setState(prev => {
      const next = fn(prev);
      // Check level up
      const oldLevel = getLevelInfo(prev.xp).current.level;
      const newLevel = getLevelInfo(next.xp).current.level;
      if (newLevel > oldLevel) {
        const evo = crossedEvolution(oldLevel, newLevel);
        setTimeout(() => {
          if (evo) {
            setShowEvolution({ level: newLevel, evo });
            pushToast(`🌟 ¡EVOLUCIÓN! → ${evo.name}`, "level");
          } else {
            pushToast(`⚡ ¡NIVEL ${newLevel}! ${getEvolution(newLevel).name}`, "level");
          }
        }, 200);
      }
      saveState(next);
      return next;
    });
  }, []);

  const completeHabit = (habit) => {
    if (state.completedToday[habit.id] || state.dead) return;
    const bonusXp = Math.min(state.streak, MAX_STREAK_BONUS) * STREAK_BONUS_XP;
    const earned = habit.xp + bonusXp;
    // HP healing: base + racha bonus
    const streakHpBonus = Math.min(state.streak, MAX_STREAK_HP_BONUS) * HP_PER_STREAK_DAY;
    const healAmt = HP_PER_HABIT + streakHpBonus;
    // Check if this completes ALL habits → milestone bonus
    const newCompleted = { ...state.completedToday, [habit.id]: true };
    const allDoneNow = state.habits.every(h => newCompleted[h.id]);
    const milestoneHp = allDoneNow ? HP_STREAK_MILESTONE : 0;
    const totalHeal = healAmt + milestoneHp;
    update(prev => {
      const newCompleted2 = { ...prev.completedToday, [habit.id]: true };
      const allDone2 = prev.habits.every(h => newCompleted2[h.id]);
      const milestone2 = allDone2 ? HP_STREAK_MILESTONE : 0;
      const heal2 = HP_PER_HABIT + Math.min(prev.streak, MAX_STREAK_HP_BONUS) * HP_PER_STREAK_DAY + milestone2;
      return {
        ...prev,
        xp: prev.xp + earned,
        hp: Math.min(prev.maxHp, prev.hp + heal2),
        completedToday: newCompleted2,
        log: [
          allDone2
            ? `🏆 ¡Todos los hábitos! +${earned}XP +${heal2}HP (bonus racha incluido)`
            : `✅ ${habit.emoji} ${habit.name} +${earned}XP +${heal2}HP`,
          ...prev.log
        ].slice(0, 50),
      };
    });
    const msg = allDoneNow
      ? `+${earned}XP ⚡  +${totalHeal}HP 💚 ¡Todo completado!`
      : `+${earned}XP ⚡  +${totalHeal}HP 💚${streakHpBonus > 0 ? ` (racha +${streakHpBonus})` : ""}`;
    pushToast(msg, "gain");
  };

  const addHabit = () => {
    if (!newHabit.name.trim()) return;
    const habit = {
      id: Date.now().toString(),
      name: newHabit.name.trim(),
      xp: Number(newHabit.xp) || XP_PER_HABIT,
      emoji: newHabit.emoji || "⭐",
    };
    update(prev => ({
      ...prev,
      habits: [...prev.habits, habit],
      log: [`➕ Hábito añadido: ${habit.emoji} ${habit.name}`, ...prev.log].slice(0, 50),
    }));
    setNewHabit({ name: "", xp: XP_PER_HABIT, emoji: "⭐" });
    setShowAddHabit(false);
    pushToast("Hábito añadido 🎯", "info");
  };

  const deleteHabit = (id) => {
    update(prev => ({
      ...prev,
      habits: prev.habits.filter(h => h.id !== id),
    }));
  };

  const revive = () => {
    update(prev => ({
      ...prev,
      hp: 30,
      xp: Math.max(0, prev.xp - 200),
      streak: 0,
      dead: false,
      log: ["💀 Resurrección. -200 XP. Comienza de nuevo...", ...prev.log].slice(0, 50),
    }));
    setShowDead(false);
    pushToast("Resucitaste... -200 XP 💀", "loss");
  };

  const { current: lvlInfo, next: lvlNext, progress: lvlProgress } = getLevelInfo(state.xp);
  const evolution = getEvolution(lvlInfo.level);
  const completedCount = Object.keys(state.completedToday).length;
  const totalHabits = state.habits.length;
  const hpPct = (state.hp / state.maxHp) * 100;
  const xpToNext = lvlNext ? lvlNext.xpNeeded - state.xp : 0;

  const emojis = ["⭐","🏃","💪","📚","🧘","🥗","💧","😴","🎯","🧠","✍️","🎨","🎵","💻","🌿"];

  const styles = `
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@400;600;700;800&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0a1a; }
    @keyframes slideUp { from { transform: translateX(-50%) translateY(20px); opacity:0; } to { transform: translateX(-50%) translateY(0); opacity:1; } }
    @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.07); } }
    @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
    @keyframes glow { 0%,100% { filter: drop-shadow(0 0 8px ${evolution.aura || "transparent"}); } 50% { filter: drop-shadow(0 0 24px ${evolution.aura || "transparent"}); } }
    @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
    @keyframes fadeIn { from { opacity:0; transform:scale(0.9); } to { opacity:1; transform:scale(1); } }
    @keyframes heartbeat { 0%,100% { transform:scale(1); } 15% { transform:scale(1.25); } 30% { transform:scale(1); } }
    .hab-btn:active { transform: scale(0.95); }
    ::-webkit-scrollbar { width: 4px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  `;

  return (
    <>
      <style>{styles}</style>
      <div style={{
        width: "100%", maxWidth: 430, minHeight: "100vh",
        margin: "0 auto", background: "linear-gradient(180deg, #0d0d2b 0%, #0a0a1a 100%)",
        fontFamily: "'Nunito', sans-serif", color: "#e2e8f0",
        position: "relative", overflow: "hidden",
        paddingBottom: 70,
      }}>
        {/* Stars background */}
        <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:0, overflow:"hidden" }}>
          {[...Array(30)].map((_,i) => (
            <div key={i} style={{
              position:"absolute",
              width: Math.random()*2+1, height: Math.random()*2+1,
              background:"white", borderRadius:"50%",
              left: `${Math.random()*100}%`, top: `${Math.random()*100}%`,
              opacity: Math.random()*0.5+0.1,
              animation: `pulse ${2+Math.random()*3}s ease-in-out infinite`,
              animationDelay: `${Math.random()*3}s`,
            }}/>
          ))}
        </div>

        {/* DEAD SCREEN */}
        {showDead && (
          <div style={{
            position:"fixed", inset:0, background:"rgba(0,0,0,0.95)",
            zIndex:999, display:"flex", flexDirection:"column",
            alignItems:"center", justifyContent:"center", padding:32,
            animation:"fadeIn 0.5s ease",
          }}>
            <div style={{ fontSize:80, animation:"float 2s ease-in-out infinite" }}>💀</div>
            <h1 style={{ fontFamily:"Cinzel", fontSize:32, color:"#ef4444", marginTop:16, textAlign:"center" }}>
              HAS CAÍDO
            </h1>
            <p style={{ color:"#94a3b8", textAlign:"center", marginTop:12, fontSize:14, lineHeight:1.6 }}>
              Tu personaje ha muerto por abandonar sus hábitos.
              La disciplina es el camino hacia el poder.
            </p>
            <div style={{
              background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.3)",
              borderRadius:16, padding:"16px 24px", marginTop:24, textAlign:"center"
            }}>
              <p style={{ color:"#fca5a5", fontSize:13 }}>Penalización por revivir</p>
              <p style={{ color:"#ef4444", fontWeight:800, fontSize:20 }}>-200 XP | Racha perdida</p>
            </div>
            <button onClick={revive} style={{
              marginTop:28, padding:"14px 40px",
              background:"linear-gradient(135deg,#ef4444,#991b1b)",
              border:"none", borderRadius:50, color:"#fff",
              fontFamily:"Cinzel", fontWeight:700, fontSize:16, cursor:"pointer",
              boxShadow:"0 0 30px rgba(239,68,68,0.5)",
            }}>
              💀 REVIVIR
            </button>
          </div>
        )}

        {/* EVOLUTION MODAL */}
        {showEvolution && (() => {
          const modalEvo = showEvolution.evo || getEvolution(showEvolution.level || showEvolution);
          return (
            <div onClick={() => setShowEvolution(null)} style={{
              position:"fixed", inset:0, background:"rgba(0,0,0,0.92)",
              zIndex:998, display:"flex", flexDirection:"column",
              alignItems:"center", justifyContent:"center", padding:32,
              animation:"fadeIn 0.4s ease",
            }}>
              <div style={{ fontSize:12, color: modalEvo.color, letterSpacing:6, fontFamily:"Cinzel", marginBottom:8 }}>
                ✦ EVOLUCIÓN ✦
              </div>
              <div style={{ fontSize:96, animation:"float 1.5s ease-in-out infinite", filter:`drop-shadow(0 0 30px ${modalEvo.aura})` }}>
                {modalEvo.emoji}
              </div>
              <div style={{ fontFamily:"Cinzel", fontSize:26, color:"#fff", marginTop:16, textAlign:"center" }}>
                {modalEvo.name}
              </div>
              <div style={{ fontSize:11, color: modalEvo.color, marginTop:6 }}>
                Nivel {showEvolution.level || "?"} · {modalEvo.minLevel}–{modalEvo.maxLevel === Infinity ? "∞" : modalEvo.maxLevel}
              </div>
              <p style={{ color:"#64748b", marginTop:14, textAlign:"center", fontStyle:"italic", fontSize:13, maxWidth:260, lineHeight:1.6 }}>
                "{modalEvo.description}"
              </p>
              <p style={{ color:"#334155", marginTop:24, fontSize:11 }}>Toca para continuar</p>
            </div>
          );
        })()}

        {/* TOAST */}
        {toast && <Toast msg={toast} onDone={() => setToast(null)} />}

        {/* ── HEADER ── */}
        <div style={{
          position:"relative", zIndex:1,
          padding:"20px 20px 0",
        }}>
          {/* Character card */}
          <div style={{
            background:"linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))",
            border:"1px solid rgba(99,102,241,0.25)",
            borderRadius:24, padding:"20px",
            backdropFilter:"blur(10px)",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              {/* Avatar */}
              <div style={{
                width:72, height:72, borderRadius:20,
                background:`linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.2))`,
                border:`2px solid ${evolution.color}`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:38, animation:"float 3s ease-in-out infinite, glow 3s ease-in-out infinite",
                flexShrink:0, position:"relative",
                boxShadow: `0 0 20px ${evolution.aura || "transparent"}`,
              }}>
                {evolution.emoji}
                {state.streak > 0 && (
                  <div style={{
                    position:"absolute", top:-6, right:-6,
                    background:"linear-gradient(135deg,#f59e0b,#d97706)",
                    borderRadius:10, padding:"1px 6px", fontSize:10, fontWeight:800,
                  }}>
                    🔥{state.streak}
                  </div>
                )}
              </div>
              {/* Info */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{
                    fontFamily:"Cinzel", fontSize:11, color:evolution.color,
                    letterSpacing:2, textTransform:"uppercase",
                  }}>Nv.{lvlInfo.level}</span>
                  <span style={{ fontSize:11, color:"#64748b" }}>•</span>
                  <span style={{ fontSize:11, color:"#64748b" }}>{lvlInfo.title}</span>
                </div>
                <div style={{ fontFamily:"Cinzel", fontSize:18, fontWeight:900, color:"#fff", marginTop:2 }}>
                  {evolution.name}
                </div>
                <div style={{ fontSize:11, color:"#64748b", marginTop:1 }}>
                  {state.totalDays || 1} días activo • {state.xp} XP total
                </div>
              </div>
            </div>

            {/* HP Bar */}
            <div style={{ marginTop:14 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:11, color:"#f87171", fontWeight:700 }}>
                  ❤️ VIDA  {state.hp}/{state.maxHp}
                </span>
                <span style={{ fontSize:11, color:"#94a3b8" }}>
                  {hpPct < 30 ? "⚠️ ¡Peligro!" : hpPct < 60 ? "🟡 Cuidado" : "💚 Saludable"}
                </span>
              </div>
              <div style={{ height:10, background:"rgba(255,255,255,0.06)", borderRadius:6, overflow:"hidden" }}>
                <div style={{
                  height:"100%", width:`${hpPct}%`,
                  background: hpPct < 30
                    ? "linear-gradient(90deg,#dc2626,#ef4444)"
                    : hpPct < 60
                    ? "linear-gradient(90deg,#d97706,#f59e0b)"
                    : "linear-gradient(90deg,#16a34a,#22c55e)",
                  borderRadius:6, transition:"width 0.5s ease",
                  animation: hpPct < 30 ? "heartbeat 1s ease-in-out infinite" : "none",
                }} />
              </div>
            </div>

            {/* XP Bar */}
            <div style={{ marginTop:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:11, color:"#a78bfa", fontWeight:700 }}>
                  ⚡ XP  {state.xp}
                </span>
                <span style={{ fontSize:11, color:"#64748b" }}>
                  {lvlNext ? `${xpToNext} para Nv.${lvlNext.level}` : "¡Máx nivel!"}
                </span>
              </div>
              <div style={{ height:8, background:"rgba(255,255,255,0.06)", borderRadius:6, overflow:"hidden" }}>
                <div style={{
                  height:"100%", width:`${lvlProgress}%`,
                  background:"linear-gradient(90deg,#6366f1,#a855f7)",
                  borderRadius:6, transition:"width 0.6s ease",
                  backgroundSize:"200% auto",
                  animation:"shimmer 2s linear infinite",
                }} />
              </div>
            </div>

            {/* Daily progress */}
            {totalHabits > 0 && (
              <div style={{
                marginTop:12, display:"flex", alignItems:"center",
                gap:8, background:"rgba(255,255,255,0.04)",
                borderRadius:12, padding:"8px 12px",
              }}>
                <div style={{ fontSize:12, color:"#64748b", flex:1 }}>
                  Hábitos hoy
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  {state.habits.map(h => (
                    <div key={h.id} style={{
                      width:8, height:8, borderRadius:"50%",
                      background: state.completedToday[h.id]
                        ? "#22c55e" : "rgba(255,255,255,0.12)",
                      transition:"background 0.3s",
                    }}/>
                  ))}
                </div>
                <div style={{
                  fontSize:12, fontWeight:800,
                  color: completedCount === totalHabits ? "#22c55e" : "#94a3b8"
                }}>
                  {completedCount}/{totalHabits}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div style={{ position:"relative", zIndex:1, padding:"16px 20px" }}>

          {/* HOME TAB */}
          {tab === "home" && (
            <div>
              {/* Quick stats row */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
                {[
                  { label:"Racha", value:`${state.streak}🔥`, color:"#f59e0b" },
                  { label:"Nivel", value:lvlInfo.level, color:"#a78bfa" },
                  { label:"Días", value:state.totalDays||1, color:"#38bdf8" },
                ].map(s => (
                  <div key={s.label} style={{
                    background:"rgba(255,255,255,0.04)",
                    border:"1px solid rgba(255,255,255,0.07)",
                    borderRadius:16, padding:"12px 8px", textAlign:"center",
                  }}>
                    <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.value}</div>
                    <div style={{ fontSize:10, color:"#475569", marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Today's habits */}
              <div style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <span style={{ fontFamily:"Cinzel", fontSize:13, color:"#94a3b8", letterSpacing:2 }}>
                    HÁBITOS DE HOY
                  </span>
                  <button onClick={() => setTab("habits")} style={{
                    background:"rgba(99,102,241,0.2)", border:"1px solid rgba(99,102,241,0.3)",
                    borderRadius:20, padding:"4px 12px", color:"#a5b4fc", fontSize:11,
                    cursor:"pointer", fontFamily:"Nunito", fontWeight:700,
                  }}>
                    + Gestionar
                  </button>
                </div>

                {state.habits.length === 0 ? (
                  <div style={{
                    background:"rgba(255,255,255,0.03)", border:"1px dashed rgba(255,255,255,0.1)",
                    borderRadius:20, padding:24, textAlign:"center",
                  }}>
                    <div style={{ fontSize:32 }}>🎯</div>
                    <p style={{ color:"#475569", fontSize:13, marginTop:8 }}>
                      Aún no tienes hábitos.
                    </p>
                    <p style={{ color:"#334155", fontSize:11, marginTop:4 }}>
                      Ve a "Hábitos" para añadir los tuyos.
                    </p>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {state.habits.map(habit => {
                      const done = !!state.completedToday[habit.id];
                      return (
                        <button
                          key={habit.id}
                          className="hab-btn"
                          onClick={() => completeHabit(habit)}
                          disabled={done || state.dead}
                          style={{
                            display:"flex", alignItems:"center", gap:14,
                            padding:"14px 16px",
                            background: done
                              ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.08))"
                              : "rgba(255,255,255,0.04)",
                            border: done
                              ? "1px solid rgba(34,197,94,0.4)"
                              : "1px solid rgba(255,255,255,0.07)",
                            borderRadius:18, cursor: done ? "default" : "pointer",
                            transition:"all 0.25s ease", textAlign:"left",
                            width:"100%",
                          }}
                        >
                          <div style={{
                            width:44, height:44, borderRadius:14,
                            background: done
                              ? "linear-gradient(135deg,#22c55e,#16a34a)"
                              : "rgba(255,255,255,0.06)",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:22, flexShrink:0, transition:"all 0.25s",
                          }}>
                            {done ? "✅" : habit.emoji}
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{
                              fontSize:14, fontWeight:700,
                              color: done ? "#86efac" : "#e2e8f0",
                              textDecoration: done ? "line-through" : "none",
                            }}>
                              {habit.name}
                            </div>
                            <div style={{ fontSize:11, color:"#475569", marginTop:2 }}>
                              {done ? "¡Completado! 🎉" : (() => {
                                const streakHp = Math.min(state.streak, MAX_STREAK_HP_BONUS) * HP_PER_STREAK_DAY;
                                const total = HP_PER_HABIT + streakHp;
                                return `+${habit.xp} XP · +${total} HP${streakHp > 0 ? ` (racha +${streakHp})` : ""}`;
                              })()}
                            </div>
                          </div>
                          {!done && (
                            <div style={{
                              background:"linear-gradient(135deg,rgba(99,102,241,0.3),rgba(168,85,247,0.2))",
                              border:"1px solid rgba(99,102,241,0.4)",
                              borderRadius:10, padding:"4px 10px",
                              fontSize:11, fontWeight:800, color:"#c4b5fd",
                              flexShrink:0,
                            }}>
                              +{habit.xp}⚡
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Streak & healing info */}
              {state.streak > 0 && (
                <div style={{
                  background:"linear-gradient(135deg,rgba(245,158,11,0.1),rgba(217,119,6,0.05))",
                  border:"1px solid rgba(245,158,11,0.2)",
                  borderRadius:16, padding:"12px 16px", marginTop:4,
                }}>
                  <div style={{ fontSize:12, color:"#fbbf24", fontWeight:800 }}>
                    🔥 RACHA ACTIVA · {state.streak} días
                  </div>
                  <div style={{ fontSize:11, color:"#78716c", marginTop:6, display:"flex", flexDirection:"column", gap:3 }}>
                    <span>⚡ +{Math.min(state.streak, MAX_STREAK_BONUS) * STREAK_BONUS_XP} XP extra por hábito</span>
                    <span>💚 +{HP_PER_HABIT + Math.min(state.streak, MAX_STREAK_HP_BONUS) * HP_PER_STREAK_DAY} HP por hábito completado</span>
                    <span style={{ color:"#a16207" }}>🏆 +{HP_STREAK_MILESTONE} HP extra al completar todos los hábitos del día</span>
                  </div>
                </div>
              )}
              {state.streak === 0 && state.habits.length > 0 && (
                <div style={{
                  background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)",
                  borderRadius:16, padding:"12px 16px", marginTop:4,
                }}>
                  <div style={{ fontSize:11, color:"#334155", lineHeight:1.7 }}>
                    <span style={{ color:"#475569", fontWeight:700 }}>💡 Healing base:</span> cada hábito te da <span style={{ color:"#22c55e" }}>+{HP_PER_HABIT} HP</span>.
                    Con racha activa ganas hasta <span style={{ color:"#22c55e" }}>+{HP_PER_HABIT + MAX_STREAK_HP_BONUS * HP_PER_STREAK_DAY} HP</span> por hábito
                    y <span style={{ color:"#f59e0b" }}>+{HP_STREAK_MILESTONE} HP</span> al completarlos todos.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* HABITS TAB */}
          {tab === "habits" && (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <span style={{ fontFamily:"Cinzel", fontSize:13, color:"#94a3b8", letterSpacing:2 }}>
                  MIS HÁBITOS
                </span>
                <button onClick={() => setShowAddHabit(true)} style={{
                  background:"linear-gradient(135deg,#6366f1,#a855f7)",
                  border:"none", borderRadius:20, padding:"8px 16px",
                  color:"#fff", fontSize:12, fontWeight:800, cursor:"pointer",
                  fontFamily:"Nunito",
                }}>
                  + Añadir
                </button>
              </div>

              {showAddHabit && (
                <div style={{
                  background:"rgba(99,102,241,0.08)",
                  border:"1px solid rgba(99,102,241,0.25)",
                  borderRadius:20, padding:20, marginBottom:16,
                  animation:"fadeIn 0.3s ease",
                }}>
                  <div style={{ fontSize:13, fontWeight:800, color:"#a5b4fc", marginBottom:14 }}>
                    ✨ Nuevo hábito
                  </div>
                  {/* Emoji picker */}
                  <div style={{ marginBottom:12 }}>
                    <div style={{ fontSize:11, color:"#64748b", marginBottom:6 }}>Ícono</div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      {emojis.map(e => (
                        <button key={e} onClick={() => setNewHabit(h=>({...h,emoji:e}))} style={{
                          width:36, height:36, borderRadius:10, fontSize:18,
                          background: newHabit.emoji === e
                            ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.05)",
                          border: newHabit.emoji === e
                            ? "1px solid rgba(99,102,241,0.7)" : "1px solid rgba(255,255,255,0.07)",
                          cursor:"pointer", transition:"all 0.15s",
                        }}>
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    placeholder="Nombre del hábito..."
                    value={newHabit.name}
                    onChange={e => setNewHabit(h=>({...h, name:e.target.value}))}
                    style={{
                      width:"100%", padding:"12px 16px",
                      background:"rgba(255,255,255,0.05)",
                      border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:14, color:"#e2e8f0", fontSize:14,
                      outline:"none", fontFamily:"Nunito", marginBottom:10,
                    }}
                  />
                  <div style={{ marginBottom:14 }}>
                    <div style={{ fontSize:11, color:"#64748b", marginBottom:6 }}>
                      XP por completar: {newHabit.xp}⚡
                    </div>
                    <input
                      type="range" min={10} max={100} step={5}
                      value={newHabit.xp}
                      onChange={e => setNewHabit(h=>({...h, xp:Number(e.target.value)}))}
                      style={{ width:"100%", accentColor:"#6366f1" }}
                    />
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:10, color:"#334155" }}>
                      <span>Fácil (10)</span><span>Difícil (100)</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={addHabit} style={{
                      flex:1, padding:"12px",
                      background:"linear-gradient(135deg,#6366f1,#a855f7)",
                      border:"none", borderRadius:14, color:"#fff",
                      fontWeight:800, fontSize:13, cursor:"pointer", fontFamily:"Nunito",
                    }}>
                      ✅ Guardar
                    </button>
                    <button onClick={() => setShowAddHabit(false)} style={{
                      flex:1, padding:"12px",
                      background:"rgba(255,255,255,0.05)",
                      border:"1px solid rgba(255,255,255,0.1)",
                      borderRadius:14, color:"#64748b",
                      fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"Nunito",
                    }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {state.habits.length === 0 ? (
                <div style={{
                  background:"rgba(255,255,255,0.03)", border:"1px dashed rgba(255,255,255,0.1)",
                  borderRadius:20, padding:32, textAlign:"center",
                }}>
                  <div style={{ fontSize:40 }}>📋</div>
                  <p style={{ color:"#475569", marginTop:12, fontSize:13 }}>
                    Añade tus primeros hábitos y comienza tu aventura
                  </p>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {state.habits.map(habit => (
                    <div key={habit.id} style={{
                      display:"flex", alignItems:"center", gap:12,
                      background:"rgba(255,255,255,0.04)",
                      border:"1px solid rgba(255,255,255,0.07)",
                      borderRadius:18, padding:"12px 16px",
                    }}>
                      <div style={{ fontSize:24 }}>{habit.emoji}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700 }}>{habit.name}</div>
                        <div style={{ fontSize:11, color:"#475569" }}>+{habit.xp} XP · se repite cada día</div>
                      </div>
                      <button onClick={() => deleteHabit(habit.id)} style={{
                        background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.2)",
                        borderRadius:10, width:34, height:34, cursor:"pointer",
                        color:"#f87171", fontSize:16,
                      }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LOG TAB */}
          {tab === "log" && (
            <div>
              <div style={{ fontFamily:"Cinzel", fontSize:13, color:"#94a3b8", letterSpacing:2, marginBottom:16 }}>
                HISTORIAL
              </div>
              {state.log.length === 0 ? (
                <div style={{ textAlign:"center", color:"#475569", padding:32, fontSize:13 }}>
                  Nada por aquí todavía...
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  {state.log.map((entry, i) => (
                    <div key={i} style={{
                      background:"rgba(255,255,255,0.03)",
                      border:"1px solid rgba(255,255,255,0.05)",
                      borderRadius:12, padding:"10px 14px",
                      fontSize:12, color:"#64748b",
                    }}>
                      {entry}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* LEVELS TAB */}
          {tab === "levels" && (
            <div>
              <div style={{ fontFamily:"Cinzel", fontSize:13, color:"#94a3b8", letterSpacing:2, marginBottom:4 }}>
                ÁRBOL DE EVOLUCIONES
              </div>
              <div style={{ fontSize:11, color:"#334155", marginBottom:16 }}>
                Nivel actual: {lvlInfo.level} · {state.xp} XP total
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {EVOLUTIONS.map((evo, i) => {
                  const unlocked = lvlInfo.level >= evo.minLevel;
                  const current = lvlInfo.level >= evo.minLevel && lvlInfo.level <= evo.maxLevel;
                  const rangeLabel = evo.maxLevel === Infinity
                    ? `Nv. ${evo.minLevel}+`
                    : `Nv. ${evo.minLevel}–${evo.maxLevel}`;
                  return (
                    <div key={i} style={{
                      display:"flex", alignItems:"center", gap:14,
                      background: current
                        ? `linear-gradient(135deg, ${evo.color}18, ${evo.color}08)`
                        : unlocked ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.015)",
                      border: current
                        ? `1px solid ${evo.color}60`
                        : unlocked ? `1px solid rgba(255,255,255,0.08)` : "1px solid rgba(255,255,255,0.03)",
                      borderRadius:18, padding:"14px 16px",
                      position:"relative", overflow:"hidden",
                    }}>
                      {current && (
                        <div style={{
                          position:"absolute", top:6, right:10,
                          fontSize:9, fontWeight:800, color:evo.color,
                          letterSpacing:2, opacity:0.8,
                        }}>ACTUAL</div>
                      )}
                      <div style={{
                        fontSize:32, opacity: unlocked ? 1 : 0.2,
                        filter: current ? `drop-shadow(0 0 10px ${evo.aura})` : "none",
                        flexShrink:0,
                        animation: current ? "float 3s ease-in-out infinite" : "none",
                      }}>
                        {unlocked ? evo.emoji : "🔒"}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{
                          fontSize:14, fontWeight:800,
                          color: current ? evo.color : unlocked ? "#94a3b8" : "#1e293b",
                        }}>
                          {evo.name}
                        </div>
                        <div style={{ fontSize:11, color: unlocked ? "#475569" : "#1e293b", marginTop:2 }}>
                          {rangeLabel}
                        </div>
                        {current && (
                          <div style={{ fontSize:10, color:"#64748b", marginTop:4, fontStyle:"italic" }}>
                            "{evo.description}"
                          </div>
                        )}
                      </div>
                      {!unlocked && (
                        <div style={{ fontSize:10, color:"#1e293b", fontWeight:700 }}>
                          {xpForLevel(evo.minLevel)} XP
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div style={{
                marginTop:16, padding:"14px 16px",
                background:"rgba(99,102,241,0.06)",
                border:"1px solid rgba(99,102,241,0.15)",
                borderRadius:16,
              }}>
                <div style={{ fontSize:12, color:"#6366f1", fontWeight:800, marginBottom:6 }}>
                  ∞ Sin límite de nivel
                </div>
                <div style={{ fontSize:11, color:"#334155", lineHeight:1.6 }}>
                  El sistema de niveles es infinito. La última evolución se desbloquea en Nv. 200 y permanece para siempre.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── BOTTOM NAV ── */}
        <div style={{
          position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)",
          width:"100%", maxWidth:430,
          background:"rgba(10,10,26,0.95)",
          borderTop:"1px solid rgba(255,255,255,0.06)",
          backdropFilter:"blur(20px)",
          display:"grid", gridTemplateColumns:"repeat(4, 1fr)",
          zIndex:100,
        }}>
          {[
            { id:"home", icon:"🏠", label:"Inicio" },
            { id:"habits", icon:"📋", label:"Hábitos" },
            { id:"levels", icon:"⚔️", label:"Niveles" },
            { id:"log", icon:"📜", label:"Log" },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display:"flex", flexDirection:"column", alignItems:"center",
              justifyContent:"center", padding:"10px 4px",
              background:"none", border:"none", cursor:"pointer",
              borderTop: tab === t.id ? `2px solid #6366f1` : "2px solid transparent",
              transition:"all 0.2s",
            }}>
              <span style={{ fontSize:20 }}>{t.icon}</span>
              <span style={{
                fontSize:10, marginTop:3, fontFamily:"Nunito", fontWeight:700,
                color: tab === t.id ? "#a5b4fc" : "#374151",
              }}>
                {t.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
