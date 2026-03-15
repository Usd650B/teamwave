"use client";

import React, { useState } from "react";
import { auth } from "@/lib/firebase/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect to home or chat list
      window.location.href = "/home";
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col min-h-screen justify-center items-center bg-[#F5F5F5]">
      <form className="bg-white p-6 rounded shadow w-full max-w-sm" onSubmit={handleLogin}>
        <h2 className="text-xl font-bold text-[#2563EB] mb-4">Login</h2>
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
        <button type="submit" className="w-full bg-[#2563EB] text-white py-2 rounded font-medium">Login</button>
        <div className="mt-4 text-center">
          <a href="/signup" className="text-[#2563EB]">Don't have an account? Sign up</a>
        </div>
      </form>
    </div>
  );
}
