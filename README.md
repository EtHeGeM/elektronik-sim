# Elektronik I (ELM2021) — Vize Çalışma, Metot Anlatım & SPICE Laboratuvarı

Marmara Üniversitesi Mekatronik Mühendisliği **Elektronik I (ELM2021)** vize müfredatına (Boylestad & Nashelsky Bölüm 1–4) göre hazırlanmış interaktif çalışma, çözüm metodu rehberi ve SPICE doğrulama ortamıdır.

## İçindekiler

- `index.html`, `styles.css`, `app.js`: Tarayıcı üzerinden çalışan 5 modüllü görsel laboratuvar (canlı SVG devre şeması, osiloskop/yük doğrusu grafikleri, adım adım sınav çözüm metotları ve otomatik SPICE `.cir` üretici).
- `elektronik1_lab.py`: `numpy` ve `sympy` tabanlı Python doğrulama motoru ve yerel HTTP sunucu başlatıcısı.
- `spice_ornekleri/`: 5 temel vize soru tipi için sınav parametreleriyle hazırlanmış hazır `.cir` SPICE netlist dosyaları.

## Nasıl Başlatılır?

### 1. İnteraktif Web Laboratuvarını Açma
Terminalden bu klasör içindeyken:
```bash
python3 elektronik1_lab.py --serve
```
Ardından tarayıcıda [http://127.0.0.1:8765/index.html](http://127.0.0.1:8765/index.html) adresini açın. (Veya `index.html` dosyasını doğrudan tarayıcınıza sürükleyip açabilirsiniz).

### 2. Python ile Vize Soru Tiplerini Doğrulama
```bash
python3 elektronik1_lab.py --test
```
Tüm modüllerdeki temel Boylestad vize sorularını çözer, doğrulamaları kontrol eder ve özet tabloyu basar.

### 3. Hazır SPICE Netlistlerini Çalıştırma (Opsiyonel `ngspice` veya `LTspice`)
`spice_ornekleri/` klasöründeki `.cir` dosyalarını doğrudan `ngspice <dosya>.cir` komutuyla çalıştırabilir ya da web arayüzündeki **"Otomatik SPICE Netlist"** kutusundan kendi girdiğiniz değerlere göre `.cir` dosyası indirip simüle edebilirsiniz.

## Kapsanan Vize Modülleri
1. **Modül 1 (Hafta 1–3):** Paralel farklı diyotlar (`Si // Ge // LED`), çift kaynaklı karma diyotlarda *Varsayım-Kontrol* metodu, diyotlu `OR`/`AND` lojik kapıları.
2. **Modül 2 (Hafta 4–5):** Seri ve paralel kırpıcılar (DC biaslı), kare/sinüs dalgalı kenetleyiciler (Clamper), yarım dalga / orta uçlu / köprü doğrultucular ve `PIV` hesabı.
3. **Modül 3 (Hafta 5):** Zener diyot regülatörler, Thévenin açma testi, $R_{L(\min)}$, $R_{L(\max)}$ ve $V_{i(\min-\max)}$ sınır analizleri.
4. **Modül 4 (Hafta 6–7):** BJT sabit, emiter dirençli, gerilim bölücülü (`Yaklaşık` vs `Thévenin` testi) ve kollektör geri beslemeli öngerilimlendirme, Doyum (Saturation) tuzağı ve DC yük doğrusu çizimi.
5. **Modül 5:** Kendini test et vize soru bankası ve SPICE hızlı referans rehberi.

