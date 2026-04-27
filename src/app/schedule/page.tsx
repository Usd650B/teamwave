"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import AppShell from "@/components/AppShell";

// Parse end time from a timeRange string like "10:00 AM - 10:30 AM"
function parseEndTime(timeRange: string): Date | null {
  if (!timeRange) return null;
  const parts = timeRange.split("-");
  if (parts.length < 2) return null;
  const endStr = parts[1].trim(); // e.g. "10:30 AM" or "14:30"
  const now = new Date();

  // Try 12-hour format first: "10:30 AM"
  const match12 = endStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1]);
    const mins = parseInt(match12[2]);
    const ampm = match12[3].toUpperCase();
    if (ampm === "PM" && hours < 12) hours += 12;
    if (ampm === "AM" && hours === 12) hours = 0;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins, 0);
    return d;
  }

  // Try 24-hour format: "14:30"
  const match24 = endStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1]);
    const mins = parseInt(match24[2]);
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins, 0);
    return d;
  }

  return null;
}

function isScheduleActive(timeRange: string): boolean {
  const endTime = parseEndTime(timeRange);
  if (!endTime) return true; // If can't parse, show it
  return new Date() < endTime;
}

export default function SchedulePage() {
  const [allSchedules, setAllSchedules] = useState<any[]>([]);
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [now, setNow] = useState(new Date());
  const router = useRouter();

  // Tick every 30 seconds to re-evaluate schedule visibility
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

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

  // Only show active (non-expired) schedules
  const activeSchedules = allSchedules.filter(s => isScheduleActive(s.timeRange));

  const mySchedules = activeSchedules.filter(s => s.workerIds?.includes(currentUser?.uid));
  const otherSchedules = activeSchedules.filter(s => !s.workerIds?.includes(currentUser?.uid));

  // Count of expired today
  const expiredCount = allSchedules.length - activeSchedules.length;

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
        {/* Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-10">
          <h2 className="text-3xl font-black text-[#0F172A] tracking-tight">Shift Schedules</h2>
          <p className="text-gray-400 mt-2 text-sm max-w-xl">View all active shift schedules. Expired shifts are automatically removed when their end time passes.</p>
        </div>

        <div className="p-8 max-w-5xl space-y-8">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="animate-pulse h-28 bg-gray-200 rounded-3xl w-full"></div>
              ))}
            </div>
          ) : activeSchedules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
                <span className="material-icons text-blue-500 text-3xl">event_available</span>
              </div>
              <h3 className="text-[#0F172A] font-bold text-lg mb-2">No Active Schedules</h3>
              <p className="text-sm text-gray-400 max-w-sm">
                {expiredCount > 0
                  ? `${expiredCount} schedule(s) have expired today. Your supervisor will set up new ones.`
                  : "No shift schedules have been created yet. Your supervisor or admin will set them up."}
              </p>
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
                    {mySchedules.map(sched => {
                      const endTime = parseEndTime(sched.timeRange);
                      const minsLeft = endTime ? Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 60000)) : null;

                      return (
                        <div key={sched.id} className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-blue-500/15 relative overflow-hidden">
                          <div className="absolute top-4 right-4 flex items-center gap-2">
                            {minsLeft !== null && minsLeft <= 10 && (
                              <span className="bg-red-500 text-white rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest animate-pulse">
                                {minsLeft}m left
                              </span>
                            )}
                            <span className="bg-white/20 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest">
                              Active
                            </span>
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
                              {(sched.workerIds || []).map((wId: string) => (
                                <li key={wId} className={wId === currentUser?.uid ? "font-black text-white" : ""}>
                                  {workerNames[wId] || "Worker"} {wId === currentUser?.uid && <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-lg ml-2">You</span>}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Other Schedules */}
              {otherSchedules.length > 0 && (
                <div>
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4 flex items-center gap-2">
                    <span className="material-icons text-sm">schedule</span>
                    Other Active Shifts ({otherSchedules.length})
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

          {/* Expired notice */}
          {!isLoading && expiredCount > 0 && (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-2xl px-5 py-4">
              <span className="material-icons text-gray-400 text-lg">history</span>
              <p className="text-sm text-gray-500">
                <span className="font-bold">{expiredCount} schedule(s)</span> expired today and are no longer shown. New schedules will appear when assigned by your supervisor.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
