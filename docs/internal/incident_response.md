# Incident Response Plan: PRISM-AI School Attendance System

**Internal document. Not shown to parents or pupils.**
**Owner: Data Protection Officer (DPO), Director of PRISM-AI. Version 1.0.**

This plan states what the school does when personal data in PRISM-AI is exposed, lost, altered, or accessed without permission. It turns the public promises in Sections 10 and 11 of the Privacy Policy into concrete steps, owners, and deadlines.

## 1. Scope

This plan covers all personal data processed by PRISM-AI:

- Pupil records, attendance records, and teacher notes held in the Supabase database.
- Face embeddings (mathematical vectors, not photographs) held in a server-side data file on the school's AI machine.
- Parent, teacher, and staff account data, consent records, and audit logs.

It applies to every adult who uses the system: administrators, teachers, and the DPO.

## 2. Definitions

- **Data breach**: personal data is accidentally or unlawfully disclosed, lost, altered, destroyed, or accessed by someone who should not see it.
- **Awareness**: the moment the school first has a reasonable degree of certainty that a breach has occurred. The 72-hour clock starts here.
- **Containment**: actions that stop the breach from getting worse (stopping the AI, disabling accounts, changing credentials).

## 3. Roles and responsibilities

| Role | Held by | Duties in an incident |
|---|---|---|
| Data Protection Officer | Director of PRISM-AI | Leads the response, decides severity, makes the Commissioner and subject notifications, keeps the breach register |
| School administrator | Named by the school | Runs containment on the school side: disables accounts, stops the AI service, preserves evidence |
| System custodian | PRISM-AI maintainer | Technical containment and investigation: server access, database access, logs, AI machine file checks |
| Staff who notice the incident | Any teacher | Reports to the DPO and the school administrator immediately, changes nothing, deletes nothing |

## 4. Detection

A suspected breach may come to light through any of these channels:

1. A staff member or parent reports odd behaviour (strange access, unexpected emails, a screen showing another child's data).
2. Review of the audit logs in the Supabase dashboard (log entries for face enrolment or removal, AI start and stop, attendance marks, or user changes that no one can explain).
3. Supabase platform alerts (unusual sign-ins, failed permission checks).
4. A check of the AI machine that finds the embedding file was copied, moved, or opened outside the attendance process.

Any staff member who suspects a breach reports it the same day to the DPO. Staff never investigate on their own and never alter or delete records, because the records are the evidence.

## 5. Triage and containment

The DPO classifies the incident within **4 hours** of the report:

- **Critical**: face embeddings, or the whole database, exposed to outsiders. containment starts immediately; Commissioner notification is presumed necessary.
- **Major**: one class or one family's data exposed inside the school user base, or an account misused.
- **Minor**: data shown briefly to an authorised user who should not have seen that particular record (for example, a mis-scoped roster), with no copy taken.

Containment steps, in order, as applicable:

1. Stop the AI attendance service on the AI machine.
2. Disable the affected user accounts in Supabase Auth.
3. Change exposed credentials and access keys.
4. Preserve evidence: export the relevant audit log rows, note file times on the AI machine, screenshot the state before changing anything further.
5. Record the time awareness began. The 72-hour clock starts at this moment.

## 6. Notification

### 6.1 Commissioner: within 72 hours

Where the breach is likely to result in a risk to the rights and data of individuals, the DPO notifies the Personal Data Protection Commissioner within **72 hours of awareness**, as required by the Personal Data Protection Commissioner Circular No. 2/2025 (in force 1 June 2025).

The notification states, as far as known at that time: what happened, the date and time of awareness, the categories and approximate number of individuals and records affected, the likely consequences, and the containment measures taken. If the full picture is not ready in 72 hours, the school notifies in phases and completes the information afterwards.

The DPO records the exact date and time of awareness and of the notification in the breach register.

### 6.2 Affected parents and staff: within 7 days

The DPO notifies affected individuals in writing (email and letter) within **7 days** of awareness where the breach is likely to result in significant harm. The notice states, in plain language: what happened, what data was affected, what the school has done, what the recipient should do (for example, change a password), and a contact point for questions. Where the affected group cannot be identified individually, the school gives the information through a general notice to the parent community.

## 7. Investigation and follow-up

The DPO and the system custodian establish the cause, the full scope, and the fix. The DPO records the findings in the breach register and proposes changes: tighter access, better logging, retraining of staff, or a change to the system. The school administrator confirms each agreed change is actually in place before the incident is closed.

## 8. Breach register

The DPO keeps one row per incident in this register (stored with the school's compliance records, not in the pupil-facing system):

| Field | Entry |
|---|---|
| Register reference | e.g. BR-2026-01 |
| Date and time of awareness | |
| Date and time of containment | |
| Description of the breach | |
| Data categories affected | e.g. attendance records, face embeddings |
| Approximate number of individuals affected | |
| Severity (critical, major, minor) | |
| Commissioner notified (date, time, reference) | |
| Subjects notified (date, method) | |
| Root cause | |
| Remediation agreed and completed | |
| Closed by and date | |

## 9. Testing

The school tests this plan **at least once every 12 months** with a walkthrough or table-top exercise using a realistic scenario (for example, a lost administrator laptop). The DPO records the date, the participants, the weaknesses found, and the corrections made. A plan that has never been rehearsed does not count as ready.

## 10. Related documents

- Privacy Policy, Sections 10 (security) and 11 (breach), published on the /privacy page.
- Internal retention and deletion schedule: `docs/internal/retention.md`.
- Producer's certificate template for attendance records: `docs/internal/evidence_certificate.md`.
