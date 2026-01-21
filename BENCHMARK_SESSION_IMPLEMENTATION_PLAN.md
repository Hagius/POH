# Benchmark Session Implementation Plan

## 🎯 Overview

Transform the first session experience from a guessing game into an exciting calibration phase that motivates users and establishes accurate baselines for progressive overload.

---

## 📋 Implementation Phases

### Phase 1: Backend - Recommendation Engine Updates

#### 1.1 Update First Session Detection (recommendation-engine.js)

**Location:** `/home/user/POH/src/lib/recommendation-engine.js:490-520`

**Current Code:**
```javascript
if (activeHistory.length === 0) {
  flags.push('first_session_calibration');

  return {
    prescription: {
      sets: 3,
      reps: '8-10',
      weight_kg: null,  // ❌ No guidance
      rest_seconds: '120',
      rir_target: 3
    },
    // ...
  };
}
```

**New Code:**
```javascript
if (activeHistory.length === 0) {
  flags.push('benchmark_mode');

  return {
    benchmark_mode: true,  // 🔑 Key flag
    prescription: {
      sets: '3-5',  // Range instead of fixed
      reps: '5-12',  // Wider range for exploration
      weight_kg: null,
      rest_seconds: '90-120',  // Flexible rest
      rir_target: 3,  // Conservative
      benchmark_instructions: {
        title: 'Benchmark Session',
        subtitle: 'Find Your Starting Point',
        instructions: [
          'Start with a comfortable weight you can lift 8-10 times',
          'Perform 3-5 sets, adjusting weight each set',
          'Try to reach near-failure (1-2 reps left in tank)',
          'Your best set will become your baseline'
        ]
      }
    },
    intensity_percent: null,
    calculated_e1rm_kg: 0,
    training_status: 'benchmark_mode',
    progression_rationale: 'This is your benchmark session! Explore different weights to establish your baseline. Your strongest set will be used as your starting point.',
    flags: ['benchmark_mode'],
    reasoning_breakdown: {
      last_session: 'No previous data - benchmark mode activated',
      trend: 'Establishing baseline',
      next_step: 'Complete 3-5 sets at varying weights to find your working load',
      calculation: 'Your highest e1RM from all sets will be used as your baseline'
    }
  };
}
```

**Why:**
- Explicit `benchmark_mode` flag for UI detection
- More flexible prescription (3-5 sets, wide rep range)
- Clear instructions embedded in the recommendation
- Sets proper expectations

---

#### 1.2 Add Benchmark Session Analysis Logic

**Location:** Add new function after `getHighestE1RMInRange` (around line 252)

```javascript
/**
 * Analyzes a benchmark session (first session only) to extract the best performance
 * @param {Array} sessionHistory - All entries from the first session date
 * @param {string} exerciseName - Name of the exercise
 * @returns {Object} - Benchmark analysis results
 */
function analyzeBenchmarkSession(sessionHistory, exerciseName) {
  if (!sessionHistory || sessionHistory.length === 0) {
    return {
      benchmarkCompleted: false,
      highestE1RM: 0,
      bestSet: null,
      totalSets: 0
    };
  }

  const exerciseConfig = EXERCISE_CONFIG[exerciseName] || EXERCISE_CONFIG['Default'];

  // Calculate e1RM for each set
  const setsWithE1RM = sessionHistory.map(entry => ({
    ...entry,
    e1rm: calculateE1RM(entry.weight, entry.reps, entry.rir)
  }));

  // Find the best set
  const bestSet = setsWithE1RM.reduce((best, current) =>
    current.e1rm > best.e1rm ? current : best
  );

  // Apply exercise-specific e1RM modifier
  const adjustedE1RM = bestSet.e1rm * exerciseConfig.e1rm_modifier;

  return {
    benchmarkCompleted: true,
    highestE1RM: adjustedE1RM,
    bestSet: {
      weight: bestSet.weight,
      reps: bestSet.reps,
      rir: bestSet.rir,
      e1rm: adjustedE1RM
    },
    totalSets: sessionHistory.length,
    allSets: setsWithE1RM.map(s => ({
      weight: s.weight,
      reps: s.reps,
      rir: s.rir,
      e1rm: s.e1rm
    }))
  };
}
```

**Why:**
- Dedicated function for benchmark analysis
- Calculates e1RM for ALL sets in first session
- Returns comprehensive data for UI display
- Applies exercise-specific modifiers correctly

---

#### 1.3 Update Progression Logic for Post-Benchmark (Second Session)

**Location:** After first session check (around line 520)

