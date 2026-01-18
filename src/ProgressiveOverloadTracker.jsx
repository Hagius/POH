import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  ReferenceLine,
  YAxis,
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
  saveCurrentUser,
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
const ScrollNumberPicker = ({ value, onChange, min = 0, max = 300, step = 2.5, suffix = 'kg', showDecimal = true, recommendedValue = null, compact = false }) => {
  const containerRef = useRef(null);
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  // Magnetic snap threshold - snap when within 1 step of recommended
  const snapThreshold = step * 1.5;

  const handleStart = useCallback((clientY) => {
    isDragging.current = true;
    startY.current = clientY;
    startValue.current = value;
  }, [value]);

  const handleMove = useCallback((clientY) => {
    if (!isDragging.current) return;

    const diff = startY.current - clientY;
    const valueChange = Math.round(diff / 10) * step;
    let newValue = Math.max(min, Math.min(max, startValue.current + valueChange));

    // Round to step
    let rounded = Math.round(newValue / step) * step;

    // Magnetic snap to recommended value
    if (recommendedValue !== null && Math.abs(rounded - recommendedValue) <= snapThreshold) {
      rounded = recommendedValue;
    }

    if (rounded !== value) {
      onChange(rounded);
    }
  }, [value, onChange, min, max, step, recommendedValue, snapThreshold]);

  const handleEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Increment/decrement handlers for arrow clicks
  const increment = useCallback(() => {
    let newValue = Math.min(max, value + step);
    let rounded = Math.round(newValue / step) * step;

    // Magnetic snap to recommended value
    if (recommendedValue !== null && Math.abs(rounded - recommendedValue) <= snapThreshold) {
      rounded = recommendedValue;
    }

    onChange(rounded);
  }, [value, onChange, max, step, recommendedValue, snapThreshold]);

  const decrement = useCallback(() => {
    let newValue = Math.max(min, value - step);
    let rounded = Math.round(newValue / step) * step;

    // Magnetic snap to recommended value
    if (recommendedValue !== null && Math.abs(rounded - recommendedValue) <= snapThreshold) {
      rounded = recommendedValue;
    }

    onChange(rounded);
  }, [value, onChange, min, step, recommendedValue, snapThreshold]);

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

  // Format value - show decimal only if showDecimal is true
  const formatValue = (v) => {
    if (typeof v !== 'number') return v;
    return showDecimal ? v.toFixed(1) : Math.round(v).toString();
  };

  // Calculate min-width based on max value to prevent layout shift
  const getMinWidth = () => {
    const maxDigits = Math.max(max, 100).toString().length;
    if (showDecimal) {
      return `${maxDigits + 2}ch`; // +2 for decimal point and one decimal place
    }
    return `${Math.max(maxDigits, 2)}ch`; // At least 2 chars for reps
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center select-none cursor-ns-resize touch-none"
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
        className={`text-gray-300 hover:text-gray-500 transition-colors ${compact ? 'mb-1 p-1' : 'mb-2 p-2'}`}
      >
        <svg className={compact ? "w-5 h-5" : "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {/* Value display - fixed width to prevent jumping */}
      <div className="flex items-baseline justify-center">
        <span
          className={`font-extrabold tracking-tight text-black tabular-nums text-center ${compact ? 'text-5xl' : 'text-6xl'}`}
          style={{ minWidth: getMinWidth() }}
        >
          {formatValue(value)}
        </span>
        <span className={`font-medium text-gray-400 ml-1 ${compact ? 'text-base' : 'text-xl'}`}>{suffix}</span>
      </div>

      {/* Down arrow - clickable */}
      <button
        onClick={decrement}
        className={`text-gray-300 hover:text-gray-500 transition-colors ${compact ? 'mt-1 p-1' : 'mt-2 p-2'}`}
      >
        <svg className={compact ? "w-5 h-5" : "w-6 h-6"} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

    </div>
  );
};

// Slide to Log Component (like Robinhood/iPhone unlock)
const SlideToLog = ({ onComplete, disabled, label = "Slide to Log" }) => {
  const containerRef = useRef(null);
  const [slideX, setSlideX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const startX = useRef(0);
  const thumbWidth = 56; // w-14

  const getMaxSlide = () => {
    if (!containerRef.current) return 200;
    return containerRef.current.offsetWidth - thumbWidth - 8; // 8 for padding
  };

  const handleStart = (clientX) => {
    if (disabled || isComplete) return;
    setIsDragging(true);
    startX.current = clientX - slideX;
  };

  const handleMove = (clientX) => {
    if (!isDragging || disabled || isComplete) return;
    const newX = Math.max(0, Math.min(getMaxSlide(), clientX - startX.current));
    setSlideX(newX);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    const threshold = getMaxSlide() * 0.85;
    if (slideX >= threshold) {
      setSlideX(getMaxSlide());
      setIsComplete(true);
      setTimeout(() => {
        onComplete();
        setSlideX(0);
        setIsComplete(false);
      }, 200);
    } else {
      setSlideX(0);
    }
  };

  const onTouchStart = (e) => handleStart(e.touches[0].clientX);
  const onTouchMove = (e) => {
    e.preventDefault();
    handleMove(e.touches[0].clientX);
  };
  const onTouchEnd = () => handleEnd();

  const onMouseDown = (e) => handleStart(e.clientX);
  const onMouseMove = (e) => {
    if (isDragging) handleMove(e.clientX);
  };
  const onMouseUp = () => handleEnd();
  const onMouseLeave = () => handleEnd();

  const progress = slideX / (getMaxSlide() || 1);

  return (
    <div
      ref={containerRef}
      className={`relative h-14 rounded-full overflow-hidden select-none ${
        disabled ? 'bg-gray-100' : 'bg-gray-100'
      }`}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
    >
      {/* Progress fill */}
      <div
        className="absolute inset-y-0 left-0 bg-black/5 transition-all duration-75"
        style={{ width: `${(slideX + thumbWidth + 4)}px` }}
      />

      {/* Label */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ opacity: 1 - progress * 1.5 }}
      >
        <span className={`text-lg font-semibold ${disabled ? 'text-gray-300' : 'text-gray-400'}`}>
          {label}
        </span>
      </div>

      {/* Sliding thumb */}
      <div
        className={`absolute top-1 bottom-1 left-1 w-14 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform ${
          !isDragging && slideX === 0 ? 'duration-300' : 'duration-75'
        } ${disabled ? 'bg-gray-300' : isComplete ? 'bg-[#00C805]' : 'bg-black'}`}
        style={{ transform: `translateX(${slideX}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        {isComplete ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className={`w-6 h-6 ${disabled ? 'text-gray-400' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        )}
      </div>
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

// Swipeable Entry Component for history items
const SwipeableEntry = ({ children, onEdit, onToggleActive, onDelete, isActive = true }) => {
  const containerRef = useRef(null);
  const [translateX, setTranslateX] = useState(0);
  const startX = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);

  const ACTION_WIDTH = 180; // Total width of action buttons

  const handleTouchStart = (e) => {
    startX.current = e.touches[0].clientX;
    currentX.current = translateX;
    isDragging.current = true;
  };

  const handleTouchMove = (e) => {
    if (!isDragging.current) return;
    const diff = e.touches[0].clientX - startX.current;
    const newTranslate = Math.min(0, Math.max(-ACTION_WIDTH, currentX.current + diff));
    setTranslateX(newTranslate);
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    // Snap to open or closed
    if (translateX < -ACTION_WIDTH / 2) {
      setTranslateX(-ACTION_WIDTH);
    } else {
      setTranslateX(0);
    }
  };

  const closeSwipe = () => setTranslateX(0);

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons (revealed on swipe) */}
      <div className="absolute right-0 top-0 bottom-0 flex">
        <button
          onClick={() => { onEdit(); closeSwipe(); }}
          className="w-[60px] h-full bg-blue-500 flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          onClick={() => { onToggleActive(); closeSwipe(); }}
          className={`w-[60px] h-full flex items-center justify-center ${isActive ? 'bg-gray-400' : 'bg-green-500'}`}
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isActive ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            )}
          </svg>
        </button>
        <button
          onClick={() => { onDelete(); closeSwipe(); }}
          className="w-[60px] h-full bg-[#FF5200] flex items-center justify-center"
        >
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Swipeable content */}
      <div
        ref={containerRef}
        className="relative bg-white transition-transform duration-150 ease-out"
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
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
  const [currentSet, setCurrentSet] = useState({ weight: 0, reps: 8 });
  const [pendingSets, setPendingSets] = useState([]); // Sets added but not yet logged
  const [editingSetIndex, setEditingSetIndex] = useState(null); // Which pending set is being edited
  const [setsLoggedCount, setSetsLoggedCount] = useState(0);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showLevelOverview, setShowLevelOverview] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [dataMode, setDataMode] = useState('demo');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editedUser, setEditedUser] = useState(null);
  const [editingEntry, setEditingEntry] = useState(null);
  const [editedEntryData, setEditedEntryData] = useState(null);
  const [selectedChartPoint, setSelectedChartPoint] = useState(null);
  const [isScrubbingChart, setIsScrubbingChart] = useState(false);
  const [chartAnimated, setChartAnimated] = useState(false);
  const chartContainerRef = useRef(null);

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

  // Profile editing handlers
  const startEditingProfile = useCallback(() => {
    setEditedUser({ ...user });
    setEditingProfile(true);
  }, [user]);

  const cancelEditingProfile = useCallback(() => {
    setEditedUser(null);
    setEditingProfile(false);
  }, []);

  const saveProfileChanges = useCallback(() => {
    if (editedUser) {
      saveCurrentUser(editedUser);
      setUser(editedUser);
      setEditingProfile(false);
      setEditedUser(null);
    }
  }, [editedUser]);

  const updateEditedUserField = useCallback((field, value) => {
    setEditedUser(prev => prev ? { ...prev, [field]: value } : null);
  }, []);

  // Entry management handlers
  const startEditingEntry = useCallback((entry) => {
    setEditingEntry(entry.id);
    setEditedEntryData({ ...entry });
  }, []);

  const cancelEditingEntry = useCallback(() => {
    setEditingEntry(null);
    setEditedEntryData(null);
  }, []);

  const saveEntryChanges = useCallback(() => {
    if (editedEntryData) {
      setEntries(prev => prev.map(e =>
        e.id === editedEntryData.id ? editedEntryData : e
      ));
      setEditingEntry(null);
      setEditedEntryData(null);
    }
  }, [editedEntryData]);

  const updateEditedEntryField = useCallback((field, value) => {
    setEditedEntryData(prev => prev ? { ...prev, [field]: value } : null);
  }, []);

  const toggleEntryActive = useCallback((entryId) => {
    setEntries(prev => prev.map(e =>
      e.id === entryId ? { ...e, isActive: e.isActive === false ? true : false } : e
    ));
  }, []);

  const deleteEntry = useCallback((entryId) => {
    setEntries(prev => prev.filter(e => e.id !== entryId));
  }, []);

  // Computed values
  const exerciseNames = useMemo(() => [...new Set(entries.map((e) => e.name))], [entries]);

  // Only consider active entries for PRs
  const personalRecords = useMemo(() => {
    const prs = {};
    entries.forEach((entry) => {
      // Skip inactive entries
      if (entry.isActive === false) return;
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

  // Get sparkline data for an exercise (highest 1RM per day, last 10 days)
  const getSparklineData = (exerciseName) => {
    const exerciseEntries = groupedEntries[exerciseName] || [];
    // Group by date and get highest 1RM per day
    const dailyBest = {};
    exerciseEntries.forEach((e) => {
      if (e.isActive === false) return;
      const oneRM = calculate1RM(e.weight, e.reps);
      if (!dailyBest[e.date] || oneRM > dailyBest[e.date]) {
        dailyBest[e.date] = oneRM;
      }
    });
    // Sort by date and take last 10
    const sortedDays = Object.entries(dailyBest)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .slice(-10);
    return sortedDays.map(([, value]) => ({ value }));
  };

  // Get performance trend (comparing last two days' highest 1RM)
  const getPerformanceTrend = (exerciseName) => {
    const exerciseEntries = groupedEntries[exerciseName] || [];
    // Group by date and get highest 1RM per day
    const dailyBest = {};
    exerciseEntries.forEach((e) => {
      if (e.isActive === false) return;
      const oneRM = calculate1RM(e.weight, e.reps);
      if (!dailyBest[e.date] || oneRM > dailyBest[e.date]) {
        dailyBest[e.date] = oneRM;
      }
    });
    const sortedDays = Object.entries(dailyBest)
      .sort(([a], [b]) => new Date(a) - new Date(b));
    if (sortedDays.length < 2) return 'neutral';
    const recent = sortedDays.slice(-2);
    const diff = recent[1][1] - recent[0][1];
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

  // Log all sets (pending + current)
  const logAllSets = () => {
    if (!selectedExercise) return;

    const allSets = [...pendingSets];
    // Add current set if valid
    if (currentSet.weight > 0 && currentSet.reps > 0) {
      allSets.push(currentSet);
    }

    if (allSets.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const newEntries = allSets.map(set => ({
      id: generateId(),
      name: selectedExercise,
      date: today,
      weight: set.weight,
      reps: set.reps,
      sets: 1,
    }));

    setEntries((prev) => [...prev, ...newEntries]);
    setSetsLoggedCount(allSets.length);
    setShowLogView(false);
    setPendingSets([]);
    setEditingSetIndex(null);
  };

  // Add current set to pending and prepare for next set
  const addSet = () => {
    if (currentSet.weight <= 0 || currentSet.reps <= 0) return;
    setPendingSets((prev) => [...prev, { ...currentSet }]);
    // Keep same weight/reps for convenience
  };

  // Edit a pending set
  const editPendingSet = (index) => {
    setEditingSetIndex(index);
    setCurrentSet({ ...pendingSets[index] });
  };

  // Save edited pending set
  const saveEditedSet = () => {
    if (editingSetIndex !== null) {
      setPendingSets((prev) => prev.map((set, i) =>
        i === editingSetIndex ? { ...currentSet } : set
      ));
      setEditingSetIndex(null);
      // Reset to last values for new set
      const lastSet = pendingSets[pendingSets.length - 1] || currentSet;
      setCurrentSet({ ...lastSet });
    }
  };

  // Cancel editing pending set
  const cancelEditSet = () => {
    if (editingSetIndex !== null) {
      const lastSet = pendingSets[pendingSets.length - 1] || { weight: 20, reps: 8 };
      setCurrentSet({ ...lastSet });
      setEditingSetIndex(null);
    }
  };

  // Remove a pending set
  const removePendingSet = (index) => {
    setPendingSets((prev) => prev.filter((_, i) => i !== index));
    if (editingSetIndex === index) {
      setEditingSetIndex(null);
    }
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
    setPendingSets([]);
    setEditingSetIndex(null);
    setSetsLoggedCount(0);
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
    // Only include active entries in chart, using highest 1RM per day
    const chartData = (() => {
      const activeEntries = exerciseEntries.filter((e) => e.isActive !== false);
      const dailyBest = {};
      activeEntries.forEach((e) => {
        const oneRM = calculate1RM(e.weight, e.reps);
        if (!dailyBest[e.date] || oneRM > dailyBest[e.date]) {
          dailyBest[e.date] = oneRM;
        }
      });
      return Object.entries(dailyBest)
        .sort(([a], [b]) => new Date(a) - new Date(b))
        .map(([date, value]) => ({ date, value }));
    })();

    // Calculate strength level using user's profile data
    const strengthThresholds = user ? getStrengthThresholds(
      selectedExercise,
      user.sex || 'male',
      user.bodyweight || 75,
      user.age || 30
    ) : null;
    const strengthLevel = pr && strengthThresholds ? getStrengthLevel(pr.oneRM, strengthThresholds) : null;

    // Calculate weight needed for next level and current level threshold
    const getLevelThresholds = () => {
      if (!strengthThresholds || !strengthLevel) return null;
      const levels = ['beginner', 'intermediate', 'advanced', 'professional'];
      const levelColors = {
        beginner: '#22c55e',      // Green
        intermediate: '#3b82f6',  // Blue
        advanced: '#a855f7',      // Purple
        professional: '#f59e0b',  // Amber
      };
      const currentIndex = levels.indexOf(strengthLevel);

      // Current level's lower threshold (where this level starts)
      const currentLevelThreshold = currentIndex === 0 ? 0 : strengthThresholds[strengthLevel];
      const currentLevelColor = levelColors[strengthLevel];

      // Next level threshold
      const isMax = currentIndex === levels.length - 1;
      const nextLevel = isMax ? null : levels[currentIndex + 1];
      const nextThreshold = isMax ? null : strengthThresholds[nextLevel];
      const nextLevelColor = isMax ? null : levelColors[nextLevel];

      // Weight needed for next level
      const weightNeeded = pr && nextThreshold ? Math.round((nextThreshold - pr.oneRM) * 10) / 10 : null;

      return {
        currentLevel: strengthLevel,
        currentLevelThreshold,
        currentLevelColor,
        nextLevel,
        nextThreshold,
        nextLevelColor,
        weightNeeded,
        isMax,
      };
    };
    const levelThresholds = getLevelThresholds();
    const nextLevelInfo = levelThresholds ? {
      nextLevel: levelThresholds.nextLevel,
      weightNeeded: levelThresholds.weightNeeded,
      nextThreshold: levelThresholds.nextThreshold,
      isMax: levelThresholds.isMax,
    } : null;

    // Handle chart scrubbing - find data point from x position
    const getDataPointFromX = (clientX) => {
      if (!chartContainerRef.current || chartData.length === 0) return null;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const chartWidth = rect.width - 20; // Account for margins
      const xOffset = 10; // Left margin
      const normalizedX = Math.max(0, Math.min(1, (x - xOffset) / chartWidth));
      const index = Math.round(normalizedX * (chartData.length - 1));
      return chartData[Math.max(0, Math.min(chartData.length - 1, index))];
    };

    const handleChartTouchStart = (e) => {
      e.preventDefault();
      setIsScrubbingChart(true);
      const touch = e.touches[0];
      const point = getDataPointFromX(touch.clientX);
      if (point) setSelectedChartPoint(point);
    };

    const handleChartTouchMove = (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const point = getDataPointFromX(touch.clientX);
      if (point) setSelectedChartPoint(point);
    };

    const handleChartTouchEnd = () => {
      setIsScrubbingChart(false);
    };

    const handleChartMouseDown = (e) => {
      setIsScrubbingChart(true);
      const point = getDataPointFromX(e.clientX);
      if (point) setSelectedChartPoint(point);
    };

    const handleChartMouseMove = (e) => {
      if (!isScrubbingChart) return;
      const point = getDataPointFromX(e.clientX);
      if (point) setSelectedChartPoint(point);
    };

    const handleChartMouseUp = () => {
      setIsScrubbingChart(false);
    };

    const handleChartMouseLeave = () => {
      setIsScrubbingChart(false);
    };

    // Mark animation as complete after first render
    const handleAnimationEnd = () => {
      setChartAnimated(true);
    };

    // Level Overview Modal
    if (showLevelOverview && strengthThresholds) {
      const levels = [
        { key: 'beginner', name: 'Beginner', color: 'bg-green-500', textColor: 'text-green-600', range: `0 - ${strengthThresholds.intermediate - 1}kg` },
        { key: 'intermediate', name: 'Intermediate', color: 'bg-blue-500', textColor: 'text-blue-600', range: `${strengthThresholds.intermediate} - ${strengthThresholds.advanced - 1}kg` },
        { key: 'advanced', name: 'Advanced', color: 'bg-purple-500', textColor: 'text-purple-600', range: `${strengthThresholds.advanced} - ${strengthThresholds.professional - 1}kg` },
        { key: 'professional', name: 'Professional', color: 'bg-amber-400', textColor: 'text-amber-600', range: `${strengthThresholds.professional}kg+` },
      ];

      const currentOneRM = pr?.oneRM || 0;

      return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-12 pb-4 border-b border-gray-100">
            <button
              onClick={() => setShowLevelOverview(false)}
              className="text-gray-400 flex items-center"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-black">Strength Levels</h1>
            <div className="w-6" />
          </div>

          {/* Exercise & Current Stats */}
          <div className="px-6 py-6 bg-gray-50">
            <h2 className="text-2xl font-bold text-black">{selectedExercise}</h2>
            <p className="text-gray-500 mt-1">Based on your profile: {user?.bodyweight || 75}kg, {user?.age || 30}y, {user?.sex || 'male'}</p>
            {pr && (
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-black">{Math.round(currentOneRM)}kg</span>
                <span className="text-gray-400">estimated 1RM</span>
              </div>
            )}
          </div>

          {/* Levels List */}
          <div className="flex-1 px-6 py-6 overflow-y-auto">
            <div className="space-y-3">
              {levels.map((level, index) => {
                const isCurrentLevel = strengthLevel === level.key;
                const isPastLevel = levels.findIndex(l => l.key === strengthLevel) > index;
                const threshold = strengthThresholds[level.key];

                // Calculate progress within this level
                let progressPercent = 0;
                if (isCurrentLevel && currentOneRM > 0) {
                  const lowerBound = index === 0 ? 0 : strengthThresholds[levels[index - 1].key];
                  const upperBound = threshold;
                  progressPercent = Math.min(100, Math.max(0, ((currentOneRM - lowerBound) / (upperBound - lowerBound)) * 100));
                }

                return (
                  <div
                    key={level.key}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      isCurrentLevel
                        ? 'border-black bg-white shadow-lg'
                        : isPastLevel
                        ? 'border-gray-200 bg-gray-50'
                        : 'border-gray-100 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full ${level.color} ${isPastLevel ? 'opacity-50' : ''}`} />
                        <div>
                          <span className={`font-bold ${isCurrentLevel ? 'text-black' : isPastLevel ? 'text-gray-400' : 'text-gray-600'}`}>
                            {level.name}
                          </span>
                          {isCurrentLevel && (
                            <span className="ml-2 text-xs bg-black text-white px-2 py-0.5 rounded-full">
                              Current
                            </span>
                          )}
                          {isPastLevel && (
                            <span className="ml-2 text-xs text-gray-400">
                              ✓ Achieved
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-semibold ${isCurrentLevel ? level.textColor : 'text-gray-400'}`}>
                          {level.range}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar for current level */}
                    {isCurrentLevel && (
                      <div className="mt-3">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${level.color} transition-all duration-500`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-xs text-gray-400">
                          <span>{Math.round(currentOneRM)}kg</span>
                          <span>{threshold}kg</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Multiplier Info */}
            <div className="mt-8 p-4 bg-gray-50 rounded-2xl">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">How levels are calculated</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Strength levels are based on your estimated 1 rep max (1RM) relative to your bodyweight, adjusted for age.
                These standards help you track your progress compared to typical lifters at each experience level.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="px-6 pt-12 pb-4">
          <button
            onClick={() => {
              setSelectedChartPoint(null);
              setChartAnimated(false);
              setActiveTab('exercises');
            }}
            className="flex items-center text-gray-400 mb-4"
          >
            <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-black">{selectedExercise}</h1>
            {strengthLevel && (
              <button
                onClick={() => setShowLevelOverview(true)}
                className={`px-3 py-1 text-xs font-bold rounded-full uppercase transition-transform active:scale-95 ${
                  strengthLevel === 'professional' ? 'bg-amber-400 text-amber-900' :
                  strengthLevel === 'advanced' ? 'bg-purple-500 text-white' :
                  strengthLevel === 'intermediate' ? 'bg-blue-500 text-white' :
                  'bg-green-500 text-white'
                }`}
              >
                {strengthLevel}
              </button>
            )}
          </div>
          {nextLevelInfo && !nextLevelInfo.isMax && (
            <p className="text-sm text-gray-400 mt-2">
              <span className="font-semibold text-black">+{nextLevelInfo.weightNeeded}kg</span> to reach{' '}
              <span className={`font-semibold ${
                nextLevelInfo.nextLevel === 'professional' ? 'text-amber-500' :
                nextLevelInfo.nextLevel === 'advanced' ? 'text-purple-500' :
                nextLevelInfo.nextLevel === 'intermediate' ? 'text-blue-500' :
                'text-green-500'
              }`}>{nextLevelInfo.nextLevel}</span>
            </p>
          )}
          {nextLevelInfo?.isMax && (
            <p className="text-sm text-amber-500 mt-2 font-medium">
              You've reached the highest level!
            </p>
          )}
        </div>

        {/* 1. Progress Chart */}
        {chartData.length > 1 && (
          <div className="px-6 py-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Progress</span>
              {/* Show selected point info inline only while scrubbing */}
              {isScrubbingChart && selectedChartPoint && (
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-black">
                    {Math.round(selectedChartPoint.value * 10) / 10}kg
                  </span>
                  <span className="text-sm text-gray-400">{formatDateShort(selectedChartPoint.date)}</span>
                </div>
              )}
            </div>
            <div
              ref={chartContainerRef}
              className="h-48 touch-none select-none cursor-crosshair relative"
              onTouchStart={handleChartTouchStart}
              onTouchMove={handleChartTouchMove}
              onTouchEnd={handleChartTouchEnd}
              onMouseDown={handleChartMouseDown}
              onMouseMove={handleChartMouseMove}
              onMouseUp={handleChartMouseUp}
              onMouseLeave={handleChartMouseLeave}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 10, bottom: 10, left: 10 }}
                >
                  <YAxis domain={['auto', 'auto']} hide />
                  {/* Current level threshold line */}
                  {levelThresholds && levelThresholds.currentLevelThreshold > 0 && (
                    <ReferenceLine
                      y={levelThresholds.currentLevelThreshold}
                      stroke={levelThresholds.currentLevelColor}
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                  )}
                  {/* Next level threshold line */}
                  {levelThresholds && levelThresholds.nextThreshold && (
                    <ReferenceLine
                      y={levelThresholds.nextThreshold}
                      stroke={levelThresholds.nextLevelColor}
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#000000"
                    strokeWidth={2}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={!chartAnimated}
                    animationDuration={800}
                    onAnimationEnd={handleAnimationEnd}
                  />
                </LineChart>
              </ResponsiveContainer>
              {/* Custom overlay for scrub indicator */}
              {isScrubbingChart && selectedChartPoint && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${10 + ((chartData.findIndex(d => d.date === selectedChartPoint.date) / (chartData.length - 1)) * (100 - 5.5))}%`,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    backgroundColor: '#000',
                  }}
                >
                  <div
                    className="absolute w-4 h-4 bg-black rounded-full border-2 border-white"
                    style={{
                      left: -7,
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  />
                </div>
              )}
            </div>
            {/* Scrub hint */}
            <p className="text-center text-xs text-gray-300 mt-2">Drag to explore</p>
            {/* Level threshold legend */}
            {levelThresholds && (
              <div className="flex items-center justify-center gap-6 mt-3">
                {levelThresholds.currentLevelThreshold > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 border-t-2 border-dashed" style={{ borderColor: levelThresholds.currentLevelColor }} />
                    <span className="text-xs text-gray-500 capitalize">{levelThresholds.currentLevel}</span>
                  </div>
                )}
                {levelThresholds.nextThreshold && (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-0.5 border-t-2 border-dashed" style={{ borderColor: levelThresholds.nextLevelColor }} />
                    <span className="text-xs text-gray-500 capitalize">{levelThresholds.nextLevel}</span>
                  </div>
                )}
              </div>
            )}
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

        {/* 4. History - Collapsible with swipe actions */}
        <div className="pb-32">
          <div className="px-6">
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
            <p className="text-xs text-gray-300 -mt-1 mb-2">Swipe left on entry for options</p>
          </div>

          {historyExpanded && (
            <div className="mt-2">
              {exerciseEntries.map((entry) => {
                const oneRM = calculate1RM(entry.weight, entry.reps);
                const isPR = pr?.entryId === entry.id && entry.isActive !== false;
                const isInactive = entry.isActive === false;

                return (
                  <SwipeableEntry
                    key={entry.id}
                    onEdit={() => startEditingEntry(entry)}
                    onToggleActive={() => toggleEntryActive(entry.id)}
                    onDelete={() => deleteEntry(entry.id)}
                    isActive={!isInactive}
                  >
                    <div className={`flex items-center justify-between py-3 px-6 ${isInactive ? 'opacity-40' : ''}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${isInactive ? 'text-gray-400 line-through' : 'text-black'}`}>
                            {entry.weight}kg × {entry.reps}
                          </span>
                          {isPR && (
                            <span className="px-2 py-0.5 bg-[#00C805] text-white text-[10px] font-bold rounded-full">
                              PR
                            </span>
                          )}
                          {isInactive && (
                            <span className="px-2 py-0.5 bg-gray-300 text-gray-600 text-[10px] font-bold rounded-full">
                              EXCLUDED
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-400">{formatDate(entry.date)}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${isInactive ? 'text-gray-400' : 'text-black'}`}>
                          {Math.round(oneRM * 10) / 10}
                        </span>
                        <span className="text-sm text-gray-400 ml-1">1RM</span>
                      </div>
                    </div>
                  </SwipeableEntry>
                );
              })}
            </div>
          )}
        </div>

        {/* FAB to Log */}
        <button
          onClick={() => openLogView(selectedExercise)}
          className="fixed bottom-24 right-6 w-14 h-14 bg-black rounded-full flex items-center justify-center shadow-lg"
        >
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    );
  };

  // Profile display user (for non-editing mode)
  const profileDisplayUser = user;

  // Get current recommendation for log view
  const currentRecommendation = selectedExercise ? getRecommendation(selectedExercise) : null;

  // Handlers for log view
  const handleWeightChange = (v) => setCurrentSet((prev) => ({ ...prev, weight: v }));
  const handleRepsChange = (v) => setCurrentSet((prev) => ({ ...prev, reps: v }));
  const handleCloseLogView = () => {
    setShowLogView(false);
    setCurrentSet({ weight: 0, reps: 8 });
    setPendingSets([]);
    setEditingSetIndex(null);
    setSetsLoggedCount(0);
  };

  // Fullscreen Edit Entry View
  if (editingEntry && editedEntryData) {
    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-12 pb-4">
          <button
            onClick={cancelEditingEntry}
            className="text-gray-400 flex items-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-black">Edit Entry</h1>
          <button
            onClick={saveEntryChanges}
            className="text-[#00C805] font-semibold"
          >
            Save
          </button>
        </div>

        <div className="flex-1 px-6 py-4 space-y-6">
          {/* Weight */}
          <div>
            <label className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">Weight (kg)</label>
            <input
              type="number"
              value={editedEntryData.weight || ''}
              onChange={(e) => updateEditedEntryField('weight', parseFloat(e.target.value) || 0)}
              step="0.5"
              className="w-full mt-2 px-4 py-4 text-2xl font-bold text-black bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          {/* Reps */}
          <div>
            <label className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">Reps</label>
            <input
              type="number"
              value={editedEntryData.reps || ''}
              onChange={(e) => updateEditedEntryField('reps', parseInt(e.target.value) || 0)}
              className="w-full mt-2 px-4 py-4 text-2xl font-bold text-black bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          {/* Date */}
          <div>
            <label className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">Date</label>
            <input
              type="date"
              value={editedEntryData.date || ''}
              onChange={(e) => updateEditedEntryField('date', e.target.value)}
              className="w-full mt-2 px-4 py-4 text-lg font-medium text-black bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-black outline-none"
            />
          </div>

          {/* Calculated 1RM */}
          <div className="pt-4 border-t border-gray-100">
            <span className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">Calculated 1RM</span>
            <div className="flex items-baseline mt-2">
              <span className="text-4xl font-extrabold text-black">
                {Math.round(calculate1RM(editedEntryData.weight, editedEntryData.reps) * 10) / 10}
              </span>
              <span className="text-lg text-gray-400 ml-2">kg</span>
            </div>
          </div>
        </div>

        {/* Delete button at bottom */}
        <div className="px-6 pb-8">
          <button
            onClick={() => {
              deleteEntry(editedEntryData.id);
              cancelEditingEntry();
            }}
            className="w-full py-4 text-[#FF5200] font-medium"
          >
            Delete Entry
          </button>
        </div>
      </div>
    );
  }

  // Fullscreen Log View - Single screen with inline editing
  if (showLogView) {
    const totalSets = pendingSets.length + (currentSet.weight > 0 && currentSet.reps > 0 ? 1 : 0);
    const isEditing = editingSetIndex !== null;

    // Calculate Gap indicator values
    const currentOneRM = currentSet.weight > 0 && currentSet.reps > 0
      ? calculate1RM(currentSet.weight, currentSet.reps)
      : 0;
    const prOneRM = selectedExercise && personalRecords[selectedExercise]
      ? personalRecords[selectedExercise].oneRM
      : 0;
    const recommendedOneRM = currentRecommendation?.nextWorkout
      ? calculate1RM(currentRecommendation.nextWorkout.weight, currentRecommendation.nextWorkout.targetReps)
      : 0;

    // Determine gap indicator state
    const gapPercent = prOneRM > 0 ? ((currentOneRM - prOneRM) / prOneRM * 100) : 0;
    const isOnPlan = recommendedOneRM > 0 && Math.abs(currentOneRM - recommendedOneRM) < 0.5;
    const isGapUp = currentOneRM > prOneRM && prOneRM > 0;
    const isGapDown = currentOneRM < prOneRM && prOneRM > 0 && currentOneRM > 0;

    return (
      <div className="fixed inset-0 bg-white z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-12 pb-2 flex-shrink-0">
          <button
            onClick={handleCloseLogView}
            className="text-gray-400 flex items-center"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-black">{selectedExercise}</h1>
          <div className="w-6" />
        </div>

        {/* Pending sets list - no background, scrollable */}
        {pendingSets.length > 0 && (
          <div className="px-6 pt-2 max-h-[30vh] overflow-y-auto flex-shrink-0">
            <span className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">
              Sets ({pendingSets.length})
            </span>
            <div className="mt-2 space-y-1">
              {pendingSets.map((set, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between py-2 ${
                    editingSetIndex === index ? 'bg-black text-white px-3 rounded-xl -mx-3' : ''
                  }`}
                >
                  <button
                    onClick={() => editingSetIndex === index ? cancelEditSet() : editPendingSet(index)}
                    className="flex-1 text-left"
                  >
                    <span className={`font-semibold ${editingSetIndex === index ? 'text-white' : 'text-black'}`}>
                      Set {index + 1}:
                    </span>
                    <span className={`ml-2 ${editingSetIndex === index ? 'text-gray-300' : 'text-gray-500'}`}>
                      {set.weight}kg × {set.reps} reps
                    </span>
                  </button>
                  <button
                    onClick={() => removePendingSet(index)}
                    className="p-1 text-gray-400"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Gap Indicator + Add Set Row */}
        <div className="px-6 pb-3 flex-shrink-0">
          <div className="flex items-center justify-center gap-3">
            {/* Gap Indicator */}
            {currentOneRM > 0 && (
              <div className={`flex items-center gap-1.5 px-4 py-2 rounded-full ${
                isOnPlan
                  ? 'bg-gray-100 text-gray-500'
                  : isGapUp
                  ? 'bg-[#00C805]/10 text-[#00C805]'
                  : isGapDown
                  ? 'bg-[#FF5200]/10 text-[#FF5200]'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {isOnPlan ? (
                  <span className="text-sm font-semibold">On Plan</span>
                ) : isGapUp ? (
                  <>
                    <span className="text-base font-bold">▲</span>
                    <span className="text-sm font-semibold">+{gapPercent.toFixed(1)}%</span>
                  </>
                ) : isGapDown ? (
                  <>
                    <span className="text-base font-bold">▼</span>
                    <span className="text-sm font-semibold">{gapPercent.toFixed(1)}%</span>
                  </>
                ) : (
                  <span className="text-sm font-semibold">New PR</span>
                )}
              </div>
            )}

            {/* Add Set Button */}
            {!isEditing && (
              <button
                onClick={addSet}
                disabled={currentSet.weight <= 0 || currentSet.reps <= 0}
                className="flex items-center gap-1 px-4 py-2 border-2 border-gray-200 text-gray-600 font-semibold rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span>+ Add Set</span>
              </button>
            )}
          </div>
        </div>

        {/* Current set label */}
        <div className="px-6 pb-1 flex-shrink-0">
          <span className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">
            {isEditing ? `Editing Set ${editingSetIndex + 1}` : pendingSets.length > 0 ? `Set ${pendingSets.length + 1}` : 'Set 1'}
          </span>
        </div>

        {/* Compact weight and reps pickers */}
        <div className="flex flex-row px-6 py-2 items-center justify-center flex-shrink-0 gap-8">
          <ScrollNumberPicker
            value={currentSet.weight}
            onChange={handleWeightChange}
            min={0}
            max={500}
            step={2.5}
            suffix="kg"
            showDecimal={true}
            recommendedValue={currentRecommendation?.nextWorkout?.weight ?? null}
            compact={true}
          />
          <ScrollNumberPicker
            value={currentSet.reps}
            onChange={handleRepsChange}
            min={1}
            max={50}
            step={1}
            suffix="reps"
            showDecimal={false}
            recommendedValue={currentRecommendation?.nextWorkout?.targetReps ?? null}
            compact={true}
          />
        </div>

        {/* Action area - fixed at bottom */}
        <div className="px-6 pt-3 pb-8 flex-shrink-0">
          {isEditing ? (
            // Editing mode buttons
            <div className="flex gap-3">
              <button
                onClick={cancelEditSet}
                className="flex-1 h-14 border-2 border-gray-200 text-gray-600 text-lg font-semibold rounded-full"
              >
                Cancel
              </button>
              <button
                onClick={saveEditedSet}
                disabled={currentSet.weight <= 0 || currentSet.reps <= 0}
                className="flex-1 h-14 bg-black text-white text-lg font-semibold rounded-full disabled:opacity-30"
              >
                Save
              </button>
            </div>
          ) : (
            // Slide to log
            <SlideToLog
              onComplete={logAllSets}
              disabled={totalSets === 0}
              label={`Slide to Log ${totalSets > 0 ? `${totalSets} Set${totalSets > 1 ? 's' : ''}` : ''}`}
            />
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

      {/* Profile View - Inline to prevent re-renders */}
      {activeTab === 'profile' && (
        <div className="min-h-screen bg-white pb-24">
          <div className="px-6 pt-12 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Settings</span>
                <h1 className="text-4xl font-extrabold text-black mt-1">Profile</h1>
              </div>
              {!editingProfile ? (
                <button
                  onClick={startEditingProfile}
                  className="px-4 py-2 text-sm font-medium text-black border border-gray-200 rounded-full"
                >
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={cancelEditingProfile}
                    className="px-4 py-2 text-sm font-medium text-gray-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveProfileChanges}
                    className="px-4 py-2 text-sm font-medium text-white bg-black rounded-full"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          </div>

          {(editingProfile ? editedUser : profileDisplayUser) && (
            <div className="px-6">
              {/* Avatar & Name */}
              <div className="pb-6 border-b border-gray-100">
                <div className="flex items-center mb-6">
                  <img
                    src={(editingProfile ? editedUser : profileDisplayUser)?.avatar}
                    alt={(editingProfile ? editedUser : profileDisplayUser)?.name}
                    className="w-16 h-16 rounded-full object-cover"
                  />
                  {!editingProfile && (
                    <div className="ml-4">
                      <h2 className="text-xl font-bold text-black">{profileDisplayUser?.name}</h2>
                      <p className="text-gray-400">{profileDisplayUser?.email || 'No email'}</p>
                    </div>
                  )}
                </div>

                {editingProfile && editedUser && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">Name</label>
                      <input
                        type="text"
                        value={editedUser.name || ''}
                        onChange={(e) => updateEditedUserField('name', e.target.value)}
                        className="w-full mt-2 px-4 py-3 text-lg font-medium text-black bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-black outline-none"
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">Email</label>
                      <input
                        type="email"
                        value={editedUser.email || ''}
                        onChange={(e) => updateEditedUserField('email', e.target.value)}
                        className="w-full mt-2 px-4 py-3 text-lg font-medium text-black bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-black outline-none"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Body Stats */}
              <div className="py-6 border-b border-gray-100">
                <span className="text-xs uppercase tracking-[0.2em] text-gray-400">Body Stats</span>

                {!editingProfile ? (
                  <div className="grid grid-cols-3 gap-6 mt-4">
                    <div>
                      <span className="text-3xl font-extrabold text-black">{profileDisplayUser?.bodyweight}</span>
                      <span className="text-lg text-gray-400 ml-1">kg</span>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Weight</p>
                    </div>
                    <div>
                      <span className="text-3xl font-extrabold text-black">{profileDisplayUser?.age}</span>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Age</p>
                    </div>
                    <div>
                      <span className="text-3xl font-extrabold text-black">{profileDisplayUser?.sex === 'male' ? 'M' : 'F'}</span>
                      <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Sex</p>
                    </div>
                  </div>
                ) : editedUser && (
                  <div className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">Weight (kg)</label>
                        <input
                          type="number"
                          value={editedUser.bodyweight || ''}
                          onChange={(e) => updateEditedUserField('bodyweight', parseInt(e.target.value) || 0)}
                          className="w-full mt-2 px-4 py-3 text-lg font-medium text-black bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-black outline-none"
                          placeholder="75"
                        />
                      </div>
                      <div>
                        <label className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">Age</label>
                        <input
                          type="number"
                          value={editedUser.age || ''}
                          onChange={(e) => updateEditedUserField('age', parseInt(e.target.value) || 0)}
                          className="w-full mt-2 px-4 py-3 text-lg font-medium text-black bg-gray-50 rounded-xl border-0 focus:ring-2 focus:ring-black outline-none"
                          placeholder="30"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs uppercase tracking-[0.15em] text-gray-400 font-medium">Sex</label>
                      <div className="flex gap-3 mt-2">
                        <button
                          onClick={() => updateEditedUserField('sex', 'male')}
                          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
                            editedUser.sex === 'male'
                              ? 'bg-black text-white'
                              : 'bg-gray-50 text-gray-500'
                          }`}
                        >
                          Male
                        </button>
                        <button
                          onClick={() => updateEditedUserField('sex', 'female')}
                          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
                            editedUser.sex === 'female'
                              ? 'bg-black text-white'
                              : 'bg-gray-50 text-gray-500'
                          }`}
                        >
                          Female
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Workout Stats - Read only */}
              <div className="py-6 border-b border-gray-100">
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
              <div className="py-6">
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
      )}

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
