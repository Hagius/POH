import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
} from 'recharts';
import {
  getUser,
  getEntries,
  saveEntries,
  saveUser,
  resetDemo,
  getDataMode,
  toggleDataMode,
  getCurrentUser,
  getCurrentEntries,
  saveCurrentEntries,
} from './lib/userStore';
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

// Scroll Number Picker Component
const ScrollNumberPicker = ({ value, onChange, min = 0, max = 300, step = 2.5, suffix = 'kg' }) => {
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const handleStart = useCallback((clientY) => {
    isDragging.current = true;
    startY.current = clientY;
    startValue.current = value;
  }, [value]);

  const handleMove = useCallback((clientY) => {
    if (!isDragging.current) return;

    const diff = startY.current - clientY;
    const valueChange = Math.round(diff / 10) * step;
    const newValue = Math.max(min, Math.min(max, startValue.current + valueChange));

    // Round to step
    const rounded = Math.round(newValue / step) * step;
    if (rounded !== value) {
      onChange(rounded);
    }
  }, [value, onChange, min, max, step]);

  const handleEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Increment/decrement handlers for arrow clicks
  const increment = useCallback(() => {
    const newValue = Math.min(max, value + step);
    const rounded = Math.round(newValue / step) * step;
    onChange(rounded);
  }, [value, onChange, max, step]);

  const decrement = useCallback(() => {
    const newValue = Math.max(min, value - step);
    const rounded = Math.round(newValue / step) * step;
    onChange(rounded);
  }, [value, onChange, min, step]);

  // Touch events
  const onTouchStart = (e) => handleStart(e.touches[0].clientY);
  const onTouchMove = (e) => {
    e.preventDefault();
    handleMove(e.touches[0].clientY);
  };
  const onTouchEnd = () => handleEnd();

  // Mouse events
  const onMouseDown = (e) => handleStart(e.clientY);
  const onMouseMove = (e) => {
    if (isDragging.current) {
      e.preventDefault();
      handleMove(e.clientY);
    }
  };
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => handleEnd();

  // Format value to always show one decimal place
  const formatValue = (v) => {
    if (typeof v !== 'number') return v;
    return v.toFixed(1);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col items-center justify-center select-none cursor-ns-resize touch-none"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* Up arrow - clickable */}
      <button
        onClick={increment}
        className="text-gray-300 mb-4 hover:text-gray-500 transition-colors p-2"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Value display */}
      <div className="flex items-baseline">
        <span className="text-8xl font-extrabold tracking-tight text-black tabular-nums">
          {formatValue(value)}
        </span>
        <span className="text-3xl font-medium text-gray-400 ml-3">{suffix}</span>
      </div>

      {/* Down arrow - clickable */}
      <button
        onClick={decrement}
        className="text-gray-300 mt-4 hover:text-gray-500 transition-colors p-2"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <p className="text-sm text-gray-400 mt-6">Swipe or tap arrows to adjust</p>
    </div>
  );
};

