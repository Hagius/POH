/**
 * Exercise Recommendation Engine
 *
 * A scientifically-grounded recommendation system for strength training
 * using the Brzycki formula for e1RM and double progression methodology.
 */

// ============================================================================
// TYPE DEFINITIONS (JSDoc for JavaScript)
// ============================================================================

/**
 * @typedef {Object} ExerciseRecommendation
 * @property {string} exercise
 * @property {Object} prescription
 * @property {number} prescription.sets
 * @property {string|number} prescription.reps
 * @property {number|null} prescription.target_reps - Specific target reps (when doing rep progression)
 * @property {number|null} prescription.weight_kg
 * @property {string} prescription.rest_seconds
 * @property {number} prescription.rir_target
 * @property {number} intensity_percent
 * @property {number} calculated_e1rm_kg
 * @property {'progressing'|'plateau'|'regressing'|'insufficient_data'} training_status
 * @property {string} progression_rationale
 * @property {string[]|null} flags
 * @property {Object|null} reasoning_breakdown - Detailed explanation of recommendation
 * @property {string} reasoning_breakdown.last_session - Description of last session
 * @property {string} reasoning_breakdown.trend - Performance trend
 * @property {string} reasoning_breakdown.next_step - What to do next
 * @property {string} reasoning_breakdown.calculation - How weight was calculated
 */

/**
 * @typedef {Object} RecommendationRequest
 * @property {string} exercise - Exercise name
 * @property {Array} history - Array of workout entries for this exercise
 * @property {number} userAge - User's age in years
 * @property {'hypertrophy'|'strength'|'peaking'|'explosive'} phase - Training phase
 */

/**
 * @typedef {Object} WorkoutEntry
 * @property {string} id
 * @property {string} name - Exercise name
 * @property {string} date - ISO date string
 * @property {number} weight - Weight in kg
 * @property {number} reps
 * @property {number} [sets]
 * @property {number} [rir] - Reps in reserve (optional)
 * @property {boolean} [isActive] - Whether entry is active (not excluded)
 */

// ============================================================================
// PHASE CONFIGURATION
// ============================================================================

export const PHASE_CONFIG = {
  hypertrophy: {
    intensity_range: [0.65, 0.75],
    rep_range: '8-12',
    rep_min: 8,
    rep_max: 12,
    base_sets: 4,
    rir_target: 2,
    rest_seconds: '90-120'
  },
  strength: {
    intensity_range: [0.80, 0.88],
    rep_range: '4-6',
    rep_min: 4,
    rep_max: 6,
    base_sets: 5,
    rir_target: 1,
    rest_seconds: '180-300'
  },
  peaking: {
    intensity_range: [0.90, 0.97],
    rep_range: '1-3',
    rep_min: 1,
    rep_max: 3,
    base_sets: 4,
    rir_target: 0,
    rest_seconds: '300-420'
  },
  explosive: {
    intensity_range: [0.50, 0.70],
    rep_range: '2-5',
    rep_min: 2,
    rep_max: 5,
    base_sets: 5,
    rir_target: 3,
    rest_seconds: '120-180'
  }
};

// ============================================================================
// EXERCISE-SPECIFIC CONFIGURATION
// ============================================================================

export const EXERCISE_CONFIG = {
  'Deadlift': { load_increment: 5, max_weekly_sets: 10 },
  'Squat': { load_increment: 5, max_weekly_sets: 16 },
  'Front Squat': { load_increment: 5, max_weekly_sets: 12, e1rm_modifier: 0.82 },
  'Bench Press': { load_increment: 2.5, max_weekly_sets: 20 },
  'Overhead Press': { load_increment: 1.25, max_weekly_sets: 16 },
  'Lunge': { load_increment: 2.5, max_weekly_sets: 12, rir_adjustment: 1 },
  'Barbell Row': { load_increment: 2.5, max_weekly_sets: 16 },
  // Default config for unknown exercises
  '_default': { load_increment: 2.5, max_weekly_sets: 16 }
};

/**
 * Get configuration for a specific exercise
 * @param {string} exerciseName
 * @returns {Object}
 */
export function getExerciseConfig(exerciseName) {
  return EXERCISE_CONFIG[exerciseName] || EXERCISE_CONFIG['_default'];
}

// ============================================================================
// CORE CALCULATIONS
// ============================================================================

/**
 * Calculate Estimated 1RM using Brzycki Formula
 * e1RM = weight × (36 / (37 - effectiveReps))
 *
 * @param {number} weight - Weight lifted in kg
 * @param {number} reps - Reps performed
 * @param {number} [rir] - Reps in reserve (optional, assumes 2 if missing)
 * @returns {number} Estimated 1RM in kg
 */
export function calculateE1RM(weight, reps, rir) {
  if (weight <= 0 || reps <= 0) return 0;

  // Calculate effective reps (actual reps + RIR), cap at 12
  const assumedRIR = rir !== undefined ? rir : 2;
  const effectiveReps = Math.min(reps + assumedRIR, 12);

  // Brzycki formula
  const e1rm = weight * (36 / (37 - effectiveReps));

  return Math.round(e1rm * 10) / 10; // Round to 1 decimal
}

