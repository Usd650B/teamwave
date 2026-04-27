"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import AppShell from "@/components/AppShell";

export default function SchedulePage() {
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
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
    const unsub = onSnapshot(q, async (snap) => {
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
      const schedules = allDocs.filter(d => d.isSchedule);
      setAllSchedules(schedules);

      // Collect all unique worker IDs to fetch their names
      const allWorkerIds = new Set<string>();
      schedules.forEach(s => (s.workerIds || []).forEach((id: string) => allWorkerIds.add(id)));
      
      const names: Record<string, string> = {};
      const fetchPromises = Array.from(allWorkerIds).map(async (wid) => {
        try {
          const uDoc = await getDoc(doc(db, "users", wid));
          if (uDoc.exists()) names[wid] = uDoc.data().name || "Worker";
        } catch { names[wid] = "Worker"; }
      });
      await Promise.all(fetchPromises);
      setWorkerNames(names);
      setIsLoading(false);
    }, () => setIsLoading(false));
    return () => unsub();
  }, [currentUser]);

  const mySchedules = allSchedules.filter(s => s.workerIds?.includes(currentUser?.uid));
  const otherSchedules = allSchedules.filter(s => !s.workerIds?.includes(currentUser?.uid));

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-10">
          <h2 className="text-3xl font-black text-[#0F172A] tracking-tight">Shift Schedules</h2>
          <p className="text-gray-400 mt-2 text-sm max-w-xl">View all shift schedules across your team. Schedules you are assigned to are highlighted.</p>
        </div>

        <div className="p-8 max-w-5xl space-y-8">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-28 bg-gray-200 rounded-3xl w-full"></div>
              ))}
            </div>
          ) : allSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
                <span className="material-icons text-blue-500 text-3xl">event_available</span>
              </div>
              <h3 className="text-[#0F172A] font-bold text-lg mb-2">No Schedules Available</h3>
              <p className="text-sm text-gray-400 max-w-sm">No shift schedules have been created yet. Your supervisor or admin will set them up.</p>
            </div>
          ) : (
            <>
              {/* My Assigned Schedules */}
              {mySchedules.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-blue-600 mb-4 flex items-center gap-2">
                    <span className="material-icons text-sm">check_circle</span>
                    Your Assigned Shifts ({mySchedules.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mySchedules.map(sched => (
                      <div key={sched.id} className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/15 relative overflow-hidden">
                        <div className="absolute top-4 right-4 bg-white/20 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                          Assigned
                        </div>
                        <div className="flex items-center gap-4 mb-5">
                          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                            <span className="material-icons text-2xl">{sched.type === 'teabreak' ? 'local_cafe' : 'restaurant'}</span>
                          </div>
                          <div>
                            <h4 className="font-black text-lg">{sched.type === 'teabreak' ? 'Tea Break' : 'Lunch Time'}</h4>
                            <p className="text-blue-200 text-sm font-bold">{sched.timeRange}</p>
                          </div>
                        </div>
                        {/* Show all workers in this schedule */}
                        <div className="bg-white/10 rounded-2xl p-4 border border-white/10">
                          <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-2">Workers in this shift ({sched.workerIds?.length || 0})</p>
                          <ol className="list-decimal list-inside text-sm space-y-1.5 text-white/90 max-h-36 overflow-y-auto custom-scrollbar">
                            {(sched.workerIds || []).map((wId: string, idx: number) => (
                              <li key={wId} className={wId === currentUser?.uid ? "font-black text-white" : ""}>
                                {workerNames[wId] || "Worker"} {wId === currentUser?.uid && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-lg ml-2">You</span>}
                              </li>
                            ))}
                          </ol>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Other Schedules */}
              {otherSchedules.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                    <span className="material-icons text-sm">schedule</span>
                    Other Shifts ({otherSchedules.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {otherSchedules.map(sched => (
                      <div key={sched.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                        <div className="flex items-center gap-4 mb-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${sched.type === 'teabreak' ? 'bg-orange-50 text-orange-500' : 'bg-green-50 text-green-500'}`}>
                            <span className="material-icons text-2xl">{sched.type === 'teabreak' ? 'local_cafe' : 'restaurant'}</span>
                          </div>
                          <div>
                            <h4 className="font-black text-lg text-[#0F172A]">{sched.type === 'teabreak' ? 'Tea Break' : 'Lunch Time'}</h4>
                            <p className="text-gray-400 text-sm font-bold">{sched.timeRange}</p>
                          </div>
                        </div>
                        {/* Show all workers in this schedule */}
                        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                          <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Workers in this shift ({sched.workerIds?.length || 0})</p>
                          {(sched.workerIds?.length || 0) > 0 ? (
                            <ol className="list-decimal list-inside text-sm space-y-1.5 text-gray-600 max-h-36 overflow-y-auto custom-scrollbar">
                              {(sched.workerIds || []).map((wId: string) => (
                                <li key={wId}>{workerNames[wId] || "Worker"}</li>
                              ))}
                            </ol>
                          ) : (
                            <p className="text-xs text-gray-400 italic">No workers assigned yet</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
