"use client";

import React, { useState, useEffect } from "react";
import { auth, db, storage } from "@/lib/firebase/firebase";
import { updateProfile } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function ProfilePage() {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return;
      
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setName(userData.name || user.displayName || "");
        setJobTitle(userData.jobTitle || "");
        setPrivacy(userData.privacy || "public");
        setProfilePhoto(userData.profilePhoto || user.photoURL || "");
      }
    };
    
    fetchUserData();
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      if (!user) return;

      let photoUrl = profilePhoto;
      
      // Upload new photo if selected
      if (photoFile) {
        const storageRef = ref(storage, `profile-photos/${user.uid}/${Date.now()}_${photoFile.name}`);
        await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(storageRef);
      }

      // Update Firebase Auth profile
      await updateProfile(user, { displayName: name, photoURL: photoUrl });

      // Update Firestore document using setDoc to create if it doesn't exist
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        name,
        jobTitle,
        privacy,
        email: user.email,
        profilePhoto: photoUrl,
        updatedAt: new Date()
      }, { merge: true }); // merge: true allows updating without overwriting existing fields

      setProfilePhoto(photoUrl);
      setPhotoFile(null);
      setIsEditing(false);
      
      // Trigger a re-fetch of user data
      setUser(auth.currentUser);
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.signOut();
      window.location.href = "/";
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5]">
      <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB]">
        <h1 className="text-xl font-bold text-[#2563EB]">Profile</h1>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="text-[#2563EB] font-medium"
        >
          {isEditing ? "Cancel" : "Edit"}
        </button>
      </header>
      <main className="flex-1 flex flex-col items-center px-4 py-8">
        <div className="relative mb-4">
          {profilePhoto ? (
            <img 
              src={profilePhoto} 
              alt="Profile" 
              className="w-24 h-24 rounded-full object-cover"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#E5E7EB] flex items-center justify-center">
              <span className="text-gray-400 text-2xl">👤</span>
            </div>
          )}
          {isEditing && (
            <label className="absolute bottom-0 right-0 bg-[#2563EB] text-white rounded-full w-8 h-8 flex items-center justify-center cursor-pointer">
              <span className="text-xs">📷</span>
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
          <div className="w-full max-w-xs space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-[#E5E7EB] rounded"
                placeholder="Your name"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full p-2 border border-[#E5E7EB] rounded"
                placeholder="Your job title"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Privacy</label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="public"
                    checked={privacy === "public"}
                    onChange={(e) => setPrivacy(e.target.value as "public" | "private")}
                    className="mr-2"
                  />
                  <span className="text-sm">Public - Discoverable by team</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="private"
                    checked={privacy === "private"}
                    onChange={(e) => setPrivacy(e.target.value as "public" | "private")}
                    className="mr-2"
                  />
                  <span className="text-sm">Private - Only chat with people you follow</span>
                </label>
              </div>
            </div>
            
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-[#2563EB] text-white py-2 rounded font-medium"
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[#2563EB] mb-2">{name}</h2>
            <p className="text-gray-700 mb-2">{jobTitle}</p>
            <div className="mb-4">
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                privacy === "public" 
                  ? "bg-green-100 text-green-800" 
                  : "bg-gray-100 text-gray-800"
              }`}>
                {privacy === "public" ? "🌍 Public" : "🔒 Private"}
              </span>
            </div>
            <div className="flex gap-4 mb-4">
              <div className="text-center">
                <div className="font-bold text-[#2563EB]">0</div>
                <div className="text-xs text-gray-500">Followers</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-[#2563EB]">0</div>
                <div className="text-xs text-gray-500">Following</div>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full max-w-xs bg-[#E5E7EB] text-[#2563EB] py-2 rounded font-medium"
            >
              Logout
            </button>
          </>
        )}
      </main>
      <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-[#E5E7EB] flex justify-around py-2">
        <a href="/home" className="flex flex-col items-center text-black">
          <span className="material-icons">chat</span>
          <span className="text-xs">Home</span>
        </a>
        <a href="/discover" className="flex flex-col items-center text-black">
          <span className="material-icons">search</span>
          <span className="text-xs">Discover</span>
        </a>
        <a href="/profile" className="flex flex-col items-center text-[#2563EB]">
          <span className="material-icons">person</span>
          <span className="text-xs">Profile</span>
        </a>
      </nav>
    </div>
  );
}
