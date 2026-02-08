# گواهی واقع‌گرایی UI تطبیق‌پذیر

> «این سیستم، یک UI هوشمندِ تطبیق‌پذیر است — نه یک سیستم خود-آگاه.
> تمامی قابلیت‌ها بر اساس استانداردهای فعلی واقعی هستند.»

## دامنه
- فقط از APIهای پشتیبانی‌شده: prefers-color-scheme, prefers-reduced-motion, idle-detection (اختیاری)
- بدون سنسورهای سخت‌افزاری یا ادعاهای آگاهی

## ادراک (Perception)
- نور محیط: فقط با media query `(prefers-color-scheme: dark)`
- حرکت دست: فقط با CSS media query `pointer`
- تمرکز: با `prefers-reduced-motion`; و `Idle Detection` در صورت اجازهٔ کاربر و پشتیبانی مرورگر

## شناخت (Cognitive)
- پیش‌بینی مبتنی بر تاریخچهٔ تعامل صریح کاربر (کلیک/جستجو/بازدید)
- تشخیص خستگی: فقط با تایمر بی‌حرکتی ۵ دقیقه

## سازگاری (Adaptation)
- تغییر تم: فقط با کنترل دستی کاربر (ThemeToggle)
- Focus Mode: فقط با کنترل دستی کاربر (FocusModeToggle)
- هیچ تغییری بدون رضایت کاربر اعمال نمی‌شود

## دفاع (Defense)
- Clickjacking: با CSP و X-Frame-Options توصیه می‌شود
- XSS: استفاده از Trusted Types و DOMPurify توصیه می‌شود
- هیچ دفاع ۱۰۰٪ وجود ندارد
