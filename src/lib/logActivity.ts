import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";

export type ActivityType =
  | "friend_request_sent"
  | "friend_request_accepted"
  | "friend_request_rejected"
  | "escalation_created"
  | "escalation_resolved"
  | "escalation_replied"
  | "update_posted"
  | "chat_started"
  | "chat_deleted"
  | "account_login";

export async function logActivity(
  userId: string,
  userName: string,
  type: ActivityType,
  description: string,
  targetId?: string,
  targetName?: string
) {
  try {
    await addDoc(collection(db, "activityLog"), {
      userId,
      userName,
      type,
      description,
      targetId: targetId || null,
      targetName: targetName || null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}
