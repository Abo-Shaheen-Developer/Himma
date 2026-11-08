<div align="center">

# 🍅 Pomodoro Timer | مؤقت بومودورو

A beautiful, glowing Pomodoro timer with a daily progress tracker and a to-do list.<br>
مؤقت بومودورو أنيق بتأثيرات إضاءة، مع تتبّع الإنجاز اليومي وقائمة مهام.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![No dependencies](https://img.shields.io/badge/dependencies-none-success)

**[English](#-english)** · **[العربية](#-العربية)**

<!-- Add a screenshot: ![Preview](screenshot.png) -->

</div>

---

## 🇬🇧 English

### Overview

A lightweight Pomodoro web app built with plain **HTML, CSS and JavaScript** in three separate files. No frameworks, no build step, no dependencies. Just open `index.html`.

### Features

- **Circular timer** with a ring that animates as time passes.
- **Custom durations** for focus time and short breaks.
- **Long break** after a configurable number of focus cycles (for example, every 4th cycle).
- **Endless loop:** focus and break alternate until you reset. In the **settings panel** (gear icon) you choose whether each one starts automatically: *auto-start break* is on by default and *auto-start focus* is off.
- **One main button:** *Start* → *Pause* → *Resume*, with a glowing green/red style.
- **Reset button** (circular arrow) to stop everything and return to the first cycle.
- **Daily achievement ("Your achievement today"):** a timer that counts the hours of real focus, excluding breaks and paused time, with its own animated ring. It starts again every day. Optionally, add a **specific daily goal** in hours to track your progress toward it.
- **Soft chime** when a focus or break period ends, generated with the Web Audio API (no audio files).
- **To-do list:** add, complete and delete tasks.
- **Notes:** a notes box next to the to-do list, saved automatically in the browser.
- **Tasks with a time:** add "I'll finish it within N minutes" to a task. The focus period uses that time (25 min if no task has one), a bar under the task shrinks while it runs, and at the end it asks "Did you finish your task?".
- **Statistics page:** hours per day, week total, day-vs-previous-day and week-vs-previous-week comparisons, and every past week, all saved in `localStorage`. It takes over the whole page and closes back to normal.
- **Background sounds:** rain and waves buttons in the header. Each loops endlessly until pressed again. Put `1.mp3` (waves) and `2.mp3` (rain) inside the `audio/` folder.
- **Dark and light themes** with a deep blue gradient background, glow effects and animations. Switching themes sends circular waves from the button across the whole page.
- **Remembers everything:** timer position, settings, achievement, tasks and theme are saved in the browser and restored when you come back. The timer returns paused, ready to resume.
- **RTL Arabic interface** and a responsive layout: on desktop screens (about 1333×768 and up) everything fits on one screen with no page scroll, and on phones it stacks and scrolls. It respects reduced-motion settings.
- **Visual effects switch** in the settings panel (on by default) turns gradients, animations and the theme wave on or off.

### Getting started

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

Then open `index.html` in any modern browser. No server is required.

### Project structure

```
.
├── index.html   # Page structure
├── style.css    # Themes, layout, glow effects and animations
├── audio/       # put 1.mp3 (waves) and 2.mp3 (rain) here
└── script.js    # Timer logic, achievement tracking, sound, to-do list, persistence
```

### How it works

| Setting | Default | Description |
| --- | --- | --- |
| Focus time | 25 min | Length of each focus session |
| Break time | 5 min | Length of a short break |
| Long break | 15 min | Length of the long break |
| Long break after | 4 cycles | Number of focus cycles before a long break |
| Auto-start break | On | Break starts by itself when focus ends |
| Auto-start focus | Off | Focus waits for you to press Start when a break ends |
| Visual effects | On | Gradients, animations and the theme wave. Turn off for a flat, static look |
| Daily goal | Off | Optional. When added (2 hours by default), the ring shows your progress toward it |

Changing the length of the period that is currently running applies immediately. Other changes apply when that period starts.

### Deploy on GitHub Pages

1. Push the three files to your repository.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, then select your branch and the `/ (root)` folder.
4. Save. Your site will be available at `https://<your-username>.github.io/<your-repo>/`.

### Notes

- Data is stored in `localStorage`, so it stays in the same browser and device.
- Browsers only allow sound after the first click or tap on the page.
- The Cairo font loads from Google Fonts. Without an internet connection the system font is used.
- Time is measured with timestamps, so the timer stays accurate even if the tab is in the background.

### License

Released under the [MIT License](LICENSE). Add a `LICENSE` file to your repository to use it.

---

<div dir="rtl">

## 🇸🇦 العربية

### نظرة عامة

تطبيق بومودورو خفيف مبني بـ **HTML و CSS و JavaScript** الصافية في ثلاثة ملفات منفصلة. بدون مكتبات أو أدوات بناء أو اعتماديات. افتح `index.html` وابدأ.

### المميزات

- **مؤقت دائري** تتحرك دائرته مع مرور الوقت.
- **أوقات قابلة للتعديل** للتركيز والاستراحة القصيرة.
- **استراحة طويلة** بعد عدد دورات تركيز تحدده أنت (مثلًا كل 4 دورات).
- **حلقة لا نهائية:** يتبادل التركيز والراحة حتى تعيد المؤقت. ومن **لوحة الإعدادات** (أيقونة الترس) تختار هل يبدأ كل منهما تلقائيًا: *بدء الراحة تلقائيًا* مفعّل افتراضيًا و*بدء التركيز تلقائيًا* مغلق.
- **زر رئيسي واحد:** *بدء* ← *إيقاف مؤقت* ← *استئناف*، بإضاءة خضراء أو حمراء.
- **زر إعادة** (سهم دائري) يوقف كل شيء ويرجع إلى الدورة الأولى.
- **إنجازك لهذا اليوم:** مؤقت يحسب ساعات التركيز الفعلي فقط، دون الراحة ووقت الإيقاف المؤقت، وله دائرة متحركة خاصة به. يبدأ من الصفر كل يوم. ويمكنك اختياريًا إضافة **هدف يومي محدد** بالساعات لتتابع تقدمك نحوه.
- **رنين ناعم** عند انتهاء التركيز أو الراحة، يُنشأ بواجهة Web Audio دون ملفات صوتية.
- **قائمة مهام:** إضافة المهام وإنجازها وحذفها.
- **ملاحظات:** مربع ثابت بجانب المهام، يُحفظ تلقائيًا.
- **مهام بوقت:** اختر «سأنجزها في غضون ..» وأدخل الدقائق، فيصبح وقت التركيز هو وقت المهمة (25 دقيقة إن لم يكن لأي مهمة وقت)، ويظهر شريط ينقص أسفل المهمة، وعند الانتهاء يسأل «هل أنجزت مهمتك ؟».
- **صفحة الإحصائيات:** ساعات كل يوم ومحصلة الأسبوع ومقارنة كل يوم باليوم السابق وكل أسبوع بالسابق وجميع الأسابيع الماضية، محفوظة في الجهاز. تأخذ الصفحة كلها وترجع كل شيء كما كان عند إغلاقها.
- **أصوات الخلفية:** زرّا المطر والأمواج في أعلى الصفحة، كل صوت يتكرر بلا توقف حتى تضغط عليه ثانية. ضع الملفين `1.mp3` (أمواج) و`2.mp3` (مطر) داخل مجلد `audio/`.
- **وضعان داكن وفاتح** مع خلفية زرقاء متدرجة وتأثيرات إضاءة وحركة. وعند التبديل تنتشر موجات دائرية من الزر على الصفحة كلها.
- **يتذكر كل شيء:** موضع المؤقت والإعدادات والإنجاز والمهام والوضع تُحفظ في المتصفح وتعود كما كانت عند فتح الموقع، ويعود المؤقت متوقفًا مؤقتًا جاهزًا للاستئناف.
- **واجهة عربية من اليمين لليسار** وتصميم متجاوب: على شاشات الكمبيوتر (من حوالي 1333×768 فأكثر) تظهر كل العناصر في شاشة واحدة بدون سكرول، وعلى الجوال تتراص العناصر ويكون السكرول متاحًا. وتحترم إعداد تقليل الحركة.
- **خيار «التأثيرات البصرية»** في لوحة الإعدادات (مفعّل افتراضيًا) يتحكم في التدرجات والحركة وموجة تبديل الثيم.

### البدء

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

ثم افتح `index.html` في أي متصفح حديث. لا حاجة إلى خادم.

### هيكل المشروع

```
.
├── index.html   # هيكل الصفحة
├── style.css    # الأوضاع والتخطيط وتأثيرات الإضاءة والحركة
├── audio/       # ضع 1.mp3 (أمواج) و2.mp3 (مطر)
└── script.js    # منطق المؤقت والإنجاز والصوت وقائمة المهام والحفظ
```

### الإعدادات

| الإعداد | الافتراضي | الوصف |
| --- | --- | --- |
| وقت التركيز | 25 دقيقة | مدة جلسة التركيز |
| وقت الراحة | 5 دقائق | مدة الاستراحة القصيرة |
| الاستراحة الطويلة | 15 دقيقة | مدة الاستراحة الطويلة |
| استراحة طويلة بعد | 4 دورات | عدد دورات التركيز قبل الاستراحة الطويلة |
| بدء الراحة تلقائيًا | مفعّل | تبدأ الراحة وحدها عند انتهاء التركيز |
| بدء التركيز تلقائيًا | مغلق | ينتظر التركيز ضغطك على بدء عند انتهاء الراحة |
| التأثيرات البصرية | مفعّلة | التدرجات والحركة وموجة الثيم. أوقفها لمظهر سادة وثابت |
| الهدف اليومي | بدون هدف | اختياري، وعند إضافته (ساعتان افتراضيًا) تعرض الدائرة تقدمك نحوه |

تغيير مدة الفترة الجارية يُطبَّق فورًا، وباقي التغييرات تُطبَّق عند بدء الفترة المعنية.

### النشر على GitHub Pages

1. ارفع الملفات الثلاثة إلى مستودعك.
2. افتح **Settings ← Pages**.
3. في **Build and deployment** اختر **Deploy from a branch**، ثم اختر الفرع والمجلد `/ (root)`.
4. احفظ، وسيصبح موقعك على `https://<your-username>.github.io/<your-repo>/`.

### ملاحظات

- البيانات تُخزَّن في `localStorage`، فتبقى في نفس المتصفح والجهاز.
- المتصفحات لا تسمح بالصوت قبل أول ضغطة أو لمسة على الصفحة.
- خط Cairo يُحمَّل من Google Fonts، وبدون إنترنت يُستخدم خط النظام.
- الوقت يُقاس بالطوابع الزمنية، فيبقى المؤقت دقيقًا حتى لو كان التبويب في الخلفية.

### الرخصة

مُرخَّص بموجب [رخصة MIT](LICENSE). أضف ملف `LICENSE` إلى مستودعك لاستخدامها.

</div>
