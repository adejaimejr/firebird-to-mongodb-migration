$WshShell = New-Object -comObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Scheduler Migração.lnk")
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = "`"$PSScriptRoot\run_scheduler.vbs`""
$Shortcut.WorkingDirectory = $PSScriptRoot
$Shortcut.IconLocation = "shell32.dll,46"  # Ícone de sincronização do Windows
$Shortcut.Save()

Write-Host "Atalho criado com sucesso na área de trabalho!"

# Criar atalho na pasta Startup para iniciar com o Windows
$StartupFolder = [Environment]::GetFolderPath('Startup')
$StartupShortcut = $WshShell.CreateShortcut("$StartupFolder\Scheduler Migração.lnk")
$StartupShortcut.TargetPath = "wscript.exe"
$StartupShortcut.Arguments = "`"$PSScriptRoot\run_scheduler.vbs`""
$StartupShortcut.WorkingDirectory = $PSScriptRoot
$StartupShortcut.IconLocation = "shell32.dll,46"
$StartupShortcut.Save()

Write-Host "Atalho criado com sucesso na pasta Startup!"
