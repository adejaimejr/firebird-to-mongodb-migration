# Requer privilégios de administrador
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "Execute o script como Administrador!"
    Break
}

# Configurações da tarefa
$taskName = "FirebirdToMongoMigration"
$taskDescription = "Executa a migração do Firebird para MongoDB a cada 1 hora"
$scriptPath = Join-Path $PSScriptRoot "run_migration.bat"
$workingDir = $PSScriptRoot

# Verificar se o arquivo existe
if (-NOT (Test-Path $scriptPath)) {
    Write-Error "Arquivo $scriptPath não encontrado!"
    Break
}

# Criar diretório de logs
$logDir = Join-Path $workingDir "logs"
if (-NOT (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir | Out-Null
    Write-Host "Diretório de logs criado: $logDir" -ForegroundColor Green
}

# Remover tarefa existente se houver
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Removendo tarefa existente..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Obter o caminho do Python
$pythonPath = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-NOT $pythonPath) {
    Write-Error "Python não encontrado no PATH do sistema!"
    Break
}

Write-Host "Python encontrado em: $pythonPath" -ForegroundColor Green

try {
    # Criar a ação
    $action = New-ScheduledTaskAction -Execute $scriptPath `
                                    -WorkingDirectory $workingDir

    # Criar o gatilho (a cada 1 hora)
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)

    # Configurações principais
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

    # Configurações adicionais
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew `
                                           -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
                                           -RestartCount 3 `
                                           -RestartInterval (New-TimeSpan -Minutes 1) `
                                           -AllowStartIfOnBatteries `
                                           -DontStopIfGoingOnBatteries `
                                           -StartWhenAvailable

    # Registrar a tarefa
    $task = Register-ScheduledTask -TaskName $taskName `
                                  -Description $taskDescription `
                                  -Action $action `
                                  -Trigger $trigger `
                                  -Principal $principal `
                                  -Settings $settings `
                                  -Force

    Write-Host "`nTarefa agendada criada com sucesso!" -ForegroundColor Green
    Write-Host "Nome da tarefa: $taskName" -ForegroundColor Green
    Write-Host "Executando a cada: 1 hora" -ForegroundColor Green
    Write-Host "Caminho do script: $scriptPath" -ForegroundColor Green
    Write-Host "Diretório de trabalho: $workingDir" -ForegroundColor Green
    Write-Host "Logs em: $logDir" -ForegroundColor Green
    
    # Executar a tarefa imediatamente
    Write-Host "`nIniciando primeira execução..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $taskName
    
    # Aguardar um pouco e verificar o status
    Start-Sleep -Seconds 10
    $taskInfo = Get-ScheduledTaskInfo -TaskName $taskName
    Write-Host "`nStatus da tarefa:" -ForegroundColor Cyan
    Write-Host "Última execução: $($taskInfo.LastRunTime)" -ForegroundColor Cyan
    Write-Host "Próxima execução: $($taskInfo.NextRunTime)" -ForegroundColor Cyan
    Write-Host "Último resultado: $($taskInfo.LastTaskResult)" -ForegroundColor Cyan
    
    Write-Host "`nVerifique os logs em: $logDir" -ForegroundColor Yellow
    
} catch {
    Write-Error "Erro ao criar tarefa: $_"
}
