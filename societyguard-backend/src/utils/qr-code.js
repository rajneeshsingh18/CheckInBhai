const qrcode = require('qrcode');

/**
 * QR Code Generation Utilities optimized for mobile screen scanning.
 */

const qrCodeUtil = {
  /**
   * 1. Generate QR Code Data URL
   * @param {string} data - The deep link or text to encode
   * @returns {Promise<string>} Base64 encoded image string
   */
  async generateQRCode(data) {
    try {
      const qrDataUrl = await qrcode.toDataURL(data, {
        errorCorrectionLevel: 'H', // High error correction (30% recoverable)
        margin: 2,
        width: 400,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      return qrDataUrl;
    } catch (error) {
      console.error('[QR CODE ERROR] Failed to generate QR:', error);
      throw new Error('Failed to generate QR code image');
    }
  }
};

module.exports = qrCodeUtil;
