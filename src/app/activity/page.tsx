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

const ICON_MAP: Record<string, { icon: string; color: string; bg: string }> = {
  friend_request_sent: { icon: "person_add", color: "text-blue-500", bg: "bg-blue-50" },
  friend_request_accepted: { icon: "handshake", color: "text-green-500", bg: "bg-green-50" },
  friend_request_rejected: { icon: "person_remove", color: "text-red-500", bg: "bg-red-50" },
  escalation_created: { icon: "support_agent", color: "text-orange-500", bg: "bg-orange-50" },
  escalation_resolved: { icon: "check_circle", color: "text-green-500", bg: "bg-green-50" },
  escalation_replied: { icon: "reply", color: "text-blue-500", bg: "bg-blue-50" },
  update_posted: { icon: "campaign", color: "text-purple-500", bg: "bg-purple-50" },
  chat_started: { icon: "chat", color: "text-blue-500", bg: "bg-blue-50" },
  chat_deleted: { icon: "delete", color: "text-red-500", bg: "bg-red-50" },
  account_login: { icon: "login", color: "text-gray-500", bg: "bg-gray-50" },
};

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => { setCurrentUser(user); if (!user) router.replace("/login"); });
    return unsub;
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, "activityLog"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(100)
    );
    const unsub = onSnapshot(q, (snap) => {
      setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Activity[]);
      setLoading(false);
    }, () => {
      // Fallback without index
      const fb = query(collection(db, "activityLog"), where("userId", "==", currentUser.uid));
      onSnapshot(fb, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Activity[];
        data.sort((a, b) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
        setActivities(data.slice(0, 100));
        setLoading(false);
      });
    });
    return () => unsub();
  }, [currentUser]);

  const formatTime = (ts: any) => {
    if (!ts?.toDate) return "";
    const d = ts.toDate();
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const groupByDate = (items: Activity[]) => {
    const groups: Record<string, Activity[]> = {};
    items.forEach(item => {
      const dateStr = item.createdAt?.toDate?.()
        ? item.createdAt.toDate().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
        : "Unknown Date";
      if (!groups[dateStr]) groups[dateStr] = [];
      groups[dateStr].push(item);
    });
    return groups;
  };

  const grouped = groupByDate(activities);

  return (
    <AppShell>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Activity History</h1>
              <p className="text-sm text-gray-500 mt-1">Your recent actions and events in the system</p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
              <span className="material-icons text-gray-400 text-sm">history</span>
              <span className="text-xs font-bold text-gray-600">{activities.length} Events</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-3xl">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="bg-white rounded-xl p-4 border border-[#E2E8F0] animate-pulse shadow-sm flex items-center gap-4">
                    <div className="w-9 h-9 bg-gray-100 rounded-lg"></div>
                    <div className="flex-1"><div className="h-3 bg-gray-100 rounded w-2/3 mb-2"></div><div className="h-2 bg-gray-50 rounded w-1/4"></div></div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-5">
                  <span className="material-icons text-gray-400 text-3xl">history</span>
                </div>
                <h3 className="text-[#0F172A] font-bold text-lg mb-2">No Activity Yet</h3>
                <p className="text-sm text-gray-400 max-w-sm">Your actions will appear here as you use the system.</p>
              </div>
            ) : (
              Object.entries(grouped).map(([date, items]) => (
                <div key={date} className="mb-8">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">{date}</h3>
                    <div className="flex-1 h-px bg-gray-100"></div>
                  </div>
                  <div className="space-y-2">
                    {items.map((act, i) => {
                      const meta = ICON_MAP[act.type] || { icon: "info", color: "text-gray-500", bg: "bg-gray-50" };
                      return (
                        <motion.div key={act.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                          className="bg-white rounded-xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-4 hover:border-blue-200 transition-all">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                            <span className={`material-icons text-sm ${meta.color}`}>{meta.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-[#0F172A] font-medium truncate">{act.description}</p>
                            {act.targetName && (
                              <p className="text-[11px] text-gray-400 mt-0.5">
                                <span className="material-icons text-[10px] align-middle mr-0.5">person</span>
                                {act.targetName}
                              </p>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">{formatTime(act.createdAt)}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
