"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, query, where, onSnapshot, doc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";

export default function DiscoverPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [friends, setFriends] = useState<string[]>([]);
  const [pendingSent, setPendingSent] = useState<string[]>([]);
  const [pendingReceived, setPendingReceived] = useState<string[]>([]);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => { setCurrentUser(user); if (!user) router.replace("/login"); });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      if (!userDoc.exists()) return;
      const companyId = userDoc.data().companyId || "";
      const q = companyId ? query(collection(db, "users"), where("companyId", "==", companyId)) : query(collection(db, "users"));
      const unsub = onSnapshot(q, (snap) => setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
      return unsub;
    };
    load();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q1 = query(collection(db, "friends"), where("user1", "==", currentUser.uid));
    const q2 = query(collection(db, "friends"), where("user2", "==", currentUser.uid));
    const unsub1 = onSnapshot(q1, (snap1) => {
      const unsub2 = onSnapshot(q2, (snap2) => {
        const ids = new Set<string>();
        snap1.docs.forEach(d => ids.add(d.data().user2));
        snap2.docs.forEach(d => ids.add(d.data().user1));
        setFriends(Array.from(ids));
      });
      return () => unsub2();
    });
    return () => unsub1();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "friendRequests"), where("fromId", "==", currentUser.uid), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => setPendingSent(snap.docs.map(d => d.data().toId)));
    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "friendRequests"), where("toId", "==", currentUser.uid), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => setPendingReceived(snap.docs.map(d => d.data().fromId)));
    return () => unsub();
  }, [currentUser]);

  const sendFriendRequest = async (emp: any) => {
    if (!currentUser) return;
    setLoadingAction(emp.id);
    try {
      const userDoc = await getDoc(doc(db, "users", currentUser.uid));
      const myData = userDoc.exists() ? userDoc.data() : {};
      await addDoc(collection(db, "friendRequests"), {
        fromId: currentUser.uid, toId: emp.id,
        fromName: myData.name || currentUser.displayName || "User",
        fromPhoto: myData.profilePhoto || "", fromJobTitle: myData.jobTitle || "",
        status: "pending", createdAt: serverTimestamp(),
      });
    } catch (err: any) { alert("Failed: " + err.message); }
    finally { setLoadingAction(null); }
  };

  const filtered = employees.filter(emp => {
    if (emp.id === currentUser?.uid) return false;
    return (emp.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (emp.jobTitle || "").toLowerCase().includes(search.toLowerCase());
  });

  const getStatus = (empId: string) => {
    if (friends.includes(empId)) return "friend";
    if (pendingSent.includes(empId)) return "sent";
    if (pendingReceived.includes(empId)) return "received";
    return "none";
  };

  return (
    <AppShell>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Team Directory</h1>
              <p className="text-sm text-gray-500 mt-1">Browse colleagues and send connection requests</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <span className="material-icons text-sm text-gray-400">people</span>
              {filtered.length} Members
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-3">
          <div className="max-w-lg relative">
            <span className="material-icons absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
            <input type="text" placeholder="Search by name or job title..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#F1F3F9] border border-[#E2E8F0] rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 focus:bg-white outline-none transition-all" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-3xl space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm font-medium">
                {employees.length === 0 ? "Loading directory..." : "No matching colleagues found."}
              </div>
            ) : filtered.map((emp, i) => {
              const status = getStatus(emp.id);
              return (
                <motion.div key={emp.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                  className="bg-white rounded-xl p-4 shadow-sm border border-[#E2E8F0] hover:border-blue-200 transition-all flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {emp.profilePhoto ? <img src={emp.profilePhoto} alt={emp.name} className="w-full h-full object-cover" /> :
                      <span className="material-icons text-blue-300 text-xl">person</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-[#0F172A] text-sm truncate flex items-center gap-1">
                      {emp.name || "Unknown User"}
                      {emp.isVerified && <span className="material-icons text-green-500 text-xs">verified</span>}
                    </div>
                    <div className="text-xs text-gray-500">{emp.jobTitle || "Team Member"}</div>
                  </div>
                  <div>
                    {status === "friend" ? (
                      <span className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                        <span className="material-icons text-xs">check</span> Connected
                      </span>
                    ) : status === "sent" ? (
                      <span className="px-3 py-2 rounded-lg bg-gray-50 text-gray-400 text-xs font-bold border border-gray-100">Pending</span>
                    ) : status === "received" ? (
                      <button onClick={() => router.push("/friends")}
                        className="px-3 py-2 rounded-lg bg-orange-50 text-orange-600 text-xs font-bold border border-orange-100 animate-pulse">Review</button>
                    ) : (
                      <button onClick={() => sendFriendRequest(emp)} disabled={loadingAction === emp.id}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg bg-[#0F172A] text-white text-xs font-bold hover:bg-[#1E293B] disabled:opacity-50 shadow-sm transition-all">
                        <span className="material-icons text-xs">person_add</span>
                        {loadingAction === emp.id ? "..." : "Connect"}
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
