import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

import SignIn from './page/sign_in';
import Dashboard from './page/dashboard';
import NewPlan from './page/new_plan';
import Production from './page/production';

import './App.css';

function App() {
    const [path, setPath] = useState(window.location.pathname);
    const [prodId, setProdId] = useState(null);
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);

    const checkUserRole = async (uid) => {
        const roles = ['admin', 'manager', 'staff'];
        for (let role of roles) {
            const roleDocRef = doc(db, 'roles', role);
            const roleDocSnap = await getDoc(roleDocRef);
            if (roleDocSnap.exists() && Array.isArray(roleDocSnap.data().userId) && roleDocSnap.data().userId.includes(uid)) {
                return role;
            }
        }
        return 'staff';
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const role = await checkUserRole(currentUser.uid);
                setUserRole(role);
            } else {
                setUserRole(null);
            }
            setAuthLoading(false);

            if (!currentUser && window.location.pathname !== '/') {
                window.history.replaceState({}, '', '/');
                setPath('/');
            }
        });

        const handlePopState = () => {
            setPath(window.location.pathname);
            if (window.location.pathname === '/production') {
                const params = new URLSearchParams(window.location.search);
                setProdId(parseInt(params.get('id')));
            } else {
                setProdId(null);
            }
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            unsubscribe();
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const navigate = (newPath, id = null) => {
        let url = newPath;
        if (newPath === '/production' && id !== null) {
            url = `${newPath}?id=${id}`;
        }
        window.history.pushState({}, '', url);
        setPath(newPath);
        setProdId(id);
    };

    const handleSignInSuccess = () => navigate('/dashboard');

    const handleSignout = async () => {
        try {
            await signOut(auth);
            navigate('/');
        } catch (error) {
            console.error("Signout error:", error.message);
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
                <p className="text-blue-400">Checking user status...</p>
            </div>
        );
    }

    if (!user && path !== '/') return <SignIn onSignIn={handleSignInSuccess} />;

    if (user && path === '/') return <Dashboard onNavigate={navigate} onSignout={handleSignout} user={user} userRole={userRole} />;

    const renderPage = () => {
        if (!user) {
            return <SignIn onSignIn={handleSignInSuccess} />;
        }

        switch (path) {
            case '/':           return <SignIn onSignIn={handleSignInSuccess} />;
            case '/dashboard':  return <Dashboard onNavigate={navigate} onSignout={handleSignout} user={user} userRole={userRole} />;
            case '/new_plan':   return <NewPlan onNavigate={navigate} onSignout={handleSignout} user={user} userRole={userRole} />;
            case '/production': return <Production productionId={prodId} onNavigate={navigate} onSignout={handleSignout} user={user} userRole={userRole} />;
            default:
                return (
                    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
                        <p className="text-red-500">Error: Page not found!</p>
                        <button
                            onClick={() => navigate('/')}
                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
                        >
                            Back to Home
                        </button>
                    </div>
                );
        }
    };

    return renderPage();
}

export default App;
