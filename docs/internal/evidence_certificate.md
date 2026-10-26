# Producer's Certificate Template: PRISM-AI Attendance Records

**Internal document. Not shown to parents or pupils.**
**Owner: Data Protection Officer (DPO), Director of PRISM-AI. Version 1.0.**

This is a fill-in certificate under **Section 90A(2) of the Evidence Act 1950**. It is used when the school needs to put PRISM-AI attendance records before a court or an official body as evidence of a computer-produced document. The producer (the person responsible for the operation of the relevant computer) completes it, signs it, and attaches it to the printout or extract of the records. One certificate is completed per set of records produced.

Do not sign until every blank is filled and every statement is true for the records in question. If a statement is not true for these records, stop and consult the DPO: the records may need a different form of proof.

---

## CERTIFICATE OF A PRODUCER OF A DOCUMENT PRODUCED BY A COMPUTER (Section 90A(2), Evidence Act 1950)

**1. Identification of the records**

- Document produced (title and description): ______________________________________
- Records contained in it: attendance records extracted from the PRISM-AI school attendance system
- Pupil or pupils covered: ______________________________________
- Date range of the records: from ____________ to ____________
- Extract taken on (date): ____________ by: ______________________________________

**2. The relevant computer**

PRISM-AI stores attendance records in a managed PostgreSQL database hosted by Supabase (the "relevant computer"). Teachers and administrators enter and correct attendance through the PRISM-AI web application; the system writes every change to the database and records an audit entry when a mark is made or changed manually.

**3. Statements of the producer**

I, the producer named below, being the person responsible for the operation and management of the relevant computer, certify that:

- (a) the relevant computer was regularly used to store and process attendance information of the kind contained in the attached document over the period covered by that document, being part of the ordinary daily attendance-taking of the school;
- (b) information of the kind contained in the attached document was regularly supplied to the relevant computer over that period, through the normal daily use of the PRISM-AI system by the school's staff;
- (c) throughout the greater part of that period the relevant computer was operating properly, and where it was not operating properly, any defect did not affect the accuracy of the records contained in the attached document;
- (d) the information contained in the attached document was derived from information regularly supplied to the relevant computer for the purposes of the school's attendance recording.

**4. Time source**

Timestamps in the records are set by the **Supabase database server clock** when a record is created by the system. For records marked or corrected manually by a staff member, the marking time may have been supplied by the staff member's device at the moment of marking. The certificate maker should read the records being certified and state below which time sources appear in them:

- Time source observed in these records: ______________________________________
- If manual marks are present: marked times were supplied by the marking staff member's device and recorded by the database; this is disclosed here for completeness.

**5. Producer (signs here)**

- Name: ______________________________________
- Position: ______________________________________
- School: ______________________________________
- Date: ______________________________________
- Signature: ______________________________________

**6. Witnessing (if required by the court or body)**

- Certified before (name of commissioner for oaths or officer): ______________________________________
- Date: ______________________________________

---

## Notes for the person completing this certificate

1. "Producer" means the person responsible for the operation or management of the relevant computer, not the person who typed each record. For PRISM-AI this is normally the school administrator or the system custodian.
2. Attach the extract itself, clearly labelled, and keep a copy of the certificate with the retention records described in `docs/internal/retention.md`.
3. If the court or body questions the records, the audit entries for manual marks (actor, old status, new status) can be produced alongside the certificate.
