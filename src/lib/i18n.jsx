/**
 * Bilingual UI (BM / العربية).
 *  - Only static UI text is translated. Content from Google Sheets is shown exactly as entered
 *    (rendered with dir="auto" so Malay text keeps correct punctuation inside the RTL layout).
 *  - Arabic switches <html lang="ar" dir="rtl"> so the whole layout mirrors (logical CSS).
 *  - The choice persists in localStorage ('hph_lang'); index.html applies it before first paint.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { parseISO, daysUntil } from './utils.js';

export const LANGS = ['ms', 'ar'];
const KEY = 'hph_lang';

const HARI = {
  ms: ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'],
  ar: ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
};
const BULAN = {
  ms: ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'],
  ar: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
};
const BULAN_PENDEK = {
  ms: ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'],
  ar: BULAN.ar, // Arabic month names have no standard abbreviations
};

/** Arabic counted noun for days: 1 يوم, 2 يومان, 3–10 أيام, 11+ يومًا */
const arDays = (n) => (n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n <= 10 ? `${n} أيام` : `${n} يومًا`);
const arDaysAcc = (n) => (n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? `${n} أيام` : `${n} يومًا`);

// ---------------------------------------------------------------------------------------------
// Dictionary. Values are strings with {var} placeholders, or functions for plural-aware text.
// ---------------------------------------------------------------------------------------------
export const DICT = {
  ms: {
    // nav
    'nav.upcoming': 'Upcoming', 'nav.upcoming.short': 'Upcoming', 'nav.upcoming.full': 'Upcoming Podcast', 'nav.upcoming.desc': 'Jadual rakaman & siaran',
    'nav.panel': 'List Panel', 'nav.panel.short': 'Panel', 'nav.panel.full': 'List Panel', 'nav.panel.desc': 'Direktori panel & tajuk',
    'nav.panduan': 'Panduan', 'nav.panduan.short': 'Panduan', 'nav.panduan.full': 'Panduan Panel', 'nav.panduan.desc': 'Dokumen PDF untuk panel',
    'nav.peringatan': 'Peringatan', 'nav.peringatan.short': 'Peringatan', 'nav.peringatan.full': 'Peringatan Syeikhuna', 'nav.peringatan.desc': 'Adab & nasihat Tuan Syeikh',
    'nav.kitab': 'Promosi Kitab', 'nav.kitab.short': 'Kitab', 'nav.kitab.full': 'Promosi Kitab', 'nav.kitab.desc': 'Kekerapan promosi & skrip',
    'nav.youtube': 'Episod YT', 'nav.youtube.short': 'Episod', 'nav.youtube.full': 'Episode Podcast YT', 'nav.youtube.desc': 'Galeri episod YouTube',
    'nav.cadangan': 'Cadangan', 'nav.cadangan.short': 'Cadangan', 'nav.cadangan.full': 'Cadangan', 'nav.cadangan.desc': 'Kongsi idea penambahbaikan',
    'nav.more': 'Lagi', 'nav.moreTitle': 'Seksyen lain', 'nav.aria': 'Seksyen utama',

    // header / app shell
    'app.tagline': 'Pusat maklumat panel & moderator',
    'lang.switch': 'Tukar bahasa',
    'theme.light': 'Mod cerah', 'theme.dark': 'Mod gelap',
    'sync.syncing': 'Menyegerak…', 'sync.offline': 'Luar talian', 'sync.ready': 'Sedia', 'sync.updated': 'Dikemas kini {time}',
    'sync.retryTitle': 'Klik untuk segerak semula', 'sync.errorTitle': 'Ralat: {error}. Klik untuk cuba lagi.', 'sync.offlineRetry': 'Luar talian — cuba segerak semula',
    'demo': 'Demo',
    'admin': 'Admin', 'admin.logoutShort': 'Keluar', 'admin.logout': 'Keluar Mod Admin', 'admin.login': 'Log masuk Admin',
    'admin.banner': 'Mod Admin aktif — tambah, edit, susun & padam kandungan.',
    'load.failed': 'Tidak dapat memuatkan data', 'load.retry': 'Cuba lagi', 'load.loading': 'Memuatkan',
    'mock.notice': 'Mod Demo: data disimpan dalam pelayar ini sahaja. Sambungkan Google Apps Script di {file} untuk segerak merentas peranti.',

    // footer / PIN
    'footer.about': 'Hub rujukan bersama untuk penganjur, moderator dan panel. Kongsi pautan ini — tak perlu ulang penerangan dalam group WhatsApp lagi.',
    'footer.copyright': 'Hak cipta',
    'pin.title': 'Akses Admin', 'pin.intro': 'Masukkan PIN Admin untuk mengurus semua kandungan hub.', 'pin.label': 'PIN Admin',
    'pin.wrong': 'PIN tidak sah. Sila cuba lagi.', 'pin.demo': 'Mod demo: PIN lalai ialah {pin} (ubah di {file}).',
    'pin.checking': 'Menyemak…', 'pin.unlock': 'Buka Kunci',

    // hero
    'hero.next': 'Podcast Seterusnya', 'hero.nextShort': 'Seterusnya', 'hero.today': 'Hari ini', 'hero.tomorrow': 'Esok',
    'hero.daysLeft': 'hari lagi', 'hero.daysChip': '{n} hari', 'hero.guide': 'Panduan Panel',
    'hero.welcome': 'Assalamualaikum, selamat datang.',
    'hero.empty': 'Tiada jadual podcast akan datang buat masa ini. Semak panduan panel sementara menunggu jemputan seterusnya.',

    // common ui
    'ui.close': 'Tutup', 'ui.cancel': 'Batal', 'ui.save': 'Simpan', 'ui.saving': 'Menyimpan…', 'ui.delete': 'Padam', 'ui.add': 'Tambah',
    'ui.edit': 'Edit', 'ui.up': 'Naik', 'ui.down': 'Turun', 'ui.optional': '(pilihan)',
    'ui.confirmTitle': 'Padam rekod?', 'ui.confirmBody': 'Tindakan ini tidak boleh dibatalkan.', 'ui.empty': 'Tiada rekod',
    'ui.all': 'Semua', 'ui.deleteNamed': 'Padam “{name}”?',

    // relative dates
    'rel.today': 'Hari ini', 'rel.tomorrow': 'Esok', 'rel.yesterday': 'Semalam',
    'rel.inDays': (n) => `${n} hari lagi`, 'rel.daysAgo': (n) => `${n} hari lepas`,
    'date.tbd': 'Belum Ditentukan',

    // toasts (store)
    'toast.added': 'Berjaya ditambah', 'toast.saved': 'Perubahan disimpan', 'toast.deleted': 'Rekod dipadam',
    'toast.adminOn': 'Mod Admin diaktifkan', 'toast.adminOff': 'Keluar dari Mod Admin',
    'toast.syncFailed': 'Gagal menyegerak data. Memaparkan salinan terakhir.', 'toast.wait': 'Sila tunggu, rekod sedang disimpan…',
    'toast.unexpected': 'Ralat tidak dijangka',

    // upcoming
    'up.eyebrow': 'Jadual', 'up.title': 'Upcoming Podcast',
    'up.descAdmin': 'Dijana automatik daripada List Panel yang bertarikh. Tekan “Salin Info WA” untuk kongsi makluman lengkap ke group.',
    'up.desc': 'Jadual rakaman & siaran langsung podcast yang akan datang.',
    'up.manage': 'Urus jadual di List Panel',
    'up.emptyTitle': 'Tiada jadual lagi',
    'up.emptyAdmin': 'Tambah panel dengan tarikh di List Panel untuk memaparkannya di sini.',
    'up.empty': 'Jadual akan dipaparkan sebaik sahaja tarikh rakaman ditetapkan.',
    'wa.copy': 'Salin Info WA', 'wa.copied': 'Disalin!', 'wa.toast': 'Mesej WhatsApp disalin — tampal dalam group', 'wa.failed': 'Gagal menyalin',

    // panel
    'panel.eyebrow': 'Direktori & Jadual', 'panel.title': 'List Panel',
    'panel.descAdmin': 'Sumber utama jadual: panel yang bertarikh dipaparkan secara automatik di Upcoming Podcast.',
    'panel.desc': 'Arkib tajuk dan panel — semak siapa pernah atau akan menjadi panel.',
    'panel.add': 'Tambah Panel', 'panel.edit': 'Edit Panel',
    'panel.search': 'Cari nama panel atau tajuk…', 'panel.searchLabel': 'Cari panel atau tajuk', 'panel.clear': 'Kosongkan carian',
    'panel.filterLabel': 'Tapis masa', 'panel.upcoming': 'Akan datang', 'panel.past': 'Lepas',
    'panel.count': (n) => `${n} rekod`,
    'panel.noMatch': 'Tiada padanan', 'panel.noMatchHint': 'Tiada keputusan untuk “{q}”.', 'panel.none': 'Tiada rekod panel',
    'panel.f.tajuk': 'Tajuk', 'panel.f.tajukPh': 'Tajuk episod',
    'panel.f.nama': 'Nama Panel', 'panel.f.namaPh': 'cth. Ustaz Hafiz Rahman',
    'panel.f.namaHelp': 'Satu rekod bagi setiap panel. Panel dengan tajuk & tarikh yang sama digabungkan dalam satu slot Upcoming.',
    'panel.f.tarikh': 'Tarikh', 'panel.f.tbd': 'Belum Ditentukan', 'panel.f.tbdHelp': 'Tandakan jika tarikh rakaman belum ditetapkan.',
    'panel.preview.tbd': 'Tidak akan dipaparkan di Upcoming sehingga tarikh ditetapkan.',
    'panel.preview.past': 'Telah berlalu (arkib)', 'panel.preview.shown': 'dipaparkan di Upcoming',
    'panel.needDate': 'Sila pilih tarikh atau tandakan "Belum Ditentukan"',
    'panel.savedTbd': 'Panel disimpan · tarikh belum ditentukan', 'panel.savedUp': 'Panel disimpan · dipaparkan di Upcoming', 'panel.savedPast': 'Panel disimpan (arkib)',
    'panel.confirmDelete': 'Padam {name} daripada senarai?', 'panel.confirmDeleteUp': ' Slot ini juga akan dikeluarkan dari Upcoming.',

    // panduan + drive card
    'pd.eyebrow': 'Rujukan', 'pd.title': 'Panduan Panel', 'pd.desc': 'Dokumen rasmi untuk moderator dan panel. Sila baca sebelum hari rakaman.',
    'pd.add': 'Tambah Dokumen', 'pd.addTitle': 'Tambah Dokumen Panduan', 'pd.edit': 'Edit Dokumen',
    'pd.newTitle': 'Panel baharu?', 'pd.newBody': 'Mulakan dengan dokumen pertama. Ia merangkumi aliran rakaman, tempoh masa dan persediaan yang diperlukan.',
    'pd.empty': 'Tiada dokumen panduan',
    'drive.kind': 'PDF · Google Drive', 'drive.download': 'Muat Turun PDF', 'drive.view': 'Lihat', 'drive.viewAria': 'Lihat {title}', 'drive.noLink': 'Pautan belum ditetapkan',
    'drive.f.tajuk': 'Tajuk', 'drive.f.tajukPh': 'cth. Panduan Lengkap Panel', 'drive.f.ket': 'Keterangan Ringkas', 'drive.f.ketPh': 'Apa yang terkandung dalam dokumen ini?',
    'drive.f.url': 'Pautan Google Drive (PDF)', 'drive.f.urlHelp': 'Pastikan perkongsian fail ditetapkan kepada “Sesiapa yang mempunyai pautan”.',

    // peringatan
    'pr.eyebrow': 'Adab & Nasihat', 'pr.title': 'Peringatan Syeikhuna',
    'pr.desc': 'Pesanan dan adab daripada Tuan Syeikh untuk semua yang terlibat dalam majlis ilmu ini.',
    'pr.add': 'Tambah Peringatan', 'pr.edit': 'Edit Peringatan', 'pr.empty': 'Tiada peringatan lagi', 'pr.speaker': 'Tuan Syeikh',
    'pr.f.arab': 'Teks Arab (pilihan)', 'pr.f.petikan': 'Peringatan / Nasihat', 'pr.f.konteks': 'Konteks / Sumber (pilihan)', 'pr.f.konteksPh': 'cth. Taklimat Panel, Rejab 1448H',

    // kitab
    'kb.eyebrow': 'Promosi', 'kb.title': 'Promosi Kitab',
    'kb.desc': 'Pantau kekerapan promosi setiap kitab supaya giliran adil. Kitab paling kurang dipromosi dipaparkan dahulu.',
    'kb.add': 'Tambah Kitab', 'kb.edit': 'Edit Kitab', 'kb.count': (n) => `${n} kitab`,
    'kb.sortAsc': 'Paling kurang dahulu', 'kb.sortDesc': 'Paling kerap dahulu', 'kb.empty': 'Tiada kitab disenaraikan',
    'kb.times': 'Bilangan kekerapan promosi', 'kb.timesAria': (n) => `${n} kali dipromosi`,
    'kb.dec': 'Kurangkan {name}', 'kb.inc': 'Tambah {name}',
    'kb.scripts': 'Skrip Promosi', 'kb.addScript': '+ Tambah skrip', 'kb.noScript': 'Tiada skrip', 'kb.noScriptHint': 'Admin boleh menambah pautan PDF skrip promosi.',
    'kb.addScriptTitle': 'Tambah Skrip Promosi', 'kb.editScript': 'Edit Skrip Promosi',
    'kb.f.nama': 'Nama Kitab', 'kb.f.namaPh': 'cth. Riyadhus Solihin', 'kb.f.bil': 'Bilangan Kekerapan Promosi',

    // youtube
    'yt.eyebrow': 'Arkib', 'yt.title': 'Episode Podcast YT', 'yt.desc': 'Episod yang telah diterbitkan. Klik untuk tonton di YouTube.',
    'yt.add': 'Tambah Episod', 'yt.edit': 'Edit Episod', 'yt.empty': 'Belum ada episod', 'yt.invalid': 'Pautan YouTube tidak sah',
    'yt.detected': 'ID video dikesan:', 'yt.unknown': 'Pautan YouTube tidak dikenali.',
    'yt.f.tajuk': 'Tajuk Episod', 'yt.f.tajukPh': 'cth. EP13 · Mengurus Hati', 'yt.f.url': 'Pautan YouTube', 'yt.f.urlPh': 'https://youtu.be/… atau https://www.youtube.com/watch?v=…',
    'yt.f.urlHelp': 'Menyokong youtube.com/watch, youtu.be, /shorts, /live & /embed. Thumbnail dijana automatik.',
    'yt.f.thumb': 'URL Thumbnail Tersuai (pilihan)', 'yt.f.thumbHelp': 'Isi hanya jika mahu mengatasi thumbnail automatik YouTube.', 'yt.f.tarikh': 'Tarikh Terbit (pilihan)',

    // cadangan
    'cd.eyebrow': 'Maklum Balas', 'cd.title': 'Cadangan',
    'cd.desc': 'Ruang terbuka untuk semua. Admin akan menandakan cadangan yang telah diambil tindakan.',
    'cd.formTitle': 'Kongsi cadangan anda',
    'cd.formBody': 'Idea penambahbaikan untuk podcast atau hub ini. Anda boleh mengedit cadangan sendiri dari pelayar ini sehingga ditandakan selesai.',
    'cd.tarikh': 'Tarikh', 'cd.catatan': 'Catatan', 'cd.placeholder': 'Tulis cadangan anda di sini…',
    'cd.send': 'Hantar Cadangan', 'cd.sending': 'Menghantar…', 'cd.thanks': 'Terima kasih! Cadangan anda dihantar.',
    'cd.tooShort': 'Sila tulis cadangan sekurang-kurangnya 5 aksara', 'cd.wait': 'Sila tunggu {s} saat sebelum menghantar lagi',
    'cd.replyPh': 'Tulis maklum balas admin…', 'cd.reply': 'Maklum balas admin', 'cd.replySaved': 'Maklum balas disimpan', 'cd.waiting': 'Menunggu maklum balas.',
    'cd.mine': 'Cadangan anda', 'cd.edit': 'Edit cadangan', 'cd.editTitle': 'Edit Cadangan', 'cd.delete': 'Padam cadangan', 'cd.deleteConfirm': 'Padam cadangan ini?',
    'cd.locked': 'Dikunci', 'cd.lockedTitle': 'Dikunci selepas selesai',
    'cd.markDone': 'Tandakan Done', 'cd.done': 'Done', 'cd.markedDone': 'Ditanda selesai', 'cd.markedOpen': 'Ditanda belum selesai',
    'cd.statusDone': 'Selesai', 'cd.statusOpen': 'Belum Selesai', 'cd.filterLabel': 'Tapis status',
    'cd.empty': 'Tiada cadangan di sini', 'cd.emptyHint': 'Jadilah yang pertama berkongsi idea!',
  },

  ar: {
    'nav.upcoming': 'القادم', 'nav.upcoming.short': 'القادم', 'nav.upcoming.full': 'البودكاست القادم', 'nav.upcoming.desc': 'مواعيد التسجيل والبث',
    'nav.panel': 'قائمة الضيوف', 'nav.panel.short': 'الضيوف', 'nav.panel.full': 'قائمة الضيوف', 'nav.panel.desc': 'دليل الضيوف والعناوين',
    'nav.panduan': 'الدليل', 'nav.panduan.short': 'الدليل', 'nav.panduan.full': 'دليل الضيوف', 'nav.panduan.desc': 'وثائق PDF للضيوف',
    'nav.peringatan': 'التوجيهات', 'nav.peringatan.short': 'التوجيهات', 'nav.peringatan.full': 'توجيهات شيخنا', 'nav.peringatan.desc': 'آداب ونصائح فضيلة الشيخ',
    'nav.kitab': 'التعريف بالكتب', 'nav.kitab.short': 'الكتب', 'nav.kitab.full': 'التعريف بالكتب', 'nav.kitab.desc': 'تكرار التعريف والنصوص',
    'nav.youtube': 'الحلقات', 'nav.youtube.short': 'الحلقات', 'nav.youtube.full': 'حلقات البودكاست', 'nav.youtube.desc': 'معرض حلقات يوتيوب',
    'nav.cadangan': 'المقترحات', 'nav.cadangan.short': 'المقترحات', 'nav.cadangan.full': 'المقترحات', 'nav.cadangan.desc': 'شارك أفكار التحسين',
    'nav.more': 'المزيد', 'nav.moreTitle': 'أقسام أخرى', 'nav.aria': 'الأقسام الرئيسية',

    'app.tagline': 'مركز معلومات الضيوف ومديري الحوار',
    'lang.switch': 'تغيير اللغة',
    'theme.light': 'الوضع الفاتح', 'theme.dark': 'الوضع الداكن',
    'sync.syncing': 'جارٍ المزامنة…', 'sync.offline': 'غير متصل', 'sync.ready': 'جاهز', 'sync.updated': 'آخر تحديث {time}',
    'sync.retryTitle': 'اضغط لإعادة المزامنة', 'sync.errorTitle': 'خطأ: {error}. اضغط للمحاولة مجددًا.', 'sync.offlineRetry': 'غير متصل — إعادة المزامنة',
    'demo': 'تجريبي',
    'admin': 'المشرف', 'admin.logoutShort': 'خروج', 'admin.logout': 'الخروج من وضع المشرف', 'admin.login': 'دخول المشرف',
    'admin.banner': 'وضع المشرف مفعّل — إضافة المحتوى وتعديله وترتيبه وحذفه.',
    'load.failed': 'تعذّر تحميل البيانات', 'load.retry': 'إعادة المحاولة', 'load.loading': 'جارٍ التحميل',
    'mock.notice': 'الوضع التجريبي: تُحفظ البيانات في هذا المتصفح فقط. اربط Google Apps Script في {file} للمزامنة بين الأجهزة.',

    'footer.about': 'مرجع مشترك للمنظمين ومديري الحوار والضيوف. شارك هذا الرابط — دون الحاجة إلى تكرار الشرح في مجموعات واتساب.',
    'footer.copyright': 'حقوق النشر',
    'pin.title': 'دخول المشرف', 'pin.intro': 'أدخل الرمز السري للمشرف لإدارة جميع محتويات المنصة.', 'pin.label': 'الرمز السري للمشرف',
    'pin.wrong': 'الرمز السري غير صحيح. يرجى المحاولة مجددًا.', 'pin.demo': 'الوضع التجريبي: الرمز الافتراضي هو {pin} (يمكن تغييره في {file}).',
    'pin.checking': 'جارٍ التحقق…', 'pin.unlock': 'فتح القفل',

    'hero.next': 'البودكاست التالي', 'hero.nextShort': 'التالي', 'hero.today': 'اليوم', 'hero.tomorrow': 'غدًا',
    'hero.daysLeft': (n) => (n === 1 ? 'يوم متبقٍ' : n === 2 ? 'يومان متبقيان' : n <= 10 ? 'أيام متبقية' : 'يومًا متبقيًا'), 'hero.daysChip': (n) => arDaysAcc(n), 'hero.guide': 'دليل الضيوف',
    'hero.welcome': 'السلام عليكم، أهلًا وسهلًا.',
    'hero.empty': 'لا توجد حلقات قادمة في الوقت الحالي. اطّلع على دليل الضيوف ريثما تصل الدعوة التالية.',

    'ui.close': 'إغلاق', 'ui.cancel': 'إلغاء', 'ui.save': 'حفظ', 'ui.saving': 'جارٍ الحفظ…', 'ui.delete': 'حذف', 'ui.add': 'إضافة',
    'ui.edit': 'تعديل', 'ui.up': 'نقل لأعلى', 'ui.down': 'نقل لأسفل', 'ui.optional': '(اختياري)',
    'ui.confirmTitle': 'حذف السجل؟', 'ui.confirmBody': 'لا يمكن التراجع عن هذا الإجراء.', 'ui.empty': 'لا توجد سجلات',
    'ui.all': 'الكل', 'ui.deleteNamed': 'حذف «{name}»؟',

    'rel.today': 'اليوم', 'rel.tomorrow': 'غدًا', 'rel.yesterday': 'أمس',
    'rel.inDays': (n) => `بعد ${arDaysAcc(n)}`, 'rel.daysAgo': (n) => `قبل ${arDaysAcc(n)}`,
    'date.tbd': 'غير محدد',

    'toast.added': 'تمت الإضافة بنجاح', 'toast.saved': 'تم حفظ التغييرات', 'toast.deleted': 'تم حذف السجل',
    'toast.adminOn': 'تم تفعيل وضع المشرف', 'toast.adminOff': 'تم الخروج من وضع المشرف',
    'toast.syncFailed': 'تعذّرت مزامنة البيانات. تُعرض آخر نسخة محفوظة.', 'toast.wait': 'يرجى الانتظار، جارٍ حفظ السجل…',
    'toast.unexpected': 'حدث خطأ غير متوقع',

    'up.eyebrow': 'الجدول', 'up.title': 'البودكاست القادم',
    'up.descAdmin': 'يُنشأ تلقائيًا من قائمة الضيوف ذات التواريخ المحددة. اضغط «نسخ رسالة واتساب» لمشاركة الإعلان كاملًا في المجموعة.',
    'up.desc': 'مواعيد تسجيل وبث حلقات البودكاست القادمة.',
    'up.manage': 'إدارة الجدول من قائمة الضيوف',
    'up.emptyTitle': 'لا توجد مواعيد بعد',
    'up.emptyAdmin': 'أضف ضيفًا بتاريخ محدد في قائمة الضيوف ليظهر هنا.',
    'up.empty': 'ستظهر المواعيد فور تحديد تاريخ التسجيل.',
    'wa.copy': 'نسخ رسالة واتساب', 'wa.copied': 'تم النسخ!', 'wa.toast': 'تم نسخ رسالة واتساب — الصقها في المجموعة', 'wa.failed': 'تعذّر النسخ',

    'panel.eyebrow': 'الدليل والجدول', 'panel.title': 'قائمة الضيوف',
    'panel.descAdmin': 'المصدر الرئيسي للجدول: يظهر الضيوف ذوو التواريخ المحددة تلقائيًا في البودكاست القادم.',
    'panel.desc': 'أرشيف العناوين والضيوف — تعرّف على من شارك أو سيشارك.',
    'panel.add': 'إضافة ضيف', 'panel.edit': 'تعديل ضيف',
    'panel.search': 'ابحث باسم الضيف أو العنوان…', 'panel.searchLabel': 'البحث عن ضيف أو عنوان', 'panel.clear': 'مسح البحث',
    'panel.filterLabel': 'التصفية حسب الوقت', 'panel.upcoming': 'القادمة', 'panel.past': 'السابقة',
    'panel.count': (n) => `عدد السجلات: ${n}`,
    'panel.noMatch': 'لا توجد نتائج', 'panel.noMatchHint': 'لا توجد نتائج لـ «{q}».', 'panel.none': 'لا توجد سجلات للضيوف',
    'panel.f.tajuk': 'العنوان', 'panel.f.tajukPh': 'عنوان الحلقة',
    'panel.f.nama': 'اسم الضيف', 'panel.f.namaPh': 'مثال: الأستاذ حافظ رحمن',
    'panel.f.namaHelp': 'سجل واحد لكل ضيف. يُدمج الضيوف ذوو العنوان والتاريخ نفسيهما في موعد واحد.',
    'panel.f.tarikh': 'التاريخ', 'panel.f.tbd': 'غير محدد', 'panel.f.tbdHelp': 'حدّد هذا الخيار إذا لم يُحدَّد تاريخ التسجيل بعد.',
    'panel.preview.tbd': 'لن يظهر في البودكاست القادم حتى يُحدَّد التاريخ.',
    'panel.preview.past': 'مضى (في الأرشيف)', 'panel.preview.shown': 'يظهر في البودكاست القادم',
    'panel.needDate': 'يرجى اختيار تاريخ أو تحديد «غير محدد»',
    'panel.savedTbd': 'تم حفظ الضيف · التاريخ غير محدد', 'panel.savedUp': 'تم حفظ الضيف · يظهر في البودكاست القادم', 'panel.savedPast': 'تم حفظ الضيف (في الأرشيف)',
    'panel.confirmDelete': 'حذف {name} من القائمة؟', 'panel.confirmDeleteUp': ' سيُزال هذا الموعد أيضًا من البودكاست القادم.',

    'pd.eyebrow': 'مراجع', 'pd.title': 'دليل الضيوف', 'pd.desc': 'الوثائق الرسمية لمديري الحوار والضيوف. يرجى قراءتها قبل يوم التسجيل.',
    'pd.add': 'إضافة وثيقة', 'pd.addTitle': 'إضافة وثيقة إرشادية', 'pd.edit': 'تعديل الوثيقة',
    'pd.newTitle': 'ضيف جديد؟', 'pd.newBody': 'ابدأ بالوثيقة الأولى؛ فهي تشمل سير التسجيل والمدة الزمنية والتحضيرات اللازمة.',
    'pd.empty': 'لا توجد وثائق إرشادية',
    'drive.kind': 'PDF · Google Drive', 'drive.download': 'تنزيل PDF', 'drive.view': 'عرض', 'drive.viewAria': 'عرض {title}', 'drive.noLink': 'لم يُحدَّد الرابط بعد',
    'drive.f.tajuk': 'العنوان', 'drive.f.tajukPh': 'مثال: الدليل الشامل للضيوف', 'drive.f.ket': 'وصف مختصر', 'drive.f.ketPh': 'ما الذي تتضمنه هذه الوثيقة؟',
    'drive.f.url': 'رابط Google Drive (PDF)', 'drive.f.urlHelp': 'تأكد من ضبط مشاركة الملف على «أي شخص لديه الرابط».',

    'pr.eyebrow': 'آداب ونصائح', 'pr.title': 'توجيهات شيخنا',
    'pr.desc': 'وصايا وآداب من فضيلة الشيخ لكل المشاركين في مجلس العلم هذا.',
    'pr.add': 'إضافة توجيه', 'pr.edit': 'تعديل التوجيه', 'pr.empty': 'لا توجد توجيهات بعد', 'pr.speaker': 'فضيلة الشيخ',
    'pr.f.arab': 'النص العربي (اختياري)', 'pr.f.petikan': 'التوجيه / النصيحة', 'pr.f.konteks': 'السياق / المصدر (اختياري)', 'pr.f.konteksPh': 'مثال: لقاء الضيوف، رجب 1448هـ',

    'kb.eyebrow': 'التعريف', 'kb.title': 'التعريف بالكتب',
    'kb.desc': 'تابِع عدد مرات التعريف بكل كتاب لضمان التناوب العادل. تُعرض الكتب الأقل تعريفًا أولًا.',
    'kb.add': 'إضافة كتاب', 'kb.edit': 'تعديل الكتاب', 'kb.count': (n) => `عدد الكتب: ${n}`,
    'kb.sortAsc': 'الأقل تعريفًا أولًا', 'kb.sortDesc': 'الأكثر تعريفًا أولًا', 'kb.empty': 'لا توجد كتب مدرجة',
    'kb.times': 'عدد مرات التعريف', 'kb.timesAria': (n) => `عُرِّف به ${n} مرة`,
    'kb.dec': 'إنقاص {name}', 'kb.inc': 'زيادة {name}',
    'kb.scripts': 'نصوص التعريف', 'kb.addScript': '+ إضافة نص', 'kb.noScript': 'لا توجد نصوص', 'kb.noScriptHint': 'يمكن للمشرف إضافة رابط PDF لنص التعريف.',
    'kb.addScriptTitle': 'إضافة نص تعريف', 'kb.editScript': 'تعديل نص التعريف',
    'kb.f.nama': 'اسم الكتاب', 'kb.f.namaPh': 'مثال: رياض الصالحين', 'kb.f.bil': 'عدد مرات التعريف',

    'yt.eyebrow': 'الأرشيف', 'yt.title': 'حلقات البودكاست', 'yt.desc': 'الحلقات المنشورة. اضغط للمشاهدة على يوتيوب.',
    'yt.add': 'إضافة حلقة', 'yt.edit': 'تعديل الحلقة', 'yt.empty': 'لا توجد حلقات بعد', 'yt.invalid': 'رابط يوتيوب غير صالح',
    'yt.detected': 'تم التعرف على معرّف الفيديو:', 'yt.unknown': 'رابط يوتيوب غير معروف.',
    'yt.f.tajuk': 'عنوان الحلقة', 'yt.f.tajukPh': 'مثال: الحلقة 13', 'yt.f.url': 'رابط يوتيوب', 'yt.f.urlPh': 'https://youtu.be/…',
    'yt.f.urlHelp': 'يدعم روابط youtube.com/watch و youtu.be و /shorts و /live و /embed. تُنشأ الصورة المصغّرة تلقائيًا.',
    'yt.f.thumb': 'رابط صورة مصغّرة مخصصة (اختياري)', 'yt.f.thumbHelp': 'املأه فقط إن أردت استبدال الصورة المصغّرة التلقائية من يوتيوب.', 'yt.f.tarikh': 'تاريخ النشر (اختياري)',

    'cd.eyebrow': 'الملاحظات', 'cd.title': 'المقترحات',
    'cd.desc': 'مساحة مفتوحة للجميع. سيحدّد المشرف المقترحات التي تم العمل بها.',
    'cd.formTitle': 'شارك مقترحك',
    'cd.formBody': 'أفكار لتحسين البودكاست أو هذه المنصة. يمكنك تعديل مقترحك من هذا المتصفح حتى يتم تحديده كمكتمل.',
    'cd.tarikh': 'التاريخ', 'cd.catatan': 'الملاحظة', 'cd.placeholder': 'اكتب مقترحك هنا…',
    'cd.send': 'إرسال المقترح', 'cd.sending': 'جارٍ الإرسال…', 'cd.thanks': 'شكرًا لك! تم إرسال مقترحك.',
    'cd.tooShort': 'يرجى كتابة مقترح من 5 أحرف على الأقل', 'cd.wait': 'يرجى الانتظار {s} ثانية قبل الإرسال مجددًا',
    'cd.replyPh': 'اكتب ردّ المشرف…', 'cd.reply': 'ردّ المشرف', 'cd.replySaved': 'تم حفظ الرد', 'cd.waiting': 'بانتظار الرد.',
    'cd.mine': 'مقترحك', 'cd.edit': 'تعديل المقترح', 'cd.editTitle': 'تعديل المقترح', 'cd.delete': 'حذف المقترح', 'cd.deleteConfirm': 'حذف هذا المقترح؟',
    'cd.locked': 'مقفل', 'cd.lockedTitle': 'يُقفل بعد الاكتمال',
    'cd.markDone': 'تحديد كمكتمل', 'cd.done': 'مكتمل', 'cd.markedDone': 'تم التحديد كمكتمل', 'cd.markedOpen': 'تم التحديد كغير مكتمل',
    'cd.statusDone': 'مكتمل', 'cd.statusOpen': 'قيد المعالجة', 'cd.filterLabel': 'التصفية حسب الحالة',
    'cd.empty': 'لا توجد مقترحات هنا', 'cd.emptyHint': 'كن أول من يشارك فكرة!',
  },
};

