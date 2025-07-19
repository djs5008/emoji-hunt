/**
 * Face Emoji Library - Player avatar collection
 * 
 * @description Provides face emojis specifically for player avatars.
 * These emojis are chosen for their distinctiveness and personality,
 * helping players identify each other in the scoreboard.
 */

// Comprehensive collection of face emojis including emotions and characters
export const FACE_EMOJIS = [
  // Happy & Positive
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
  '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
  // Playful & Silly
  '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
  // Neutral & Skeptical
  '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
  // Tired & Sick
  '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮',
  // Extreme Emotions
  '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓',
  // Worried & Sad
  '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺',
  '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣',
  // Angry & Frustrated
  '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈',
  // Characters & Creatures
  '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾',
  '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾'
];

/**
 * Gets a random face emoji for player avatar
 * 
 * @description Selects a random emoji from the face collection.
 * Used when players join a lobby to give them a unique visual identifier.
 * 
 * @returns {string} A random face emoji character
 */
export function getRandomFaceEmoji(): string {
  return FACE_EMOJIS[Math.floor(Math.random() * FACE_EMOJIS.length)];
}