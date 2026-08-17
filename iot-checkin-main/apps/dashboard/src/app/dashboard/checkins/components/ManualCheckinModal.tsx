import { useState, useEffect } from 'react';
import { api } from '../../../../lib/api';
import { X, CalendarPlus } from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  email: string;
}

interface LocationData {
  id: string;
  name: string;
}

interface ManualCheckinModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export function ManualCheckinModal({ onClose, onSuccess }: ManualCheckinModalProps) {
  const [users, setUsers] = useState<UserData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  
  const [userId, setUserId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [checkedInAt, setCheckedInAt] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFormData();
  }, []);

  const fetchFormData = async () => {
    try {
      const [usersRes, locationsRes] = await Promise.all([
        api.get('/users'),
        api.get('/locations')
      ]);
      setUsers(usersRes.data);
      setLocations(locationsRes.data);
      
      if (usersRes.data.length > 0) setUserId(usersRes.data[0].id);
      if (locationsRes.data.length > 0) setLocationId(locationsRes.data[0].id);

      // Set default time to now
      const now = new Date();
      // format to YYYY-MM-DDTHH:mm
      const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setCheckedInAt(localISO);
      
    } catch (err) {
      console.error('Failed to load form data', err);
      setError('Failed to load users or locations.');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !locationId || !checkedInAt) {
      setError('Please fill all required fields.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Send selected time as ISO UTC string
      const utcDate = new Date(checkedInAt).toISOString();
      
      await api.post('/checkins', {
        userId,
        locationId,
        checkedInAt: utcDate,
        note: note || 'Manual Check-in by Admin',
      });
      
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Manual check-in failed', err);
      setError(err.response?.data?.message || 'Failed to create manual check-in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md overflow-hidden shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CalendarPlus className="w-5 h-5 text-emerald-400" />
              Manual Check-in
            </h2>
            <p className="text-sm text-zinc-400 mt-1">Create a check-in record for an employee.</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        {isLoadingData ? (
          <div className="flex justify-center p-12">
            <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">User *</label>
              <select 
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                required
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Location *</label>
              <select 
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                required
              >
                {locations.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Date & Time *</label>
              <input 
                type="datetime-local"
                value={checkedInAt}
                onChange={(e) => setCheckedInAt(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all [color-scheme:dark]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1.5">Note</label>
              <input 
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Forgot phone, network issue..."
                className="w-full bg-zinc-950 border border-zinc-800 text-white rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-zinc-800 mt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : null}
                Create Check-in
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
