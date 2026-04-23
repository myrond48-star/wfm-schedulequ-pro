import React, { useEffect, useState } from 'react';
import { callSupabaseAPI } from '../lib/supabase';
import { useAppStore } from '../lib/store';

interface UsersDBProps {
  search: string;
}

export const UsersDB: React.FC<UsersDBProps> = ({ search }) => {
  const { settings } = useAppStore();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState<{ isNew: boolean, user: any } | null>(null);
  const [form, setForm] = useState({
    nik: '', nama: '', username: '', password: '', role: 'Agent', channel: 'Call', status: 'NEW', religion: '', gender: ''
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await callSupabaseAPI('wfm_agents', 'GET', undefined, '?select=*');
      if (res) {
        setUsers(res);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const openModal = (isNew: boolean, user: any = null) => {
    if (isNew) {
      setForm({ nik: '', nama: '', username: '', password: '', role: 'Agent', channel: settings.channels[0] || 'Call', status: 'NEW', religion: '', gender: '' });
    } else {
      setForm({ ...user });
    }
    setModal({ isNew, user });
  };

  const saveUser = async () => {
    if (!form.nik || !form.nama || !form.username) return alert("NIK, Name, and Username are required!");
    
    try {
      if (modal?.isNew) {
        await callSupabaseAPI('wfm_agents', 'POST', form);
      } else {
        await callSupabaseAPI('wfm_agents', 'PATCH', form, `?nik=eq.${form.nik}`);
      }
      
      // Notify
      window.dispatchEvent(new CustomEvent('wfm-notify', {
        detail: {
          title: modal?.isNew ? 'User Added' : 'User Updated',
          message: `${form.nama} (${form.nik}) details updated.`,
          type: 'success'
        }
      }));

      alert(`User ${form.nama} successfully ${modal?.isNew ? 'added' : 'updated'}!`);
      setModal(null);
      fetchUsers();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  const deleteUser = async (nik: string, nama: string) => {
    if (!confirm(`⚠️ STRICT WARNING ⚠️\n\nAre you sure you want to permanently delete agent ${nama} (${nik})?`)) return;
    try {
      await callSupabaseAPI('wfm_agents', 'DELETE', undefined, `?nik=eq.${nik}`);
      
      // Notify
      window.dispatchEvent(new CustomEvent('wfm-notify', {
        detail: {
          title: 'User Deleted',
          message: `Agent ${nama} was permanently removed.`,
          type: 'warning'
        }
      }));

      alert(`User with NIK ${nik} successfully deleted permanently from the system!`);
      fetchUsers();
    } catch (err: any) {
      alert("Error: " + err.message);
    }
  };

  return (
    <div className="h-full flex flex-col p-4 sm:p-6 bg-slate-50 relative">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
        <h2 className="m-0 text-slate-800 font-extrabold text-2xl">👥 Users Database</h2>
        <button className="px-4 py-2 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-colors w-full sm:w-auto" onClick={() => openModal(true)}>
          + Add New User
        </button>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 scrollbar-thin">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-500 font-bold">Loading users...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-100 sticky top-0 z-10">
                <tr>
                  <th className="p-3.5 text-[11px] font-bold text-slate-500 text-center border-b border-slate-200">NIK</th>
                  <th className="p-3.5 text-[11px] font-bold text-slate-500 text-center border-b border-slate-200">NAME</th>
                  <th className="p-3.5 text-[11px] font-bold text-slate-500 text-center border-b border-slate-200">GENDER</th>
                  <th className="p-3.5 text-[11px] font-bold text-slate-500 text-center border-b border-slate-200">RELIGION</th>
                  <th className="p-3.5 text-[11px] font-bold text-slate-500 text-center border-b border-slate-200">USERNAME</th>
                  <th className="p-3.5 text-[11px] font-bold text-slate-500 text-center border-b border-slate-200">ROLE</th>
                  <th className="p-3.5 text-[11px] font-bold text-slate-500 text-center border-b border-slate-200">CHANNEL</th>
                  <th className="p-3.5 text-[11px] font-bold text-slate-500 text-center border-b border-slate-200">STATUS</th>
                  <th className="p-3.5 text-[11px] font-bold text-slate-500 text-center border-b border-slate-200">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {users
                  .filter(u => !search || 
                    u.nama?.toLowerCase().includes(search.toLowerCase()) || 
                    u.nik?.toLowerCase().includes(search.toLowerCase()) ||
                    u.username?.toLowerCase().includes(search.toLowerCase())
                  )
                  .map((u) => (
                  <tr key={u.nik} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-xs font-bold text-slate-800 text-center">{u.nik}</td>
                    <td className="p-3 text-[13px] font-semibold text-slate-700 text-center">{u.nama}</td>
                    <td className="p-3 text-[11px] text-slate-500 text-center">{u.gender || '-'}</td>
                    <td className="p-3 text-[11px] text-slate-500 text-center">{u.religion || '-'}</td>
                    <td className="p-3 text-xs text-slate-600 font-medium text-center">{u.username}</td>
                    <td className="p-3 text-center">
                      <span className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md font-bold text-[11px]">{u.role}</span>
                    </td>
                    <td className="p-3 text-xs text-slate-600 font-semibold text-center">{u.channel}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-1 rounded-md font-bold text-[11px] ${
                        u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-600' : 
                        u.status === 'NEW' ? 'bg-blue-100 text-blue-600' : 
                        'bg-red-100 text-red-600'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <button className="px-2.5 py-1.5 border border-slate-300 text-sky-600 rounded-lg text-xs font-bold mr-1 hover:bg-sky-50" onClick={() => openModal(false, u)}>✏️ Edit</button>
                      <button className="px-2.5 py-1.5 border border-red-200 text-red-500 rounded-lg text-xs font-bold hover:bg-red-50" onClick={() => deleteUser(u.nik, u.nama)}>🗑️ Del</button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 font-bold">No users found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* User Modal */}
      {modal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-[20000]">
          <div className="bg-white p-6 rounded-2xl w-full max-w-[500px] shadow-2xl overflow-y-auto max-h-[90vh]">
            <h3 className="mt-0 text-slate-800 font-bold mb-4">{modal.isNew ? 'Add New User' : 'Edit User'}</h3>
            
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">NIK:</label>
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" placeholder="e.g.: 2024091304" value={form.nik} onChange={e => setForm({...form, nik: e.target.value})} disabled={!modal.isNew} />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Status:</label>
                <select className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 bg-slate-50" value={form.status} onChange={e => setForm({...form, status: e.target.value})} disabled={modal.isNew}>
                  <option value="NEW">NEW</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="RESIGN">RESIGN</option>
                </select>
              </div>
            </div>

            <label className="text-[11px] font-bold text-slate-700 block mb-1">Full Name:</label>
            <input type="text" className="w-full p-2.5 border border-slate-300 rounded-xl mb-3 outline-none focus:border-indigo-500" placeholder="Name as per ID" value={form.nama} onChange={e => setForm({...form, nama: e.target.value})} />

            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Username (Login):</label>
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" placeholder="Username" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Password (Login):</label>
                <input type="text" className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" placeholder="Password default" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Role:</label>
                <select className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  <option value="Agent">Agent</option>
                  <option value="Leader">Leader</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Channel:</label>
                <select className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={form.channel} onChange={e => setForm({...form, channel: e.target.value})}>
                  {settings.channels.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Religion:</label>
                <select className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={form.religion} onChange={e => setForm({...form, religion: e.target.value})}>
                  <option value="">-- Select Religion --</option>
                  <option value="ISLAM">ISLAM</option>
                  <option value="PROTESTANT">PROTESTANT</option>
                  <option value="CATHOLIC">CATHOLIC</option>
                  <option value="HINDU">HINDU</option>
                  <option value="BUDDHA">BUDDHA</option>
                  <option value="CONFUCIANISM">CONFUCIANISM</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Gender:</label>
                <select className="w-full p-2.5 border border-slate-300 rounded-xl outline-none focus:border-indigo-500" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                  <option value="">-- Select Gender --</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-end gap-2.5">
              <button className="px-5 py-2.5 bg-slate-100 text-slate-600 border-none font-bold rounded-xl hover:bg-slate-200 transition-colors w-full sm:w-auto" onClick={() => setModal(null)}>Cancel</button>
              <button className="px-5 py-2.5 bg-indigo-600 text-white border-none font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 w-full sm:w-auto" onClick={saveUser}>💾 Save User</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
