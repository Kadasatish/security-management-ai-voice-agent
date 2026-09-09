import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyCTmhhMI5bMUaZRN5_-1ASEyIC8Qb2Fwzs',
  authDomain: 'security-ai-calling-agent.firebaseapp.com',
  projectId: 'security-ai-calling-agent',
  storageBucket: 'security-ai-calling-agent.firebasestorage.app',
  messagingSenderId: '131769227578',
  appId: '1:131769227578:web:61dea842994a2f97c11803',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
