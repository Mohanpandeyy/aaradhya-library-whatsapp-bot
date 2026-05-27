/* 
  ---------------------------------------------------------
  📚 AARADHYA LIBRARY - ADVANCED AUTOMATED REMINDERS
  ---------------------------------------------------------
  Features:
  - Pre-due reminder (2 days before)
  - Due date reminder
  - Overdue reminders (Day 1 & Day 2)
  - Final Warning (Day 3 - Seat Cancellation)
  
  Language: Google Apps Script (.gs)
  Trigger: Use "Time-driven" trigger (Daily between 9am-10am)
  ---------------------------------------------------------
*/

// --- CONFIGURATION ---
var FIREBASE_URL = "https://aaradhya-library-default-rtdb.firebaseio.com";
var FIREBASE_AUTH = ""; // Leave blank if your database rules are public
var INSTANCE_ID = "REPLACE_YOUR_INSTANCE_ID";
var API_TOKEN = "REPLACE_YOUR_API_TOKEN";

/**
 * Main automation function
 * Rozana check karne wala function
 */
function checkReminders() {
  Logger.log("--- Starting Advanced Library Reminder Check ---");
  
  var sentCount = 0;
  var skipCount = 0;
  
  try {
    var students = getStudents();
    var templates = getTemplates() || getDefaultTemplates();
    
    if (!students) {
      Logger.log("No students found in database.");
      return;
    }
    
    var today = new Date();
    // Timezone: IST (India Standard Time)
    var todayStr = Utilities.formatDate(today, "GMT+5:30", "yyyy-MM-dd");
    var currentDay = today.getDate();
    var currentMonthYear = Utilities.formatDate(today, "GMT+5:30", "MMMM yyyy");

    for (var studentId in students) {
      var student = students[studentId];
      
      // Filter: Only Pending fees
      if (student.status !== "Pending") {
        skipCount++;
        continue;
      }
      
      // Skip if reminder already sent today
      if (student.lastReminderSent === todayStr) {
        Logger.log("Skipping " + student.name + " - Already notified today.");
        skipCount++;
        continue;
      }
      
      var dueDay = parseInt(student.dueDateDay);
      var templateToUse = null;
      var label = "";

      // --- LOGIC ENGINE ---
      
      // 1. Exactly 2nd day before due date
      if (dueDay === (currentDay + 2)) {
        templateToUse = templates.reminder2day;
        label = "2-Day Advance";
      } 
      // 2. Due Date
      else if (dueDay === currentDay) {
        templateToUse = templates.reminderToday;
        label = "Due Date Alert";
      }
      // 3. 1 Day Overdue
      else if (currentDay === (dueDay + 1)) {
        templateToUse = templates.overdueDay1;
        label = "Day 1 Overdue";
      }
      // 4. 2 Days Overdue
      else if (currentDay === (dueDay + 2)) {
        templateToUse = templates.overdueDay2;
        label = "Day 2 Overdue";
      }
      // 5. 3 Days Overdue (FINAL WARNING)
      else if (currentDay === (dueDay + 3)) {
        templateToUse = templates.finalWarning;
        label = "FINAL WARNING";
      }

      if (templateToUse) {
        var message = formatMessage(templateToUse, student, currentMonthYear);
        var success = sendWhatsApp(student.phone, message);
        
        if (success) {
          updateLastReminder(studentId, todayStr);
          Logger.log("✅ Message Sent [" + label + "] to: " + student.name);
          sentCount++;
        } else {
          Logger.log("❌ Failed to send to: " + student.name);
        }
      } else {
        skipCount++;
      }
    }
    
    Logger.log("--- Finished: Sent " + sentCount + ", Skipped " + skipCount + " ---");
    
  } catch (e) {
    Logger.log("CRITICAL ERROR: " + e.toString());
  }
}

/**
 * Placeholder replacement
 */
function formatMessage(template, student, month) {
  var dueDateFormatted = student.dueDateDay + " " + month;
  return template
    .replace(/{name}/g, student.name)
    .replace(/{amount}/g, student.feeAmount)
    .replace(/{dueDate}/g, dueDateFormatted)
    .replace(/{month}/g, month);
}

/**
 * Fetch students from RTDB
 */
function getStudents() {
  var url = FIREBASE_URL + "/students.json" + (FIREBASE_AUTH ? "?auth=" + FIREBASE_AUTH : "");
  var response = UrlFetchApp.fetch(url);
  return JSON.parse(response.getContentText());
}

/**
 * Fetch templates or fallback
 */
function getTemplates() {
  try {
    var url = FIREBASE_URL + "/templates.json" + (FIREBASE_AUTH ? "?auth=" + FIREBASE_AUTH : "");
    var response = UrlFetchApp.fetch(url);
    var tpls = JSON.parse(response.getContentText());
    if (tpls && typeof tpls === 'object') {
       // Merge with defaults to ensure all keys exist
       var defaults = getDefaultTemplates();
       return Object.assign(defaults, tpls);
    }
    return null;
  } catch(e) {
    return null;
  }
}

/**
 * Update state in Firebase
 */
function updateLastReminder(studentId, dateStr) {
  var url = FIREBASE_URL + "/students/" + studentId + ".json" + (FIREBASE_AUTH ? "?auth=" + FIREBASE_AUTH : "");
  var payload = { "lastReminderSent": dateStr };
  var options = {
    "method": "patch",
    "contentType": "application/json",
    "payload": JSON.stringify(payload)
  };
  UrlFetchApp.fetch(url, options);
}

/**
 * API call to Green API
 */
function sendWhatsApp(phone, message) {
  try {
    var cleanPhone = phone.toString().replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = "91" + cleanPhone;
    
    var chatId = cleanPhone + "@c.us";
    var url = "https://api.green-api.com/waInstance" + INSTANCE_ID + "/sendMessage/" + API_TOKEN;
    
    var payload = { "chatId": chatId, "message": message };
    var options = {
      "method": "post",
      "contentType": "application/json",
      "payload": JSON.stringify(payload),
      "muteHttpExceptions": true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    return (response.getResponseCode() === 200);
  } catch (e) {
    Logger.log("API Error: " + e.message);
    return false;
  }
}

/**
 * Professional Hindi/English Mixed Templates
 */
function getDefaultTemplates() {
  return {
    "reminder2day": "Namaste {name} ji,\nAapki library membership fee ₹{amount} ki due date {dueDate} hai — sirf 2 din baaki hain. Samay par fee jama karein.\n- Aaradhya Library",
    
    "reminderToday": "Namaste {name} ji,\nAaj {dueDate} ko aapki library fee ₹{amount} ki AAKHRI TARIKH hai. Aaj hi fee jama karein taaki seat bani rahe.\n- Aaradhya Library",
    
    "overdueDay1": "Important: {name} ji, aapki library fee ₹{amount} kal ({dueDate}) ko due thi par abhi tak jama nahi hui hai. Kripya aaj hi jama karein.\n- Aaradhya Library",
    
    "overdueDay2": "Reminder: {name} ji, aapki fee abhi bhi pending hai. Hamara library management system fee na hone par seat automatic block kar sakta hai. Aaj hi pay karein.\n- Aaradhya Library",
    
    "finalWarning": "⚠️ FINAL WARNING: {name} ji, agar aaj aapne fee ₹{amount} jama nahi ki, toh aapki seat cancel karke dusre student ko allot kar di jaaegi. Seat bachane ke liye turant sampark karein.\n- Aaradhya Library"
  };
}
