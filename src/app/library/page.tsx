"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, query, where, orderBy, onSnapshot, limit } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion } from "framer-motion";
import AppShell from "@/components/AppShell";

interface Activity {
  id: string; userId: string; userName: string; type: string;
  description: string; targetId?: string; targetName?: string; createdAt: any;
}

export default function LibraryPage() {
  const [archivedActivities, setArchivedActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const router = useRouter();

  const [isManager, setIsManager] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => { 
      setCurrentUser(user); 
      if (!user) {
        router.replace("/login"); 
        return;
      }
      const { getDoc, doc } = await import("firebase/firestore");
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().role === "manager") {
        setIsManager(true);
      }
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;
    
    let q;
    if (isManager) {
      q = query(collection(db, "activityLog"), orderBy("createdAt", "desc"), limit(2000));
    } else {
      // Removing orderBy to prevent FAILED_PRECONDITION missing index error
      q = query(collection(db, "activityLog"), where("userId", "==", currentUser.uid), limit(2000));
    }
    
    const unsub = onSnapshot(q, (snap) => {
      const allActs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Activity[];
      
      // Sort manually since we removed orderBy for non-managers
      allActs.sort((a, b) => {
        const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
        const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
      });
      
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      // Filter only those older than 1 week
      const oldActs = allActs.filter(a => {
        if (!a.createdAt?.toDate) return false;
        return a.createdAt.toDate() <= oneWeekAgo;
      });
      
      setArchivedActivities(oldActs);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser, isManager]);

  // Group by month to create "files"
  const groupByMonth = (items: Activity[]) => {
    const groups: Record<string, Activity[]> = {};
    items.forEach(item => {
      const d = item.createdAt?.toDate?.();
      if (!d) return;
      const monthStr = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      if (!groups[monthStr]) groups[monthStr] = [];
      groups[monthStr].push(item);
    });
    return groups;
  };

  const grouped = groupByMonth(archivedActivities);

  return (
    <AppShell>
      <div className="flex-1 flex flex-col overflow-hidden bg-[#F1F3F9]">
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">System Library</h1>
              <p className="text-sm text-gray-500 mt-1">Archived monthly records and historical activities</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 rounded-xl border border-indigo-100">
              <span className="material-icons text-indigo-400 text-sm">folder</span>
              <span className="text-xs font-bold text-indigo-600">{Object.keys(grouped).length} Reports</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-4xl mx-auto">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white rounded-2xl h-48 border border-[#E2E8F0] animate-pulse"></div>
                ))}
              </div>
            ) : Object.keys(grouped).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-5">
                  <span className="material-icons text-gray-400 text-3xl">folder_off</span>
                </div>
                <h3 className="text-[#0F172A] font-bold text-lg mb-2">Library is Empty</h3>
                <p className="text-sm text-gray-400 max-w-sm">Logs older than 1 week will be archived here automatically.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {Object.entries(grouped).map(([month, acts], i) => (
                  <motion.div key={month} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm hover:shadow-md hover:border-indigo-200 transition-all group flex flex-col h-48 relative overflow-hidden cursor-pointer">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-auto shadow-inner">
                      <span className="material-icons text-2xl">description</span>
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">Monthly Report</p>
                      <h3 className="text-lg font-black text-[#0F172A] leading-tight mb-2">{month}</h3>
                      {isManager && <p className="text-[10px] text-gray-500 font-bold mb-2 truncate">Company-wide Data</p>}
                      <div className="flex items-center justify-between text-xs font-bold text-gray-400 mt-auto">
                        <span className="flex items-center gap-1"><span className="material-icons text-[14px]">history</span> {acts.length} Events</span>
                        <button className="text-indigo-600 hover:text-indigo-800 transition-colors uppercase tracking-widest text-[9px] flex items-center gap-1 group-hover:underline">
                          View <span className="material-icons text-[10px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
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
