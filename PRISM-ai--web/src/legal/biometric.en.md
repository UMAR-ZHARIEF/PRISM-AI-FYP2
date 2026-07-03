# Biometric Data Consent Notice

**Version 1.0.0 — Effective from 19 May 2026**

This notice asks you, as the parent or legal guardian, whether you consent to PRISM-AI processing your child's face data for automated attendance.

You can say **Yes** or **No**. Either choice is fine. **Refusing does not affect your child's right to attend school** — we will use a manual attendance method instead (the teacher calls each child's name).

---

## 1. Why we need your explicit consent

Malaysian law treats face data as **"sensitive personal data"** under the Personal Data Protection Act 2010, after the 2024 amendments [Act A1727, Section 3(c), in force 1 April 2025]. This means we cannot process it without your **explicit written consent** [PDPA Section 40].

Because your child is below 18 years old, only **you, the parent or legal guardian**, can give this consent — not the child [Contracts Act 1950, Section 11; PDPA Section 4 definition of "relevant person"].

## 2. What is "face data"

When your child stands in front of the school's attendance camera, the AI does **not** save a photograph. Instead, it converts the image into a list of 512 numbers (a "face embedding") that describes the geometry of your child's face — like a unique fingerprint, but made of numbers.

These numbers are then compared to the embeddings of all enrolled pupils to identify your child.

**We do not keep the original photograph.** Only the list of numbers.

## 3. What we will do with it

If you consent, we will:

1. Capture your child's face once during registration (at the school office, in your presence if requested).
2. Generate the embedding from that capture.
3. Store the embedding in our secure database.
4. Use it to mark your child present when they walk past the school's attendance camera.

We will **not**:

- Use the face data for marketing.
- Share it with third parties (other than the cloud processor Supabase, who holds the database under contract).
- Use it to identify your child in any photo outside of attendance taking.
- Train AI models for commercial use.

## 4. How long we keep it

We will delete the embedding when **any** of these happens, whichever is earliest:

- Your child leaves the school (90-day grace period for re-enrollment).
- You withdraw consent.
- The end of the academic year (re-consent at start of new year).

When we delete, the numbers are wiped from the database and from backups within 30 days.

## 5. Your right to withdraw

You can withdraw consent **at any time, for any reason, without explanation**. To withdraw:

- Open the Parent Portal.
- Go to "My Data" → "Consents".
- Click "Withdraw biometric consent".

We will:

- Stop using your child's face for attendance immediately.
- Delete the embedding within **7 calendar days**.
- Confirm deletion to you by email.
- Switch your child to manual attendance.

There is **no penalty** to your child or to you for withdrawing.

## 6. Your right to refuse from the start

You can choose **"No"** below. If you do:

- We will not capture or store any face data for your child.
- Your child will be marked present using manual attendance (the teacher calls each pupil's name).
- This will **not** affect your child's grades, behaviour record, school standing, or any other matter.

You can change your mind later (in either direction) at any time through the Parent Portal.

## 7. Security

The embedding is:

- Encrypted while stored in the database.
- Encrypted while travelling between the camera and the database.
- Accessible only to authorised school staff (admin and the homeroom teacher).
- Logged every time it is accessed — we keep a record of who looked at it and when.

We follow the PDPA Personal Data Protection Standard 2015 (security, retention, integrity).

## 8. If something goes wrong

If your child's data is ever accidentally exposed (e.g., a database breach), we will:

- Notify the Personal Data Protection Commissioner within **72 hours**.
- Notify you, in writing, without unnecessary delay.
- Explain what happened, what data was affected, and what we are doing.

See Section 11 of our [Privacy Policy](/privacy) for the full breach protocol.

## 9. Your other rights

You have the right to:

- **Ask** what data we hold about your child [PDPA Section 30].
- **Correct** any mistakes [Section 34].
- **Withdraw** consent (Section 5 above).
- **Receive** the data in a machine-readable format and ask us to send it elsewhere (PDPA portability right under the 2024 amendments).
- **Complain** to the Department of Personal Data Protection at https://www.pdp.gov.my/ if you are unhappy with how we have handled this.

## 10. Contact

For any questions about this Notice:

- **Data Protection Officer** (school's DPO): *to be filled in by the school.*
- **School Office**: *(address, phone)*

For independent complaints:

- **Department of Personal Data Protection (JPDP)**: https://www.pdp.gov.my/
- **Online complaint form**: https://aduan.pdp.gov.my/

---

## Your decision

> Please choose one option below.

**○ Yes, I consent.** I am the parent or legal guardian of the named child. I have read and understood this Notice. I give PRISM-AI explicit consent to capture, store, and use my child's face data for automated attendance, as described above. I understand I can withdraw this consent at any time.

**○ No, I do not consent.** Please mark my child's attendance manually (teacher calls names). My child's right to attend school is not affected. I understand I can change this decision later.

---

*A Bahasa Malaysia version of this Notice is available [here](/biometric-consent?lang=bm).*
