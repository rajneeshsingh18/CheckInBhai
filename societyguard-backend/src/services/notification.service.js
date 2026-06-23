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

const pushService = require('./push.service');

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
   * HIGH PRIORITY emergency notification to all responders.
   * Bypasses normal rate limits and uses all channels simultaneously.
   */
  async sendEmergencyAlert(responders, alert, residentUser) {
    console.log(`[EMERGENCY] Processing alert ${alert.id} for ${responders.length} responders`);

    const flatStr = residentUser && residentUser.resident ? `Flat ${residentUser.resident.flat.number}` : 'Unknown Flat';
    const towerStr = residentUser && residentUser.resident?.flat?.tower ? `Tower ${residentUser.resident.flat.tower.name}` : '';
    const locationStr = `${towerStr}${towerStr ? ', ' : ''}${flatStr}`;
    const residentName = residentUser ? residentUser.name : 'Unknown';
    const contactStr = residentUser ? residentUser.mobile : 'Unknown Contact';
    
    const emojis = { MEDICAL: '🏥', FIRE: '🔥', SECURITY: '🚔', OTHER: '⚠️' };
    const instructions = {
      MEDICAL: 'Medical emergency. Arrange first aid/ambulance.',
      FIRE: 'Fire alert. Activate fire safety protocol.',
      SECURITY: 'Security threat. All guards respond immediately.',
      OTHER: 'Emergency reported. Please investigate.'
    };

    const emoji = emojis[alert.type] || '🚨';
    const instruction = instructions[alert.type] || instructions.OTHER;

    const message = `🚨 EMERGENCY ALERT 🚨\n${emoji} Type: ${alert.type}\n📍 Location: ${locationStr}\n👤 Resident: ${residentName} (${contactStr})\n📢 Action: ${instruction}`;

    let report = { totalSent: 0, whatsappDelivered: 0, smsDelivered: 0, failed: 0 };

    const promises = responders.map(async (responder) => {
      if (!responder.mobile) return;

      try {
        // Send via ALL channels simultaneously
        const [waResult, smsResult] = await Promise.allSettled([
          this.sendWhatsApp(responder.mobile, 'emergency_alert', {
            type: alert.type,
            location: locationStr,
            resident: `${residentName} (${contactStr})`,
            instruction: instruction
          }),
          this.sendSMS(responder.mobile, message)
        ]);

        report.totalSent++;
        if (waResult.status === 'fulfilled') report.whatsappDelivered++;
        else report.failed++;

        if (smsResult.status === 'fulfilled') report.smsDelivered++;
        else report.failed++;

      } catch (err) {
        console.error(`[EMERGENCY ERROR] Failed to notify responder ${responder.id}:`, err);
        report.failed++;
      }
    });

    await Promise.all(promises);

    if (report.whatsappDelivered === 0 && report.smsDelivered === 0) {
      console.error(`[CRITICAL] Emergency Alert ${alert.id} failed to deliver to ANY responder!`);
    }

    return report;
  },

  /**
   * 9. Send Test Notification
   * Purpose: Test notification system without panic.
   */
  async sendTestNotification(admin, channels = ['wa', 'sms']) {
    console.log(`[TEST] Sending test notification to admin ${admin.name}`);
    
    const message = "[TEST] This is a test of the Rakshak emergency notification system. Please ignore.";
    const report = { wa: false, sms: false };

    try {
      if (channels.includes('wa')) {
        await this.sendWhatsApp(admin.mobile, 'test_notification', { message });
        report.wa = true;
      }
      if (channels.includes('sms')) {
        await this.sendSMS(admin.mobile, message);
        report.sms = true;
      }
    } catch (err) {
      console.error('[TEST ERROR] Test notification failed:', err);
    }

    return report;
  },

  /**
   * 5. Send Staff Arrival Notification
   * Sent to resident when their registered staff checks in.
   */
  async sendStaffArrivalNotification(residentUser, staff, attendance) {
    if (!residentUser || !residentUser.mobile) return;

    const timeString = attendance.checkInTime ? new Date(attendance.checkInTime).toLocaleTimeString('en-IN') : 'Unknown time';
    const statusPrefix = attendance.status === 'LATE' ? '⚠️ Late arrival: ' : '';
    const message = `${statusPrefix}${staff.name} (${staff.type}) has arrived at ${timeString}. Status: ${attendance.status}.`;

    await this.sendWhatsApp(residentUser.mobile, 'staff_arrival', {
      staff_name: staff.name,
      staff_type: staff.type,
      time: timeString,
      status: attendance.status
    });

    await this.sendSMS(residentUser.mobile, message);
    
    await pushService.sendToUser(residentUser.id, {
      title: 'Staff Arrived',
      body: message,
      url: `/resident/staff`
    });
  },

  /**
   * 6. Send Staff Departure Notification
   * Sent to resident when staff checks out.
   */
  async sendStaffDepartureNotification(residentUser, staff, attendance) {
    if (!residentUser || !residentUser.mobile) return;

    const timeString = attendance.checkOutTime ? new Date(attendance.checkOutTime).toLocaleTimeString('en-IN') : 'Unknown time';
    const message = `${staff.name} has left the society at ${timeString}. Total hours worked: ${attendance.hoursWorked || 0}h.`;

    await this.sendWhatsApp(residentUser.mobile, 'staff_departure', {
      staff_name: staff.name,
      time: timeString,
      hours: attendance.hoursWorked || 0
    });

    await this.sendSMS(residentUser.mobile, message);

    await pushService.sendToUser(residentUser.id, {
      title: 'Staff Departed',
      body: message,
      url: `/resident/staff`
    });
  },

  /**
   * 7. Send Staff Absent Notification
   * Sent when staff doesn't arrive by cutoff.
   */
  async sendStaffAbsentNotification(residentUser, staff) {
    if (!residentUser || !residentUser.mobile) return;

    const message = `${staff.name} (${staff.type}) hasn't arrived today as scheduled. We have marked them as ABSENT.`;

    await this.sendSMS(residentUser.mobile, message);

    await pushService.sendToUser(residentUser.id, {
      title: 'Staff Absent',
      body: message,
      url: `/resident/staff`
    });
  },

  /**
   * 8. Send Weekly Attendance Summary
   * Sent every Monday morning.
   */
  async sendWeeklyAttendanceSummary(residentUser, staff, summary) {
    if (!residentUser || !residentUser.mobile) return;

    const message = `Weekly report for ${staff.name}: Present ${summary.presentCount}/${summary.scheduledCount} days, Total ${summary.totalHours} hours.`;

    await this.sendSMS(residentUser.mobile, message);
  }
};

module.exports = notificationService;
