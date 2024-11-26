# Requer privilégios de administrador
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "Execute o script como Administrador!"
    Break
}

# Configurações da tarefa
$taskName = "FirebirdToMongoMigration"
$taskDescription = "Executa a migração do Firebird para MongoDB a cada 1 hora"
$scriptPath = Join-Path $PSScriptRoot "run_migration.bat"

# Criar a ação
$action = New-ScheduledTaskAction -Execute $scriptPath

# Criar o gatilho (a cada 1 hora)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 1)

# Configurações principais
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

# Configurações adicionais
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Registrar a tarefa
Register-ScheduledTask -TaskName $taskName `
                      -Description $taskDescription `
                      -Action $action `
                      -Trigger $trigger `
                      -Principal $principal `
                      -Settings $settings `
                      -Force

Write-Host "Tarefa agendada criada com sucesso!"
Write-Host "Nome da tarefa: $taskName"
Write-Host "Executando a cada: 1 hora"
Write-Host "Caminho do script: $scriptPath"
