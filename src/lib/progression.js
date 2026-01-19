/**
 * Double Progression Module
 *
 * Implements the double progression system for strength training:
 * - Work within a rep range (e.g., 8-12 reps)
 * - When top of range is hit for ALL sets → increase weight, reset to bottom of range
 * - If not all sets hit top → maintain weight, aim to increase reps
 * - Significant overperformance → double weight increment
 * - 3 sessions without progress → deload recommendation
 */

// Default configuration
const DEFAULT_CONFIG = {
  repRange: { min: 8, max: 12 },
  weightIncrement: 2.5, // kg - standard increment
  doubleJumpThreshold: 3, // reps over max to trigger double increment
  plateauSessionCount: 3, // sessions without progress before deload
  deloadPercentage: 0.1, // 10% weight reduction for deload
};

// Exercise-specific configurations (some exercises progress slower)
const EXERCISE_CONFIG = {
  'Squat': { weightIncrement: 2.5, repRange: { min: 5, max: 8 } },
  'Deadlift': { weightIncrement: 2.5, repRange: { min: 5, max: 8 } },
  'Bench Press': { weightIncrement: 2.5, repRange: { min: 6, max: 10 } },
  'Overhead Press': { weightIncrement: 1.25, repRange: { min: 6, max: 10 } }, // Slower progression
  'Barbell Row': { weightIncrement: 2.5, repRange: { min: 6, max: 10 } },
};

/**
 * Get configuration for a specific exercise
 * @param {string} exerciseName - Name of the exercise
 * @returns {Object} Configuration object
 */
export function getExerciseConfig(exerciseName) {
  return {
    ...DEFAULT_CONFIG,
    ...EXERCISE_CONFIG[exerciseName],
  };
}

/**
 * Calculate total volume (reps × sets) for comparison
 * @param {number} reps - Reps per set
 * @param {number} sets - Number of sets
 * @returns {number} Total rep volume
 */
function calculateTotalReps(reps, sets) {
  return reps * sets;
}

/**
 * Analyze current workout performance and recommend next workout
 * @param {Object} currentWorkout - Current workout data { weight, reps, sets }
 * @param {string} exerciseName - Name of the exercise
 * @param {Array} history - Previous workout entries for this exercise (most recent first)
 * @returns {Object} Recommendation object
 */
export function getNextWorkoutRecommendation(currentWorkout, exerciseName, history = []) {
  const config = getExerciseConfig(exerciseName);
  const { repRange, weightIncrement, doubleJumpThreshold, plateauSessionCount, deloadPercentage } = config;

  const { weight, reps, sets } = currentWorkout;
  const totalReps = calculateTotalReps(reps, sets);

  // Determine performance status
  const hitTopOfRange = reps >= repRange.max;
  const exceededByMargin = reps >= repRange.max + doubleJumpThreshold;
  const belowMinRange = reps < repRange.min;

  // Check for plateau (3 sessions without total rep increase at same weight)
  const plateauDetected = detectPlateau(currentWorkout, history, plateauSessionCount);

  let recommendation = {
    exerciseName,
    currentPerformance: {
      weight,
      reps,
      sets,
      totalReps,
    },
    nextWorkout: {
      weight: weight,
      targetReps: reps,
      sets: sets,
    },
    status: 'maintain',
    message: '',
    plateauDetected: false,
    deloadRecommended: false,
  };

  // CASE 1: Plateau detected - recommend deload
  if (plateauDetected) {
    const deloadWeight = Math.round((weight * (1 - deloadPercentage)) / 2.5) * 2.5;
    recommendation.nextWorkout.weight = Math.max(deloadWeight, weightIncrement * 4); // Don't go too low
    recommendation.nextWorkout.targetReps = repRange.min;
    recommendation.status = 'deload';
    recommendation.plateauDetected = true;
    recommendation.deloadRecommended = true;
    recommendation.message = `Plateau detected after ${plateauSessionCount} sessions. Deload to ${recommendation.nextWorkout.weight}kg and rebuild.`;
    return recommendation;
  }

  // CASE 2: Significantly exceeded top of range - DOUBLE weight increase
  if (exceededByMargin) {
    const doubleIncrement = weightIncrement * 2;
    recommendation.nextWorkout.weight = weight + doubleIncrement;
    recommendation.nextWorkout.targetReps = repRange.min;
    recommendation.status = 'double_jump';
    recommendation.message = `Excellent! You exceeded ${repRange.max} reps by ${reps - repRange.max}. Double jump: +${doubleIncrement}kg → ${recommendation.nextWorkout.weight}kg × ${repRange.min} reps`;
    return recommendation;
  }

  // CASE 3: Hit top of range for all sets - increase weight
  if (hitTopOfRange) {
    recommendation.nextWorkout.weight = weight + weightIncrement;
    recommendation.nextWorkout.targetReps = repRange.min;
    recommendation.status = 'progress';
    recommendation.message = `Great work! You hit ${repRange.max} reps. Progress: +${weightIncrement}kg → ${recommendation.nextWorkout.weight}kg × ${repRange.min} reps`;
    return recommendation;
  }

  // CASE 4: Below minimum range - might be too heavy
  if (belowMinRange) {
    recommendation.nextWorkout.targetReps = repRange.min;
    recommendation.status = 'struggle';
    recommendation.message = `Below target range (${repRange.min}-${repRange.max}). Stay at ${weight}kg and aim for ${repRange.min}+ reps next session.`;
    return recommendation;
  }

  // CASE 5: Within range but not at top - maintain and push for more reps
  recommendation.nextWorkout.targetReps = Math.min(reps + 1, repRange.max);
  recommendation.status = 'maintain';
  recommendation.message = `Good session! Stay at ${weight}kg and aim for ${recommendation.nextWorkout.targetReps} reps to progress.`;

  return recommendation;
}