```javascript
// Check if this is the second session (benchmark just completed)
if (sessionCount === 1) {
  // User has completed benchmark, now transitioning to progressive training
  const benchmarkDate = allDates[0];
  const benchmarkHistory = activeHistory.filter(e => e.date === benchmarkDate);
  const benchmarkAnalysis = analyzeBenchmarkSession(benchmarkHistory, exerciseName);

  if (!benchmarkAnalysis.benchmarkCompleted) {
    // Fallback if benchmark analysis fails
    flags.push('benchmark_analysis_failed');
    return {
      prescription: {
        sets: 3,
        reps: '8-10',
        weight_kg: null,
        rest_seconds: '120',
        rir_target: 3
      },
      training_status: 'insufficient_data',
      progression_rationale: 'Unable to analyze benchmark session. Please ensure you logged at least one set with weight and reps.',
      flags
    };
  }

  flags.push('post_benchmark_first_prescription');

  // Use benchmark e1RM as baseline
  const baselineE1RM = benchmarkAnalysis.highestE1RM;
  const targetIntensity = (phaseConfig.intensity_min + phaseConfig.intensity_max) / 2;
  const targetWeight = baselineE1RM * (targetIntensity / 100);
  const prescribedWeight = roundToIncrement(targetWeight, exerciseConfig.load_increment);
  const targetReps = Math.floor((phaseConfig.rep_min + phaseConfig.rep_max) / 2);

  return {
    benchmark_mode: false,
    benchmark_baseline: {
      e1rm: benchmarkAnalysis.highestE1RM,
      bestSet: benchmarkAnalysis.bestSet,
      sessionDate: benchmarkDate
    },
    prescription: {
      sets: adjustSetsForAge(phaseConfig.sets, userAge),
      reps: `${phaseConfig.rep_min}-${phaseConfig.rep_max}`,
      target_reps: targetReps,
      weight_kg: prescribedWeight,
      rest_seconds: `${phaseConfig.rest_min}-${phaseConfig.rest_max}`,
      rir_target: phaseConfig.rir_target
    },
    intensity_percent: Math.round(targetIntensity),
    calculated_e1rm_kg: baselineE1RM,
    training_status: 'progressive',
    progression_rationale: `Benchmark complete! Your baseline: ${Math.round(baselineE1RM)}kg e1RM. Starting ${phase} training at ${Math.round(targetIntensity)}% intensity.`,
    flags,
    reasoning_breakdown: {
      last_session: `Benchmark: ${benchmarkAnalysis.bestSet.weight}kg × ${benchmarkAnalysis.bestSet.reps} reps`,
      trend: 'Baseline established',
      next_step: `Progressive training begins at ${prescribedWeight}kg`,
      calculation: `${Math.round(targetIntensity)}% of ${Math.round(baselineE1RM)}kg e1RM = ${prescribedWeight}kg`
    }
  };
}
```

**Why:**
- Detects when user has completed exactly one session (the benchmark)
- Analyzes all sets from that benchmark session
- Uses highest e1RM as the baseline
- Generates first "real" prescription based on training phase
- Clear messaging about transition from benchmark to progressive training

---

### Phase 2: Frontend - Pre-Benchmark Motivational Screen

#### 2.1 Create BenchmarkIntroScreen Component

**Location:** Add new component in `ProgressiveOverloadTracker.jsx` around line 2320

