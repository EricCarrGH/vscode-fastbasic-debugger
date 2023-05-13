/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/
/*
 * activateMockDebug.ts containes the shared extension code that can be executed both in node.js and the browser.
 */

'use strict';

import * as vscode from 'vscode';
import { WorkspaceFolder, DebugConfiguration, ProviderResult, CancellationToken } from 'vscode';
import { MockDebugSession } from './mockDebug';
import { FileAccessor } from './mockRuntime';

//export let fastBasicChannel: vscode.Terminal;
export let fastBasicChannel: vscode.OutputChannel;

export function activateMockDebug(context: vscode.ExtensionContext, factory?: vscode.DebugAdapterDescriptorFactory) {

	//fastBasicChannel = vscode.window.createTerminal("FastBasic");
	fastBasicChannel = vscode.window.createOutputChannel("FastBasic");
  
	context.subscriptions.push(
		vscode.commands.registerCommand('extension.fastbasic-debugger.runEditorContents', (resource: vscode.Uri) => {
			let targetResource = resource;
			if (!targetResource && vscode.window.activeTextEditor) {
				targetResource = vscode.window.activeTextEditor.document.uri;
			}
			if (targetResource) {
				vscode.debug.startDebugging(undefined, {
					type: 'fastbasic',
					name: 'Run File',
					request: 'launch',
					sourceFile: targetResource.fsPath
				},
					{ noDebug: true }
				);
			}
		}),
		vscode.commands.registerCommand('extension.fastbasic-debugger.debugEditorContents', (resource: vscode.Uri) => {
			let targetResource = resource;
			if (!targetResource && vscode.window.activeTextEditor) {
				targetResource = vscode.window.activeTextEditor.document.uri;
			}
			if (targetResource) {
				vscode.debug.startDebugging(undefined, {
					type: 'fastbasic',
					name: 'Debug File',
					request: 'launch',
					sourceFile: targetResource.fsPath,
          compilerPath: "E.G. c:/fastbasic/fastbasic.exe",
          emulatorPath: "E.G. c:/atari/Altirra/Altirra64.exe"
				});
			}
		}),
		vscode.commands.registerCommand('extension.fastbasic-debugger.toggleFormatting', (variable) => {
			const ds = vscode.debug.activeDebugSession;
			if (ds) {
				ds.customRequest('toggleFormatting');
			}
		})
	);

	context.subscriptions.push(vscode.commands.registerCommand('extension.fastbasic-debugger.getProgramName', config => {
		return vscode.window.showInputBox({
			placeHolder: "Please enter the name of a markdown file in the workspace folder",
			value: "${file}"
		});
	}));

	// register a configuration provider for 'fastbasic' debug type
	const provider = new MockConfigurationProvider();
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('fastbasic', provider));

	// register a dynamic configuration provider for 'fastbasic' debug type
	context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('fastbasic', {
		provideDebugConfigurations(folder: WorkspaceFolder | undefined): ProviderResult<DebugConfiguration[]> {
			return [
				{
					name: "Dynamic Launch",
					request: "launch",
					type: "fastbasic",
					sourceFile: "${file}"
				}
			];
		}
	}, vscode.DebugConfigurationProviderTriggerKind.Dynamic));

	if (!factory) {
		factory = new InlineDebugAdapterFactory();
	}
	context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('fastbasic', factory));
	if ('dispose' in factory) {
	//	context.subscriptions.push(factory);
	}

}



class MockConfigurationProvider implements vscode.DebugConfigurationProvider {

	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: DebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {

		// if launch.json is missing or empty
		if (!config.type && !config.request && !config.name) {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === 'basic') {
				config.type = 'fastbasic';
				config.name = 'Launch';
				config.request = 'launch';
				config.sourceFile = '${file}';
				config.stopOnEntry = true;
			}
		}
		
		//return undefined;	// abort launch
		

		if (!config.sourceFile) {
			return vscode.window.showInformationMessage("Cannot find a program to debug").then(_ => {
				return undefined;	// abort launch
			});
		}

		return config;
	}
}

export const workspaceFileAccessor: FileAccessor = {
	isWindows: false,
	async readFile(path: string): Promise<Uint8Array> {
		let uri: vscode.Uri;
		try {
			uri = pathToUri(path);
		} catch (e) {
			return new TextEncoder().encode(`cannot read '${path}'`);
		}

		return await vscode.workspace.fs.readFile(uri);
	},
	async writeFile(path: string, contents: Uint8Array) {
		await vscode.workspace.fs.writeFile(pathToUri(path), contents);
	}, 
	async waitUntilFileDoesNotExist(path: string, timeoutMs?: number) : Promise<boolean> {
		let timeout = timeoutMs ?? 0;
		let waitedMs = 0;
		while (true) {
			try {
				let uri = vscode.Uri.file(path);
				await vscode.workspace.fs.stat(uri);
			} catch (e) {
				// When we get an exception (file does not exist. return)
				return true;
			}
			await new Promise(resolve => setTimeout(resolve, 125));
			waitedMs+=125;
			if (timeout>0 && waitedMs>=timeout) {
				return false;
			}
		}
	},
	async waitUntilFileExists(path: string, timeoutMs?: number) : Promise<boolean> {
		let timeout = timeoutMs ?? 30000;
		let waitedMs = 0;
		while (true) {
			if (await this.doesFileExist(path)) {
				return true;
			}

			await new Promise(resolve => setTimeout(resolve, 125));
			waitedMs+=125;
			if (waitedMs >= timeout) {
				return false;
			}
		}
	},
	async doesFileExist(path: string) : Promise<boolean> {
		try {
			let uri = vscode.Uri.file(path);
			await vscode.workspace.fs.stat(uri);
			return true;
		} catch (e) {
			// Once we get an exception (file does not exist. return)
		}
		return false;
	},
	async deleteFile(path: string) {
		try {
			await vscode.workspace.fs.delete( vscode.Uri.file(path), {useTrash: false});
		} catch(e) {}
		return;
	}
};

function pathToUri(path: string) {
	try {
		return vscode.Uri.file(path);
	} catch (e) {
		return vscode.Uri.parse(path);
	}
}

class InlineDebugAdapterFactory implements vscode.DebugAdapterDescriptorFactory {

	createDebugAdapterDescriptor(_session: vscode.DebugSession): ProviderResult<vscode.DebugAdapterDescriptor> {
		return new vscode.DebugAdapterInlineImplementation(new MockDebugSession(workspaceFileAccessor));
	}
}
