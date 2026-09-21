@echo off
cd /d "C:\Users\Henrique Zanchi\projetos\portal-na"
echo. >> logs\mercurio-queue.log
echo [%date% %time%] iniciando >> logs\mercurio-queue.log
"C:\Program Files\nodejs\npx.cmd" tsx scripts\process-mercurio-queue.ts >> logs\mercurio-queue.log 2>&1
