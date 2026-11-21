param([string]$Extension)

# Системный перечислитель ассоциаций Windows (SHAssocEnumHandlers) — тот же API,
# что использует меню «Открыть с помощью» проводника.
$ErrorActionPreference = 'SilentlyContinue'

$source = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class AssocHandlers
{
    [ComImport, Guid("973810ae-9599-4b88-9e4d-6ee98c9552da"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IEnumAssocHandlers
    {
        [PreserveSig]
        int Next(uint celt, out IntPtr rgelt, out uint pceltFetched);
        [PreserveSig]
        int Skip(uint celt);
        [PreserveSig]
        int Reset();
        [PreserveSig]
        int Clone(out IntPtr ppenum);
    }

    [ComImport, Guid("f04061ac-1659-4a3f-a954-775aa57fc083"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    private interface IAssocHandler
    {
        [PreserveSig]
        int GetName([MarshalAs(UnmanagedType.LPWStr)] out string ppsz);
        [PreserveSig]
        int GetUIName([MarshalAs(UnmanagedType.LPWStr)] out string ppsz);
        [PreserveSig]
        int GetIconLocation([MarshalAs(UnmanagedType.LPWStr)] out string ppszPath, out int pIndex);
        [PreserveSig]
        int IsRecommended();
        [PreserveSig]
        int MakeDefault([MarshalAs(UnmanagedType.LPWStr)] string pszDescription);
        [PreserveSig]
        int Invoke(IntPtr pdo);
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    private static extern void SHAssocEnumHandlers([MarshalAs(UnmanagedType.LPWStr)] string pszExtra, int filter, out IEnumAssocHandlers ppEnum);

    private static string Quote(string value)
    {
        if (value == null) return "\"\"";
        StringBuilder builder = new StringBuilder("\"");
        foreach (char symbol in value)
        {
            if (symbol == '\\') builder.Append("\\\\");
            else if (symbol == '"') builder.Append("\\\"");
            else if (symbol == '\r' || symbol == '\n' || symbol == '\t') builder.Append(' ');
            else builder.Append(symbol);
        }
        builder.Append('"');
        return builder.ToString();
    }

    public static string Dump(string extension)
    {
        IEnumAssocHandlers enumerator = null;
        try
        {
            SHAssocEnumHandlers(extension, 0, out enumerator);
        }
        catch
        {
            return "[]";
        }
        if (enumerator == null) return "[]";
        List<string> rows = new List<string>();
        HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        while (true)
        {
            IntPtr pointer;
            uint fetched;
            int hr = enumerator.Next(1, out pointer, out fetched);
            if (hr != 0 || fetched == 0 || pointer == IntPtr.Zero) break;
            object raw = null;
            try { raw = Marshal.GetObjectForIUnknown(pointer); } catch { raw = null; }
            IAssocHandler handler = raw as IAssocHandler;
            if (handler == null) break;
            string name = null;
            string uiName = null;
            string iconPath = null;
            int iconIndex = 0;
            if (handler.GetName(out name) != 0) name = null;
            if (handler.GetUIName(out uiName) != 0) uiName = null;
            if (handler.GetIconLocation(out iconPath, out iconIndex) != 0) iconPath = null;
            string display = string.IsNullOrEmpty(uiName) ? name : uiName;
            if (!string.IsNullOrEmpty(display) && seen.Add(display))
            {
                rows.Add("{\"name\":" + Quote(display) + ",\"command\":" + Quote(name ?? "") + ",\"iconPath\":" + Quote(iconPath ?? "") + ",\"iconIndex\":" + iconIndex + "}");
            }
        }
        return "[" + string.Join(",", rows) + "]";
    }
}
'@

try {
  Add-Type -TypeDefinition $source -Language CSharp -ErrorAction Stop
  [AssocHandlers]::Dump($Extension)
} catch {
  Write-Output '[]'
}