/**
 * Detect if user has plateaued (no progress for N sessions at same weight)
 * @param {Object} currentWorkout - Current workout
 * @param {Array} history - Previous workouts (most recent first)
 * @param {number} sessionCount - Number of sessions to check
 * @returns {boolean} True if plateau detected
 */
function detectPlateau(currentWorkout, history, sessionCount) {
  if (history.length < sessionCount - 1) return false;

  // Get recent sessions at the same weight
  const sameWeightSessions = history
    .filter(h => h.weight === currentWorkout.weight)
    .slice(0, sessionCount - 1);

  if (sameWeightSessions.length < sessionCount - 1) return false;

  // Check if total reps have not increased
  const currentTotal = calculateTotalReps(currentWorkout.reps, currentWorkout.sets);
  const previousTotals = sameWeightSessions.map(s => calculateTotalReps(s.reps, s.sets));

  // Plateau = current total <= all previous totals (no improvement)
  return previousTotals.every(total => currentTotal <= total);
}

/**
 * Generate a workout plan for multiple sets based on recommendation
 * @param {Object} recommendation - Recommendation from getNextWorkoutRecommendation
 * @returns {Object} Detailed workout plan
 */
export function generateWorkoutPlan(recommendation) {
  const { nextWorkout, exerciseName } = recommendation;
  const config = getExerciseConfig(exerciseName);

  return {
    exercise: exerciseName,
    weight: nextWorkout.weight,
    sets: nextWorkout.sets,
    targetReps: nextWorkout.targetReps,
    repRange: config.repRange,
    restTime: nextWorkout.weight > 100 ? '3-5 min' : '2-3 min', // Heavier = more rest
    notes: recommendation.message,
    warmupSets: generateWarmupSets(nextWorkout.weight, config.weightIncrement),
  };
}

/**
 * Generate warmup set recommendations
 * @param {number} workingWeight - Target working weight
 * @param {number} increment - Weight increment
 * @returns {Array} Array of warmup sets
 */
function generateWarmupSets(workingWeight, increment) {
  const warmups = [];

  if (workingWeight <= 40) {
    warmups.push({ weight: 20, reps: 10 });
  } else if (workingWeight <= 60) {
    warmups.push({ weight: 20, reps: 10 });
    warmups.push({ weight: Math.round(workingWeight * 0.5 / 2.5) * 2.5, reps: 8 });
  } else {
    warmups.push({ weight: 20, reps: 10 });
    warmups.push({ weight: Math.round(workingWeight * 0.4 / 2.5) * 2.5, reps: 8 });
    warmups.push({ weight: Math.round(workingWeight * 0.6 / 2.5) * 2.5, reps: 5 });
    warmups.push({ weight: Math.round(workingWeight * 0.8 / 2.5) * 2.5, reps: 3 });
  }

  return warmups;
}

/**
 * Analyze progression trend over multiple sessions
 * @param {Array} history - Workout history (most recent first)
 * @param {string} exerciseName - Exercise name
 * @returns {Object} Trend analysis
 */
export function analyzeProgressionTrend(history, exerciseName) {
  if (history.length < 2) {
    return {
      trend: 'insufficient_data',
      message: 'Need at least 2 sessions to analyze trend',
      weeklyProgress: null,
    };
  }

  const config = getExerciseConfig(exerciseName);

  // Calculate estimated 1RM for each session
  const sessions = history.map(h => ({
    ...h,
    estimated1RM: h.weight * (1 + h.reps / 30), // Epley formula
    totalVolume: h.weight * h.reps * h.sets,
  }));

  const firstSession = sessions[sessions.length - 1];
  const lastSession = sessions[0];

  const oneRMChange = lastSession.estimated1RM - firstSession.estimated1RM;
  const volumeChange = lastSession.totalVolume - firstSession.totalVolume;

  // Calculate time span
  const daysBetween = Math.max(1, Math.round(
    (new Date(lastSession.date) - new Date(firstSession.date)) / (1000 * 60 * 60 * 24)
  ));
  const weeksBetween = daysBetween / 7;

  const weeklyOneRMProgress = weeksBetween > 0 ? oneRMChange / weeksBetween : 0;

  let trend = 'stable';
  if (oneRMChange > 5) trend = 'progressing';
  else if (oneRMChange < -5) trend = 'regressing';

  return {
    trend,
    sessions: sessions.length,
    daysBetween,
    oneRMChange: Math.round(oneRMChange * 10) / 10,
    volumeChange: Math.round(volumeChange),
    weeklyProgress: Math.round(weeklyOneRMProgress * 10) / 10,
    message: trend === 'progressing'
      ? `Great progress! Estimated 1RM increased by ${Math.round(oneRMChange)}kg over ${sessions.length} sessions.`
      : trend === 'regressing'
        ? `Your estimated 1RM has decreased. Consider a deload or form check.`
        : `Stable performance. Keep pushing to break through!`,
  };
}

export { DEFAULT_CONFIG, EXERCISE_CONFIG };
