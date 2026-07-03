# Dasar Privasi PRISM-AI

**Versi 1.0.0 — Berkuat kuasa dari 19 Mei 2026**

Dasar Privasi ini menerangkan cara PRISM-AI mengumpul, menggunakan, menyimpan, dan melindungi data peribadi, mematuhi **Akta Perlindungan Data Peribadi 2010 (Akta 709)** Malaysia sebagaimana dipinda oleh **Akta Perlindungan Data Peribadi (Pindaan) 2024 (Akta A1727)**.

Jika anda membaca ini bagi pihak kanak-kanak, sila ambil perhatian bahawa dasar ini memberi data kanak-kanak perlindungan tambahan kerana undang-undang Malaysia menganggap kanak-kanak tidak boleh memberi persetujuan sendiri [Akta Kontrak 1950, Seksyen 11].

---

## 1. Siapa pengawal data

**Sekolah** adalah pengawal data. Pembangun (perisian PRISM-AI) adalah pemproses data yang bekerja mengikut arahan sekolah.

**Pegawai Perlindungan Data (DPO)** yang dilantik oleh sekolah akan dinamakan di sini setelah sekolah melantik seorang (dikehendaki di bawah PDPA Seksyen 12A yang baharu dari 1 Jun 2025):

- **Nama**: *Untuk dilantik oleh sekolah.*
- **E-mel**: *Untuk dipaparkan oleh sekolah.*
- **Alamat pos**: *Alamat pejabat sekolah.*

Anda boleh menghubungi DPO pada bila-bila masa tentang data anda.

## 2. Data yang kami kumpul

Kami mengumpul kategori data peribadi berikut:

### Tentang murid
- Nama penuh, nombor murid, tahun, kelas
- Tarikh lahir, jantina
- Foto profil (jika dimuat naik)
- **Embedding wajah** — senarai nombor yang mewakili struktur geometri wajah anak, dijana oleh model AI. *Ini adalah data peribadi sensitif.* Lihat Seksyen 8 di bawah.
- Rekod kehadiran (tarikh, masa, status: hadir/tidak hadir/lewat)
- Catatan guru tentang tingkah laku, prestasi, atau kebajikan

### Tentang ibu bapa dan kakitangan
- Nama penuh, e-mel, nombor telefon
- Peranan dalam sistem (ibu bapa, guru, pentadbir, pembantu)
- Foto profil (jika dimuat naik)
- Rekod versi Terma dan Dasar Privasi yang telah anda terima
- Rekod sebarang persetujuan yang anda berikan atau tarik balik untuk data biometrik anak
- Catatan log audit apabila anda mengambil tindakan penting (log masuk, suntingan, pemadaman)
- Alamat IP dan ejen-pengguna pelayar (untuk keselamatan dan audit)

Kami mengumpul data daripada:

- **Anda**, apabila anda mengisi borang dalam PRISM-AI.
- **Sekolah**, apabila mereka mendaftar anak anda.
- **Peranti automatik** di sekolah (kamera di pintu masuk) apabila pengecaman wajah didayakan dengan persetujuan.

## 3. Mengapa kami mengumpulnya

Kami menggunakan data peribadi hanya untuk tujuan ini:

1. **Kehadiran**: menanda anak hadir, tidak hadir, atau lewat.
2. **Pemberitahuan**: memberi amaran kepada ibu bapa tentang kehadiran anak dan acara sekolah penting.
3. **Laporan**: menjana statistik untuk pengetua sekolah, guru, dan PIBG.
4. **Keselamatan dan audit**: mengesan penyalahgunaan, menyiasat pertikaian, mematuhi kewajipan undang-undang.
5. **Pematuhan**: menyimpan rekod yang dikehendaki oleh undang-undang pendidikan dan perlindungan-data Malaysia.

Kami **tidak** menggunakan data peribadi untuk:

- Pemasaran atau pengiklanan.
- Menjual atau menyewa kepada pihak ketiga.
- Melatih model AI di luar penggunaan kehadiran sekolah, melainkan persetujuan nyata berasingan diberikan.

## 4. Asas undang-undang

Kami bergantung pada asas sah berikut di bawah PDPA 2010:

- **Persetujuan**, diperoleh daripada ibu bapa atau penjaga sah untuk data biometrik [Seksyen 40 — persetujuan nyata untuk data peribadi sensitif].
- **Pelaksanaan kontrak**, untuk data bukan-biometrik yang diperlukan untuk menjalankan pendaftaran sekolah.
- **Tugas undang-undang**, di mana undang-undang Malaysia mewajibkan kami menyimpan rekod tertentu (cth., Akta Pendidikan 1996).

