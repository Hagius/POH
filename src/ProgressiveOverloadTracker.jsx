import React, { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';
import { getUser, getEntries, saveEntries, saveUser, resetDemo } from './lib/userStore';
import {
  getStrengthThresholds,
  getStrengthLevel,
} from './lib/strengthStandards';
import {
  getNextWorkoutRecommendation,
  getExerciseConfig,
} from './lib/progression';

// Design Tokens - Trade Republic Style
const COLORS = {
  bg: '#FFFFFF',
  bgDark: '#000000',
  text: '#000000',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  accent: '#00C805', // Neon Green for progress
  negative: '#FF5200', // Neon Orange for regression
  border: '#E5E7EB',
};

const COMMON_EXERCISES = [
  'Squat',
  'Deadlift',
  'Bench Press',
  'Overhead Press',
  'Barbell Row',
];

// Muscle group icons (thin outline style)
const MUSCLE_ICONS = {
  'Squat': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 4a2 2 0 100-4 2 2 0 000 4zM8 8h8M6 12l2-4h8l2 4M8 12v8l-2 4M16 12v8l2 4M10 12v8M14 12v8" />
    </svg>
  ),
  'Deadlift': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="3" r="2" />
      <path d="M8 7h8M12 7v5M8 12l-4 4v2h4M16 12l4 4v2h-4M12 12v6l-2 4M12 18l2 4" />
    </svg>
  ),
  'Bench Press': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="10" width="20" height="4" rx="1" />
      <circle cx="4" cy="12" r="3" />
      <circle cx="20" cy="12" r="3" />
      <path d="M12 6v4M10 6h4" />
    </svg>
  ),
  'Overhead Press': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v4M8 10h8M4 6h4l2 4M16 10l2-4h4M12 14v6M10 20h4" />
    </svg>
  ),
  'Barbell Row': (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="4" r="2" />
      <path d="M12 6v2M8 8l-4 8M16 8l4 8M4 16h4M16 16h4M12 8v8M10 16h4" />
    </svg>
  ),
};

// Epley formula: 1RM = weight × (1 + reps/30)
const calculate1RM = (weight, reps) => {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
};

// Reverse Epley formulas
const calculateRepsFor1RM = (targetWeight, target1RM) => {
  if (targetWeight <= 0 || target1RM <= 0) return null;
  if (targetWeight >= target1RM) return 1;
  const reps = 30 * (target1RM / targetWeight - 1);
  return Math.max(1, Math.min(30, Math.round(reps)));
};

const calculateWeightFor1RM = (targetReps, target1RM) => {
  if (targetReps <= 0 || target1RM <= 0) return null;
  const weight = target1RM / (1 + targetReps / 30);
  return Math.round(weight * 2) / 2;
};

const formatDate = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDateShort = (isoString) => {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
};

const generateId = () => Math.random().toString(36).substring(2, 9);

// Sparkline Component - Minimal line chart
const Sparkline = ({ data, color = COLORS.text, height = 40 }) => {
  if (!data || data.length < 2) return null;

  return (
    <div style={{ width: '80px', height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Custom Numpad Component
const Numpad = ({ value, onChange, onSubmit, label, suffix = 'kg' }) => {
  const handleKey = (key) => {
    if (key === 'backspace') {
      onChange(value.slice(0, -1));
    } else if (key === '.') {
      if (!value.includes('.')) {
        onChange(value + '.');
      }
    } else {
      onChange(value + key);
    }
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'backspace'];

  return (
    <div className="flex flex-col h-full">
      {/* Display Area - Fixed height */}
      <div className="h-32 flex flex-col items-center justify-center px-8">
        <span className="text-xs uppercase tracking-[0.2em] text-gray-400 mb-2">{label}</span>
        <div className="flex items-baseline">
          <span className="text-6xl font-extrabold tracking-tight text-black">
            {value || '0'}
          </span>
          <span className="text-xl font-medium text-gray-400 ml-2">{suffix}</span>
        </div>
      </div>

      {/* Numpad Grid */}
      <div className="grid grid-cols-3 gap-1 p-3 bg-gray-50 flex-1">
        {keys.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleKey(key)}
            className="h-14 rounded-2xl bg-white text-2xl font-semibold text-black active:bg-gray-100 transition-colors flex items-center justify-center select-none"
          >
            {key === 'backspace' ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414-6.414a2 2 0 011.414-.586H19a2 2 0 012 2v10a2 2 0 01-2 2h-8.172a2 2 0 01-1.414-.586L3 12z" />
              </svg>
            ) : key}
          </button>
        ))}
      </div>

      {/* Submit Button - Always visible */}
      <div className="p-4 pb-6 bg-white">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value || parseFloat(value) <= 0}
          className="w-full h-14 bg-black text-white text-lg font-semibold rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
        >
          {suffix === 'kg' ? 'NEXT' : 'LOG SET'}
        </button>
      </div>
    </div>
  );
};

