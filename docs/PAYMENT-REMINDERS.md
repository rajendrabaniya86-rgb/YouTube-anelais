# Task 7: Payment reminders

- Shop owners can create a reminder for a selected customer with a future date/time and a short note.
- Reminders appear in a dedicated list ordered by due date.
- Shop owners can mark a reminder completed.
- Demo reminders are stored in browser local storage.
- Live reminders are stored in the shop-scoped Supabase payment_reminders table.
- Migration 003 enables RLS and checks that the selected customer belongs to the same shop.
- This version does not send SMS, WhatsApp, email, or background push notifications. It is an in-app reminder list only. A human must review the reminder and contact the customer appropriately.
- Do not create reminders or contact customers without their permission. Use synthetic data in the demo.
## Setup
Apply migrations 001, 002, then 003 in order. Test with separate demo accounts before any real use.
