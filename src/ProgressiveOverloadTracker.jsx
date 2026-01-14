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

export default function ProgressiveOverloadTracker() {
  const [entries, setEntries] = useState([]);
  const [flashingEntryId, setFlashingEntryId] = useState(null);
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

  // Calculate PRs per exercise
  const personalRecords = useMemo(() => {
    const prs = {};
    entries.forEach((entry) => {
      const oneRM = calculate1RM(entry.weight, entry.reps);
      if (!prs[entry.name] || oneRM > prs[entry.name].oneRM) {
        prs[entry.name] = { oneRM, entryId: entry.id };
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
    // Sort each group by date (most recent first)
    Object.keys(groups).forEach((name) => {
      groups[name].sort((a, b) => new Date(b.date) - new Date(a.date));
    });
    return groups;
  }, [entries]);

  // Prepare chart data
  const chartData = useMemo(() => {
    const exerciseNames = [...new Set(entries.map((e) => e.name))];
    const dateMap = {};

    entries.forEach((entry) => {
      const dateKey = entry.date;
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = { date: dateKey };
      }
      const oneRM = calculate1RM(entry.weight, entry.reps);
      // If multiple entries for same exercise on same day, take the highest 1RM
      if (!dateMap[dateKey][entry.name] || oneRM > dateMap[dateKey][entry.name]) {
        dateMap[dateKey][entry.name] = Math.round(oneRM * 10) / 10;
      }
    });

    return Object.values(dateMap).sort(
      (a, b) => new Date(a.date) - new Date(b.date)
    );
  }, [entries]);

  const exerciseNames = useMemo(
    () => [...new Set(entries.map((e) => e.name))],
    [entries]
  );

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

    // Check if this will be a new PR
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

    // Flash the entry if it's a new PR
    if (isNewPR) {
      setFlashingEntryId(newEntry.id);
      setTimeout(() => setFlashingEntryId(null), 2000);
    }

    // Reset form (keep date and exercise name for convenience)
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

  return (
    <div className="min-h-screen bg-[#1a1a2e] text-gray-100 py-8 px-4">
      <div className="max-w-[600px] mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Progressive Overload Tracker
          </h1>
          <p className="text-gray-400">Track your strength gains over time</p>
        </header>

        {/* Add Exercise Form */}
        <section className="bg-[#16213e] rounded-lg p-6 mb-6 border border-[#0f3460]">
          <h2 className="text-xl font-semibold mb-4 text-white">Add Exercise</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Exercise Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Exercise
              </label>
              {!useCustomName ? (
                <select
                  value={formData.name}
                  onChange={(e) => handleExerciseSelect(e.target.value)}
                  className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                >
                  <option value="">Select an exercise...</option>
                  {COMMON_EXERCISES.map((exercise) => (
                    <option key={exercise} value={exercise}>
                      {exercise}
                    </option>
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
                    className="flex-1 bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomName(false);
                      setFormData((prev) => ({ ...prev, customName: '' }));
                    }}
                    className="px-3 py-2 bg-[#0f3460] rounded-md text-gray-300 hover:bg-[#1a1a2e]"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {errors.name && (
                <p className="text-red-400 text-sm mt-1">{errors.name}</p>
              )}
            </div>

            {/* Weight, Reps, Sets - Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
                {errors.weight && (
                  <p className="text-red-400 text-xs mt-1">{errors.weight}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Reps
                </label>
                <input
                  type="number"
                  value={formData.reps}
                  onChange={(e) => handleInputChange('reps', e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
                {errors.reps && (
                  <p className="text-red-400 text-xs mt-1">{errors.reps}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Sets
                </label>
                <input
                  type="number"
                  value={formData.sets}
                  onChange={(e) => handleInputChange('sets', e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                />
                {errors.sets && (
                  <p className="text-red-400 text-xs mt-1">{errors.sets}</p>
                )}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Date
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                className="w-full bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
              />
              {errors.date && (
                <p className="text-red-400 text-sm mt-1">{errors.date}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-[#FFD700] text-[#1a1a2e] font-semibold py-3 rounded-md hover:bg-[#e6c200] transition-colors"
            >
              Add Entry
            </button>
          </form>
        </section>

        {/* Empty State */}
        {entries.length === 0 && (
          <section className="bg-[#16213e] rounded-lg p-8 mb-6 border border-[#0f3460] text-center">
            <div className="text-5xl mb-4">💪</div>
            <h3 className="text-xl font-semibold text-white mb-2">
              Start Your Journey
            </h3>
            <p className="text-gray-400">
              Add your first exercise to begin tracking your progressive overload.
              <br />
              Every rep counts towards your goals!
            </p>
          </section>
        )}

        {/* 1RM Progression Chart */}
        {entries.length > 0 && (
          <section className="bg-[#16213e] rounded-lg p-6 mb-6 border border-[#0f3460]">
            <h2 className="text-xl font-semibold mb-4 text-white">
              1RM Progression
            </h2>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#0f3460" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="#9ca3af"
                    fontSize={12}
                  />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={12}
                    tickFormatter={(value) => `${value}kg`}
                  />
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
          </section>
        )}

        {/* Personal Records Summary */}
        {Object.keys(personalRecords).length > 0 && (
          <section className="bg-[#16213e] rounded-lg p-6 mb-6 border border-[#0f3460]">
            <h2 className="text-xl font-semibold mb-4 text-white flex items-center gap-2">
              <span>🏆</span> Personal Records
            </h2>
            <div className="grid gap-3">
              {Object.entries(personalRecords).map(([exercise, data]) => (
                <div
                  key={exercise}
                  className="flex justify-between items-center bg-[#1a1a2e] rounded-md px-4 py-3 border border-[#0f3460]"
                >
                  <span className="font-medium text-white">{exercise}</span>
                  <span className="text-[#FFD700] font-bold text-lg">
                    {Math.round(data.oneRM * 10) / 10} kg
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Exercise History */}
        {Object.keys(groupedEntries).length > 0 && (
          <section className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <h2 className="text-xl font-semibold mb-4 text-white">
              Exercise History
            </h2>
            <div className="space-y-6">
              {Object.entries(groupedEntries).map(([exerciseName, exerciseEntries]) => (
                <div key={exerciseName}>
                  <h3 className="font-bold text-white text-lg mb-3 border-b border-[#0f3460] pb-2">
                    {exerciseName}
                  </h3>
                  <div className="space-y-2">
                    {exerciseEntries.map((entry) => {
                      const oneRM = calculate1RM(entry.weight, entry.reps);
                      const isPR = personalRecords[entry.name]?.entryId === entry.id;
                      const isFlashing = flashingEntryId === entry.id;

                      return (
                        <div
                          key={entry.id}
                          className={`
                            flex items-center justify-between rounded-md px-4 py-3
                            transition-all duration-300
                            ${isFlashing
                              ? 'bg-[#FFD700] text-[#1a1a2e]'
                              : isPR
                                ? 'bg-[#1a1a2e] border-2 border-[#FFD700]'
                                : 'bg-[#1a1a2e] border border-[#0f3460]'
                            }
                          `}
                        >
                          <div className="flex-1">
                            <div className={`text-sm ${isFlashing ? 'text-[#1a1a2e]' : 'text-gray-400'}`}>
                              {formatDate(entry.date)}
                            </div>
                            <div className={`font-medium ${isFlashing ? 'text-[#1a1a2e]' : 'text-white'}`}>
                              {entry.weight}kg × {entry.reps} reps × {entry.sets} sets
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className={`text-xs ${isFlashing ? 'text-[#1a1a2e]' : 'text-gray-400'}`}>
                                Est. 1RM
                              </div>
                              <div className={`font-bold text-lg ${
                                isFlashing
                                  ? 'text-[#1a1a2e]'
                                  : isPR
                                    ? 'text-[#FFD700]'
                                    : 'text-white'
                              }`}>
                                {Math.round(oneRM * 10) / 10}kg
                              </div>
                            </div>
                            {isPR && (
                              <div className={`
                                px-2 py-1 rounded text-xs font-bold
                                ${isFlashing
                                  ? 'bg-[#1a1a2e] text-[#FFD700]'
                                  : 'bg-[#FFD700] text-[#1a1a2e]'
                                }
                              `}>
                                {isFlashing ? '🏆 NEW PR!' : 'PR'}
                              </div>
                            )}
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className={`
                                p-1 rounded hover:bg-red-500/20 transition-colors
                                ${isFlashing ? 'text-[#1a1a2e]' : 'text-gray-500 hover:text-red-400'}
                              `}
                              title="Delete entry"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-5 w-5"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                                  clipRule="evenodd"
                                />
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
          </section>
        )}

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm mt-8 pb-4">
          Progressive Overload Tracker • Track your gains
        </footer>
      </div>
    </div>
  );
}
