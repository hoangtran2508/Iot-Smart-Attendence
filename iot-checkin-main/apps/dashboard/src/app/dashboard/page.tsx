"use client";

import { useAuth } from '../../context/AuthContext';
import { Activity, Clock, ShieldCheck, LogIn } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '../../lib/api';

export default function DashboardOverview() {
  const { user } = useAuth();
  const [joinCode, setJoinCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  if (!user) return null;

  const handleJoinLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    
    setIsJoining(true);
    setJoinMessage(null);
    try {
      await api.post('/locations/join', { code: joinCode.trim() });
      setJoinMessage({ type: 'success', text: 'Successfully joined location!' });
      setJoinCode('');
    } catch (error: any) {
      setJoinMessage({ 
        type: 'error', 
        text: error.response?.data?.message || 'Invalid join code or error joining.' 
      });
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Welcome back, {user.name || user.email}!
        </h1>
        <p className="text-zinc-400">
          Here's what's happening with your IoT check-ins today.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-blue-500/10 p-4 rounded-full">
            <Clock className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-zinc-100">Recent Activity</h3>
            <p className="text-sm text-zinc-400">View your latest check-ins</p>
          </div>
          <Link href="/dashboard/checkins" className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm font-medium transition-colors">
            View Check-ins
          </Link>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-emerald-500/10 p-4 rounded-full">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-zinc-100">Manage Access</h3>
            <p className="text-sm text-zinc-400">Control who can access locations</p>
          </div>
          <Link href="/dashboard/locations" className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm font-medium transition-colors">
            Manage Locations
          </Link>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-amber-500/10 p-4 rounded-full">
            <LogIn className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-zinc-100">Join a Location</h3>
            <p className="text-sm text-zinc-400">Enter a code to join</p>
          </div>
          <form onSubmit={handleJoinLocation} className="w-full mt-4 flex flex-col gap-2">
            <input 
              type="text" 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. A4X9T2"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-center font-mono text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            />
            <button 
              type="submit"
              disabled={isJoining || !joinCode}
              className="w-full px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isJoining ? 'Joining...' : 'Join Location'}
            </button>
            {joinMessage && (
              <p className={`text-xs mt-1 ${joinMessage.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
                {joinMessage.text}
              </p>
            )}
          </form>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-purple-500/10 p-4 rounded-full">
            <Activity className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-zinc-100">System Status</h3>
            <p className="text-sm text-zinc-400">All systems operational</p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            Online
          </div>
        </div>
      </div>
    </div>
  );
}