// Sheet Modal Component
const Sheet = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />
      {/* Sheet */}
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden animate-slide-up" style={{ height: '70vh' }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>
        {children}
      </div>
    </div>
  );
};

export default function ProgressiveOverloadTracker() {
  const [entries, setEntries] = useState([]);
  const [activeTab, setActiveTab] = useState('exercises');
  const [user, setUser] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [showLogSheet, setShowLogSheet] = useState(false);
  const [logStep, setLogStep] = useState('weight'); // 'weight' | 'reps'
  const [currentSet, setCurrentSet] = useState({ weight: '', reps: '' });
  const [showExercisePicker, setShowExercisePicker] = useState(false);

  // Load data on mount
  useEffect(() => {
    setUser(getUser());
    setEntries(getEntries());
  }, []);

  // Save entries
  useEffect(() => {
    if (entries.length > 0) {
      saveEntries(entries);
    }
  }, [entries]);

  // Computed values
  const exerciseNames = useMemo(() => [...new Set(entries.map((e) => e.name))], [entries]);

  const personalRecords = useMemo(() => {
    const prs = {};
    entries.forEach((entry) => {
      const oneRM = calculate1RM(entry.weight, entry.reps);
      if (!prs[entry.name] || oneRM > prs[entry.name].oneRM) {
        prs[entry.name] = { oneRM, entryId: entry.id, date: entry.date, weight: entry.weight, reps: entry.reps };
      }
    });
    return prs;
  }, [entries]);

  // Group entries by exercise
  const groupedEntries = useMemo(() => {
    const groups = {};
    entries.forEach((entry) => {
      if (!groups[entry.name]) {
        groups[entry.name] = [];
      }
      groups[entry.name].push(entry);
    });
    Object.keys(groups).forEach((name) => {
      groups[name].sort((a, b) => new Date(a.date) - new Date(b.date));
    });
    return groups;
  }, [entries]);

  // Get sparkline data for an exercise (last 10 sessions)
  const getSparklineData = (exerciseName) => {
    const exerciseEntries = groupedEntries[exerciseName] || [];
    const last10 = exerciseEntries.slice(-10);
    return last10.map((e) => ({ value: e.weight }));
  };

  // Get performance trend
  const getPerformanceTrend = (exerciseName) => {
    const exerciseEntries = groupedEntries[exerciseName] || [];
    if (exerciseEntries.length < 2) return 'neutral';
    const recent = exerciseEntries.slice(-2);
    const diff = recent[1].weight - recent[0].weight;
    if (diff > 0) return 'up';
    if (diff < 0) return 'down';
    return 'neutral';
  };

  // Get last session weight
  const getLastWeight = (exerciseName) => {
    const exerciseEntries = groupedEntries[exerciseName] || [];
    if (exerciseEntries.length === 0) return null;
    return exerciseEntries[exerciseEntries.length - 1].weight;
  };

  // Get recommendation for exercise
  const getRecommendation = (exerciseName) => {
    const exerciseHistory = entries
      .filter((e) => e.name === exerciseName)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (exerciseHistory.length === 0) return null;

    const lastWorkout = exerciseHistory[0];
    return getNextWorkoutRecommendation(
      { weight: lastWorkout.weight, reps: lastWorkout.reps, sets: lastWorkout.sets || 1 },
      exerciseName,
      exerciseHistory.slice(1)
    );
  };

  // Log a set
  const logSet = () => {
    if (!selectedExercise || !currentSet.weight || !currentSet.reps) return;

    const weight = parseFloat(currentSet.weight);
    const reps = parseInt(currentSet.reps, 10);

    const newEntry = {
      id: generateId(),
      name: selectedExercise,
      date: new Date().toISOString().split('T')[0],
      weight,
      reps,
      sets: 1,
    };

    setEntries((prev) => [...prev, newEntry]);
    setShowLogSheet(false);
    setCurrentSet({ weight: '', reps: '' });
    setLogStep('weight');
  };

  // Exercise List View (Stock Watchlist Style)
  const ExerciseListView = () => {
    const allExercises = [...new Set([...COMMON_EXERCISES, ...exerciseNames])];

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="px-6 pt-12 pb-8">
          <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Portfolio</span>
          <h1 className="text-4xl font-extrabold text-black mt-1">Your Lifts</h1>
        </div>

        {/* Exercise List */}
        <div className="px-6">
          {allExercises.map((exercise) => {
            const lastWeight = getLastWeight(exercise);
            const trend = getPerformanceTrend(exercise);
            const sparkData = getSparklineData(exercise);
            const isPR = personalRecords[exercise];
            const trendColor = trend === 'up' ? COLORS.accent : trend === 'down' ? COLORS.negative : COLORS.text;

            return (
              <button
                key={exercise}
                onClick={() => {
                  setSelectedExercise(exercise);
                  setActiveTab('detail');
                }}
                className="w-full flex items-center py-5 border-b border-gray-100 last:border-0"
              >
                {/* Icon */}
                <div className="w-10 h-10 flex items-center justify-center text-gray-400">
                  {MUSCLE_ICONS[exercise] || MUSCLE_ICONS['Squat']}
                </div>

                {/* Name & PR indicator */}
                <div className="flex-1 ml-4 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-black">{exercise}</span>
                    {isPR && (
                      <span className="w-2 h-2 rounded-full bg-[#00C805]" />
                    )}
                  </div>
                  {lastWeight && (
                    <span className="text-xs text-gray-400">Last session</span>
                  )}
                </div>

                {/* Sparkline */}
                <div className="mx-4">
                  {sparkData.length > 1 && (
                    <Sparkline data={sparkData} color={trendColor} />
                  )}
                </div>

                {/* Weight */}
                <div className="text-right min-w-[60px]">
                  {lastWeight ? (
                    <>
                      <span className="text-lg font-bold" style={{ color: trendColor }}>
                        {lastWeight}
                      </span>
                      <span className="text-sm text-gray-400 ml-0.5">kg</span>
                    </>
                  ) : (
                    <span className="text-gray-300">-</span>
                  )}
                </div>

                {/* Chevron */}
                <svg className="w-5 h-5 text-gray-300 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}
        </div>

        {/* FAB to Log */}
        <button
          onClick={() => setShowExercisePicker(true)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-black rounded-full flex items-center justify-center shadow-lg"
        >
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>

        {/* Exercise Picker Sheet */}
        <Sheet isOpen={showExercisePicker} onClose={() => setShowExercisePicker(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-black mb-6">Select Exercise</h2>
            <div className="space-y-1">
              {allExercises.map((exercise) => (
                <button
                  key={exercise}
                  onClick={() => {
                    setSelectedExercise(exercise);
                    setShowExercisePicker(false);
                    setShowLogSheet(true);
                  }}
                  className="w-full flex items-center py-4 px-4 rounded-2xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 flex items-center justify-center text-gray-400">
                    {MUSCLE_ICONS[exercise] || MUSCLE_ICONS['Squat']}
                  </div>
                  <span className="ml-4 font-medium text-black">{exercise}</span>
                </button>
              ))}
            </div>
          </div>
        </Sheet>
      </div>
    );
  };

  // Exercise Detail View
  const ExerciseDetailView = () => {
    if (!selectedExercise) return null;

    const exerciseEntries = (groupedEntries[selectedExercise] || []).slice().reverse();
    const pr = personalRecords[selectedExercise];
    const recommendation = getRecommendation(selectedExercise);
    const chartData = exerciseEntries.slice().reverse().map((e) => ({
      date: e.date,
      value: calculate1RM(e.weight, e.reps),
    }));

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="px-6 pt-12 pb-4">
          <button
            onClick={() => setActiveTab('exercises')}
            className="flex items-center text-gray-400 mb-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </button>
          <h1 className="text-3xl font-extrabold text-black">{selectedExercise}</h1>
        </div>

        {/* Hero Number - Current PR */}
        {pr && (
          <div className="px-6 py-8">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Personal Record</span>
            <div className="flex items-baseline mt-2">
              <span className="text-6xl font-extrabold text-black tracking-tight">
                {Math.round(pr.oneRM * 10) / 10}
              </span>
              <span className="text-2xl font-medium text-gray-400 ml-2">kg</span>
              <span className="ml-3 px-3 py-1 bg-[#00C805] text-white text-xs font-bold rounded-full uppercase">
                1RM
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {pr.weight}kg × {pr.reps} reps on {formatDateShort(pr.date)}
            </p>
          </div>
        )}

        {/* Recommendation */}
        {recommendation && (
          <div className="mx-6 p-5 bg-gray-50 rounded-3xl mb-6">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Next Session</span>
            <div className="flex items-baseline mt-2">
              <span className="text-4xl font-extrabold text-black">
                {recommendation.nextWorkout.weight}
              </span>
              <span className="text-lg text-gray-400 ml-1">kg</span>
              <span className="mx-3 text-gray-300">×</span>
              <span className="text-4xl font-extrabold text-black">
                {recommendation.nextWorkout.targetReps}
              </span>
              <span className="text-lg text-gray-400 ml-1">reps</span>
            </div>
            <p className="text-sm text-gray-500 mt-3">{recommendation.message}</p>
          </div>
        )}

        {/* Minimal Chart */}
        {chartData.length > 1 && (
          <div className="px-6 py-8">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Progress</span>
            <div className="h-40 mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#000000"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* History */}
        <div className="px-6 pb-32">
          <span className="text-xs uppercase tracking-[0.2em] text-gray-400">History</span>
          <div className="mt-4 space-y-3">
            {exerciseEntries.map((entry) => {
              const oneRM = calculate1RM(entry.weight, entry.reps);
              const isPR = pr?.entryId === entry.id;

              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-black">
                        {entry.weight}kg × {entry.reps}
                      </span>
                      {isPR && (
                        <span className="px-2 py-0.5 bg-[#00C805] text-white text-[10px] font-bold rounded-full">
                          PR
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-400">{formatDate(entry.date)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-bold text-black">{Math.round(oneRM * 10) / 10}</span>
                    <span className="text-sm text-gray-400 ml-1">1RM</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Log Button */}
        <div className="fixed bottom-24 left-6 right-6">
          <button
            onClick={() => setShowLogSheet(true)}
            className="w-full h-14 bg-black text-white text-lg font-semibold rounded-full"
          >
            Log Set
          </button>
        </div>
      </div>
    );
  };

  // Profile View (Minimal)
  const ProfileView = () => (
    <div className="min-h-screen bg-white">
      <div className="px-6 pt-12 pb-8">
        <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Settings</span>
        <h1 className="text-4xl font-extrabold text-black mt-1">Profile</h1>
      </div>

      {user && (
        <div className="px-6">
          {/* Avatar & Name */}
          <div className="flex items-center pb-8 border-b border-gray-100">
            <img
              src={user.avatar}
              alt={user.name}
              className="w-16 h-16 rounded-full object-cover"
            />
            <div className="ml-4">
              <h2 className="text-xl font-bold text-black">{user.name}</h2>
              <p className="text-gray-400">{user.email}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="py-8 border-b border-gray-100">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Body Stats</span>
            <div className="grid grid-cols-3 gap-6 mt-4">
              <div>
                <span className="text-3xl font-extrabold text-black">{user.bodyweight}</span>
                <span className="text-lg text-gray-400 ml-1">kg</span>
                <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Weight</p>
              </div>
              <div>
                <span className="text-3xl font-extrabold text-black">{user.age}</span>
                <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Age</p>
              </div>
              <div>
                <span className="text-3xl font-extrabold text-black">{user.sex === 'male' ? 'M' : 'F'}</span>
                <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Sex</p>
              </div>
            </div>
          </div>

          {/* Workout Stats */}
          <div className="py-8">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Activity</span>
            <div className="grid grid-cols-2 gap-6 mt-4">
              <div>
                <span className="text-4xl font-extrabold text-black">{entries.length}</span>
                <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Total Sets</p>
              </div>
              <div>
                <span className="text-4xl font-extrabold text-black">{Object.keys(personalRecords).length}</span>
                <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">PRs Set</p>
              </div>
            </div>
          </div>

          {/* Reset */}
          <button
            onClick={resetDemo}
            className="w-full mt-8 py-4 text-[#FF5200] font-medium"
          >
            Reset Demo Data
          </button>
        </div>
      )}
    </div>
  );

  // Get current recommendation for log sheet
  const currentRecommendation = selectedExercise ? getRecommendation(selectedExercise) : null;

  // Handlers for log sheet (defined at component level to prevent re-renders)
  const handleWeightChange = (v) => setCurrentSet((prev) => ({ ...prev, weight: v }));
  const handleRepsChange = (v) => setCurrentSet((prev) => ({ ...prev, reps: v }));
  const handleWeightSubmit = () => setLogStep('reps');
  const handleRepsSubmit = () => logSet();
  const handleCloseSheet = () => {
    setShowLogSheet(false);
    setCurrentSet({ weight: '', reps: '' });
    setLogStep('weight');
  };

  return (
    <div className="min-h-screen bg-white text-black pb-20">
      {/* Main Content */}
      {activeTab === 'exercises' && <ExerciseListView />}
      {activeTab === 'detail' && <ExerciseDetailView />}
      {activeTab === 'profile' && <ProfileView />}

      {/* Log Sheet - Inlined to prevent re-renders */}
      <Sheet isOpen={showLogSheet} onClose={handleCloseSheet}>
        <div className="h-full flex flex-col">
          {/* Exercise Name */}
          <div className="px-6 pt-2 pb-4 border-b border-gray-100 flex-shrink-0">
            <h2 className="text-xl font-bold text-black text-center">{selectedExercise}</h2>
            {currentRecommendation && (
              <p className="text-sm text-gray-400 text-center mt-1">
                Target: {currentRecommendation.nextWorkout.weight}kg × {currentRecommendation.nextWorkout.targetReps} reps
              </p>
            )}
          </div>

          <div className="flex-1">
            {logStep === 'weight' ? (
              <Numpad
                value={currentSet.weight}
                onChange={handleWeightChange}
                onSubmit={handleWeightSubmit}
                label="Weight"
                suffix="kg"
              />
            ) : (
              <Numpad
                value={currentSet.reps}
                onChange={handleRepsChange}
                onSubmit={handleRepsSubmit}
                label="Reps"
                suffix="reps"
              />
            )}
          </div>
        </div>
      </Sheet>

      {/* Bottom Navigation - Minimal */}
      {activeTab !== 'detail' && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100">
          <div className="max-w-[600px] mx-auto flex">
            <button
              onClick={() => setActiveTab('exercises')}
              className={`flex-1 py-5 flex flex-col items-center gap-1 ${
                activeTab === 'exercises' ? 'text-black' : 'text-gray-300'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === 'exercises' ? 2 : 1.5} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="text-[10px] uppercase tracking-wider font-medium">Lifts</span>
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`flex-1 py-5 flex flex-col items-center gap-1 ${
                activeTab === 'profile' ? 'text-black' : 'text-gray-300'
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={activeTab === 'profile' ? 2 : 1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-[10px] uppercase tracking-wider font-medium">Profile</span>
            </button>
          </div>
        </nav>
      )}

      {/* CSS for animations */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
