"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import {
  collection, query, where, onSnapshot, doc, getDoc, updateDoc,
  addDoc, serverTimestamp, deleteDoc, getDocs
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import { logActivity } from "@/lib/logActivity";

interface FriendRequest {
  id: string; fromId: string; toId: string; fromName: string; fromPhoto?: string;
  fromJobTitle?: string; status: "pending" | "accepted" | "rejected"; createdAt: any;
}
interface Friend {
  id: string; odcId: string; odcName: string; odcPhoto?: string; odcJobTitle?: string;
}

export default function FriendsPage() {
  const [tab, setTab] = useState<"friends" | "received" | "sent">("friends");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [received, setReceived] = useState<FriendRequest[]>([]);
  const [sent, setSent] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => { setCurrentUser(user); if (!user) router.replace("/login"); });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;
    const q1 = query(collection(db, "friends"), where("user1", "==", currentUser.uid));
    const q2 = query(collection(db, "friends"), where("user2", "==", currentUser.uid));
    const processSnap = async (docs: any[]) => {
      const list: Friend[] = [];
      for (const d of docs) {
        const data = d.data();
        const otherId = data.user1 === currentUser.uid ? data.user2 : data.user1;
        const userDoc = await getDoc(doc(db, "users", otherId));
        if (userDoc.exists()) {
          const u = userDoc.data();
          list.push({ id: d.id, odcId: otherId, odcName: u.name || "User", odcPhoto: u.profilePhoto, odcJobTitle: u.jobTitle });
        }
      }
      return list;
    };
    let allDocs: any[] = [];
    const unsub1 = onSnapshot(q1, async (snap1) => {
      allDocs = [...snap1.docs];
      const unsub2 = onSnapshot(q2, async (snap2) => {
        const combined = [...allDocs, ...snap2.docs].filter((d, i, arr) => arr.findIndex(x => x.id === d.id) === i);
        setFriends(await processSnap(combined)); setLoading(false);
      });
      return () => unsub2();
    });
    return () => unsub1();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "friendRequests"), where("toId", "==", currentUser.uid), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => setReceived(snap.docs.map(d => ({ id: d.id, ...d.data() })) as FriendRequest[]));
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "friendRequests"), where("fromId", "==", currentUser.uid), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => setSent(snap.docs.map(d => ({ id: d.id, ...d.data() })) as FriendRequest[]));
    return () => unsub();
  }, [currentUser]);

  const acceptRequest = async (req: FriendRequest) => {
    setActionLoading(req.id);
    try {
      await addDoc(collection(db, "friends"), { user1: req.fromId, user2: req.toId, createdAt: serverTimestamp() });
      await updateDoc(doc(db, "friendRequests", req.id), { status: "accepted" });
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const myName = userDoc.exists() ? userDoc.data().name : "User";
        logActivity(currentUser.uid, myName, "friend_request_accepted", `Accepted friend request from ${req.fromName}`, req.fromId, req.fromName);
        logActivity(req.fromId, req.fromName, "friend_request_accepted", `Friend request accepted by ${myName}`, currentUser.uid, myName);
      }
    } catch (err: any) { alert("Failed: " + err.message); }
    finally { setActionLoading(null); }
  };

  const rejectRequest = async (req: FriendRequest) => {
    setActionLoading(req.id);
    try { await updateDoc(doc(db, "friendRequests", req.id), { status: "rejected" }); }
    catch (err: any) { alert("Failed: " + err.message); }
    finally { setActionLoading(null); }
  };

  const cancelRequest = async (reqId: string) => {
    setActionLoading(reqId);
    try { await deleteDoc(doc(db, "friendRequests", reqId)); }
    catch (err: any) { alert("Failed: " + err.message); }
    finally { setActionLoading(null); }
  };

  const startChat = async (friendId: string) => {
    if (!currentUser) return;
    try {
      const q = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid));
      const snap = await getDocs(q);
      const existing = snap.docs.find(d => { const p = d.data().participants; return p.includes(friendId) && p.length === 2 && !d.data().isGroup; });
      if (existing) { router.push(`/chat/${existing.id}`); }
      else {
        const userDoc = await getDoc(doc(db, "users", friendId));
        const friendName = userDoc.exists() ? userDoc.data().name : "Friend";
        const myDoc = await getDoc(doc(db, "users", currentUser.uid));
        const myName = myDoc.exists() ? myDoc.data().name : "User";
        const newConv = await addDoc(collection(db, "conversations"), {
          participants: [currentUser.uid, friendId], name: friendName,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(), lastMessage: "Chat started", isGroup: false,
        });
        logActivity(currentUser.uid, myName, "chat_started", `Started chat with ${friendName}`, friendId, friendName);
        router.push(`/chat/${newConv.id}`);
      }
    } catch (err: any) { alert("Failed: " + err.message); }
  };

  const tabs = [
    { key: "friends" as const, label: "Friends", count: friends.length, icon: "people" },
    { key: "received" as const, label: "Received Requests", count: received.length, icon: "person_add" },
    { key: "sent" as const, label: "Sent Requests", count: sent.length, icon: "send" },
  ];

  return (
    <AppShell>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Friends</h1>
              <p className="text-sm text-gray-500 mt-1">Manage your connections and friend requests</p>
            </div>
            <button onClick={() => router.push("/discover")}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#0F172A] rounded-xl text-xs font-bold text-white hover:bg-[#1E293B] transition-all shadow-sm">
              <span className="material-icons text-sm">person_search</span> Find People
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 flex gap-0">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold transition-all border-b-2 ${
                tab === t.key ? "border-[#0F172A] text-[#0F172A]" : "border-transparent text-gray-400 hover:text-gray-600"}`}>
              <span className="material-icons text-sm">{t.icon}</span>
              {t.label}
              {t.count > 0 && <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${tab === t.key ? "bg-[#0F172A] text-white" : "bg-gray-100 text-gray-500"}`}>{t.count}</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-3xl">
            {tab === "friends" && (
              <div className="space-y-2">
                {friends.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
                    <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mb-5">
                      <span className="material-icons text-green-500 text-3xl">people</span>
                    </div>
                    <h3 className="text-[#0F172A] font-bold text-lg mb-2">No Friends Yet</h3>
                    <p className="text-sm text-gray-400 max-w-sm mb-6">Search the directory and send friend requests to start connecting.</p>
                    <button onClick={() => router.push("/discover")} className="px-6 py-2.5 bg-[#0F172A] text-white rounded-xl text-xs font-bold shadow-sm">Browse Directory</button>
                  </div>
                ) : friends.map((f, i) => (
                  <motion.div key={f.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-4 hover:border-blue-200 transition-all">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {f.odcPhoto ? <img src={f.odcPhoto} alt={f.odcName} className="w-full h-full object-cover" /> :
                        <span className="material-icons text-green-300 text-xl">person</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#0F172A] text-sm truncate">{f.odcName}</div>
                      <div className="text-xs text-gray-500">{f.odcJobTitle || "Team Member"}</div>
                    </div>
                    <button onClick={() => startChat(f.odcId)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all shadow-sm">
                      <span className="material-icons text-xs">chat</span> Message
                    </button>
                  </motion.div>
                ))}
              </div>
            )}

            {tab === "received" && (
              <div className="space-y-2">
                {received.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-sm font-medium">No pending requests to review.</div>
                ) : received.map((req, i) => (
                  <motion.div key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="bg-white rounded-xl p-4 border border-blue-100 shadow-sm flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {req.fromPhoto ? <img src={req.fromPhoto} alt={req.fromName} className="w-full h-full object-cover" /> :
                        <span className="material-icons text-blue-300 text-xl">person</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#0F172A] text-sm truncate">{req.fromName}</div>
                      <div className="text-xs text-gray-500">{req.fromJobTitle || "Team Member"}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => acceptRequest(req)} disabled={actionLoading === req.id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold disabled:opacity-50 shadow-sm">Accept</button>
                      <button onClick={() => rejectRequest(req)} disabled={actionLoading === req.id}
                        className="px-4 py-2 bg-white text-red-500 border border-red-100 rounded-lg text-xs font-bold disabled:opacity-50">Decline</button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {tab === "sent" && (
              <div className="space-y-2">
                {sent.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-sm font-medium">No pending outgoing requests.</div>
                ) : sent.map((req, i) => (
                  <motion.div key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                    className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center flex-shrink-0">
                      <span className="material-icons text-gray-300 text-xl">person</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[#0F172A] text-sm truncate">{req.fromName}</div>
                      <div className="text-xs text-orange-500 font-medium">Pending approval...</div>
                    </div>
                    <button onClick={() => cancelRequest(req.id)} disabled={actionLoading === req.id}
                      className="px-4 py-2 bg-white text-gray-500 border border-gray-200 rounded-lg text-xs font-bold disabled:opacity-50 hover:border-red-200 hover:text-red-500 transition-all">
                      Cancel
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