```javascript
/**
 * Motivational screen shown before starting a benchmark session
 * Explains the purpose and gets user excited to establish their baseline
 */
function BenchmarkIntroScreen({
  exerciseName,
  recommendation,
  onStart,
  onDismiss,
  darkMode
}) {
  const dm = (lightClass, darkClass) => darkMode ? darkClass : lightClass;
  const muscleIcon = MUSCLE_ICONS[exerciseName] || '💪';

  return (
    <div className={`fixed inset-0 z-50 ${dm('bg-white', 'bg-black')} overflow-y-auto`}>
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-lg bg-opacity-90 border-b border-gray-200 dark:border-gray-800 px-4 py-3">
        <button
          onClick={onDismiss}
          className="text-2xl"
        >
          ←
        </button>
      </div>

      <div className="px-6 pb-8 max-w-md mx-auto">
        {/* Hero Icon */}
        <div className="text-center mt-12 mb-8">
          <div className="text-8xl mb-4 animate-bounce-slow">
            {muscleIcon}
          </div>
          <h1 className={`text-4xl font-bold mb-2 ${dm('text-black', 'text-white')}`}>
            Let's Find Your<br />Starting Point!
          </h1>
          <p className="text-lg text-gray-500">
            {exerciseName}
          </p>
        </div>

        {/* Explanation Card */}
        <div className={`${dm('bg-amber-50 border-amber-200', 'bg-amber-900/20 border-amber-800')} border-2 rounded-2xl p-6 mb-6`}>
          <h2 className={`text-xl font-bold mb-3 ${dm('text-amber-900', 'text-amber-200')}`}>
            📊 What's a Benchmark Session?
          </h2>
          <p className={`text-sm leading-relaxed ${dm('text-amber-800', 'text-amber-300')}`}>
            This is your <strong>calibration workout</strong>. You'll perform 3-5 sets at different weights to discover your working capacity. Your best set becomes your baseline for future recommendations.
          </p>
        </div>

        {/* Instructions */}
        <div className={`${dm('bg-gray-50', 'bg-gray-900')} rounded-2xl p-6 mb-6`}>
          <h3 className={`text-lg font-bold mb-4 ${dm('text-black', 'text-white')}`}>
            🎯 How It Works
          </h3>

          {recommendation?.prescription?.benchmark_instructions?.instructions.map((instruction, idx) => (
            <div key={idx} className="flex items-start mb-4 last:mb-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold text-sm mr-3">
                {idx + 1}
              </div>
              <p className={`text-sm leading-relaxed pt-1 ${dm('text-gray-700', 'text-gray-300')}`}>
                {instruction}
              </p>
            </div>
          ))}
        </div>

        {/* Motivation Box */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 mb-8 text-white">
          <div className="text-3xl mb-3">🚀</div>
          <h3 className="text-xl font-bold mb-2">
            Your Journey Starts Here
          </h3>
          <p className="text-sm leading-relaxed opacity-90">
            Every champion started with a first lift. This benchmark is the foundation of your progressive overload journey. Be honest, be safe, and let's discover what you're capable of!
          </p>
        </div>

        {/* CTA Button */}
        <button
          onClick={onStart}
          className="w-full bg-black dark:bg-white text-white dark:text-black font-bold text-xl py-5 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg"
        >
          Start Benchmark Session
        </button>

        {/* Skip Option */}
        <button
          onClick={onDismiss}
          className={`w-full mt-4 py-3 text-sm ${dm('text-gray-500', 'text-gray-400')} hover:underline`}
        >
          I'll do this later
        </button>
      </div>
    </div>
  );
}
```

**Why:**
- Full-screen takeover creates focus
- Large emoji hero for emotional connection
- Clear explanation of what/why/how
- Step-by-step instructions from recommendation
- Motivational messaging to reduce intimidation
- Easy exit option (not forced)

---

#### 2.2 Add State Management for Benchmark Intro

**Location:** In `ProgressiveOverloadTracker` component state (around line 580)

```javascript
// Add new state for benchmark intro screen
const [showBenchmarkIntro, setShowBenchmarkIntro] = useState(false);
const [benchmarkExercise, setBenchmarkExercise] = useState(null);
```

---

#### 2.3 Update openLogView to Detect Benchmark Mode

**Location:** Modify `openLogView` function (around line 950)

```javascript
const openLogView = (exerciseName) => {
  const rec = getRecommendation(exerciseName);
  const exHistory = groupedEntries[exerciseName] || [];

  // Check if this is a benchmark session
  if (rec?.benchmark_mode === true) {
    // Show motivational intro first
    setBenchmarkExercise(exerciseName);
    setShowBenchmarkIntro(true);
    return;  // Don't open log view yet
  }

  // Normal flow continues...
  setSelectedExercise(exerciseName);
  // ... rest of existing code
};
```

**Why:**
- Intercepts first-session flow
- Shows intro screen before logging
- Maintains existing flow for non-benchmark sessions

---

#### 2.4 Add Benchmark Intro to Render

**Location:** In main component return (around line 2590)

```javascript
{/* Benchmark Intro Screen */}
{showBenchmarkIntro && benchmarkExercise && (
  <BenchmarkIntroScreen
    exerciseName={benchmarkExercise}
    recommendation={getRecommendation(benchmarkExercise)}
    onStart={() => {
      // User is ready to start benchmark
      setShowBenchmarkIntro(false);

      // Now open the log view
      const rec = getRecommendation(benchmarkExercise);
      setSelectedExercise(benchmarkExercise);
      setCurrentWeight(getLastWeight(benchmarkExercise) || 20);
      setCurrentReps(8);
      setCurrentRIR(2);
      setPendingSets([]);
      setShowLogView(true);
    }}
    onDismiss={() => {
      // User dismissed, go back
      setShowBenchmarkIntro(false);
      setBenchmarkExercise(null);
    }}
    darkMode={darkMode}
  />
)}
```

---

### Phase 3: Frontend - Update Log View for Benchmark Mode

#### 3.1 Add Benchmark Mode Indicator

**Location:** In Log View render (around line 1935), after header

