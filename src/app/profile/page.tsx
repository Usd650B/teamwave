"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db, storage } from "@/lib/firebase/firebase";
import { updateProfile, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        router.replace("/login");
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setName(userData.name || user.displayName || "");
          setJobTitle(userData.jobTitle || "");
          setProfilePhoto(userData.profilePhoto || user.photoURL || "");
        } else {
          setName(user.displayName || "");
          setProfilePhoto(user.photoURL || "");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      }
    };

    fetchUserData();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let photoUrl = profilePhoto;

      if (photoFile) {
        const storageRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}_${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(storageRef);
      }

      await updateProfile(user, { displayName: name, photoURL: photoUrl });

      await setDoc(
        doc(db, "users", user.uid),
        {
          id: user.uid,
          name,
          jobTitle,
          email: user.email,
          profilePhoto: photoUrl,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      setProfilePhoto(photoUrl);
      setPhotoFile(null);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Failed to save profile.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.replace("/");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2563EB]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC]">
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E2E8F0] sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-[#2563EB] transition-colors">
            <span className="material-icons">arrow_back</span>
          </button>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Profile</h1>
        </div>
        <button
          onClick={() => {
            setIsEditing(!isEditing);
            if (isEditing) setPhotoFile(null);
          }}
          className="text-sm font-bold text-[#2563EB] bg-blue-50 px-4 py-1.5 rounded-full hover:bg-blue-100 transition-colors"
        >
          {isEditing ? "CANCEL" : "EDIT PROFILE"}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12 pb-24 max-w-lg mx-auto w-full">
        <div className="relative group mb-8">
          <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-blue-50 to-blue-100 p-1 shadow-2xl shadow-blue-500/10">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="w-full h-full rounded-[1.25rem] object-cover" />
            ) : (
              <div className="w-full h-full rounded-[1.25rem] bg-gray-50 flex items-center justify-center">
                <span className="material-icons text-gray-300 text-5xl">person</span>
              </div>
            )}
          </div>
          {isEditing && (
            <label className="absolute -bottom-2 -right-2 bg-[#2563EB] text-white rounded-2xl w-10 h-10 flex items-center justify-center cursor-pointer shadow-lg hover:bg-blue-600 transition-all">
              <span className="material-icons text-xl">camera_alt</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          )}
        </div>

        {isEditing ? (
          <div className="w-full space-y-6 bg-white p-8 rounded-3xl border border-[#E2E8F0] shadow-sm">
            <div className="space-y-4">
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-50 border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    placeholder="e.g. John Doe"
                  />
               </div>
               <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 mb-1.5 block">Job Title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full bg-gray-50 border border-[#E2E8F0] rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
                    placeholder="e.g. Senior Developer"
                  />
               </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-[#1E293B] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-gray-200 disabled:opacity-50"
            >
              {loading ? "SAVING..." : "SAVE CHANGES"}
            </button>
          </div>
        ) : (
          <div className="w-full space-y-10">
            <div className="text-center">
              <h2 className="text-3xl font-black text-[#1E293B] mb-1">{name || "Mysterious Colleague"}</h2>
              <p className="text-[#2563EB] font-black text-xs uppercase tracking-widest mb-4">
                {jobTitle || "Team Member"}
              </p>
              <div className="flex items-center justify-center gap-2">
                 <span className="bg-green-100 text-green-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">Available Now</span>
                 <span className="bg-blue-50 text-[#2563EB] text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">Verified</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="bg-white p-6 rounded-3xl border border-[#E2E8F0] text-center shadow-sm">
                  <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1">Email Address</div>
                  <div className="text-sm font-bold text-gray-900 truncate">{user.email}</div>
               </div>
               <a href="/notifications" className="bg-white p-6 rounded-3xl border border-[#E2E8F0] text-center shadow-sm hover:border-[#2563EB] transition-colors group">
                  <div className="text-gray-400 text-[10px] font-black uppercase tracking-widest mb-1 group-hover:text-[#2563EB]">Settings</div>
                  <div className="text-sm font-bold text-gray-900 flex items-center justify-center gap-1 group-hover:text-[#2563EB]">
                    Notifications <span className="material-icons text-sm">chevron_right</span>
                  </div>
               </a>
            </div>

            <button
              onClick={handleLogout}
              className="w-full bg-white text-red-500 border-2 border-red-50 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-50 transition-all"
            >
              Sign Out from Account
            </button>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 w-full bg-white/80 backdrop-blur-md border-t border-[#E2E8F0] flex justify-around py-2.5 z-20">
        <a href="/home" className="flex flex-col items-center text-gray-400 px-6 py-1 rounded-xl">
          <span className="material-icons">chat</span>
          <span className="text-[10px] font-bold mt-0.5">CHATS</span>
        </a>
        <a href="/discover" className="flex flex-col items-center text-gray-400 px-6 py-1 rounded-xl">
          <span className="material-icons">groups</span>
          <span className="text-[10px] font-bold mt-0.5 tracking-tighter">COMMUNITY</span>
        </a>
        <a href="/profile" className="flex flex-col items-center text-[#2563EB] px-6 py-1 rounded-xl">
          <span className="material-icons">person</span>
          <span className="text-[10px] font-bold mt-0.5">PROFILE</span>
        </a>
      </nav>
    </div>
  );
}
