# Retention and Deletion Schedule: PRISM-AI School Attendance System

**Internal document. Not shown to parents or pupils.**
**Owner: Data Protection Officer (DPO), Director of PRISM-AI. Version 1.0.**

This schedule turns the retention table in Section 7 of the Privacy Policy into an operational checklist with named owners and concrete deletion steps. The published policy and this schedule must always say the same thing; if one changes, the other changes in the same review.

## 1. Schedule

| Data | Retention rule | Deletion trigger | Owner |
|---|---|---|---|
| Pupil records (name, student number, year, class, date of birth, gender, profile photo) | While the pupil is enrolled, plus 7 years after they leave (Education Act archival rules) | 7 years after the leaving date | School administrator |
| Attendance records | 7 years (kept for admissibility under Evidence Act 1950, Sections 90A to 90C) | 7 years after the record date | School administrator |
| Face embeddings (mathematical vectors, not photographs, held in the server-side data file on the school's AI machine) | Deleted within 90 days of the pupil leaving the school, OR on consent withdrawal, OR at the end of the academic year, whichever is earliest | Earliest of: 90 days after leaving, withdrawal of parental consent, end of academic year | PRISM-AI system administrator |
| Teacher notes | While the pupil is enrolled, plus 1 year | 1 year after the leaving date | School administrator |
| Audit logs | 3 years | 3 years after the log entry date | School administrator |
| Notifications | 1 year, then archived | 1 year after the record date | School administrator |

## 2. How deletion is performed

Deletion of face embeddings is a **manual step**. There is no automated job. The PRISM-AI system administrator runs the admin-only face-removal function on the school's AI machine, which removes the pupil's entry from the embedding data file. After running it, the administrator opens the data file and confirms the entry is gone, then records the deletion in the register in Section 3.

Deletion of database records (pupil records, attendance, notes, logs, notifications) is done by the school administrator from the Supabase dashboard, following the same rule: act, then verify, then record.

## 3. Deletion register

One row per deletion action:

| Field | Entry |
|---|---|
| Register reference | e.g. DEL-2026-01 |
| Data and pupil or records affected | |
| Rule applied (which row of the schedule) | |
| Date of deletion | |
| Performed by (name, role) | |
| Verification (how absence was confirmed) | |

## 4. Standing checks

1. **Withdrawal and leaving checklist**: when a pupil withdraws consent or leaves the school, the school administrator adds the face-removal step to the checklist for that pupil, so the manual deletion is not forgotten.
2. **End of academic year**: the PRISM-AI system administrator removes embeddings whose consent was not renewed, in line with the earliest-of rule.
3. **Annual review**: the DPO reviews this schedule once a year against the Privacy Policy and the actual data held, and notes the review date and any corrections.

## 5. Related documents

- Privacy Policy, Section 7 (how long we keep data), published on the /privacy page.
- Incident response plan: `docs/internal/incident_response.md`.
- Producer's certificate template for attendance records: `docs/internal/evidence_certificate.md`.
