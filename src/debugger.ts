/*
 * mockDebug.ts implements the Debug Adapter that "adapts" or translates the Debug Adapter Protocol (DAP) used by the client (e.g. VS Code)
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
import { MockRuntime, IRuntimeBreakpoint, FileAccessor, RuntimeVariable, IRuntimeVariableType } from './mockRuntime';
import { Subject } from 'await-notify';
import { fastBasicChannel } from './activateMockDebug';
import * as vscode from 'vscode';
import * as cp from 'child_process';

const DEBUGGER_PROGRAM = `
DIM ___DEBUG_MEM, ___DEBUG_LEN, ___DEBUG_I, ___DEBUG_LINE
 
' Called before any line set as a breakpoint, or by ___DEBUG_CHECK when stepping through
PROC ___DEBUG_BREAK

	' Short Assembly routine ($BA, $60) to retrieve the current stack pointer
	' Copies Stack Register to X register, which is returned to FastBasic
	___DEBUG_I = $60BA
	___DEBUG_I = usr(&___DEBUG_I)

	' Retrieve address of current line from 6502 stack ($100 + stack pointer + 3)
	___DEBUG_LINE=dpeek($103+peek(&___DEBUG_I+1))

	'PRINT ___DEBUG_LINE
  close #5:open #5,4,0,"H4:debug.mem"
  if err()<>1 THEN EXIT 
  close #4:open #4,8,0,"H4:debug.out"
  put #4, 1 ' Variable memory dump
  bput #4, &___DEBUG_LINE, 2
	
  ___DEBUG_I=0
  do
    ' Retrieve the next ___DEBUG_MEM, ___DEBUG_LEN combination (memory location and length to write out)
    ___DEBUG_MEM = 0:bget #5,&___DEBUG_MEM,4:if ___DEBUG_MEM = 0 then exit
    
    ' The first mem/size block is for variables, so we dump the contents of MEM.
    ' All subsequent blocks are for array/string regions, so we 
    ' need to dump the contents that MEM *POINTS TO*, and send that new location to the debugger
    if ___DEBUG_I
			___DEBUG_MEM = dpeek(___DEBUG_MEM)
       bput #4, &___DEBUG_MEM, 2
    endif

    INC ___DEBUG_I

    ' String array points to a second array that points to each string
		' TODO - support non strings with a len of 256!
    if ___DEBUG_LEN mod 256 = 0 and ___DEBUG_LEN > 256
      while ___DEBUG_LEN>0
          
          '? "str: @ ";dpeek(___DEBUG_MEM+i*2);":";$(dpeek(___DEBUG_MEM+i*2))
					
          bput #4, ___DEBUG_MEM, 2
          bput #4, dpeek(___DEBUG_MEM), 256
					if ___DEBUG_MEM >0
						inc ___DEBUG_MEM: inc ___DEBUG_MEM
					ENDIF

          ___DEBUG_LEN=___DEBUG_LEN-256
      wend
    else
      bput #4, ___DEBUG_MEM, ___DEBUG_LEN
      ' if ___DEBUG_LEN mod 256 = 0 then ? "str:";$(___DEBUG_MEM)
    ENDIF
    
    
  '  ? "wrote (was " ; ___DEBUG_MEMO ; ") @";___DEBUG_MEM; " : "; ___DEBUG_LEN
    
  loop
  close #4
  close #5
  XIO #5, 33, 0, 0, "H4:debug.in"
	@___DEBUG_POLL
ENDPROC

PROC ___DEBUG_POLL
  
  ' Wait for outgoing file to be removed by debugger
  do
    open #5,4,0,"H4:debug.out"
    if err()<>1
      close #5:exit
    endif
    close #5
    pause 10
  loop
  
  close #5:open #5,4,0,"H4:debug.in"
  if err()=1 
    get #5,___DEBUG_I
    if ___DEBUG_I=0 or err()<>1 then exit

		IF ___DEBUG_I = 3 ' JumpTo Line
			' Get stack location where we return to
			___DEBUG_I = $60BA
			___DEBUG_I = usr(&___DEBUG_I)

			' Update the return address on the stack to the new line (danger, Will Robinson!)
			bget #5, $103+peek(&___DEBUG_I+1), 2		
		ENDIF
 
    ' Loop through location/value updates (CHECK and Breakpoint)
    bget #5,&___DEBUG_LEN,2
		FOR ___DEBUG_I = 1 TO ___DEBUG_LEN
			bget #5,&___DEBUG_MEM,2
			bget #5,___DEBUG_MEM,2
		NEXT

    ' Update any variable memory from debugger
    do    
      ___DEBUG_MEM = 0:bget #5,&___DEBUG_MEM,4:if ___DEBUG_MEM = 0 then exit
      bget #5, ___DEBUG_MEM, ___DEBUG_LEN    
    loop

    close #5
  endif

	' Reference ___DEBUG_BREAK so FastBasic optimizer will keep it
	IF &___DEBUG_LINE = 0 THEN @___DEBUG_BREAK

  ' Continue execution
  ' ? "[CONTINUE]"
ENDPROC

PROC ___DEBUG_END
 close #4:open #4,8,0,"H4:debug.out"
 put #4, 9 ' End
 close #4
 XIO #5, 33, 0, 0, "H4:debug.in"
 get ___DEBUG_I
ENDPROC

' Called before every line when a breakpoint is not set, to check if stepping. 
' Normally returns right away, except when stepping through the code
PROC ___DEBUG_CHECK
	___DEBUG_I = 0:___DEBUG_I = 0
ENDPROC

@___DEBUG_END
`;
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


export class MockDebugSession extends LoggingDebugSession {

	// we don't support multiple threads, so we can use a hardcoded ID for the default thread
	private static threadID = 1;

	// a Mock runtime (or debugger)
	private _runtime: MockRuntime;

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

		// this debugger uses zero-based lines and columns
		this.setDebuggerLinesStartAt1(true);
		this.setDebuggerColumnsStartAt1(false);

		this._runtime = new MockRuntime(fileAccessor);

		// setup event handlers
		this._runtime.on('stopOnEntry', () => {
			this.sendEvent(new StoppedEvent('entry', MockDebugSession.threadID));
		});
		this._runtime.on('stopOnStep', () => {
			this.sendEvent(new StoppedEvent('step', MockDebugSession.threadID));
		});
		this._runtime.on('stopOnBreakpoint', () => {
			this.sendEvent(new StoppedEvent('breakpoint', MockDebugSession.threadID));
		});
		this._runtime.on('breakpointValidated', (bp: IRuntimeBreakpoint) => {
			this.sendEvent(new BreakpointEvent('changed', { verified: bp.verified, id: bp.id } as DebugProtocol.Breakpoint));
		});
		this._runtime.on('output', (type, text, filePath, line, column) => {

			let category: string;
			switch (type) {
				case 'prio': category = 'important'; break;
				case 'out': category = 'stdout'; break;
				case 'err': category = 'stderr'; break;
				default: category = 'console'; break;
			}
			const e: DebugProtocol.OutputEvent = new OutputEvent(`${text}\n`, category);

			if (text === 'start' || text === 'startCollapsed' || text === 'end') {
				e.body.group = text;
				e.body.output = `group-${text}\n`;
			}

			e.body.source = this.createSource(filePath);
			e.body.line = this.convertDebuggerLineToClient(line);
			e.body.column = this.convertDebuggerColumnToClient(column);
			this.sendEvent(e);
		});
		this._runtime.on('end', () => {
			this.sendEvent(new OutputEvent(`Program completed.\n`, "stdio"));
			this.sendEvent(new TerminatedEvent());
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

		// make sure to 'Stop' the buffered logging if 'trace' is not set
		//logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false);
		//logger.log("Unable to compile!", Logger.LogLevel.Stop);
		/*
				this.sendErrorResponse(response, {
					id: 1001,
					format: `compile error: some fake error.`,//, 
					showUser: true //args.compileError === 'show' ? true : (args.compileError === 'hide' ? false : undefined)
				});
				return;
		*/
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
			sourceLines = sourceLines.concat(DEBUGGER_PROGRAM.split("\n"));
	
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
				new Thread(MockDebugSession.threadID, "Main")
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
		return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'mock-adapter-data');
	}

	private normalizePathAndCasing(path: string) {
		if ('win32' === process.platform) {
			return path.replace(/\//g, '\\').toLowerCase();
		} else {
			return path.replace(/\\/g, '/');
		}
	}
}

