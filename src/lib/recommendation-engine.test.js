/**
 * Unit Tests for Exercise Recommendation Engine
 *
 * Tests cover:
 * - e1RM calculation with and without RIR
 * - e1RM caps at 12 reps for high-rep entries
 * - Training status determination
 * - Age multiplier at boundaries
 * - Minimum 2 sets enforced
 * - Phase configuration
 * - Edge cases (first session, return from break)
 * - Exercise-specific increments
 */

import { describe, it, expect } from 'vitest';
import {
  calculateE1RM,
  getAgeMultiplier,
  getAdjustedSets,
  determineTrainingStatus,
  generateRecommendation,
  toLegacyFormat,
  PHASE_CONFIG,
  EXERCISE_CONFIG,
  getExerciseConfig,
  analyzeBenchmarkSession,
} from './recommendation-engine.js';

// ============================================================================
// e1RM CALCULATION TESTS
// ============================================================================

describe('calculateE1RM', () => {
  it('should calculate e1RM with RIR present', () => {
    // Brzycki: weight * (36 / (37 - effectiveReps))
    // 100kg x 5 reps with RIR 2 = 100 * (36 / (37 - 7)) = 100 * (36/30) = 120kg
    const result = calculateE1RM(100, 5, 2);
    expect(result).toBeCloseTo(120, 0);
  });

  it('should calculate e1RM with RIR missing (assumes RIR=2)', () => {
    // 100kg x 5 reps, RIR assumed 2 = effectiveReps 7
    // 100 * (36 / (37 - 7)) = 120kg
    const result = calculateE1RM(100, 5);
    expect(result).toBeCloseTo(120, 0);
  });

  it('should cap effective reps at 12 for high-rep entries', () => {
    // 50kg x 20 reps with RIR 0 = effectiveReps would be 20, capped at 12
    // 50 * (36 / (37 - 12)) = 50 * (36/25) = 72kg
    const result = calculateE1RM(50, 20, 0);
    expect(result).toBeCloseTo(72, 0);
  });

  it('should cap effective reps at 12 even with RIR', () => {
    // 50kg x 15 reps with RIR 5 = effectiveReps would be 20, capped at 12
    const result = calculateE1RM(50, 15, 5);
    expect(result).toBeCloseTo(72, 0);
  });

  it('should return 0 for invalid inputs', () => {
    expect(calculateE1RM(0, 5)).toBe(0);
    expect(calculateE1RM(100, 0)).toBe(0);
    expect(calculateE1RM(-10, 5)).toBe(0);
  });

  it('should handle single rep max (1RM)', () => {
    // 100kg x 1 rep with RIR 0 = effectiveReps 1
    // 100 * (36 / (37 - 1)) = 100 * (36/36) = 100kg
    const result = calculateE1RM(100, 1, 0);
    expect(result).toBeCloseTo(100, 0);
  });
});

// ============================================================================
// TRAINING STATUS TESTS
// ============================================================================

describe('determineTrainingStatus', () => {
  it('should return "progressing" for >2.5% gain with long-term data', () => {
    const result = determineTrainingStatus(105, 100, 5, []);
    expect(result).toBe('progressing');
  });

  it('should return "plateau" for changes within ±2.5% with long-term data', () => {
    const result = determineTrainingStatus(102, 100, 5, []);
    expect(result).toBe('plateau');
  });

  it('should return "regressing" for >2.5% loss with long-term data', () => {
    const result = determineTrainingStatus(95, 100, 5, []);
    expect(result).toBe('regressing');
  });

  it('should return "insufficient_data" for <2 sessions', () => {
    const result = determineTrainingStatus(105, 100, 1, []);
    expect(result).toBe('insufficient_data');
  });

  it('should detect short-term progression when no long-term data available', () => {
    // Two recent sessions showing progression
    const recentHistory = [
      { date: '2026-01-15', weight: 80, reps: 8, rir: 2, isActive: true },
      { date: '2026-01-18', weight: 82.5, reps: 8, rir: 2, isActive: true }
    ];
    const result = determineTrainingStatus(100, 0, 2, recentHistory);
    expect(result).toBe('progressing');
  });

  it('should detect short-term plateau when performance is stable', () => {
    // Recent sessions with stable performance
    const recentHistory = [
      { date: '2026-01-15', weight: 80, reps: 8, rir: 2, isActive: true },
      { date: '2026-01-18', weight: 80, reps: 8, rir: 2, isActive: true }
    ];
    const result = determineTrainingStatus(100, 0, 2, recentHistory);
    expect(result).toBe('plateau');
  });

  it('should return "insufficient_data" for zero previous e1RM and no recent history', () => {
    const result = determineTrainingStatus(100, 0, 5, []);
    expect(result).toBe('insufficient_data');
  });

  it('should handle exactly 2.5% gain as progressing', () => {
    const result = determineTrainingStatus(102.5, 100, 5, []);
    expect(result).toBe('progressing');
  });

  it('should handle exactly -2.5% loss as regressing', () => {
    const result = determineTrainingStatus(97.5, 100, 5, []);
    expect(result).toBe('regressing');
  });
});

