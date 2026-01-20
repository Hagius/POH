/**
 * Strength Standards Module
 *
 * Calculates strength levels based on 1RM relative to bodyweight.
 * Standards are based on commonly used strength level classifications.
 *
 * Levels:
 * - Beginner: Just started training (< 6 months)
 * - Intermediate: Training consistently (6 months - 2 years)
 * - Advanced: Serious lifter (2-5 years)
 * - Professional: Elite/competitive level (5+ years)
 */

// Strength standards as bodyweight multipliers for 1RM
// Format: { beginner, intermediate, advanced, professional }
// These represent the UPPER threshold for each level
const STRENGTH_STANDARDS = {
  male: {
    'Squat': { beginner: 0.75, intermediate: 1.25, advanced: 1.75, professional: 2.25 },
    'Deadlift': { beginner: 1.0, intermediate: 1.5, advanced: 2.0, professional: 2.5 },
    'Bench Press': { beginner: 0.5, intermediate: 1.0, advanced: 1.5, professional: 1.75 },
    'Overhead Press': { beginner: 0.35, intermediate: 0.65, advanced: 0.85, professional: 1.15 },
    'Barbell Row': { beginner: 0.5, intermediate: 0.75, advanced: 1.0, professional: 1.25 },
  },
  female: {
    'Squat': { beginner: 0.5, intermediate: 1.0, advanced: 1.5, professional: 2.0 },
    'Deadlift': { beginner: 0.75, intermediate: 1.25, advanced: 1.75, professional: 2.25 },
    'Bench Press': { beginner: 0.25, intermediate: 0.5, advanced: 0.75, professional: 1.0 },
    'Overhead Press': { beginner: 0.2, intermediate: 0.4, advanced: 0.6, professional: 0.8 },
    'Barbell Row': { beginner: 0.35, intermediate: 0.55, advanced: 0.75, professional: 1.0 },
  },
};

// Age adjustment factors (peak strength is typically 25-35)
function getAgeMultiplier(age) {
  if (age < 20) return 0.9;
  if (age < 25) return 0.95;
  if (age <= 35) return 1.0;
  if (age <= 40) return 0.95;
  if (age <= 50) return 0.9;
  if (age <= 60) return 0.85;
  return 0.8;
}

// Level colors for the chart - using core application colors
export const LEVEL_COLORS = {
  beginner: { fill: '#000000', stroke: '#000000', label: 'Beginner' },      // Black
  intermediate: { fill: '#6B7280', stroke: '#6B7280', label: 'Intermediate' }, // Muted gray
  advanced: { fill: '#00C805', stroke: '#00C805', label: 'Advanced' },      // Accent green
  professional: { fill: '#FFD700', stroke: '#FFD700', label: 'Professional' }, // Gold (rewards)
};

/**
 * Get strength level thresholds for a specific exercise based on user stats
 * @param {string} exercise - Exercise name
 * @param {string} sex - 'male' or 'female'
 * @param {number} bodyweight - User's bodyweight in kg
 * @param {number} age - User's age
 * @returns {Object} Thresholds in kg for each level
 */
export function getStrengthThresholds(exercise, sex, bodyweight, age) {
  const standards = STRENGTH_STANDARDS[sex]?.[exercise];
  if (!standards) {
    // Default standards if exercise not found
    return {
      beginner: bodyweight * 0.5,
      intermediate: bodyweight * 1.0,
      advanced: bodyweight * 1.5,
      professional: bodyweight * 2.0,
    };
  }

  const ageMultiplier = getAgeMultiplier(age);

  return {
    beginner: Math.round(bodyweight * standards.beginner * ageMultiplier),
    intermediate: Math.round(bodyweight * standards.intermediate * ageMultiplier),
    advanced: Math.round(bodyweight * standards.advanced * ageMultiplier),
    professional: Math.round(bodyweight * standards.professional * ageMultiplier),
  };
}

/**
 * Determine the strength level for a given 1RM
 * @param {number} oneRM - Estimated 1RM in kg
 * @param {Object} thresholds - Thresholds from getStrengthThresholds
 * @returns {string} Level name: 'beginner', 'intermediate', 'advanced', or 'professional'
 */
export function getStrengthLevel(oneRM, thresholds) {
  if (oneRM >= thresholds.professional) return 'professional';
  if (oneRM >= thresholds.advanced) return 'advanced';
  if (oneRM >= thresholds.intermediate) return 'intermediate';
  return 'beginner';
}

/**
 * Get display info for a strength level
 * @param {string} level - Level name
 * @returns {Object} Color and label info
 */
export function getLevelInfo(level) {
  return LEVEL_COLORS[level] || LEVEL_COLORS.beginner;
}

/**
 * Calculate percentage progress within current level
 * @param {number} oneRM - Current 1RM
 * @param {Object} thresholds - Level thresholds
 * @returns {Object} Current level, progress percentage, next level threshold
 */
export function getLevelProgress(oneRM, thresholds) {
  const level = getStrengthLevel(oneRM, thresholds);

  let lowerBound, upperBound, nextLevel;

  switch (level) {
    case 'beginner':
      lowerBound = 0;
      upperBound = thresholds.intermediate; // Beginner goes from 0 to intermediate threshold
      nextLevel = 'intermediate';
      break;
    case 'intermediate':
      lowerBound = thresholds.intermediate; // Intermediate starts at intermediate threshold
      upperBound = thresholds.advanced; // and goes to advanced threshold
      nextLevel = 'advanced';
      break;
    case 'advanced':
      lowerBound = thresholds.advanced; // Advanced starts at advanced threshold
      upperBound = thresholds.professional; // and goes to professional threshold
      nextLevel = 'professional';
      break;
    case 'professional':
      lowerBound = thresholds.professional; // Professional starts at professional threshold
      upperBound = thresholds.professional * 1.2; // Allow for beyond professional
      nextLevel = null;
      break;
    default:
      lowerBound = 0;
      upperBound = thresholds.intermediate;
      nextLevel = 'intermediate';
  }

  const range = upperBound - lowerBound;
  const progress = range > 0 ? Math.min(100, Math.round(((oneRM - lowerBound) / range) * 100)) : 100;

  return {
    level,
    progress,
    nextLevel,
    nextThreshold: nextLevel ? thresholds[nextLevel] : null,
    currentThreshold: upperBound,
  };
}
