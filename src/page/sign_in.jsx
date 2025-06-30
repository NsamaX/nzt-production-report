import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';

function SignIn({ onSignIn }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log("User logged in successfully!");
      onSignIn();
    } catch (err) {
      console.error("Error signing in:", err.message);
      let errorMessage = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';

      switch (err.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          errorMessage = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
          break;
        case 'auth/invalid-email':
          errorMessage = 'รูปแบบอีเมลไม่ถูกต้อง';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'คุณพยายามล็อกอินหลายครั้งเกินไป โปรดลองใหม่อีกครั้งในภายหลัง';
          break;
        default:
          break;
      }
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <form
        onSubmit={handleLogin}
        className="flex flex-col space-y-6 bg-gray-800 p-8 rounded-xl shadow-lg w-full max-w-sm"
      >
        <label htmlFor="email" className="text-3xl font-extrabold text-center text-emerald-300 mb-4">
          NZT Production
        </label>
        <input
          id="email"
          type="email"
          placeholder="ป้อนอีเมลผู้ใช้ของคุณ"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="p-4 rounded-lg border border-emerald-700 bg-gray-700 text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    placeholder-gray-400 font-inter"
          aria-label="Email"
          required
        />
        <input
          id="password"
          type="password"
          placeholder="ป้อนรหัสผ่านของคุณ"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="p-4 rounded-lg border border-emerald-700 bg-gray-700 text-white
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    placeholder-gray-400 font-inter"
          aria-label="Password"
          required
        />

        {error && <p className="text-red-400 text-sm text-center">{error}</p>}

        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6
                    rounded-lg transition duration-300 ease-in-out transform
                    hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800"
        >
          เข้าสู่ระบบ
        </button>
      </form>
    </div>
  );
}

export default SignIn;
