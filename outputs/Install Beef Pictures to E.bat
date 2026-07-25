@echo off
setlocal

set "SOURCE=%~dp0meal-planner"
set "TARGET=E:\Meal Planner"

echo Supperloom Meal Planner
echo Updating beef choice pictures on the thumb drive...
echo.

if not exist "%SOURCE%\app.js" (
  echo I could not find the updated meal planner folder next to this updater.
  echo.
  pause
  exit /b 1
)

if not exist "E:\" (
  echo I cannot see drive E:. Plug in the thumb drive and try again.
  echo.
  pause
  exit /b 1
)

if not exist "%TARGET%" mkdir "%TARGET%"
if not exist "%TARGET%\images" mkdir "%TARGET%\images"
if not exist "%TARGET%\images\ingredients" mkdir "%TARGET%\images\ingredients"

copy /Y "%SOURCE%\app.js" "%TARGET%\app.js" >nul
if errorlevel 1 (
  echo I could not update the main page script on the thumb drive.
  echo.
  pause
  exit /b 1
)

robocopy "%SOURCE%\images\ingredients" "%TARGET%\images\ingredients" *.png beef-cut-image-attribution.txt /E /NFL /NDL /NJH /NJS /NP >nul
if %ERRORLEVEL% GTR 7 (
  echo I could not copy the ingredient pictures to the thumb drive.
  echo.
  pause
  exit /b 1
)

echo Done. The beef pictures and menu fixes are now on drive E:.
echo Your planner-data.json file was not touched.
echo.
pause
