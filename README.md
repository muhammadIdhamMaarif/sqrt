# README — High-precision sqrt (mpreal + MPFR + GMP)

> Panduan lengkap (clone → install → compile → run) untuk proyek C++ yang memakai **AdvAnPix `mpreal`** (C++ wrapper untuk MPFR) untuk menghitung akar kuadrat dengan presisi tinggi.

---

## TL;DR

Program bisa dipakai pada terminal dengan menginstall kode dan dependensi, atau dipakai di website. Namun program pada website menggunakan Python yang kode bisa dilihat pada `app.py`. Website bisa diakses <a href="https://sqrt.estellastudiodev.com" target="_blank">disini</a>

<a href="https://sqrt.estellastudiodev.com" target="_blank">sqrt.estellastudiodev.com</a>

> Program akan berjalan lebih cepat jika menggunakan C++

> Untuk menggunakan program dengan C++ adalah sebagai berikut

---

## Ringkasan singkat

Program ini mengimplementasikan perhitungan akar kuadrat presisi-tinggi menggunakan metode Newton/Heron dan metode reciprocal-sqrt, memakai header **`mpreal.h`** (AdvAnPix) yang membungkus pustaka C **MPFR**, yang sendiri bergantung pada **GMP** untuk aritmetika bilangan besar.

> File sumber utama: `Perhitungan.cpp`

---

## Daftar dependensi (inti)

- **Compiler C++** yang mendukung C++17 (`g++` disarankan).
- **GNU MP (GMP)** — pustaka aritmetika presisi besar (`libgmp` / `gmp`).
- **GNU MPFR** — pustaka floating-point presisi-arbitrary (`libmpfr`).
- **mpreal.h** — header C++ satu-file dari AdvAnPix (wrapper MPFR).
- **(Opsional)** Boost.Multiprecision jika ingin kompilasi dengan `-DUSE_BOOST`.
- **(Opsional)** `pkg-config` untuk memudahkan pengaturan flag kompilasi.

> Di Windows, paket MSYS2/MinGW menyediakan binari dan header GMP/MPFR yang paling mudah dipakai.

---

## Quickstart — langkah singkat

1. Clone repo Anda (ganti URL dengan repo Anda):

```bash
git clone https://github.com/muhammadIdhamMaarif/sqrt.git
cd sqrt
```

2. Ambil `mpreal.h` (opsi A atau B):

- **Opsi A — submodule (recommended):**

```bash
# di dalam folder project
git submodule add https://github.com/advanpix/mpreal.git third_party/mpreal
git submodule update --init --recursive
# atau: wget/curl raw header lalu taruh di ./include/
```

- **Opsi B — ambil header langsung:**

```bash
mkdir -p include
curl -L -o include/mpreal.h \
  https://raw.githubusercontent.com/advanpix/mpreal/master/mpreal.h
```

3. Install dependensi sistem (lihat bagian selanjutnya untuk per-OS).
4. Compile (contoh di bagian `Compile examples`).
5. Jalankan (contoh di bagian `Run examples`).

---

## Instalasi dependensi per-OS

> Pilih bagian yang sesuai sistem operasi Anda.

### Ubuntu / Debian (dan turunan)

```bash
sudo apt update
sudo apt install -y build-essential g++ git pkg-config \
  libgmp-dev libmpfr-dev
# opsional (Boost):
sudo apt install -y libboost-all-dev
```

- Paket inti: `libgmp-dev`, `libmpfr-dev` (mengandung header & library untuk link).

### Fedora / RHEL / CentOS

```bash
sudo dnf install -y @development-tools git pkgconfig \
  gmp-devel mpfr-devel libmpc-devel
# opsional Boost
sudo dnf install -y boost-devel
```

### macOS (Homebrew)

```bash
# pastikan Homebrew terinstall
brew update
brew install gcc gmp mpfr pkg-config
# opsional Boost
brew install boost
```

> Jika Anda memakai Xcode toolchain, pastikan `xcode-select --install` sudah dijalankan untuk mendapatkan `gcc`/`clang` toolchain.

### Windows — MSYS2 / MinGW-w64 (direkomendasikan)

1. Install MSYS2 dari https://www.msys2.org/ dan jalankan `MSYS2 MinGW 64-bit` shell (atau `UCRT64` sesuai kebutuhan).
2. Update paket dan install toolchain:

```bash
pacman -Syu
# restart MSYS2 shell jika diminta, lalu:
pacman -S --needed base-devel mingw-w64-x86_64-toolchain \
  mingw-w64-x86_64-gmp mingw-w64-x86_64-mpfr mingw-w64-x86_64-pkg-config
# opsional Boost:
pacman -S mingw-w64-x86_64-boost
```

> Gunakan **MinGW-w64 shell** (mingw64) untuk compile 64-bit; gunakan `MINGW64` prompt.

---

## Menaruh `mpreal.h`

- Letakkan `mpreal.h` di `include/` (proyek) atau gunakan submodule `third_party/mpreal`.
- Pastikan `#include "mpreal.h"` ditemukan oleh compiler (`-Iinclude` jika perlu).

---

