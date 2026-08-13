Set fso      = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

' Working directory = folder containing this script
strDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = strDir

Dim pythonExe
pythonExe = strDir & "\.venv\Scripts\pythonw.exe"

' Fall back to system python if venv not found
If Not fso.FileExists(pythonExe) Then
    pythonExe = "pythonw"
End If

' Launch backend/app.py silently (0 = hidden window, False = don't wait)
WshShell.Run """" & pythonExe & """ """ & strDir & "\backend\app.py""", 0, False
