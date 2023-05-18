/*
 * Implements the Debug Adapter that "adapts" or translates the Debug Adapter Protocol (DAP) used by the client (e.g. VS Code)
 * into requests and events of the real "execution engine" or "debugger" (here: class MockRuntime).
 * When implementing your own debugger extension for VS Code, most of the work will go into the Debug Adapter.
 * Since the Debug Adapter is independent from VS Code, it can be used in any client (IDE) supporting the Debug Adapter Protocol.
 *
 * The most important class of the Debug Adapter is the MockDebugSession which implements many DAP requests by talking to the MockRuntime.
 * 
 * 
 * 
 * 
 */

import {
	LoggingDebugSession,
	InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent, OutputEvent,
	InvalidatedEvent,
	Scope, Source, Handles, Breakpoint, MemoryEvent, Thread, StackFrame, ExitedEvent
} from '@vscode/debugadapter';
import { DebugProtocol } from '@vscode/debugprotocol';
import { basename } from 'path-browserify';
import { FastbasicRuntime, IRuntimeBreakpoint, FileAccessor, RuntimeVariable, IRuntimeVariableType } from './runtime';
import { Subject } from 'await-notify';
import { fastBasicChannel } from './activateDebugger';
import * as vscode from 'vscode';
import * as cp from 'child_process';
import {DEBUG_PROGRAM} from './fastbasicDebugProgram';


/**
 * This interface describes the fastbasic-debugger specific launch attributes
 * (which are not part of the Debug Adapter Protocol).
 * The schema for these attributes lives in the package.json of the fastbasic-debugger extension.
 * The interface should always match this schema.
 */
interface ILaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	/** An absolute path to the "program" to debug. */
	sourceFile: string;
	/** enable logging the Debug Adapter Protocol */
	trace?: boolean;
	/** run without debugging */
	noDebug?: boolean;
	/** absolute path to fastbasic compiler */
	compilerPath: string;
	/** absolute path to atari emulator compiler */
	emulatorPath: string;
}

interface IAttachRequestArguments extends ILaunchRequestArguments { }


export class FastbasicDebugSession extends LoggingDebugSession {

	// we don't support multiple threads, so we can use a hardcoded ID for the default thread
	private static threadID = 1;

	// runtime 
	private _runtime: FastbasicRuntime;

	private _variableHandles = new Handles<'locals' | RuntimeVariable>();

	private _configurationDone = new Subject();

	private _valuesInHex = false;
	private _useInvalidatedEvent = false;

	private _fileAccessor: FileAccessor;
	/**
	 * Creates a new debug adapter that is used for one debug session.
	 * We configure the default implementation of a debug adapter here.
	 */
	public constructor(fileAccessor: FileAccessor) {
		super("fastbasic-debugger.txt");
		this._fileAccessor = fileAccessor;

		// Fastbasic starts line numbering at 1
		this.setDebuggerLinesStartAt1(true);
		this.setDebuggerColumnsStartAt1(false);

		this._runtime = new FastbasicRuntime(fileAccessor);

		// setup event handlers
		this._runtime.on('stopOnEntry', () => {
			this.sendEvent(new StoppedEvent('entry', FastbasicDebugSession.threadID));
		});
		this._runtime.on('stopOnStep', () => {
			this.sendEvent(new StoppedEvent('step', FastbasicDebugSession.threadID));
		});
		this._runtime.on('stopOnBreakpoint', () => {
			this.sendEvent(new StoppedEvent('breakpoint', FastbasicDebugSession.threadID));
		});
		this._runtime.on('breakpointValidated', (bp: IRuntimeBreakpoint) => {
			this.sendEvent(new BreakpointEvent('changed', { verified: bp.verified, id: bp.id } as DebugProtocol.Breakpoint));
		});
	}

