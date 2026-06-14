/**
 * Multi-channel notification service for Rakshak.
 * 
 * Note: Currently implemented as a mock for development.
 * In production, these stubs will be replaced by actual API calls to providers like MSG91 or Twilio.
 */

// Example Production Integrations (Commented out):
// const axios = require('axios');
// const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
// const SENDER_ID = process.env.MSG91_SENDER_ID || 'RKSHAK';

const notificationService = {
  /**
   * Send a raw SMS message.
   * @param {string} mobile - 10 digit Indian mobile number
   * @param {string} message - Text content
   */
  async sendSMS(mobile, message) {
    console.log(`\n[SMS to ${mobile}] ${message}\n`);
    
    // PRODUCTION MSG91 IMPLEMENTATION:
    /*
    try {
      await axios.post('https://api.msg91.com/api/v5/flow/', {
        template_id: 'your_sms_template_id',
        sender: SENDER_ID,
        mobiles: `91${mobile}`,
        message: message // Or mapped variables depending on MSG91 flow setup
      }, {
        headers: { 'authkey': MSG91_AUTH_KEY }
      });
    } catch (err) {
      console.error('MSG91 SMS Error:', err);
    }
    */
  },

  /**
   * Send a WhatsApp message using a pre-approved template.
   * @param {string} mobile - 10 digit Indian mobile number
   * @param {string} templateName - The WhatsApp template identifier
   * @param {Object} params - Key-value pairs matching the template variables
   */
  async sendWhatsApp(mobile, templateName, params) {
    console.log(`\n[WHATSAPP to ${mobile}] Template: ${templateName} | Params:`, params, '\n');

    // PRODUCTION MSG91 WHATSAPP IMPLEMENTATION:
    /*
    try {
      await axios.post('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/', {
        integrated_number: process.env.WHATSAPP_NUMBER,
        content_type: "template",
        payload: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: `91${mobile}`,
          type: "template",
          template: {
            name: templateName,
            language: { code: "en_US" },
            components: [
              {
                type: "body",
                parameters: Object.keys(params).map(key => ({
                  type: "text",
                  text: params[key]
                }))
              }
            ]
          }
        }
      }, {
        headers: { 'authkey': MSG91_AUTH_KEY }
      });
    } catch (err) {
      console.error('MSG91 WhatsApp Error:', err);
    }
    */
  },

  /**
   * 1. Send Visitor Approval Request
   * Sent to resident when a visitor arrives at the gate.
   */
  async sendVisitorApprovalRequest(residentUser, visitor, entry, otp) {
    if (!residentUser || !residentUser.mobile) return;

    const message = `${visitor.name} is at the gate for Flat ${residentUser.resident.flat.number}. Purpose: ${entry.purpose || 'Visit'}. Approve with OTP: ${otp}`;
    
    // Primary: WhatsApp
    await this.sendWhatsApp(residentUser.mobile, 'visitor_approval_request', {
      visitor_name: visitor.name,
      flat_number: residentUser.resident.flat.number,
      purpose: entry.purpose || 'Visit',
      otp: otp
    });

    // Fallback: SMS
    await this.sendSMS(residentUser.mobile, message);
  },

  /**
   * 2. Send Delivery Notification
   * Sent to resident when a delivery package is received at the gate.
   */
  async sendDeliveryNotification(residentUser, delivery, otp) {
    if (!residentUser || !residentUser.mobile) return;

    const message = `A ${delivery.category} delivery has been received for Flat ${residentUser.resident.flat.number}. Pick it up at the gate using OTP: ${otp}`;

    await this.sendWhatsApp(residentUser.mobile, 'delivery_received', {
      category: delivery.category,
      flat_number: residentUser.resident.flat.number,
      otp: otp
    });

    await this.sendSMS(residentUser.mobile, message);
  },

  /**
   * 3. Send Staff Arrival Notification
   * Sent to resident when their registered staff checks in.
   */
  async sendStaffArrivalNotification(residentUser, staff, attendance) {
    if (!residentUser || !residentUser.mobile) return;

    const timeString = attendance.checkInTime ? attendance.checkInTime.toLocaleTimeString('en-IN') : 'Unknown time';
    const message = `Your staff member ${staff.name} (${staff.type}) has arrived at the gate at ${timeString}. Status: ${attendance.status}.`;

    await this.sendWhatsApp(residentUser.mobile, 'staff_arrival', {
      staff_name: staff.name,
      staff_type: staff.type,
      time: timeString,
      status: attendance.status
    });
  },

  /**
   * 4. Send Emergency SOS Alert
   * HIGH PRIORITY: Sent to all guards and society admins.
   */
  async sendEmergencyAlert(responders, alert, residentUser) {
    const flatStr = residentUser && residentUser.resident ? `Flat ${residentUser.resident.flat.number}` : 'Unknown Flat';
    const contactStr = residentUser ? residentUser.mobile : 'Unknown Contact';
    
    const message = `EMERGENCY ALERT: ${alert.type} reported at ${alert.location} (${flatStr}). Contact: ${contactStr}. Please respond immediately.`;

    const promises = responders.map(responder => {
      if (!responder.mobile) return Promise.resolve();
      
      return Promise.all([
        this.sendWhatsApp(responder.mobile, 'emergency_alert', {
          type: alert.type,
          location: alert.location,
          flat: flatStr,
          contact: contactStr
        }),
        this.sendSMS(responder.mobile, message)
      ]);
    });

    await Promise.allSettled(promises);
  }
};

module.exports = notificationService;
