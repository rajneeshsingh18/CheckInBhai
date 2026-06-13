const crypto = require('crypto');

/**
 * Utility for frontend OAuth integration.
 * Handles encoding tokens and generating redirect URLs for web and mobile.
 */

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const FRONTEND_OAUTH_REDIRECT = process.env.FRONTEND_OAUTH_REDIRECT || '/auth/callback';

/**
 * Safely encodes data for URL transport.
 * @param {Object} data 
 * @returns {string} Base64URL encoded string
 */
const encodeForUrl = (data) => {
  const jsonStr = JSON.stringify(data);
  return Buffer.from(jsonStr)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/**
 * Generates a state parameter to prevent CSRF.
 * @returns {string} Random hex string
 */
const generateOAuthState = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generates the redirect URL for web browsers after successful OAuth.
 * Passes tokens securely via URL hash or query params.
 * 
 * @param {Object} tokens - { accessToken, refreshToken, isNewUser }
 * @returns {string} URL to redirect the user to
 */
const generateWebRedirectUrl = (tokens) => {
  const payload = encodeForUrl(tokens);
  // We use URL hash fragment to prevent tokens from hitting server logs
  return `${FRONTEND_URL}${FRONTEND_OAUTH_REDIRECT}#data=${payload}`;
};

/**
 * Generates a deep link for mobile applications (e.g. societyguard://auth)
 * 
 * @param {Object} tokens - { accessToken, refreshToken, isNewUser }
 * @param {string} appScheme - The mobile app's custom URL scheme
 * @returns {string} Deep link URL
 */
const generateMobileDeepLink = (tokens, appScheme = 'societyguard://') => {
  const payload = encodeForUrl(tokens);
  return `${appScheme}auth/callback?data=${payload}`;
};

/**
 * Handles the OAuth response routing based on the client type.
 * 
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Object} tokens - Auth tokens and user state
 */
const handleOAuthResponse = (req, res, tokens) => {
  const clientType = req.query.client || 'web'; // 'web' or 'mobile'

  if (clientType === 'mobile') {
    const deepLink = generateMobileDeepLink(tokens);
    return res.redirect(deepLink);
  }

  // Default to web browser redirect
  const redirectUrl = generateWebRedirectUrl(tokens);
  return res.redirect(redirectUrl);
};

module.exports = {
  generateOAuthState,
  generateWebRedirectUrl,
  generateMobileDeepLink,
  handleOAuthResponse,
  encodeForUrl
};