```javascript
{/* Benchmark Mode Banner */}
{recommendation?.benchmark_mode && (
  <div className="bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-4 mb-4">
    <div className="flex items-center">
      <div className="text-3xl mr-3">🎯</div>
      <div className="flex-1">
        <div className="font-bold text-lg">Benchmark Mode Active</div>
        <div className="text-sm opacity-90">
          Log 3-5 sets at different weights. Your best set will be your baseline.
        </div>
      </div>
    </div>

    {/* Progress indicator */}
    {pendingSets.length > 0 && (
      <div className="mt-3">
        <div className="flex justify-between text-xs mb-1 opacity-90">
          <span>Sets logged: {pendingSets.length}/5</span>
          <span>{pendingSets.length >= 3 ? '✓ Ready to finish' : `${3 - pendingSets.length} more recommended`}</span>
        </div>
        <div className="w-full bg-white/30 rounded-full h-2">
          <div
            className="bg-white rounded-full h-2 transition-all duration-300"
            style={{ width: `${Math.min((pendingSets.length / 5) * 100, 100)}%` }}
          />
        </div>
      </div>
    )}
  </div>
)}
```

**Why:**
- Clear visual distinction from normal sessions
- Progress tracking keeps user informed
- Shows they've hit minimum (3 sets) or can continue to 5

---

#### 3.2 Update Recommendation Display for Benchmark

**Location:** In Log View recommendation display (around line 1950)

```javascript
{recommendation && pendingSets.length === 0 && (
  <div className={`px-4 py-6 ${recommendation.benchmark_mode ? 'border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/10' : ''}`}>
    {recommendation.benchmark_mode ? (
      // Benchmark mode specific display
      <>
        <div className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">
          Benchmark Instructions
        </div>
        <div className="space-y-2 mb-4">
          {recommendation.prescription.benchmark_instructions.instructions.map((inst, idx) => (
            <div key={idx} className="flex items-start text-sm text-gray-700 dark:text-gray-300">
              <span className="text-amber-500 mr-2">•</span>
              <span>{inst}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          💡 Tip: Start lighter than you think, then increase weight each set
        </div>
      </>
    ) : (
      // Normal recommendation display (existing code)
      <>
        {/* ... existing recommendation display ... */}
      </>
    )}
  </div>
)}
```

**Why:**
- Different display for benchmark vs normal
- Shows instructions from recommendation engine
- Reinforces exploration mindset

---

### Phase 4: Frontend - Benchmark Completion Reward Screen

#### 4.1 Create BenchmarkRewardScreen Component

**Location:** Add new component around line 2320

