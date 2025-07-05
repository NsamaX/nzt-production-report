import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const getAuthErrorMsg = (code) => {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':    return 'Incorrect username or password.';
    case 'auth/invalid-email':     return 'Invalid username format.';
    case 'auth/too-many-requests': return 'Too many login attempts. Please try again later.';
    default:                       return 'An error occurred during login.';
  }
};

const SignIn = ({ onSignIn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError(null);

    const email = `${username}@gmail.com`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSignIn();
    } catch (e) {
      setError(getAuthErrorMsg(e.code));
    }
  };

  const inputStyle = `
    p-4 rounded-lg border border-emerald-700 bg-gray-700 text-white
    focus:outline-none focus:ring-2 focus:ring-blue-500
    placeholder-gray-400 font-inter
  `;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form onSubmit={handleSignIn} className="flex flex-col space-y-6 bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-sm">
        <label className="text-3xl font-extrabold text-center text-emerald-300 mb-4">
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
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <button
          type="submit"
          className="
            bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6
            rounded-lg transition duration-300 ease-in-out transform hover:scale-105
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800
          "
        >
          Sign In
        </button>
      </form>
    </div>
  );
};

export default SignIn;