// ============================================================================
// AGE MULTIPLIER TESTS
// ============================================================================

describe('getAgeMultiplier', () => {
  it('should return 1.0 for age <= 30', () => {
    expect(getAgeMultiplier(25)).toBe(1.0);
    expect(getAgeMultiplier(30)).toBe(1.0);
  });

  it('should return 0.95 for age 31-40', () => {
    expect(getAgeMultiplier(31)).toBe(0.95);
    expect(getAgeMultiplier(40)).toBe(0.95);
  });

  it('should return 0.85 for age 41-50', () => {
    expect(getAgeMultiplier(41)).toBe(0.85);
    expect(getAgeMultiplier(50)).toBe(0.85);
  });

  it('should return 0.75 for age 51-60', () => {
    expect(getAgeMultiplier(51)).toBe(0.75);
    expect(getAgeMultiplier(60)).toBe(0.75);
  });

  it('should return 0.65 for age > 60', () => {
    expect(getAgeMultiplier(61)).toBe(0.65);
    expect(getAgeMultiplier(70)).toBe(0.65);
  });
});

describe('getAdjustedSets', () => {
  it('should return base sets for age <= 30', () => {
    expect(getAdjustedSets(4, 25)).toBe(4);
  });

  it('should reduce sets for older ages', () => {
    // 4 sets * 0.75 = 3 sets for age 55
    expect(getAdjustedSets(4, 55)).toBe(3);
  });

  it('should enforce minimum of 2 sets', () => {
    // 2 sets * 0.65 = 1.3, rounded to 1, but minimum is 2
    expect(getAdjustedSets(2, 70)).toBe(2);
  });

  it('should handle 55-year-old getting ~15% fewer sets than 25-year-old', () => {
    const youngSets = getAdjustedSets(5, 25);  // 5 * 1.0 = 5
    const olderSets = getAdjustedSets(5, 55);  // 5 * 0.75 = 3.75 -> 4
    expect(youngSets).toBe(5);
    expect(olderSets).toBe(4);
    // Difference is 20%, which is approximately what we expect
    expect((youngSets - olderSets) / youngSets).toBeGreaterThanOrEqual(0.15);
  });
});

// ============================================================================
// PHASE CONFIGURATION TESTS
// ============================================================================

describe('PHASE_CONFIG', () => {
  it('should have correct hypertrophy config', () => {
    const config = PHASE_CONFIG.hypertrophy;
    expect(config.rep_range).toBe('8-12');
    expect(config.intensity_range[0]).toBeGreaterThanOrEqual(0.65);
    expect(config.intensity_range[1]).toBeLessThanOrEqual(0.75);
    expect(config.rest_seconds).toBe('90-120');
  });

  it('should have correct strength config', () => {
    const config = PHASE_CONFIG.strength;
    expect(config.rep_range).toBe('4-6');
    expect(config.intensity_range[0]).toBeGreaterThanOrEqual(0.80);
    expect(config.intensity_range[1]).toBeLessThanOrEqual(0.88);
    expect(config.rest_seconds).toBe('180-300');
  });

  it('should have correct peaking config', () => {
    const config = PHASE_CONFIG.peaking;
    expect(config.rep_range).toBe('1-3');
    expect(config.intensity_range[0]).toBeGreaterThanOrEqual(0.90);
    expect(config.intensity_range[1]).toBeLessThanOrEqual(0.97);
    expect(config.rest_seconds).toBe('300-420');
  });

  it('should have correct explosive config', () => {
    const config = PHASE_CONFIG.explosive;
    expect(config.rep_range).toBe('2-5');
    expect(config.intensity_range[0]).toBeGreaterThanOrEqual(0.50);
    expect(config.intensity_range[1]).toBeLessThanOrEqual(0.70);
    expect(config.rest_seconds).toBe('120-180');
  });
});

// ============================================================================
// EXERCISE CONFIG TESTS
// ============================================================================