```javascript
/**
 * Special celebration screen after completing first benchmark session
 * More motivational than regular reward screen
 */
function BenchmarkRewardScreen({
  exerciseName,
  benchmarkData,
  onContinue,
  darkMode
}) {
  const dm = (lightClass, darkClass) => darkMode ? darkClass : lightClass;
  const muscleIcon = MUSCLE_ICONS[exerciseName] || '💪';

  // Extract best set from benchmark analysis
  const bestSet = benchmarkData.bestSet || {};
  const baseline1RM = benchmarkData.sessionBest1RM || 0;
  const totalSets = benchmarkData.setsCount || 0;
  const allSets = benchmarkData.allSetsData || [];

  return (
    <div className={`fixed inset-0 z-50 ${dm('bg-gradient-to-br from-amber-50 to-orange-100', 'bg-gradient-to-br from-gray-900 via-amber-900/20 to-gray-900')} overflow-y-auto`}>
      <div className="min-h-full px-6 py-12 flex flex-col items-center justify-center">

        {/* Celebration Animation */}
        <div className="text-center mb-8">
          <div className="text-9xl mb-4 animate-bounce">
            🎉
          </div>
          <h1 className={`text-5xl font-black mb-3 ${dm('text-black', 'text-white')}`}>
            Baseline<br />Established!
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            {exerciseName}
          </p>
        </div>

        {/* Main Stats Card */}
        <div className={`${dm('bg-white border-gray-300', 'bg-black border-gray-700')} border-4 rounded-3xl p-8 mb-6 w-full max-w-md shadow-2xl`}>

          {/* Baseline 1RM Hero */}
          <div className="text-center mb-6 pb-6 border-b border-gray-200 dark:border-gray-800">
            <div className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-2">
              Your Baseline e1RM
            </div>
            <div className={`text-7xl font-black mb-2 ${dm('text-black', 'text-white')}`}>
              {baseline1RM.toFixed(1)}
              <span className="text-4xl ml-2">kg</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <span>{muscleIcon}</span>
              <span>From {totalSets} benchmark sets</span>
            </div>
          </div>

          {/* Best Set Detail */}
          <div className={`${dm('bg-green-50', 'bg-green-900/20')} rounded-2xl p-4 mb-6`}>
            <div className="text-center">
              <div className="text-sm font-bold text-green-600 dark:text-green-400 mb-2">
                🏆 Your Best Set
              </div>
              <div className={`text-3xl font-bold ${dm('text-black', 'text-white')}`}>
                {bestSet.weight}kg × {bestSet.reps} reps
              </div>
              {bestSet.rir !== undefined && (
                <div className="text-xs text-gray-500 mt-1">
                  RIR: {bestSet.rir}
                </div>
              )}
            </div>
          </div>

          {/* All Sets Breakdown */}
          <div className="mb-6">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
              All Sets ({totalSets})
            </div>
            <div className="space-y-2">
              {allSets.map((set, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    set.weight === bestSet.weight && set.reps === bestSet.reps
                      ? dm('bg-amber-100 border-2 border-amber-400', 'bg-amber-900/30 border-2 border-amber-600')
                      : dm('bg-gray-50', 'bg-gray-900')
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      set.weight === bestSet.weight && set.reps === bestSet.reps
                        ? 'bg-amber-500 text-white'
                        : dm('bg-gray-200 text-gray-600', 'bg-gray-700 text-gray-300')
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <div className={`font-bold ${dm('text-black', 'text-white')}`}>
                        {set.weight}kg × {set.reps}
                      </div>
                      <div className="text-xs text-gray-500">
                        e1RM: {set.e1rm.toFixed(1)}kg
                      </div>
                    </div>
                  </div>
                  {set.weight === bestSet.weight && set.reps === bestSet.reps && (
                    <div className="text-xl">👑</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Motivational Message */}
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-6 mb-6 max-w-md text-white shadow-lg">
          <div className="text-3xl mb-3">💪</div>
          <h3 className="text-xl font-bold mb-2">
            Your Journey Begins Now!
          </h3>
          <p className="text-sm leading-relaxed opacity-90">
            Excellent work establishing your baseline! From now on, you'll receive personalized recommendations to progressively increase your strength. Every workout builds on this foundation.
          </p>
        </div>

        {/* Next Steps Preview */}
        {benchmarkData.nextGoal && (
          <div className={`${dm('bg-blue-50 border-blue-200', 'bg-blue-900/20 border-blue-800')} border-2 rounded-2xl p-5 mb-8 max-w-md w-full`}>
            <div className="flex items-start gap-3">
              <div className="text-3xl">🎯</div>
              <div className="flex-1">
                <div className={`font-bold mb-1 ${dm('text-blue-900', 'text-blue-200')}`}>
                  Next Workout Target
                </div>
                <div className={`text-2xl font-bold ${dm('text-black', 'text-white')}`}>
                  {benchmarkData.nextGoal.weight}kg × {benchmarkData.nextGoal.targetReps} reps
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Based on your {benchmarkData.phase || 'hypertrophy'} training phase
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={onContinue}
          className="w-full max-w-md bg-black dark:bg-white text-white dark:text-black font-bold text-xl py-5 rounded-full hover:scale-105 active:scale-95 transition-transform shadow-lg"
        >
          Continue Training
        </button>

        {/* Share Option (future enhancement) */}
        <button className="mt-4 text-sm text-gray-500 dark:text-gray-400 hover:underline">
          Share Achievement →
        </button>
      </div>
    </div>
  );
}
```

**Why:**
- Distinct visual design (gradient background) vs regular reward
- Shows ALL sets with best set highlighted
- Motivational messaging specific to milestone moment
- Preview of next workout builds anticipation
- Bigger celebration than regular workouts

---

#### 4.2 Update logAllSets to Detect Benchmark Completion

**Location:** Modify `logAllSets` function (around line 884)

```javascript
const logAllSets = () => {
  if (pendingSets.length === 0) return;

  const now = new Date();
  const newEntries = pendingSets.map(set => ({
    id: `${selectedExercise}-${Date.now()}-${Math.random()}`,
    name: selectedExercise,
    date: now.toISOString().split('T')[0],
    weight: set.weight,
    reps: set.reps,
    rir: set.rir,
    sets: 1,
    isActive: true
  }));

  const updatedEntries = [...entries, ...newEntries];

  // Check if this was a benchmark session (first ever session for this exercise)
  const exerciseHistory = entries.filter(e => e.name === selectedExercise && e.isActive);
  const wasBenchmark = exerciseHistory.length === 0;

  // Save entries
  setEntries(updatedEntries);
  userStore.saveEntries(updatedEntries);

  // Determine accomplishment and generate reward data
  const recommendation = getRecommendation(selectedExercise, updatedEntries);

  if (wasBenchmark) {
    // This was the benchmark session - create special reward data
    const benchmarkAnalysis = analyzeBenchmarkSessionUI(newEntries, selectedExercise);

    const benchmarkRewardData = {
      exerciseName: selectedExercise,
      isBenchmark: true,
      sessionBest1RM: benchmarkAnalysis.highestE1RM,
      previousBest1RM: 0,
      oneRMChange: null,  // Not applicable for first session
      isNewPR: true,  // First session is always a PR
      totalVolume: newEntries.reduce((sum, e) => sum + (e.weight * e.reps), 0),
      setsCount: newEntries.length,
      accomplishmentType: 'benchmark_complete',
      recommendation: recommendation,
      nextGoal: {
        weight: recommendation.prescription?.weight_kg,
        targetReps: recommendation.prescription?.target_reps || 8
      },
      phase: user.trainingPhase,
      bestSet: benchmarkAnalysis.bestSet,
      allSetsData: benchmarkAnalysis.allSets
    };

    setRewardData(benchmarkRewardData);
    setShowRewardScreen(true);
  } else {
    // Normal session - use existing reward logic
    const accomplishment = determineAccomplishment(selectedExercise, newEntries, recommendation);
    // ... existing reward logic ...
  }

  // Clean up
  setPendingSets([]);
  setShowLogView(false);
};
```