/** Known backend (Code.gs) error messages -> Arabic. Unknown messages pass through unchanged. */
const SERVER_ERR_AR = {
  'PIN salah': 'الرمز السري غير صحيح',
  'Akses admin diperlukan': 'يتطلب صلاحية المشرف',
  'Anda hanya boleh mengedit cadangan sendiri': 'يمكنك تعديل مقترحاتك فقط',
  'Cadangan ini telah selesai dan dikunci': 'هذا المقترح مكتمل ومقفل',
  'Catatan diperlukan': 'الملاحظة مطلوبة',
  'Catatan terlalu panjang': 'الملاحظة طويلة جدًا',
  'Rekod tidak dijumpai': 'السجل غير موجود',
  'Terlalu banyak cubaan. Cuba lagi dalam 10 minit.': 'محاولات كثيرة. حاول مجددًا بعد 10 دقائق.',
  'Terlalu banyak cadangan dihantar. Cuba sebentar lagi.': 'تم إرسال مقترحات كثيرة. حاول بعد قليل.',
  'Tiada sambungan ke pelayan': 'لا يوجد اتصال بالخادم',
  'Pelayan lambat bertindak balas. Cuba lagi.': 'الخادم بطيء في الاستجابة. حاول مجددًا.',
};

function interpolate(s, vars) {
  return String(s).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k] !== undefined ? vars[k] : `{${k}}`));
}

