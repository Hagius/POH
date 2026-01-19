import { faker } from '@faker-js/faker';

const USER_STORAGE_KEY = 'poh_demo_user';
const ENTRIES_STORAGE_KEY = 'poh_demo_entries';
const USER_DATA_KEY = 'poh_user_data';
const USER_ENTRIES_KEY = 'poh_user_entries';
const DATA_MODE_KEY = 'poh_data_mode'; // 'demo' or 'user'

const EXERCISES = [
  { name: 'Squat', baseWeight: 60, maxWeight: 140 },
  { name: 'Deadlift', baseWeight: 80, maxWeight: 180 },
  { name: 'Bench Press', baseWeight: 40, maxWeight: 100 },
  { name: 'Overhead Press', baseWeight: 30, maxWeight: 70 },
  { name: 'Barbell Row', baseWeight: 40, maxWeight: 90 },
];

/**
 * Generates a new fake user profile using faker.js
 * @returns {Object} User object with id, name, email, avatar, jobTitle, bio, and physical stats
 */
function generateUser() {
  const sex = faker.helpers.arrayElement(['male', 'female']);
  const firstName = faker.person.firstName(sex);
  const lastName = faker.person.lastName();

  // Generate realistic physical stats
  const age = faker.number.int({ min: 18, max: 55 });
  const bodyweight = sex === 'male'
    ? faker.number.int({ min: 65, max: 100 })
    : faker.number.int({ min: 50, max: 80 });

  return {
    id: faker.string.uuid(),
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    avatar: faker.image.avatar(),
    jobTitle: faker.person.jobTitle(),
    bio: faker.lorem.paragraph(2),
    createdAt: new Date().toISOString(),
    // Physical stats for strength level calculation
    sex,
    age,
    bodyweight,
  };
}

/**
 * Generates realistic historical workout entries with progressive overload
 * @returns {Array} Array of workout entry objects
 */
function generateWorkoutHistory() {
  const entries = [];
  const today = new Date();

  // Generate 8 weeks of training history (roughly 3-4 sessions per week)
  const weeksOfHistory = 8;
  const sessionsPerWeek = faker.number.int({ min: 3, max: 4 });

  // Pick 3-4 exercises this "user" focuses on
  const userExercises = faker.helpers.arrayElements(EXERCISES, faker.number.int({ min: 3, max: 4 }));

  for (let week = weeksOfHistory; week >= 0; week--) {
    // Determine which days this week had workouts
    const workoutDays = faker.helpers.arrayElements([0, 1, 2, 3, 4, 5, 6], sessionsPerWeek).sort();

    for (const dayOfWeek of workoutDays) {
      const workoutDate = new Date(today);
      workoutDate.setDate(today.getDate() - (week * 7) - (6 - dayOfWeek));

      // Skip future dates
      if (workoutDate > today) continue;

      // Each workout session includes 2-3 exercises
      const sessionExercises = faker.helpers.arrayElements(
        userExercises,
        faker.number.int({ min: 2, max: 3 })
      );

      for (const exercise of sessionExercises) {
        // Calculate progressive weight (increases over weeks)
        const progressFactor = 1 - (week / weeksOfHistory); // 0 to 1 as weeks progress
        const weightRange = exercise.maxWeight - exercise.baseWeight;
        const currentMaxWeight = exercise.baseWeight + (weightRange * progressFactor);

        // Add some variance (+/- 5-10%)
        const variance = faker.number.float({ min: 0.9, max: 1.05 });
        const weight = Math.round((currentMaxWeight * variance) / 2.5) * 2.5; // Round to 2.5kg

        // Realistic rep ranges (heavier = fewer reps)
        const reps = weight > (exercise.baseWeight + weightRange * 0.7)
          ? faker.number.int({ min: 3, max: 6 })
          : faker.number.int({ min: 6, max: 12 });

        const sets = faker.number.int({ min: 3, max: 5 });

        entries.push({
          id: faker.string.alphanumeric(7),
          name: exercise.name,
          date: workoutDate.toISOString().split('T')[0],
          weight: Math.max(weight, exercise.baseWeight), // Never below base
          reps,
          sets,
        });
      }
    }
  }

  return entries;
}

/**
 * Gets the current user from localStorage, or generates a new one if none exists.
 * This ensures the same "fake" profile persists across page refreshes.
 * @returns {Object} The user object
 */
