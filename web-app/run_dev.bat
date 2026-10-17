@echo off
chcp 65001 > nul
echo ============================================================
echo   🚀 JOBMACHINE HQ // Запуск командного пункта лидогенерации
echo ============================================================
echo.

echo [1/2] Запуск бэкенда FastAPI (порт 8000)...
start "JobMachine Backend (API)" cmd /k "cd /d %~dp0backend && py -m uvicorn main:app --reload --port 8000 --host 127.0.0.1"

timeout /t 2 /nobreak > nul

echo [2/2] Запуск веб-интерфейса Vite (порт 5173)...
start "JobMachine Frontend (UI)" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak > nul

echo.
echo ✅ Командный пункт запущен!
echo 🌐 Веб-интерфейс: http://localhost:5173
echo 📡 API & Документация: http://127.0.0.1:8000/docs
echo.
echo Нажмите любую клавишу для завершения этого скрипта (сервера продолжат работу в открытых окнах)...
pause > nul
