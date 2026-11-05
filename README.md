# AKeeper

Timer rundown acara untuk timekeeper. HTML, CSS, dan JavaScript biasa, tanpa build dan tanpa install.

## Menjalankan

Buka `index.html` langsung di browser, atau taruh folder ini di hosting statis mana pun. Bisa dipakai offline.

## Fitur

- **Rundown**: tambah, ubah, hapus, dan geser urutan agenda (bisa di layar sentuh)
- **Agenda selesai**: baris berubah warna (hijau tepat waktu, merah lewat waktu), target dicoret dan waktu aktual muncul di sampingnya
- **Urungkan**: hapus agenda, kosongkan rundown, atur ulang waktu, dan pindah agenda saat timer jalan bisa dibatalkan lewat tombol Urungkan
- **Atur ulang waktu**: agenda tetap, semua waktu dihapus (untuk acara utama setelah gladi)
- **Pintasan**: Spasi untuk mulai/jeda, F untuk layar penuh
- **Panel sinyal**: menampilkan sisa waktu, warnanya berubah sesuai keadaan
  - putih: siap dimulai
  - biru: berjalan
  - kuning: waktu hampir habis (1 menit terakhir, atau 20% terakhir untuk agenda pendek)
  - merah: lewat waktu, hitungan berlanjut sebagai `+mm:ss`
- **Kontrol**: Mulai, Jeda/Lanjutkan, Selesai, Lewati. Timer tetap jalan walau pindah tab atau halaman di-reload
- **Layar penuh**: panel sinyal jadi jam panggung untuk pembicara/proyektor (Esc untuk keluar)
- **Laporan + ekspor CSV**: target vs. aktual vs. selisih per agenda, plus ringkasan
- **Persistensi**: data tersimpan otomatis di localStorage browser
- Mode gelap otomatis mengikuti pengaturan sistem

## File

```
index.html          tampilan
style.css           gaya
app.js              state, render, timer
lib.js              fungsi murni (format waktu, sinyal, CSV, dll.)
test.js             cek fungsi murni: node test.js
vendor/Sortable.min.js   SortableJS 1.14.0 (MIT), drag-and-drop
vendor/archivo.css       font Archivo (SIL OFL 1.1), di-embed agar jalan dari file://
```
