"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import {
  collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp,
  doc, updateDoc, getDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { logActivity } from "@/lib/logActivity";

interface Agent {
  id: string; name: string; email: string; jobTitle?: string; profilePhoto?: string;
}

interface Escalation {
  id: string; subject: string; message: string; workerId: string;
  workerName: string; status: "open" | "resolved"; createdAt: any;
  hasNewReply?: boolean; lastMessage?: string;
}

export default function SupervisorPage() {
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myName, setMyName] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [activeTab, setActiveTab] = useState<"agents" | "escalations">("escalations");
  const [viewingEsc, setViewingEsc] = useState<string | null>(null);
  const [escMessages, setEscMessages] = useState<Record<string, any[]>>({});
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) { router.replace("/login"); return; }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists() || userDoc.data().role !== "supervisor") {
        setIsSupervisor(false); setLoading(false); return;
      }
      setIsSupervisor(true);
      setMyName(userDoc.data().name || "Supervisor");
    });
    return unsub;
  }, [router]);

  // Load assigned agents
  useEffect(() => {
    if (!currentUser || !isSupervisor) return;
    const q = query(collection(db, "users"), where("supervisorId", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setAgents(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Agent[]);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [currentUser, isSupervisor]);

  // Load escalations from assigned agents
  useEffect(() => {
    if (!currentUser || !isSupervisor || agents.length === 0) return;
    const agentIds = agents.map(a => a.id);
    // Firestore 'in' supports up to 30
    const chunks = [];
    for (let i = 0; i < agentIds.length; i += 30) chunks.push(agentIds.slice(i, i + 30));
    const unsubs: (() => void)[] = [];
    let allEsc: Escalation[] = [];
    chunks.forEach((chunk, ci) => {
      const q = query(collection(db, "escalations"), where("workerId", "in", chunk), orderBy("createdAt", "desc"));
      const unsub = onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Escalation[];
        allEsc = [...allEsc.filter(e => !chunk.includes(e.workerId)), ...data];
        allEsc.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
        setEscalations([...allEsc]);
      }, () => {
        // fallback without index
        const fb = query(collection(db, "escalations"), where("workerId", "in", chunk));
        onSnapshot(fb, (snap) => {
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Escalation[];
          allEsc = [...allEsc.filter(e => !chunk.includes(e.workerId)), ...data];
          allEsc.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
          setEscalations([...allEsc]);
        });
      });
      unsubs.push(unsub);
    });
    return () => unsubs.forEach(u => u());
  }, [currentUser, isSupervisor, agents]);

  const openEscalation = (escId: string) => {
    if (viewingEsc === escId) { setViewingEsc(null); return; }
    setViewingEsc(escId);
    const q = query(collection(db, "escalations", escId, "messages"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snap) => {
      setEscMessages(prev => ({ ...prev, [escId]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });
  };

  const sendReply = async (escId: string) => {
    if (!replyText.trim() || !currentUser) return;
    setSending(true);
    try {
      await addDoc(collection(db, "escalations", escId, "messages"), {
        message: replyText.trim(), senderId: currentUser.uid, senderName: `${myName} (Supervisor)`,
        createdAt: serverTimestamp(), isAdmin: true,
      });
      await updateDoc(doc(db, "escalations", escId), { lastMessage: replyText.trim(), hasNewReply: true });
      logActivity(currentUser.uid, myName, "escalation_replied", `Replied to escalation`, escId);
      setReplyText("");
    } catch (err: any) { alert("Failed: " + err.message); }
    finally { setSending(false); }
  };

  const resolveEsc = async (escId: string) => {
    if (!currentUser) return;
    await updateDoc(doc(db, "escalations", escId), { status: "resolved" });
    logActivity(currentUser.uid, myName, "escalation_resolved", `Resolved escalation`, escId);
  };

  const formatTime = (ts: any) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return d.toLocaleDateString();
  };

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1F3F9]">
      <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent"></div>
    </div>
  );

  if (!isSupervisor) return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1F3F9] p-6">
      <div className="bg-white rounded-2xl border border-[#E2E8F0] p-10 max-w-sm text-center shadow-sm space-y-4">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto">
          <span className="material-icons text-red-500 text-3xl">lock</span>
        </div>
        <h2 className="text-xl font-black text-[#0F172A]">Access Restricted</h2>
        <p className="text-sm text-gray-500">This page is only available for supervisors.</p>
        <button onClick={() => router.push("/home")} className="px-6 py-2.5 bg-[#0F172A] text-white rounded-xl text-xs font-bold">Return Home</button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-[#F1F3F9] overflow-hidden">
      {/* Supervisor Sidebar */}
      <aside className="w-[260px] flex flex-col bg-[#0B1121] text-white flex-shrink-0">
        <div className="flex items-center gap-3 px-5 py-6 border-b border-white/5">
          <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/30">
            <span className="material-icons text-white text-lg">shield</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black tracking-tight leading-none">Supervisor</h1>
            <p className="text-[9px] text-amber-400 font-bold uppercase tracking-widest mt-0.5">Dashboard</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] px-3 mb-3">Management</p>
          <button onClick={() => setActiveTab("escalations")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "escalations" ? "bg-amber-500/15 text-amber-400" : "text-white/50 hover:bg-white/5 hover:text-white/80"}`}>
            <span className="material-icons text-xl">headset_mic</span>
            <span className="flex-1 text-left">Contact Center</span>
            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] font-black rounded-full min-w-[18px] text-center">
              {escalations.filter(e => e.status === "open").length}
            </span>
          </button>
          <button onClick={() => setActiveTab("agents")}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              activeTab === "agents" ? "bg-amber-500/15 text-amber-400" : "text-white/50 hover:bg-white/5 hover:text-white/80"}`}>
            <span className="material-icons text-xl">group</span>
            <span className="flex-1 text-left">My Agents</span>
            <span className="px-1.5 py-0.5 bg-white/10 text-white/50 text-[9px] font-black rounded-full">{agents.length}</span>
          </button>

          <div className="pt-6">
            <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] px-3 mb-3">Account</p>
          </div>
          <button onClick={() => router.push("/home")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/50 hover:bg-white/5 hover:text-white/80 transition-all">
            <span className="material-icons text-xl text-white/40">home</span>
            <span className="flex-1 text-left">Worker View</span>
          </button>
        </nav>

        <div className="border-t border-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
              <span className="text-white font-black text-sm">{myName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white/90 truncate">{myName}</p>
              <p className="text-[10px] text-amber-400/60 font-medium">Supervisor</p>
            </div>
            <button onClick={() => auth.signOut().then(() => router.push("/"))} className="text-white/20 hover:text-red-400 transition-colors">
              <span className="material-icons text-lg">logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {activeTab === "escalations" && (
          <div className="flex-1 flex flex-col">
            <div className="bg-white border-b border-[#E2E8F0] px-8 py-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Contact Center</h1>
                  <p className="text-sm text-gray-500 mt-1">Escalations from your assigned agents</p>
                </div>
                <div className="flex gap-3">
                  <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 rounded-xl border border-orange-100">
                    <span className="material-icons text-orange-500 text-sm">pending</span>
                    <span className="text-xs font-bold text-orange-700">{escalations.filter(e => e.status === "open").length} Open</span>
                  </div>
                  <div className="flex items-center gap-2 px-4 py-2 bg-green-50 rounded-xl border border-green-100">
                    <span className="material-icons text-green-500 text-sm">check_circle</span>
                    <span className="text-xs font-bold text-green-700">{escalations.filter(e => e.status === "resolved").length} Resolved</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-6 max-w-4xl space-y-3">
              {escalations.length === 0 ? (
                <div className="text-center py-20 text-gray-400 text-sm">No escalations from your agents yet.</div>
              ) : (
                <AnimatePresence>
                  {escalations.map((esc, i) => (
                    <motion.div key={esc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                        esc.status === "open" ? "border-l-4 border-l-orange-400 border-t border-r border-b border-[#E2E8F0]" :
                        "border-l-4 border-l-green-400 border-t border-r border-b border-[#E2E8F0]"
                      }`}>
                      <div className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => openEscalation(esc.id)}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              {/* Agent Photo */}
                              <div className="flex items-center gap-2 px-2 py-1 bg-blue-50/50 rounded-lg border border-blue-100">
                                <div className="w-5 h-5 rounded-full bg-blue-200 overflow-hidden flex items-center justify-center">
                                  {agents.find(a => a.id === esc.workerId)?.profilePhoto ? (
                                    <img src={agents.find(a => a.id === esc.workerId)?.profilePhoto} alt={esc.workerName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] font-black text-blue-700">{esc.workerName.charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <span className="text-[10px] text-blue-700 font-bold">{esc.workerName}</span>
                              </div>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${esc.status === "open" ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-green-50 text-green-600 border border-green-100"}`}>{esc.status}</span>
                              <span className="text-xs text-gray-400">{formatTime(esc.createdAt)}</span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-2">{esc.message}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {esc.status === "open" && (
                              <button onClick={(e) => { e.stopPropagation(); resolveEsc(esc.id); }}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-[10px] font-bold hover:bg-green-700 transition-all">
                                Resolve
                              </button>
                            )}
                            <span className="material-icons text-gray-300">{viewingEsc === esc.id ? "expand_less" : "expand_more"}</span>
                          </div>
                        </div>
                      </div>

                      {viewingEsc === esc.id && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="border-t border-gray-100">
                          <div className="p-5 space-y-3 max-h-72 overflow-y-auto bg-[#F8FAFC]">
                            <div className="flex justify-start">
                              <div className="bg-[#0F172A] text-white rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] flex gap-3">
                                <div className="w-6 h-6 rounded-full bg-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center mt-1">
                                  {agents.find(a => a.id === esc.workerId)?.profilePhoto ? (
                                    <img src={agents.find(a => a.id === esc.workerId)?.profilePhoto} alt={esc.workerName} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[10px] font-black text-white">{esc.workerName.charAt(0).toUpperCase()}</span>
                                  )}
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold text-blue-300 uppercase mb-1">{esc.workerName}</p>
                                  <p className="text-sm whitespace-pre-wrap">{esc.message}</p>
                                </div>
                              </div>
                            </div>
                            {(escMessages[esc.id] || []).map(msg => (
                              <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-end" : "justify-start"}`}>
                                <div className={`rounded-2xl px-4 py-3 max-w-[80%] ${msg.isAdmin ? "bg-amber-500 text-white rounded-tr-sm" : "bg-white border border-gray-100 rounded-tl-sm"}`}>
                                  <p className={`text-[10px] font-bold uppercase mb-1 ${msg.isAdmin ? "text-amber-100" : "text-blue-600"}`}>{msg.senderName}</p>
                                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                          {esc.status === "open" && (
                            <div className="p-4 border-t border-gray-100 flex gap-3">
                              <input value={replyText} onChange={(e) => setReplyText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(esc.id); } }}
                                placeholder="Type your reply..." className="flex-1 bg-[#F1F3F9] border border-[#E2E8F0] rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400" />
                              <button onClick={() => sendReply(esc.id)} disabled={sending || !replyText.trim()}
                                className="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-xs font-bold disabled:bg-gray-200 disabled:text-gray-400 shadow-sm">
                                Reply
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        )}

        {activeTab === "agents" && (
          <div>
            <div className="bg-white border-b border-[#E2E8F0] px-8 py-6">
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">My Agents</h1>
              <p className="text-sm text-gray-500 mt-1">Workers assigned to your supervision</p>
            </div>
            <div className="px-8 py-6 max-w-3xl space-y-2">
              {agents.length === 0 ? (
                <div className="text-center py-20 text-gray-400 text-sm">No agents assigned yet. Ask admin to assign workers to you.</div>
              ) : agents.map((agent, i) => (
                <motion.div key={agent.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-50 to-amber-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {agent.profilePhoto ? <img src={agent.profilePhoto} alt={agent.name} className="w-full h-full object-cover" /> :
                      <span className="material-icons text-amber-300 text-xl">person</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#0F172A] text-sm truncate">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.jobTitle || "Team Member"}</div>
                  </div>
                  <div className="text-xs text-gray-400">{agent.email}</div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
