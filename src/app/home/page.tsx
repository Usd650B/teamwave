"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";

interface Update {
  id: string; title: string; message: string; priority: "normal" | "urgent";
  createdAt: any; authorName: string;
}

export default function HomePage() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [selectedUpdate, setSelectedUpdate] = useState<Update | null>(null);
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
      setUpdates(allDocs.filter(d => !d.isSchedule) as Update[]);
      setIsLoading(false);
    }, () => setIsLoading(false));
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
    if (mins < 10080) return `${Math.floor(mins / 1440)}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        {/* Page Header */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-6">
          <div className="max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Updates & Announcements</h1>
                <p className="text-sm text-gray-500 mt-1">Official communications from the back office</p>
              </div>
              <div className="flex items-center gap-2 bg-green-50 px-4 py-2 rounded-xl border border-green-100">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Live Feed</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-3">
          <div className="max-w-4xl flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="material-icons text-gray-400 text-sm">article</span>
              <span className="text-xs font-bold text-gray-500">{updates.length} Total Updates</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="material-icons text-red-400 text-sm">priority_high</span>
              <span className="text-xs font-bold text-gray-500">{updates.filter(u => u.priority === "urgent").length} Urgent</span>
            </div>
          </div>
        </div>

        {/* Title-only List */}
        <div className="px-8 py-6 max-w-4xl space-y-6">

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="bg-white rounded-xl p-4 border border-[#E2E8F0] animate-pulse shadow-sm">
                  <div className="h-4 bg-gray-100 rounded-lg w-1/3"></div>
                </div>
              ))}
            </div>
          ) : updates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
                <span className="material-icons text-blue-500 text-3xl">campaign</span>
              </div>
              <h3 className="text-[#0F172A] font-bold text-lg mb-2">No Updates Posted</h3>
              <p className="text-sm text-gray-400 max-w-sm">The back office hasn&apos;t posted any updates yet. Check back soon for important announcements.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-gray-100">
              {updates.map((update, i) => (
                <motion.button
                  key={update.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedUpdate(update)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-blue-50/40 transition-all text-left group"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    update.priority === "urgent" ? "bg-red-50" : "bg-blue-50"
                  }`}>
                    <span className={`material-icons text-sm ${update.priority === "urgent" ? "text-red-500" : "text-blue-500"}`}>
                      {update.priority === "urgent" ? "warning" : "campaign"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {update.priority === "urgent" && (
                        <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[8px] font-black rounded uppercase tracking-wider border border-red-100">
                          Urgent
                        </span>
                      )}
                      <h3 className="text-sm font-bold text-[#0F172A] truncate group-hover:text-blue-700 transition-colors">
                        {update.title}
                      </h3>
                    </div>
                  </div>
                  <span className="text-[11px] text-gray-400 font-medium flex-shrink-0">{formatTime(update.createdAt)}</span>
                  <span className="material-icons text-gray-300 text-sm group-hover:text-blue-500 transition-colors">chevron_right</span>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedUpdate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
            onClick={() => setSelectedUpdate(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b ${
                selectedUpdate.priority === "urgent" ? "border-red-100 bg-red-50/50" : "border-gray-100"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    selectedUpdate.priority === "urgent" ? "bg-red-100" : "bg-blue-50"
                  }`}>
                    <span className={`material-icons text-lg ${selectedUpdate.priority === "urgent" ? "text-red-500" : "text-blue-500"}`}>
                      {selectedUpdate.priority === "urgent" ? "warning" : "campaign"}
                    </span>
                  </div>
                  {selectedUpdate.priority === "urgent" && (
                    <span className="px-2.5 py-1 bg-red-100 text-red-600 text-[10px] font-black rounded-lg uppercase tracking-widest border border-red-200">
                      Urgent
                    </span>
                  )}
                  <span className="text-xs text-gray-400 font-medium">{formatTime(selectedUpdate.createdAt)}</span>
                </div>
                <button
                  onClick={() => setSelectedUpdate(null)}
                  className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-400 hover:text-red-500 flex items-center justify-center transition-all"
                >
                  <span className="material-icons text-lg">close</span>
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto px-6 py-6">
                <h2 className="text-xl font-black text-[#0F172A] tracking-tight mb-4">{selectedUpdate.title}</h2>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{selectedUpdate.message}</p>
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center">
                    <span className="material-icons text-blue-600 text-xs">person</span>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">{selectedUpdate.authorName || "Back Office"}</span>
                </div>
                <button
                  onClick={() => setSelectedUpdate(null)}
                  className="px-5 py-2 bg-[#0F172A] text-white rounded-xl text-xs font-bold hover:bg-[#1E293B] transition-all shadow-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}
