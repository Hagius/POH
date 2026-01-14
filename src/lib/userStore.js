import { faker } from '@faker-js/faker';

const USER_STORAGE_KEY = 'poh_demo_user';

/**
 * Generates a new fake user profile using faker.js
 * @returns {Object} User object with id, name, email, avatar, jobTitle, and bio
 */
function generateUser() {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();

  return {
    id: faker.string.uuid(),
    name: `${firstName} ${lastName}`,
    email: faker.internet.email({ firstName, lastName }).toLowerCase(),
    avatar: faker.image.avatar(),
    jobTitle: faker.person.jobTitle(),
    bio: faker.lorem.paragraph(2),
    createdAt: new Date().toISOString(),
  };
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
 * Resets the demo by clearing the current user and reloading the page
 */
export function resetDemo() {
  clearUser();
  window.location.reload();
}

export { USER_STORAGE_KEY };
