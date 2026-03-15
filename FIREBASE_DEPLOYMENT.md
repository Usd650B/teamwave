# Firebase Security Rules Deployment Instructions

## 🚨 IMPORTANT: Manual Deployment Required

The CLI deployment failed due to project permissions. Please follow these manual steps:

## 📝 Step 1: Deploy Firestore Rules

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `studio-8347185779-2b0fa`
3. **Navigate to Firestore**: 
   - Click "Firestore Database" in the left menu
   - If not enabled, click "Create database"
4. **Go to Rules tab**:
   - Click "Rules" tab at the top
5. **Replace the rules** with this content:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users collection - allow read/write for authenticated users
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
    
    // Conversations collection - allow read/write for authenticated users
    match /conversations/{conversationId} {
      allow read, write: if request.auth != null;
      
      // Messages subcollection
      match /messages/{messageId} {
        allow read, write: if request.auth != null;
      }
      
      // Typing subcollection
      match /typing/{userId} {
        allow read, write: if request.auth != null;
      }
    }
    
    // Following collection - allow read/write for authenticated users
    match /following/{userId} {
      allow read, write: if request.auth != null;
    }
    
    // Followers collection - allow read/write for authenticated users
    match /followers/{userId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

6. **Publish the rules**: Click "Publish" button

## 📁 Step 2: Deploy Storage Rules

1. **Go to Firebase Storage**:
   - Click "Storage" in the left menu
   - If not enabled, click "Get started"
2. **Go to Rules tab**:
   - Click "Rules" tab at the top
3. **Replace the rules** with this content:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/{allPaths=**} {
    // Allow authenticated users to read/write all files
    allow read, write: if request.auth != null;
    
    // Specific rules for different file types
    match /profile-photos/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
    
    match /uploads/{conversationId}/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

4. **Publish the rules**: Click "Publish" button

## ✅ Verification

After deployment, test:
1. **Send a message** in chat
2. **Follow/unfollow** a user
3. **Upload a file**

All should work without permission errors!

## 🔧 Files Created

- `firebase.firestore.rules` - Firestore security rules
- `firebase.storage.rules` - Storage security rules  
- `firebase.json` - Firebase configuration
- `deploy-firebase-rules.bat` - Windows deployment script
- `deploy-firebase-rules.sh` - Mac/Linux deployment script
