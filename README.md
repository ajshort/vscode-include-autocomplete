# Include Autocomplete VSCode extension

This extension provides autocompletion when typing C++ `#include` statements. It searches the configured include
directories to provide suggestions, and also suggests standard headers.

## Usage

Just begin typing an `#include` statement.

When you type `<` or `"` to begin the file name, the extension will scan your include directories to provide
suggestions. When you enter a directory separator (`/` or `\`), it will then search within child directories to continue
providing suggestions.

The extension uses the same `c_cpp_properties.json` file as the [Microsoft C++ Tools][cpptools] extension to configure
the include directories to search. Add additional directories to your platform's `includePath` setting to include it in
suggestions. You can use `${workspaceRoot}` in include paths to spcify the current open workspace root.

## Configuration

* `include-autocomplete.extensions`: An array of extensions to recognise files as headers.

[cpptools]: https://marketplace.visualstudio.com/items?itemName=ms-vscode.cpptools
