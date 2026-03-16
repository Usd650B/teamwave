"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(auth.currentUser);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (!user) {
        router.replace("/login");
      }
    });
    return unsubscribeAuth;
  }, [router]);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, "conversations"),
      where("isGroup", "==", true),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const groupsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setGroups(groupsData);
        setLoading(false);
      },
      (err) => {
        console.error("Groups load error:", err);
        if (err.code === 'failed-precondition') {
           const fallbackQ = query(collection(db, "conversations"), where("isGroup", "==", true));
           onSnapshot(fallbackQ, (snapshot) => {
              setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
              setLoading(false);
           });
        } else {
          setError("Failed to load groups. " + err.message);
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const handleJoinGroup = async (groupId: string) => {
    try {
      if (!currentUser) return;

      const groupRef = doc(db, "conversations", groupId);
      await updateDoc(groupRef, {
        participants: arrayUnion(currentUser.uid),
      });

      const userRef = doc(db, "users", currentUser.uid);
      await updateDoc(userRef, {
        groups: arrayUnion(groupId),
      });
    } catch (err: any) {
      setError("Failed to join group: " + err.message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/home")} className="text-gray-400 hover:text-[#2563EB] transition-colors">
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Communities</h1>
        </div>
        <button
          onClick={() => router.push("/groups/create")}
          className="bg-[#2563EB] text-white px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-600 shadow-md shadow-blue-500/20 transition-all hover:-translate-y-0.5"
        >
          Create +
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 pb-24 max-w-4xl mx-auto w-full">
        <div className="w-full space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-[#1E293B]">Discover Communities</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Global Group Directory</p>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2">
                <span className="material-icons text-sm">error</span>
                {error}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#2563EB] border-t-transparent"></div>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 px-8 text-center bg-white rounded-3xl border border-dashed border-gray-200">
              <div className="w-20 h-20 bg-blue-50 rounded-[2.5rem] flex items-center justify-center mb-6">
                <span className="material-icons text-[#2563EB] text-4xl">groups</span>
              </div>
              <h3 className="text-[#1E293B] font-black text-lg mb-2 uppercase tracking-tight">Vast Openness...</h3>
              <p className="text-sm text-gray-400 font-medium max-w-[240px] leading-relaxed mb-8">
                No active communities found. Be the pioneer and launch the first group for your organization!
              </p>
              <button
                onClick={() => router.push("/groups/create")}
                className="px-10 py-4 bg-[#1E293B] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-gray-200"
              >
                Launch Community
              </button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2">
              {groups.map((group) => {
                const isJoined = group.participants?.includes(currentUser?.uid);
                return (
                  <div key={group.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-[#E2E8F0] hover:border-[#2563EB]/40 transition-all flex flex-col group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center text-[#2563EB] text-2xl font-black shadow-inner">
                        {group.name?.charAt(0).toUpperCase() || "G"}
                      </div>
                      <div className="flex flex-col items-end">
                         <span className="bg-blue-50 text-[#2563EB] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter mb-1">Active Room</span>
                         <span className="text-[10px] font-bold text-gray-300 uppercase">{group.participants?.length || 0} Members</span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-black text-gray-900 mb-2 truncate group-hover:text-[#2563EB] transition-colors">{group.name}</h3>
                    <p className="text-xs text-gray-400 font-medium mb-8 line-clamp-2 leading-relaxed">
                      Official collaboration space for {group.name}. Connect with peers, share updates, and move work forward.
                    </p>

                    <div className="mt-auto pt-6 border-t border-gray-50 flex gap-3">
                      {isJoined ? (
                        <button
                          onClick={() => router.push(`/chat/${group.id}`)}
                          className="flex-1 bg-white text-green-600 border-2 border-green-50 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-50 transition-all flex items-center justify-center gap-2"
                        >
                          <span className="material-icons text-[14px]">send</span>
                          Open Corridor
                        </button>
                      ) : (
                        <button
                          onClick={() => handleJoinGroup(group.id)}
                          className="flex-1 bg-[#2563EB] text-white px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <span className="material-icons text-[14px]">person_add</span>
                          Join Space
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-[#E2E8F0] flex justify-around py-2.5 z-20">
        <a href="/home" className="flex flex-col items-center text-gray-400 px-6 py-1 rounded-xl">
          <span className="material-icons">chat</span>
          <span className="text-[10px] font-bold mt-0.5">CHATS</span>
        </a>
        <a href="/groups" className="flex flex-col items-center text-[#2563EB] px-6 py-1 rounded-xl">
          <span className="material-icons">groups</span>
          <span className="text-[10px] font-bold mt-0.5 tracking-tighter">COMMUNITY</span>
        </a>
        <a href="/profile" className="flex flex-col items-center text-gray-400 px-6 py-1 rounded-xl">
          <span className="material-icons">person</span>
          <span className="text-[10px] font-bold mt-0.5">PROFILE</span>
        </a>
      </nav>
    </div>
  );
}
