"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import { collection, addDoc, serverTimestamp, doc, arrayUnion, updateDoc, getDocs, getDoc, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function CreateGroupPage() {
  const [groupName, setGroupName] = useState("");
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<any>(null);
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
    const fetchCurrentAndAllUsers = async () => {
      try {
        const uDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (uDoc.exists()) {
          const uData = uDoc.data();
          setUserData(uData);
          const cId = uData.companyId || "";
          
          const q = cId 
            ? query(collection(db, "users"), where("companyId", "==", cId))
            : query(collection(db, "users"));

          const snapshot = await getDocs(q);
          setAllUsers(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        }
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchCurrentAndAllUsers();
  }, [currentUser]);

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      setError("Please name your community.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      if (!currentUser) throw new Error("User not authenticated");

      const allParticipants = [currentUser.uid, ...selectedMembers];

      const convRef = await addDoc(collection(db, "conversations"), {
        name: groupName.trim(),
        createdBy: currentUser.uid,
        companyId: userData?.companyId || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        participants: allParticipants,
        isGroup: true,
        lastMessage: "Channel established",
      });

      for (const memberId of allParticipants) {
        try {
          const userRef = doc(db, "users", memberId);
          await updateDoc(userRef, {
            groups: arrayUnion(convRef.id),
          });
        } catch (e) {
          // ignore issues
        }
      }

      router.push(`/chat/${convRef.id}`);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const availableUsers = allUsers.filter((u) => u.id !== currentUser?.uid);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-[#2563EB] transition-colors">
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">New Corridor</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12 pb-24 max-w-lg mx-auto w-full">
        <div className="w-full space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-block p-4 bg-blue-50 rounded-3xl mb-2">
              <span className="material-icons text-[#2563EB] text-4xl">add_moderator</span>
            </div>
            <h2 className="text-2xl font-black text-[#1E293B]">Group Creation</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Initialize Team Room</p>
          </div>

          <div className="bg-white rounded-3xl border border-[#E2E8F0] shadow-sm p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-[10px] font-black uppercase tracking-widest animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="material-icons text-sm">warning</span>
                  {error}
                </div>
              </div>
            )}

            <div className="space-y-6">
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Corridor Name</label>
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full bg-gray-50 border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none font-bold"
                    placeholder="e.g. Design Sync"
                    autoFocus
                  />
               </div>

               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-2 block">
                    Invite Participants ({selectedMembers.length})
                  </label>
                  <div className="max-h-64 overflow-y-auto border border-gray-100 rounded-2xl bg-gray-50/50 p-2 space-y-1">
                    {availableUsers.map((u) => {
                      const isSelected = selectedMembers.includes(u.id);
                      return (
                        <div
                          key={u.id}
                          onClick={() => toggleMember(u.id)}
                          className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${isSelected ? "bg-white shadow-sm ring-1 ring-blue-100" : "hover:bg-white/50"}`}
                        >
                          <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isSelected ? "bg-[#2563EB] border-[#2563EB]" : "border-gray-200"}`}>
                             {isSelected && <span className="material-icons text-white text-[12px]">check</span>}
                          </div>
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                            {u.profilePhoto ? (
                              <img src={u.profilePhoto} alt={u.name} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-icons text-blue-400 text-lg">person</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`font-bold text-xs truncate ${isSelected ? "text-gray-900" : "text-gray-500"}`}>{u.name || "Unknown"}</div>
                            <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">{u.jobTitle || 'Team Member'}</div>
                          </div>
                        </div>
                      );
                    })}
                    {availableUsers.length === 0 && (
                      <div className="py-12 text-center">
                        <span className="material-icons text-gray-200 text-3xl mb-2">person_off</span>
                        <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">No team members found</p>
                      </div>
                    )}
                  </div>
               </div>
            </div>

            <button
              onClick={handleCreateGroup}
              disabled={loading}
              className="w-full bg-[#1E293B] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="material-icons text-sm">{loading ? "sync" : "rocket_launch"}</span>
              {loading ? "ESTABLISHING..." : "INITIALIZE GROUP"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
