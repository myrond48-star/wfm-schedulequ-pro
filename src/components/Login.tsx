import React, { useState } from 'react';
import { Logo } from './Logo';
import { useAppStore } from '../lib/store';
import { callSupabaseAPI } from '../lib/supabase';

export const Login: React.FC = () => {
  const { login } = useAppStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Fill in all fields!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Check Supabase
      const data = await callSupabaseAPI('wfm_agents', 'GET', undefined, `?username=eq.${username}&password=eq.${password}&select=*`);
      
      if (data && data.length > 0) {
        const user = data[0];
        
        if (user.status === 'INACTIVE' || user.status === 'RESIGN') {
          setError('User inactive');
          setLoading(false);
          return;
        }

        if (user.status === 'NEW') {
          setIsFirstLogin(true);
          setLoading(false);
          return;
        }

        login({
          nik: user.nik,
          nama: user.nama,
          username: user.username,
          role: user.role,
          channel: user.channel,
          status: user.status,
        });
      } else {
        setError('Invalid Username or Password');
      }
    } catch (err: any) {
      // Fallback for demo if DB is not set up
      if (err.message.includes('Database API not configured')) {
        if (username === 'admin' && password === 'admin') {
          login({
            nik: '000',
            nama: 'Admin Demo',
            username: 'admin',
            role: 'Admin',
            channel: 'Call',
            status: 'ACTIVE',
          });
        } else {
          setError('Database not configured. Use admin/admin to login as demo.');
        }
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFirstLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 5) {
      setError('Minimum 5 characters!');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await callSupabaseAPI('wfm_agents', 'GET', undefined, `?username=eq.${username}&select=nik`);
      if (data && data.length > 0) {
        const nik = data[0].nik;
        await callSupabaseAPI('wfm_agents', 'PATCH', { password: newPassword, status: 'ACTIVE' }, `?nik=eq.${nik}`);
        alert('Password updated successfully! Please login again.');
        setIsFirstLogin(false);
        setPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (isFirstLogin) {
    return (
      <div className="fixed inset-0 bg-[#6755f2] flex items-center justify-center z-[10000]">
        <div className="bg-white p-8 rounded-3xl w-[340px] shadow-2xl text-center">
          <h3 className="mt-0 text-slate-800 font-extrabold text-xl">Change Password</h3>
          <p className="text-xs text-slate-500 mb-5">This is your first login. Please set a new password to continue.</p>
          <form onSubmit={handleFirstLogin}>
            <input
              type="password"
              className="w-full p-3 mb-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-600"
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              className="w-full p-3 mb-3 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-600"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-5 p-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Password'}
            </button>
            {error && <p className="text-[11px] mt-4 font-semibold text-red-500">{error}</p>}
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#6755f2] flex items-center justify-center z-[10000]">
      <div className="bg-white p-10 rounded-3xl w-[340px] shadow-2xl text-center">
        <div className="flex justify-center mb-8">
          <Logo centered />
        </div>
        <form onSubmit={handleLogin}>
          <input
            type="text"
            className="w-full p-3.5 my-2 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-600 transition-colors"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="password"
            className="w-full p-3.5 my-2 border-2 border-slate-100 rounded-xl outline-none focus:border-indigo-600 transition-colors"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 p-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Verifying...' : 'Sign In'}
          </button>
          {error && <p className="text-[11px] mt-4 font-semibold text-red-500">{error}</p>}
        </form>
      </div>
    </div>
  );
};
