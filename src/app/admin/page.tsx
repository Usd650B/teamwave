"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import {
  collection, doc, updateDoc, onSnapshot, query, orderBy, Timestamp,
  addDoc, serverTimestamp, where, getDocs, deleteDoc, limit, getDoc, setDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface User {
  id: string; name: string; email: string; jobTitle?: string;
  isActive?: boolean; isVerified?: boolean; companyName?: string;
  role?: string; createdAt: Timestamp | null;
}

interface Update {
  id: string; title: string; message: string; priority: "normal" | "urgent";
  createdAt: any; authorName: string;
}

interface Escalation {
  id: string; subject: string; message: string; workerId: string;
  workerName: string; status: "open" | "inprogress" | "closed"; createdAt: any;
  hasNewReply?: boolean; lastMessage?: string;
  assignedRegion?: string; assignedSupervisorId?: string; forwardedAt?: any;
}
interface Schedule {
  id: string; type: "teabreak" | "lunch"; timeRange: string; workerIds: string[]; createdAt?: any;
}

type Tab = "updates" | "escalations" | "users" | "activity" | "schedule";

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isAdmin, setIsAdmin] = useState(false); // corresponds to manager
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [isEscalator, setIsEscalator] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("updates");
  const [showComposer, setShowComposer] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [newPriority, setNewPriority] = useState<"normal" | "urgent">("normal");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [escalationMessages, setEscalationMessages] = useState<Record<string, any[]>>({});
  const [allActivity, setAllActivity] = useState<any[]>([]);
  const [activitySearch, setActivitySearch] = useState("");
  const [scheduleSearch, setScheduleSearch] = useState<Record<string, string>>({});
  const [forwardingEsc, setForwardingEsc] = useState<string | null>(null);
  const [escStatusFilter, setEscStatusFilter] = useState<"all" | "open" | "inprogress" | "closed">("all");
  const [escSearch, setEscSearch] = useState("");
  const router = useRouter();
  const ADMIN_EMAIL = "shabanimnango99@gmail.com";

  const TANZANIA_REGIONS = [
    "Dar es Salaam", "Dodoma", "Arusha", "Mwanza", "Tanga", "Morogoro",
    "Kilimanjaro", "Mbeya", "Iringa", "Kagera", "Mara", "Tabora",
    "Kigoma", "Shinyanga", "Rukwa", "Singida", "Lindi", "Mtwara",
    "Ruvuma", "Pwani", "Geita", "Katavi", "Njombe", "Simiyu",
    "Songwe", "Zanzibar Urban/West", "Zanzibar North", "Zanzibar South",
    "Pemba North", "Pemba South"
  ];

  useEffect(() => {
    let unsubs: (() => void)[] = [];
    const cleanupListeners = () => { unsubs.forEach(u => u()); unsubs = []; };

    const unsub = onAuthStateChanged(auth, async (user) => {
      cleanupListeners();
      if (!user) { router.push("/admin/login"); return; }
      
      let isRoot = false;
      let isSup = false;
      let isEsc = false;
      
      const uDoc = await getDoc(doc(db, "users", user.uid));
      if (uDoc.exists()) {
        const r = uDoc.data().role;
        if (r === "manager" || user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) isRoot = true;
        if (r === "supervisor") isSup = true;
        if (r === "escalator") isEsc = true;
      }
      
      if (!isRoot && !isSup && !isEsc) {
        setError("Unauthorized: Manager, Supervisor, or Escalator access required.");
        setIsAdmin(false); setIsSupervisor(false); setIsEscalator(false); setLoading(false); router.push("/admin/login"); return;
      }
      
      setIsAdmin(isRoot);
      setIsSupervisor(isSup);
      setIsEscalator(isEsc);
      
      if (isEsc && !isRoot) setActiveTab("escalations");
      else if (isSup && !isRoot) setActiveTab("schedule");

      // We will load schedules from the updates collection below to bypass permission limits

      if (isRoot) {
        const qU = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const unsubUsers = onSnapshot(qU, (snap) => {
          setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[]);
          setLoading(false);
        });

        const qUp = query(collection(db, "updates"), orderBy("createdAt", "desc"));
        const unsubUpdates = onSnapshot(qUp, (snap) => {
          const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setUpdates(allDocs.filter((d: any) => !d.isSchedule) as Update[]);
          setSchedules(allDocs.filter((d: any) => d.isSchedule) as Schedule[]);
        });

        const qE = query(collection(db, "escalations"), orderBy("createdAt", "desc"), limit(500));
        const unsubEsc = onSnapshot(qE, (snap) => {
          setEscalations(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Escalation[]);
        });

        const qA = query(collection(db, "activityLog"), orderBy("createdAt", "desc"), limit(500));
        const unsubAct = onSnapshot(qA, (snap) => {
          setAllActivity(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }, () => {
          const fbA = query(collection(db, "activityLog"), limit(500));
          onSnapshot(fbA, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a: any, b: any) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
            setAllActivity(data);
          });
        });

        unsubs.push(unsubUsers, unsubUpdates, unsubEsc, unsubAct);
      } else {
        setLoading(false);
        // Load agents assigned to this supervisor so they can be assigned to schedules
        const unsubUsers = onSnapshot(query(collection(db, "users"), where("supervisorId", "==", user.uid)), (snap) => {
          setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })) as User[]);
        });
        const qUpSup = query(collection(db, "updates"), orderBy("createdAt", "desc"));
        const unsubUpdatesSup = onSnapshot(qUpSup, (snap) => {
          const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setSchedules(allDocs.filter((d: any) => d.isSchedule) as Schedule[]);
        });
        
        unsubs.push(unsubUsers, unsubUpdatesSup);
      }
    });

    return () => {
      cleanupListeners();
      unsub();
    };
  }, [router]);

  // Parse end time from timeRange string like "10:00 AM - 10:30 AM"
  const parseEndTime = useCallback((timeRange: string): Date | null => {
    if (!timeRange) return null;
    const parts = timeRange.split("-");
    if (parts.length < 2) return null;
    const endStr = parts[1].trim();
    const now = new Date();
    const match12 = endStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (match12) {
      let hours = parseInt(match12[1]);
      const mins = parseInt(match12[2]);
      const ampm = match12[3].toUpperCase();
      if (ampm === "PM" && hours < 12) hours += 12;
      if (ampm === "AM" && hours === 12) hours = 0;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins, 0);
    }
    const match24 = endStr.match(/^(\d{1,2}):(\d{2})$/);
    if (match24) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(match24[1]), parseInt(match24[2]), 0);
    }
    return null;
  }, []);

  const isScheduleExpired = useCallback((timeRange: string): boolean => {
    const endTime = parseEndTime(timeRange);
    if (!endTime) return false;
    return new Date() >= endTime;
  }, [parseEndTime]);

  // Auto-clear expired schedules every 30 seconds
  useEffect(() => {
    const checkExpired = async () => {
      for (const sched of schedules) {
        if (isScheduleExpired(sched.timeRange) && sched.workerIds?.length > 0) {
          try {
            await updateDoc(doc(db, "updates", sched.id), { workerIds: [] });
          } catch (e) { /* silent */ }
        }
      }
    };
    checkExpired();
    const interval = setInterval(checkExpired, 30000);
    return () => clearInterval(interval);
  }, [schedules, isScheduleExpired]);

  const postUpdate = async () => {
    if (!newTitle.trim() || !newMessage.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, "updates"), {
        title: newTitle.trim(), message: newMessage.trim(), priority: newPriority,
        createdAt: serverTimestamp(), authorName: "Back Office",
      });
      setNewTitle(""); setNewMessage(""); setNewPriority("normal"); setShowComposer(false);
    } catch (err: any) { alert("Failed: " + err.message); }
    finally { setSending(false); }
  };

  const deleteUpdate = async (id: string) => {
    if (!confirm("Delete this update?")) return;
    await deleteDoc(doc(db, "updates", id));
  };

  const loadEscalationMessages = (escId: string) => {
    if (replyingTo === escId) { setReplyingTo(null); return; }
    setReplyingTo(escId);
    const q = query(collection(db, "escalations", escId, "messages"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snap) => {
      setEscalationMessages(prev => ({
        ...prev, [escId]: snap.docs.map(d => ({ id: d.id, ...d.data() }))
      }));
    });
  };

  const sendReply = async (escId: string) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, "escalations", escId, "messages"), {
        message: replyText.trim(), senderId: "admin", senderName: "Back Office",
        createdAt: serverTimestamp(), isAdmin: true,
      });
      await updateDoc(doc(db, "escalations", escId), {
        lastMessage: replyText.trim(), hasNewReply: true,
      });
      setReplyText("");
    } catch (err: any) { alert("Failed: " + err.message); }
    finally { setSending(false); }
  };

  const resolveEscalation = async (escId: string) => {
    await updateDoc(doc(db, "escalations", escId), { status: "closed" });
  };

  const forwardToRegion = async (escId: string, region: string) => {
    try {
      // Find supervisors in the selected region
      const regionSupervisors = users.filter(u => u.role === "supervisor" && (u as any).region === region);
      const assignedSupId = regionSupervisors.length > 0 ? regionSupervisors[0].id : null;
      await updateDoc(doc(db, "escalations", escId), {
        status: "inprogress",
        assignedRegion: region,
        assignedSupervisorId: assignedSupId,
        forwardedAt: serverTimestamp(),
      });
      // Add a system message
      await addDoc(collection(db, "escalations", escId, "messages"), {
        message: `Ticket forwarded to ${region} region technicians for resolution.`,
        senderId: "system", senderName: "System",
        createdAt: serverTimestamp(), isAdmin: true, isSystem: true,
      });
      setForwardingEsc(null);
    } catch (err: any) { alert("Failed to forward: " + err.message); }
  };

  const toggleVerification = async (userId: string, current: boolean) => {
    await updateDoc(doc(db, "users", userId), { isVerified: !current });
  };

  const toggleStatus = async (userId: string, current: boolean) => {
    await updateDoc(doc(db, "users", userId), { isActive: !current });
  };

  const changeRole = async (userId: string, newRole: string) => {
    await updateDoc(doc(db, "users", userId), { role: newRole });
  };

  const assignSupervisor = async (userId: string, supervisorId: string) => {
    await updateDoc(doc(db, "users", userId), { supervisorId: supervisorId || null });
  };

  const createSchedule = async (type: "teabreak" | "lunch", timeRange: string) => {
    try {
      await addDoc(collection(db, "updates"), {
        isSchedule: true, title: "System Schedule", message: type,
        type, timeRange, workerIds: [], createdAt: serverTimestamp(), priority: "normal", authorName: "Admin"
      });
    } catch (e: any) {
      alert("Error creating schedule: " + e.message);
    }
  };

  const toggleWorkerSchedule = async (scheduleId: string, workerId: string, isAssigned: boolean) => {
    const sched = schedules.find(s => s.id === scheduleId);
    if (!sched) return;
    const newWorkerIds = isAssigned 
      ? sched.workerIds.filter(id => id !== workerId)
      : [...(sched.workerIds || []), workerId];
    await updateDoc(doc(db, "updates", scheduleId), { workerIds: newWorkerIds });
  };

  const deleteSchedule = async (scheduleId: string) => {
    if (!confirm("Delete this schedule?")) return;
    await deleteDoc(doc(db, "updates", scheduleId));
  };

  const supervisors = users.filter(u => u.role === "supervisor");

  const filteredEscalations = escalations.filter(e => {
    const matchesStatus = escStatusFilter === "all" || e.status === escStatusFilter;
    const searchLower = escSearch.toLowerCase();
    const matchesSearch = escSearch === "" || 
      (e.subject || "").toLowerCase().includes(searchLower) || 
      (e.message || "").toLowerCase().includes(searchLower) || 
      (e.workerName || "").toLowerCase().includes(searchLower);
    return matchesStatus && matchesSearch;
  });

  const filteredActivity = allActivity.filter(act => {
    const isMatch = (act.userName || "").toLowerCase().includes(activitySearch.toLowerCase()) ||
      (act.type || "").toLowerCase().includes(activitySearch.toLowerCase()) ||
      (act.description || "").toLowerCase().includes(activitySearch.toLowerCase());
      
    if (!isMatch) return false;
    
    // Only show last 7 days
    if (!act.createdAt?.toDate) return true;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return act.createdAt.toDate() > oneWeekAgo;
  });

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F172A]">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        <p className="text-blue-400 font-bold text-[10px] uppercase tracking-[0.2em] animate-pulse">Loading Admin</p>
      </div>
    </div>
  );

  if (error || (!isAdmin && !isSupervisor && !isEscalator)) return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F172A] p-6">
      <div className="bg-white/5 backdrop-blur-xl border border-red-500/20 p-10 rounded-[2.5rem] max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto">
          <span className="material-icons text-red-500 text-4xl">gpp_maybe</span>
        </div>
        <h2 className="text-2xl font-black text-white">Access Denied</h2>
        <p className="text-gray-400 text-sm">{error || "Secured."}</p>
        <button onClick={() => router.push("/admin/login")}
          className="w-full py-4 bg-red-500/10 text-red-500 font-black rounded-2xl border border-red-500/20">
          RETURN
        </button>
      </div>
    </div>
  );

  const tabs: { key: Tab; label: string; icon: string; count?: number }[] = [
    { key: "updates", label: "Updates", icon: "campaign", count: updates.length },
    { key: "escalations", label: "Escalations", icon: "support_agent", count: escalations.filter(e => e.status === "open" || e.status === "inprogress").length },
    { key: "users", label: "Users", icon: "people", count: users.length },
    { key: "schedule", label: "Schedule", icon: "event", count: schedules.length },
    { key: "activity", label: "Activity Log", icon: "history", count: allActivity.length },
  ];

  const visibleTabs = isAdmin ? tabs : 
                      isSupervisor ? tabs.filter(t => t.key === "schedule" || t.key === "updates") : 
                      isEscalator ? tabs.filter(t => t.key === "escalations" || t.key === "updates") : [];

  return (
    <div className="flex h-screen bg-[#F1F5F9] font-sans">
      {/* Sidebar */}
      <aside className="w-[280px] bg-white border-r border-[#E2E8F0] flex flex-col h-full z-20 flex-shrink-0">
        <div className="p-6 border-b border-[#E2E8F0] flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 p-2 shrink-0">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-[#0F172A] font-black text-lg tracking-tight leading-none flex items-center gap-2">
              TeamWave
            </h1>
            <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Management</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 px-3 mt-2">Modules</p>
          {visibleTabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === t.key 
                  ? "bg-blue-50 text-blue-700" 
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}>
              <div className="flex items-center gap-3">
                <span className={`material-icons text-[18px] ${activeTab === t.key ? "text-blue-600" : "text-gray-400"}`}>
                  {t.icon}
                </span>
                {t.label}
              </div>
              {(t.count ?? 0) > 0 && (
                <span className={`px-2 py-0.5 rounded-lg text-[10px] ${
                  activeTab === t.key ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
          {isAdmin && (
            <button onClick={() => router.push("/library")}
              className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-sm font-bold transition-all text-gray-500 hover:bg-gray-50 hover:text-gray-900`}>
              <div className="flex items-center gap-3">
                <span className={`material-icons text-[18px] text-gray-400`}>folder_open</span>
                System Library
              </div>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-[#E2E8F0] bg-gray-50/50">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-[#0F172A] flex items-center justify-center text-white text-xs font-black shrink-0">
              {isAdmin ? "MG" : isSupervisor ? "SU" : "ES"}
            </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#0F172A]">{isAdmin ? "Manager" : isSupervisor ? "Supervisor" : "Escalator"}</p>
            <p className="text-xs text-gray-500 truncate">{auth.currentUser?.email?.split('@')[0] || "User"}</p>
          </div>
          </div>
          <button onClick={() => auth.signOut().then(() => router.push("/admin/login"))}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-all">
            <span className="material-icons text-sm">logout</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-[#E2E8F0] flex items-center justify-between px-10 sticky top-0 z-10 shrink-0">
          <h2 className="text-2xl font-black text-[#0F172A] capitalize">
            {activeTab.replace(/([A-Z])/g, ' $1').trim()}
          </h2>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-black rounded-lg uppercase tracking-widest border border-blue-100">
              {isAdmin ? "Enterprise Access" : "Department Access"}
            </span>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-10">
          <div className="max-w-6xl mx-auto pb-10">
        {/* UPDATES TAB */}
        {activeTab === "updates" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-[#1E293B]">Broadcast Updates</h2>
              <button onClick={() => setShowComposer(!showComposer)}
                className="bg-[#2563EB] text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 shadow-md shadow-blue-500/20 transition-all flex items-center gap-2">
                <span className="material-icons text-sm">add</span>
                New Update
              </button>
            </div>

            {showComposer && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 border border-blue-100 shadow-lg space-y-4">
                <div className="flex gap-3">
                  <button onClick={() => setNewPriority("normal")}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      newPriority === "normal" ? "bg-blue-50 text-blue-600 border border-blue-200" : "bg-gray-50 text-gray-400 border border-gray-100"}`}>
                    Normal
                  </button>
                  <button onClick={() => setNewPriority("urgent")}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      newPriority === "urgent" ? "bg-red-50 text-red-600 border border-red-200" : "bg-gray-50 text-gray-400 border border-gray-100"}`}>
                    🔴 Urgent
                  </button>
                </div>
                <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Update title..."
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none" />
                <textarea value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder="Write your update message..."
                  rows={4} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none resize-none" />
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setShowComposer(false)} className="px-5 py-2.5 text-gray-400 text-xs font-black uppercase tracking-widest">Cancel</button>
                  <button onClick={postUpdate} disabled={sending || !newTitle.trim() || !newMessage.trim()}
                    className="bg-[#1E293B] text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black disabled:opacity-50 shadow-lg">
                    {sending ? "Sending..." : "Broadcast"}
                  </button>
                </div>
              </motion.div>
            )}

            <div className="space-y-3">
              {updates.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm font-bold">No updates posted yet.</div>
              ) : updates.map(u => (
                <div key={u.id} className={`bg-white rounded-2xl p-5 border shadow-sm flex items-start justify-between gap-4 ${u.priority === "urgent" ? "border-red-200" : "border-gray-100"}`}>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {u.priority === "urgent" && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-black rounded-md uppercase">Urgent</span>}
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                        {u.createdAt?.toDate?.()?.toLocaleDateString() || ""}
                      </span>
                    </div>
                    <h3 className="font-black text-gray-900 mb-1">{u.title}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{u.message}</p>
                  </div>
                  <button onClick={() => deleteUpdate(u.id)} className="text-gray-300 hover:text-red-500 transition-all p-2">
                    <span className="material-icons text-sm">delete</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ESCALATIONS TAB */}
        {activeTab === "escalations" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <h2 className="text-2xl font-black text-[#1E293B]">Worker Escalations</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                  <input 
                    type="text" 
                    placeholder="Search tickets..." 
                    value={escSearch}
                    onChange={(e) => setEscSearch(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none w-full md:w-64 transition-all shadow-sm"
                  />
                </div>
                <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-gray-100 shadow-sm">
                  {(["all", "open", "inprogress", "closed"] as const).map(f => (
                  <button key={f} onClick={() => setEscStatusFilter(f)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      escStatusFilter === f
                        ? f === "open" ? "bg-orange-500 text-white shadow-md" :
                          f === "inprogress" ? "bg-blue-500 text-white shadow-md" :
                          f === "closed" ? "bg-green-500 text-white shadow-md" :
                          "bg-[#0F172A] text-white shadow-md"
                        : "text-gray-400 hover:bg-gray-50"
                    }`}>
                    {f === "inprogress" ? "In Progress" : f === "all" ? `All (${escalations.length})` : f}
                    {f !== "all" && ` (${escalations.filter(e => e.status === f).length})`}
                  </button>
                ))}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {filteredEscalations.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm font-bold bg-white rounded-2xl border border-dashed border-gray-200">
                  {escSearch ? "No tickets match your search." : escStatusFilter === "all" ? "No escalations yet." : `No ${escStatusFilter === "inprogress" ? "in-progress" : escStatusFilter} escalations.`}
                </div>
              ) : filteredEscalations.map(esc => (
                <div key={esc.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                  esc.status === "open" ? "border-l-4 border-l-orange-400 border-t border-r border-b border-orange-100" :
                  esc.status === "inprogress" ? "border-l-4 border-l-blue-400 border-t border-r border-b border-blue-100" :
                  "border-l-4 border-l-green-400 border-t border-r border-b border-gray-100"
                }`}>
                  <div className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => loadEscalationMessages(esc.id)}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className={`px-2.5 py-1 text-[8px] font-black rounded-lg uppercase tracking-widest ${
                            esc.status === "open" ? "bg-orange-50 text-orange-600 border border-orange-100" :
                            esc.status === "inprogress" ? "bg-blue-50 text-blue-600 border border-blue-100" :
                            "bg-green-50 text-green-600 border border-green-100"}`}>
                            {esc.status === "inprogress" ? "In Progress" : esc.status === "closed" ? "Closed" : "Open"}
                          </span>
                          {esc.assignedRegion && (
                            <span className="px-2.5 py-1 text-[8px] font-bold rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center gap-1">
                              <span className="material-icons text-[10px]">location_on</span>
                              {esc.assignedRegion}
                            </span>
                          )}
                          <span className="text-[9px] font-bold text-gray-400">{esc.workerName}</span>
                        </div>
                        <h3 className="font-black text-gray-900 mb-1">{esc.subject}</h3>
                        <p className="text-sm text-gray-500 line-clamp-1">{esc.message}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {esc.status === "open" && (
                          <button onClick={(e) => { e.stopPropagation(); setForwardingEsc(forwardingEsc === esc.id ? null : esc.id); }}
                            className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold hover:bg-indigo-100 transition-all border border-indigo-100 flex items-center gap-1">
                            <span className="material-icons text-xs">send</span> Forward
                          </button>
                        )}
                        {esc.status === "inprogress" && (
                          <button onClick={(e) => { e.stopPropagation(); resolveEscalation(esc.id); }}
                            className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-[10px] font-bold hover:bg-green-100 transition-all border border-green-100 flex items-center gap-1">
                            <span className="material-icons text-xs">check_circle</span> Close
                          </button>
                        )}
                        <span className="material-icons text-gray-300">{replyingTo === esc.id ? "expand_less" : "expand_more"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Region Forwarding Panel */}
                  {forwardingEsc === esc.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      className="border-t border-indigo-100 bg-indigo-50/30 p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="material-icons text-indigo-500">location_on</span>
                        <h4 className="text-sm font-black text-indigo-900">Forward to Regional Technicians</h4>
                      </div>
                      <p className="text-xs text-indigo-600/70 mb-4">Select the region to send this ticket to the technicians/supervisors for resolution.</p>
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
                        {TANZANIA_REGIONS.map(region => (
                          <button key={region} onClick={() => forwardToRegion(esc.id, region)}
                            className="px-3 py-2.5 bg-white text-gray-700 rounded-xl text-[11px] font-bold hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 hover:border-indigo-600 hover:shadow-lg hover:shadow-indigo-500/20 text-center">
                            {region}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => setForwardingEsc(null)} className="mt-3 text-xs text-gray-400 font-bold hover:text-gray-600">Cancel</button>
                    </motion.div>
                  )}

                  {replyingTo === esc.id && (
                    <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} className="border-t border-gray-100">
                      <div className="p-5 space-y-3 max-h-80 overflow-y-auto bg-gray-50/50">
                        {/* Original message */}
                        <div className="flex justify-start">
                          <div className="bg-white rounded-2xl rounded-tl-none px-4 py-2.5 border border-gray-100 max-w-[80%]">
                            <p className="text-[10px] font-black text-orange-500 uppercase mb-1">{esc.workerName}</p>
                            <p className="text-sm text-gray-700">{esc.message}</p>
                          </div>
                        </div>
                        {(escalationMessages[esc.id] || []).map(msg => (
                          <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-end" : "justify-start"}`}>
                            <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] ${
                              msg.isSystem ? "bg-indigo-50 border border-indigo-100 rounded-none" :
                              msg.isAdmin ? "bg-[#2563EB] text-white rounded-tr-none" : "bg-white border border-gray-100 rounded-tl-none"}`}>
                              <p className={`text-[10px] font-black uppercase mb-1 ${
                                msg.isSystem ? "text-indigo-500" : msg.isAdmin ? "text-blue-200" : "text-orange-500"}`}>{msg.senderName}</p>
                              <p className={`text-sm ${msg.isSystem ? "text-indigo-700 italic" : ""}`}>{msg.message}</p>
                            </div>
                          </div>
                        ))}
                        {esc.status === "closed" && (
                          <div className="text-center py-3">
                            <span className="px-4 py-2 bg-green-50 text-green-700 text-[11px] font-bold rounded-lg border border-green-100">
                              ✓ Ticket Closed — Issue Resolved
                            </span>
                          </div>
                        )}
                      </div>
                      {esc.status !== "closed" && (
                        <div className="p-4 border-t border-gray-100 flex gap-2">
                          <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply to escalation..."
                            onKeyDown={e => e.key === "Enter" && sendReply(esc.id)}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none" />
                          <button onClick={() => sendReply(esc.id)} disabled={sending || !replyText.trim()}
                            className="bg-[#2563EB] text-white px-4 py-2.5 rounded-xl text-xs font-black disabled:opacity-50">
                            <span className="material-icons text-sm">send</span>
                          </button>
                          {esc.status === "open" && (
                            <button onClick={() => { setForwardingEsc(esc.id); setReplyingTo(null); }}
                              className="bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1">
                              <span className="material-icons text-sm">shortcut</span> Forward
                            </button>
                          )}
                          {esc.status === "inprogress" && (
                            <button onClick={() => resolveEscalation(esc.id)}
                              className="bg-green-500 text-white px-4 py-2.5 rounded-xl text-xs font-black flex items-center gap-1">
                              <span className="material-icons text-sm">check</span> Close
                            </button>
                          )}
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black text-[#1E293B]">User Management</h2>
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Member</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Verified</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Role</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Supervisor</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-blue-50/30 transition-all">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-blue-600 font-black overflow-hidden">
                            {(user as any).profilePhoto ? (
                              <img src={(user as any).profilePhoto} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              user.name?.charAt(0).toUpperCase() || "?"
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-sm flex items-center gap-1">
                              {user.name}
                              {user.isVerified && <span className="material-icons text-green-500 text-xs">verified</span>}
                            </div>
                            <div className="text-xs text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button onClick={() => toggleVerification(user.id, !!user.isVerified)}
                          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                            user.isVerified ? "bg-green-50 text-green-600 border border-green-100" : "bg-gray-50 text-gray-400 border border-gray-100"}`}>
                          {user.isVerified ? "Verified" : "Unverified"}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={user.role || "worker"} 
                          onChange={(e) => changeRole(user.id, e.target.value)}
                          className="bg-gray-50 border border-gray-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-blue-400 font-bold text-gray-700"
                        >
                          <option value="worker">Worker</option>
                          <option value="supervisor">Supervisor</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        {user.role !== "supervisor" ? (
                          <select 
                            value={(user as any).supervisorId || ""} 
                            onChange={(e) => assignSupervisor(user.id, e.target.value)}
                            className="bg-gray-50 border border-gray-200 text-xs rounded-lg px-2 py-1 outline-none focus:border-blue-400 text-gray-600 max-w-[120px]"
                          >
                            <option value="">Unassigned</option>
                            {supervisors.map(sup => (
                              <option key={sup.id} value={sup.id}>{sup.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                          user.isActive !== false ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-red-50 text-red-600 border-red-100"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${user.isActive !== false ? "bg-blue-600 animate-pulse" : "bg-red-600"}`}></span>
                          {user.isActive !== false ? "Active" : "Blocked"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => toggleStatus(user.id, user.isActive !== false)}
                          className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            user.isActive !== false ? "bg-white text-red-600 border border-red-100 hover:bg-red-50" : "bg-[#2563EB] text-white hover:bg-blue-600"}`}>
                          {user.isActive !== false ? "Block" : "Restore"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SCHEDULE TAB */}
        {activeTab === "schedule" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-[#1E293B]">Team Schedules</h2>
              {isAdmin && (
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
                  <select id="newSchedType" className="bg-gray-50 border-none outline-none text-sm font-bold text-gray-700 rounded-xl px-4 py-2 cursor-pointer">
                    <option value="teabreak">Tea Break</option>
                    <option value="lunch">Lunch Time</option>
                  </select>
                  <input id="newSchedTime" type="text" placeholder="e.g. 10:00 AM - 10:30 AM" className="bg-gray-50 border-none outline-none text-sm font-bold text-gray-700 rounded-xl px-4 py-2 w-48" />
                  <button onClick={() => {
                    const t = (document.getElementById('newSchedType') as HTMLSelectElement).value;
                    const tr = (document.getElementById('newSchedTime') as HTMLInputElement).value;
                    if (tr.trim()) {
                      createSchedule(t as any, tr.trim());
                      (document.getElementById('newSchedTime') as HTMLInputElement).value = '';
                    } else {
                      alert("Please enter a time range.");
                    }
                  }} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all">
                    + Add
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {schedules.map(sched => {
                const expired = isScheduleExpired(sched.timeRange);
                const endTime = parseEndTime(sched.timeRange);
                const minsLeft = endTime ? Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 60000)) : null;

                return (
                <div key={sched.id} className={`bg-white rounded-[2rem] p-6 shadow-sm border relative transition-all ${
                  expired ? "border-gray-200 opacity-60" : "border-gray-100"
                }`}>
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {expired ? (
                      <span className="px-2.5 py-1 bg-gray-100 text-gray-500 text-[9px] font-black rounded-lg uppercase tracking-widest">Expired</span>
                    ) : minsLeft !== null && minsLeft <= 10 ? (
                      <span className="px-2.5 py-1 bg-red-50 text-red-600 text-[9px] font-black rounded-lg uppercase tracking-widest animate-pulse">{minsLeft}m left</span>
                    ) : (
                      <span className="px-2.5 py-1 bg-green-50 text-green-600 text-[9px] font-black rounded-lg uppercase tracking-widest">Active</span>
                    )}
                    {isAdmin && (
                      <button onClick={() => deleteSchedule(sched.id)} className="text-gray-300 hover:text-red-500">
                        <span className="material-icons text-sm">delete</span>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${sched.type === 'teabreak' ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500'}`}>
                      <span className="material-icons">{sched.type === 'teabreak' ? 'local_cafe' : 'restaurant'}</span>
                    </div>
                    <div>
                      <h3 className="font-black text-[#0F172A] capitalize">{sched.type === 'teabreak' ? 'Tea Break' : 'Lunch Time'}</h3>
                      <p className="text-xs font-bold text-gray-400">{sched.timeRange}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">Assigned Workers ({sched.workerIds?.length || 0})</h4>
                    <ol className="list-decimal list-inside text-sm text-gray-700 space-y-2 font-medium bg-gray-50/50 p-4 rounded-xl max-h-40 overflow-y-auto custom-scrollbar">
                      {(sched.workerIds || []).map(wId => {
                        const u = users.find(x => x.id === wId);
                        return (
                          <li key={wId} className="flex justify-between items-center group">
                            <span>{u?.name || "Other Worker"}</span>
                            {(isSupervisor || isAdmin) && u && (
                              <button onClick={() => toggleWorkerSchedule(sched.id, wId, true)} className="opacity-0 group-hover:opacity-100 text-red-500 text-[10px] font-bold">Remove</button>
                            )}
                          </li>
                        );
                      })}
                      {(!sched.workerIds || sched.workerIds.length === 0) && <div className="text-xs text-gray-400 italic">No workers assigned</div>}
                    </ol>
                  </div>

                  {!expired && (isSupervisor || isAdmin) && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="relative">
                        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                          <span className="material-icons text-gray-400 text-sm">search</span>
                          <input
                            type="text"
                            placeholder="Search worker by name..."
                            className="bg-transparent w-full text-sm font-bold text-gray-700 outline-none placeholder:text-gray-400"
                            value={scheduleSearch[sched.id] || ""}
                            onChange={(e) => setScheduleSearch(prev => ({ ...prev, [sched.id]: e.target.value }))}
                          />
                          {(scheduleSearch[sched.id] || "").length > 0 && (
                            <button onClick={() => setScheduleSearch(prev => ({ ...prev, [sched.id]: "" }))} className="text-gray-400 hover:text-gray-600">
                              <span className="material-icons text-sm">close</span>
                            </button>
                          )}
                        </div>
                        {(scheduleSearch[sched.id] || "").trim().length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto custom-scrollbar">
                            {users
                              .filter(u => !sched.workerIds?.includes(u.id))
                              .filter(u => u.name?.toLowerCase().includes((scheduleSearch[sched.id] || "").toLowerCase()))
                              .length === 0 ? (
                                <div className="px-4 py-3 text-xs text-gray-400 italic">No workers found</div>
                              ) : (
                                users
                                  .filter(u => !sched.workerIds?.includes(u.id))
                                  .filter(u => u.name?.toLowerCase().includes((scheduleSearch[sched.id] || "").toLowerCase()))
                                  .map(u => (
                                    <button key={u.id} onClick={() => {
                                      toggleWorkerSchedule(sched.id, u.id, false);
                                      setScheduleSearch(prev => ({ ...prev, [sched.id]: "" }));
                                    }}
                                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-b border-gray-50 last:border-0">
                                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500 shrink-0">
                                        {u.name?.charAt(0)?.toUpperCase() || "?"}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-bold text-[#0F172A] truncate">{u.name}</p>
                                        <p className="text-[10px] text-gray-400 truncate">{u.email || u.role || "Worker"}</p>
                                      </div>
                                      <span className="material-icons text-blue-500 text-sm ml-auto shrink-0">add_circle</span>
                                    </button>
                                  ))
                              )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
            {schedules.length === 0 && (
              <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">
                No schedules configured yet. Admin needs to create time slots.
              </div>
            )}
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === "activity" && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
              <div>
                <h2 className="text-lg font-black text-[#0F172A]">System Activity Log</h2>
                <span className="text-xs font-bold text-gray-400">Showing latest {allActivity.length} events</span>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => router.push("/library")} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-indigo-100">
                  <span className="material-icons text-sm">folder_open</span>
                  Open Library
                </button>
                <div className="relative">
                  <span className="material-icons absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">search</span>
                  <input 
                    type="text" 
                    placeholder="Search by user, action, or description..." 
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 outline-none w-full md:w-80 transition-all"
                  />
                </div>
              </div>
            </div>

            {filteredActivity.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">
                {activitySearch ? "No activity matches your search." : "No activity recorded yet."}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50/50 border-b border-gray-100 text-left">
                      <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">User</th>
                      <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Action</th>
                      <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Description</th>
                      <th className="px-5 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredActivity.map((act: any) => (
                      <tr key={act.id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-5 py-3">
                          <span className="text-sm font-bold text-[#0F172A]">{act.userName || "Unknown"}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-1 text-[9px] font-bold rounded-md uppercase tracking-wider ${
                            act.type?.includes("accepted") ? "bg-green-50 text-green-600" :
                            act.type?.includes("deleted") || act.type?.includes("rejected") ? "bg-red-50 text-red-600" :
                            act.type?.includes("created") || act.type?.includes("sent") ? "bg-blue-50 text-blue-600" :
                            act.type?.includes("started") ? "bg-purple-50 text-purple-600" :
                            "bg-gray-50 text-gray-600"
                          }`}>{(act.type || "unknown").replace(/_/g, " ")}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs text-gray-600 truncate block max-w-xs">{act.description}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-[11px] text-gray-400 font-medium whitespace-nowrap">
                            {act.createdAt?.toDate?.() ? act.createdAt.toDate().toLocaleString() : ""}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
          </div>
        </main>
      </div>
    </div>
  );
}
