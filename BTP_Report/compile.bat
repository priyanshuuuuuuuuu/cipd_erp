@echo off
echo Compiling CIPD 360 ERP BTP Report...

cd /d "%~dp0"

pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex
pdflatex -interaction=nonstopmode main.tex

echo.
echo Done! Open main.pdf to view the report.
pause
