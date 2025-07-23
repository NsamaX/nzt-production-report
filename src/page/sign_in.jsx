import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

// Utility Functions
const getAuthErrorMsg = (code) => {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':    return 'Incorrect username or password.';
    case 'auth/invalid-email':     return 'Invalid username format.';
    case 'auth/too-many-requests': return 'Too many login attempts. Please try again later.';
    default:                       return 'An error occurred during login.';
  }
};

// SignIn Component
function SignIn({ onSignIn }) {
  // State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  // Handlers
  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(null);

    const email = `${username}@gmail.com`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSignIn();
    } catch (error) {
      setError(getAuthErrorMsg(error.code));
    }
  };

  // Styles
  const inputStyle = `
    w-full rounded-lg border border-emerald-700 bg-gray-700 p-4 text-white
    placeholder-gray-400 font-inter focus:outline-none focus:ring-2 
    focus:ring-blue-500
  `;

  const buttonStyle = `
    w-full rounded-lg bg-blue-600 px-6 py-4 font-bold text-white
    transition duration-300 ease-in-out transform hover:scale-105 
    hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 
    focus:ring-offset-2 focus:ring-offset-gray-800
  `;

  // Render
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 p-4 text-white">
      <form
        onSubmit={handleSignIn}
        className="w-full max-w-sm space-y-6 rounded-xl bg-gray-800 p-8 shadow-lg"
      >
        <label className="mb-4 block text-center text-3xl font-extrabold text-emerald-300">
          NZT Production
        </label>
        <input
          type="text"
          placeholder="Enter username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={inputStyle}
          aria-label="Username"
          required
        />
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputStyle}
          aria-label="Password"
          required
        />
        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}
        <button type="submit" className={buttonStyle}>
          Sign In
        </button>
      </form>
    </div>
  );
}

export default SignIn;
