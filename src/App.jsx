import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import SignIn from './page/sign_in';
import Dashboard from './page/dashboard';
import NewPlan from './page/new_plan';
import Production from './page/production';
import './App.css';

// App Component
function App() {
  // State
  const [path, setPath] = useState(window.location.pathname);
  const [prodId, setProdId] = useState(null);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Utility Functions
  const checkUserRole = async (uid) => {
    try {
      const rolesRef = collection(db, 'roles');
      const q = query(rolesRef, where('userId', 'array-contains', uid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const roleDoc = querySnapshot.docs[0];
        const roleData = roleDoc.data();
        return roleData.name || 'staff';
      }
      return 'staff';
    } catch (error) {
      console.error('Error checking user role:', error.message);
      return 'staff';
    }
  };

  // Authentication and Navigation Effect
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
        setProdId(params.get('id'));
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

  // Navigation Handler
  const navigate = (newPath, id = null) => {
    let url = newPath;
    if (newPath === '/production' && id !== null) {
      url = `${newPath}?id=${id}`;
    }
    window.history.pushState({}, '', url);
    setPath(newPath);
    setProdId(id);
  };

  // Signout Handler
  const handleSignout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Signout error:', error.message);
    }
  };

  // Render Loading State
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 text-white">
        <p className="text-blue-400">Loading...</p>
      </div>
    );
  }

  // Redirect Unauthenticated Users
  if (!user && path !== '/') {
    return <SignIn onSignIn={() => navigate('/dashboard')} />;
  }

  // Redirect Authenticated Users from Root
  if (user && path === '/') {
    return (
      <Dashboard
        onNavigate={navigate}
        user={user}
        userRole={userRole}
        onSignout={handleSignout}
      />
    );
  }

  // Render Page
  const renderPage = () => {
    if (!user) {
      return <SignIn onSignIn={() => navigate('/dashboard')} />;
    }

    switch (path) {
      case '/dashboard':
        return (
          <Dashboard
            onNavigate={navigate}
            user={user}
            userRole={userRole}
            onSignout={handleSignout}
          />
        );
      case '/new_plan':
        return <NewPlan onNavigate={navigate} user={user} userRole={userRole} />;
      case '/production':
        return (
          <Production
            onNavigate={navigate}
            user={user}
            userRole={userRole}
            productionId={prodId}
          />
        );
      default:
        return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 p-4 text-white">
            <p className="text-red-500">Error: Page not found!</p>
            <button
              onClick={() => navigate('/')}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
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
