"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import AppShell from "@/components/AppShell";

export default function SchedulePage() {
  const [mySchedules, setMySchedules] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) { router.replace("/login"); return; }
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists() && userDoc.data().isActive === false) {
        await auth.signOut(); router.replace("/login?error=account_disabled");
      }
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "updates"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      setMySchedules(allDocs.filter(d => d.isSchedule && d.workerIds?.includes(currentUser.uid)));
      setIsLoading(false);
    }, () => setIsLoading(false));
    return () => unsub();
  }, [currentUser]);

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-10">
          <h2 className="text-3xl font-black text-[#0F172A] tracking-tight">My Schedule</h2>
          <p className="text-gray-400 mt-2 text-sm max-w-xl">View your assigned tea breaks and lunch times set by your supervisor or admin.</p>
        </div>

        <div className="p-8 max-w-4xl">
          {isLoading ? (
            <div className="animate-pulse flex gap-6">
              <div className="h-32 bg-gray-200 rounded-3xl w-full"></div>
            </div>
          ) : mySchedules.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {mySchedules.map(sched => (
                <div key={sched.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center text-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${sched.type === 'teabreak' ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500'}`}>
                    <span className="material-icons text-3xl">{sched.type === 'teabreak' ? 'local_cafe' : 'restaurant'}</span>
                  </div>
                  <h3 className="font-black text-xl text-[#0F172A] capitalize mb-1">{sched.type === 'teabreak' ? 'Tea Break' : 'Lunch Time'}</h3>
                  <p className="text-sm font-bold text-gray-400 mb-6">{sched.timeRange}</p>
                  
                  <div className="w-full bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Status</p>
                    <p className="text-sm font-bold text-[#0F172A]">Assigned</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
                <span className="material-icons text-blue-500 text-3xl">event_available</span>
              </div>
              <h3 className="text-[#0F172A] font-bold text-lg mb-2">No Schedules Assigned</h3>
              <p className="text-sm text-gray-400 max-w-sm">You haven't been assigned to any breaks or lunch times yet. Your supervisor will assign them soon.</p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
