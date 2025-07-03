import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const getErrorMessage = (code) => {
  switch (code) {
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/invalid-email':
      return 'Invalid email format.';
    case 'auth/too-many-requests':
      return 'Too many login attempts. Please try again later.';
    default:
      return 'An error occurred during login.';
  }
};

const SignIn = ({ onSigin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const signin = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onSigin();
    } catch (e) {
      setError(getErrorMessage(e.code));
    }
  };

  const inputClass = `
    p-4 rounded-lg border border-emerald-700 bg-gray-700 text-white
    focus:outline-none focus:ring-2 focus:ring-blue-500
    placeholder-gray-400 font-inter
  `;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form onSubmit={signin} className="flex flex-col space-y-6 bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-sm">
        <label className="text-3xl font-extrabold text-center text-emerald-300 mb-4">
          NZT Production
        </label>
        <input
          type="email"
          placeholder="Enter email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          aria-label="Email"
          required
        />
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
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
