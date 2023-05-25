'use strict';

import * as vscode from 'vscode';
import { activateDebugger } from './activateDebugger';

export function activate(context: vscode.ExtensionContext) {

	
	context.subscriptions.push(
		// Show Procs in Outline
		vscode.languages.registerDocumentSymbolProvider({scheme: "file", language: "basic"}, new FastBasicSymbolProvider()),

		// Support Proc definition (pressing F12)
		vscode.languages.registerDefinitionProvider({scheme: "file", language: "basic"}, new FastBasicDefinitionProvider())
		
	);

	// Activate the main debugger
	activateDebugger(context);
}

export function deactivate() {
	// nothing to do
}

let symbols :  vscode.DocumentSymbol[] = [];

class FastBasicDefinitionProvider implements vscode.DefinitionProvider {
	provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Definition | vscode.LocationLink[]> {
		let wr = document.getWordRangeAtPosition(position);
		if (wr?.isSingleLine) {
			let name = document.lineAt(position.line).text.slice(wr.start.character,wr.end.character).toUpperCase();
		 let sym = symbols.find(s=> s.name.toUpperCase() === name);
		 if (sym) {
			return new vscode.Location(vscode.Uri.file(document.fileName), sym.range);
		 }
		}
		return undefined;
	}

}

class FastBasicSymbolProvider implements vscode.DocumentSymbolProvider {
	public provideDocumentSymbols(
			document: vscode.TextDocument,
			token: vscode.CancellationToken): Promise<vscode.DocumentSymbol[]> {
			symbols = [];
			return new Promise((resolve, reject) => {
					for (var i = 0; i < document.lineCount; i++) {
							var line = document.lineAt(i);
							var lineText = line.text.trim().split(':')[0];
							var lineLower = lineText.toLowerCase();
							
							if (!lineLower.startsWith("proc ") && !lineLower.startsWith("pr.") ) {
								continue;
							}
							
							var name = lineText.slice(lineText[2] === "." ? 3:4).trim();
							if (name.length>0) {
								let nameParts = name.split(' ');

								let paramList = nameParts.length > 1 ? nameParts.slice(1).join(', ') : "";
								
								let symbol = new vscode.DocumentSymbol(
									nameParts[0], paramList,
									vscode.SymbolKind.Function,
									line.range, line.range);
								symbols.push(symbol);
							}
					}
					resolve(symbols);
			});
	}
}