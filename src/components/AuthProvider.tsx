import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInAnonymously, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, onSnapshot, getDocs, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
// Login screen is skipped in local development (guest sign-in). Set VITE_SKIP_LOGIN=false to restore it,
// or VITE_SKIP_LOGIN=true to skip it in a production build as well.
const env = (import.meta as any).env || {};
export const SKIP_LOGIN = env.VITE_SKIP_LOGIN ? env.VITE_SKIP_LOGIN === 'true' : !!env.DEV;

const PREVIEW_USER = { uid: 'local-preview-user', email: null, displayName: 'Guest Trader', isAnonymous: true } as unknown as User;
const PREVIEW_USER_DATA: UserData = {
  role: 'participant',
  name: 'Guest Trader',
  currentCash: 100000,
  portfolioValue: 100000,
  startingBalance: 100000,
};

interface UserData {
  role: 'admin' | 'participant';
  name: string;
  currentCash: number;
  portfolioValue: number;
  startingBalance?: number;
  email?: string;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser && SKIP_LOGIN) {
        signInAnonymously(auth).catch((err) => {
          console.warn('Guest sign-in failed (enable Anonymous auth in Firebase). Using local preview user:', err);
          setUser(PREVIEW_USER);
        });
        return;
      }
      setUser(firebaseUser);
      if (!firebaseUser) {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // If guest sign-in or the profile read stalls, don't leave the preview stuck on the loading screen.
  useEffect(() => {
    if (!SKIP_LOGIN || userData) return;
    const t = setTimeout(() => {
      console.warn('Guest session did not finish loading; using local preview user.');
      setUser(PREVIEW_USER);
    }, 8000);
    return () => clearTimeout(t);
  }, [userData]);

  useEffect(() => {
    let unsubscribeDoc = () => {};
    if (user === PREVIEW_USER) {
      setUserData(PREVIEW_USER_DATA);
      setLoading(false);
    } else if (user) {
      setLoading(true);
      unsubscribeDoc = onSnapshot(
        doc(db, 'users', user.uid),
        async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserData;
            if (user.email === 'codemogger@gmail.com' && data.role !== 'admin') {
              try {
                await setDoc(doc(db, 'users', user.uid), { role: 'admin' }, { merge: true });
                data.role = 'admin';
              } catch (e) {
                console.error('Failed to elevate owner to admin:', e);
              }
            }
            if (data.startingBalance === undefined) {
              data.startingBalance = 100000;
            }
            setUserData(data);
            setLoading(false);
          } else {
            try {
              let isFirstUser = false;
              try {
                const usersSnap = await getDocs(collection(db, 'users'));
                isFirstUser = usersSnap.size === 0;
              } catch (listErr) {
                console.warn('Could not list users collection for first-user check, defaulting to participant unless owner:', listErr);
              }
              const isOwner = (user.email || '').toLowerCase() === 'codemogger@gmail.com';
              const startingBalance = 100000;
              const newProfile: UserData = {
                email: user.email || '',
                name: user.displayName || user.email?.split('@')[0] || (user.isAnonymous ? 'Guest Trader' : 'Trader'),
                role: (isFirstUser || isOwner) ? ('admin' as const) : ('participant' as const),
                startingBalance,
                currentCash: startingBalance,
                portfolioValue: startingBalance,
              };
              await setDoc(doc(db, 'users', user.uid), {
                ...newProfile,
                createdAt: serverTimestamp(),
              });
              setUserData(newProfile);
            } catch (err) {
              console.error('Error auto-initializing user document:', err);
              // Fallback local userData so user is not stuck on loading screen
              const isOwner = (user.email || '').toLowerCase() === 'codemogger@gmail.com';
              setUserData({
                email: user.email || '',
                name: user.displayName || 'Trader',
                role: isOwner ? 'admin' : 'participant',
                startingBalance: 100000,
                currentCash: 100000,
                portfolioValue: 100000
              });
            } finally {
              setLoading(false);
            }
          }
        },
        (error) => {
          console.error('User doc snapshot error:', error);
          if (SKIP_LOGIN) {
            setUser(PREVIEW_USER);
            return;
          }
          setLoading(false);
        }
      );
    } else {
      setUserData(null);
      setLoading(false);
    }
    return () => unsubscribeDoc();
  }, [user]);

  const signOut = async () => {
    if (SKIP_LOGIN) return;
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, userData, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
