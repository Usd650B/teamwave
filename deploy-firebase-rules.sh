#!/bin/bash

echo "🔥 Deploying Firebase Security Rules..."

# Deploy Firestore rules
echo "📝 Deploying Firestore rules..."
firebase firestore:rules deploy firebase.firestore.rules

# Deploy Storage rules  
echo "📁 Deploying Storage rules..."
firebase storage:rules deploy firebase.storage.rules

echo "✅ Firebase Security Rules deployed successfully!"
