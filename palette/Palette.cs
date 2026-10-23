using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace EffectMaster {
    internal sealed class IconButton : Button {
        internal string Glyph;
        internal bool Selected;
        internal Preferences Settings;
        private bool hover;
        internal IconButton(string glyph, Preferences settings) {
            Glyph = glyph; Settings = settings; FlatStyle = FlatStyle.Flat; FlatAppearance.BorderSize = 0;
            SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer, true);
            Cursor = Cursors.Hand; TabStop = true;
            MouseEnter += delegate { hover = true; Invalidate(); }; MouseLeave += delegate { hover = false; Invalidate(); };
        }
        internal static Color Accent(string name) {
            switch (name) { case "Lime": return Color.FromArgb(171,212,84); case "Blue": return Color.FromArgb(92,168,240); case "Violet": return Color.FromArgb(173,133,240); default: return Color.FromArgb(250,115,89); }
        }
        internal static GraphicsPath Rounded(RectangleF r, float radius) {
            var path = new GraphicsPath(); radius = Math.Min(radius, Math.Min(r.Width, r.Height)/2);
            if (radius <= 0) path.AddRectangle(r);
            else { float d = radius*2; path.AddArc(r.Left,r.Top,d,d,180,90);path.AddArc(r.Right-d,r.Top,d,d,270,90);path.AddArc(r.Right-d,r.Bottom-d,d,d,0,90);path.AddArc(r.Left,r.Bottom-d,d,d,90,90);path.CloseFigure(); }
            return path;
        }
        protected override void OnPaint(PaintEventArgs e) {
            Graphics g=e.Graphics; g.SmoothingMode=SmoothingMode.AntiAlias;
            Color accent=Accent(Settings.Accent),color=!Enabled?Color.FromArgb(85,89,96):(Selected||hover?accent:Color.FromArgb(212,217,224));
            using(var bg=new SolidBrush(hover?Color.FromArgb(37,40,45):Color.FromArgb(21,23,26)))
            using(var border=new Pen(Selected||hover?accent:Color.FromArgb(58,63,70)))
            using(var shape=Rounded(new RectangleF(1,1,Width-3,Height-3),Settings.Radius*(DeviceDpiScale()))) { g.FillPath(bg,shape);g.DrawPath(border,shape); }
            if(Focused)using(var p=new Pen(accent)){p.DashStyle=DashStyle.Dot;g.DrawRectangle(p,4,4,Width-9,Height-9);}
            var saved=g.Save();g.TranslateTransform(Width/2f,Height/2f);float scale=Math.Min(Width,Height)/(Height>50*DeviceDpiScale()?43f:34f);g.ScaleTransform(scale,scale);
            using(var pen=new Pen(color,1.55f))using(var brush=new SolidBrush(color)) {
                pen.StartCap=pen.EndCap=LineCap.Round;pen.LineJoin=LineJoin.Round;
                if(Glyph=="push"||Glyph=="pull"||Glyph=="copyToEffect"||Glyph=="copyToVector"){
                    float d=Glyph=="push"||Glyph=="copyToEffect"?-1:1;
                    g.FillPolygon(brush,new[]{new PointF(-3,-8*d),new PointF(3,-8*d),new PointF(3,0),new PointF(8,0),new PointF(0,8*d),new PointF(-8,0),new PointF(-3,0)});
                    Lines(g,pen,new[]{-9f,8*d,-9,11*d,9,11*d,9,8*d});
                    if(Glyph.StartsWith("copy")){g.DrawLine(pen,7,-8,13,-8);g.DrawLine(pen,10,-11,10,-5);}
                }else if(Glyph=="normal"){g.DrawRectangle(pen,-8,-7,12,12);g.DrawRectangle(pen,-3,-2,12,12);}
                else if(Glyph=="split"){foreach(int x in new[]{-9,2})foreach(int y in new[]{-8,3})g.DrawRectangle(pen,x,y,7,7);}
                else if(Glyph=="combine"||Glyph=="new"){g.DrawRectangle(pen,-9,-7,18,14);g.DrawLine(pen,-4,0,4,0);g.DrawLine(pen,0,-4,0,4);}
                else if(Glyph=="center"){g.DrawRectangle(pen,-7,-7,14,14);g.DrawLine(pen,-11,0,11,0);g.DrawLine(pen,0,-11,0,11);}
                else if(Glyph=="raster"){g.DrawRectangle(pen,-9,-9,18,18);Lines(g,pen,new[]{-8f,6,-2,-1,2,3,6,-3,9,2});g.FillEllipse(brush,-6,-6,3,3);}
                else if(Glyph=="update"){g.DrawArc(pen,-8,-8,16,16,200,270);Lines(g,pen,new[]{-9f,-7,-8,-2,-3,-4});}
                else if(Glyph=="precomp"){g.DrawRectangle(pen,-9,-8,18,16);g.DrawRectangle(pen,-4,-4,8,8);}
                else if(Glyph=="decomp"){Lines(g,pen,new[]{-9f,-2,-9,-8,-3,-8});Lines(g,pen,new[]{3f,-8,9,-8,9,-2});Lines(g,pen,new[]{9f,2,9,8,3,8});Lines(g,pen,new[]{-3f,8,-9,8,-9,2});g.DrawRectangle(pen,-3,-3,6,6);}
                else if(Glyph=="eye"){Lines(g,pen,new[]{-10f,0,-5,-5,0,-6,5,-5,10,0,5,5,0,6,-5,5,-10,0});g.DrawEllipse(pen,-2,-2,4,4);}
                else if(Glyph=="trash"){Lines(g,pen,new[]{-5f,-4,-4,9,4,9,5,-4});g.DrawLine(pen,-8,-6,8,-6);g.DrawLine(pen,-3,-9,3,-9);}
                else if(Glyph=="all"){g.DrawRectangle(pen,-8,-9,12,14);Lines(g,pen,new[]{-4f,9,8,9,8,-5});}
                else if(Glyph=="swatches"){for(int i=-9;i<=3;i+=6)g.DrawRectangle(pen,i,-7,6,14);}
                else if(Glyph=="guides"){g.DrawLine(pen,-8,-10,-8,10);g.DrawLine(pen,-11,-6,11,-6);g.DrawRectangle(pen,-3,1,10,7);}
                else if(Glyph=="menu"){for(int i=-1;i<=1;i++)g.DrawLine(pen,-6,i*4,6,i*4);}
                else if(Glyph=="close"){g.DrawLine(pen,-5,-5,5,5);g.DrawLine(pen,-5,5,5,-5);}
                else if(Glyph=="pin"){Lines(g,pen,new[]{-5f,-8,5,-8,4,-2,7,2,-7,2,-4,-2,-5,-8});g.DrawLine(pen,0,2,0,10);}
                else if(Glyph=="connect"){Lines(g,pen,new[]{-9f,0,-5,-5,0,-5,4,-1});Lines(g,pen,new[]{-4f,1,0,5,5,5,9,0});g.DrawLine(pen,-4,3,4,-3);}
                else if(Glyph=="link"||Glyph=="unlink"){g.DrawEllipse(pen,-10,-4,13,8);g.DrawEllipse(pen,-3,-4,13,8);if(Glyph=="unlink")g.DrawLine(pen,-8,9,8,-9);}
            }g.Restore(saved);
        }
        private float DeviceDpiScale(){using(var g=CreateGraphics())return g.DpiX/96f;}
        private static void Lines(Graphics g,Pen p,float[] xy){var points=new PointF[xy.Length/2];for(int i=0;i<points.Length;i++)points[i]=new PointF(xy[i*2],xy[i*2+1]);g.DrawLines(p,points);}
    }
    internal sealed class Palette : Form {
        [DllImport("user32.dll")]private static extern bool ReleaseCapture();
        [DllImport("user32.dll")]private static extern IntPtr SendMessage(IntPtr window,int message,IntPtr wparam,IntPtr lparam);
        internal readonly Preferences Settings;
        private readonly Bridge bridge;
        private readonly ToolTip tips=new ToolTip { AutoPopDelay=20000,InitialDelay=350,ReshowDelay=100 };
        private readonly Dictionary<string,IconButton> buttons=new Dictionary<string,IconButton>();
        private readonly Label vector=new Label(),effect=new Label(),status=new Label();
        private readonly Button vectorTab=new Button(),effectTab=new Button();
        private Label contextSection;
        private readonly System.Windows.Forms.Timer timer=new System.Windows.Forms.Timer { Interval=1800 };
        private ConnectionState state=new ConnectionState();
        private bool busy,checking,closing,failed;
        internal string LastMessage="Open both apps. Select artwork, then push.";
        internal Palette(Preferences settings) {
            Settings=settings;bridge=new Bridge(settings);
            AutoScaleMode=AutoScaleMode.None;Font=new Font("Segoe UI",9f);
            Text="Effect Master";BackColor=Color.FromArgb(27,29,33);ForeColor=Color.FromArgb(213,218,224);
            FormBorderStyle=FormBorderStyle.None;MaximizeBox=false;ClientSize=new Size(292,448);TopMost=Settings.Pinned;ShowInTaskbar=true;
            StartPosition=FormStartPosition.Manual;
            var screen=Screen.PrimaryScreen.WorkingArea;
            Location=new Point(Settings.Left<0?screen.Right-Width-45:Settings.Left,Settings.Top<0?screen.Top+115:Settings.Top);
            bool visible=false;foreach(Screen monitor in Screen.AllScreens)if(monitor.WorkingArea.IntersectsWith(new Rectangle(Location,Size)))visible=true;
            if(!visible)Location=new Point(screen.Left+60,screen.Top+60);
            var title=new Label {Text="Effect Master",Font=new Font("Segoe UI",12f,FontStyle.Bold),Bounds=new Rectangle(14,12,176,25)};Controls.Add(title);
            title.MouseDown+=delegate(object sender,MouseEventArgs e){if(e.Button==MouseButtons.Left){ReleaseCapture();SendMessage(Handle,0x00a1,new IntPtr(2),IntPtr.Zero);}};
            Add("pin","pin","Keep palette above other windows",194,10,26,26,delegate{Settings.Pinned=!Settings.Pinned;TopMost=Settings.Pinned;Save();RefreshButtons();});
            Add("menu","menu","Settings and connection help",224,10,26,26,ShowSettings);
            Add("close","close","Close Effect Master",254,10,26,26,Close);
            vector.SetBounds(14,45,231,18);effect.SetBounds(14,64,231,18);vector.AutoEllipsis=effect.AutoEllipsis=true;Controls.Add(vector);Controls.Add(effect);
            Add("connect","connect","Check connections; click an app name to open it",254,49,26,27,async delegate{await Check();if(!state.Vector||!state.Effect)ShowConnections();});
            vector.Cursor=effect.Cursor=Cursors.Hand;vector.Click+=delegate{OpenApp(true);};effect.Click+=delegate{OpenApp(false);};
            vectorTab.Text="VectorCraft";effectTab.Text="EffectCraft";vectorTab.SetBounds(14,91,130,27);effectTab.SetBounds(148,91,130,27);
            foreach(var tab in new[]{vectorTab,effectTab}){tab.FlatStyle=FlatStyle.Flat;tab.FlatAppearance.BorderSize=0;tab.Cursor=Cursors.Hand;Controls.Add(tab);}
            vectorTab.Click+=delegate{Settings.View="vector";Save();RefreshButtons();};effectTab.Click+=delegate{Settings.View="effect";Save();RefreshButtons();};
            Add("push","push","Send to EffectCraft: update linked objects, create new ones. Shift: new composition.",14,128,84,59,()=>Run("toEffectCraft",(ModifierKeys&Keys.Shift)!=0));
            Add("pull","pull","Send to VectorCraft: update linked design geometry and paints. Layer animation stays in EffectCraft.",104,128,84,59,()=>Run("toVectorCraft",false));
            Add("raster","raster","Rasterize VectorCraft selection as a transparent 2× PNG",194,128,84,59,()=>Run("raster",false));
            string[] modes={"normal","split","combine"};string[] modeTips={"Normal: keep vector groups together","Split: create separate layers and group parents","Combine: merge selected vectors into one shape layer"};
            for(int i=0;i<3;i++){string mode=modes[i];Add(mode,mode,modeTips[i],14+i*54,195,48,33,()=>{Settings.Mode=mode;Save();RefreshButtons();});}
            Add("center","center","Center new artwork in the composition; linked animation is preserved",176,195,48,33,delegate{Settings.Center=!Settings.Center;Save();RefreshButtons();});
            Add("update","update","Update properties: select EC geometry, fill, stroke, or shape groups. Animated properties get a key at the playhead.",230,195,48,33,()=>Run("update",false));
            Section("LINKS / COPIES",239);
            Add("link","link","Link existing pair: select exactly one object in VectorCraft and one matching layer in EffectCraft",14,257,60,33,()=>Run("link",false));
            Add("unlink","unlink","Unlink the selected objects in the active palette tab",82,257,60,33,()=>Run(Settings.View=="vector"?"unlinkVector":"unlink",false));
            Add("copyToEffect","copyToEffect","Send new copies to EffectCraft, leaving existing links unchanged",150,257,60,33,()=>Run("copyToEffect",false));
            Add("copyToVector","copyToVector","Send new copies to VectorCraft with the current animated pose",218,257,60,33,()=>Run("copyToVector",false));
            contextSection=Section("ARTBOARD",303);
            Row(new[]{"precomp","decomp","eye","trash"},new[]{"Precompose EffectCraft selection and descendants","Decompose a compatible precomposition","Hide or show Effect Master groups in the timeline","Release selected Effect Master groups"},321);
            Row(new[]{"new","all","swatches","guides"},new[]{"Create a matching composition","Send all visible artwork, updating linked objects","Transfer RGB document swatches","Transfer visible ruler guides"},321);
            status.SetBounds(14,369,264,49);status.Font=new Font("Segoe UI",8.5f);status.Cursor=Cursors.Hand;status.Click+=delegate{MessageBox.Show(this,LastMessage,"Effect Master",MessageBoxButtons.OK,failed?MessageBoxIcon.Warning:MessageBoxIcon.Information);};Controls.Add(status);
            var footer=new Label {Text="EFFECT MASTER 0.4 · LINKED TRANSFERS",Bounds=new Rectangle(14,425,264,15),Font=new Font("Segoe UI",7.5f),ForeColor=Color.FromArgb(115,124,136)};Controls.Add(footer);
            timer.Tick+=async delegate{await Check();};Shown+=async delegate{RefreshButtons();SetStatus(LastMessage,false);timer.Start();await Check();};
            FormClosing+=delegate(object sender,FormClosingEventArgs e){if(busy){e.Cancel=true;SetStatus("A transfer is running. Wait for its result before closing.",true);return;}closing=true;timer.Stop();Settings.Left=Left;Settings.Top=Top;try{Settings.Save();}catch{/* Closing must remain possible if preferences cannot be written. */}};
            Icon=MakeIcon();Program.ScaleForDisplay(this);
            if(Settings.Left<0)Left=screen.Right-Width-45;
            var area=Screen.FromPoint(Location).WorkingArea;Left=Math.Max(area.Left,Math.Min(Left,area.Right-Width));Top=Math.Max(area.Top,Math.Min(Top,area.Bottom-Height));
            Paint+=delegate(object sender,PaintEventArgs e){using(var pen=new Pen(Color.FromArgb(67,73,82)))e.Graphics.DrawRectangle(pen,0,0,ClientSize.Width-1,ClientSize.Height-1);};
        }
        private static Icon MakeIcon(){using(var b=new Bitmap(32,32)){using(var g=Graphics.FromImage(b)){g.Clear(Color.FromArgb(27,29,33));using(var pen=new Pen(Color.FromArgb(250,115,89),4)){g.DrawLines(pen,new[]{new Point(23,7),new Point(9,7),new Point(9,25),new Point(23,25)});g.DrawLine(pen,9,16,21,16);}}return Icon.FromHandle(b.GetHicon());}}
        private Label Section(string text,int y){var label=new Label {Text=text,Bounds=new Rectangle(14,y,264,14),Font=new Font("Segoe UI",7.5f),ForeColor=Color.FromArgb(121,132,146)};Controls.Add(label);return label;}
        private void Row(string[] ids,string[] labels,int y){for(int i=0;i<ids.Length;i++){string id=ids[i];Add(id,id,labels[i],14+i*68,y,60,33,()=>Run(id,false));}}
        private void Add(string id,string glyph,string tip,int x,int y,int w,int h,Action click){var b=new IconButton(glyph,Settings){Name=id,AccessibleName=tip,Bounds=new Rectangle(x,y,w,h)};b.Click+=delegate{click();};tips.SetToolTip(b,tip);buttons.Add(id,b);Controls.Add(b);}
        private void Save(){try{Settings.Save();}catch(Exception e){SetStatus("Settings could not be saved: "+e.Message,true);}}
        private void RefreshButtons(){foreach(var entry in buttons){var b=entry.Value;b.Selected=entry.Key==Settings.Mode||entry.Key==(Settings.View=="vector"?"push":"pull")||(entry.Key=="center"&&Settings.Center)||(entry.Key=="pin"&&Settings.Pinned);b.Enabled=!busy;b.Invalidate();}bool vc=Settings.View=="vector";foreach(string id in new[]{"new","all","swatches","guides"})buttons[id].Visible=vc;foreach(string id in new[]{"precomp","decomp","eye","trash"})buttons[id].Visible=!vc;contextSection.Text=vc?"ARTBOARD":"GROUPS";vectorTab.ForeColor=vc?IconButton.Accent(Settings.Accent):ForeColor;effectTab.ForeColor=vc?ForeColor:IconButton.Accent(Settings.Accent);vectorTab.Enabled=effectTab.Enabled=!busy;}
        internal void SetStatus(string text,bool error){LastMessage=text;failed=error;status.Text=text;status.ForeColor=error?IconButton.Accent(Settings.Accent):Color.FromArgb(148,158,172);tips.SetToolTip(status,text);}
        internal async Task Check(){
            if(checking||busy||closing)return;checking=true;
            try{state=await Task.Run(()=>bridge.Inspect());if(closing)return;
                vector.Text="●  VectorCraft · "+state.Document;effect.Text="●  EffectCraft · "+state.Composition;
                vector.ForeColor=state.Vector?Color.FromArgb(182,195,186):Color.FromArgb(142,150,164);effect.ForeColor=state.Effect?Color.FromArgb(182,195,186):Color.FromArgb(142,150,164);
                tips.SetToolTip(vector,state.Vector?state.Document:"Click to open VectorCraft. If already running, save and restart it once after setup.");tips.SetToolTip(effect,state.Effect?state.Composition:"Click to open EffectCraft. If already running, save and restart it once after setup.");
            }finally{checking=false;}
        }
        internal async void Run(string action,bool newComp){
            if(busy)return;busy=true;RefreshButtons();SetStatus("Transferring…",false);
            try{SetStatus(await Task.Run(()=>bridge.Execute(action,newComp)),false);}catch(Exception e){SetStatus(e.GetBaseException().Message,true);}
            finally{busy=false;RefreshButtons();}
            await Check();
        }
        private void ShowSettings(){using(var dialog=new SettingsDialog(Settings)){if(dialog.ShowDialog(this)==DialogResult.OK){TopMost=Settings.Pinned;Save();RefreshButtons();SetStatus("Settings saved.",false);}}}
        private void ShowConnections(){MessageBox.Show(this,"Open both apps normally, then use the arrows.\n\nAfter installing Effect Master, save your work and restart each app once so its connection setting takes effect. Click an app name in this palette to open it.\n\nIn EffectCraft, enable Settings → Scripting & Expressions → Allow Scripts to Write Files and Access Network.\n\nYour official app executables and updates are unchanged.","Connecting Effect Master",MessageBoxButtons.OK,MessageBoxIcon.Information);}
        private void OpenApp(bool isVector){
            string name=isVector?"VectorCraft":"EffectCraft",processName=isVector?"vectorcraft":"effectcraft";
            try{
                if(Process.GetProcessesByName(processName).Length>0){if(!(isVector?state.Vector:state.Effect))SetStatus("Save your work and restart "+name+" once to enable its connection.",true);return;}
                string exe=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),name,processName+".exe");
                if(!File.Exists(exe))throw new IOException(name+" was not found in Program Files.");
                var start=new ProcessStartInfo(exe){UseShellExecute=false};start.EnvironmentVariables[isVector?"VECTORCRAFT_CONTROL_PORT":"EFFECTCRAFT_CONTROL_PORT"]=(isVector?Settings.VectorPort:Settings.EffectPort).ToString();
                Process.Start(start);SetStatus("Opening "+name+"…",false);
            }catch(Exception e){SetStatus(e.Message,true);}
        }
        internal object TestStatus(){var visible=new List<string>();foreach(var b in buttons)if(b.Value.Visible)visible.Add(b.Key);return new{busy=busy,message=LastMessage,error=failed,vector=state.Vector,effect=state.Effect,document=state.Document,composition=state.Composition,mode=Settings.Mode,center=Settings.Center,view=Settings.View,visibleActions=visible};}
        internal void TestClick(string id){if(id=="vectorView"){vectorTab.PerformClick();return;}if(id=="effectView"){effectTab.PerformClick();return;}IconButton b;if(!buttons.TryGetValue(id,out b))throw new ArgumentException("Unknown button");b.PerformClick();}
    }
    internal sealed class SettingsDialog : Form {
        internal SettingsDialog(Preferences settings){
            Text="Effect Master settings";Font=new Font("Segoe UI",9);AutoScaleMode=AutoScaleMode.None;ClientSize=new Size(430,350);FormBorderStyle=FormBorderStyle.FixedDialog;MaximizeBox=MinimizeBox=false;StartPosition=FormStartPosition.CenterParent;
            var accent=new ComboBox {DropDownStyle=ComboBoxStyle.DropDownList};accent.Items.AddRange(new object[]{"Coral","Lime","Blue","Violet"});accent.SelectedItem=settings.Accent;Field("Accent",accent,20);
            var radius=new NumericUpDown {Minimum=0,Maximum=16,Value=settings.Radius};Field("Button roundness",radius,55);
            var board=new NumericUpDown {Minimum=0,Maximum=10000,Value=settings.Artboard+1};Field("Artboard (0 = active)",board,90);
            var fps=new NumericUpDown {Minimum=1,Maximum=120,Value=settings.Fps};Field("New composition FPS",fps,125);
            var duration=new NumericUpDown {Minimum=0.1m,Maximum=10800,DecimalPlaces=1,Value=(decimal)settings.Duration};Field("Duration in seconds",duration,160);
            var folder=new TextBox {Text=settings.AssetFolder};Field("Image folder (optional)",folder,195);
            var hint=new Label{Text="Blank: assets beside a saved project, or in Documents / Effect Master Assets.\nShift + Push creates a matching composition.\nHover any icon to see its action.",Bounds=new Rectangle(20,230,390,65)};Controls.Add(hint);
            var save=new Button {Text="Save",Bounds=new Rectangle(244,307,78,28)};var cancel=new Button {Text="Cancel",DialogResult=DialogResult.Cancel,Bounds=new Rectangle(330,307,78,28)};
            save.Click+=delegate{settings.Accent=(string)accent.SelectedItem;settings.Radius=(int)radius.Value;settings.Artboard=(int)board.Value-1;settings.Fps=(int)fps.Value;settings.Duration=(double)duration.Value;settings.AssetFolder=folder.Text.Trim();DialogResult=DialogResult.OK;};Controls.Add(save);Controls.Add(cancel);AcceptButton=save;CancelButton=cancel;Program.ScaleForDisplay(this);
        }
        private void Field(string label,Control field,int y){Controls.Add(new Label {Text=label,Bounds=new Rectangle(20,y+4,175,23)});field.SetBounds(200,y,208,26);Controls.Add(field);}
    }
}
