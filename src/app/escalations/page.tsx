"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import {
  collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp,
  doc, updateDoc, getDoc, getDocs
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import { logActivity } from "@/lib/logActivity";

interface UserProfile {
  id: string; name: string; supervisorId?: string;
}

interface Supervisor {
  id: string; name: string;
}

interface Escalation {
  id: string; message: string; status: "open" | "resolved";
  createdAt: any; hasNewReply?: boolean;
}

export default function EscalationsPage() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, any[]>>({});
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [connecting, setConnecting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) { router.replace("/login"); return; }
      const qUser = query(collection(db, "users"), where("id", "==", user.uid));
      onSnapshot(qUser, (snap) => {
        if (!snap.empty) {
          setMyProfile({ id: snap.docs[0].id, ...snap.docs[0].data() } as UserProfile);
        }
      });
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    const qSup = query(collection(db, "users"), where("role", "==", "supervisor"));
    const unsubSup = onSnapshot(qSup, (snap) => {
      setSupervisors(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Supervisor[]);
    });
    return () => unsubSup();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "escalations"), where("workerId", "==", currentUser.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setEscalations(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Escalation[]);
      setLoading(false);
    }, (err) => {
      if (err.code === "failed-precondition") {
        const fb = query(collection(db, "escalations"), where("workerId", "==", currentUser.uid));
        onSnapshot(fb, (snap) => {
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Escalation[];
          data.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
          setEscalations(data); setLoading(false);
        });
      }
    });
    return () => unsub();
  }, [currentUser]);

  const submitEscalation = async () => {
    if (!message.trim() || !currentUser) return;
    setSending(true);
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const userName = userDoc.exists() ? userDoc.data().name : currentUser.displayName || "Worker";
      await addDoc(collection(db, "escalations"), {
        subject: message.trim().slice(0, 50), message: message.trim(),
        workerId: currentUser.uid, workerName: userName,
        status: "open", createdAt: serverTimestamp(),
        hasNewReply: false, lastMessage: message.trim(),
      });
      logActivity(currentUser.uid, userName, "escalation_created", `Submitted: ${message.trim().slice(0, 80)}`);
      setMessage("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } catch (err: any) { alert("Failed: " + err.message); }
    finally { setSending(false); }
  };

  const viewReplies = (escId: string) => {
    if (viewingId === escId) { setViewingId(null); return; }
    setViewingId(escId);
    updateDoc(doc(db, "escalations", escId), { hasNewReply: false }).catch(() => {});
    const q = query(collection(db, "escalations", escId, "messages"), orderBy("createdAt", "asc"));
    onSnapshot(q, (snap) => {
      setReplies(prev => ({ ...prev, [escId]: snap.docs.map(d => ({ id: d.id, ...d.data() })) }));
    });
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

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
  };

  const connectSupervisor = async (supId: string) => {
    if (!currentUser || !myProfile) return;
    setConnecting(true);
    try {
      await updateDoc(doc(db, "users", myProfile.id), { supervisorId: supId });
      const sup = supervisors.find(s => s.id === supId);
      logActivity(currentUser.uid, myProfile.name, "friend_request_accepted", `Connected to Supervisor ${sup?.name}`);
    } catch (err: any) { alert("Failed to connect: " + err.message); }
    finally { setConnecting(false); }
  };

  const messageSupervisor = async () => {
    if (!currentUser || !myProfile || !myProfile.supervisorId) return;
    const sup = supervisors.find(s => s.id === myProfile.supervisorId);
    if (!sup) return;
    try {
      const q = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid));
      const snap = await getDocs(query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid)));
      const existing = snap.docs.find(d => { const p = d.data().participants; return p.includes(sup.id) && p.length === 2 && !d.data().isGroup; });
      if (existing) { router.push(`/chat/${existing.id}`); }
      else {
        const newConv = await addDoc(collection(db, "conversations"), {
          participants: [currentUser.uid, sup.id], name: `${sup.name} (Supervisor)`,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessage: "Chat started", isGroup: false,
        });
        logActivity(currentUser.uid, myProfile.name, "chat_started", `Started chat with Supervisor ${sup.name}`, sup.id, sup.name);
        router.push(`/chat/${newConv.id}`);
      }
    } catch (err: any) { alert("Failed: " + err.message); }
  };

  return (
    <AppShell>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Contact Center</h1>
              <p className="text-sm text-gray-500 mt-1">Submit issues for back office review and resolution</p>
            </div>
            <div className="flex items-center gap-4">
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

        {/* Tickets List */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-4xl space-y-6">
            
            {/* Supervisor Card */}
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden flex flex-col md:flex-row items-center justify-between p-6 gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100">
                  <span className="material-icons text-amber-500 text-2xl">shield_person</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#0F172A]">My Supervisor</h2>
                  {myProfile?.supervisorId ? (
                    <p className="text-xs text-gray-500 font-medium">
                      {supervisors.find(s => s.id === myProfile.supervisorId)?.name || "Assigned"}
                    </p>
                  ) : (
                    <p className="text-xs text-orange-500 font-bold">Not connected</p>
                  )}
                </div>
              </div>

              {myProfile?.supervisorId ? (
                <button onClick={messageSupervisor} className="px-5 py-2.5 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-2">
                  <span className="material-icons text-sm">chat</span> Direct Message
                </button>
              ) : (
                <div className="flex items-center gap-2 w-full md:w-auto">
                  <select 
                    onChange={(e) => {
                      if (e.target.value) connectSupervisor(e.target.value);
                    }}
                    disabled={connecting}
                    className="flex-1 md:w-48 bg-gray-50 border border-gray-200 text-xs rounded-xl px-4 py-2.5 outline-none focus:border-blue-400 font-bold text-gray-700 disabled:opacity-50"
                  >
                    <option value="">Select a supervisor...</option>
                    {supervisors.map(sup => (
                      <option key={sup.id} value={sup.id}>{sup.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Escalations List */}
            <div className="space-y-3">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">My Contact Center Tickets</h3>
            {loading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-4 border-orange-500 border-t-transparent"></div>
              </div>
            ) : escalations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-8 text-center bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
                <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center mb-5">
                  <span className="material-icons text-orange-500 text-3xl">support_agent</span>
                </div>
                <h3 className="text-[#0F172A] font-bold text-lg mb-2">No Tickets</h3>
                <p className="text-sm text-gray-400 max-w-sm">Need help? Type your issue below and send it to the contact center.</p>
              </div>
            ) : (
              <AnimatePresence>
                {escalations.map((esc, i) => (
                  <motion.div key={esc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                      esc.hasNewReply ? "border-l-4 border-l-blue-500 border-t border-r border-b border-blue-100" :
                      esc.status === "open" ? "border-l-4 border-l-orange-400 border-t border-r border-b border-[#E2E8F0]" :
                      "border-l-4 border-l-green-400 border-t border-r border-b border-[#E2E8F0]"
                    }`}>
                    <div className="p-5 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => viewReplies(esc.id)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider ${
                              esc.status === "open" ? "bg-orange-50 text-orange-600 border border-orange-100" : "bg-green-50 text-green-600 border border-green-100"
                            }`}>{esc.status}</span>
                            {esc.hasNewReply && (
                              <span className="px-2.5 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg uppercase tracking-wider border border-blue-100 animate-pulse">
                                New Reply
                              </span>
                            )}
                            <span className="text-xs text-gray-400 font-medium">{formatTime(esc.createdAt)}</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-2 leading-relaxed">{esc.message}</p>
                        </div>
                        <span className="material-icons text-gray-300 flex-shrink-0">
                          {viewingId === esc.id ? "keyboard_arrow_up" : "keyboard_arrow_down"}
                        </span>
                      </div>
                    </div>

                    {viewingId === esc.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        className="border-t border-gray-100">
                        <div className="p-5 space-y-3 max-h-80 overflow-y-auto bg-[#F8FAFC]">
                          <div className="flex justify-end">
                            <div className="bg-[#0F172A] text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] shadow-sm">
                              <p className="text-[10px] font-bold text-blue-300 uppercase mb-1">You</p>
                              <p className="text-sm whitespace-pre-wrap leading-relaxed">{esc.message}</p>
                            </div>
                          </div>
                          {(replies[esc.id] || []).map(msg => (
                            <div key={msg.id} className={`flex ${msg.isAdmin ? "justify-start" : "justify-end"}`}>
                              <div className={`rounded-2xl px-4 py-3 max-w-[80%] shadow-sm ${
                                msg.isAdmin ? "bg-white border border-gray-100 rounded-tl-sm" : "bg-[#0F172A] text-white rounded-tr-sm"
                              }`}>
                                <p className={`text-[10px] font-bold uppercase mb-1 ${msg.isAdmin ? "text-blue-600" : "text-blue-300"}`}>
                                  {msg.senderName}
                                </p>
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                              </div>
                            </div>
                          ))}
                          {esc.status === "resolved" && (
                            <div className="text-center py-3">
                              <span className="px-4 py-2 bg-green-50 text-green-700 text-[11px] font-bold rounded-lg border border-green-100">
                                ✓ Resolved by Back Office
                              </span>
                            </div>
                          )}
                          {(replies[esc.id] || []).length === 0 && esc.status === "open" && (
                            <div className="text-center py-4">
                              <span className="text-xs text-gray-400 font-medium">Awaiting back office response...</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            </div>
          </div>
        </div>

        {/* Compose Bar */}
        <div className="bg-white border-t border-[#E2E8F0] px-8 py-4">
          <div className="max-w-4xl flex items-end gap-4">
            <textarea ref={textareaRef} value={message} onChange={autoResize}
              placeholder="Type or paste your issue here..."
              rows={1}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEscalation(); } }}
              className="flex-1 bg-[#F1F3F9] border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white outline-none resize-none overflow-hidden transition-all"
            />
            <button onClick={submitEscalation} disabled={sending || !message.trim()}
              className="px-6 py-3 bg-[#0F172A] text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-[#1E293B] transition-all disabled:bg-gray-200 disabled:text-gray-400 shadow-sm flex items-center gap-2 flex-shrink-0">
              <span className="material-icons text-sm">{sending ? "hourglass_empty" : "send"}</span>
              {sending ? "Sending" : "Submit"}
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
