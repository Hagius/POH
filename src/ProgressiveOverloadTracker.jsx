import React, { useState, useMemo, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { getUser, getEntries, saveEntries, saveUser, resetDemo } from './lib/userStore';
import {
  getStrengthThresholds,
  getStrengthLevel,
  getLevelInfo,
  LEVEL_COLORS,
} from './lib/strengthStandards';
import {
  getNextWorkoutRecommendation,
  getExerciseConfig,
} from './lib/progression';

const COMMON_EXERCISES = [
  'Squat',
  'Deadlift',
  'Bench Press',
  'Overhead Press',
  'Barbell Row',
];

// Epley formula: 1RM = weight × (1 + reps/30)
const calculate1RM = (weight, reps) => {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
};

// Reverse Epley: calculate reps for a given weight and target 1RM
const calculateRepsFor1RM = (targetWeight, target1RM) => {
  if (targetWeight <= 0 || target1RM <= 0) return null;
  if (targetWeight >= target1RM) return 1;
  const reps = 30 * (target1RM / targetWeight - 1);
  return Math.max(1, Math.min(30, Math.round(reps)));
};

// Reverse Epley: calculate weight for given reps and target 1RM
const calculateWeightFor1RM = (targetReps, target1RM) => {
  if (targetReps <= 0 || target1RM <= 0) return null;
  const weight = target1RM / (1 + targetReps / 30);
  return Math.round(weight * 2) / 2; // Round to nearest 0.5kg
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

// Level Badge Component
const LevelBadge = ({ level, size = 'md' }) => {
  const info = getLevelInfo(level);
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };

  return (
    <span
      className={`${sizeClasses[size]} font-bold rounded`}
      style={{ backgroundColor: info.fill, color: '#1a1a2e' }}
    >
      {info.label}
    </span>
  );
};

export default function ProgressiveOverloadTracker() {
  const [entries, setEntries] = useState([]);
  const [activeTab, setActiveTab] = useState('add');
  const [flashingEntryId, setFlashingEntryId] = useState(null);
  const [user, setUser] = useState(null);
  const [selectedExercise, setSelectedExercise] = useState(null);
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

  // Workout session state for multi-exercise, set-by-set logging
  const [workoutSession, setWorkoutSession] = useState({
    date: new Date().toISOString().split('T')[0],
    exercises: [],
  });
  const [currentExerciseInput, setCurrentExerciseInput] = useState({
    name: '',
    customName: '',
    useCustom: false,
  });

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

  // Set default selected exercise when entries load
  const exerciseNames = useMemo(() => [...new Set(entries.map((e) => e.name))], [entries]);

  useEffect(() => {
    if (exerciseNames.length > 0 && !selectedExercise) {
      setSelectedExercise(exerciseNames[0]);
    }
  }, [exerciseNames, selectedExercise]);

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

  // Get strength thresholds for selected exercise
  const strengthThresholds = useMemo(() => {
    if (!user || !selectedExercise) return null;
    return getStrengthThresholds(selectedExercise, user.sex, user.bodyweight, user.age);
  }, [user, selectedExercise]);

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

  // Prepare chart data for selected exercise only
  const chartData = useMemo(() => {
    if (!selectedExercise) return [];

    const exerciseEntries = entries.filter((e) => e.name === selectedExercise);
    const dateMap = {};

    exerciseEntries.forEach((entry) => {
      const dateKey = entry.date;
      const oneRM = calculate1RM(entry.weight, entry.reps);
      if (!dateMap[dateKey] || oneRM > dateMap[dateKey].oneRM) {
        dateMap[dateKey] = { date: dateKey, oneRM: Math.round(oneRM * 10) / 10 };
      }
    });

    return Object.values(dateMap).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [entries, selectedExercise]);

  // Calculate workout recommendation for selected exercise in form
  const workoutRecommendation = useMemo(() => {
    const exerciseName = useCustomName ? formData.customName.trim() : formData.name;
    if (!exerciseName) return null;

    // Get history for this exercise (most recent first)
    const exerciseHistory = entries
      .filter((e) => e.name === exerciseName)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (exerciseHistory.length === 0) return null;

    // Use the most recent workout as current performance
    const lastWorkout = exerciseHistory[0];
    const recommendation = getNextWorkoutRecommendation(
      { weight: lastWorkout.weight, reps: lastWorkout.reps, sets: lastWorkout.sets },
      exerciseName,
      exerciseHistory.slice(1) // Exclude the most recent one (used as "current")
    );

    return recommendation;
  }, [entries, formData.name, formData.customName, useCustomName]);

  // Calculate Y-axis domain for chart
  const yAxisDomain = useMemo(() => {
    if (!strengthThresholds || chartData.length === 0) return [0, 100];

    const maxDataValue = Math.max(...chartData.map((d) => d.oneRM));
    const maxThreshold = strengthThresholds.professional * 1.1;
    const max = Math.max(maxDataValue, maxThreshold);
    const min = 0;

    return [min, Math.ceil(max / 10) * 10];
  }, [strengthThresholds, chartData]);

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

  const updateUserStats = (field, value) => {
    if (!user) return;
    const updatedUser = { ...user, [field]: value };
    setUser(updatedUser);
    saveUser(updatedUser);
  };

  // Get recommendation for a specific exercise
  const getRecommendationForExercise = (exerciseName) => {
    if (!exerciseName) return null;

    const exerciseHistory = entries
      .filter((e) => e.name === exerciseName)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (exerciseHistory.length === 0) return null;

    const lastWorkout = exerciseHistory[0];
    return getNextWorkoutRecommendation(
      { weight: lastWorkout.weight, reps: lastWorkout.reps, sets: lastWorkout.sets },
      exerciseName,
      exerciseHistory.slice(1)
    );
  };

  // Add exercise to workout session
  const addExerciseToSession = () => {
    const exerciseName = currentExerciseInput.useCustom
      ? currentExerciseInput.customName.trim()
      : currentExerciseInput.name;

    if (!exerciseName) return;

    const recommendation = getRecommendationForExercise(exerciseName);
    const config = getExerciseConfig(exerciseName);

    // Create initial sets based on recommendation or defaults
    const targetSets = recommendation?.nextWorkout?.sets || 3;
    const targetWeight = recommendation?.nextWorkout?.weight || '';
    const targetReps = recommendation?.nextWorkout?.targetReps || config.repRange.min;
    const target1RM = targetWeight && targetReps ? calculate1RM(targetWeight, targetReps) : null;

    const initialSets = Array.from({ length: targetSets }, (_, i) => ({
      id: generateId(),
      weight: targetWeight.toString(),
      reps: '',
      targetReps: targetReps,
      target1RM: target1RM,
      completed: false,
    }));

    const newExercise = {
      id: generateId(),
      name: exerciseName,
      sets: initialSets,
      recommendation: recommendation,
      config: config,
    };

    setWorkoutSession((prev) => ({
      ...prev,
      exercises: [...prev.exercises, newExercise],
    }));

    // Reset input
    setCurrentExerciseInput({ name: '', customName: '', useCustom: false });
  };

  // Remove exercise from session
  const removeExerciseFromSession = (exerciseId) => {
    setWorkoutSession((prev) => ({
      ...prev,
      exercises: prev.exercises.filter((e) => e.id !== exerciseId),
    }));
  };

  // Update a set within an exercise
  const updateSet = (exerciseId, setId, field, value) => {
    setWorkoutSession((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        return {
          ...exercise,
          sets: exercise.sets.map((set) => {
            if (set.id !== setId) return set;

            const updatedSet = { ...set, [field]: value };

            // Auto-calculate if we have a target1RM
            if (set.target1RM && field === 'weight' && value) {
              const weight = parseFloat(value);
              if (!isNaN(weight) && weight > 0) {
                const calculatedReps = calculateRepsFor1RM(weight, set.target1RM);
                if (calculatedReps) {
                  updatedSet.targetReps = calculatedReps;
                }
              }
            } else if (set.target1RM && field === 'reps' && value) {
              const reps = parseInt(value, 10);
              if (!isNaN(reps) && reps > 0) {
                const calculatedWeight = calculateWeightFor1RM(reps, set.target1RM);
                if (calculatedWeight && !set.weight) {
                  updatedSet.weight = calculatedWeight.toString();
                }
              }
            }

            return updatedSet;
          }),
        };
      }),
    }));
  };

  // Add a new set to an exercise
  const addSetToExercise = (exerciseId) => {
    setWorkoutSession((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;

        const lastSet = exercise.sets[exercise.sets.length - 1];
        const newSet = {
          id: generateId(),
          weight: lastSet?.weight || '',
          reps: '',
          targetReps: lastSet?.targetReps || exercise.config.repRange.min,
          target1RM: lastSet?.target1RM || null,
          completed: false,
        };

        return {
          ...exercise,
          sets: [...exercise.sets, newSet],
        };
      }),
    }));
  };

  // Remove a set from an exercise
  const removeSetFromExercise = (exerciseId, setId) => {
    setWorkoutSession((prev) => ({
      ...prev,
      exercises: prev.exercises.map((exercise) => {
        if (exercise.id !== exerciseId) return exercise;
        if (exercise.sets.length <= 1) return exercise; // Keep at least one set

        return {
          ...exercise,
          sets: exercise.sets.filter((s) => s.id !== setId),
        };
      }),
    }));
  };

  // Save entire workout session
  const saveWorkoutSession = () => {
    const newEntries = [];
    let hasNewPR = false;
    let newPREntryId = null;

    workoutSession.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        const weight = parseFloat(set.weight);
        const reps = parseInt(set.reps, 10);

        if (!isNaN(weight) && weight > 0 && !isNaN(reps) && reps > 0) {
          const oneRM = calculate1RM(weight, reps);
          const currentPR = personalRecords[exercise.name];
          const isNewPR = !currentPR || oneRM > currentPR.oneRM;

          const entry = {
            id: generateId(),
            name: exercise.name,
            date: workoutSession.date,
            weight,
            reps,
            sets: 1, // Each set is stored individually
          };

          newEntries.push(entry);

          if (isNewPR && (!hasNewPR || oneRM > calculate1RM(
            newEntries.find(e => e.id === newPREntryId)?.weight || 0,
            newEntries.find(e => e.id === newPREntryId)?.reps || 1
          ))) {
            hasNewPR = true;
            newPREntryId = entry.id;
          }
        }
      });
    });

    if (newEntries.length === 0) return;

    setEntries((prev) => [...prev, ...newEntries]);

    if (hasNewPR) {
      setFlashingEntryId(newPREntryId);
      setActiveTab('achievements');
      setTimeout(() => setFlashingEntryId(null), 2000);
    }

    // Reset session
    setWorkoutSession({
      date: new Date().toISOString().split('T')[0],
      exercises: [],
    });
  };

  // Progress View
  const ProgressView = () => {
    const selectedEntries = groupedEntries[selectedExercise] || [];
    const currentPR = personalRecords[selectedExercise];
    const currentLevel = currentPR && strengthThresholds
      ? getStrengthLevel(currentPR.oneRM, strengthThresholds)
      : null;

    return (
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
            {/* Exercise Selector */}
            <div className="bg-[#16213e] rounded-lg p-4 border border-[#0f3460]">
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Select Exercise
              </label>
              <div className="flex flex-wrap gap-2">
                {exerciseNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setSelectedExercise(name)}
                    className={`px-4 py-2 rounded-md font-medium transition-colors ${
                      selectedExercise === name
                        ? 'bg-[#FFD700] text-[#1a1a2e]'
                        : 'bg-[#1a1a2e] text-gray-300 hover:bg-[#0f3460]'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Current Level Display */}
            {currentPR && strengthThresholds && (
              <div className="bg-[#16213e] rounded-lg p-4 border border-[#0f3460]">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-gray-400">Current Level</div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-2xl font-bold text-white">
                        {Math.round(currentPR.oneRM * 10) / 10} kg
                      </span>
                      <LevelBadge level={currentLevel} size="lg" />
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-400">
                    <div>{user?.sex === 'male' ? '♂' : '♀'} {user?.bodyweight} kg</div>
                    <div>Age {user?.age}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Chart with Level Areas */}
            <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
              <h3 className="text-lg font-semibold mb-4 text-white">
                {selectedExercise} - 1RM Progression
              </h3>

              {/* Level Legend */}
              <div className="flex flex-wrap gap-3 mb-4">
                {Object.entries(LEVEL_COLORS).map(([level, info]) => (
                  <div key={level} className="flex items-center gap-1.5 text-xs">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: info.fill }}
                    />
                    <span className="text-gray-400">
                      {info.label}
                      {strengthThresholds && (
                        <span className="text-gray-500 ml-1">
                          ({level === 'beginner' ? '0' : strengthThresholds[level === 'intermediate' ? 'beginner' : level === 'advanced' ? 'intermediate' : 'advanced']}-{strengthThresholds[level]}kg)
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    {/* Level Reference Areas */}
                    {strengthThresholds && (
                      <>
                        <ReferenceArea
                          y1={0}
                          y2={strengthThresholds.beginner}
                          fill={LEVEL_COLORS.beginner.fill}
                          fillOpacity={0.15}
                        />
                        <ReferenceArea
                          y1={strengthThresholds.beginner}
                          y2={strengthThresholds.intermediate}
                          fill={LEVEL_COLORS.intermediate.fill}
                          fillOpacity={0.15}
                        />
                        <ReferenceArea
                          y1={strengthThresholds.intermediate}
                          y2={strengthThresholds.advanced}
                          fill={LEVEL_COLORS.advanced.fill}
                          fillOpacity={0.15}
                        />
                        <ReferenceArea
                          y1={strengthThresholds.advanced}
                          y2={yAxisDomain[1]}
                          fill={LEVEL_COLORS.professional.fill}
                          fillOpacity={0.15}
                        />
                        {/* Level threshold lines */}
                        <ReferenceLine
                          y={strengthThresholds.beginner}
                          stroke={LEVEL_COLORS.beginner.stroke}
                          strokeDasharray="3 3"
                          strokeOpacity={0.5}
                        />
                        <ReferenceLine
                          y={strengthThresholds.intermediate}
                          stroke={LEVEL_COLORS.intermediate.stroke}
                          strokeDasharray="3 3"
                          strokeOpacity={0.5}
                        />
                        <ReferenceLine
                          y={strengthThresholds.advanced}
                          stroke={LEVEL_COLORS.advanced.stroke}
                          strokeDasharray="3 3"
                          strokeOpacity={0.5}
                        />
                      </>
                    )}
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
                      domain={yAxisDomain}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#16213e',
                        border: '1px solid #0f3460',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      labelFormatter={formatDate}
                      formatter={(value) => {
                        const level = strengthThresholds
                          ? getStrengthLevel(value, strengthThresholds)
                          : null;
                        const levelInfo = level ? getLevelInfo(level) : null;
                        return [
                          <span key="value">
                            {value} kg
                            {levelInfo && (
                              <span
                                style={{
                                  marginLeft: '8px',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  backgroundColor: levelInfo.fill,
                                  color: '#1a1a2e',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                }}
                              >
                                {levelInfo.label}
                              </span>
                            )}
                          </span>,
                          '1RM',
                        ];
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="oneRM"
                      stroke="#FFD700"
                      strokeWidth={3}
                      dot={{ fill: '#FFD700', r: 5, strokeWidth: 2, stroke: '#1a1a2e' }}
                      activeDot={{ r: 8, stroke: '#FFD700', strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Exercise History for selected exercise */}
            <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
              <h3 className="text-lg font-semibold mb-4 text-white">
                {selectedExercise} History
              </h3>
              <div className="space-y-2">
                {selectedEntries.map((entry) => {
                  const oneRM = calculate1RM(entry.weight, entry.reps);
                  const isPR = personalRecords[entry.name]?.entryId === entry.id;
                  const level = strengthThresholds
                    ? getStrengthLevel(oneRM, strengthThresholds)
                    : null;

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
                        {level && <LevelBadge level={level} size="sm" />}
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
          </>
        )}
      </div>
    );
  };

  // Add Workout View - Redesigned for multi-exercise, set-by-set logging
  const AddWorkoutView = () => {
    const totalSetsLogged = workoutSession.exercises.reduce(
      (acc, ex) => acc + ex.sets.filter((s) => s.weight && s.reps).length,
      0
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">Log Workout</h2>
          {/* Date picker */}
          <input
            type="date"
            value={workoutSession.date}
            onChange={(e) =>
              setWorkoutSession((prev) => ({ ...prev, date: e.target.value }))
            }
            className="bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
          />
        </div>

        {/* Add Exercise Section */}
        <div className="bg-[#16213e] rounded-lg p-4 border border-[#0f3460]">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Add Exercise to Workout
          </label>
          <div className="flex gap-2">
            {!currentExerciseInput.useCustom ? (
              <select
                value={currentExerciseInput.name}
                onChange={(e) => {
                  if (e.target.value === 'custom') {
                    setCurrentExerciseInput((prev) => ({ ...prev, useCustom: true, name: '' }));
                  } else {
                    setCurrentExerciseInput((prev) => ({ ...prev, name: e.target.value }));
                  }
                }}
                className="flex-1 bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
              >
                <option value="">Select exercise...</option>
                {COMMON_EXERCISES.map((exercise) => (
                  <option key={exercise} value={exercise}>
                    {exercise}
                  </option>
                ))}
                <option value="custom">+ Custom exercise</option>
              </select>
            ) : (
              <input
                type="text"
                value={currentExerciseInput.customName}
                onChange={(e) =>
                  setCurrentExerciseInput((prev) => ({ ...prev, customName: e.target.value }))
                }
                placeholder="Exercise name..."
                className="flex-1 bg-[#1a1a2e] border border-[#0f3460] rounded-md px-3 py-3 text-white focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                autoFocus
              />
            )}
            {currentExerciseInput.useCustom && (
              <button
                type="button"
                onClick={() =>
                  setCurrentExerciseInput({ name: '', customName: '', useCustom: false })
                }
                className="px-3 py-3 bg-[#0f3460] rounded-md text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              onClick={addExerciseToSession}
              disabled={
                !currentExerciseInput.name && !currentExerciseInput.customName.trim()
              }
              className="px-4 py-3 bg-[#FFD700] text-[#1a1a2e] font-semibold rounded-md hover:bg-[#e6c200] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>
        </div>

        {/* Exercise Cards */}
        {workoutSession.exercises.map((exercise) => (
          <div
            key={exercise.id}
            className="bg-[#16213e] rounded-lg border border-[#0f3460] overflow-hidden"
          >
            {/* Exercise Header */}
            <div className="px-4 py-3 bg-[#0f3460]/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-white text-lg">{exercise.name}</h3>
                {exercise.recommendation && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-medium ${
                      exercise.recommendation.status === 'deload'
                        ? 'bg-orange-500/20 text-orange-400'
                        : exercise.recommendation.status === 'double_jump'
                          ? 'bg-green-500/20 text-green-400'
                          : exercise.recommendation.status === 'progress'
                            ? 'bg-[#FFD700]/20 text-[#FFD700]'
                            : 'bg-[#1a1a2e] text-gray-400'
                    }`}
                  >
                    {exercise.recommendation.status === 'deload' && 'Deload'}
                    {exercise.recommendation.status === 'double_jump' && 'Double Jump!'}
                    {exercise.recommendation.status === 'progress' && 'Progress'}
                    {exercise.recommendation.status === 'maintain' && 'Build Reps'}
                    {exercise.recommendation.status === 'struggle' && 'Keep Pushing'}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeExerciseFromSession(exercise.id)}
                className="p-1.5 rounded hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Recommendation Info */}
            {exercise.recommendation && (
              <div className="px-4 py-2 bg-[#0f3460]/30 border-b border-[#0f3460]">
                <p className="text-xs text-gray-400">
                  <span className="text-gray-300">Target:</span>{' '}
                  {exercise.recommendation.nextWorkout.weight}kg × {exercise.recommendation.nextWorkout.targetReps} reps
                  <span className="text-gray-500 ml-2">|</span>
                  <span className="text-gray-500 ml-2">{exercise.recommendation.message}</span>
                </p>
              </div>
            )}

            {/* Sets */}
            <div className="p-4 space-y-2">
              {/* Header Row */}
              <div className="grid grid-cols-12 gap-2 px-2 text-xs text-gray-500 font-medium">
                <div className="col-span-1">Set</div>
                <div className="col-span-4">Weight (kg)</div>
                <div className="col-span-3">Target</div>
                <div className="col-span-3">Reps</div>
                <div className="col-span-1"></div>
              </div>

              {exercise.sets.map((set, setIndex) => (
                <div
                  key={set.id}
                  className="grid grid-cols-12 gap-2 items-center bg-[#1a1a2e] rounded-md p-2"
                >
                  {/* Set Number */}
                  <div className="col-span-1 text-center">
                    <span className="text-gray-400 font-medium">{setIndex + 1}</span>
                  </div>

                  {/* Weight Input */}
                  <div className="col-span-4">
                    <input
                      type="number"
                      step="0.5"
                      value={set.weight}
                      onChange={(e) => updateSet(exercise.id, set.id, 'weight', e.target.value)}
                      placeholder={exercise.recommendation?.nextWorkout?.weight?.toString() || '0'}
                      className="w-full bg-[#0f3460] border border-[#0f3460] rounded px-2 py-2 text-white text-center focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-transparent"
                    />
                  </div>

                  {/* Target Reps Display */}
                  <div className="col-span-3 text-center">
                    <span className="text-[#FFD700] font-medium">
                      {set.targetReps ? `→ ${set.targetReps}` : '-'}
                    </span>
                  </div>

                  {/* Actual Reps Input */}
                  <div className="col-span-3">
                    <input
                      type="number"
                      value={set.reps}
                      onChange={(e) => updateSet(exercise.id, set.id, 'reps', e.target.value)}
                      placeholder={set.targetReps?.toString() || '0'}
                      className={`w-full bg-[#0f3460] border rounded px-2 py-2 text-center focus:outline-none focus:ring-2 focus:ring-[#FFD700] ${
                        set.reps && set.targetReps
                          ? parseInt(set.reps, 10) >= set.targetReps
                            ? 'border-green-500/50 text-green-400'
                            : 'border-orange-500/50 text-orange-400'
                          : 'border-[#0f3460] text-white'
                      }`}
                    />
                  </div>

                  {/* Delete Set */}
                  <div className="col-span-1 text-center">
                    {exercise.sets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSetFromExercise(exercise.id, set.id)}
                        className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Set Button */}
              <button
                type="button"
                onClick={() => addSetToExercise(exercise.id)}
                className="w-full py-2 border border-dashed border-[#0f3460] rounded-md text-gray-400 hover:text-white hover:border-[#FFD700] transition-colors text-sm"
              >
                + Add Set
              </button>
            </div>
          </div>
        ))}

        {/* Empty State */}
        {workoutSession.exercises.length === 0 && (
          <div className="bg-[#16213e] rounded-lg p-8 border border-[#0f3460] text-center">
            <div className="text-4xl mb-3">🏋️</div>
            <h3 className="text-lg font-semibold text-white mb-1">Start Your Workout</h3>
            <p className="text-gray-400 text-sm">
              Add exercises above to begin logging your sets
            </p>
          </div>
        )}

        {/* Save Workout Button */}
        {workoutSession.exercises.length > 0 && (
          <button
            type="button"
            onClick={saveWorkoutSession}
            disabled={totalSetsLogged === 0}
            className="w-full bg-[#FFD700] text-[#1a1a2e] font-bold py-4 rounded-md hover:bg-[#e6c200] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg"
          >
            Save Workout ({totalSetsLogged} sets logged)
          </button>
        )}

        {/* Quick Stats */}
        {entries.length > 0 && (
          <div className="bg-[#16213e] rounded-lg p-4 border border-[#0f3460]">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1a1a2e] rounded-md p-3 text-center">
                <div className="text-2xl font-bold text-[#FFD700]">{entries.length}</div>
                <div className="text-xs text-gray-400">Total Sets Logged</div>
              </div>
              <div className="bg-[#1a1a2e] rounded-md p-3 text-center">
                <div className="text-2xl font-bold text-[#FFD700]">{exerciseNames.length}</div>
                <div className="text-xs text-gray-400">Exercises Tracked</div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

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
          {/* PR Summary with Levels */}
          <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <h3 className="text-lg font-semibold mb-4 text-white flex items-center gap-2">
              <span>🏆</span> Personal Records
            </h3>
            <div className="space-y-3">
              {Object.entries(personalRecords).map(([exercise, data]) => {
                const isFlashing = flashingEntryId === data.entryId;
                const thresholds = user
                  ? getStrengthThresholds(exercise, user.sex, user.bodyweight, user.age)
                  : null;
                const level = thresholds ? getStrengthLevel(data.oneRM, thresholds) : null;

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
                        {level && !isFlashing && (
                          <div className="mt-2">
                            <LevelBadge level={level} size="md" />
                          </div>
                        )}
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

          {/* Level Legend */}
          <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <h3 className="text-lg font-semibold mb-4 text-white">Strength Levels</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(LEVEL_COLORS).map(([level, info]) => (
                <div
                  key={level}
                  className="flex items-center gap-3 p-3 rounded-md bg-[#1a1a2e]"
                >
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: info.fill }}
                  />
                  <span className="text-white font-medium">{info.label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-4">
              Levels based on {user?.sex === 'male' ? 'male' : 'female'} standards,
              {' '}{user?.bodyweight}kg bodyweight, age {user?.age}
            </p>
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

          {/* Physical Stats - Editable */}
          <div className="bg-[#16213e] rounded-lg p-6 border border-[#0f3460]">
            <h3 className="text-lg font-semibold mb-4 text-white">Physical Stats</h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Sex Toggle */}
              <div className="bg-[#1a1a2e] rounded-md p-3">
                <label className="block text-xs text-gray-400 text-center mb-2">Sex</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => updateUserStats('sex', 'male')}
                    className={`flex-1 py-2 rounded text-xl font-bold transition-colors ${
                      user.sex === 'male'
                        ? 'bg-[#FFD700] text-[#1a1a2e]'
                        : 'bg-[#0f3460] text-gray-400 hover:bg-[#16213e]'
                    }`}
                  >
                    ♂
                  </button>
                  <button
                    onClick={() => updateUserStats('sex', 'female')}
                    className={`flex-1 py-2 rounded text-xl font-bold transition-colors ${
                      user.sex === 'female'
                        ? 'bg-[#FFD700] text-[#1a1a2e]'
                        : 'bg-[#0f3460] text-gray-400 hover:bg-[#16213e]'
                    }`}
                  >
                    ♀
                  </button>
                </div>
              </div>
              {/* Age Input */}
              <div className="bg-[#1a1a2e] rounded-md p-3">
                <label className="block text-xs text-gray-400 text-center mb-2">Age</label>
                <input
                  type="number"
                  value={user.age}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 13 && val <= 100) {
                      updateUserStats('age', val);
                    }
                  }}
                  min="13"
                  max="100"
                  className="w-full bg-[#0f3460] border-none rounded px-2 py-2 text-white text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                />
              </div>
              {/* Bodyweight Input */}
              <div className="bg-[#1a1a2e] rounded-md p-3">
                <label className="block text-xs text-gray-400 text-center mb-2">Weight (kg)</label>
                <input
                  type="number"
                  value={user.bodyweight}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 30 && val <= 200) {
                      updateUserStats('bodyweight', val);
                    }
                  }}
                  min="30"
                  max="200"
                  className="w-full bg-[#0f3460] border-none rounded px-2 py-2 text-white text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#FFD700]"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-4 text-center">
              Adjust these to calculate your personalized strength levels
            </p>
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