	/**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

		if (args.supportsProgressReporting) {
		}
		if (args.supportsInvalidatedEvent) {
			this._useInvalidatedEvent = true;
		}

		// build and return the capabilities of this debug adapter:
		response.body = response.body || {};

		// the adapter implements the configurationDone request.
		response.body.supportsConfigurationDoneRequest = true;

		// make VS Code use 'evaluate' when hovering over source
		response.body.supportsEvaluateForHovers = true;
	
		// make VS Code send the breakpointLocations request
		response.body.supportsBreakpointLocationsRequest = true;
		response.body.supportsGotoTargetsRequest = true;

		// make VS Code send setVariable request
		response.body.supportsSetVariable = true;

		// make VS Code send setExpression request
		response.body.supportsSetExpression = true;
	
		this.sendResponse(response);

		// since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendEvent(new InitializedEvent());
	}

	/**
	 * Called at the end of the configuration sequence.
	 * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		this._configurationDone.notify();
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
		console.log(`disconnectRequest suspend: ${args.suspendDebuggee}, terminate: ${args.terminateDebuggee}`);
	}

	protected async attachRequest(response: DebugProtocol.AttachResponse, args: IAttachRequestArguments) {
		return this.launchRequest(response, args);
	}

	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: ILaunchRequestArguments) {
		// wait 1 second until configuration has finished (and configurationDoneRequest has been called)
		await this._configurationDone.wait(1000);

		if (args.sourceFile.toLocaleLowerCase().endsWith(".json")) {
			this.sendEvent(new TerminatedEvent());
			return undefined;
		}
		// Create a bin folder to hold compiled/symbol files
		let isWindows = 'win32' === process.platform;
		var folderDelimiter = isWindows ? "\\" : "/";
		let file = args.sourceFile;
		let fileParts = file.split(folderDelimiter);
		let filename = fileParts[fileParts.length - 1];
		let filenameNoExt = filename.split(".")[0] + ".";
		fileParts[fileParts.length - 1] = "bin";
		let binFolder = fileParts.join(folderDelimiter);
		await vscode.workspace.fs.createDirectory(vscode.Uri.file(binFolder));

		// Delete existing files for this source file
		var files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(binFolder));
		for (let i = 0; i < files.length; i++) {
			if (files[i][0].startsWith(filenameNoExt)) {
				await vscode.workspace.fs.delete(vscode.Uri.file(binFolder + folderDelimiter + files[i][0]), { useTrash: false });
			}
		};

		// Copy the source file to the bin folder 
		await vscode.workspace.fs.copy(vscode.Uri.file(file), vscode.Uri.file(binFolder + folderDelimiter + filename));

		// Inject debugger code into the bin source file copy
		const breakpoints = this._runtime.breakPoints.get(this.normalizePathAndCasing(file)) ?? new Array<IRuntimeBreakpoint>();
	
		let lineCount = await this.injectDebuggerCode(binFolder + folderDelimiter + filename, breakpoints, Boolean(args.noDebug) );
		
		// Check if the compiler exists
		if (!await this._fileAccessor.doesFileExist(args.compilerPath)) {
			response.success = false;
			response.message = "Could not find FastBasic compiler. Check the compilerPath in launch.json.";
			this.sendResponse(response);
			return undefined;
		}

		// run the fastbasic compiler
		fastBasicChannel.clear();
		fastBasicChannel.show(true);
		fastBasicChannel.appendLine(`Compiling ${filename} using FastBasic Compiler..`);

		
		//this.sendEvent(new OutputEvent(`Compiling ${filename} using FastBasic Compiler..\n`, "stdio"));

		let wroteError = false;
		//cp.execFile(`${args.compilerPath}`, ["-n",filename], { cwd: binFolder + folderDelimiter }, (err, stdout) => {
			cp.execFile(`${args.compilerPath}`, [filename], { cwd: binFolder + folderDelimiter }, (err, stdout) => {
			if (err) {

				// Strip the first two lines as they do not add value, unless they are unexpected
				let error = err.message.split("\n");
				if (error[0].startsWith("Command failed:")) {
					error = error.slice(1);
				}
				if (error[0].startsWith("BAS compile '")) {
					error = error.slice(1);
				}

				// Remove debugging code from error output
				let errorMessage = error.join("\n");
				let line = 1, column = 1;
				errorMessage = errorMessage.replace(/\.(bas|lst):(\d+):(\d+):/gi, (s, ext, row, col) => {
					column = col - (row > 1 ? 15 : 30);
					line = row;
					return `.${ext}:${row}:${column}: `;
				});

				errorMessage = errorMessage.replace(/\.(bas|lst):(\d+): /gi, (s, ext, row) => {
					line = Math.min(row, lineCount);
					return `.${ext}:${line}: `;
				});

				errorMessage = errorMessage.replace(/@___DEBUG_CB \d+:/gi, "");
				errorMessage = errorMessage.replace("@___DEBUG_POLL:", "");

				wroteError = errorMessage.length > 0;
				fastBasicChannel.appendLine("\n" + errorMessage);

				//let category = 'stderr'; // stdout

				/*const e: DebugProtocol.OutputEvent = new OutputEvent(`${errorMessage}\n`, category);
				e.body.source = new Source(basename(file), this.convertDebuggerPathToClient(file), undefined, undefined, 'fastbasic-debugger');
				e.body.line = Number(line); //this.convertDebuggerLineToClient(line);
				e.body.column = Number(column); // this.convertDebuggerColumnToClient(column);
				this.sendEvent(e);
				*/
			//	this.sendEvent(new ExitedEvent(0));
				this.sendEvent(new TerminatedEvent());
			}
		});
		if (wroteError) {
			return undefined;
		}
		// Wait until the XEX file is created
		let atariExecutable = binFolder + folderDelimiter + filenameNoExt + "xex";
		if (!wroteError) {
			await this._fileAccessor.waitUntilFileExists(atariExecutable, 10000);
		}

		if (! await this._fileAccessor.doesFileExist(atariExecutable)) {
			if (!wroteError) {
			fastBasicChannel.appendLine("ERROR: An unknown error has occured compiling the file.");
			}
			//response.success = false;
			this.sendEvent(new TerminatedEvent());
			/*this.sendErrorResponse(response, { 
				id: 1001,
				format: `Unable to compile source file.`,
				showUser: false});*/
			return undefined;	// abort launch
		}

		if (!this._fileAccessor.doesFileExist(args.emulatorPath)) {
			response.success = false;
			response.message = "Could not find Atari Emulator. Check the emulatorPath in launch.json.";
			this.sendResponse(response);
			return undefined;
		}

		// Don't bother starting debugging if there are no breakpoints
		if (breakpoints.length === 0) {
			// Run the program in the emulator
			cp.execFile(`${args.emulatorPath}`,["/singleinstance","/run", atariExecutable ], (err, stdout) => {
				if (err) {
					fastBasicChannel.appendLine(err.message);
				}
				fastBasicChannel.appendLine(stdout);
			});
		 this.sendEvent(new TerminatedEvent());
		 return undefined;
		}
		// start the program in the runtime
		await this._runtime.start(file, !args.noDebug, args.emulatorPath, atariExecutable);
		this.sendResponse(response);
	}

	private async injectDebuggerCode(file: string, breakpoints: IRuntimeBreakpoint[], noDebug: boolean): Promise<number> {
		let sourceLines = new TextDecoder().decode(await this._fileAccessor.readFile(file)).split(/\r?\n/);
		let lineCount = sourceLines.length;

		if (noDebug) {
			return lineCount;
		}

		// Only inject debugging code if at least one breakpoint is set
	   let i =  sourceLines.length;

		if (breakpoints.length > 0) {
			
			sourceLines[0] = "@___DEBUG_POLL:" + sourceLines[0];
		
			for (i = 1; i < sourceLines.length; i++) {

				let line = sourceLines[i].trim().toLocaleLowerCase();

				if (line.length > 0
					&& !line.startsWith("'")
					&& !line.startsWith(".")
					&& !line.startsWith("data ")
					&& !line.startsWith("da.")
					&& !line.startsWith("proc ")
					&& !line.startsWith("pr.")
					&& !line.startsWith("endproc")
					&& !line.startsWith("endp.")
				) {
					sourceLines[i] = `@___DEBUG_CHECK:${sourceLines[i]}`;
				}
			}
			
			// Append the debugger code at the end of the listing
			sourceLines = sourceLines.concat(DEBUG_PROGRAM);
	
		} else {
			// Don't end program until key press in debug mode (even when no breakpoints are added)
			sourceLines.splice(i, 0, "GET ___DEBUG_KEY");
		}
		
		// Save the new code
		this._fileAccessor.writeFile(file, new TextEncoder().encode(sourceLines.join("\n")));
		return lineCount;
	}

	protected async setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): Promise<void> {

		const path = args.source.path as string;
		const clientLines = args.lines || [];

		// clear all breakpoints for this file
		this._runtime.clearBreakpoints(path);

		// set and verify breakpoint locations
		const actualBreakpoints0 = clientLines.map(async l => {
			const { verified, line, id } = await this._runtime.setBreakPoint(path, this.convertClientLineToDebugger(l));
			const bp = new Breakpoint(verified, this.convertDebuggerLineToClient(line)) as DebugProtocol.Breakpoint;
			bp.id = id;
			return bp;
		});
		const actualBreakpoints = await Promise.all<DebugProtocol.Breakpoint>(actualBreakpoints0);

		// send back the actual breakpoint positions
		response.body = {
			breakpoints: actualBreakpoints
		};
		this.sendResponse(response);
	}


	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {

		// runtime supports no threads so just return a default thread.
		response.body = {
			threads: [
				new Thread(FastbasicDebugSession.threadID, "Main")
			]
		};
		this.sendResponse(response);
	}



	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {

		const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0;
		const maxLevels = typeof args.levels === 'number' ? args.levels : 1000;
		const endFrame = startFrame + maxLevels;

		const stk = this._runtime.stack(startFrame, endFrame);

		response.body = {
			stackFrames: stk.frames.map((f, ix) => {
				return new StackFrame(f.index, f.name, this.createSource(f.file), this.convertDebuggerLineToClient(f.line));
			}),
			totalFrames: stk.count			
		};
		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {

		response.body = {
			scopes: [
				new Scope("Global", this._variableHandles.create('locals'), false)
			]
		};
		this.sendResponse(response);
	}


	protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): Promise<void> {

		let vs: RuntimeVariable[] = [];
		let inArray = false;
		const v = this._variableHandles.get(args.variablesReference);
		if (v === 'locals') {
			vs = this._runtime.getLocalVariables();
		} else if (v && Array.isArray(v.value)) {
			vs = v.value;
			inArray = true;
		}

		response.body = {
			variables: vs.filter(v => inArray || v.memLoc > 0).map(v => this.convertFromRuntime(v))
		};
		this.sendResponse(response);
	}

	protected setVariableRequest(response: DebugProtocol.SetVariableResponse, args: DebugProtocol.SetVariableArguments): void {

		const container = this._variableHandles.get(args.variablesReference);
		const rv = container === 'locals'
			? this._runtime.getLocalVariable(args.name)
			: container instanceof RuntimeVariable && container.value instanceof Array
				? container.value.find(v => v.name === args.name)
				: undefined;

		if (rv) {
			rv.value = this.convertToRuntime(args.value);
			response.body = this.convertFromRuntime(rv);
			if (container instanceof RuntimeVariable && container.memLoc) {
				container.modified = true;
			}

			//if (rv.memory && rv.reference) {
			//				this.sendEvent(new MemoryEvent(String(rv.reference), 0, 2)); //rv.memory.length));
			//	}
		}
		//	this._runtime.setVariable(args.name, args.value);
		//	this.sendResponse(response);
		//	return;

		this.sendResponse(response);
	}

	protected gotoTargetsRequest(response: DebugProtocol.GotoTargetsResponse, args: DebugProtocol.GotoTargetsArguments): void {
		response.body = { 
			targets: [{ id: args.line, line: args.line} as DebugProtocol.GotoTarget]
		};
		this.sendResponse(response);
	}
	
	protected gotoRequest(response: DebugProtocol.GotoResponse, args: DebugProtocol.GotoArguments): void {
		this._runtime.jump(args.targetId);
		this.sendResponse(response);
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this._runtime.continue();
		this.sendResponse(response);
	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this._runtime.step();
		this.sendResponse(response);
	}


	protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {
		//this._runtime.step(args.granularity === 'instruction', true);
		//this.sendResponse(response);
	}

	protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
		//this._runtime.stepIn(args.targetId);
		//this.sendResponse(response);
	}

	protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
		//this._runtime.stepOut();
		//this.sendResponse(response);
	}


	protected setExpressionRequest(response: DebugProtocol.SetExpressionResponse, args: DebugProtocol.SetExpressionArguments): void {

		if (args.expression.startsWith('$')) {
			const rv = this._runtime.getLocalVariable(args.expression.substr(1));
			if (rv) {
				rv.value = this.convertToRuntime(args.value);
				response.body = this.convertFromRuntime(rv);
				this.sendResponse(response);
			} else {
				this.sendErrorResponse(response, {
					id: 1002,
					format: `variable '{lexpr}' not found`,
					variables: { lexpr: args.expression },
					showUser: true
				});
			}
		} else {
			this.sendErrorResponse(response, {
				id: 1003,
				format: `'{lexpr}' not an assignable expression`,
				variables: { lexpr: args.expression },
				showUser: true
			});
		}
	}

	protected customRequest(command: string, response: DebugProtocol.Response, args: any) {
		if (command === 'toggleFormatting') {
			this._valuesInHex = !this._valuesInHex;
			if (this._useInvalidatedEvent) {
				this.sendEvent(new InvalidatedEvent(['variables']));
			}
			this.sendResponse(response);
		} else {
			super.customRequest(command, response, args);
		}
	}

	//---- helpers

	private convertToRuntime(value: string): IRuntimeVariableType {

		value = value.trim();

		if (value[0] === '\'' || value[0] === '"') {
			return value.substr(1, value.length - 2);
		}
		const n = parseFloat(value);
		if (!isNaN(n)) {
			return n;
		}
		return value;
	}

	private convertFromRuntime(v: RuntimeVariable): DebugProtocol.Variable {

		let dapVariable: DebugProtocol.Variable = {
			name: v.name,
			value: '???',
			type: `${v.type} |  ADR=$${v.memLoc.toString(16).toUpperCase()}`,
			variablesReference: 0,
			evaluateName: v.name
		};

		if (Array.isArray(v.value)) {
			if (v.largeArray) {
				dapVariable.value = `${v.value[0].type} Array (${v.value[0].value})`;
			}else {
				dapVariable.value = `${v.value[0].type} Array (${v.value.length - 1})`;
				v.reference ??= this._variableHandles.create(v);
				dapVariable.variablesReference = v.reference;
			}
			dapVariable.presentationHint = { attributes: ["readOnly"] };
		} else {
			switch (v.type) {
				case 'Byte':
				case 'Word':
					if (typeof v.value === 'number') {
						dapVariable.value = this.formatNumber(v.value);
					} else {
						dapVariable.value = typeof v.value;
					}
					(<any>dapVariable).__vscodeVariableMenuContext = 'simple';	// enable context menu contribution
					break;
				case 'Float':
					dapVariable.value = v.value.toString();
					break;
				case 'String':
					if (v.memLoc > 0) {
						dapVariable.value = `"${v.value}"`;
					} else {
						dapVariable.value = `uninitialized`;
						dapVariable.presentationHint = { attributes: ["readOnly"] };
					}

					break;
				default:
					dapVariable.value = typeof v.value;
					break;
			}
		}

		return dapVariable;
	}

	
	protected async evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): Promise<void> {

		let reply: string | undefined;
		let rv: RuntimeVariable | undefined;

    let nameParts = args.expression.toUpperCase().split("(");
		let name = nameParts[0];
		if (name[0]==='&') {
			name=name.slice(1);
		}
		
		rv = this._runtime.getLocalVariable(name)
			?? this._runtime.getLocalVariable(name + "$") 
			?? this._runtime.getLocalVariable(name + "%");
	  
		if (rv) {
			const v = this.convertFromRuntime(rv);
			
			if (rv.memLoc>0) {
				if (!isNaN(Number(v.value)) && v.value.indexOf(".")<0)  {
					v.value = v.value + ' $' + Number(v.value).toString(16).toUpperCase();
				}
				v.value += `  |  ADR=$${rv.memLoc.toString(16).toUpperCase()}`;
			} else {
				v.value="uninitialized";
			}
			
			response.body = {
				result: v.value,
				type: v.type,
				variablesReference: v.variablesReference,
				presentationHint: v.presentationHint
			};
		} else {
			response.body = {
				result: reply ? reply : `evaluate(context: '${args.context}', '${args.expression}')`,
				variablesReference: 0
			};
		}

		this.sendResponse(response);
	}

	private formatNumber(x: number) {
		return this._valuesInHex ? '$' + x.toString(16) : x.toString(10);
	}

	private createSource(filePath: string): Source {
		return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'fastbasic-debugger');
	}

	private normalizePathAndCasing(path: string) {
		if ('win32' === process.platform) {
			return path.replace(/\//g, '\\').toLowerCase();
		} else {
			return path.replace(/\\/g, '/');
		}
	}
}