**Helper function to add:**

```javascript
/**
 * UI version of benchmark analysis (mirrors backend logic)
 * Used to generate reward screen data
 */
function analyzeBenchmarkSessionUI(sessionEntries, exerciseName) {
  const exerciseConfig = EXERCISE_CONFIG[exerciseName] || { e1rm_modifier: 1.0 };

  const setsWithE1RM = sessionEntries.map(entry => {
    const e1rm = calculateE1RMUI(entry.weight, entry.reps, entry.rir);
    return {
      weight: entry.weight,
      reps: entry.reps,
      rir: entry.rir,
      e1rm: e1rm
    };
  });

  const bestSet = setsWithE1RM.reduce((best, current) =>
    current.e1rm > best.e1rm ? current : best
  );

  return {
    highestE1RM: bestSet.e1rm * exerciseConfig.e1rm_modifier,
    bestSet: bestSet,
    allSets: setsWithE1RM
  };
}

function calculateE1RMUI(weight, reps, rir = 2) {
  const effectiveReps = Math.min(reps + rir, 12);
  const e1rm = weight * (36 / (37 - effectiveReps));
  return Math.round(e1rm * 10) / 10;
}
```

---

#### 4.3 Update Reward Screen Render to Show Benchmark Version

**Location:** In main component return (around line 2300)

```javascript
{/* Reward Screen */}
{showRewardScreen && rewardData && (
  rewardData.isBenchmark ? (
    <BenchmarkRewardScreen
      exerciseName={rewardData.exerciseName}
      benchmarkData={rewardData}
      onContinue={() => {
        setShowRewardScreen(false);
        setRewardData(null);

        // Return to exercise detail to show new baseline
        setActiveTab('detail');
        setSelectedExercise(rewardData.exerciseName);
      }}
      darkMode={darkMode}
    />
  ) : (
    <RewardScreen
      exerciseName={rewardData.exerciseName}
      sessionBest1RM={rewardData.sessionBest1RM}
      previousBest1RM={rewardData.previousBest1RM}
      oneRMChange={rewardData.oneRMChange}
      isNewPR={rewardData.isNewPR}
      totalVolume={rewardData.totalVolume}
      setsCount={rewardData.setsCount}
      accomplishmentType={rewardData.accomplishmentType}
      recommendation={rewardData.recommendation}
      nextGoal={rewardData.nextGoal}
      onContinue={() => {
        setShowRewardScreen(false);
        setRewardData(null);
        setActiveTab('exercises');
      }}
      darkMode={darkMode}
    />
  )
)}
```

---

### Phase 5: Testing

#### 5.1 Add Tests to recommendation-engine.test.js

**Location:** Add new test suite around line 600

