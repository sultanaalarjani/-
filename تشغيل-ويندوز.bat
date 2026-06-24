@echo off
chcp 65001 >nul
title لوحة إدارة عمليات الأداء
cd /d "%~dp0"

echo ============================================
echo     تشغيل لوحة إدارة عمليات الأداء
echo ============================================
echo.

REM التأكد من تثبيت Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo [تنبيه] Node.js غير مثبّت على الجهاز.
  echo الرجاء تثبيته من الموقع: https://nodejs.org  (اختر نسخة LTS)
  echo ثم شغّل هذا الملف مرة أخرى.
  echo.
  pause
  exit /b
)

REM تجهيز ملف الإعدادات وفتحه للتعديل أول مرة
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo تم إنشاء ملف الإعدادات .env
  echo سيُفتح الآن المفكرة: عدّل قيمة ADMIN_EMAIL إلى إيميلك ثم احفظ وأغلق المفكرة للمتابعة.
  echo.
  pause
  notepad ".env"
)

REM تثبيت الحزم أول مرة فقط
if not exist "node_modules" (
  echo [1/2] تثبيت الحزم لأول مرة... قد تستغرق دقيقة أو دقيقتين.
  call npm install
)

REM بناء التطبيق إن لم يكن مبنيًّا
if not exist ".next" (
  echo [2/2] بناء التطبيق...
  call npm run build
)

echo.
echo ============================================
echo   التطبيق يعمل الآن. سيُفتح المتصفح تلقائيًا.
echo   إن لم يُفتح، افتح: http://localhost:3000
echo   لإيقاف التطبيق: أغلق هذه النافذة.
echo ============================================
echo.

start "" http://localhost:3000
call npm start
pause
