#!/usr/bin/env powershell
# Diagnóstico de conexão Impressora Térmica - Padaria Solar

Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "DIAGNÓSTICO - IMPRESSORA TÉRMICA ELGIN i9" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# 1. Verificar se serviço está rodando
Write-Host "`n[1] Verificando serviço local na porta 8765..." -ForegroundColor Yellow
$conn = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Write-Host "    ✓ Serviço RODANDO na porta 8765" -ForegroundColor Green
} else {
    Write-Host "    ✗ SERVIÇO NÃO ESTÁ RODANDO!" -ForegroundColor Red
    Write-Host "    Inicie com: npm run printer:service" -ForegroundColor Yellow
    Write-Host "    E deixe rodando enquanto usar a app..." -ForegroundColor Yellow
}

# 2. Health check
Write-Host "`n[2] Testando health check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8765/health" -TimeoutSec 5
    Write-Host "    ✓ Serviço respondendo:" -ForegroundColor Green
    Write-Host "      - Host: $($response.host):$($response.port)" -ForegroundColor Green
    Write-Host "      - USB Candidates: $($response.usbCandidates -join ', ')" -ForegroundColor Green
} catch {
    Write-Host "    ✗ Serviço não respondeu: $_" -ForegroundColor Red
}

# 3. Verificar impressora no Windows
Write-Host "`n[3] Verificando impressora no Windows..." -ForegroundColor Yellow
$printer = Get-PnpDevice -Class "Printer" -ErrorAction SilentlyContinue | Where-Object { $_.Name -like "*ELGIN*" }
if ($printer) {
    Write-Host "    ✓ Impressora detectada: $($printer.Name)" -ForegroundColor Green
    Write-Host "    - Status: $($printer.Status)" -ForegroundColor Green
} else {
    Write-Host "    ✗ Impressora NÃO DETECTADA no Windows!" -ForegroundColor Red
    Write-Host "    Verifique se está conectada via USB..." -ForegroundColor Yellow
}

# 4. Testar impressão direta
Write-Host "`n[4] Testando impressão direta..." -ForegroundColor Yellow
try {
    $body = @{
        tableId = 'TEST'
        method = 'dinheiro'
        total = 1000
        orderCount = 1
        closedAt = (Get-Date).ToString('dd/MM/yyyy HH:mm:ss')
        lines = @(@{ quantity = 1; description = 'TESTE DIAGNÓSTICO'; unitPrice = 1000; total = 1000 })
    } | ConvertTo-Json -Depth 6
    
    $response = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8765/print-receipt" -ContentType "application/json" -Body $body -TimeoutSec 5
    
    if ($response.ok) {
        Write-Host "    ✓ Impressão enviada com sucesso!" -ForegroundColor Green
        Write-Host "      Se papel saiu com corte → TUDO FUNCIONANDO ✓" -ForegroundColor Green
        Write-Host "      Se papel NÃO saiu → Verifique impressora" -ForegroundColor Yellow
    } else {
        Write-Host "    ✗ Resposta inválida: $response" -ForegroundColor Red
    }
} catch {
    Write-Host "    ✗ Erro ao enviar: $_" -ForegroundColor Red
}

# 5. Verificar navegador console
Write-Host "`n[5] IMPORTANTE - Verificar Console do Navegador:" -ForegroundColor Yellow
Write-Host "    1. Abra o painel (F12 ou Ctrl+Shift+I)" -ForegroundColor Cyan
Write-Host "    2. Vá à aba 'Console'" -ForegroundColor Cyan
Write-Host "    3. Feche uma mesa e clique em 'Imprimir cupom'" -ForegroundColor Cyan
Write-Host "    4. Procure por mensagens '[PRINT]' ou erros" -ForegroundColor Cyan
Write-Host "    5. COPIE qualquer erro e envie para debug" -ForegroundColor Cyan

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "PRÓXIMOS PASSOS:" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "1. Se serviço não está rodando: npm run printer:service" -ForegroundColor Yellow
Write-Host "2. Abra console do navegador (F12)" -ForegroundColor Yellow
Write-Host "3. Teste 'Imprimir cupom' e procure por erros" -ForegroundColor Yellow
Write-Host "4. Se erro persistir, copie mensagem do console e envie" -ForegroundColor Yellow
