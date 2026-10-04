Set sh = CreateObject("WScript.Shell")
base = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
sh.Run "cmd /c cd /d """ & base & """ && python bridge.py >> bridge.log 2>&1", 0, False