export function readLang() {
  try {
    const v = localStorage.getItem(KEY);
    return LANGS.includes(v) ? v : 'ms';
  } catch {
    return 'ms';
  }
}

/** Applies lang + direction to <html>. Also called before first paint from index.html. */
export function applyLang(lang) {
  const el = document.documentElement;
  el.lang = lang === 'ar' ? 'ar' : 'ms';
  el.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

const LangCtx = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readLang);

  useEffect(() => { applyLang(lang); }, [lang]);

  const setLang = useCallback((l) => {
    const next = LANGS.includes(l) ? l : 'ms';
    try { localStorage.setItem(KEY, next); } catch { /* private mode */ }
    setLangState(next);
  }, []);

  const value = useMemo(() => {
    const d = DICT[lang];
    const t = (key, vars) => {
      const v = d[key] ?? DICT.ms[key];
      if (v === undefined) return key;
      if (typeof v === 'function') return v(vars?.n ?? vars);
      return interpolate(v, vars);
    };
    const hari = (iso) => { const x = parseISO(iso); return x ? HARI[lang][x.getDay()] : ''; };
    const date = (iso, { short = false } = {}) => {
      const x = parseISO(iso);
      if (!x) return iso || '';
      return `${x.getDate()} ${(short ? BULAN_PENDEK : BULAN)[lang][x.getMonth()]} ${x.getFullYear()}`;
    };
    const monthShort = (iso) => { const x = parseISO(iso); return x ? BULAN_PENDEK[lang][x.getMonth()] : ''; };
    /** 'Khamis, 3 Disember 2026' / 'الخميس، 3 ديسمبر 2026' or the TBD label */
    const tarikhHari = (iso, opts) => {
      if (!/^\d{4}-\d{2}-\d{2}/.test(String(iso ?? '').trim())) return t('date.tbd');
      const s = String(iso).trim().slice(0, 10);
      return `${hari(s)}${lang === 'ar' ? '، ' : ', '}${date(s, opts)}`;
    };
    const relative = (iso) => {
      const n = daysUntil(iso);
      if (n === null) return '';
      if (n === 0) return t('rel.today');
      if (n === 1) return t('rel.tomorrow');
      if (n === -1) return t('rel.yesterday');
      return n > 1 ? t('rel.inDays', { n }) : t('rel.daysAgo', { n: Math.abs(n) });
    };
    const serverError = (msg) => (lang === 'ar' && SERVER_ERR_AR[msg]) || msg;
    return { lang, setLang, dir: lang === 'ar' ? 'rtl' : 'ltr', t, fmt: { hari, date, monthShort, tarikhHari, relative, arDays }, serverError };
  }, [lang, setLang]);

  return <LangCtx.Provider value={value}>{children}</LangCtx.Provider>;
}

export const useI18n = () => useContext(LangCtx);