/**
 * Get age multiplier for set adjustment
 * @param {number} age
 * @returns {number} Multiplier (0.65 - 1.0)
 */
export function getAgeMultiplier(age) {
  if (age <= 30) return 1.0;
  if (age <= 40) return 0.95;
  if (age <= 50) return 0.85;
  if (age <= 60) return 0.75;
  return 0.65;
}

/**
 * Calculate adjusted sets based on age
 * @param {number} baseSets
 * @param {number} age
 * @returns {number} Adjusted sets (minimum 2)
 */
export function getAdjustedSets(baseSets, age) {
  const multiplier = getAgeMultiplier(age);
  return Math.max(2, Math.round(baseSets * multiplier));
}

/**
 * Determine training status based on e1RM trend
 * Improved to handle short-term progression without requiring 28-day lookback
 *
 * @param {number} currentE1RM - Highest e1RM from last 14 days
 * @param {number} previousE1RM - Highest e1RM from 28-42 days ago
 * @param {number} sessionCount - Number of sessions in history
 * @param {WorkoutEntry[]} recentHistory - Last 3 sessions for short-term analysis
 * @returns {'progressing'|'plateau'|'regressing'|'insufficient_data'}
 */
export function determineTrainingStatus(currentE1RM, previousE1RM, sessionCount, recentHistory = []) {
  // Truly insufficient data - need at least 2 sessions
  if (sessionCount < 2) return 'insufficient_data';

  // If we have long-term data (28-42 days ago), use it for status determination
  if (previousE1RM > 0) {
    const trend = ((currentE1RM - previousE1RM) / previousE1RM) * 100;
    if (trend >= 2.5) return 'progressing';
    if (trend <= -2.5) return 'regressing';
    return 'plateau';
  }

  // No long-term data, but we have recent sessions - analyze short-term progression
  if (recentHistory.length >= 2) {
    const sortedRecent = [...recentHistory]
      .filter(e => e.isActive !== false)
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // Chronological order

    if (sortedRecent.length >= 2) {
      // Get e1RMs for last 2-3 sessions
      const e1rms = sortedRecent.slice(-3).map(e => calculateE1RM(e.weight, e.reps, e.rir));

      // Check if there's progression in the recent sessions
      const firstE1RM = e1rms[0];
      const lastE1RM = e1rms[e1rms.length - 1];

      if (lastE1RM > firstE1RM * 1.01) {
        // At least 1% improvement in recent sessions
        return 'progressing';
      } else if (lastE1RM < firstE1RM * 0.98) {
        // More than 2% decline
        return 'regressing';
      }

      // Stable performance in recent sessions
      return 'plateau';
    }
  }

  // Fallback: not enough data for confident status
  return 'insufficient_data';
}

// ============================================================================
// HISTORY ANALYSIS
// ============================================================================

/**
 * Get the highest e1RM from a date range
 * @param {WorkoutEntry[]} history - Workout history
 * @param {number} daysAgoStart - Start of range (days ago)
 * @param {number} daysAgoEnd - End of range (days ago)
 * @returns {number} Highest e1RM in range, or 0 if none
 */
function getHighestE1RMInRange(history, daysAgoStart, daysAgoEnd) {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - daysAgoStart);
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() - daysAgoEnd);

  const entriesInRange = history.filter(entry => {
    if (entry.isActive === false) return false;
    const entryDate = new Date(entry.date);
    return entryDate <= startDate && entryDate >= endDate;
  });

  if (entriesInRange.length === 0) return 0;

  return Math.max(...entriesInRange.map(e => calculateE1RM(e.weight, e.reps, e.rir)));
}

/**
 * Analyzes a benchmark session (first session only) to extract the best performance
 * @param {WorkoutEntry[]} sessionHistory - All entries from the first session date
 * @param {string} exerciseName - Name of the exercise
 * @returns {Object} - Benchmark analysis results
 */
function analyzeBenchmarkSession(sessionHistory, exerciseName) {
  if (!sessionHistory || sessionHistory.length === 0) {
    return {
      benchmarkCompleted: false,
      highestE1RM: 0,
      bestSet: null,
      totalSets: 0,
      allSets: []
    };
  }

  const exerciseConfig = getExerciseConfig(exerciseName);

  // Calculate e1RM for each set
  const setsWithE1RM = sessionHistory.map(entry => ({
    weight: entry.weight,
    reps: entry.reps,
    rir: entry.rir,
    e1rm: calculateE1RM(entry.weight, entry.reps, entry.rir)
  }));

  // Find the best set
  const bestSet = setsWithE1RM.reduce((best, current) =>
    current.e1rm > best.e1rm ? current : best
  );

  // Apply exercise-specific e1RM modifier
  const adjustedE1RM = bestSet.e1rm * (exerciseConfig.e1rm_modifier || 1.0);

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
    allSets: setsWithE1RM
  };
}