describe('getExerciseConfig', () => {
  it('should return correct config for Overhead Press (1.25kg increments)', () => {
    const config = getExerciseConfig('Overhead Press');
    expect(config.load_increment).toBe(1.25);
  });

  it('should return correct config for Deadlift (5kg increments)', () => {
    const config = getExerciseConfig('Deadlift');
    expect(config.load_increment).toBe(5);
  });

  it('should return correct config for Squat (5kg increments)', () => {
    const config = getExerciseConfig('Squat');
    expect(config.load_increment).toBe(5);
  });

  it('should return correct config for Bench Press (2.5kg increments)', () => {
    const config = getExerciseConfig('Bench Press');
    expect(config.load_increment).toBe(2.5);
  });

  it('should return default config for unknown exercises', () => {
    const config = getExerciseConfig('Unknown Exercise');
    expect(config.load_increment).toBe(2.5);
    expect(config.max_weekly_sets).toBe(16);
  });
});

// ============================================================================
// FIRST SESSION EDGE CASE
// ============================================================================

describe('generateRecommendation - First Session', () => {
  it('should return benchmark mode for no history', () => {
    const recommendation = generateRecommendation({
      exercise: 'Squat',
      history: [],
      userAge: 30,
      phase: 'hypertrophy'
    });

    expect(recommendation.flags).toContain('benchmark_mode');
    expect(recommendation.benchmark_mode).toBe(true);
    expect(recommendation.prescription.sets).toBe('3-5');
    expect(recommendation.prescription.reps).toBe('5-12');
    expect(recommendation.prescription.weight_kg).toBeNull();
    expect(recommendation.training_status).toBe('benchmark_mode');
    expect(recommendation.progression_rationale).toContain('benchmark');
  });
});

// ============================================================================
// RETURN FROM BREAK EDGE CASE
// ============================================================================

describe('generateRecommendation - Return from Break', () => {
  it('should reduce load by 10% for >14 days break', () => {
    const history = [
      {
        id: '1',
        name: 'Squat',
        date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 20 days ago
        weight: 100,
        reps: 8,
        sets: 4,
        isActive: true
      }
    ];

    const recommendation = generateRecommendation({
      exercise: 'Squat',
      history,
      userAge: 30,
      phase: 'hypertrophy'
    });

    expect(recommendation.flags).toContain('returning_from_break');
    expect(recommendation.progression_rationale).toContain('days since last session');
    expect(recommendation.progression_rationale).toContain('10%');
  });

  it('should reduce load by 15% for >28 days break', () => {
    const history = [
      {
        id: '1',
        name: 'Squat',
        date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 35 days ago
        weight: 100,
        reps: 8,
        sets: 4,
        isActive: true
      }
    ];

    const recommendation = generateRecommendation({
      exercise: 'Squat',
      history,
      userAge: 30,
      phase: 'hypertrophy'
    });

    expect(recommendation.flags).toContain('returning_from_break');
    expect(recommendation.progression_rationale).toContain('15%');
  });
});

// ============================================================================
// FULL RECOMMENDATION GENERATION
// ============================================================================

describe('generateRecommendation - Full Workflow', () => {
  const createHistory = (days) => {
    return days.map((daysAgo, index) => ({
      id: `entry-${index}`,
      name: 'Squat',
      date: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      weight: 100 + index * 2.5,
      reps: 8,
      sets: 4,
      isActive: true
    }));
  };

  it('should generate valid recommendation for progressing status', () => {
    // Create history showing progression
    const history = [
      { id: '1', name: 'Squat', date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], weight: 110, reps: 8, sets: 4, isActive: true },
      { id: '2', name: 'Squat', date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], weight: 107.5, reps: 8, sets: 4, isActive: true },
      { id: '3', name: 'Squat', date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], weight: 105, reps: 8, sets: 4, isActive: true },
      { id: '4', name: 'Squat', date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], weight: 100, reps: 8, sets: 4, isActive: true },
    ];

    const recommendation = generateRecommendation({
      exercise: 'Squat',
      history,
      userAge: 30,
      phase: 'hypertrophy'
    });

    expect(recommendation.exercise).toBe('Squat');
    expect(recommendation.prescription.sets).toBeGreaterThanOrEqual(2);
    expect(recommendation.prescription.weight_kg).toBeGreaterThan(0);
    expect(recommendation.calculated_e1rm_kg).toBeGreaterThan(0);
    expect(['progressing', 'plateau', 'regressing', 'insufficient_data']).toContain(recommendation.training_status);
  });

  it('should respect phase-specific rep ranges', () => {
    const history = createHistory([1, 3, 5, 7, 35]);

    const hypertrophyRec = generateRecommendation({
      exercise: 'Squat',
      history,
      userAge: 30,
      phase: 'hypertrophy'
    });

    const strengthRec = generateRecommendation({
      exercise: 'Squat',
      history,
      userAge: 30,
      phase: 'strength'
    });

    expect(hypertrophyRec.prescription.reps).toBe('8-12');
    expect(strengthRec.prescription.reps).toBe('4-6');
  });
});

