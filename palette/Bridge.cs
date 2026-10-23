using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Sockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;

namespace EffectMaster {
    internal static class Json {
        internal static string Write(object value) { return new JavaScriptSerializer { MaxJsonLength = 33554432, RecursionLimit = 128 }.Serialize(value); }
        internal static object Read(string value) { return new JavaScriptSerializer { MaxJsonLength = 33554432, RecursionLimit = 128 }.DeserializeObject(value); }
        internal static Dictionary<string, object> Map(object value) { return value as Dictionary<string, object> ?? new Dictionary<string, object>(); }
        internal static object Get(object value, string key) { object result; return Map(value).TryGetValue(key, out result) ? result : null; }
        internal static string Text(object value, string key, string fallback = "") { object v = Get(value, key); return v == null ? fallback : Convert.ToString(v); }
        internal static bool Flag(object value, string key) { return Get(value, key) is bool && (bool)Get(value, key); }
        internal static int Number(object value, string key, int fallback) { int n; return Int32.TryParse(Text(value, key), out n) ? n : fallback; }
    }
    internal static class Rpc {
        private static int serial;
        internal static object Call(int port, string method, object parameters, int timeout = 2500) {
            using (var client = new TcpClient()) {
                var pending = client.ConnectAsync("127.0.0.1", port);
                if (!pending.Wait(1800)) throw new IOException("The app did not answer. Open it and check its connection.");
                client.ReceiveTimeout = timeout; client.SendTimeout = 5000;
                using (var stream = client.GetStream())
                using (var writer = new StreamWriter(stream, new UTF8Encoding(false), 8192, true))
                using (var reader = new StreamReader(stream, Encoding.UTF8, false, 8192, true)) {
                    int id = Interlocked.Increment(ref serial);
                    writer.WriteLine(Json.Write(new { id = id, method = method, @params = parameters })); writer.Flush();
                    var line = new StringBuilder();
                    for (;;) { int ch = reader.Read(); if (ch < 0) throw new IOException("Connection closed before a reply. Check the app before retrying."); if (ch == '\n') break; if (line.Length >= 33554432) throw new IOException("The reply is too large."); line.Append((char)ch); }
                    object reply = Json.Read(line.ToString());
                    if (Json.Number(reply, "id", -1) != id) throw new IOException("Unexpected reply from the application.");
                    if (!Json.Flag(reply, "ok")) throw new IOException(Json.Text(reply, "error", "Application rejected the operation."));
                    return Json.Get(reply, "result");
                }
            }
        }
        internal static object Command(int port, string command, object parameters, int timeout = 2500) { return Call(port, "engine.execute", new { command = command, @params = parameters }, timeout); }
    }
    internal sealed class Preferences {
        internal string DirectoryPath;
        internal int VectorPort = 7979, EffectPort = 7978, Radius = 8, Artboard = -1, Fps = 30;
        internal double Duration = 10;
        internal string Accent = "Coral", Mode = "normal", AssetFolder = "", View = "vector";
        internal bool Center, Pinned = true;
        internal int Left = -1, Top = -1;
        internal Preferences(string folder) { DirectoryPath = folder; Load(); }
        internal string FilePath { get { return Path.Combine(DirectoryPath, "settings.json"); } }
        internal void Load() {
            if (!File.Exists(FilePath)) return;
            try {
                object d = Json.Read(File.ReadAllText(FilePath));
                VectorPort = Port(Json.Number(d, "vectorPort", 7979), 7979); EffectPort = Port(Json.Number(d, "effectPort", 7978), 7978);
                Radius = Math.Max(0, Math.Min(16, Json.Number(d, "roundness", 8)));
                string accent = Json.Text(d, "accent", "Coral"); if (Array.IndexOf(new[] { "Coral", "Lime", "Blue", "Violet" }, accent) >= 0) Accent = accent;
                string mode = Json.Text(d, "mode", "normal"); if (Array.IndexOf(new[] { "normal", "split", "combine" }, mode) >= 0) Mode = mode;
                Center = Json.Flag(d, "center"); Pinned = Json.Get(d, "pinned") == null || Json.Flag(d, "pinned");
                View = Json.Text(d,"view")=="effect"?"effect":"vector";
                Artboard = Math.Max(-1, Math.Min(9999, Json.Number(d, "artboard", -1))); Fps = Math.Max(1, Math.Min(120, Json.Number(d, "fps", 30)));
                double duration; if (Double.TryParse(Json.Text(d, "duration"), System.Globalization.NumberStyles.Float, System.Globalization.CultureInfo.InvariantCulture, out duration) && duration > 0 && duration <= 10800) Duration = duration;
                AssetFolder = Json.Text(d, "assetFolder"); Left = Json.Number(d, "left", -1); Top = Json.Number(d, "top", -1);
            } catch { /* A damaged optional palette preference file uses safe defaults. */ }
        }
        internal static int Port(int n, int fallback) { return n >= 1024 && n <= 65535 ? n : fallback; }
        internal object Data() { return new { version = 4, view = View, vectorPort = VectorPort, effectPort = EffectPort, accent = Accent, roundness = Radius, mode = Mode, center = Center, artboard = Artboard, fps = Fps, duration = Duration, assetFolder = AssetFolder, pinned = Pinned, left = Left, top = Top }; }
        internal object Transfer(bool newComp) { return new { port = VectorPort, mode = Mode, center = Center, artboard = Artboard, fps = Fps, duration = Duration, assetFolder = AssetFolder, newComp = newComp, accent = Accent, roundness = Radius }; }
        internal void Save() { Directory.CreateDirectory(DirectoryPath); string temp = FilePath + ".tmp"; File.WriteAllText(temp, Json.Write(Data()), new UTF8Encoding(false)); if (File.Exists(FilePath)) File.Replace(temp, FilePath, null); else File.Move(temp, FilePath); }
    }
    internal sealed class ConnectionState { internal bool Vector, Effect; internal string Document = "Not connected", Composition = "Not connected"; }
    internal sealed class Bridge {
        internal readonly Preferences Settings;
        private readonly string core;
        internal Bridge(Preferences settings) { Settings = settings; core = Resource("EffectMaster.Core"); }
        internal static string Resource(string name) { using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name)) { if (stream == null) throw new IOException("Missing packaged component: " + name); using (var reader = new StreamReader(stream)) return reader.ReadToEnd(); } }
        internal ConnectionState Inspect() {
            var state = new ConnectionState();
            try {
                // ui.inspect proves the app is running even before it has a document.
                object ui = Rpc.Call(Settings.VectorPort, "ui.inspect", new { });
                if (Json.Get(ui, "documents") == null || Json.Get(ui, "tool") == null) throw new IOException("Unexpected application on the VectorCraft connection.");
                state.Vector = true; state.Document = "No document";
                try { state.Document = Json.Text(Rpc.Command(Settings.VectorPort, "document.inspect", new { depth = 0 }), "title", "Untitled"); } catch (IOException) { }
            } catch { state.Vector = false; }
            try {
                object capabilities = Rpc.Command(Settings.EffectPort, "app.capabilities", new { });
                if (!Json.Flag(capabilities, "scripting")) throw new IOException("EffectCraft scripting is unavailable.");
                state.Effect = true; state.Composition = "No composition";
                try { state.Composition = Json.Text(Rpc.Command(Settings.EffectPort, "comp.info", new { }), "name", "Composition"); } catch (IOException) { }
            } catch { state.Effect = false; }
            return state;
        }
        internal string Execute(string action, bool newComp) {
            // Only this method knows how EffectCraft hosts the transfer engine. A future native
            // VectorCraft extension can replace the palette without rewriting these operations.
            string script = core + "\n(function(){var M=EffectMaster,o=" + Json.Write(Settings.Transfer(newComp)) + ";M.port=o.port;"
                + "if(!o.assetFolder&&!app.project.file)o.assetFolder=" + Json.Write(Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),"Effect Master Assets")) + ";"
                + "return JSON.stringify(M.perform(" + Json.Write(action) + ",o));})();";
            object result;
            try { result = Rpc.Command(Settings.EffectPort, "script.run", new { code = script, name = "Effect Master — " + action }, 120000); }
            catch (Exception error) { throw new IOException("No completion reply. Check EffectCraft before trying again. " + error.GetBaseException().Message); }
            if (!Json.Flag(result, "ok")) {
                object detail = Json.Get(result, "error");
                throw new IOException(Json.Text(detail, "message", detail is string ? (string)detail : Json.Write(detail)));
            }
            string raw = Json.Text(result, "result");
            object value;
            try { value = Json.Read(raw); } catch { throw new IOException("EffectCraft completed the script but returned an unexpected result. Check the composition before retrying."); }
            return Json.Text(value, "message", "Transfer completed.");
        }
    }
}
