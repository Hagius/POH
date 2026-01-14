import React, { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getUser, getEntries, saveEntries, resetDemo } from './lib/userStore';

const COMMON_EXERCISES = [
  'Squat',
  'Deadlift',
  'Bench Press',
  'Overhead Press',
  'Barbell Row',
];

const COLORS = [
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#a4de6c',
];

// Epley formula: 1RM = weight × (1 + reps/30)
const calculate1RM = (weight, reps) => {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
};

const formatDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const generateId = () => Math.random().toString(36).substring(2, 9);

// Navigation Icons
const ChartIcon = ({ active }) => (
  <svg className={`w-6 h-6 ${active ? 'text-[#FFD700]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const PlusIcon = ({ active }) => (
  <svg className={`w-6 h-6 ${active ? 'text-[#FFD700]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrophyIcon = ({ active }) => (
  <svg className={`w-6 h-6 ${active ? 'text-[#FFD700]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const UserIcon = ({ active }) => (
  <svg className={`w-6 h-6 ${active ? 'text-[#FFD700]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

export default function ProgressiveOverloadTracker() {
  const [entries, setEntries] = useState([]);
  const [activeTab, setActiveTab] = useState('add');
  const [flashingEntryId, setFlashingEntryId] = useState(null);
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    customName: '',
    weight: '',
    reps: '',
    sets: '',
    date: new Date().toISOString().split('T')[0],
  });
  const [errors, setErrors] = useState({});
  const [useCustomName, setUseCustomName] = useState(false);

  // Load user and entries on mount
  useEffect(() => {
    setUser(getUser());
    setEntries(getEntries());
  }, []);

  // Save entries to localStorage when they change
  useEffect(() => {
    if (entries.length > 0) {
      saveEntries(entries);
    }
  }, [entries]);

  // Calculate PRs per exercise
  const personalRecords = useMemo(() => {
    const prs = {};
    entries.forEach((entry) => {
      const oneRM = calculate1RM(entry.weight, entry.reps);
      if (!prs[entry.name] || oneRM > prs[entry.name].oneRM) {
        prs[entry.name] = { oneRM, entryId: entry.id, date: entry.date };
      }
    });
    return prs;
  }, [entries]);

  // Group entries by exercise name
  const groupedEntries = useMemo(() => {
    const groups = {};
    entries.forEach((entry) => {
      if (!groups[entry.name]) {
        groups[entry.name] = [];
      }
      groups[entry.name].push(entry);
    });
    Object.keys(groups).forEach((name) => {
      groups[name].sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    return groups;
  }, [entries]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const dateMap = {};
    entries.forEach((entry) => {
      const dateKey = entry.date;
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { date: dateKey };
      }
      const oneRM = calculate1RM(entry.weight, entry.reps);
      if (!dateMap[dateKey][entry.name] || oneRM > dateMap[dateKey][entry.name]) {
        dateMap[dateKey][entry.name] = Math.round(oneRM * 10) / 10;
      }
    });
    return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [entries]);

  const exerciseNames = useMemo(() => [...new Set(entries.map((e) => e.name))], [entries]);

  const validateForm = () => {
    const newErrors = {};
    const exerciseName = useCustomName ? formData.customName.trim() : formData.name;

    if (!exerciseName) {
      newErrors.name = 'Please select or enter an exercise name';
    }

    const weight = parseFloat(formData.weight);
    if (isNaN(weight) || weight <= 0) {
      newErrors.weight = 'Weight must be greater than 0';
    }

    const reps = parseInt(formData.reps, 10);
    if (isNaN(reps) || reps < 1 || reps > 100) {
      newErrors.reps = 'Reps must be between 1 and 100';
    }

    const sets = parseInt(formData.sets, 10);
    if (isNaN(sets) || sets < 1 || sets > 20) {
      newErrors.sets = 'Sets must be between 1 and 20';
    }

    if (!formData.date) {
      newErrors.date = 'Please select a date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    const exerciseName = useCustomName ? formData.customName.trim() : formData.name;
    const weight = parseFloat(formData.weight);
    const reps = parseInt(formData.reps, 10);
    const newOneRM = calculate1RM(weight, reps);

    const currentPR = personalRecords[exerciseName];
    const isNewPR = !currentPR || newOneRM > currentPR.oneRM;

    const newEntry = {
      id: generateId(),
      name: exerciseName,
      date: formData.date,
      weight,
      reps,
      sets: parseInt(formData.sets, 10),
    };

    setEntries((prev) => [...prev, newEntry]);

    if (isNewPR) {
      setFlashingEntryId(newEntry.id);
      setActiveTab('achievements');
      setTimeout(() => setFlashingEntryId(null), 2000);
    }

    setFormData((prev) => ({
      ...prev,
      weight: '',
      reps: '',
      sets: '',
    }));
    setErrors({});
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const handleExerciseSelect = (value) => {
    if (value === 'custom') {
      setUseCustomName(true);
      setFormData((prev) => ({ ...prev, name: '' }));
    } else {
      setUseCustomName(false);
      setFormData((prev) => ({ ...prev, name: value, customName: '' }));
    }
  };

  const deleteEntry = (id) => {
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  };

  // Progress View
  const ProgressView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Progress</h2>

      {entries.length === 0 ? (
        <div className="bg-[#16213e] rounded-lg p-8 border border-[#0f3460] text-center">
          <div className="text-5xl mb-4">📈</div>
          <h3 className="text-xl font-semibold text-white mb-2">No Data Yet</h3>
          <p className="text-gray-400">
            Add your first workout to see your progress charts.
          </p>
          <button
            onClick={() => setActiveTab('add')}
            className="mt-4 px-6 py-2 bg-[#FFD700] text-[#1a1a2e] font-semibold rounded-md hover:bg-[#e6c200] transition-colors"
          >
            Add Workout
          </button>
        </div>
      ) : (
        <>
          <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <h3 className="text-lg font-semibold mb-4 text-white">1RM Progression</h3>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                  <XAxis dataKey="date" tickFormatter={formatDate} stroke="#9ca3af" fontSize={12} />
                  <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `${value}kg`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#16213e',
                      border: '1px solid #0f3460',
                      borderRadius: '8px',
                      color: '#fff',
                    }}
                    labelFormatter={formatDate}
                    formatter={(value) => [`${value} kg`, '1RM']}
                  />
                  <Legend />
                  {exerciseNames.map((name, index) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={COLORS[index % COLORS.length]}
                      strokeWidth={2}
                      dot={{ fill: COLORS[index % COLORS.length], r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Exercise History */}
          <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <h3 className="text-lg font-semibold mb-4 text-white">Workout History</h3>
            <div className="space-y-6">
              {Object.entries(groupedEntries).map(([exerciseName, exerciseEntries]) => (
                <div key={exerciseName}>
                  <h4 className="font-bold text-white text-md mb-3 border-b border-[#0f3460] pb-2">
                    {exerciseName}
                  </h4>
                  <div className="space-y-2">
                    {exerciseEntries.map((entry) => {
                      const oneRM = calculate1RM(entry.weight, entry.reps);
                      const isPR = personalRecords[entry.name]?.entryId === entry.id;

                      return (
                        <div
                          key={entry.id}
                          className={`flex items-center justify-between rounded-md px-4 py-3 ${
                            isPR ? 'bg-[#1a1a2e] border-2 border-[#FFD700]' : 'bg-[#1a1a2e] border border-[#0f3460]'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="text-sm text-gray-400">{formatDate(entry.date)}</div>
                            <div className="font-medium text-white">
                              {entry.weight}kg × {entry.reps} reps × {entry.sets} sets
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs text-gray-400">Est. 1RM</div>
                              <div className={`font-bold text-lg ${isPR ? 'text-[#FFD700]' : 'text-white'}`}>
                                {Math.round(oneRM * 10) / 10}kg
                              </div>
                            </div>
                            {isPR && (
                              <div className="px-2 py-1 rounded text-xs font-bold bg-[#FFD700] text-[#1a1a2e]">
                                PR
                              </div>
                            )}
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="p-1 rounded hover:bg-red-500/20 transition-colors text-gray-500 hover:text-red-400"
                              title="Delete entry"
                            >
                              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // Add Workout View
  const AddWorkoutView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Add Workout</h2>

      <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Exercise Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Exercise</label>
            {!useCustomName ? (
              <select
                value={formData.name}
                onChange={(e) => handleExerciseSelect(e.target.value)}
                className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              >
                <option value="">Select an exercise...</option>
                {COMMON_EXERCISES.map((exercise) => (
                  <option key={exercise} value={exercise}>{exercise}</option>
                ))}
                <option value="custom">+ Add custom exercise</option>
              </select>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.customName}
                  onChange={(e) => handleInputChange('customName', e.target.value)}
                  placeholder="Enter exercise name"
                  className="flex-1 bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomName(false);
                    setFormData((prev) => ({ ...prev, customName: '' }));
                  }}
                  className="px-4 py-3 bg-[#0f3460] rounded-md text-gray-300 hover:bg-[#1a1a2e]"
                >
                  Cancel
                </button>
              </div>
            )}
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Weight, Reps, Sets */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Weight (kg)</label>
              <input
                type="number"
                step="0.5"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                placeholder="0"
                className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-3 text-white text-center text-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              />
              {errors.weight && <p className="text-red-400 text-xs mt-1">{errors.weight}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Reps</label>
              <input
                type="number"
                value={formData.reps}
                onChange={(e) => handleInputChange('reps', e.target.value)}
                placeholder="0"
                className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-3 text-white text-center text-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              />
              {errors.reps && <p className="text-red-400 text-xs mt-1">{errors.reps}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Sets</label>
              <input
                type="number"
                value={formData.sets}
                onChange={(e) => handleInputChange('sets', e.target.value)}
                placeholder="0"
                className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-3 text-white text-center text-lg focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              />
              {errors.sets && <p className="text-red-400 text-xs mt-1">{errors.sets}</p>}
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => handleInputChange('date', e.target.value)}
              className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
            />
            {errors.date && <p className="text-red-400 text-sm mt-1">{errors.date}</p>}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-[#FFD700] text-[#1a1a2e] font-bold py-4 rounded-md hover:bg-[#e6c200] transition-colors text-lg"
          >
            Add Entry
          </button>
        </form>
      </div>

      {/* Quick Stats */}
      {entries.length > 0 && (
        <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
          <h3 className="text-lg font-semibold mb-3 text-white">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1a1a2e] rounded-md p-4 text-center">
              <div className="text-3xl font-bold text-[#FFD700]">{entries.length}</div>
              <div className="text-sm text-gray-400">Total Workouts</div>
            </div>
            <div className="bg-[#1a1a2e] rounded-md p-4 text-center">
              <div className="text-3xl font-bold text-[#FFD700]">{exerciseNames.length}</div>
              <div className="text-sm text-gray-400">Exercises Tracked</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Achievements View
  const AchievementsView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Achievements</h2>

      {Object.keys(personalRecords).length === 0 ? (
        <div className="bg-[#16213e] rounded-lg p-8 border border-[#0f3460] text-center">
          <div className="text-5xl mb-4">🏆</div>
          <h3 className="text-xl font-semibold text-white mb-2">No PRs Yet</h3>
          <p className="text-gray-400">
            Start logging your workouts to track your personal records!
          </p>
          <button
            onClick={() => setActiveTab('add')}
            className="mt-4 px-6 py-2 bg-[#FFD700] text-[#1a1a2e] font-semibold rounded-md hover:bg-[#e6c200] transition-colors"
          >
            Add Workout
          </button>
        </div>
      ) : (
        <>
          {/* PR Summary */}
          <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
              <span>🏆</span> Personal Records
            </h3>
            <div className="space-y-3">
              {Object.entries(personalRecords).map(([exercise, data]) => {
                const isFlashing = flashingEntryId === data.entryId;
                return (
                  <div
                    key={exercise}
                    className={`rounded-lg p-4 transition-all duration-300 ${
                      isFlashing
                        ? 'bg-[#FFD700] text-[#1a1a2e]'
                        : 'bg-[#1a1a2e] border border-[#0f3460]'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <div className={`font-bold text-lg ${isFlashing ? 'text-[#1a1a2e]' : 'text-white'}`}>
                          {exercise}
                        </div>
                        <div className={`text-sm ${isFlashing ? 'text-[#1a1a2e]/70' : 'text-gray-400'}`}>
                          Set on {formatDate(data.date)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${isFlashing ? 'text-[#1a1a2e]' : 'text-[#FFD700]'}`}>
                          {Math.round(data.oneRM * 10) / 10} kg
                        </div>
                        <div className={`text-xs ${isFlashing ? 'text-[#1a1a2e]/70' : 'text-gray-400'}`}>
                          Estimated 1RM
                        </div>
                      </div>
                    </div>
                    {isFlashing && (
                      <div className="mt-2 text-center font-bold text-[#1a1a2e] animate-pulse">
                        🎉 NEW PR! 🎉
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats Overview */}
          <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <h3 className="text-lg font-semibold mb-4 text-white">Stats Overview</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#1a1a2e] rounded-md p-4 text-center">
                <div className="text-2xl font-bold text-[#FFD700]">
                  {Object.keys(personalRecords).length}
                </div>
                <div className="text-xs text-gray-400">Total PRs</div>
              </div>
              <div className="bg-[#1a1a2e] rounded-md p-4 text-center">
                <div className="text-2xl font-bold text-white">{entries.length}</div>
                <div className="text-xs text-gray-400">Workouts</div>
              </div>
              <div className="bg-[#1a1a2e] rounded-md p-4 text-center">
                <div className="text-2xl font-bold text-white">
                  {Math.round(
                    Math.max(...Object.values(personalRecords).map((pr) => pr.oneRM)) * 10
                  ) / 10}
                </div>
                <div className="text-xs text-gray-400">Best 1RM (kg)</div>
              </div>
            </div>
          </div>

          {/* Motivational Message */}
          <div className="bg-gradient-to-r from-[#16213e] to-[#0f3460] rounded-lg p-6 border border-[#0f3460] text-center">
            <p className="text-lg text-white font-medium">
              "The only bad workout is the one that didn't happen."
            </p>
            <p className="text-sm text-gray-400 mt-2">Keep pushing your limits!</p>
          </div>
        </>
      )}
    </div>
  );

  // Profile View
  const ProfileView = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Profile</h2>

      {user ? (
        <>
          {/* Profile Card */}
          <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <div className="flex items-start gap-5">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-24 h-24 rounded-full border-4 border-[#FFD700] object-cover"
                  data-testid="profile-avatar"
                />
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <h3
                  className="text-xl font-bold text-white truncate"
                  data-testid="profile-name"
                >
                  {user.name}
                </h3>
                <p className="text-[#FFD700] font-medium mt-1" data-testid="profile-job">
                  {user.jobTitle}
                </p>
                <p className="text-gray-400 text-sm mt-1 truncate" data-testid="profile-email">
                  {user.email}
                </p>
              </div>
            </div>

            {/* Bio */}
            <div className="mt-5 pt-5 border-t border-[#0f3460]">
              <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-2">
                About
              </h4>
              <p className="text-gray-300 text-sm leading-relaxed" data-testid="profile-bio">
                {user.bio}
              </p>
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <h3 className="text-lg font-semibold mb-4 text-white">Account Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-[#0f3460]">
                <span className="text-gray-400">User ID</span>
                <span className="text-white font-mono text-sm">{user.id.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[#0f3460]">
                <span className="text-gray-400">Member Since</span>
                <span className="text-white">
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-gray-400">Total Workouts</span>
                <span className="text-[#FFD700] font-bold">{entries.length}</span>
              </div>
            </div>
          </div>

          {/* Reset Demo Button */}
          <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <h3 className="text-lg font-semibold mb-2 text-white">Demo Mode</h3>
            <p className="text-gray-400 text-sm mb-4">
              This is a demo profile generated with fake data. Reset to generate a new identity.
            </p>
            <button
              onClick={resetDemo}
              className="w-full bg-red-600/20 text-red-400 font-semibold py-3 rounded-md hover:bg-red-600/30 transition-colors border border-red-600/30"
              data-testid="reset-demo-button"
            >
              Reset Demo
            </button>
          </div>
        </>
      ) : (
        <div className="bg-[#16213e] rounded-lg p-8 border border-[#0f3460] text-center">
          <div className="animate-pulse">
            <div className="w-24 h-24 bg-[#0f3460] rounded-full mx-auto mb-4" />
            <div className="h-6 bg-[#0f3460] rounded w-48 mx-auto mb-2" />
            <div className="h-4 bg-[#0f3460] rounded w-32 mx-auto" />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-100 pb-20">
      {/* Header */}
      <header className="bg-[#16213e] border-b border-[#0f3460] px-4 py-4 sticky top-0 z-10">
        <div className="max-w-[600px] mx-auto">
          <h1 className="text-xl font-bold text-white text-center">
            Progressive Overload Tracker
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[600px] mx-auto px-4 py-6">
        {activeTab === 'progress' && <ProgressView />}
        {activeTab === 'add' && <AddWorkoutView />}
        {activeTab === 'achievements' && <AchievementsView />}
        {activeTab === 'profile' && <ProfileView />}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-[#16213e] border-t border-[#0f3460]">
        <div className="max-w-[600px] mx-auto flex">
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'progress' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <ChartIcon active={activeTab === 'progress'} />
            <span className="text-xs font-medium">Progress</span>
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'add' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <PlusIcon active={activeTab === 'add'} />
            <span className="text-xs font-medium">Add</span>
          </button>
          <button
            onClick={() => setActiveTab('achievements')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'achievements' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <TrophyIcon active={activeTab === 'achievements'} />
            <span className="text-xs font-medium">Achievements</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${
              activeTab === 'profile' ? 'text-[#FFD700]' : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <UserIcon active={activeTab === 'profile'} />
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
