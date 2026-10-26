# Notis Persetujuan Data Biometrik

**Versi 1.0.0 — Berkuat kuasa dari 19 Mei 2026**

Notis ini meminta anda, sebagai ibu bapa atau penjaga sah, sama ada anda bersetuju kepada PRISM-AI memproses data wajah anak anda untuk kehadiran automatik.

Anda boleh menjawab **Ya** atau **Tidak**. Mana-mana pilihan adalah baik. **Menolak tidak menjejaskan hak anak anda untuk bersekolah** — kami akan menggunakan kaedah kehadiran manual sebaliknya (guru memanggil nama setiap kanak-kanak).

---

## 1. Mengapa kami memerlukan persetujuan nyata anda

Undang-undang Malaysia memperlakukan data wajah sebagai **"data peribadi sensitif"** di bawah Akta Perlindungan Data Peribadi 2010, selepas pindaan 2024 [Akta A1727, Seksyen 3(c), berkuat kuasa 1 April 2025]. Ini bermakna kami tidak boleh memprosesnya tanpa **persetujuan bertulis nyata** anda [PDPA Seksyen 40].

Kerana anak anda berusia di bawah 18 tahun, hanya **anda, ibu bapa atau penjaga sah**, boleh memberi persetujuan ini — bukan anak [Akta Kontrak 1950, Seksyen 11; PDPA Seksyen 4 definisi "orang yang berkenaan"].

## 2. Apakah "data wajah"

Apabila anak anda berdiri di hadapan kamera kehadiran sekolah, AI **tidak** menyimpan gambar. Sebaliknya, ia menukar imej kepada senarai 512 nombor ("embedding wajah") yang menerangkan geometri wajah anak anda — seperti cap jari unik, tetapi diperbuat daripada nombor.

Nombor-nombor ini kemudian dibandingkan dengan embedding semua murid yang berdaftar untuk mengenal pasti anak anda.

**Kami tidak menyimpan gambar asal.** Hanya senarai nombor.

## 3. Apa yang akan kami lakukan dengannya

Jika anda bersetuju, kami akan:

1. Menangkap wajah anak anda sekali semasa pendaftaran (di pejabat sekolah, dengan kehadiran anda jika diminta).
2. Menjana embedding daripada tangkapan tersebut.
3. Menyimpan embedding dalam fail data sebelah-pelayan pada mesin AI sekolah.
4. Menggunakannya untuk menanda anak anda hadir apabila mereka berjalan melepasi kamera kehadiran sekolah.

Kami **tidak** akan:

- Menggunakan data wajah untuk pemasaran.
- Berkongsi dengan pihak ketiga (selain pemproses awan Supabase, yang memegang pangkalan data di bawah kontrak).
- Menggunakannya untuk mengenal pasti anak anda dalam mana-mana foto di luar pengambilan kehadiran.
- Melatih model AI untuk kegunaan komersial.

## 4. Berapa lama kami menyimpannya

Kami akan memadamkan embedding apabila **mana-mana** daripada ini berlaku, yang mana paling awal:

- Anak anda meninggalkan sekolah (tempoh tangguh 90 hari untuk pendaftaran semula).
- Anda menarik balik persetujuan.
- Akhir tahun akademik (persetujuan semula pada awal tahun baharu).

Apabila kami memadam, nombor dibuang daripada fail data pada mesin AI sekolah.

## 5. Hak anda untuk menarik balik

Anda boleh menarik balik persetujuan **pada bila-bila masa, untuk sebarang sebab, tanpa penjelasan**. Untuk menarik balik:

- Buka Portal Ibu Bapa.
- Cari kad "Biometric Consent" untuk anak anda.
- Klik butang "Withdraw" untuk membuka skrin persetujuan, kemudian rakamkan keputusan anda di sana.

Kami akan:

- Berhenti menggunakan wajah anak anda untuk kehadiran serta-merta.
- Membuang data wajah mengikut peraturan pengekalan dalam Seksyen 4.
- Menukar anak anda kepada kehadiran manual.

Anda boleh menyemak status penarikan balik dalam Portal Ibu Bapa pada bila-bila masa. Jika data wajah belum dibuang, sila ingatkan pihak sekolah melalui titik hubungan dalam Seksyen 10.

