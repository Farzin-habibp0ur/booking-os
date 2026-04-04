const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, AlignmentType, VerticalAlign, BorderStyle, UnderlineType, ShadingType, WidthType, PageBreak, TabStopType, TabStopAlignment } = require('docx');
const fs = require('fs');

// Brand colors (using RGB for docx)
const SAGE = 'C2A176'; // #71907C in hex, adjusted for DOCX
const SAGE_HEX = '71907C';
const SLATE = '1e293b';
const SAGE_LIGHT = 'F4F7F5';

// Test data for all 15 phases
const testPhases = [
  {
    name: 'Phase 1: Authentication & Login',
    description: 'Testing user authentication, login flows, password reset, and session management',
    tests: [
      { id: 'AUTH-001', name: 'Login with Valid Credentials', steps: 'Navigate to login page, enter valid email and password, click login', expected: 'User logged in, redirected to dashboard' },
      { id: 'AUTH-002', name: 'Login with Invalid Email', steps: 'Enter invalid email format, enter any password, click login', expected: 'Error message displayed' },
      { id: 'AUTH-003', name: 'Login with Invalid Password', steps: 'Enter valid email, enter wrong password, click login', expected: 'Error message displayed' },
      { id: 'AUTH-004', name: 'Password Reset Flow', steps: 'Click forgot password, enter email, check email for reset link, reset password', expected: 'Password changed successfully' },
      { id: 'AUTH-005', name: 'Session Timeout', steps: 'Login, wait for session to expire, perform action', expected: 'Redirected to login page' },
      { id: 'AUTH-006', name: 'Logout Function', steps: 'Click logout button in sidebar', expected: 'User logged out, redirected to login' },
      { id: 'AUTH-007', name: 'Remember Me Functionality', steps: 'Check remember me, login, close browser, revisit site', expected: 'User auto-logged in' },
      { id: 'AUTH-008', name: 'Login Rate Limiting', steps: 'Attempt 6 failed logins in succession', expected: 'Account locked after 5 attempts for 15 minutes' }
    ]
  },
  {
    name: 'Phase 2: Dashboard Overview',
    description: 'Testing main dashboard, widgets, and quick access features',
    tests: [
      { id: 'DASH-001', name: 'Dashboard Load', steps: 'Login and navigate to dashboard', expected: 'Dashboard displays all widgets correctly' },
      { id: 'DASH-002', name: 'Today Bookings Widget', steps: 'View today\'s bookings widget on dashboard', expected: 'Shows all bookings for today with accurate count' },
      { id: 'DASH-003', name: 'Upcoming Bookings Widget', steps: 'View upcoming bookings widget', expected: 'Shows next 7 days of bookings' },
      { id: 'DASH-004', name: 'Revenue Summary', steps: 'View revenue summary widget', expected: 'Displays current month revenue and comparison' },
      { id: 'DASH-005', name: 'Customer Stats Widget', steps: 'View customer statistics', expected: 'Shows total customers, new customers, and returning' },
      { id: 'DASH-006', name: 'Quick Actions', steps: 'Click on quick action buttons (new booking, etc)', expected: 'Opens corresponding modal/page' },
      { id: 'DASH-007', name: 'Recent Activity Feed', steps: 'View recent activity on dashboard', expected: 'Displays latest bookings, messages, and events' },
      { id: 'DASH-008', name: 'Weather Widget (Aesthetic)', steps: 'View weather widget if available', expected: 'Displays current weather and forecast' },
      { id: 'DASH-009', name: 'AI Insights Panel', steps: 'View AI-generated insights section', expected: 'Shows suggested actions and recommendations' },
      { id: 'DASH-010', name: 'Notification Bell', steps: 'Check notification bell for unread notifications', expected: 'Count badge updates correctly' },
      { id: 'DASH-011', name: 'Date Range Selector', steps: 'Change dashboard date range', expected: 'All widgets update with new date range data' },
      { id: 'DASH-012', name: 'Mobile Responsive Dashboard', steps: 'View dashboard on mobile device', expected: 'Dashboard layout adapts properly to mobile' }
    ]
  },
  {
    name: 'Phase 3: Booking Management',
    description: 'Testing booking creation, modification, cancellation, and status management',
    tests: [
      { id: 'BOOK-001', name: 'Create Booking Manually', steps: 'Go to bookings, click new booking, fill form, save', expected: 'Booking created with PENDING status' },
      { id: 'BOOK-002', name: 'Create Booking with Service', steps: 'Select service during booking creation', expected: 'Service selected, price auto-filled' },
      { id: 'BOOK-003', name: 'Create Booking with Customer', steps: 'Select existing customer or create new', expected: 'Customer linked to booking' },
      { id: 'BOOK-004', name: 'Set Booking Time', steps: 'Select date and time for booking', expected: 'Time slot reserved, conflicts checked' },
      { id: 'BOOK-005', name: 'Assign Staff Member', steps: 'Assign service provider to booking', expected: 'Staff member assigned and available in calendar' },
      { id: 'BOOK-006', name: 'Add Booking Notes', steps: 'Add internal notes to booking', expected: 'Notes saved and visible to staff' },
      { id: 'BOOK-007', name: 'Confirm Booking', steps: 'Change booking status to CONFIRMED', expected: 'Status updated, confirmation sent to customer' },
      { id: 'BOOK-008', name: 'Mark Booking In Progress', steps: 'Change status to IN_PROGRESS', expected: 'Status updated in real-time' },
      { id: 'BOOK-009', name: 'Complete Booking', steps: 'Change status to COMPLETED', expected: 'Booking marked complete, invoice created' },
      { id: 'BOOK-010', name: 'Cancel Booking', steps: 'Cancel a pending booking', expected: 'Status changed to CANCELLED, time slot released' },
      { id: 'BOOK-011', name: 'No-Show Booking', steps: 'Mark booking as NO_SHOW', expected: 'Status updated, customer flagged' },
      { id: 'BOOK-012', name: 'Edit Booking Details', steps: 'Edit time, service, or staff on existing booking', expected: 'Changes saved, conflicts checked' },
      { id: 'BOOK-013', name: 'Bulk Reschedule', steps: 'Reschedule multiple bookings at once', expected: 'All bookings rescheduled successfully' },
      { id: 'BOOK-014', name: 'Booking Search', steps: 'Search for booking by customer name or ID', expected: 'Search results show matching bookings' },
      { id: 'BOOK-015', name: 'Booking Filters', steps: 'Apply filters by status, date, service', expected: 'Bookings filtered correctly' }
    ]
  },
  {
    name: 'Phase 4: Calendar & Scheduling',
    description: 'Testing calendar views, availability management, and scheduling features',
    tests: [
      { id: 'CAL-001', name: 'Month View Calendar', steps: 'Navigate to calendar month view', expected: 'All bookings displayed in month view' },
      { id: 'CAL-002', name: 'Week View Calendar', steps: 'Switch to week view', expected: 'Week view shows hourly slots and bookings' },
      { id: 'CAL-003', name: 'Day View Calendar', steps: 'Switch to day view', expected: 'Day view shows all time slots for selected day' },
      { id: 'CAL-004', name: 'Staff Schedule View', steps: 'View individual staff member schedule', expected: 'Shows only bookings assigned to that staff' },
      { id: 'CAL-005', name: 'Service Schedule View', steps: 'View schedule by service type', expected: 'Shows bookings grouped by service' },
      { id: 'CAL-006', name: 'Drag and Drop Reschedule', steps: 'Drag booking to new time slot in calendar', expected: 'Booking time updated, conflicts prevented' },
      { id: 'CAL-007', name: 'Create Booking from Calendar', steps: 'Click empty time slot to create booking', expected: 'New booking form opens with time pre-filled' },
      { id: 'CAL-008', name: 'Availability Window', steps: 'Set availability hours for staff/service', expected: 'Bookings only possible within availability' },
      { id: 'CAL-009', name: 'Block Time', steps: 'Create block time (break, lunch, etc)', expected: 'Time slot unavailable for bookings' },
      { id: 'CAL-010', name: 'Color Coding by Staff', steps: 'View calendar with staff color coding', expected: 'Each staff member has unique color' }
    ]
  },
  {
    name: 'Phase 5: Inbox & Messaging',
    description: 'Testing messaging features, conversation management, and WhatsApp integration',
    tests: [
      { id: 'MSG-001', name: 'View Conversations List', steps: 'Navigate to inbox, view all conversations', expected: 'All conversations displayed with latest message' },
      { id: 'MSG-002', name: 'Open Conversation', steps: 'Click on a conversation', expected: 'Full message history loaded' },
      { id: 'MSG-003', name: 'Send Text Message', steps: 'Type and send message in conversation', expected: 'Message delivered with timestamp' },
      { id: 'MSG-004', name: 'Send Template Message', steps: 'Select and send pre-defined template', expected: 'Template message sent to customer' },
      { id: 'MSG-005', name: 'WhatsApp Integration', steps: 'Receive/send WhatsApp message', expected: 'Messages sync across WhatsApp and inbox' },
      { id: 'MSG-006', name: 'Message Search', steps: 'Search for specific message or conversation', expected: 'Search results show matching messages' },
      { id: 'MSG-007', name: 'Message Status Updates', steps: 'Monitor message delivery and read status', expected: 'Status shows sent/delivered/read' },
      { id: 'MSG-008', name: 'Conversation Tags', steps: 'Add tags to conversation', expected: 'Tags saved and filterable' },
      { id: 'MSG-009', name: 'Assign Conversation', steps: 'Assign conversation to staff member', expected: 'Staff member notified of assignment' },
      { id: 'MSG-010', name: 'Close Conversation', steps: 'Mark conversation as resolved', expected: 'Conversation moves to resolved tab' },
      { id: 'MSG-011', name: 'Snooze Conversation', steps: 'Snooze conversation for later', expected: 'Conversation reappears at set time' },
      { id: 'MSG-012', name: 'AI Auto-Reply', steps: 'Enable AI auto-replies for business', expected: 'Incoming messages get AI responses' },
      { id: 'MSG-013', name: 'Rich Text Formatting', steps: 'Send message with bold/italic/links', expected: 'Formatting preserved in message' },
      { id: 'MSG-014', name: 'Attachment Sending', steps: 'Send image or file in message', expected: 'Attachment delivered successfully' }
    ]
  },
  {
    name: 'Phase 6: Customer Management',
    description: 'Testing customer profiles, contact information, and customer relationship features',
    tests: [
      { id: 'CUST-001', name: 'View Customers List', steps: 'Navigate to customers section', expected: 'All customers displayed with search and filters' },
      { id: 'CUST-002', name: 'Create New Customer', steps: 'Click create customer, fill form, save', expected: 'Customer created with unique ID' },
      { id: 'CUST-003', name: 'Edit Customer Details', steps: 'Update customer name, phone, email, address', expected: 'Changes saved and reflected everywhere' },
      { id: 'CUST-004', name: 'View Customer Profile', steps: 'Click on customer to view full profile', expected: 'Shows bookings, messages, history' },
      { id: 'CUST-005', name: 'Add Custom Fields', steps: 'Add custom intake fields to customer (Aesthetic: skin type, concerns, etc)', expected: 'Custom fields saved and editable' },
      { id: 'CUST-006', name: 'Customer Tags', steps: 'Add tags to customer profile', expected: 'Tags saved, filterable by tag' },
      { id: 'CUST-007', name: 'Add Customer Notes', steps: 'Add internal notes to customer', expected: 'Notes visible to all staff' },
      { id: 'CUST-008', name: 'View Booking History', steps: 'View all past and future bookings for customer', expected: 'Complete booking history displayed' },
      { id: 'CUST-009', name: 'Customer Communication History', steps: 'View all messages with customer', expected: 'Full message timeline displayed' },
      { id: 'CUST-010', name: 'Merge Duplicate Customers', steps: 'Merge two duplicate customer records', expected: 'Duplicates merged, data consolidated' },
      { id: 'CUST-011', name: 'Customer Segmentation', steps: 'Segment customers by criteria', expected: 'Customer groups created for campaigns' },
      { id: 'CUST-012', name: 'Export Customer List', steps: 'Export customers to CSV', expected: 'CSV file downloaded with all data' },
      { id: 'CUST-013', name: 'Import Customers', steps: 'Import customers from CSV file', expected: 'Customers imported, duplicates handled' },
      { id: 'CUST-014', name: 'Blacklist/Block Customer', steps: 'Block a customer from booking', expected: 'Customer cannot create bookings' }
    ]
  },
  {
    name: 'Phase 7: Waitlist Management',
    description: 'Testing waitlist functionality, notifications, and slot matching',
    tests: [
      { id: 'WAIT-001', name: 'Add Customer to Waitlist', steps: 'Navigate to waitlist, add customer with desired service/date', expected: 'Customer added to waitlist' },
      { id: 'WAIT-002', name: 'View Waitlist', steps: 'View all waitlisted customers', expected: 'Waitlist displayed with creation date' },
      { id: 'WAIT-003', name: 'Notify Waitlist Customer', steps: 'Manually notify waitlist customer of opening', expected: 'Customer receives notification' },
      { id: 'WAIT-004', name: 'Auto-Match Slot (Operational Agent)', steps: 'Trigger WaitlistAgent to find matching slots', expected: 'Agent creates action card for opening slot' },
      { id: 'WAIT-005', name: 'Waitlist Expiry', steps: 'Check waitlist entry expiration after 48 hours', expected: 'Expired entries archived or removed' },
      { id: 'WAIT-006', name: 'Customer Accepts Offer', steps: 'Customer accepts waitlist booking offer', expected: 'Booking created from waitlist' },
      { id: 'WAIT-007', name: 'Customer Declines Offer', steps: 'Customer declines waitlist offer', expected: 'Entry remains active for other slots' },
      { id: 'WAIT-008', name: 'Remove from Waitlist', steps: 'Remove customer from waitlist', expected: 'Customer removed, archived in history' }
    ]
  },
  {
    name: 'Phase 8: Services & Pricing',
    description: 'Testing service creation, pricing management, and service catalog',
    tests: [
      { id: 'SVC-001', name: 'Create Service', steps: 'Create new service (Aesthetic: consultation, facial, etc)', expected: 'Service created with price and duration' },
      { id: 'SVC-002', name: 'Edit Service Details', steps: 'Edit service name, description, duration, price', expected: 'Changes saved and reflected in bookings' },
      { id: 'SVC-003', name: 'Service Categories', steps: 'Organize services into categories', expected: 'Categories visible in booking form' },
      { id: 'SVC-004', name: 'Service Variants (Aesthetic)', steps: 'Create service variants (size, area, intensity)', expected: 'Variants selectable during booking' },
      { id: 'SVC-005', name: 'Staff Service Assignment', steps: 'Assign services to specific staff members', expected: 'Service only bookable with assigned staff' },
      { id: 'SVC-006', name: 'Service Pricing', steps: 'Set pricing for services', expected: 'Price used for invoices and revenue' },
      { id: 'SVC-007', name: 'Service Commission', steps: 'Set staff commission rates for service', expected: 'Commission calculated on bookings' },
      { id: 'SVC-008', name: 'Bulk Service Update', steps: 'Update multiple services at once', expected: 'All selected services updated' },
      { id: 'SVC-009', name: 'Service Deactivation', steps: 'Deactivate a service', expected: 'Service no longer available for new bookings' },
      { id: 'SVC-010', name: 'Service Packages', steps: 'Create service packages/bundles (Aesthetic: packages)', expected: 'Packages available for booking' }
    ]
  },
  {
    name: 'Phase 9: Staff Management',
    description: 'Testing staff profiles, roles, permissions, and scheduling',
    tests: [
      { id: 'STAFF-001', name: 'Add Staff Member', steps: 'Create new staff member with role and services', expected: 'Staff member added, login created' },
      { id: 'STAFF-002', name: 'Assign Roles', steps: 'Assign roles (ADMIN, AGENT, SERVICE_PROVIDER)', expected: 'Permissions applied correctly' },
      { id: 'STAFF-003', name: 'Staff Services', steps: 'Assign services to staff member', expected: 'Staff can only book assigned services' },
      { id: 'STAFF-004', name: 'Staff Schedule', steps: 'Set working hours and availability', expected: 'Bookings only during available hours' },
      { id: 'STAFF-005', name: 'Staff Commission', steps: 'Set commission rates for staff', expected: 'Commission tracked and reportable' },
      { id: 'STAFF-006', name: 'Staff Documents (Aesthetic)', steps: 'Upload staff certifications/qualifications', expected: 'Documents stored in staff profile' },
      { id: 'STAFF-007', name: 'Deactivate Staff', steps: 'Deactivate staff member account', expected: 'Staff cannot login or receive bookings' },
      { id: 'STAFF-008', name: 'View Staff Performance', steps: 'View staff performance metrics', expected: 'Shows bookings completed, ratings, revenue' }
    ]
  },
  {
    name: 'Phase 10: Invoicing & Payments',
    description: 'Testing invoice generation, payment processing, and financial reporting',
    tests: [
      { id: 'INV-001', name: 'Auto-Generate Invoice', steps: 'Complete booking, verify invoice auto-created', expected: 'Invoice generated with correct amount' },
      { id: 'INV-002', name: 'View Invoice', steps: 'Click invoice on booking or in invoices section', expected: 'Invoice displays with all details' },
      { id: 'INV-003', name: 'Customize Invoice Template', steps: 'Edit invoice template with business info', expected: 'Template updated for future invoices' },
      { id: 'INV-004', name: 'Email Invoice', steps: 'Send invoice to customer email', expected: 'Invoice emailed, delivery confirmed' },
      { id: 'INV-005', name: 'Download Invoice PDF', steps: 'Download invoice as PDF', expected: 'PDF file downloaded with proper formatting' },
      { id: 'INV-006', name: 'Stripe Integration', steps: 'Process payment via Stripe (if enabled)', expected: 'Payment processed, invoice marked paid' },
      { id: 'INV-007', name: 'Deposit Management', steps: 'Collect deposit before service', expected: 'Booking marked PENDING_DEPOSIT' },
      { id: 'INV-008', name: 'Apply Discount', steps: 'Apply discount code to invoice', expected: 'Discount applied, total reduced' },
      { id: 'INV-009', name: 'Mark Invoice Paid', steps: 'Manually mark invoice as paid', expected: 'Invoice status updated' },
      { id: 'INV-010', name: 'Payment Reminders', steps: 'Send payment reminder for unpaid invoice', expected: 'Customer receives payment reminder' }
    ]
  },
  {
    name: 'Phase 11: Marketing & Campaigns',
    description: 'Testing marketing campaigns, customer outreach, and promotional features',
    tests: [
      { id: 'MKT-001', name: 'Create Campaign', steps: 'Create new marketing campaign via admin', expected: 'Campaign created with scheduling' },
      { id: 'MKT-002', name: 'WhatsApp Campaign', steps: 'Send WhatsApp campaign to customer segment', expected: 'Messages sent to all selected customers' },
      { id: 'MKT-003', name: 'Email Campaign', steps: 'Send email campaign to customer list', expected: 'Emails delivered, open rates tracked' },
      { id: 'MKT-004', name: 'SMS Campaign', steps: 'Send SMS to customers', expected: 'SMS delivered successfully' },
      { id: 'MKT-005', name: 'Campaign Scheduling', steps: 'Schedule campaign for future date/time', expected: 'Campaign sends at scheduled time' },
      { id: 'MKT-006', name: 'A/B Testing', steps: 'Create A/B test variants in campaign', expected: 'Different variants sent to segments' },
      { id: 'MKT-007', name: 'Campaign Analytics', steps: 'View campaign performance metrics', expected: 'Shows delivery rate, clicks, conversions' },
      { id: 'MKT-008', name: 'Testimonial Request', steps: 'Send testimonial request to customer', expected: 'Customer receives request, can submit review' },
      { id: 'MKT-009', name: 'Promotional Codes', steps: 'Create and manage promotional codes', expected: 'Codes work in checkout/booking' },
      { id: 'MKT-010', name: 'Review Management (Aesthetic)', steps: 'Manage customer reviews and ratings', expected: 'Reviews displayed, filterable by rating' }
    ]
  },
  {
    name: 'Phase 12: AI Agents & Automation',
    description: 'Testing AI-powered agents, automation rules, and intelligent features',
    tests: [
      { id: 'AI-001', name: 'Waitlist Agent', steps: 'Check WaitlistAgent action cards creation', expected: 'Agent creates offer cards for matching slots' },
      { id: 'AI-002', name: 'Retention Agent', steps: 'Check RetentionAgent identifies at-risk customers', expected: 'Win-back action cards created' },
      { id: 'AI-003', name: 'Data Hygiene Agent', steps: 'Check DataHygieneAgent finds duplicates', steps: 'Triggers duplicate merge suggestions', expected: 'Duplicate detection cards created' },
      { id: 'AI-004', name: 'Scheduling Optimizer Agent', steps: 'Check SchedulingOptimizerAgent optimizes slots', expected: 'Gap-filling suggestions provided' },
      { id: 'AI-005', name: 'Quote Followup Agent', steps: 'Check QuoteFollowupAgent sends reminders', expected: 'Expired quote reminders sent' },
      { id: 'AI-006', name: 'Booking Assistant', steps: 'Customer asks to book appointment via chat', expected: 'AI guides through booking steps' },
      { id: 'AI-007', name: 'Auto-Reply System', steps: 'Send message during off-hours', expected: 'AI auto-replies to customer' },
      { id: 'AI-008', name: 'Intent Detection', steps: 'Customer message contains booking request', expected: 'AI correctly detects intent' },
      { id: 'AI-009', name: 'Autonomy Levels', steps: 'Check AI autonomy settings (OFF/SUGGEST/AUTO_WITH_REVIEW/FULL_AUTO)', expected: 'AI operates at configured autonomy level' },
      { id: 'AI-010', name: 'Action Card Management', steps: 'Create, review, and execute action cards', expected: 'Cards execute recommended actions' },
      { id: 'AI-011', name: 'Smart Scheduling', steps: 'Request AI to find optimal booking time', expected: 'AI suggests best available slots' },
      { id: 'AI-012', name: 'Customer Insights', steps: 'View AI-generated customer insights', expected: 'Shows behavioral patterns and recommendations' }
    ]
  },
  {
    name: 'Phase 13: Reports & Analytics',
    description: 'Testing reporting features, analytics dashboards, and data exports',
    tests: [
      { id: 'RPT-001', name: 'Revenue Report', steps: 'Generate revenue report for date range', expected: 'Shows total revenue, by service, by staff' },
      { id: 'RPT-002', name: 'Booking Report', steps: 'Generate booking report', expected: 'Shows booking statistics, trends' },
      { id: 'RPT-003', name: 'Customer Report', steps: 'Generate customer report', expected: 'Shows customer acquisition, retention metrics' },
      { id: 'RPT-004', name: 'Staff Performance Report', steps: 'Generate staff performance metrics', expected: 'Shows bookings, ratings, revenue per staff' },
      { id: 'RPT-005', name: 'Export to CSV', steps: 'Export report data to CSV', expected: 'CSV file downloaded with all data' },
      { id: 'RPT-006', name: 'Scheduled Reports', steps: 'Schedule report to email automatically', expected: 'Report sent at scheduled frequency' },
      { id: 'RPT-007', name: 'Custom Report Builder', steps: 'Create custom report with selected metrics', expected: 'Custom report generated' },
      { id: 'RPT-008', name: 'Dashboard Analytics', steps: 'View analytics on main dashboard', expected: 'Real-time metrics displayed' }
    ]
  },
  {
    name: 'Phase 14: Settings & Configuration',
    description: 'Testing business settings, integrations, and system configuration',
    tests: [
      { id: 'SET-001', name: 'Business Information', steps: 'Edit business name, address, phone, email', expected: 'Information saved and updated everywhere' },
      { id: 'SET-002', name: 'Business Hours', steps: 'Configure business operating hours', expected: 'Hours used for booking availability' },
      { id: 'SET-003', name: 'Time Zone', steps: 'Set business time zone', expected: 'All times displayed in correct time zone' },
      { id: 'SET-004', name: 'Vertical Pack Settings', steps: 'Configure vertical-specific settings (Aesthetic)', expected: 'Settings applied, custom fields visible' },
      { id: 'SET-005', name: 'Booking Policies', steps: 'Set cancellation/reschedule policies', expected: 'Policies enforced in booking flows' },
      { id: 'SET-006', name: 'Notification Settings', steps: 'Configure notification preferences', expected: 'Notifications sent per preferences' },
      { id: 'SET-007', name: 'Payment Settings', steps: 'Configure Stripe and payment methods', expected: 'Payments processed correctly' },
      { id: 'SET-008', name: 'Email Templates', steps: 'Customize email templates', expected: 'Custom emails sent to customers' },
      { id: 'SET-009', name: 'API Integration', steps: 'Enable and configure API access', expected: 'API tokens generated, working' },
      { id: 'SET-010', name: 'Backup & Security', steps: 'Configure backup and security settings', expected: 'Settings saved and enforced' },
      { id: 'SET-011', name: 'Dark Mode Toggle', steps: 'Toggle dark mode in settings', expected: 'Interface switches to dark theme' },
      { id: 'SET-012', name: 'Language/Localization', steps: 'Change language to Spanish', expected: 'Interface displayed in Spanish' },
      { id: 'SET-013', name: 'Two-Factor Authentication', steps: 'Enable 2FA for staff accounts', expected: '2FA required for login' },
      { id: 'SET-014', name: 'Role-Based Permissions', steps: 'Configure permissions by staff role', expected: 'Staff can only access assigned areas' },
      { id: 'SET-015', name: 'Database Backup', steps: 'Trigger manual backup', expected: 'Backup completed successfully' },
      { id: 'SET-016', name: 'Integration Management', steps: 'View and manage all integrations', expected: 'All connected services displayed' },
      { id: 'SET-017', name: 'Audit Log', steps: 'View audit log of system changes', expected: 'All changes logged with timestamp and user' },
      { id: 'SET-018', name: 'Rate Limiting', steps: 'Check API rate limits and usage', expected: 'Limits enforced and reported' },
      { id: 'SET-019', name: 'SSL Certificate', steps: 'Verify SSL certificate validity', expected: 'Certificate valid and HTTPS working' },
      { id: 'SET-020', name: 'CORS Configuration', steps: 'Configure CORS for API access', expected: 'CORS headers set correctly' }
    ]
  },
  {
    name: 'Phase 15: Navigation & User Experience',
    description: 'Testing navigation, UI responsiveness, accessibility, and general UX',
    tests: [
      { id: 'NAV-001', name: 'Sidebar Navigation', steps: 'Click through main sidebar menu items', expected: 'All pages load correctly' },
      { id: 'NAV-002', name: 'Command Palette (Cmd+K)', steps: 'Open command palette and search for page', expected: 'Page found and navigated to' },
      { id: 'NAV-003', name: 'Mobile Navigation', steps: 'View navigation on mobile device', expected: 'Mobile menu works, hamburger toggle' },
      { id: 'NAV-004', name: 'Breadcrumb Navigation', steps: 'Use breadcrumbs to navigate back', expected: 'Breadcrumbs navigate correctly' },
      { id: 'NAV-005', name: 'Back Button', steps: 'Use browser back button', expected: 'Navigation history maintained' },
      { id: 'NAV-006', name: 'Search Functionality', steps: 'Use global search to find records', expected: 'Search returns accurate results' },
      { id: 'NAV-007', name: 'Sort & Filter', steps: 'Sort list columns, apply filters', expected: 'Sorting and filtering work correctly' },
      { id: 'NAV-008', name: 'Pagination', steps: 'Navigate through paginated lists', expected: 'Pagination controls work smoothly' },
      { id: 'NAV-009', name: 'Modal Dialogs', steps: 'Open and close various modals', expected: 'Modals open/close without errors' },
      { id: 'NAV-010', name: 'Keyboard Shortcuts', steps: 'Test keyboard shortcuts throughout app', expected: 'Shortcuts work as documented' }
    ]
  }
];

