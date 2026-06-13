const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';

const oauth2Client = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  `${BACKEND_URL}/api/auth/google/callback`
);

/**
 * Generates the Google consent screen URL.
 * @returns {string} The Google authentication URL.
 */
const generateGoogleAuthURL = () => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required to get a refresh token
    scope: ['profile', 'email'],
    prompt: 'consent' // Forces consent screen to ensure refresh token is always provided
  });
};

/**
 * Exchanges the authorization code for tokens and fetches user profile.
 * @param {string} code - The authorization code returned by Google.
 * @returns {Promise<Object>} The Google user profile and tokens.
 */
const getGoogleUser = async (code) => {
  try {
    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Fetch user profile from the ID token
    const ticket = await oauth2Client.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    return {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      avatarUrl: payload.picture,
      emailVerified: payload.email_verified,
      tokens, // Includes access_token and potentially refresh_token
    };
  } catch (error) {
    console.error('Error fetching Google user:', error);
    throw new Error('Failed to authenticate with Google');
  }
};

module.exports = {
  oauth2Client,
  generateGoogleAuthURL,
  getGoogleUser,
};
