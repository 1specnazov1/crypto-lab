# CRYPTO LAB v79 — Physical Device and Controlled Beta Evidence

Date: 2026-08-05  
Build: 7930  
Execution: not started

## Boundary

Automated Chromium tests do not prove iPhone Safari behavior, Android PWA behavior or real-user usability. This document defines the evidence required from real devices and a controlled beta. It does not recruit participants, create accounts, send mail, enable payments or authorize publication.

## Device evidence header

Create one evidence record for every device/scenario pair.

```text
Evidence ID:
Build: 7930
Repository commit:
PWA cache: crypto-lab-v79-7930-auth1
Platform: iOS | Android
Device model:
OS version:
Browser and version:
Installed PWA: yes | no
Tester alias:
Scenario code:
Started UTC:
Completed UTC:
Result: passed | failed | blocked
Severity when failed: critical | high | medium | low
Expected result:
Actual result:
Reproduction steps:
Screenshot/video reference:
Console error summary:
Network error summary:
Redaction reviewed: yes | no
```

Do not place a real password, confirmation/recovery action URL, email token, provider key, wallet seed, private key or unredacted personal information in evidence.

## iPhone/Safari review

Minimum: one current physical iPhone supported by the owner.

Mandatory sequence:

1. Open the v79 preview through Safari without changing the stable v78 root.
2. Switch RU, UA and EN; reload after each switch.
3. Add the PWA to the Home Screen.
4. Cold-start from the Home Screen.
5. Navigate all primary modules and return to the dashboard.
6. Open the account page and confirm registration/recovery are visibly unavailable while external inputs are absent.
7. Start online, close the app, disable connectivity and verify the offline shell.
8. Restore connectivity and verify recovery without duplicate or stale shell state.
9. Check safe-area insets, portrait/landscape behavior, keyboard overlap, focus visibility and horizontal overflow.
10. Record console/network errors through an approved debugging method without exposing auth links.

## Android/Chrome review

Minimum: one current physical Android device supported by the owner.

Mandatory sequence mirrors iPhone and additionally checks:

- install banner or browser install menu;
- standalone display mode;
- service-worker update after a normal online reload;
- Android back-button navigation;
- keyboard behavior in forms;
- background/foreground transition;
- offline-to-online recovery after process termination.

## Mandatory scenario codes

- `OPEN_V79_PREVIEW`
- `LANGUAGE_RU_UA_EN`
- `INSTALL_PWA`
- `COLD_START_INSTALLED_PWA`
- `RELOAD_AFTER_SERVICE_WORKER_UPDATE`
- `OFFLINE_SHELL_START`
- `ONLINE_RECOVERY_AFTER_OFFLINE`
- `ACCOUNT_PAGE_DISABLED_SIGNUP_STATE`
- `ACCOUNT_PAGE_DISABLED_RECOVERY_STATE`
- `CHART_NAVIGATION`
- `PORTFOLIO_LOCAL_FLOW`
- `CALCULATOR_FLOW`
- `SCANNER_READ_ONLY_FLOW`
- `BACKTEST_READ_ONLY_FLOW`
- `AI_DISABLED_OR_AUTH_GATED_FLOW`
- `KEYBOARD_AND_FOCUS`
- `SAFE_AREA_AND_ORIENTATION`
- `NO_HORIZONTAL_OVERFLOW`
- `NO_CONSOLE_ERROR`
- `NO_V78_ROOT_CHANGE`

## Issue record

```text
Issue ID:
Evidence ID:
Title:
Severity: critical | high | medium | low
Affected platform/device:
Build and commit:
First observed UTC:
Reproduction rate:
Preconditions:
Steps:
Expected:
Actual:
Security/data impact:
Workaround:
Screenshot/video/log reference:
Redaction reviewed:
Owner:
Status: open | investigating | fixed_candidate | verified | closed
Fix commit:
Automated regression run:
Physical regression evidence:
Resolution note:
```

### Severity rules

- **Critical:** security bypass, data loss, unauthorized access, secret exposure, v78 production impact or irreversible corruption.
- **High:** a core flow is unavailable for a broad user group, Auth cannot complete, installed PWA persistently fails or a trading state is materially wrong.
- **Medium:** repeatable functional/UX issue with a viable workaround.
- **Low:** cosmetic, copy or minor accessibility issue without flow failure.

A critical issue stops all beta work. A high issue prevents publication. Confirmed defects are fixed autonomously, but a physical-device defect is not considered verified until it passes again on the affected device class.

## Controlled beta design

Start only after `AUTH_E2E`, `IOS_PWA_REVIEW` and `ANDROID_PWA_REVIEW` are verified.

Initial group:

- minimum 5 participants;
- recommended 10;
- maximum 25 before the first review;
- at least 3 observation days;
- real accounts and owned/consented mailboxes only;
- payments disabled and real-money testing forbidden;
- no manual creation of real signals for test convenience.

Participant identifiers in the issue ledger must be aliases. Email addresses and user IDs remain only in protected operational systems.

## Beta daily evidence

```text
Date UTC:
Active participants:
New accounts completed:
Auth attempts:
Auth completion rate:
PWA install attempts:
PWA install success rate:
Core flow attempts:
Core flow success rate:
Unhandled errors:
Unhandled error rate:
New critical/high/medium/low issues:
Open critical/high issues:
Fixes deployed to v79 preview:
Automated gates after fixes:
Physical regressions completed:
Data/secret leakage review result:
```

## Exit thresholds

- zero open critical issues;
- zero open high issues;
- Auth completion rate at least 95%;
- PWA install success rate at least 90%;
- core-flow success rate at least 95%;
- unhandled-error rate at most 1%;
- all mandatory device scenarios completed on iOS and Android;
- every confirmed fix has automated and applicable physical regression evidence;
- beta issue ledger reviewed and redacted;
- publication remains a separate owner decision.

## Explicitly not completed by this document

- physical iPhone test;
- physical Android test;
- participant recruitment;
- registration/recovery activation;
- mail delivery;
- payment testing;
- v79 publication over v78.
