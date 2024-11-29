Set WShell = CreateObject("WScript.Shell")
strPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
strCommand = "cmd /c python scheduler.py"
WShell.CurrentDirectory = strPath
WShell.Run strCommand, 0, False
