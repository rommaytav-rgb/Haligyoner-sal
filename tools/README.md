# בדיקות / Verification checks

שלוש בדיקות שרצות על קובץ המשחק. כולן מחזירות exit code 1 כשיש בעיה,
כך שאפשר לשרשר אותן: `npm run check:dom -- game.html && npm run check:hebrew -- game.html`

Three checks that run against the game file. Each exits non-zero on any problem.

## התקנה / Setup

```
npm install
```

Chromium comes from Playwright. On this machine it is already at
`/opt/pw-browsers`, so no browser download is needed.

## 1. `check-hebrew.mjs` — אף אות עברית במצב אנגלית

```
node tools/check-hebrew.mjs game.html --lang en --steps 900
```

מפעילה קריירה שלמה במצב אנגלית ואחרי כל צעד סורקת את כל מה שהשחקן רואה:
טקסט גלוי, `placeholder` / `title` / `alt` / `aria-label` / `value`,
תוויות `<option>`, ו-`<title>` של הדף. כל אות עברית = בעיה, עם הנתיב לאלמנט
והטקסט עצמו. הסריקה רצה גם כשחלונות מודאליים פתוחים, ובסוף פותחת את כל
הפאנלים הצדדיים (היסטוריה, טבלאות, פנקס תארים, סטטיסטיקות קריירה).

## 2. `check-dom.mjs` — כל אלמנט שהקוד כותב אליו קיים בדף

```
node tools/check-dom.mjs game.html --lang he --steps 900
```

**Pass A** — כל id שמופיע כליטרל בקוד נבדק מול `document.getElementById()`
האמיתי. `null` = כישלון.

**Pass B** — `document.getElementById` ו-`querySelector` עטופים *לפני* טעינת
הדף. כל קריאה שמחזירה `null` בזמן שהבוט משחק באמת נרשמת עם ה-stack שלה.

בנוסף נאספות שגיאות JS לא-מטופלות מהדף.

אין כאן שום רתמה סלחנית: הבדיקה שואלת את ה-DOM האמיתי, ו-`null` נספר כבעיה.

Tamper-tested: deleting `st-rank` and renaming `st-rank-total` makes it report
5 problems and exit 1, including the resulting
`Cannot set properties of null (setting 'innerText')`.

## 3. `check-assets.mjs` — 295 הסמלים בייט-אחר-בייט

```
node tools/check-assets.mjs before.html after.html
```

מחלצת כל data-URI משני הקבצים, מחשבת sha256 לכל אחד, ומשווה גם את הרשימה
וגם את הסדר. שינוי של תו אחד ב-base64 מזוהה.

## `bot.mjs`

מנוע ההרצה המשותף. הוא לא מקודד שמות מסכים — הוא מחפש כפתורים גלויים ופעילים
בחלון המודאלי הפתוח, אחרת לוחץ על `next-btn`. כך הוא ממשיך לעבוד גם אחרי
שינויים בקובץ המשחק. ריצה של 900 צעדים מגיעה מגיל 14 עד שנות ה-30 ועוברת
בין ליגות.