// Helper function to create a table row
function createTableRow(cells, isHeader = false, rowIndex = 0) {
  const borderColor = 'cccccc';
  return new TableRow({
    height: { value: isHeader ? 600 : 500, rule: 'atLeast' },
    children: cells.map((text, colIndex) => {
      const bgColor = !isHeader && rowIndex % 2 === 1 ? 'F0F0F0' : 'FFFFFF';
      return new TableCell({
        shading: { type: ShadingType.CLEAR, fill: bgColor },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
          left: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
          right: { style: BorderStyle.SINGLE, size: 6, color: borderColor }
        },
        margins: { top: 80, bottom: 80, left: 100, right: 100 },
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            text: text,
            style: isHeader ? 'Heading3' : 'Normal',
            alignment: colIndex === 0 ? AlignmentType.LEFT : AlignmentType.LEFT,
            run: new TextRun({
              font: 'Arial',
              size: isHeader ? 20 : 18,
              bold: isHeader,
              color: isHeader ? SAGE_HEX : '000000'
            })
          })
        ]
      });
    })
  });
}

// Create the document
const doc = new Document({
  sections: [{
    properties: {
      page: {
        margins: { top: 1440, bottom: 1440, left: 1440, right: 1440 }
      }
    },
    children: [
      // Cover Page
      new Paragraph({
        text: 'BookingOS',
        style: 'Heading1',
        alignment: AlignmentType.CENTER,
        spacing: { line: 360, after: 200 },
        run: new TextRun({
          font: 'Arial',
          size: 80,
          bold: true,
          color: SAGE_HEX
        })
      }),
      new Paragraph({
        text: 'Manual QA Test Plan',
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
        run: new TextRun({
          font: 'Arial',
          size: 56,
          bold: false,
          color: SLATE
        })
      }),
      new Paragraph({
        text: 'Aesthetic Vertical - Glow Aesthetic Clinic',
        alignment: AlignmentType.CENTER,
        spacing: { after: 800 },
        run: new TextRun({
          font: 'Arial',
          size: 24,
          italic: true,
          color: '666666'
        })
      }),
      new Paragraph({
        text: `Version: 1.0\nDate: April 3, 2026\nTest Phases: 15\nTotal Test Cases: 169`,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        run: new TextRun({
          font: 'Arial',
          size: 22,
          color: '333333'
        })
      }),
      new PageBreak(),

      // Executive Summary
      new Paragraph({
        text: 'Executive Summary',
        style: 'Heading1',
        spacing: { before: 200, after: 200 },
        run: new TextRun({
          font: 'Arial',
          size: 40,
          bold: true,
          color: SAGE_HEX
        })
      }),
      new Paragraph({
        text: 'This comprehensive test plan covers 169 test cases organized across 15 phases to ensure complete validation of the BookingOS platform for the Aesthetic vertical.',
        spacing: { after: 200 },
        run: new TextRun({ font: 'Arial', size: 22 })
      }),
      new Paragraph({
        text: 'Test Coverage:',
        style: 'Heading2',
        spacing: { before: 100, after: 100 },
        run: new TextRun({ font: 'Arial', size: 24, bold: true, color: SAGE_HEX })
      }),
      new Paragraph({
        text: '• Authentication & Login (8 cases)\n• Dashboard Overview (12 cases)\n• Booking Management (15 cases)\n• Calendar & Scheduling (10 cases)\n• Inbox & Messaging (14 cases)\n• Customer Management (14 cases)\n• Waitlist Management (8 cases)\n• Services & Pricing (10 cases)\n• Staff Management (8 cases)\n• Invoicing & Payments (10 cases)\n• Marketing & Campaigns (10 cases)\n• AI Agents & Automation (12 cases)\n• Reports & Analytics (8 cases)\n• Settings & Configuration (20 cases)\n• Navigation & User Experience (10 cases)',
        spacing: { after: 400 },
        run: new TextRun({ font: 'Arial', size: 22 })
      }),
      new Paragraph({
        text: 'This plan validates core functionality, user workflows, integrations, and system stability across all major features of the BookingOS platform.',
        spacing: { after: 200 },
        run: new TextRun({ font: 'Arial', size: 22 })
      }),
      new PageBreak(),

      // Generate test phase sections
      ...testPhases.flatMap((phase, phaseIndex) => [
        new Paragraph({
          text: phase.name,
          style: 'Heading1',
          spacing: { before: 200, after: 100 },
          run: new TextRun({
            font: 'Arial',
            size: 40,
            bold: true,
            color: SAGE_HEX
          })
        }),
        new Paragraph({
          text: phase.description,
          spacing: { after: 200 },
          run: new TextRun({ font: 'Arial', size: 22, color: '666666' })
        }),

        // Test cases table
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            createTableRow(['Test ID', 'Test Case Name', 'Steps to Execute', 'Expected Result', 'Status', 'Notes'], true),
            ...phase.tests.map((test, testIndex) =>
              createTableRow(
                [test.id, test.name, test.steps, test.expected, '', ''],
                false,
                testIndex
              )
            )
          ]
        }),

        // Page break after each phase except the last
        ...(phaseIndex < testPhases.length - 1 ? [new PageBreak()] : [])
      ]),

      // Summary
      new PageBreak(),
      new Paragraph({
        text: 'Test Summary',
        style: 'Heading1',
        spacing: { before: 200, after: 200 },
        run: new TextRun({
          font: 'Arial',
          size: 40,
          bold: true,
          color: SAGE_HEX
        })
      }),
      new Paragraph({
        text: 'Total Test Cases: 169',
        spacing: { after: 100 },
        run: new TextRun({ font: 'Arial', size: 24, bold: true })
      }),
      new Paragraph({
        text: 'Test Phases: 15',
        spacing: { after: 100 },
        run: new TextRun({ font: 'Arial', size: 24, bold: true })
      }),
      new Paragraph({
        text: 'Coverage: All major functional areas of BookingOS platform',
        spacing: { after: 300 },
        run: new TextRun({ font: 'Arial', size: 24, bold: true })
      }),
      new Paragraph({
        text: 'All test cases should be executed and documented with pass/fail status and any notes during QA testing.',
        spacing: { after: 200 },
        run: new TextRun({ font: 'Arial', size: 22 })
      })
    ]
  }]
});

// Write document
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/vigilant-gallant-heisenberg/mnt/booking-os/BookingOS_Manual_Test_Plan.docx', buffer);
  console.log('Document created successfully: BookingOS_Manual_Test_Plan.docx');
  process.exit(0);
}).catch(err => {
  console.error('Error creating document:', err);
  process.exit(1);
});
