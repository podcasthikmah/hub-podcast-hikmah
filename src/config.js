/**
 * HUB PODCAST HIKMAH — App configuration
 * ---------------------------------------------------------------
 * 1. Deploy google-apps-script/Code.gs as a Web App (see SETUP.md).
 * 2. Paste the Web App URL below (ends with /exec).
 * 3. Rebuild & redeploy. Leave it empty to run in local MOCK mode
 *    (data saved in this browser's localStorage only).
 */
export const CONFIG = {
  // e.g. 'https://script.google.com/macros/s/AKfycb.../exec'
  GAS_URL: 'https://script.google.com/macros/s/AKfycbwJTyO7LnzXZedB1iZUalm6mKpYlVduWQSghit2XomWcHpohsKZ2cyeQekM1g12DsOa/exec',

  // Public link included in "Salin Info WA" messages.
  // Leave empty to auto-use the current page address.
  HUB_URL: '',

  // Admin PIN used ONLY in mock mode (no GAS_URL).
  // In live mode the PIN is verified by Code.gs (Script Property ADMIN_PIN).
  MOCK_ADMIN_PIN: '1234',

  APP_NAME: 'HUB PODCAST HIKMAH',
  ORG_NAME: 'Podcast Hikmah',
};

export const IS_MOCK = !CONFIG.GAS_URL;
