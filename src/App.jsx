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
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [productionIdFromUrl, setProductionIdFromUrl] = useState(null);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
          const userRoleRef = doc(db, 'userRoles', currentUser.uid);
          const userRoleSnap = await getDoc(userRoleRef);

          if (userRoleSnap.exists()) {
            setUserRole(userRoleSnap.data().role);
          } else {
            console.warn("No custom role defined for this user. Defaulting to 'staff'.");
            setUserRole('staff');
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
          setUserRole('staff');
        }
      } else {
        setUserRole(null);
      }
      setLoadingAuth(false);

      if (!currentUser && window.location.pathname !== '/') {
        window.history.replaceState({}, '', '/');
        setCurrentPath('/');
      }
    });

    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
      if (window.location.pathname === '/production') {
        const params = new URLSearchParams(window.location.search);
        setProductionIdFromUrl(parseInt(params.get('id')));
      } else {
        setProductionIdFromUrl(null);
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      unsubscribeAuth();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleNavigate = (path, id = null) => {
    let url = path;
    if (path === '/production' && id !== null) {
      url = `${path}?id=${id}`;
    }
    window.history.pushState({}, '', url);
    setCurrentPath(path);
    setProductionIdFromUrl(id);
  };

  const handleSignInSuccess = () => {
    handleNavigate('/dashboard');
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      console.log("User logged out!");
      handleNavigate('/');
    } catch (error) {
      console.error("Error logging out:", error.message);
    }
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
        <p className="text-blue-400">กำลังตรวจสอบสถานะผู้ใช้งาน...</p>
      </div>
    );
  }

  if (!user && currentPath !== '/') {
    return <SignIn onSignIn={handleSignInSuccess} />;
  }

  if (user && currentPath === '/') {
    return <Dashboard onNavigate={handleNavigate} onLogout={handleLogout} user={user} userRole={userRole} />;
  }

  switch (currentPath) {
    case '/':
      return <SignIn onSignIn={handleSignInSuccess} />;
    case '/dashboard':
      return user ? <Dashboard onNavigate={handleNavigate} onLogout={handleLogout} user={user} userRole={userRole} /> : <SignIn onSignIn={handleSignInSuccess} />;
    case '/new_plan':
      return user ? <NewPlan onNavigate={handleNavigate} onLogout={handleLogout} user={user} userRole={userRole} /> : <SignIn onSignIn={handleSignInSuccess} />;
    case '/production':
      return user ? <Production productionId={productionIdFromUrl} onNavigate={handleNavigate} onLogout={handleLogout} user={user} userRole={userRole} /> : <SignIn onSignIn={handleSignInSuccess} />;
    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
          <p className="text-red-500">เกิดข้อผิดพลาด: ไม่พบหน้า!</p>
          <button
            onClick={() => handleNavigate('/')}
            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg"
          >
            กลับหน้าหลัก
          </button>
        </div>
      );
  }
}

export default App;
