"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase/firebase";
import { collection, getDocs, doc, setDoc, deleteDoc, getDoc, query, where, addDoc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { auth } from "@/lib/firebase/firebase";

export default function EmployeeDirectory() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [following, setFollowing] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState(auth.currentUser);

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      console.log("Auth state changed in discover:", user);
      setCurrentUser(user);
    });
    
    return unsubscribe;
  }, []);

  useEffect(() => {
    const fetchEmployees = async () => {
      const querySnapshot = await getDocs(collection(db, "users"));
      setEmployees(querySnapshot.docs.map(doc => doc.data()));
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    const fetchFollowing = async () => {
      const user = currentUser;
      if (!user) return;
      console.log("Fetching following for user:", user.uid);
      const followingDoc = await getDoc(doc(db, "following", user.uid));
      if (followingDoc.exists()) {
        const followingList = followingDoc.data().list || [];
        console.log("Following list loaded:", followingList);
        setFollowing(followingList);
      }
    };
    fetchFollowing();
  }, [currentUser]);

  // Real-time listener for following changes
  useEffect(() => {
    const user = currentUser;
    if (!user) return;

    const followingRef = doc(db, "following", user.uid);
    const unsubscribe = onSnapshot(followingRef, (doc) => {
      if (doc.exists()) {
        const followingList = doc.data().list || [];
        console.log("Following list updated in real-time:", followingList);
        setFollowing(followingList);
      } else {
        console.log("Following document deleted, clearing list");
        setFollowing([]);
      }
    });

    return unsubscribe;
  }, [currentUser]);

  const handleFollow = async (empId: string) => {
    const user = currentUser;
    if (!user) {
      console.error("=== NO AUTHENTICATED USER ===");
      alert("Please log in to follow users.");
      return;
    }
    
    console.log("=== FOLLOWING USER ===");
    console.log("Current user:", user.uid);
    console.log("Following user:", empId);
    
    try {
      // Add to following
      console.log("Adding to following collection...");
      const followingRef = doc(db, "following", user.uid);
      const followingDoc = await getDoc(followingRef);
      let followingList = followingDoc.exists() ? followingDoc.data().list || [] : [];
      
      console.log("Current following list:", followingList);
      
      if (!followingList.includes(empId)) {
        followingList.push(empId);
        await setDoc(followingRef, { list: followingList });
        setFollowing(followingList);
        console.log("✅ Added to following:", followingList);
      } else {
        console.log("User already in following list");
      }
      
      // Add to followers
      console.log("Adding to followers collection...");
      const followersRef = doc(db, "followers", empId);
      const followersDoc = await getDoc(followersRef);
      let followersList = followersDoc.exists() ? followersDoc.data().list || [] : [];
      
      console.log("Current followers list:", followersList);
      
      if (!followersList.includes(user.uid)) {
        followersList.push(user.uid);
        await setDoc(followersRef, { list: followersList });
        console.log("✅ Added to followers:", followersList);
      } else {
        console.log("User already in followers list");
      }
      
      console.log("=== FOLLOW SUCCESSFUL ===");
      alert("Successfully followed user!");
    } catch (error) {
      console.error("=== ERROR FOLLOWING USER ===");
      console.error("Error details:", error);
      
      const firebaseError = error as any;
      console.error("Error code:", firebaseError.code);
      console.error("Error message:", firebaseError.message);
      
      if (firebaseError.code === 'permission-denied') {
        alert("Permission denied. Please check Firebase security rules.");
      } else {
        alert("Failed to follow user: " + (firebaseError.message || "Unknown error"));
      }
    }
  };

  const handleUnfollow = async (empId: string) => {
    const user = currentUser;
    if (!user) {
      console.error("=== NO AUTHENTICATED USER ===");
      alert("Please log in to unfollow users.");
      return;
    }
    
    console.log("=== UNFOLLOWING USER ===");
    console.log("Current user:", user.uid);
    console.log("Unfollowing user:", empId);
    
    try {
      // Remove from following
      console.log("Removing from following collection...");
      const followingRef = doc(db, "following", user.uid);
      const followingDoc = await getDoc(followingRef);
      let followingList = followingDoc.exists() ? followingDoc.data().list || [] : [];
      
      console.log("Current following list:", followingList);
      
      followingList = followingList.filter((id: string) => id !== empId);
      await setDoc(followingRef, { list: followingList });
      setFollowing(followingList);
      console.log("✅ Removed from following:", followingList);
      
      // Remove from followers
      console.log("Removing from followers collection...");
      const followersRef = doc(db, "followers", empId);
      const followersDoc = await getDoc(followersRef);
      let followersList = followersDoc.exists() ? followersDoc.data().list || [] : [];
      
      console.log("Current followers list:", followersList);
      
      followersList = followersList.filter((id: string) => id !== user.uid);
      await setDoc(followersRef, { list: followersList });
      console.log("✅ Removed from followers:", followersList);
      
      console.log("=== UNFOLLOW SUCCESSFUL ===");
      alert("Successfully unfollowed user!");
    } catch (error) {
      console.error("=== ERROR UNFOLLOWING USER ===");
      console.error("Error details:", error);
      
      const firebaseError = error as any;
      console.error("Error code:", firebaseError.code);
      console.error("Error message:", firebaseError.message);
      
      if (firebaseError.code === 'permission-denied') {
        alert("Permission denied. Please check Firebase security rules.");
      } else {
        alert("Failed to unfollow user: " + (firebaseError.message || "Unknown error"));
      }
    }
  };

  const handleChat = async (empId: string) => {
    const user = auth.currentUser;
    if (!user) return;
    
    // Check if conversation already exists
    const conversationsRef = collection(db, "conversations");
    const q = query(
      conversationsRef,
      where("participants", "array-contains", user.uid)
    );
    
    const querySnapshot = await getDocs(q);
    const existingConversation = querySnapshot.docs.find(doc => {
      const participants = doc.data().participants;
      return participants.includes(empId) && participants.length === 2;
    });
    
    if (existingConversation) {
      // Navigate to existing conversation
      window.location.href = `/chat/${existingConversation.id}`;
    } else {
      // Create new conversation
      const newConversation = await addDoc(conversationsRef, {
        participants: [user.uid, empId],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        name: "", // Will be populated with the other user's name
      });
      
      // Navigate to new conversation
      window.location.href = `/chat/${newConversation.id}`;
    }
  };

  const filtered = employees.filter(emp => {
    // Don't show current user
    if (emp.id === auth.currentUser?.uid) return false;
    
    // All users are public now - no privacy filtering
    // Search filter
    return emp.name.toLowerCase().includes(search.toLowerCase()) ||
           (emp.jobTitle || "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <h1 className="text-xl font-bold text-[#2563EB]">Discover Employees</h1>
      </header>
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <h2 className="text-lg font-semibold text-[#2563EB] mb-2">Employee Directory</h2>
        <input
          type="text"
          placeholder="Search employees..."
          className="w-full max-w-md mb-4 p-2 border border-[#E5E7EB] rounded"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="w-full max-w-md bg-white rounded shadow p-4">
          {filtered.length === 0 ? (
            <div className="text-gray-400 text-center">No employees found.</div>
          ) : (
            filtered.map(emp => (
              <div key={emp.id} className="flex items-center gap-4 py-2 border-b border-[#E5E7EB] last:border-b-0">
                <div className="w-10 h-10 rounded-full bg-[#E5E7EB] flex items-center justify-center">
                  {emp.profilePhoto ? (
                    <img 
                      src={emp.profilePhoto} 
                      alt={emp.name} 
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-gray-400 text-lg">👤</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-black">{emp.name}</div>
                  <div className="text-xs text-gray-500">{emp.jobTitle || ""}</div>
                  <div className="text-xs text-gray-400">
                    🌍 Public
                  </div>
                </div>
                <div className="flex gap-2">
                  {following.includes(emp.id) ? (
                    <button
                      className="px-3 py-1 rounded bg-[#E5E7EB] text-[#2563EB] text-xs font-medium"
                      onClick={() => handleUnfollow(emp.id)}
                    >Unfollow</button>
                  ) : (
                    <button
                      className="px-3 py-1 rounded bg-[#2563EB] text-white text-xs font-medium"
                      onClick={() => handleFollow(emp.id)}
                    >Follow</button>
                  )}
                  <button
                    className="px-3 py-1 rounded bg-green-500 text-white text-xs font-medium"
                    onClick={() => handleChat(emp.id)}
                  >Chat</button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-[#E5E7EB] flex justify-around py-2">
        <a href="/home" className="flex flex-col items-center text-black">
          <span className="material-icons">chat</span>
          <span className="text-xs">Home</span>
        </a>
        <a href="/discover" className="flex flex-col items-center text-[#2563EB]">
          <span className="material-icons">search</span>
          <span className="text-xs">Discover</span>
        </a>
        <a href="/profile" className="flex flex-col items-center text-black">
          <span className="material-icons">person</span>
          <span className="text-xs">Profile</span>
        </a>
      </nav>
    </div>
  );
}
