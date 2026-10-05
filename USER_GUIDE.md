# Gabay sa Paggamit ng MK Inventory Application 📱🛒
*(User Guide and Reference Manual)*

Maligayang pagdating sa inyong **MK Inventory Application**! Ang app na ito ay binuo bilang isang **offline-first Point of Sale (POS) at Inventory Management System** upang matulungan kayong subaybayan ang benta, puhunan, tubo, at stocks ng inyong grocery nang madali, mabilis, at ligtas—kahit walang internet connection o signal.

Naglalaman ang gabay na ito ng kumpletong detalye sa bawat button, field, at tabs upang maging gabay ninyo at ng inyong mga cashier.

---

## 📌 Talaan ng Nilalaman (Table of Contents)
1. [Paano Gumagana ang App Security (PIN Lock)](#1-paano-gumagana-ang-app-security-pin-lock)
2. [Tab 1: Dashboard (Buod ng Negosyo)](#2-tab-1-dashboard-buod-ng-negosyo)
3. [Tab 2: Produkto (Pamamahala ng Imbentaryo)](#3-tab-2-produkto-pamamahala-ng-imbentaryo)
4. [Gabay sa Add / Edit Product Screen](#gabay-sa-add--edit-product-screen)
5. [Tab 3: Stock In (Pag-restock mula sa Supplier)](#5-tab-3-stock-in-pag-restock-mula-sa-supplier)
6. [Tab 4: Mag-benta (POS Counter & Cashiering)](#6-tab-4-mag-benta-pos-counter--cashiering)
7. [Tab 5: Kasaysayan (Sales History & Reports)](#7-tab-5-kasaysayan-sales-history--reports)
8. [Mga Setting (App Configuration & Settings)](#8-mga-setting-app-configuration--settings)
9. [Backup at Export ng Data (Disaster Recovery & Excel Reports)](#9-backup-at-export-ng-data-disaster-recovery--excel-reports)
10. [Troubleshooting at Solusyon (Lokal na Gabay)](#10-troubleshooting-at-solusyon-lokal-na-gabay)

---

## 1. Paano Gumagana ang App Security (PIN Lock)
Para sa kaligtasan ng inyong negosyo, may kakayahan ang app na maglagay ng **4-digit PIN Code** upang hindi mabuksan ng staff o ibang tao ang inyong mga records.

* **Startup Lock:** Kung naka-on ito, hihingan kayo ng 4-digit PIN sa tuwing bubuksan ang app.
* **Admin Settings & Product Lock:** Hihingian ng PIN ang sinumang magtatangkang mag-bukas ng Settings, mag-edit ng mga produkto, o mag-bura ng paninda sa system.
* **Paano mag-unlock:** I-type lamang ang inyong 4-digit PIN sa keypad na lalabas sa screen.

---

## 2. Tab 1: Dashboard (Buod ng Negosyo)
Ang Dashboard ang unang screen na inyong makikita. Dito ipinapakita ang buod ng takbo ng inyong tindahan para sa kasalukuyang araw.

### A. Mga KPI Cards (Key Performance Indicators)
* **Benta Ngayong Araw (Today's Sales):** Kabuuang halaga ng pera na pumasok mula sa benta ngayong araw.
* **Tubo Ngayong Araw (Today's Profit):** Ang inyong netong kinita (Benta bawas Puhunan).
* **Mga Produkto:** Bilang ng mga uri ng produkto na rehistrado sa inyong system.
* **Halaga ng Stocks (Inventory Value):** Kabuuang halaga ng inyong kasalukuyang imbentaryo batay sa presyo ng puhunan. Dito niyo makikita kung gaano kalaki ang kapital na nakatabi sa inyong mga istante.
* **Kulang sa Stock (Low Stock Alert):** Bilang ng mga produktong nasa kritikal na lebel na ang dami. 
  > [!TIP]
  > I-tap ang card na ito upang awtomatikong pumunta sa Product List at makita ang listahan ng mga produktong dapat nang i-restock.

### B. Iba pang Bahagi ng Dashboard
* **Graf ng Benta (7-Day Sales Chart):** Biswal na ulat ng inyong benta sa nakalipas na pitong araw upang malaman kung anong araw ang pinakamalakas.
* **Low Stock Alerts List:** Listahan sa ibaba na nagpapakita ng pangalan at kasalukuyang bilang ng mga items na paubos na.
* **Header Icons:**
  * 🖨️ **Printer Icon (Ulat ng Stocks):** I-tap upang i-print sa Bluetooth thermal printer ang buong listahan ng inyong stocks at ang kabuuang halaga nito.
  * ⚙️ **Settings Icon:** I-tap upang pumunta sa Settings screen (hihingi ng PIN kung naka-enable ang admin lock).

---

## 3. Tab 2: Produkto (Pamamahala ng Imbentaryo)
Dito ninyo pinapamahalaan ang lahat ng mga paninda sa inyong grocery.

### A. Mga Controls sa Itaas
* **Search Bar ("Maghanap ng produkto..."):** I-type ang pangalan ng produkto o i-scan ang barcode nito para mabilis itong mahanap.
* **Kategorya Filter Chips:** I-tap ang mga kategorya (*Lahat, Inumin, Lata, Snacks, Sawsawan, Personal Care, Iba pa*) para ma-filter ang listahan.
* **Filter Chips para sa Status:**
  * ⚠️ **Paubos na Stock (Low Stock):** Ipakita lamang ang mga items na mababa sa threshold.
  * 📅 **Malapit na Ma-expire (Near Expiration):** Ipakita lamang ang mga items na malapit nang umabot sa kanilang expiration date (lalabas lamang ito kung naka-on ang Expiry Date feature sa Settings).

### B. Product Card (Impormasyon ng Produkto)
Ipinapakita sa bawat card ang:
* Pangalan at Kategorya ng produkto.
* Presyo ng Benta (naka-highlight ng berde) at Puhunan.
* Kasalukuyang Stock (Dami + Unit, hal. `150 pcs` o `20 pack`).
* Barcode Number (kung mayroon).
* Expiry Date (kung mayroon at naka-enable).
* **Status Badges:** Magbabago ang kulay ng card depende sa kalagayan:
  * **Pula (Expired):** Lampas na sa expiry date.
  * **Orange (Malapit na):** Malapit nang ma-expire.
  * **Pula (Low Stock):** Mababa na ang stock sa itinakdang limitasyon.

### C. Floating Action Button (➕ Plus Button sa kanang ibaba)
* I-tap ang button na ito upang magdagdag ng bagong produkto sa inyong database.

### D. Product Options Menu (Lalabas kapag tinap ang kahit anong Product Card)
* 📝 **I-edit ang Produkto (Edit Details):** Baguhin ang pangalan, presyo, barcode, o iba pang detalye ng produkto.
* 🚚 **Mag-Stock In (Restock):** Dumiretso sa pag-record ng bagong delivery ng produktong ito mula sa supplier.
* ✂️ **I-unpack para sa Tingi (Split Stock):** Gamitin ito kung nais mag-tingi (halimbawa: hatiin ang 1 `box` ng softdrinks para maging 24 `pcs`).
  * Ilagay kung ilang pieces ang laman ng isang pack/box at kung anong produkto ang paglilipatan. Awtomatikong babawasan ng app ang wholesale stock at dadagdagan ang tingi stock.
* 🗑️ **Burahin ang Produkto (Delete Product):** Tanggalin nang permanente ang produkto sa system.
  > [!WARNING]
  > Mabubura rin ang lahat ng kasaysayan ng restock at benta para sa produktong ito kapag binura ito.

---

## Gabay sa Add / Edit Product Screen
Kapag nagdagdag o nag-edit ng produkto, narito ang mga kailangang punan:

| Field / Button | Katangian | Paglalarawan |
| :--- | :--- | :--- |
| **Pangalan ng Produkto \*** | Required Text Field | Ilagay ang kumpletong pangalan ng produkto (hal. *Coca-Cola 1.5L*). |
| **Barcode (Opsyonal)** | Text Field / Scanner | I-type ang barcode number o i-tap ang 📷 **Camera Button** sa tabi nito upang gamitin ang camera ng phone para i-scan ang barcode ng produkto. |
| **Kategorya \*** | Dropdown Select | Piliin kung anong grupo kabilang ang produkto (hal. *Inumin, Lata, Snacks*, atbp.). |
| **Unit \*** | Dropdown Select | Piliin ang yunit ng sukat ng produkto (*pcs, pack, box, kg, dozen*). |
| **Puhunan (Buying Price) \*** | Required Number Field | Ilagay ang presyo ng pagkabili ninyo sa supplier. Bawal ang negatibong numero. |
| **Presyo (Selling Price) \*** | Required Number Field | Ilagay ang presyo kung magkano niyo ibebenta sa mamimili. |
| **Tubo kada item (Profit Preview)** | Awtomatikong Display | Ipinapakita sa kulay berdeng kahon ang inyong kikitain (Presyo - Puhunan). Magiging pula ito kung lugi ang presyo. |
| **Stock Qty \*** | Required Number Field | Ang paunang dami ng produkto na mayroon kayo ngayon. |
| **Stock Threshold \*** | Required Number Field | Itakda kung kailan mag-aalerto ang app na "Low Stock" na ang item na ito (Default ay `5.0`). |
| **Petsa ng Expiry (Opsyonal)** | Calendar Picker | I-tap upang piliin ang petsa ng expiration ng item gamit ang kalendaryo. *(Lalabas lang kung naka-on sa settings).* |
| **I-save ang Produkto** | Button | I-tap upang i-save ang lahat ng impormasyon. |

---

## 5. Tab 3: Stock In (Pag-restock mula sa Supplier)
Dito itinatala ang mga bagong delivery ng inyong mga paninda upang awtomatikong madagdagan ang inyong kasalukuyang stock.

### A. Pag-record ng Bagong Delivery
1. **Pumili ng Produkto \*:** I-tap ang dropdown at piliin ang produkto na inyong dinagdagan ng stock. Makikita rin doon ang kasalukuyang bilang ng stock nito sa system.
2. **Dami (Quantity) \*:** Ilagay kung ilan ang bagong dumarating. Awtomatikong dadagdag ito sa inyong imbentaryo pagkatapos i-save.
3. **Delivery Date Picker:** I-tap ang maliit na kalendaryo upang itakda kung kailan dumating ang delivery (awtomatikong nakatakda ito sa petsa ngayon).
4. **Supplier Name (Opsyonal):** Ilagay ang pangalan ng distributor o pinagbilhan (hal. *Coca-Cola Distributor, Nestlé Sales*).
5. **I-record ang Stock In:** I-tap ang button na ito upang i-save ang transaksyon.

### B. Kasaysayan ng Stock In (Recent Deliveries)
Sa ibaba ng screen, makikita ang listahan ng mga huling naitalang delivery:
* Ipinapakita nito ang pangalan ng produkto, pangalan ng supplier, petsa at oras ng pag-stock in, at kung ilang dami ang idinagdag (hal. `+50 pcs`).

---

## 6. Tab 4: Mag-benta (POS Counter & Cashiering)
Ito ang screen na gagamitin ng cashier para sa pagpoproseso ng benta sa mga customer.

### A. Product Search & Selection Pane (Kaliwang Bahagi o Itaas)
* **Search Field ("Hanapin ang binebenta..."):** I-type ang pangalan ng produkto. Kung may nakakonektang USB/Bluetooth physical barcode scanner, i-scan lamang ang item at kusa itong madaragdag sa shopping cart nang hindi na kailangang i-type.
* **Camera Scan Button (📷):** I-tap ito para gamitin ang camera ng tablet/phone as continuous scanner. I-tapat lang ang camera sa barcode ng mga produkto nang sunod-sunod.
* **Category Tabs:** I-tap ang mga chips para i-filter ang mga ipinapakitang produkto para sa mabilisang paghahanap.
* **"Add" Button:** I-tap ang katapat na button ng produkto upang idagdag ito sa cart.
  * Kung ubos na ang stock, mag-aalerto ang system at hindi papayagang maidadagdag ang produkto.

### B. Shopping Cart ng Mamimili (Kanang Bahagi o Ibaba)
Dito nakalista ang mga items na bibilhin ng customer:
* **Bawas/Dagdag Buttons (➖ / ➕):** I-tap ang ➖ para bawasan ang dami o ➕ para dagdagan. Kapag umabot sa `0` ang dami, awtomatikong matatanggal ang item sa cart.
* **Dami Input (Tap on Number):** Kung marami ang binili ng customer (hal. `50 pcs` na instant noodles), i-tap ang numero ng dami. Magbubukas ang isang dialog kung saan pwede ninyong direktang i-type ang eksaktong bilang.
* **Delete Icon (🗑️):** Tanggalin ang partikular na produkto sa listahan.
* **I-clear All:** Tanggalin ang lahat ng laman ng cart upang magsimula muli ng bagong transaksyon.
* **I-benta na! Button:** I-tap upang magpatuloy sa checkout at pagbabayad.

### C. Kumpirmahin ang Benta (Checkout Dialog)
Magbubukas ang dialog na ito upang makumpleto ang transaksyon:
1. **Buod ng Transaksyon:** Ipinapakita ang listahan ng mga binili at ang kabuuang halaga ng babayaran.
2. **Bayad ng Customer Input Field:** I-type kung magkano ang iniabot na pera ng customer.
3. **Quick Cash Buttons:** I-tap ang **Eksaktong Bayad** (Exact Amount) o ang mga bills (**₱20, ₱50, ₱100, ₱200, ₱500, ₱1000**) para sa mabilisang paglalagay ng bayad nang hindi na nag-ti-type.
4. **Sukli (Change):** Awtomatikong kukuwentahin at ipapakita sa malalaking letra ang sukli ng customer. Kung hindi sapat ang bayad, magiging pula ang teksto at hindi papayagang ma-checkout ang benta.
5. **I-benta Na Button:** I-tap ang button na ito upang kumpirmahin ang pagbili. Awtomatiko nitong:
   * Ibabawas ang mga nabentang items sa inyong imbentaryo.
   * Ilalagay ang record sa inyong Kasaysayan (Sales History).
   * Mag-pi-print ng resibo kung may nakakonektang printer.

### D. Matagumpay ang Benta Dialog
Pagkatapos ng checkout, lalabas ang huling ulat:
* Ipinapakita ang kabuuang halaga, bayad, at sukli ng customer.
* Ipinapakita rin kung matagumpay na nai-print ang resibo o kung failed (may link upang pumunta sa settings kung nais ayusin ang printer).

---

## 7. Tab 5: Kasaysayan (Sales History & Reports)
Dito ninyo makikita at masusuri ang lahat ng inyong mga nakaraang benta.

### A. Dalawang Paraan ng Pagtingin ng Ulat (Tabs sa Itaas)
1. **Detailed Transactions View:** Ipinapakita ang mga benta na nakapangkat ayon sa bawat customer checkout (kasama ang petsa, oras, listahan ng binili, kabuuang binayad, at sukli).
2. **Aggregated View (Pinagsama-samang Ulat):** Ipinapakita ang kabuuang dami ng bawat produkto na nabenta para sa napiling araw, kasama ang kabuuang kita at tubo sa partikular na item na iyon. Awtomatikong naka-sort ito mula sa pinakamabenta (Best Sellers).

### B. Controls at Filters
* **Search Bar:** Maghanap ng partikular na produkto upang makita kung kailan at gaano karami ang nabenta nito.
* **Kalendaryo Filter (📅):** Piliin ang partikular na araw upang makita ang ulat ng araw na iyon.
* **Void (Bawiin ang Benta) Functionality:**
  * Mag-tap ng item o transaksyon sa kasaysayan at piliin ang **Void / Bawiin**.
  * Awtomatikong ibabalik ng app ang ibinalik na dami ng item sa inyong imbentaryo at buburahin ang sales record na ito sa ulat.

---

## 8. Mga Setting (App Configuration & Settings)
Dito isinasaayos ang inyong tindahan. Upang ma-access, maaaring kailanganin ang inyong **Security PIN**.

### A. Detalye ng Tindahan (Store Details)
* **Pangalan ng Tindahan:** Ang pangalang ilalagay dito ang lalabas sa pinakataas ng inyong mga printed receipt at reports.
* **May-ari ng Tindahan:** Pangalan ng may-ari (lalabas din sa resibo).
* **Default Currency Symbol:** Piliin kung Peso (₱), Dollar ($), o PHP ang gagamiting simbolo sa app.

### B. Mga Feature Options
* **Petsa ng Expiry Toggle:** I-on kung nais ninyong may field ng expiration date ang inyong mga produkto at makatanggap ng alerts. I-off naman kung ayaw ninyong mag-input ng expiry dates para mas mabilis ang paggawa ng produkto.

### C. Mga Tunog at Vibration (Scan Feedback)
Inaayos dito ang lakas ng tunog at nginig (vibration) ng inyong phone kapag matagumpay ang pag-scan ng barcode. May slider para sa lakas mula 0% hanggang 100%.

### D. Seguridad (Security PIN Lock)
* **I-set / Baguhin ang PIN:** Gumawa ng 4-digit password.
* **Lock sa Pagsisimula Switch:** I-on kung nais hilingan ng PIN sa tuwing bubuksan ang app.
* **Lock sa Admin Settings at Produkto:** I-on upang hindi makapasok ang cashier sa Settings o makapagbura ng produkto nang wala ang inyong pahintulot.

### E. Bluetooth Thermal Printer Configuration
Upang makapag-print ng resibo:
1. I-on ang Bluetooth at Location ng inyong phone/tablet.
2. I-pair ang inyong thermal printer sa system settings ng inyong Android device.
3. Bumalik sa Settings ng app, i-tap ang 🔄 (Refresh) sa tabi ng Bluetooth section.
4. Lalabas ang pangalan ng inyong printer sa ilalim ng **Paired Devices**.
5. I-tap ang **Connect** sa katapat nito. 
6. Kapag naging kulang berde ang status at nagpakitang *"Konektado"*, handa na itong gamitin.
7. I-tap ang **Mag-print ng Test Receipt** upang masubukan kung gumagana ang printer.

---

## 9. Backup at Export ng Data (Disaster Recovery & Excel Reports)
Matatagpuan sa ibaba ng Settings ang opsyon para sa Backup at Export. Ito ay napakahalaga upang hindi mawala ang inyong records sakaling masira o mawala ang inyong tablet/phone.

### A. Disaster Recovery (Full Backup & Restore)
* **I-backup Data:** I-tap ang button na ito upang gumawa ng backup ng inyong database file (`.db`). Awtomatikong magbubukas ang share menu ng Android upang pwede ninyo itong i-send sa inyong sariling GCash, email, Google Drive, o Messenger account.
* **I-restore Data:** Gamitin lamang ito kung nais ibalik ang data mula sa inyong lumang backup file.
  * Ang pag-restore ay buburahin at mapapalitan ang lahat ng kasalukuyang impormasyon sa inyong app ng impormasyong nasa backup file ninyo.

### B. Excel/CSV Reports Export
Nagbibigay-daan ito upang maipadala ang inyong mga ulat sa computer upang buksan sa Microsoft Excel o Google Sheets.
* **I-export ang Imbentaryo sa Excel/CSV:** Gagawa ng spreadsheet file na naglalaman ng lahat ng inyong produkto, kasalukuyang stock, presyo ng puhunan, benta, at kabuuang halaga.
* **I-export ang Ulat ng Benta:** Piliin ang sakop na panahon (*Ngayong Araw, Ngayong Buwan, Ngayong Taon, Lahat*) at i-tap ang export button upang makagawa ng spreadsheet ng inyong mga kinita at tubo.

---

## 10. Troubleshooting at Solusyon (Lokal na Gabay)

### Q1: Ayaw mag-print ng resibo kahit tapos na ang benta. Ano ang gagawin?
* **Solusyon:** 
  1. I-check kung nakabukas ang Bluetooth ng inyong phone.
  2. Siguraduhing may sapat na battery at nakabukas ang inyong thermal printer.
  3. Pumunta sa Settings ng app at tignan kung *"Konektado"* ang status. Kung hindi, i-tap muli ang **Connect** button sa tabi ng pangalan ng printer ninyo.
  4. Siguraduhing may papel sa loob ng printer at hindi ito nakabaligtad.

### Q2: Nakalimutan ko ang aking Admin PIN Code. Paano ko ito ma-re-reset?
* **Solusyon:** Para sa seguridad, walang madaling reset button ang app para hindi ito magawa ng cashier. Kung nakalimutan ang PIN, mangyaring makipag-ugnayan sa inyong local developer (Developer Service) upang matulungan kayong i-reset ito nang ligtas gamit ang inyong backup database file.

### Q3: Gusto kong ilipat ang app sa bagong tablet o bagong phone ng aking grocery.
* **Solusyon:** 
  1. Sa lumang phone, pumunta sa **Settings** -> **Backup at Export** -> I-tap ang **I-backup Data**.
  2. I-send ang `.db` file na magagawa sa inyong bagong phone (sa pamamagitan ng Bluetooth, Google Drive, o chat).
  3. Sa bagong phone, i-install ang APK ng MK Inventory Application.
  4. Buksan ang app sa bagong phone, pumunta sa Settings -> **Backup at Export** -> I-tap ang **I-restore Data** at piliin ang `.db` file na inyong ipinadala. Awtomatikong babalik ang lahat ng inyong mga paninda at kasaysayan.

---

*Para sa karagdagang tulong o katanungan pagkatapos ng inyong 30-day support period, maaari kayong makipag-ugnayan sa inyong lokal na developer para sa mabilisang serbisyo sa maliit na halaga.* 

**Maraming salamat at maging matagumpay sana ang inyong negosyo! 🚀**