## Compile — contoh per platform

> Contoh file sumber: `mpreal_sqrt_newton.cpp`. Ganti nama file sesuai repo Anda.

### Cara A — (disarankan) pakai `pkg-config` bila tersedia

```bash
# Linux / macOS
g++ -O2 -std=c++17 -I./include mpreal_sqrt_newton.cpp $(pkg-config --cflags --libs mpfr) -o mpreal_sqrt
```

`pkg-config --cflags --libs mpfr` akan menambahkan flag include/library sesuai instalasi MPFR/GMP (tersedia di MPFR ≥ 4.0).

### Cara B — tanpa pkg-config (flag manual)

```bash
# jika header mpreal ada di ./include
g++ -O2 -std=c++17 -I./include mpreal_sqrt_newton.cpp -lmpfr -lgmp -o mpreal_sqrt
```

> Jika linker tidak menemukan library, tambahkan `-L/path/to/lib` sesuai lokasi (contoh: `-L/usr/local/lib`).

### Windows (MSYS2 MinGW64) — contoh yang Anda berikan

```bash
# di MSYS2 MinGW64 shell
g++ -O2 -std=c++17 -I/mingw64/include mpreal_sqrt_newton.cpp -L/mingw64/lib -lmpfr -lgmp -o sqrt.exe
```

### Dengan Boost (opsional)

- Jika Anda ingin meng-compile bagian `#ifdef USE_BOOST`, tambahkan macro `-DUSE_BOOST` dan pastikan Boost headers/lib terinstall:

```bash
g++ -O2 -std=c++17 -DUSE_BOOST -I./include mpreal_sqrt_newton.cpp \
  $(pkg-config --cflags --libs mpfr) -o mpreal_sqrt_boost
```

---

## Run examples

```bash
# default
./mpreal_sqrt

# contoh: akar kuadrat 2 dengan 200 digit presisi dan 10 iterasi
./mpreal_sqrt --number 2 --prec-digits 200 --iterations 10

# pakai inisialisasi manual:
./mpreal_sqrt --number 123456789 --prec-digits 150 --init-mode manual --init-value 1.0

# simpan tabel iterasi ke CSV
./mpreal_sqrt --number 2 --prec-digits 200 --iterations 20 --save-csv iterations.csv
```

Perhatikan opsi CLI (lihat kode utama `parse_args`) — tersedia `--number`, `--prec-digits`, `--iterations`, `--init-mode`, `--init-value`, `--method`, `--save-csv`.

---

## Makefile / skrip build singkat

**Makefile** minimal:

```makefile
CXX = g++
CXXFLAGS = -O2 -std=c++17 -I./include
LDFLAGS = -lmpfr -lgmp
SRC = mpreal_sqrt_newton.cpp
OUT = mpreal_sqrt

all:
	$(CXX) $(CXXFLAGS) $(SRC) $(LDFLAGS) -o $(OUT)

clean:
	rm -f $(OUT)
```

Jika `pkg-config` tersedia, ubah `LDFLAGS` menjadi `$(shell pkg-config --cflags --libs mpfr)`.

---

## Troubleshooting (masalah umum)

- **Header `mpreal.h` tidak ditemukan**: pastikan `-I./include` menunjuk ke folder yang berisi `mpreal.h`, atau letakkan header di lokasi sistem (`/usr/local/include`).
- **Linker error: undefined reference to mpfr_***: library MPFR/GMP tidak ter-link. Tambahkan `-lmpfr -lgmp` dan/atau `-L` ke folder library.
- **Versi MPFR baru menyebabkan error dengan `mpreal.h`**: ada isu kompatibilitas bila MPFR mengubah internal API; cek issue GitHub `advanpix/mpreal` dan pertimbangkan menggunakan versi MPFR yang stabil atau patch pada `mpreal.h` (issue terkait dilaporkan pada repo).
- **Windows: tidak ada binari GMP/MPFR**: gunakan MSYS2/Mingw-w64 yang menyediakan paket `mingw-w64-x86_64-gmp` dan `mingw-w64-x86_64-mpfr`.

---

## Catatan teknis & tips

- Program menyetel `mpfr::mpreal::set_default_prec(bits)` berdasarkan `--prec-digits`; bit precision dihitung dari digit decimal secara kasar.
- Program juga membangun referensi high-precision dengan menaikkan presisi sementara untuk perbandingan.
- Jika Anda ingin distribusi yang lebih portable, pertimbangkan membundel header `mpreal.h` dan menulis `configure`/`CMake` atau `vcpkg`/`conan` recipe.

---

## Credits & Lisensi

- `mpreal.h` (AdvAnPix) — wrapper C++ untuk MPFR (lihat repo advanpix/mpreal).
- MPFR & GMP — proyek GNU.

Periksa lisensi masing-masing pustaka jika Anda akan mendistribusikan binari. `advanpix/mpreal` di-publish dengan lisensi GPL-3.0 (lihat repo).

---

## Kalau masih bingung

Kirim pesan (atau paste error output) ke help@idhamadam.com. saya bantu interpretasi error link/compile. Selamat mencoba! 🚀