/**
 * Get the most recent workout entry
 * @param {WorkoutEntry[]} history
 * @returns {WorkoutEntry|null}
 */
function getMostRecentEntry(history) {
  const activeEntries = history.filter(e => e.isActive !== false);
  if (activeEntries.length === 0) return null;

  return activeEntries.reduce((latest, entry) => {
    return new Date(entry.date) > new Date(latest.date) ? entry : latest;
  });
}

/**
 * Count unique session dates
 * @param {WorkoutEntry[]} history
 * @returns {number}
 */
function countSessions(history) {
  const activeEntries = history.filter(e => e.isActive !== false);
  const uniqueDates = new Set(activeEntries.map(e => e.date));
  return uniqueDates.size;
}

/**
 * Get days since last session
 * @param {WorkoutEntry[]} history
 * @returns {number|null} Days since last session, or null if no history
 */
function getDaysSinceLastSession(history) {
  const lastEntry = getMostRecentEntry(history);
  if (!lastEntry) return null;

  const lastDate = new Date(lastEntry.date);
  const now = new Date();
  const diffTime = now - lastDate;
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if user hit top of rep range in last session
 * @param {WorkoutEntry[]} history
 * @param {number} repMax - Top of rep range
 * @returns {boolean}
 */
function hitTopOfRepRange(history, repMax) {
  const lastEntry = getMostRecentEntry(history);
  if (!lastEntry) return false;
  return lastEntry.reps >= repMax;
}

/**
 * Get last session weight
 * @param {WorkoutEntry[]} history
 * @returns {number|null}
 */
function getLastSessionWeight(history) {
  const lastEntry = getMostRecentEntry(history);
  return lastEntry ? lastEntry.weight : null;
}

/**
 * Detect plateau (3+ sessions with same performance)
 * @param {WorkoutEntry[]} history
 * @returns {boolean}
 */
function detectPlateau(history) {
  const activeEntries = history.filter(e => e.isActive !== false);
  if (activeEntries.length < 3) return false;

  // Get last 3 unique session dates
  const sortedEntries = [...activeEntries].sort((a, b) =>
    new Date(b.date) - new Date(a.date)
  );

  const uniqueDates = [];
  const dateSet = new Set();
  for (const entry of sortedEntries) {
    if (!dateSet.has(entry.date)) {
      dateSet.add(entry.date);
      uniqueDates.push(entry.date);
      if (uniqueDates.length >= 3) break;
    }
  }

  if (uniqueDates.length < 3) return false;

  // Get best e1RM for each of the last 3 sessions
  const sessionE1RMs = uniqueDates.map(date => {
    const sessionEntries = sortedEntries.filter(e => e.date === date);
    return Math.max(...sessionEntries.map(e => calculateE1RM(e.weight, e.reps, e.rir)));
  });

  // Check if there's no improvement
  const maxE1RM = Math.max(...sessionE1RMs);
  const minE1RM = Math.min(...sessionE1RMs);

  // Plateau if variance is < 2%
  return ((maxE1RM - minE1RM) / minE1RM) < 0.02;
}

/**
 * Track plateau strategy rotation
 * This uses a simple hash of the exercise name to rotate strategies
 * @param {string} exerciseName
 * @param {number} plateauCount
 * @returns {string}
 */
function getPlateauStrategy(exerciseName, plateauCount) {
  const strategies = ['micro_load', 'add_set', 'extend_rep_ceiling', 'reset'];
  const index = plateauCount % strategies.length;
  return strategies[index];
}

// ============================================================================
// WEIGHT CALCULATION
// ============================================================================

/**
 * Round weight to nearest 1.25kg increment
 * @param {number} weight
 * @returns {number}
 */
function roundToIncrement(weight) {
  return Math.round(weight / 1.25) * 1.25;
}

/**
 * Build detailed reasoning breakdown for recommendation
 * @param {Object} params
 * @returns {Object|null}
 */
function buildReasoningBreakdown({
  lastEntry,
  trainingStatus,
  prescribedWeight,
  targetReps,
  phaseConfig,
  exerciseConfig,
  currentE1RM,
  previousE1RM
}) {
  if (!lastEntry) {
    return {
      last_session: 'No previous sessions recorded',
      trend: 'Starting fresh',
      next_step: 'Establish a baseline by performing the recommended sets and reps',
      calculation: 'Starting with conservative estimate based on typical beginner loads'
    };
  }

  const lastE1RM = calculateE1RM(lastEntry.weight, lastEntry.reps, lastEntry.rir);
  const lastSessionDesc = `${lastEntry.weight}kg × ${lastEntry.reps} reps${lastEntry.rir !== undefined ? ` (RIR ${lastEntry.rir})` : ''}`;

  let trend = '';
  if (previousE1RM > 0 && currentE1RM > 0) {
    const trendPercent = ((currentE1RM - previousE1RM) / previousE1RM) * 100;
    trend = `${trendPercent >= 0 ? '+' : ''}${trendPercent.toFixed(1)}% vs. 4 weeks ago`;
  } else {
    trend = trainingStatus === 'progressing' ? 'Improving session-to-session' :
            trainingStatus === 'plateau' ? 'Stable performance' :
            trainingStatus === 'regressing' ? 'Declining performance' :
            'Building training history';
  }

  let nextStep = '';
  if (trainingStatus === 'progressing') {
    if (lastEntry.reps >= phaseConfig.rep_max) {
      nextStep = `You hit ${phaseConfig.rep_max} reps. Time to increase weight by ${exerciseConfig.load_increment}kg.`;
    } else if (targetReps) {
      nextStep = `Keep pushing for more reps. Target ${targetReps} reps this session.`;
    } else {
      nextStep = `Keep pushing for more reps. Target ${Math.min(lastEntry.reps + 1, phaseConfig.rep_max)} reps this session.`;
    }
  } else if (trainingStatus === 'plateau') {
    if (targetReps) {
      nextStep = `Break through the plateau by aiming for ${targetReps} reps.`;
    } else {
      nextStep = 'Break through the plateau by focusing on rep quality and progressive volume.';
    }
  } else if (trainingStatus === 'regressing') {
    nextStep = 'Take a deload week to recover. Reduce intensity and volume.';
  } else {
    if (targetReps) {
      nextStep = `Build momentum by targeting ${targetReps} reps consistently.`;
    } else {
      nextStep = 'Build momentum with consistent training.';
    }
  }

  let calculation = 'Weight to be determined based on your starting point';
  if (prescribedWeight) {
    if (prescribedWeight > lastEntry.weight) {
      calculation = `${prescribedWeight}kg = ${lastEntry.weight}kg + ${exerciseConfig.load_increment}kg increment`;
    } else if (targetReps) {
      calculation = `${prescribedWeight}kg × ${targetReps} reps (maintain weight, aim for ${targetReps} reps)`;
    } else {
      calculation = `${prescribedWeight}kg (maintain weight, add reps)`;
    }
  }

  return {
    last_session: lastSessionDesc,
    trend,
    next_step: nextStep,
    calculation
  };
}

// ============================================================================
// MAIN RECOMMENDATION FUNCTION
// ============================================================================

/**
 * Generate exercise recommendation
 *
 * @param {RecommendationRequest} request
 * @returns {ExerciseRecommendation}
 */
export function generateRecommendation(request) {
  const { exercise, history, userAge, phase = 'hypertrophy' } = request;

  const phaseConfig = PHASE_CONFIG[phase] || PHASE_CONFIG.hypertrophy;
  const exerciseConfig = getExerciseConfig(exercise);
  const flags = [];

  // Filter to only active entries for this exercise
  const activeHistory = history.filter(e =>
    e.name === exercise && e.isActive !== false
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const sessionCount = countSessions(activeHistory);
  const daysSinceLastSession = getDaysSinceLastSession(activeHistory);

  // =========================================================================
  // EDGE CASE: First Session (no history) - BENCHMARK MODE
  // =========================================================================
  if (activeHistory.length === 0) {
    flags.push('benchmark_mode');

    return {
      exercise,
      benchmark_mode: true,
      prescription: {
        sets: '3-5',
        reps: '5-12',
        weight_kg: null,
        rest_seconds: '90-120',
        rir_target: 3,
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
      flags,
      reasoning_breakdown: {
        last_session: 'No previous data - benchmark mode activated',
        trend: 'Establishing baseline',
        next_step: 'Complete 3-5 sets at varying weights to find your working load',
        calculation: 'Your highest e1RM from all sets will be used as your baseline'
      }
    };
  }

  // =========================================================================
  // EDGE CASE: Returning from break (>14 days)
  // Check this BEFORE post-benchmark to avoid treating old sessions as benchmark
  // =========================================================================
  if (daysSinceLastSession !== null && daysSinceLastSession > 14) {
    // Calculate e1RM values first for return from break logic
    const currentE1RM = getHighestE1RMInRange(activeHistory, 0, 14);
    const previousE1RM = getHighestE1RMInRange(activeHistory, 28, 42);

    let workingE1RM = currentE1RM;
    if (workingE1RM <= 0) {
      const lastEntry = getMostRecentEntry(activeHistory);
      workingE1RM = lastEntry ? calculateE1RM(lastEntry.weight, lastEntry.reps, lastEntry.rir) : 0;
    }

    if (exerciseConfig.e1rm_modifier) {
      workingE1RM = workingE1RM * exerciseConfig.e1rm_modifier;
    }

    flags.push('returning_from_break');

    const reductionPercent = daysSinceLastSession > 28 ? 0.15 : 0.10;
    const reducedE1RM = workingE1RM * (1 - reductionPercent);
    const targetIntensity = (phaseConfig.intensity_range[0] + phaseConfig.intensity_range[1]) / 2;
    const adjustedWeight = roundToIncrement(reducedE1RM * targetIntensity);
    const adjustedSets = getAdjustedSets(phaseConfig.base_sets, userAge);

    const lastEntry = getMostRecentEntry(activeHistory);
    return {
      exercise,
      prescription: {
        sets: adjustedSets,
        reps: phaseConfig.rep_range,
        weight_kg: adjustedWeight,
        rest_seconds: phaseConfig.rest_seconds,
        rir_target: phaseConfig.rir_target + 1 // Extra RIR for safety
      },
      intensity_percent: Math.round(targetIntensity * 100 * (1 - reductionPercent)),
      calculated_e1rm_kg: Math.round(workingE1RM * 10) / 10,
      training_status: 'insufficient_data',
      progression_rationale: `${daysSinceLastSession} days since last session. Reducing load by ${Math.round(reductionPercent * 100)}% for safe return.`,
      flags,
      reasoning_breakdown: buildReasoningBreakdown({
        lastEntry,
        trainingStatus: 'insufficient_data',
        prescribedWeight: adjustedWeight,
        targetReps: null,
        phaseConfig,
        exerciseConfig,
        currentE1RM,
        previousE1RM
      })
    };
  }

  // =========================================================================
  // EDGE CASE: Post-Benchmark (exactly 1 session completed AND not returning from break)
  // =========================================================================
  if (sessionCount === 1) {
    // User has completed benchmark, now transitioning to progressive training
    const allDates = [...new Set(activeHistory.map(e => e.date))].sort();
    const benchmarkDate = allDates[0];
    const benchmarkHistory = activeHistory.filter(e => e.date === benchmarkDate);
    const benchmarkAnalysis = analyzeBenchmarkSession(benchmarkHistory, exercise);

    if (!benchmarkAnalysis.benchmarkCompleted) {
      // Fallback if benchmark analysis fails
      flags.push('benchmark_analysis_failed');
      return {
        exercise,
        prescription: {
          sets: 3,
          reps: '8-10',
          weight_kg: null,
          rest_seconds: '120',
          rir_target: 3
        },
        intensity_percent: 60,
        calculated_e1rm_kg: 0,
        training_status: 'insufficient_data',
        progression_rationale: 'Unable to analyze benchmark session. Please ensure you logged at least one set with weight and reps.',
        flags,
        reasoning_breakdown: buildReasoningBreakdown({
          lastEntry: null,
          trainingStatus: 'insufficient_data',
          prescribedWeight: null,
          targetReps: null,
          phaseConfig,
          exerciseConfig,
          currentE1RM: 0,
          previousE1RM: 0
        })
      };
    }

    flags.push('post_benchmark_first_prescription');

    // Use benchmark e1RM as baseline
    const baselineE1RM = benchmarkAnalysis.highestE1RM;
    const targetIntensity = (phaseConfig.intensity_range[0] + phaseConfig.intensity_range[1]) / 2;
    const targetWeight = baselineE1RM * targetIntensity;
    const prescribedWeight = roundToIncrement(targetWeight);
    const targetReps = Math.floor((phaseConfig.rep_min + phaseConfig.rep_max) / 2);
    const adjustedSets = getAdjustedSets(phaseConfig.base_sets, userAge);

    return {
      exercise,
      benchmark_mode: false,
      benchmark_baseline: {
        e1rm: benchmarkAnalysis.highestE1RM,
        bestSet: benchmarkAnalysis.bestSet,
        sessionDate: benchmarkDate
      },
      prescription: {
        sets: adjustedSets,
        reps: `${phaseConfig.rep_min}-${phaseConfig.rep_max}`,
        target_reps: targetReps,
        weight_kg: prescribedWeight,
        rest_seconds: phaseConfig.rest_seconds,
        rir_target: phaseConfig.rir_target
      },
      intensity_percent: Math.round(targetIntensity * 100),
      calculated_e1rm_kg: baselineE1RM,
      training_status: 'progressive',
      progression_rationale: `Benchmark complete! Your baseline: ${Math.round(baselineE1RM)}kg e1RM. Starting ${phase} training at ${Math.round(targetIntensity * 100)}% intensity.`,
      flags,
      reasoning_breakdown: {
        last_session: `Benchmark: ${benchmarkAnalysis.bestSet.weight}kg × ${benchmarkAnalysis.bestSet.reps} reps`,
        trend: 'Baseline established',
        next_step: `Progressive training begins at ${prescribedWeight}kg`,
        calculation: `${Math.round(targetIntensity * 100)}% of ${Math.round(baselineE1RM)}kg e1RM = ${prescribedWeight}kg`
      }
    };
  }

  // =========================================================================
  // Calculate e1RM values
  // =========================================================================
  const currentE1RM = getHighestE1RMInRange(activeHistory, 0, 14);
  const previousE1RM = getHighestE1RMInRange(activeHistory, 28, 42);
  const allTimeE1RM = Math.max(...activeHistory.map(e => calculateE1RM(e.weight, e.reps, e.rir)));

  // Use current e1RM, fallback to most recent entry
  let workingE1RM = currentE1RM;
  if (workingE1RM <= 0) {
    const lastEntry = getMostRecentEntry(activeHistory);
    workingE1RM = lastEntry ? calculateE1RM(lastEntry.weight, lastEntry.reps, lastEntry.rir) : 0;
  }

  // Apply e1RM modifier if applicable (e.g., front squat)
  if (exerciseConfig.e1rm_modifier) {
    workingE1RM = workingE1RM * exerciseConfig.e1rm_modifier;
  }


  // =========================================================================
  // EDGE CASE: Significant regression (e1RM dropped >10%)
  // =========================================================================
  if (previousE1RM > 0 && ((workingE1RM - previousE1RM) / previousE1RM) < -0.10) {
    flags.push('significant_strength_loss_detected');
    // Use current e1RM as baseline, not historical peak
    workingE1RM = currentE1RM > 0 ? currentE1RM : workingE1RM;
  }

  // =========================================================================
  // EDGE CASE: High rep data (>15 reps)
  // =========================================================================
  const lastEntry = getMostRecentEntry(activeHistory);
  if (lastEntry && lastEntry.reps > 15) {
    flags.push('high_rep_data_detected_e1rm_estimated');
  }

  // =========================================================================
  // Determine training status
  // =========================================================================
  const trainingStatus = determineTrainingStatus(currentE1RM, previousE1RM, sessionCount, activeHistory);

  // =========================================================================
  // Calculate base prescription
  // =========================================================================
  const lastWeight = getLastSessionWeight(activeHistory) || 0;
  const targetIntensity = (phaseConfig.intensity_range[0] + phaseConfig.intensity_range[1]) / 2;
  let prescribedWeight = roundToIncrement(workingE1RM * targetIntensity);
  const adjustedSets = getAdjustedSets(phaseConfig.base_sets, userAge);
  let rirTarget = phaseConfig.rir_target;

  // Apply RIR adjustment for specific exercises
  if (exerciseConfig.rir_adjustment) {
    rirTarget = rirTarget + exerciseConfig.rir_adjustment;
  }

  let rationale = '';
  let targetReps = null; // Specific target reps (when doing rep progression)

  // =========================================================================
  // Apply progression logic based on training status
  // =========================================================================

  if (trainingStatus === 'progressing') {
    const hitTop = hitTopOfRepRange(activeHistory, phaseConfig.rep_max);
    const lastRIR = lastEntry?.rir;
    const rirAtOrBelowTarget = lastRIR === undefined || lastRIR <= phaseConfig.rir_target;

    if (hitTop && rirAtOrBelowTarget) {
      // Increase load, reset to bottom of rep range
      prescribedWeight = roundToIncrement(lastWeight + exerciseConfig.load_increment);
      const prescribedE1RM = calculateE1RM(prescribedWeight, phaseConfig.rep_min, phaseConfig.rir_target);
      const lastE1RM = calculateE1RM(lastEntry.weight, lastEntry.reps, lastEntry.rir);
      const changePercent = lastE1RM > 0 ? ((prescribedE1RM - lastE1RM) / lastE1RM * 100) : 0;
      rationale = `Hit ${phaseConfig.rep_max} reps at RIR ${lastRIR ?? '~2'}. Increasing load by ${exerciseConfig.load_increment}kg (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% est. 1RM change).`;
      targetReps = phaseConfig.rep_min; // Start at bottom of range with new weight
    } else {
      // Keep weight, target +1 rep
      prescribedWeight = lastWeight > 0 ? lastWeight : prescribedWeight;
      targetReps = lastEntry ? Math.min(lastEntry.reps + 1, phaseConfig.rep_max) : null;
      const prescribedE1RM = targetReps ? calculateE1RM(prescribedWeight, targetReps, phaseConfig.rir_target) : 0;
      const lastE1RM = calculateE1RM(lastEntry.weight, lastEntry.reps, lastEntry.rir);
      const changePercent = lastE1RM > 0 ? ((prescribedE1RM - lastE1RM) / lastE1RM * 100) : 0;
      rationale = `Progress continues. Aim for ${targetReps} reps per set (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% est. 1RM change).`;
    }
  } else if (trainingStatus === 'plateau') {
    const isPlateau = detectPlateau(activeHistory);

    if (isPlateau) {
      // Simple plateau count based on consecutive sessions at same weight
      const plateauCount = activeHistory.filter(e => e.weight === lastWeight).length;
      const strategy = getPlateauStrategy(exercise, plateauCount);
      const lastE1RM = calculateE1RM(lastEntry.weight, lastEntry.reps, lastEntry.rir);

      switch (strategy) {
        case 'micro_load':
          prescribedWeight = roundToIncrement(lastWeight + (exerciseConfig.load_increment / 2));
          targetReps = phaseConfig.rep_min; // Start at bottom with new weight
          const microLoadE1RM = calculateE1RM(prescribedWeight, targetReps, phaseConfig.rir_target);
          const microLoadChange = lastE1RM > 0 ? ((microLoadE1RM - lastE1RM) / lastE1RM * 100) : 0;
          rationale = `Plateau detected. Applying micro-load: +${exerciseConfig.load_increment / 2}kg (${microLoadChange > 0 ? '+' : ''}${microLoadChange.toFixed(1)}% est. 1RM change).`;
          break;
        case 'add_set':
          // Note: sets already calculated, this is a suggestion
          prescribedWeight = lastWeight;
          rationale = `Plateau detected. Consider adding 1 set to increase volume (0.0% est. 1RM change).`;
          break;
        case 'extend_rep_ceiling':
          prescribedWeight = lastWeight;
          targetReps = phaseConfig.rep_max + 2;
          const extendedE1RM = calculateE1RM(prescribedWeight, targetReps, phaseConfig.rir_target);
          const extendedChange = lastE1RM > 0 ? ((extendedE1RM - lastE1RM) / lastE1RM * 100) : 0;
          rationale = `Plateau detected. Extending rep ceiling. Aim for ${targetReps} reps (${extendedChange > 0 ? '+' : ''}${extendedChange.toFixed(1)}% est. 1RM change).`;
          break;
        case 'reset':
          prescribedWeight = roundToIncrement(lastWeight * 0.9);
          targetReps = phaseConfig.rep_max; // Aim for top of range with reduced weight
          const resetE1RM = calculateE1RM(prescribedWeight, targetReps, phaseConfig.rir_target);
          const resetChange = lastE1RM > 0 ? ((resetE1RM - lastE1RM) / lastE1RM * 100) : 0;
          rationale = `Plateau detected. Resetting: reduce weight 10%, rebuild (${resetChange.toFixed(1)}% est. 1RM change).`;
          break;
      }
      flags.push('plateau_strategy_applied');
    } else {
      prescribedWeight = lastWeight > 0 ? lastWeight : prescribedWeight;
      targetReps = lastEntry ? Math.min(lastEntry.reps + 1, phaseConfig.rep_max) : null;
      const stableE1RM = targetReps ? calculateE1RM(prescribedWeight, targetReps, phaseConfig.rir_target) : 0;
      const lastE1RM = calculateE1RM(lastEntry.weight, lastEntry.reps, lastEntry.rir);
      const stableChange = lastE1RM > 0 ? ((stableE1RM - lastE1RM) / lastE1RM * 100) : 0;
      rationale = `Stable performance. Push for ${targetReps || 'more'} reps to break through (${stableChange > 0 ? '+' : ''}${stableChange.toFixed(1)}% est. 1RM change).`;
    }
  } else if (trainingStatus === 'regressing') {
    // Reduce sets by 50%, intensity to 75% of working weight
    const deloadSets = Math.max(2, Math.round(adjustedSets * 0.5));
    prescribedWeight = roundToIncrement(lastWeight * 0.75);
    flags.push('recovery_week_recommended');
    rationale = 'Performance declining. Deload recommended.';

    return {
      exercise,
      prescription: {
        sets: deloadSets,
        reps: phaseConfig.rep_range,
        weight_kg: prescribedWeight,
        rest_seconds: phaseConfig.rest_seconds,
        rir_target: rirTarget + 2 // Extra RIR for recovery
      },
      intensity_percent: Math.round(0.75 * targetIntensity * 100),
      calculated_e1rm_kg: Math.round(workingE1RM * 10) / 10,
      training_status: trainingStatus,
      progression_rationale: rationale,
      flags,
      reasoning_breakdown: buildReasoningBreakdown({
        lastEntry,
        trainingStatus,
        prescribedWeight,
        targetReps: null, // Deload shows range, not specific target
        phaseConfig,
        exerciseConfig,
        currentE1RM,
        previousE1RM
      })
    };
  } else if (trainingStatus === 'insufficient_data') {
    // Even with insufficient long-term data, look at last session for progression
    if (lastEntry && lastWeight > 0) {
      const lastE1RM = calculateE1RM(lastEntry.weight, lastEntry.reps, lastEntry.rir);
      const lastRIR = lastEntry.rir;
      const rirAtOrBelowTarget = lastRIR === undefined || lastRIR <= phaseConfig.rir_target;

      // Apply progressive overload based on last session
      if (lastEntry.reps >= phaseConfig.rep_max && rirAtOrBelowTarget) {
        // Hit top of rep range - increase weight
        prescribedWeight = roundToIncrement(lastWeight + exerciseConfig.load_increment);
        targetReps = phaseConfig.rep_min;
        const prescribedE1RM = calculateE1RM(prescribedWeight, targetReps, phaseConfig.rir_target);
        const changePercent = lastE1RM > 0 ? ((prescribedE1RM - lastE1RM) / lastE1RM * 100) : 0;
        rationale = `Building on last session (${lastWeight}kg × ${lastEntry.reps}). Increasing weight to ${prescribedWeight}kg, aim for ${targetReps} reps (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% est. 1RM change).`;
      } else if (lastEntry.reps >= phaseConfig.rep_min) {
        // In rep range - aim for +1 rep
        prescribedWeight = lastWeight;
        targetReps = Math.min(lastEntry.reps + 1, phaseConfig.rep_max);
        const prescribedE1RM = calculateE1RM(prescribedWeight, targetReps, phaseConfig.rir_target);
        const changePercent = lastE1RM > 0 ? ((prescribedE1RM - lastE1RM) / lastE1RM * 100) : 0;
        rationale = `Building on last session (${lastWeight}kg × ${lastEntry.reps}). Aim for ${targetReps} reps (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% est. 1RM change).`;
      } else {
        // Below rep range - consolidate at same weight
        prescribedWeight = lastWeight;
        targetReps = phaseConfig.rep_min;
        const prescribedE1RM = calculateE1RM(prescribedWeight, targetReps, phaseConfig.rir_target);
        const changePercent = lastE1RM > 0 ? ((prescribedE1RM - lastE1RM) / lastE1RM * 100) : 0;
        rationale = `Consolidating at ${lastWeight}kg. Target ${targetReps} reps to reach training range (${changePercent > 0 ? '+' : ''}${changePercent.toFixed(1)}% est. 1RM change).`;
      }
      flags.push('progressive_loading_from_recent_session');
    } else {
      // No recent session data - truly establishing baseline
      prescribedWeight = roundToIncrement(workingE1RM * 0.70); // Increased from 0.60 to 0.70
      flags.push('baseline_establishment_phase');
      rationale = 'Establishing baseline. Start conservative and progress from here.';
    }
  }

  // =========================================================================
  // Build final recommendation
  // =========================================================================

  return {
    exercise,
    prescription: {
      sets: adjustedSets,
      reps: phaseConfig.rep_range,
      target_reps: targetReps, // Specific target when doing rep progression
      weight_kg: prescribedWeight,
      rest_seconds: phaseConfig.rest_seconds,
      rir_target: rirTarget
    },
    intensity_percent: Math.round((prescribedWeight / workingE1RM) * 100) || Math.round(targetIntensity * 100),
    calculated_e1rm_kg: Math.round(workingE1RM * 10) / 10,
    training_status: trainingStatus,
    progression_rationale: rationale,
    flags: flags.length > 0 ? flags : null,
    reasoning_breakdown: buildReasoningBreakdown({
      lastEntry,
      trainingStatus,
      prescribedWeight,
      targetReps,
      phaseConfig,
      exerciseConfig,
      currentE1RM,
      previousE1RM
    })
  };
}

// ============================================================================
// LEGACY ADAPTER
// ============================================================================

/**
 * Adapter function to maintain compatibility with existing UI
 * Converts new recommendation format to the old format expected by the UI
 *
 * @param {ExerciseRecommendation} recommendation
 * @returns {Object} Legacy format recommendation
 */
export function toLegacyFormat(recommendation) {
  if (!recommendation) return null;

  // Use specific target_reps if available, otherwise parse rep range
  let targetReps = 8;
  if (recommendation.prescription.target_reps) {
    // Use the specific target when doing rep progression
    targetReps = recommendation.prescription.target_reps;
  } else if (typeof recommendation.prescription.reps === 'string') {
    const match = recommendation.prescription.reps.match(/(\d+)-(\d+)/);
    if (match) {
      targetReps = parseInt(match[1]); // Use bottom of range
    }
  } else {
    targetReps = recommendation.prescription.reps;
  }

  // Map training status to legacy status
  const statusMap = {
    'progressing': 'progress',
    'plateau': 'maintain',
    'regressing': 'deload',
    'insufficient_data': 'maintain'
  };

  const legacyStatus = recommendation.flags?.includes('recovery_week_recommended')
    ? 'deload'
    : statusMap[recommendation.training_status] || 'maintain';

  return {
    exerciseName: recommendation.exercise,
    currentPerformance: {
      weight: recommendation.prescription.weight_kg,
      reps: targetReps,
      sets: recommendation.prescription.sets,
      totalReps: targetReps * recommendation.prescription.sets
    },
    nextWorkout: {
      weight: recommendation.prescription.weight_kg,
      targetReps: targetReps,
      sets: recommendation.prescription.sets
    },
    status: legacyStatus,
    message: recommendation.progression_rationale,
    plateauDetected: recommendation.flags?.includes('plateau_strategy_applied') || false,
    deloadRecommended: recommendation.flags?.includes('recovery_week_recommended') || false,
    // New fields available for UI enhancement
    intensity_percent: recommendation.intensity_percent,
    calculated_e1rm_kg: recommendation.calculated_e1rm_kg,
    training_status: recommendation.training_status,
    flags: recommendation.flags,
    prescription: recommendation.prescription,
    reasoning_breakdown: recommendation.reasoning_breakdown
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  generateRecommendation,
  toLegacyFormat,
  calculateE1RM,
  getAgeMultiplier,
  getAdjustedSets,
  determineTrainingStatus,
  PHASE_CONFIG,
  EXERCISE_CONFIG,
  getExerciseConfig
};

// Export analyzeBenchmarkSession for UI use
export { analyzeBenchmarkSession };