```javascript
describe('Benchmark Mode', () => {
  it('should return benchmark mode for first session', () => {
    const recommendation = generateRecommendation({
      exercise: 'Bench Press',
      history: [],
      userAge: 25,
      phase: 'hypertrophy'
    });

    expect(recommendation.benchmark_mode).toBe(true);
    expect(recommendation.training_status).toBe('benchmark_mode');
    expect(recommendation.flags).toContain('benchmark_mode');
    expect(recommendation.prescription.sets).toBe('3-5');
    expect(recommendation.prescription.reps).toBe('5-12');
    expect(recommendation.prescription.benchmark_instructions).toBeDefined();
  });

  it('should analyze benchmark session correctly', () => {
    const benchmarkHistory = [
      { date: '2026-01-20', weight: 60, reps: 10, rir: 2, isActive: true },
      { date: '2026-01-20', weight: 70, reps: 8, rir: 1, isActive: true },
      { date: '2026-01-20', weight: 80, reps: 6, rir: 1, isActive: true },
      { date: '2026-01-20', weight: 85, reps: 4, rir: 0, isActive: true },
    ];

    const analysis = analyzeBenchmarkSession(benchmarkHistory, 'Bench Press');

    expect(analysis.benchmarkCompleted).toBe(true);
    expect(analysis.totalSets).toBe(4);
    expect(analysis.highestE1RM).toBeGreaterThan(0);
    expect(analysis.bestSet).toBeDefined();
    expect(analysis.bestSet.weight).toBe(85); // Highest weight set should win
  });

  it('should generate progressive recommendation after benchmark', () => {
    const benchmarkHistory = [
      { name: 'Squat', date: '2026-01-20', weight: 100, reps: 8, rir: 2, isActive: true },
      { name: 'Squat', date: '2026-01-20', weight: 110, reps: 6, rir: 1, isActive: true },
      { name: 'Squat', date: '2026-01-20', weight: 120, reps: 5, rir: 1, isActive: true },
    ];

    const recommendation = generateRecommendation({
      exercise: 'Squat',
      history: benchmarkHistory,
      userAge: 30,
      phase: 'hypertrophy'
    });

    expect(recommendation.benchmark_mode).toBe(false);
    expect(recommendation.flags).toContain('post_benchmark_first_prescription');
    expect(recommendation.prescription.weight_kg).toBeGreaterThan(0);
    expect(recommendation.benchmark_baseline).toBeDefined();
    expect(recommendation.benchmark_baseline.e1rm).toBeGreaterThan(0);
  });

  it('should handle single set benchmark', () => {
    const benchmarkHistory = [
      { date: '2026-01-20', weight: 50, reps: 10, rir: 3, isActive: true },
    ];

    const analysis = analyzeBenchmarkSession(benchmarkHistory, 'Overhead Press');

    expect(analysis.benchmarkCompleted).toBe(true);
    expect(analysis.totalSets).toBe(1);
    expect(analysis.bestSet.weight).toBe(50);
  });

  it('should apply exercise-specific modifiers to benchmark e1RM', () => {
    const benchmarkHistory = [
      { date: '2026-01-20', weight: 100, reps: 5, rir: 1, isActive: true },
    ];

    const frontSquatAnalysis = analyzeBenchmarkSession(benchmarkHistory, 'Front Squat');
    const backSquatAnalysis = analyzeBenchmarkSession(benchmarkHistory, 'Squat');

    // Front Squat has 0.82 modifier, Back Squat has 1.0
    expect(frontSquatAnalysis.highestE1RM).toBeLessThan(backSquatAnalysis.highestE1RM);
  });
});
```

---

### Phase 6: Documentation Updates

#### 6.1 Update CLAUDE.md

Add section explaining benchmark sessions:

```markdown
### Benchmark Sessions

**First Session for Any Exercise:**
When a user logs their first session for an exercise, the system enters **Benchmark Mode**:

1. **Pre-Benchmark Screen**: Motivational explanation of benchmark purpose
2. **Benchmark Logging**: User performs 3-5 sets at varying weights
3. **Analysis**: System calculates e1RM for each set, selects highest
4. **Reward Screen**: Special celebration showing baseline establishment
5. **Next Session**: Progressive recommendations based on established baseline

**Code Locations:**
- Backend logic: `/home/user/POH/src/lib/recommendation-engine.js:490-520`
- Benchmark intro: `/home/user/POH/src/ProgressiveOverloadTracker.jsx` (BenchmarkIntroScreen)
- Reward screen: `/home/user/POH/src/ProgressiveOverloadTracker.jsx` (BenchmarkRewardScreen)
```

---

## 🎨 Design Details

### Color Palette for Benchmark Mode
- **Primary**: Amber/Orange gradient (`from-amber-400 to-orange-500`)
- **Success**: Green (`#00C805`)
- **Highlight**: Gold (`#FFD700`)
- **Background**: Light amber tint in light mode, dark amber overlay in dark mode

### Typography
- **Hero numbers**: `text-7xl` or `text-9xl` for e1RM display
- **Titles**: `text-4xl` or `text-5xl` bold/black
- **Instructions**: `text-sm` with relaxed leading

### Animations
- Bounce animation for celebration emoji
- Progress bar smooth transitions
- Button scale on press (95%) and hover (105%)

---

## 📊 Data Flow Diagram

```
User opens exercise with no history
         ↓
Recommendation engine returns benchmark_mode=true
         ↓
UI shows BenchmarkIntroScreen (motivational)
         ↓
User clicks "Start Benchmark Session"
         ↓
Log View opens with benchmark mode UI
  - Amber banner
  - Progress indicator (3-5 sets)
  - Benchmark instructions
         ↓
User logs 3-5 sets at different weights
         ↓
User clicks "Slide to Log"
         ↓
logAllSets detects first session (wasBenchmark=true)
         ↓
analyzeBenchmarkSessionUI calculates:
  - e1RM for each set
  - Selects highest e1RM
  - Identifies best set
         ↓
BenchmarkRewardScreen shows:
  - Baseline e1RM (hero display)
  - Best set details
  - All sets breakdown
  - Motivational message
  - Next workout preview
         ↓
User clicks "Continue Training"
         ↓
Returns to exercise detail view
         ↓
Next time user opens exercise:
  - Recommendation engine detects sessionCount=1
  - Analyzes benchmark data
  - Returns first progressive prescription
```