export function getUser() {
  try {
    const stored = localStorage.getItem(USER_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to read user from localStorage:', error);
  }

  // Generate new user and persist
  const newUser = generateUser();
  saveUser(newUser);
  return newUser;
}

/**
 * Saves a user object to localStorage
 * @param {Object} user - The user object to save
 */
export function saveUser(user) {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn('Failed to save user to localStorage:', error);
  }
}

/**
 * Gets workout entries from localStorage, or generates historical data if none exists.
 * @returns {Array} Array of workout entry objects
 */
export function getEntries() {
  try {
    const stored = localStorage.getItem(ENTRIES_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to read entries from localStorage:', error);
  }

  // Generate historical workout data
  const entries = generateWorkoutHistory();
  saveEntries(entries);
  return entries;
}

/**
 * Saves workout entries to localStorage
 * @param {Array} entries - Array of workout entry objects
 */
export function saveEntries(entries) {
  try {
    localStorage.setItem(ENTRIES_STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn('Failed to save entries to localStorage:', error);
  }
}

/**
 * Clears the current user from localStorage
 */
export function clearUser() {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear user from localStorage:', error);
  }
}

/**
 * Clears workout entries from localStorage
 */
export function clearEntries() {
  try {
    localStorage.removeItem(ENTRIES_STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear entries from localStorage:', error);
  }
}

/**
 * Resets the demo by clearing all data and reloading the page
 */
export function resetDemo() {
  clearUser();
  clearEntries();
  window.location.reload();
}

/**
 * Gets the current data mode ('demo' or 'user')
 * @returns {string} The current data mode
 */
export function getDataMode() {
  try {
    const mode = localStorage.getItem(DATA_MODE_KEY);
    return mode === 'user' ? 'user' : 'demo';
  } catch (error) {
    return 'demo';
  }
}

/**
 * Sets the data mode and returns the new mode
 * @param {string} mode - 'demo' or 'user'
 * @returns {string} The new data mode
 */
export function setDataMode(mode) {
  try {
    const newMode = mode === 'user' ? 'user' : 'demo';
    localStorage.setItem(DATA_MODE_KEY, newMode);
    return newMode;
  } catch (error) {
    console.warn('Failed to set data mode:', error);
    return 'demo';
  }
}

/**
 * Toggles between demo and user data mode
 * @returns {string} The new data mode
 */
export function toggleDataMode() {
  const currentMode = getDataMode();
  const newMode = currentMode === 'demo' ? 'user' : 'demo';
  return setDataMode(newMode);
}

/**
 * Gets user data based on current mode
 * @returns {Object} The user object for current mode
 */
export function getCurrentUser() {
  const mode = getDataMode();
  if (mode === 'user') {
    try {
      const stored = localStorage.getItem(USER_DATA_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to read user data:', error);
    }
    // Return default user data structure
    return {
      id: 'user-' + Date.now(),
      name: 'You',
      email: '',
      avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=You',
      sex: 'male',
      age: 30,
      bodyweight: 75,
      createdAt: new Date().toISOString(),
    };
  }
  return getUser();
}

/**
 * Saves user data for user mode
 * @param {Object} user - The user object to save
 */
export function saveCurrentUser(user) {
  const mode = getDataMode();
  if (mode === 'user') {
    try {
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    } catch (error) {
      console.warn('Failed to save user data:', error);
    }
  } else {
    saveUser(user);
  }
}

/**
 * Gets entries based on current mode
 * @returns {Array} Array of workout entries for current mode
 */
export function getCurrentEntries() {
  const mode = getDataMode();
  if (mode === 'user') {
    try {
      const stored = localStorage.getItem(USER_ENTRIES_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to read user entries:', error);
    }
    return [];
  }
  return getEntries();
}

/**
 * Saves entries for current mode
 * @param {Array} entries - Array of workout entries
 */
export function saveCurrentEntries(entries) {
  const mode = getDataMode();
  if (mode === 'user') {
    try {
      localStorage.setItem(USER_ENTRIES_KEY, JSON.stringify(entries));
    } catch (error) {
      console.warn('Failed to save user entries:', error);
    }
  } else {
    saveEntries(entries);
  }
}

export { USER_STORAGE_KEY, ENTRIES_STORAGE_KEY, USER_DATA_KEY, USER_ENTRIES_KEY, DATA_MODE_KEY };
