"use client";

import React, { useState } from "react";
import { auth, db } from "@/lib/firebase/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { setDoc, doc, serverTimestamp } from "firebase/firestore";

export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName: name });
      await setDoc(doc(db, "users", userCredential.user.uid), {
        id: userCredential.user.uid,
        name,
        email,
        profilePhoto: userCredential.user.photoURL || "",
        jobTitle: "",
        createdAt: serverTimestamp(),
      });
      window.location.href = "/home";
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-[#F5F5F5]">
      <form className="bg-white p-6 rounded shadow w-full max-w-sm" onSubmit={handleSignup}>
        <h2 className="text-xl font-bold text-[#2563EB] mb-4">Sign Up</h2>
        <input
          type="text"
          placeholder="Name"
          className="w-full mb-3 p-2 border border-[#E5E7EB] rounded"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 p-2 border border-[#E5E7EB] rounded"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="w-full mb-3 p-2 border border-[#E5E7EB] rounded"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && <div className="text-red-500 mb-2">{error}</div>}
        <button type="submit" className="w-full bg-[#2563EB] text-white py-2 rounded font-medium">Sign Up</button>
        <div className="mt-4 text-center">
          <a href="/login" className="text-[#2563EB]">Already have an account? Login</a>
        </div>
      </form>
    </div>
  );
}
