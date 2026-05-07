# Budget Bot Functional Checklist

Use this checklist to validate end-to-end behavior across Telegram + Web.

## Preconditions

- [ ] Bot is deployed/running with valid `BOT_TOKEN`
- [ ] DB migrations are applied
- [ ] Web app is reachable (`/app`)
- [ ] Test Telegram account has started the bot at least once

---

## 1) `/start` in Telegram

- [ ] Open Telegram chat with the bot
- [ ] Send `/start`
- [ ] Bot responds with welcome/help text
- [ ] User is registered/stored (if first-time user)
- [ ] No server errors in logs

---

## 2) Send transaction messages in Telegram (multi-amount + notes parsing)

Test several message formats and verify parsed transaction records.

- [ ] Send a message containing **multiple amounts** and notes (example: `200 lunch, 500 salary, 75 tea`)
- [ ] Bot parses all entries correctly (count matches expected)
- [ ] Amount values are correct
- [ ] Type classification (Income/Expense) is correct per entry
- [ ] Notes are attached to the right amounts
- [ ] Send message with mixed separators/spacing and verify parser robustness
- [ ] Invalid/ambiguous message yields safe error/help response (no crash)

---

## 3) `/app` in Telegram

- [ ] Send `/app`
- [ ] Bot returns web app link/button
- [ ] Link opens correctly
- [ ] Page loads without runtime errors

---

## 4) OTP login (username + chat ID)

### Username flow

- [ ] In web app auth screen, enter Telegram username (with and without `@`)
- [ ] Request OTP
- [ ] OTP arrives in Telegram
- [ ] Enter OTP and login succeeds
- [ ] Invalid OTP is rejected with clear error
- [ ] Expired OTP is rejected with clear error

### Chat ID flow

- [ ] In web app auth screen, enter numeric chat ID
- [ ] Request OTP
- [ ] OTP arrives in Telegram
- [ ] Enter OTP and login succeeds

---

## 5) Data sync both ways (Telegram ↔ Web)

### Telegram -> Web

- [ ] Create transaction in Telegram
- [ ] Open/refresh web dashboard
- [ ] New transaction appears with correct values
- [ ] Summary metrics update accordingly

### Web -> Telegram-visible state

- [ ] Edit a transaction in web app (amount/type/note)
- [ ] Change persists after refresh
- [ ] Delete one or more transactions in web app
- [ ] Deletions persist after refresh
- [ ] In Telegram, run commands that read data (e.g. balance/transactions) and confirm web changes are reflected

### Telegram updates after web change

- [ ] Add/edit data from Telegram after web edits
- [ ] Refresh web app and confirm latest Telegram changes appear

---

## 6) Balance and transactions commands in Telegram

- [ ] Run balance command (`/balance` or configured equivalent)
- [ ] Returned balance matches DB/web summary
- [ ] Run transactions listing command (`/transactions` or configured equivalent)
- [ ] Returned list reflects latest state (including web-side edits/deletes)
- [ ] Command output formatting is readable and correct

---

## Regression / sanity checks

- [ ] Logout from web app works
- [ ] Session cookie invalid/expired behavior is handled gracefully
- [ ] No unhandled exceptions in worker logs during all scenarios
- [ ] Build/tests still pass after validation changes (`npm run build`, `npm test`)