**Tiada hukuman** kepada anak atau anda untuk menarik balik.

## 6. Hak anda untuk menolak dari awal

Anda boleh memilih **"Tidak"** di bawah. Jika anda begitu:

- Kami tidak akan menangkap atau menyimpan sebarang data wajah untuk anak anda.
- Anak anda akan ditanda hadir menggunakan kehadiran manual (guru memanggil nama setiap murid).
- Ini **tidak** akan menjejaskan markah, rekod tingkah laku, kedudukan sekolah, atau sebarang perkara lain anak anda.

Anda boleh menukar fikiran kemudian (dalam mana-mana arah) pada bila-bila masa melalui Portal Ibu Bapa.

## 7. Keselamatan

Embedding adalah:

- Senarai nombor, bukan gambar.
- Dihantar melalui sambungan sulit (HTTPS).
- Disimpan dalam fail data sebelah-pelayan pada mesin AI sekolah, bukan dalam pangkalan data sekolah.
- Boleh diakses hanya oleh pentadbir sistem.

Tindakan pentadbiran (pendaftaran, pembuangan, memulakan dan menghentikan AI, tandaan kehadiran, dan perubahan pengguna) direkodkan dalam log audit. Bacaan rutin data tidak direkodkan satu persatu.

Kami mengikuti Standard Perlindungan Data Peribadi PDPA 2015 (keselamatan, pengekalan, integriti).

## 8. Jika sesuatu yang salah berlaku

Jika data anak anda terdedah secara tidak sengaja (cth., pelanggaran pangkalan data), kami akan:

- Memberitahu Pesuruhjaya Perlindungan Data Peribadi dalam tempoh **72 jam**.
- Memberitahu anda, secara bertulis, tanpa kelewatan yang tidak perlu.
- Menerangkan apa yang berlaku, data apa yang terjejas, dan apa yang kami lakukan.

Lihat Seksyen 11 [Dasar Privasi](/privacy?lang=bm) kami untuk protokol pelanggaran penuh.

## 9. Hak anda yang lain

Anda mempunyai hak untuk:

- **Bertanya** data apa yang kami pegang tentang anak anda [PDPA Seksyen 30].
- **Membetulkan** sebarang kesilapan [Seksyen 34].
- **Menarik balik** persetujuan (Seksyen 5 di atas).
- **Menerima** data dalam format boleh dibaca-mesin dan minta kami menghantarnya ke tempat lain (hak kemudahalihan PDPA di bawah pindaan 2024).
- **Mengadu** kepada Jabatan Perlindungan Data Peribadi di https://www.pdp.gov.my/ jika anda tidak berpuas hati dengan cara kami mengendalikan ini.

## 10. Hubungi

Untuk sebarang pertanyaan tentang Notis ini:

- **Pegawai Perlindungan Data**: Director of PRISM-AI, forprojectdump@gmail.com
- **Pejabat Sekolah**: *(alamat, telefon)*

Untuk aduan bebas:

- **Jabatan Perlindungan Data Peribadi (JPDP)**: https://www.pdp.gov.my/
- **Borang aduan dalam talian**: https://aduan.pdp.gov.my/

---

## Keputusan anda

> Sila pilih satu pilihan di bawah.

**○ Ya, saya bersetuju.** Saya adalah ibu bapa atau penjaga sah anak yang dinamakan. Saya telah membaca dan memahami Notis ini. Saya memberi PRISM-AI persetujuan nyata untuk menangkap, menyimpan, dan menggunakan data wajah anak saya untuk kehadiran automatik, sebagaimana diterangkan di atas. Saya memahami bahawa saya boleh menarik balik persetujuan ini pada bila-bila masa.

**○ Tidak, saya tidak bersetuju.** Sila tanda kehadiran anak saya secara manual (guru memanggil nama). Hak anak saya untuk bersekolah tidak terjejas. Saya memahami bahawa saya boleh menukar keputusan ini kemudian.

---

*Versi Bahasa Inggeris bagi Notis ini tersedia [di sini](/biometric-consent).*