// ============================================================================
// LEGACY FORMAT ADAPTER TESTS
// ============================================================================

describe('toLegacyFormat', () => {
  it('should convert new format to legacy format', () => {
    const newFormat = {
      exercise: 'Squat',
      prescription: {
        sets: 4,
        reps: '8-12',
        weight_kg: 100,
        rest_seconds: '90-120',
        rir_target: 2
      },
      intensity_percent: 70,
      calculated_e1rm_kg: 140,
      training_status: 'progressing',
      progression_rationale: 'Test rationale',
      flags: null
    };

    const legacy = toLegacyFormat(newFormat);

    expect(legacy.exerciseName).toBe('Squat');
    expect(legacy.nextWorkout.weight).toBe(100);
    expect(legacy.nextWorkout.targetReps).toBe(8); // Bottom of range
    expect(legacy.nextWorkout.sets).toBe(4);
    expect(legacy.status).toBe('progress');
    expect(legacy.message).toBe('Test rationale');
  });

  it('should return null for null input', () => {
    expect(toLegacyFormat(null)).toBeNull();
  });

  it('should map regressing status to deload', () => {
    const newFormat = {
      exercise: 'Squat',
      prescription: {
        sets: 2,
        reps: '8-12',
        weight_kg: 75,
        rest_seconds: '90-120',
        rir_target: 4
      },
      intensity_percent: 53,
      calculated_e1rm_kg: 140,
      training_status: 'regressing',
      progression_rationale: 'Deload recommended',
      flags: ['recovery_week_recommended']
    };

    const legacy = toLegacyFormat(newFormat);
    expect(legacy.status).toBe('deload');
    expect(legacy.deloadRecommended).toBe(true);
  });
});

// ============================================================================
// OUTPUT INTERFACE VALIDATION
// ============================================================================

describe('Output Interface Validation', () => {
  it('should match ExerciseRecommendation interface', () => {
    const recommendation = generateRecommendation({
      exercise: 'Bench Press',
      history: [
        { id: '1', name: 'Bench Press', date: new Date().toISOString().split('T')[0], weight: 80, reps: 10, sets: 4, isActive: true }
      ],
      userAge: 35,
      phase: 'strength'
    });

    // Validate all required fields exist
    expect(recommendation).toHaveProperty('exercise');
    expect(recommendation).toHaveProperty('prescription');
    expect(recommendation).toHaveProperty('prescription.sets');
    expect(recommendation).toHaveProperty('prescription.reps');
    expect(recommendation).toHaveProperty('prescription.weight_kg');
    expect(recommendation).toHaveProperty('prescription.rest_seconds');
    expect(recommendation).toHaveProperty('prescription.rir_target');
    expect(recommendation).toHaveProperty('intensity_percent');
    expect(recommendation).toHaveProperty('calculated_e1rm_kg');
    expect(recommendation).toHaveProperty('training_status');
    expect(recommendation).toHaveProperty('progression_rationale');
    expect(recommendation).toHaveProperty('flags');

    // Validate types
    expect(typeof recommendation.exercise).toBe('string');
    expect(typeof recommendation.prescription.sets).toBe('number');
    expect(typeof recommendation.intensity_percent).toBe('number');
    expect(typeof recommendation.calculated_e1rm_kg).toBe('number');
    expect(typeof recommendation.progression_rationale).toBe('string');
    expect(['progressing', 'plateau', 'regressing', 'insufficient_data', 'benchmark_mode', 'progressive']).toContain(recommendation.training_status);
    expect(recommendation.flags === null || Array.isArray(recommendation.flags)).toBe(true);
  });
});

