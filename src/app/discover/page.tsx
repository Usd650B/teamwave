"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  setDoc,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function DiscoverPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState<string[]>([]);
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);
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

    // Listen to following list
    const followingRef = doc(db, "following", currentUser.uid);
    const unsubscribeFollowing = onSnapshot(followingRef, (docSnap) => {
      if (docSnap.exists()) {
        setFollowing(docSnap.data().list || []);
      }
    });

    // Fetch all users
    const usersRef = collection(db, "users");
    const unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setEmployees(usersData);
    });

    return () => {
      unsubscribeFollowing();
      unsubscribeUsers();
    };
  }, [currentUser]);

  const handleFollow = async (empId: string) => {
    if (!currentUser) return;
    setLoadingFollow(empId);
    try {
      const followingRef = doc(db, "following", currentUser.uid);
      const updatedFollowing = [...following, empId];
      await setDoc(followingRef, { list: updatedFollowing });

      const followersRef = doc(db, "followers", empId);
      const followersSnap = await getDoc(followersRef);
      let followersList = followersSnap.exists() ? followersSnap.data().list || [] : [];
      if (!followersList.includes(currentUser.uid)) {
        followersList.push(currentUser.uid);
        await setDoc(followersRef, { list: followersList });
      }
    } catch (error: any) {
      console.error("Error following user:", error);
      alert("Failed to follow: " + (error.message || "Unknown error"));
    } finally {
      setLoadingFollow(null);
    }
  };

  const handleUnfollow = async (empId: string) => {
    if (!currentUser) return;
    setLoadingFollow(empId);
    try {
      const followingRef = doc(db, "following", currentUser.uid);
      const updatedFollowing = following.filter((id: string) => id !== empId);
      await setDoc(followingRef, { list: updatedFollowing });

      const followersRef = doc(db, "followers", empId);
      const followersSnap = await getDoc(followersRef);
      let followersList = followersSnap.exists() ? followersSnap.data().list || [] : [];
      followersList = followersList.filter((id: string) => id !== currentUser.uid);
      await setDoc(followersRef, { list: followersList });
    } catch (error: any) {
      console.error("Error unfollowing user:", error);
      alert("Failed to unfollow: " + (error.message || "Unknown error"));
    } finally {
      setLoadingFollow(null);
    }
  };

  const handleChat = async (emp: any) => {
    if (!currentUser) return;

    try {
      const conversationsRef = collection(db, "conversations");
      const q = query(conversationsRef, where("participants", "array-contains", currentUser.uid));
      const querySnapshot = await getDocs(q);

      const existingConversation = querySnapshot.docs.find((doc) => {
        const participants = doc.data().participants;
        return participants.includes(emp.id) && participants.length === 2 && !doc.data().isGroup;
      });

      if (existingConversation) {
        router.push(`/chat/${existingConversation.id}`);
      } else {
        const newConversation = await addDoc(conversationsRef, {
          participants: [currentUser.uid, emp.id],
          name: emp.name || "Private Chat",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastMessage: "Chat started",
          isGroup: false
        });
        router.push(`/chat/${newConversation.id}`);
      }
    } catch (error: any) {
      console.error("Error starting chat:", error);
      alert("Failed to start chat.");
    }
  };

  const filtered = employees.filter((emp) => {
    if (emp.id === currentUser?.uid) return false;
    const name = emp.name || "";
    const jobTitle = emp.jobTitle || "";
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      jobTitle.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-[#2563EB] transition-colors">
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="text-xl font-bold text-gray-900">Connections</h1>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-8 pb-24">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-[#1E293B]">Find your team</h2>
            <p className="text-sm text-gray-400 font-bold uppercase tracking-widest">Employee Directory</p>
          </div>

          <div className="relative group">
            <span className="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">search</span>
            <input
              type="text"
              placeholder="Search by name or title..."
              className="w-full pl-12 pr-4 py-3.5 bg-white border border-[#E2E8F0] rounded-2xl shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-[#2563EB] outline-none transition-all font-medium text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-[#E2E8F0]">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-icons text-gray-200 text-3xl">person_search</span>
                </div>
                <p className="text-gray-400 font-bold text-sm uppercase tracking-wider">
                  {employees.length === 0 ? "Building directory..." : "No matching colleagues"}
                </p>
              </div>
            ) : (
              filtered.map((emp) => (
                <div key={emp.id} className="bg-white rounded-2xl p-4 shadow-sm border border-[#E2E8F0] hover:border-[#2563EB]/30 transition-all flex items-center gap-4 group">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center flex-shrink-0 relative">
                    {emp.profilePhoto ? (
                      <img src={emp.profilePhoto} alt={emp.name} className="w-full h-full rounded-2xl object-cover shadow-inner" />
                    ) : (
                      <span className="material-icons text-blue-300 text-2xl">person</span>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 truncate">{emp.name || "Unknown User"}</div>
                    <div className="text-[10px] text-blue-500 font-black uppercase tracking-wider truncate mb-1">{emp.jobTitle || "Team Member"}</div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-400 font-bold">
                      <span className="material-icons text-[10px]">location_on</span>
                      REMOTE
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {following.includes(emp.id) ? (
                      <button
                        onClick={() => handleUnfollow(emp.id)}
                        disabled={loadingFollow === emp.id}
                        className="px-4 py-1.5 rounded-xl border-2 border-blue-50 text-[#2563EB] text-[10px] font-black uppercase tracking-widest hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        {loadingFollow === emp.id ? "..." : "Following"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleFollow(emp.id)}
                        disabled={loadingFollow === emp.id}
                        className="px-4 py-1.5 rounded-xl bg-[#2563EB] text-white text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 shadow-md shadow-blue-500/20 transition-all disabled:opacity-50"
                      >
                        {loadingFollow === emp.id ? "..." : "Follow"}
                      </button>
                    )}
                    <button
                      onClick={() => handleChat(emp)}
                      className="px-4 py-1.5 rounded-xl bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors flex items-center justify-center gap-1"
                    >
                      <span className="material-icons text-[12px]">chat</span>
                      Message
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-[#E2E8F0] flex justify-around py-2.5 z-20">
        <a href="/home" className="flex flex-col items-center text-gray-400 px-6 py-1 rounded-xl">
          <span className="material-icons">chat</span>
          <span className="text-[10px] font-bold mt-0.5">CHATS</span>
        </a>
        <a href="/groups" className="flex flex-col items-center text-gray-400 px-6 py-1 rounded-xl">
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