## 5. Dengan siapa kami berkongsi data

Kami berkongsi data peribadi **hanya** dengan:

- **Kakitangan sekolah** yang memerlukan data untuk menjalankan tugas mereka (guru anak anda, pentadbir sekolah).
- **Kementerian Pendidikan (KPM/APDM)** di mana undang-undang Malaysia mewajibkan sekolah melaporkan data murid.
- **Pemproses awan kami (Supabase)** yang menjadi hos pangkalan data. Supabase memproses data hanya di bawah arahan bertulis kami.
- **Penguatkuasaan undang-undang atau mahkamah**, hanya apabila diperintahkan secara sah.

Kami **tidak** berkongsi data dengan syarikat pemasaran, platform media sosial, atau mana-mana pihak yang tidak disenaraikan di atas.

## 6. Di mana data disimpan

Data peribadi disimpan dalam:

- Pangkalan data yang dihoskan di **Supabase**, dengan pelayan terletak di rantau yang dipilih oleh sekolah (lalai: rantau terdekat dengan Malaysia).
- Fail tempatan pada peranti kamera sekolah untuk embedding wajah semasa pengambilan kehadiran.

### Pemindahan rentas sempadan

Sesetengah infrastruktur hosting mungkin terletak di luar Malaysia. Di bawah PDPA Seksyen 129 (sebagaimana dipinda pada 2024), kami memastikan pemindahan tersebut sama ada:

- Adalah ke negara yang mempunyai undang-undang perlindungan-data yang serupa, atau
- Dilindungi oleh perlindungan kontrak dengan pemproses kami (Supabase mempunyai Perjanjian Pemprosesan Data yang merangkumi perlindungan ini), atau
- Adalah dengan persetujuan nyata anda.

Anda akan diberitahu sebelum sebarang pemindahan rentas sempadan baharu jika ia belum didedahkan.

## 7. Berapa lama kami menyimpan data

Kami menyimpan data hanya selama yang kami perlukan:

| Jenis data | Pengekalan |
|---|---|
| Rekod murid (nama, tahun, kelas) | Semasa murid berdaftar, ditambah 7 tahun selepas mereka meninggalkan (peraturan arkib Akta Pendidikan) |
| Rekod kehadiran | 7 tahun (kebolehterimaan di bawah Akta Keterangan 1950 Seksyen 90A-C) |
| Embedding wajah | Dipadamkan dalam tempoh 90 hari selepas murid meninggalkan sekolah, ATAU penarikan persetujuan, ATAU akhir tahun akademik — yang mana paling awal |
| Catatan oleh guru | Semasa murid berdaftar, ditambah 1 tahun |
| Log audit | 3 tahun |
| Pemberitahuan | 1 tahun, kemudian diarkibkan |

Anda boleh meminta kami memadamkan data peribadi lebih awal — lihat "Hak anda" di bawah.

## 8. Peraturan khas untuk data biometrik (wajah)

Data wajah diklasifikasikan sebagai **data peribadi sensitif** di bawah PDPA Seksyen 4, selepas pindaan 2024 [Akta A1727, Seksyen 3(c)].

Kami memproses data wajah **hanya** jika:

1. Ibu bapa atau penjaga sah telah memberi **persetujuan bertulis nyata** [PDPA Seksyen 40], menggunakan [Notis Persetujuan Data Biometrik](/biometric-consent?lang=bm).
2. Murid mempunyai alternatif bukan-biometrik jika ibu bapa menolak (panggilan-nama manual). **Menolak persetujuan tidak menjejaskan hak anak untuk bersekolah.**
3. Embedding disimpan sebagai senarai nombor, bukan sebagai gambar.

Anda boleh **menarik balik persetujuan pada bila-bila masa** melalui Portal Ibu Bapa. Kami akan memadamkan embedding dalam tempoh 7 hari kalendar dari penarikan.

## 9. Hak anda

Di bawah PDPA 2010 (sebagaimana dipinda), anda mempunyai hak untuk:

