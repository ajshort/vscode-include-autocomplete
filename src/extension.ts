import STD_HEADERS from "./std-headers";
import * as fs from "fs";
import { dirname, extname, join } from "path";
import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext) {
  const provider = new IncludeCompletionProvider();

  context.subscriptions.push(provider);
  context.subscriptions.push(vscode.languages.registerCompletionItemProvider("cpp", provider, "<", '"', "/", "\\"));
}

/**
 * Provides completion suggestions for C++ includes.
 */
class IncludeCompletionProvider implements vscode.CompletionItemProvider, vscode.Disposable {
  private dirs: string[] = [];
  private watcher: vscode.FileSystemWatcher;

  constructor() {
    this.updateDirs();

    this.watcher = vscode.workspace.createFileSystemWatcher("**/c_cpp_properties.json");
    this.watcher.onDidCreate(() => this.updateDirs());
    this.watcher.onDidChange(() => this.updateDirs());
    this.watcher.onDidDelete(() => this.updateDirs());
  }

  public dispose() {
    this.watcher.dispose();
  }

  public provideCompletionItems(document: vscode.TextDocument, position: vscode.Position,
                                token: vscode.CancellationToken) {
    // Check if we are currently inside an include statement.
    const text = document.lineAt(position.line).text.substr(0, position.character);
    const match = text.match(/^\s*#\s*include\s*(<[^>]*|"[^"]*)$/);

    if (!match) {
      return [];
    }

    const delimiter = match[1].substr(0, 1);
    const contents = match[1].substr(1);

    // TODO Get the directories and extensions to search.
    let dirs = this.dirs.slice();
    let exts = vscode.workspace.getConfiguration("include-autocomplete").get("extensions", []);

    // Add includes relative to the file.
    if (delimiter === "<") {
      dirs.push(dirname(document.uri.fsPath));
    } else {
      dirs.unshift(dirname(document.uri.fsPath));
    }

    // Append already typed path parts. If no path parts are typed, include the standard headers.
    let headers = [];
    let separator = Math.max(contents.lastIndexOf("/"), contents.lastIndexOf("\\"));

    if (separator !== -1) {
      dirs = dirs.map(dir => join(dir, contents.substr(0, separator)));
    } else {
      headers = STD_HEADERS.map(header => new vscode.CompletionItem(header, vscode.CompletionItemKind.File));
    }

    // Scan each directory and return the completion items.
    const promises = dirs.map(async dir => {
      if (!await exists(dir)) {
        return [];
      }

      const entries = await readdirAndStat(dir);

      return Object.keys(entries).reduce((items, entry) => {
        if (entries[entry].isDirectory()) {
          items.push(new vscode.CompletionItem(entry, vscode.CompletionItemKind.Module));
        } else if (exts.indexOf(extname(entry)) !== -1) {
          items.push(new vscode.CompletionItem(entry, vscode.CompletionItemKind.File));
        }

        return items;
      }, []);
    });

    return Promise.all(promises).then(items => items.reduce((a, b) => a.concat(b), headers));
  }

  /**
   * Reads the C++ properties and updates the include dirs to search.
   */
  private async updateDirs() {
    const platform = this.getPlatform();
    const filename = join(vscode.workspace.rootPath, ".vscode/c_cpp_properties.json");

    let properties = undefined;
    let dirs = <string[]> undefined;

    if (await exists(filename)) {
      try {
        properties = JSON.parse(await readFile(filename, "utf-8"));
      } catch (err) { }
    }

    if (typeof properties !== "undefined") {
      const config = properties.configurations.find(c => c.name === platform);

      if (typeof config !== "undefined") {
        dirs = config.includePath;
      }
    }

    // If we couldn't read a properties file, use default paths.
    if (typeof dirs === "undefined") {
      if (platform === "Win32") {
        dirs = ["C:/Program Files (x86)/Microsoft Visual Studio 14.0/VC/include"];
      } else {
        dirs = ["/usr/include"];
      }
    }

    this.dirs = dirs;
  }

  private getPlatform(): string {
    switch (process.platform) {
      case "linux": return "Linux";
      case "darwin": return "Mac";
      case "win32": return "Win32";
      default: return process.platform;
    }
  }
}

function exists(path: string): Promise<boolean> {
  return new Promise(c => fs.exists(path, c));
}

function readdir(path: string): Promise<string[]> {
  return new Promise((c, e) => fs.readdir(path, (err, files) => err ? e(err) : c(files)));
}

function readFile(filename: string, encoding: string): Promise<string> {
  return new Promise((c, e) => fs.readFile(filename, encoding, (err, data) => err ? e(err) : c(data)));
}

function stat(path: string): Promise<fs.Stats> {
  return new Promise((c, e) => fs.stat(path, (err, stats) => err ? e(err) : c(stats)));
}

async function readdirAndStat(path: string): Promise<{ [entry: string]: fs.Stats }> {
  const result = <any> {};
  const files = await readdir(path);

  await Promise.all(files.map(async file => {
    try {
      result[file] = await stat(`${path}/${file}`);
    } catch (err) { }
  }));

  return result;
}
