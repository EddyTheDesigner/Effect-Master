using System;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace EffectMaster {
    internal static class Program {
        [DllImport("user32.dll")] private static extern bool SetProcessDPIAware();
        [STAThread] private static int Main(string[] args) {
            Application.EnableVisualStyles();Application.SetCompatibleTextRenderingDefault(false);SetProcessDPIAware();
            try {
                if(Array.IndexOf(args,"--install")>=0||Path.GetFileName(Application.ExecutablePath).StartsWith("Setup ",StringComparison.OrdinalIgnoreCase)) {
                    if(Array.IndexOf(args,"--quiet")>=0){Installer.Install();return 0;}
                    Application.Run(new SetupForm());return 0;
                }
                string profile=Arg(args,"--profile",Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),"EffectMaster"));
                var settings=new Preferences(profile);
                int port; if(Int32.TryParse(Arg(args,"--vector-port",""),out port))settings.VectorPort=Preferences.Port(port,7979);
                if(Int32.TryParse(Arg(args,"--effect-port",""),out port))settings.EffectPort=Preferences.Port(port,7978);
                bool test=Int32.TryParse(Arg(args,"--test-port",""),out port);
                bool created;
                using(var instance=new Mutex(true,"Local\\EffectMasterPalette"+(test?port.ToString():""),out created)) {
                    if(!created){MessageBox.Show("Effect Master is already open. Use its taskbar button to show the palette.","Effect Master");return 0;}
                    using(var form=new Palette(settings)) {
                        if(test)StartTestControl(form,port);
                        Application.Run(form);
                    }
                }
                return 0;
            }catch(Exception e){
                if(Array.IndexOf(args,"--quiet")<0)MessageBox.Show(e.GetBaseException().Message,"Effect Master",MessageBoxButtons.OK,MessageBoxIcon.Error);
                try{File.WriteAllText(Path.Combine(Path.GetTempPath(),"EffectMaster-setup-error.txt"),e.ToString());}catch{}
                return 1;
            }
        }
        private static string Arg(string[] args,string key,string fallback){int i=Array.IndexOf(args,key);return i>=0&&i+1<args.Length?args[i+1]:fallback;}
        internal static void ScaleForDisplay(Form form){using(var graphics=form.CreateGraphics()){float scale=graphics.DpiX/96f;if(Math.Abs(scale-1)>0.01f)form.Scale(new SizeF(scale,scale));}}
        // Off in every normal launch. Allows deterministic tests of the real WinForms buttons,
        // state and rendering without touching or automating the user's app instances.
        private static void StartTestControl(Palette form,int port){
            var listener=new TcpListener(IPAddress.Loopback,port);listener.Start();
            form.FormClosed+=delegate{listener.Stop();};
            var thread=new Thread(delegate(){
                for(;;){
                    TcpClient client;try{client=listener.AcceptTcpClient();}catch{return;}
                    ThreadPool.QueueUserWorkItem(delegate{
                        using(client){client.ReceiveTimeout=3000;client.SendTimeout=3000;
                            try{using(var stream=client.GetStream())using(var reader=new StreamReader(stream,Encoding.UTF8,false,4096,true))using(var writer=new StreamWriter(stream,new UTF8Encoding(false),4096,true)){
                                string line=reader.ReadLine();if(line==null||line.Length>8192)return;object r=Json.Read(line),id=Json.Get(r,"id"),p=Json.Get(r,"params");
                                try{
                                    object result=form.Invoke(new Func<object>(delegate{
                                        switch(Json.Text(r,"method")){
                                            case "test.status":return form.TestStatus();
                                            case "test.click":form.TestClick(Json.Text(p,"id"));return new{clicked=true};
                                            case "test.screenshot":using(var image=new Bitmap(form.Width,form.Height)){form.DrawToBitmap(image,new Rectangle(Point.Empty,form.Size));using(var bytes=new MemoryStream()){image.Save(bytes,System.Drawing.Imaging.ImageFormat.Png);return new{pngBase64=Convert.ToBase64String(bytes.ToArray())};}}
                                            case "test.close":form.BeginInvoke(new Action(form.Close));return new{closing=true};
                                            default:throw new InvalidOperationException("Unknown test method");
                                        }
                                    }));writer.WriteLine(Json.Write(new{id=id,ok=true,result=result}));
                                }catch(Exception e){writer.WriteLine(Json.Write(new{id=id,ok=false,error=e.GetBaseException().Message}));}writer.Flush();
                            }}catch{/* A test client may disconnect while the test window closes. */}
                        }
                    });
                }
            });thread.IsBackground=true;thread.Start();
        }
    }
}
