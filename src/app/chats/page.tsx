"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, deleteDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ChatListItemSkeleton } from "@/components/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import AppShell from "@/components/AppShell";
import { logActivity } from "@/lib/logActivity";

interface Conversation {
  id: string; name?: string; participants: string[]; isGroup?: boolean;
  lastMessage?: string; updatedAt?: any; unread?: boolean;
}
interface UserProfile {
  id: string; name?: string; profilePhoto?: string; jobTitle?: string; isVerified?: boolean;
}

export default function ChatsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [userCache, setUserCache] = useState<Record<string, UserProfile>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const [friends, setFriends] = useState<string[]>([]);
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
    const q = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, async (snapshot) => {
      const convs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
      const friendConvs = convs.filter(conv => {
        if (conv.isGroup) return true;
        const otherId = conv.participants?.find(uid => uid !== currentUser?.uid);
        return otherId && friends.includes(otherId);
      });
      setConversations(friendConvs);
      setIsLoading(false);
      for (const conv of friendConvs) {
        if (!conv.isGroup && conv.participants) {
          const otherId = conv.participants.find(uid => uid !== currentUser?.uid);
          if (otherId && !userCache[otherId]) {
            const userDoc = await getDoc(doc(db, "users", otherId));
            if (userDoc.exists()) setUserCache(prev => ({ ...prev, [otherId]: { id: userDoc.id, ...userDoc.data() } as UserProfile }));
          }
        }
      }
    }, (error) => {
      if (error.code === 'failed-precondition') {
        const fallback = query(collection(db, "conversations"), where("participants", "array-contains", currentUser.uid));
        onSnapshot(fallback, (snap) => {
          const convs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
          const sorted = convs.sort((a, b) => (b.updatedAt?.toDate?.() || 0) - (a.updatedAt?.toDate?.() || 0));
          setConversations(sorted.filter(c => { if (c.isGroup) return true; const o = c.participants?.find(u => u !== currentUser?.uid); return o && friends.includes(o); }));
          setIsLoading(false);
        });
      }
    });
    return () => unsub();
  }, [currentUser, friends, userCache]);

  const deleteChat = async (e: React.MouseEvent, chatId: string, chatName: string) => {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`Delete conversation with ${chatName}? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "conversations", chatId));
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const myName = userDoc.exists() ? userDoc.data().name : "User";
        logActivity(currentUser.uid, myName, "chat_deleted", `Deleted conversation with ${chatName}`, chatId, chatName);
      }
    } catch (err) { console.error(err); }
  };

  return (
    <AppShell>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white border-b border-[#E2E8F0] px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black text-[#0F172A] tracking-tight">Messages</h1>
              <p className="text-sm text-gray-500 mt-1">Chat with your accepted friends</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/friends")}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#F1F3F9] rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200 transition-all border border-[#E2E8F0]">
                <span className="material-icons text-sm">people</span> Friends
              </button>
              <button onClick={() => router.push("/discover")}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#0F172A] rounded-xl text-xs font-bold text-white hover:bg-[#1E293B] transition-all shadow-sm">
                <span className="material-icons text-sm">person_add</span> Find People
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6">
          <div className="max-w-3xl space-y-2">
            {isLoading ? (
              <div className="space-y-2"><ChatListItemSkeleton /><ChatListItemSkeleton /><ChatListItemSkeleton /></div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-5">
                  <span className="material-icons text-blue-500 text-3xl">chat_bubble_outline</span>
                </div>
                <h3 className="text-[#0F172A] font-bold text-lg mb-2">No Conversations</h3>
                <p className="text-sm text-gray-400 max-w-sm mb-6">Add friends first, then start chatting with them.</p>
                <button onClick={() => router.push("/friends")} className="px-6 py-2.5 bg-[#0F172A] text-white rounded-xl text-xs font-bold shadow-sm">View Friends</button>
              </div>
            ) : (
              <AnimatePresence>
                {conversations.map((conv, i) => {
                  const otherUid = conv.isGroup ? null : conv.participants?.find(uid => uid !== currentUser?.uid);
                  const chatName = (conv.isGroup ? conv.name : (otherUid && userCache[otherUid] ? userCache[otherUid].name : conv.name || "Chat")) || "Conversation";
                  const chatPhoto = conv.isGroup ? null : (otherUid && userCache[otherUid] ? userCache[otherUid].profilePhoto : null);
                  return (
                    <motion.div key={conv.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <Link href={`/chat/${conv.id}`}
                        className="flex items-center gap-4 p-4 bg-white rounded-xl border border-[#E2E8F0] hover:border-blue-200 hover:bg-blue-50/30 transition-all group shadow-sm block">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0">
                          {chatPhoto ? (
                            <Image src={chatPhoto} alt={chatName} width={44} height={44} className="w-full h-full rounded-xl object-cover" />
                          ) : (
                            <span className="material-icons text-blue-300 text-xl">{conv.isGroup ? 'groups' : 'person'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline mb-0.5">
                            <span className="font-bold text-[#0F172A] text-sm truncate pr-2 flex items-center gap-1">
                              {chatName}
                              {otherUid && userCache[otherUid]?.isVerified && <span className="material-icons text-green-500 text-xs">verified</span>}
                            </span>
                            <span className="text-[10px] text-gray-400 font-medium flex-shrink-0">
                              {conv.updatedAt?.toDate?.() ? conv.updatedAt.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{conv.lastMessage || "Start a conversation..."}</p>
                        </div>
                        <button onClick={(e) => { e.preventDefault(); deleteChat(e, conv.id, chatName); }}
                          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete chat">
                          <span className="material-icons text-sm">delete_outline</span>
                        </button>
                      </Link>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