// ============================================================================
// BENCHMARK MODE TESTS
// ============================================================================

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
    expect(recommendation.prescription.weight_kg).toBeNull();
    expect(recommendation.prescription.benchmark_instructions).toBeDefined();
    expect(recommendation.prescription.benchmark_instructions.instructions).toHaveLength(4);
  });

  it('should analyze benchmark session correctly with multiple sets', () => {
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
    // 80kg × 6 reps (RIR 1) = effective 7 reps = 96kg e1RM
    // 85kg × 4 reps (RIR 0) = effective 4 reps = 92.7kg e1RM
    // So 80kg set has highest e1RM
    expect(analysis.bestSet.weight).toBe(80);
    expect(analysis.allSets).toHaveLength(4);
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
    expect(recommendation.benchmark_baseline.bestSet).toBeDefined();
    expect(recommendation.training_status).toBe('progressive');
  });

  it('should handle single set benchmark', () => {
    const benchmarkHistory = [
      { date: '2026-01-20', weight: 50, reps: 10, rir: 3, isActive: true },
    ];

    const analysis = analyzeBenchmarkSession(benchmarkHistory, 'Overhead Press');

    expect(analysis.benchmarkCompleted).toBe(true);
    expect(analysis.totalSets).toBe(1);
    expect(analysis.bestSet.weight).toBe(50);
    expect(analysis.highestE1RM).toBeGreaterThan(0);
  });

  it('should apply exercise-specific modifiers to benchmark e1RM', () => {
    const benchmarkHistory = [
      { date: '2026-01-20', weight: 100, reps: 5, rir: 1, isActive: true },
    ];

    const frontSquatAnalysis = analyzeBenchmarkSession(benchmarkHistory, 'Front Squat');
    const backSquatAnalysis = analyzeBenchmarkSession(benchmarkHistory, 'Squat');

    // Front Squat has 0.82 modifier, Back Squat has 1.0
    expect(frontSquatAnalysis.highestE1RM).toBeLessThan(backSquatAnalysis.highestE1RM);
    expect(frontSquatAnalysis.highestE1RM).toBeCloseTo(backSquatAnalysis.highestE1RM * 0.82, 1);
  });

  it('should return failure for empty benchmark history', () => {
    const analysis = analyzeBenchmarkSession([], 'Bench Press');

    expect(analysis.benchmarkCompleted).toBe(false);
    expect(analysis.highestE1RM).toBe(0);
    expect(analysis.bestSet).toBeNull();
    expect(analysis.totalSets).toBe(0);
  });

  it('should calculate correct e1RM for each benchmark set', () => {
    const benchmarkHistory = [
      { date: '2026-01-20', weight: 60, reps: 10, rir: 2, isActive: true },
      { date: '2026-01-20', weight: 80, reps: 6, rir: 1, isActive: true },
    ];

    const analysis = analyzeBenchmarkSession(benchmarkHistory, 'Bench Press');

    expect(analysis.allSets).toHaveLength(2);
    expect(analysis.allSets[0].weight).toBe(60);
    expect(analysis.allSets[0].reps).toBe(10);
    expect(analysis.allSets[0].e1rm).toBeGreaterThan(0);
    expect(analysis.allSets[1].weight).toBe(80);
    expect(analysis.allSets[1].reps).toBe(6);
    expect(analysis.allSets[1].e1rm).toBeGreaterThan(0);
  });

  it('should use correct baseline e1RM for post-benchmark prescription', () => {
    const benchmarkHistory = [
      { name: 'Deadlift', date: '2026-01-20', weight: 100, reps: 5, rir: 1, isActive: true },
      { name: 'Deadlift', date: '2026-01-20', weight: 120, reps: 3, rir: 0, isActive: true },
    ];

    const recommendation = generateRecommendation({
      exercise: 'Deadlift',
      history: benchmarkHistory,
      userAge: 30,
      phase: 'strength'
    });

    // Calculate expected e1RM from best set (120kg × 3 reps, RIR 0)
    const expectedE1RM = calculateE1RM(120, 3, 0);

    expect(recommendation.benchmark_baseline.e1rm).toBeCloseTo(expectedE1RM, 1);
    expect(recommendation.calculated_e1rm_kg).toBeCloseTo(expectedE1RM, 1);

    // For strength phase, intensity is 80-88%, average 84%
    const targetIntensity = 0.84;
    const expectedWeight = Math.round((expectedE1RM * targetIntensity) / 5) * 5; // Deadlift uses 5kg increments

    // Allow for rounding differences due to increment adjustment
    expect(recommendation.prescription.weight_kg).toBeGreaterThanOrEqual(expectedWeight - 5);
    expect(recommendation.prescription.weight_kg).toBeLessThanOrEqual(expectedWeight + 5);
  });
});
