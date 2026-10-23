using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

namespace EffectMaster {
    internal static class Installer {
        [DllImport("user32.dll",CharSet=CharSet.Unicode,SetLastError=true)]private static extern IntPtr SendMessageTimeout(IntPtr window,uint message,UIntPtr wparam,string lparam,uint flags,uint timeout,out UIntPtr result);
        internal static string Home {get{return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),"EffectMaster");}}
        internal static string Executable {get{return Path.Combine(Home,"Effect Master.exe");}}
        internal static string Install(){
            string config=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"EffectMaster");
            string panelDir=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"EffectCraft","Scripts","ScriptUI Panels");
            string panel=Path.Combine(panelDir,"Effect Master.jsx"),receipt=Path.Combine(config,"installation.json");
            Directory.CreateDirectory(Home);Directory.CreateDirectory(config);Directory.CreateDirectory(panelDir);
            string stamp=DateTime.Now.ToString("yyyyMMdd-HHmmss-fff"),backup=Path.Combine(config,"backups",stamp);Directory.CreateDirectory(backup);
            string previousVector=Environment.GetEnvironmentVariable("VECTORCRAFT_CONTROL_PORT",EnvironmentVariableTarget.User),previousEffect=Environment.GetEnvironmentVariable("EFFECTCRAFT_CONTROL_PORT",EnvironmentVariableTarget.User);
            if(File.Exists(panel))File.Copy(panel,Path.Combine(backup,"Effect Master.jsx"));
            var settings=new Preferences(config);int parsed;
            if(Int32.TryParse(previousVector,out parsed))settings.VectorPort=Preferences.Port(parsed,7979);
            if(Int32.TryParse(previousEffect,out parsed))settings.EffectPort=Preferences.Port(parsed,7978);
            if(settings.VectorPort==settings.EffectPort)throw new IOException("Both apps use the same connection port. Choose separate ports before setup.");
            string source=Application.ExecutablePath;
            if(!String.Equals(source,Executable,StringComparison.OrdinalIgnoreCase)){
                if(File.Exists(Executable))File.Copy(Executable,Path.Combine(backup,"Effect Master.exe"));
                File.Copy(source,Executable,true);
            }
            File.WriteAllText(panel,Bridge.Resource("EffectMaster.Panel").Replace("var defaultPort=7979;","var defaultPort="+settings.VectorPort+";"),new UTF8Encoding(false));
            settings.Save();
            if(!File.Exists(receipt))File.WriteAllText(receipt,Json.Write(new{version="0.4.0",installed=DateTime.UtcNow.ToString("o"),originalVectorPort=previousVector,originalEffectPort=previousEffect,vectorPort=settings.VectorPort,effectPort=settings.EffectPort,panelBackup=File.Exists(Path.Combine(backup,"Effect Master.jsx"))?Path.Combine(backup,"Effect Master.jsx"):null}),new UTF8Encoding(false));
            Environment.SetEnvironmentVariable("VECTORCRAFT_CONTROL_PORT",settings.VectorPort.ToString(),EnvironmentVariableTarget.User);
            Environment.SetEnvironmentVariable("EFFECTCRAFT_CONTROL_PORT",settings.EffectPort.ToString(),EnvironmentVariableTarget.User);
            Environment.SetEnvironmentVariable("VECTORCRAFT_CONTROL_PORT",settings.VectorPort.ToString());Environment.SetEnvironmentVariable("EFFECTCRAFT_CONTROL_PORT",settings.EffectPort.ToString());
            UIntPtr result;SendMessageTimeout(new IntPtr(0xffff),0x001a,UIntPtr.Zero,"Environment",2,3000,out result);
            Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),"Effect Master.lnk"));
            Shortcut(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs),"Effect Master.lnk"));
            File.WriteAllText(Path.Combine(Home,"Read me.txt"),"Effect Master 0.4.0\r\nOpen Effect Master from the desktop or Start menu. Open VectorCraft and EffectCraft normally.\r\nAfter first setup, save and restart both apps once. If Windows has not refreshed their connection settings, click their names in the palette to open them.\r\nAllow Scripts to Write Files and Access Network must be enabled in EffectCraft Settings > Scripting & Expressions.\r\nShift + Push creates a matching composition. Hover an icon for its action.\r\nA floating companion palette; neither official app executable is modified.\r\nThe optional EffectCraft dockable panel is under Window > Effect Master.jsx.\r\n");
            return Executable;
        }
        private static void Shortcut(string path){
            Type type=Type.GetTypeFromProgID("WScript.Shell");if(type==null)throw new IOException("Windows shortcut service is unavailable.");
            dynamic shell=Activator.CreateInstance(type);dynamic link=shell.CreateShortcut(path);
            link.TargetPath=Executable;link.WorkingDirectory=Home;link.Description="Effect Master — VectorCraft and EffectCraft";link.IconLocation=Executable;link.Save();
            Marshal.FinalReleaseComObject(link);Marshal.FinalReleaseComObject(shell);
        }
    }
    internal sealed class SetupForm:Form{
        internal SetupForm(){
            Text="Install Effect Master";Font=new Font("Segoe UI",10);ClientSize=new Size(480,290);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=MinimizeBox=false;StartPosition=FormStartPosition.CenterScreen;AutoScaleMode=AutoScaleMode.None;
            var info=new Label{Text="Effect Master\nFloating palette for VectorCraft ↔ EffectCraft",Font=new Font("Segoe UI",13,FontStyle.Bold),Bounds=new Rectangle(24,22,430,60)};Controls.Add(info);
            Controls.Add(new Label{Text="Installs the palette and an optional EffectCraft dockable panel. Enables the apps’ built-in local connections for your Windows account. Your official apps and their updates remain unchanged.\n\nSave and restart both apps once after setup. Enable file/network script access in EffectCraft.",Bounds=new Rectangle(24,94,430,130)});
            var install=new Button{Text="Install and open",Bounds=new Rectangle(300,240,155,32)};install.Click+=delegate{try{string exe=Installer.Install();Process.Start(new ProcessStartInfo(exe){UseShellExecute=false});Close();}catch(Exception e){MessageBox.Show(this,e.GetBaseException().Message,"Setup could not finish",MessageBoxButtons.OK,MessageBoxIcon.Error);}};Controls.Add(install);AcceptButton=install;Program.ScaleForDisplay(this);
        }
    }
}
