# Accounts and the superadmin

Wavelink is multi-user from the first start. Each account links its own phone, has its own database and files, and connects its own AI apps.

## Roles

**User.** Signs in to the dashboard, scans a QR code, uses the inbox and connects ChatGPT or Claude. Sees only their own WhatsApp.

**Superadmin.** Everything a user has, plus the **Users** page to create, reset, disable and delete accounts, and read-only access to every account's chats. The first superadmin is created on first start from `DASHBOARD_USER` and `DASHBOARD_PASSWORD`. There must always be at least one active superadmin; the service refuses to disable or demote the last one.

## What a superadmin can and cannot do with other accounts

Can: open an account's chats in the dashboard, have the AI read or summarise them, and from their own ChatGPT or Claude pass `account: "<username>"` to any read tool.

Cannot: send, reply, change auto-reply, edit memories, unlink WhatsApp or disconnect AI apps for anyone else. The service rejects these at the API, not only in the UI, and the AI tools refuse any `account` on write tools.

Every view of another account is logged (one entry per admin, account and channel every ten minutes). Account owners see the log on their Account page, and the Users page shows the last view per account. There is no silent reading.

## Lifecycle

- **Create**: Users → Add. Give the person their username and a first password. Their WhatsApp starts only when they first open the dashboard and scan the QR code.
- **Reset password** or **disable**: signs that user out of the dashboard everywhere (session version bump) and revokes every AI app token at once.
- **Delete**: unlinks the device from their phone, revokes tokens, and removes the account's whole data folder.
- **Self-service**: users change their own password (which also disconnects their AI apps) and unlink or relink their phone on the Account page.

## Usernames and passwords

Usernames are 3–32 characters, lowercase letters, digits, dots, dashes and underscores. Passwords are hashed with scrypt; the service never stores or logs them in clear text.

## One person, one phone?

A phone can be linked to several Wavelink accounts (WhatsApp allows multiple linked devices), but there is rarely a reason to. One account per person keeps the superadmin log meaningful and the AI's "whose WhatsApp is this" accurate.