// Sheet Modal Component (for exercise picker only)
const Sheet = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl overflow-hidden animate-slide-up" style={{ maxHeight: '70vh' }}>
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
  const [showLogView, setShowLogView] = useState(false);
  const [logStep, setLogStep] = useState('weight'); // 'weight' | 'reps'
  const [currentSet, setCurrentSet] = useState({ weight: 0, reps: 8 });
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [dataMode, setDataMode] = useState('demo');

  // Load data on mount
  useEffect(() => {
    const mode = getDataMode();
    setDataMode(mode);
    setUser(getCurrentUser());
    setEntries(getCurrentEntries());
  }, []);

  // Save entries when they change
  useEffect(() => {
    if (entries.length > 0 || dataMode === 'user') {
      saveCurrentEntries(entries);
    }
  }, [entries, dataMode]);

  // Handle data mode toggle
  const handleToggleDataMode = () => {
    const newMode = toggleDataMode();
    setDataMode(newMode);
    setUser(getCurrentUser());
    setEntries(getCurrentEntries());
  };

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

    const newEntry = {
      id: generateId(),
      name: selectedExercise,
      date: new Date().toISOString().split('T')[0],
      weight: currentSet.weight,
      reps: currentSet.reps,
      sets: 1,
    };

    setEntries((prev) => [...prev, newEntry]);
    setShowLogView(false);
    setCurrentSet({ weight: 0, reps: 8 });
    setLogStep('weight');
  };

  // Open log view with initial values from recommendation
  const openLogView = (exerciseName) => {
    setSelectedExercise(exerciseName);
    const recommendation = getRecommendation(exerciseName);
    if (recommendation) {
      setCurrentSet({
        weight: recommendation.nextWorkout.weight,
        reps: recommendation.nextWorkout.targetReps,
      });
    } else {
      const lastWeight = getLastWeight(exerciseName);
      setCurrentSet({
        weight: lastWeight || 20,
        reps: 8,
      });
    }
    setLogStep('weight');
    setShowLogView(true);
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
                    setShowExercisePicker(false);
                    openLogView(exercise);
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

        {/* 1. Progress Chart */}
        {chartData.length > 1 && (
          <div className="px-6 py-6">
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

        {/* 2. Recommendation */}
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

        {/* 3. Personal Record */}
        {pr && (
          <div className="px-6 py-6">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Personal Record</span>
            <div className="flex items-baseline mt-2">
              <span className="text-5xl font-extrabold text-black tracking-tight">
                {Math.round(pr.oneRM * 10) / 10}
              </span>
              <span className="text-xl font-medium text-gray-400 ml-2">kg</span>
              <span className="ml-3 px-3 py-1 bg-[#00C805] text-white text-xs font-bold rounded-full uppercase">
                1RM
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {pr.weight}kg × {pr.reps} reps on {formatDateShort(pr.date)}
            </p>
          </div>
        )}

        {/* 4. History - Collapsible */}
        <div className="px-6 pb-32">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full flex items-center justify-between py-3"
          >
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">
              History ({exerciseEntries.length})
            </span>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${historyExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {historyExpanded && (
            <div className="mt-2 space-y-3">
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
          )}
        </div>

        {/* Log Button */}
        <div className="fixed bottom-24 left-6 right-6">
          <button
            onClick={() => openLogView(selectedExercise)}
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
          <div className="py-8 border-b border-gray-100">
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

          {/* Data Mode Toggle */}
          <div className="py-8">
            <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Data Source</span>
            <button
              onClick={handleToggleDataMode}
              className="w-full mt-4 flex items-center justify-between py-4 px-5 bg-gray-50 rounded-2xl"
            >
              <div className="text-left">
                <span className="font-semibold text-black">
                  {dataMode === 'demo' ? 'Demo Data' : 'Your Data'}
                </span>
                <p className="text-sm text-gray-400 mt-0.5">
                  {dataMode === 'demo' ? 'Using generated sample data' : 'Using your logged workouts'}
                </p>
              </div>
              <div className={`w-12 h-7 rounded-full flex items-center px-1 transition-colors ${
                dataMode === 'user' ? 'bg-[#00C805]' : 'bg-gray-300'
              }`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  dataMode === 'user' ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </div>
            </button>
          </div>

          {/* Reset Demo (only shown in demo mode) */}
          {dataMode === 'demo' && (
            <button
              onClick={resetDemo}
              className="w-full py-4 text-[#FF5200] font-medium"
            >
              Reset Demo Data
            </button>
          )}
        </div>
      )}
    </div>
  );

  // Get current recommendation for log view
  const currentRecommendation = selectedExercise ? getRecommendation(selectedExercise) : null;

  // Handlers for log view
  const handleWeightChange = (v) => setCurrentSet((prev) => ({ ...prev, weight: v }));
  const handleRepsChange = (v) => setCurrentSet((prev) => ({ ...prev, reps: v }));
  const handleCloseLogView = () => {
    setShowLogView(false);
    setCurrentSet({ weight: 0, reps: 8 });
    setLogStep('weight');
  };

  // Fullscreen Log View
  if (showLogView) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-12 pb-2">
          <button
            onClick={handleCloseLogView}
            className="text-gray-400 flex items-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold text-black">{selectedExercise}</h1>
            {currentRecommendation && (
              <p className="text-sm text-gray-400 mt-1">
                Target: {currentRecommendation.nextWorkout.weight}kg × {currentRecommendation.nextWorkout.targetReps} reps
              </p>
            )}
          </div>
          <div className="w-6" /> {/* Spacer for centering */}
        </div>

        {/* Upper half - Scroll number picker */}
        <div className="flex-1 flex flex-col">
          {logStep === 'weight' ? (
            <ScrollNumberPicker
              value={currentSet.weight}
              onChange={handleWeightChange}
              min={0}
              max={500}
              step={2.5}
              suffix="kg"
            />
          ) : (
            <ScrollNumberPicker
              value={currentSet.reps}
              onChange={handleRepsChange}
              min={1}
              max={50}
              step={1}
              suffix="reps"
            />
          )}
        </div>

        {/* Lower half - Recommendation info */}
        <div className="px-6 pb-8">
          {currentRecommendation && (
            <div className="mb-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className={`w-2 h-2 rounded-full ${
                  currentRecommendation.status === 'progress' ? 'bg-[#00C805]' :
                  currentRecommendation.status === 'maintain' ? 'bg-gray-400' :
                  currentRecommendation.status === 'deload' ? 'bg-[#FF5200]' :
                  currentRecommendation.status === 'double_jump' ? 'bg-[#00C805]' :
                  currentRecommendation.status === 'struggle' ? 'bg-[#FF5200]' :
                  'bg-gray-400'
                }`} />
                <span className="text-xs uppercase tracking-[0.15em] text-gray-500 font-medium">
                  {currentRecommendation.status === 'progress' && 'Progress'}
                  {currentRecommendation.status === 'maintain' && 'Build Reps'}
                  {currentRecommendation.status === 'deload' && 'Deload Week'}
                  {currentRecommendation.status === 'double_jump' && 'Double Jump'}
                  {currentRecommendation.status === 'struggle' && 'Keep Pushing'}
                </span>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">
                {currentRecommendation.message}
              </p>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={() => {
              if (logStep === 'weight') {
                setLogStep('reps');
              } else {
                logSet();
              }
            }}
            disabled={logStep === 'weight' ? currentSet.weight <= 0 : currentSet.reps <= 0}
            className="w-full h-14 bg-black text-white text-lg font-semibold rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {logStep === 'weight' ? 'NEXT' : 'LOG SET'}
          </button>

          {/* Back button for reps step */}
          {logStep === 'reps' && (
            <button
              onClick={() => setLogStep('weight')}
              className="w-full h-12 text-gray-500 text-sm font-medium mt-2"
            >
              Back to weight
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black pb-20">
      {/* Main Content */}
      {activeTab === 'exercises' && <ExerciseListView />}
      {activeTab === 'detail' && <ExerciseDetailView />}
      {activeTab === 'profile' && <ProfileView />}

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