---

## ✅ Acceptance Criteria

### Backend
- [ ] `recommendation-engine.js` returns `benchmark_mode: true` for first session
- [ ] Benchmark instructions embedded in recommendation
- [ ] `analyzeBenchmarkSession()` function correctly identifies highest e1RM
- [ ] Second session receives proper progressive prescription based on benchmark
- [ ] All unit tests pass

### Frontend - Pre-Benchmark
- [ ] `BenchmarkIntroScreen` appears when opening exercise with no history
- [ ] Motivational messaging displays correctly
- [ ] Instructions from recommendation are shown
- [ ] "Start Benchmark" button opens log view
- [ ] "Later" button dismisses screen

### Frontend - During Benchmark
- [ ] Log view shows amber benchmark banner
- [ ] Progress indicator shows 3-5 sets completion
- [ ] Instructions visible when no sets logged
- [ ] Normal weight/reps pickers work
- [ ] Can log 3+ sets

### Frontend - Post-Benchmark
- [ ] `BenchmarkRewardScreen` appears after logging first session
- [ ] Shows baseline e1RM prominently
- [ ] Displays all logged sets with best set highlighted
- [ ] Shows motivational message
- [ ] Previews next workout target
- [ ] "Continue" returns to exercise detail

### UX Flow
- [ ] Entire flow feels motivating and clear
- [ ] No confusion about what benchmark means
- [ ] User understands this is a one-time calibration
- [ ] Transition from benchmark to progressive training is smooth

---

## 🚀 Implementation Order

1. **Backend First** (Phases 1.1-1.3) - Foundation for everything
2. **Pre-Benchmark Screen** (Phase 2) - Entry point UX
3. **Log View Updates** (Phase 3) - During-benchmark experience
4. **Reward Screen** (Phase 4.1-4.2) - Completion celebration
5. **Integration** (Phase 4.3) - Wire everything together
6. **Testing** (Phase 5) - Ensure correctness
7. **Documentation** (Phase 6) - Knowledge capture

---

## 🧪 Manual Testing Checklist

- [ ] Start fresh (clear localStorage or new exercise)
- [ ] Click exercise from list - see benchmark intro
- [ ] Dismiss intro - returns to list
- [ ] Open again - still shows intro (hasn't logged yet)
- [ ] Start benchmark - log view opens with amber banner
- [ ] Log 1 set - progress shows 1/5
- [ ] Log 2 more sets - progress shows 3/5, "Ready to finish" message
- [ ] Slide to log - benchmark reward screen appears
- [ ] Verify all 3 sets shown with best highlighted
- [ ] Verify baseline e1RM calculated correctly
- [ ] Verify next goal preview shown
- [ ] Click continue - returns to exercise detail
- [ ] Open same exercise - normal recommendation shown (no benchmark)
- [ ] Verify recommendation uses benchmark baseline

---

## 📝 Code Review Checklist

- [ ] No hardcoded values (use constants/config)
- [ ] Dark mode support in all new components
- [ ] Proper error handling (empty arrays, null checks)
- [ ] Consistent naming conventions
- [ ] Comments for complex logic
- [ ] No console.logs left in
- [ ] Mobile-responsive (all screen sizes)
- [ ] Accessibility (keyboard navigation, ARIA labels)
- [ ] Performance (no unnecessary re-renders)

---

## 🎯 Future Enhancements (Not in this scope)

- **Re-benchmark option**: Allow users to redo baseline after long breaks
- **Benchmark history**: Show all benchmark sessions (useful for annual comparisons)
- **Share achievements**: Social sharing of benchmark completion
- **Video guidance**: Embedded exercise form videos during benchmark
- **Voice guidance**: Audio cues during benchmark logging
- **Benchmark analytics**: Compare user's baseline to population averages

---

## 📚 Resources

- [Progressive Overload Principles](https://www.strongerbyscience.com/progressive-overload/)
- [Brzycki Formula](https://en.wikipedia.org/wiki/One-repetition_maximum#Brzycki)
- [React Hooks Documentation](https://react.dev/reference/react)
- [Tailwind CSS](https://tailwindcss.com/docs)

---

**Last Updated**: 2026-01-21
**Plan Version**: 1.0
**Status**: Ready for Implementation