- **Akses** — tanya kami data apa yang kami pegang tentang anda dan anak anda [Seksyen 30].
- **Pembetulan** — minta kami membetulkan kesilapan [Seksyen 34].
- **Penarikan persetujuan** — untuk sebarang tujuan di mana persetujuan adalah asas [Seksyen 38].
- **Kemudahalihan** — menerima data anda dalam format boleh dibaca-mesin dan minta kami menghantarnya kepada pengawal lain [hak baharu di bawah pindaan 2024].
- **Bantahan** — terhadap pemprosesan yang menyebabkan anda kerosakan atau tekanan.
- **Mengadu** — kepada DPO sekolah, atau kepada Jabatan Perlindungan Data Peribadi di https://www.pdp.gov.my/.

Anda boleh melaksanakan hak ini melalui:

- Skrin **"Data Saya"** dalam Portal Ibu Bapa.
- E-mel kepada DPO sekolah (Seksyen 1 di atas).
- Surat bertulis kepada pejabat sekolah.

Kami akan membalas dalam tempoh **21 hari** menerima permintaan anda.

## 10. Cara kami melindungi data

Kami mengikuti Standard PDPA 2015 (keselamatan, pengekalan, integriti):

- Semua data peribadi disulitkan semasa transit (HTTPS).
- Embedding wajah disulitkan semasa rehat.
- Akses dihadkan kepada pengguna yang dibenarkan mengikut peranan.
- Setiap akses kepada data wajah direkodkan dalam log audit.
- Kami menguji keselamatan kami sekurang-kurangnya setahun sekali.
- Kami mempunyai pelan tindakan insiden yang sedia (lihat Seksyen 11).

## 11. Jika berlaku pelanggaran data

Jika data peribadi tidak sengaja didedahkan, hilang, diubah, atau diakses tanpa kebenaran, kami akan:

1. **Memberitahu Pesuruhjaya Perlindungan Data Peribadi** dalam tempoh **72 jam** dari menyedari pelanggaran tersebut, sebagaimana dikehendaki oleh Pekeliling Pesuruhjaya PDP Bil. 2/2025 (berkuat kuasa 1 Jun 2025).
2. **Memberitahu ibu bapa dan kakitangan yang terjejas** tanpa kelewatan yang tidak perlu, apabila terdapat risiko kemudaratan ketara.
3. **Menyiasat** punca dan mengambil langkah untuk mencegah pengulangan.
4. **Merekod** pelanggaran dalam daftar dalaman kami untuk audit masa hadapan.

Anda akan menerima notis bertulis (e-mel dan/atau surat) yang memberitahu anda apa yang berlaku, data apa yang terjejas, apa yang kami lakukan, dan apa yang anda patut lakukan (cth., tukar kata laluan).

## 12. Cookies dan teknologi serupa

PRISM-AI menggunakan sedikit storan pelayar tempatan untuk memastikan anda kekal log masuk. Kami tidak menggunakan cookie pengiklanan pihak ketiga, piksel penjejakan, atau analitik yang berkongsi data dengan platform pemasaran.

## 13. Kanak-kanak

PRISM-AI memproses data **tentang** kanak-kanak tetapi tidak memberi kanak-kanak akaun sendiri. Ibu bapa mengakses maklumat bagi pihak anak.

Kami mengikuti Konvensyen Pertubuhan Bangsa-Bangsa Bersatu mengenai Hak Kanak-Kanak, Artikel 16 (privasi kanak-kanak), yang Malaysia telah ratifikasi pada 1995 dan belum mengkhususnya.

## 14. Perubahan pada Dasar ini

Kami mungkin mengemas kini Dasar ini apabila:

- Undang-undang berubah (cth., pindaan PDPA baharu berkuat kuasa).
- Kami menambah ciri baharu yang mempengaruhi cara data dikendalikan.
- Kami menukar pemproses awan kami.

Apabila itu berlaku, kami akan:

- Menunjukkan Dasar yang dikemas kini kepada anda pada masa log masuk seterusnya.
- Meminta anda menerimanya sebelum anda boleh terus menggunakan PRISM-AI.
- Menyimpan versi terdahulu untuk rujukan anda.

## 15. Hubungi

Untuk semua pertanyaan perlindungan-data:

- **E-mel DPO**: *(untuk diisi oleh sekolah)*
- **Telefon DPO**: *(untuk diisi oleh sekolah)*
- **Pos**: *(alamat sekolah)*

Untuk mengadu secara luaran:

- **Jabatan Perlindungan Data Peribadi (JPDP)**: https://www.pdp.gov.my/
- **Borang aduan dalam talian**: https://aduan.pdp.gov.my/

---

*Versi Bahasa Inggeris bagi Dasar ini tersedia [di sini](/privacy).*
