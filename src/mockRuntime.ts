/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { EventEmitter } from 'events';
import { syncBuiltinESMExports } from 'module';
import { fastBasicChannel } from './activateMockDebug';
import * as cp from 'child_process';

export interface FileAccessor {
	isWindows: boolean;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, contents: Uint8Array): Promise<void>;
	waitUntilFileDoesNotExist(path: string, timeoutMs?: number);
	waitUntilFileExists(path: string, timeoutMs?: number)
	doesFileExist(path: string);
	
}

export interface IRuntimeBreakpoint {
	id: number;
	line: number;
	verified: boolean;
}


interface IRuntimeStackFrame {
	index: number;
	name: string;
	file: string;
	line: number;
	column?: number;
	instruction?: number;
}

interface IRuntimeStack {
	count: number;
	frames: IRuntimeStackFrame[];
}

interface RuntimeDisassembledInstruction {
	address: number;
	instruction: string;
	line?: number;
}

export type IRuntimeVariableType = number | boolean | string | RuntimeVariable[];

export class RuntimeVariable {
	private _memory?: Uint8Array;

	public reference?: number;

	public memLoc: number = 0;

	public get value() {
		return this._value;
	}

	public set value(value: IRuntimeVariableType) {
		this._value = value;
		this._memory = undefined;
	}

	public get memory() {
		if (this._memory === undefined && typeof this._value === 'string') {
			this._memory = new TextEncoder().encode(this._value);
		}
		return this._memory;
	}

	constructor(public readonly name: string, private _value: IRuntimeVariableType, public readonly type: string, public readonly byteLen: number) {}

	public setMemory(data: Uint8Array, offset = 0) {
		const memory = this.memory;
		if (!memory) {
			return;
		}

		memory.set(data, offset);
		this._memory = memory;
		this._value = new TextDecoder().decode(memory);
	}
}

interface Word {
	name: string;
	line: number;
	index: number;
}



export function timeout(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const VAR_BYTE='Byte', VAR_WORD='Word', VAR_FLOAT='Float', VAR_STRING='String';

const VAR_TYPE_LEN: Map<string, number> = new Map([
	[VAR_BYTE, 1],
	[VAR_WORD, 2],
	[VAR_FLOAT, 6],
	[VAR_STRING, 256]
]);

/**
 * A Mock runtime with minimal debugger functionality.
 * MockRuntime is a hypothetical (aka "Mock") "execution engine with debugging support":
 * it takes a Markdown (*.md) file and "executes" it by "running" through the text lines
 * and searching for "command" patterns that trigger some debugger related functionality (e.g. exceptions).
 * When it finds a command it typically emits an event.
 * The runtime can not only run through the whole file but also executes one line at a time
 * and stops on lines for which a breakpoint has been registered. This functionality is the
 * core of the "debugging support".
 * Since the MockRuntime is completely independent from VS Code or the Debug Adapter Protocol,
 * it can be viewed as a simplified representation of a real "execution engine" (e.g. node.js)
 * or debugger (e.g. gdb).
 * When implementing your own debugger extension for VS Code, you probably don't need this
 * class because you can rely on some existing debugger or runtime.
 */
export class MockRuntime extends EventEmitter {


	// the initial (and one and only) file we are 'debugging'
	private _sourceFile: string = '';
	public get sourceFile() {
		return this._sourceFile;
	}

	private _debugFileToEmu: string = '';
	private _debugFileFromEmu: string = '';
	private _debugMemFile: string='';

	private _varMemSize: number = 0; // Size
	private _varMinLoc: number = 0;

	private variables = new Map<string, RuntimeVariable>();
	
	// the contents (= lines) of the one and only file
	private sourceLines: string[] = [];
	private instructions: Word[] = [];
	private starts: number[] = [];
	private ends: number[] = [];

	// This is the next line that will be 'executed'
	private _currentLine = 0;
	private get currentLine() {
		return this._currentLine;
	}
	private set currentLine(x) {
		this._currentLine = x;
		this.instruction = this.starts[x];
	}
	private currentColumn: number | undefined;

	// This is the next instruction that will be 'executed'
	public instruction= 0;

	// maps from sourceFile to array of IRuntimeBreakpoint
	private breakPoints = new Map<string, IRuntimeBreakpoint[]>();

	// all instruction breakpoint addresses
	private instructionBreakpoints = new Set<number>();

	// since we want to send breakpoint events, we will assign an id to every event
	// so that the frontend can match events with breakpoints.
	private breakpointId = 1;

	private breakAddresses = new Map<string, string>();

	private namedException: string | undefined;
	private otherExceptions = false;

	constructor(private fileAccessor: FileAccessor) {
		super();
	}

	/**
	 * Start executing the given program.
	 */
	public async start(program: string, stopOnEntry: boolean, debug: boolean, emulatorPath: string, executable: string): Promise<void> {

		// Load and parse the symbols if debugging
		if (debug) {
			await this.loadSource(this.normalizePathAndCasing(program));
		}

		// Run the executable in theemulator
		cp.execFile(`${emulatorPath}`,["/singleinstance","/run", executable ], (err, stdout) => {
			if (err) {
				fastBasicChannel.appendLine(err.message);//.substring(err.message.indexOf("\n")));
			}
			fastBasicChannel.appendLine(stdout);
		});

		if (debug) {
			await this.verifyBreakpoints(this._sourceFile);

			if (stopOnEntry) {
				this.findNextStatement(false, 'stopOnEntry');
			} else {
				// we just start to run until we hit a breakpoint, an exception, or the end of the program
				this.continue(false);
			}
		} else {
			this.continue(false);
		}
	}

	/**
	 * Continue execution to the end/beginning.
	 */
	public continue(reverse: boolean) {

		while (!this.executeLine(this.currentLine, reverse)) {
			if (this.updateCurrentLine(reverse)) {
				break;
			}
			if (this.findNextStatement(reverse)) {
				break;
			}
		}
	}

	/**
	 * Step to the next/previous non empty line.
	 */
	public step(instruction: boolean, reverse: boolean) {

		if (instruction) {
			if (reverse) {
				this.instruction--;
			} else {
				this.instruction++;
			}
			this.sendEvent('stopOnStep');
		} else {
			if (!this.executeLine(this.currentLine, reverse)) {
				if (!this.updateCurrentLine(reverse)) {
					this.findNextStatement(reverse, 'stopOnStep');
				}
			}
		}
	}

	private updateCurrentLine(reverse: boolean): boolean {
		if (reverse) {
			if (this.currentLine > 0) {
				this.currentLine--;
			} else {
				// no more lines: stop at first line
				this.currentLine = 0;
				this.currentColumn = undefined;
				this.sendEvent('stopOnEntry');
				return true;
			}
		} else {
			if (this.currentLine < this.sourceLines.length-1) {
				this.currentLine++;
			} else {
				// no more lines: run to end
				this.currentColumn = undefined;
				this.sendEvent('end');
				return true;
			}
		}
		return false;
	}

	/**
	 * "Step into" for Mock debug means: go to next character
	 */
	public stepIn(targetId: number | undefined) {
		if (typeof targetId === 'number') {
			this.currentColumn = targetId;
			this.sendEvent('stopOnStep');
		} else {
			if (typeof this.currentColumn === 'number') {
				if (this.currentColumn <= this.sourceLines[this.currentLine].length) {
					this.currentColumn += 1;
				}
			} else {
				this.currentColumn = 1;
			}
			this.sendEvent('stopOnStep');
		}
	}

	/**
	 * "Step out" for Mock debug means: go to previous character
	 */
	public stepOut() {
		if (typeof this.currentColumn === 'number') {
			this.currentColumn -= 1;
			if (this.currentColumn === 0) {
				this.currentColumn = undefined;
			}
		}
		this.sendEvent('stopOnStep');
	}

	/**
	 * Returns a fake 'stacktrace' where every 'stackframe' is a word from the current line.
	 */
	public stack(startFrame: number, endFrame: number): IRuntimeStack {

		const line = this.getLine();
		const words = this.getWords(this.currentLine, line);
		words.push({ name: 'BOTTOM', line: -1, index: -1 });	// add a sentinel so that the stack is never empty...

		// if the line contains the word 'disassembly' we support to "disassemble" the line by adding an 'instruction' property to the stackframe
		const instruction = line.indexOf('disassembly') >= 0 ? this.instruction : undefined;

		const column = typeof this.currentColumn === 'number' ? this.currentColumn : undefined;

		const frames: IRuntimeStackFrame[] = [];
		// every word of the current line becomes a stack frame.
		for (let i = startFrame; i < Math.min(endFrame, words.length); i++) {

			const stackFrame: IRuntimeStackFrame = {
				index: i,
				name: `${words[i].name}(${i})`,	// use a word of the line as the stackframe name
				file: this._sourceFile,
				line: this.currentLine,
				column: column, // words[i].index
				instruction: instruction
			};

			frames.push(stackFrame);
		}

		return {
			frames: frames,
			count: words.length
		};
	}

	/*
	 * Determine possible column breakpoint positions for the given line.
	 * Here we return the start location of words with more than 8 characters.
	 */
	public getBreakpoints(path: string, line: number): number[] {
		return this.getWords(line, this.getLine(line)).filter(w => w.name.length > 8).map(w => w.index);
	}

	/*
	 * Set breakpoint in file with given line.
	 */
	public async setBreakPoint(path: string, line: number): Promise<IRuntimeBreakpoint> {
		path = this.normalizePathAndCasing(path);

		const bp: IRuntimeBreakpoint = { verified: false, line, id: this.breakpointId++ };
		let bps = this.breakPoints.get(path);
		if (!bps) {
			bps = new Array<IRuntimeBreakpoint>();
			this.breakPoints.set(path, bps);
		}
		bps.push(bp);

		await this.verifyBreakpoints(path);

		return bp;
	}

	/*
	 * Clear breakpoint in file with given line.
	 */
	public clearBreakPoint(path: string, line: number): IRuntimeBreakpoint | undefined {
		const bps = this.breakPoints.get(this.normalizePathAndCasing(path));
		if (bps) {
			const index = bps.findIndex(bp => bp.line === line);
			if (index >= 0) {
				const bp = bps[index];
				bps.splice(index, 1);
				return bp;
			}
		}
		return undefined;
	}

	public clearBreakpoints(path: string): void {
		this.breakPoints.delete(this.normalizePathAndCasing(path));
	}

	public setDataBreakpoint(address: string, accessType: 'read' | 'write' | 'readWrite'): boolean {

		const x = accessType === 'readWrite' ? 'read write' : accessType;

		const t = this.breakAddresses.get(address);
		if (t) {
			if (t !== x) {
				this.breakAddresses.set(address, 'read write');
			}
		} else {
			this.breakAddresses.set(address, x);
		}
		return true;
	}

	public clearAllDataBreakpoints(): void {
		this.breakAddresses.clear();
	}

	public setExceptionsFilters(namedException: string | undefined, otherExceptions: boolean): void {
		this.namedException = namedException;
		this.otherExceptions = otherExceptions;
	}

	public setInstructionBreakpoint(address: number): boolean {
		this.instructionBreakpoints.add(address);
		return true;
	}

	public clearInstructionBreakpoints(): void {
		this.instructionBreakpoints.clear();
	}

	public getLocalVariables(): RuntimeVariable[] {
		return Array.from(this.variables, ([name, value]) => value);
	}

	public getLocalVariable(name: string): RuntimeVariable | undefined {
		return this.variables.get(name);
	}

	/**
	 * Return words of the given address range as "instructions"
	 */
	public disassemble(address: number, instructionCount: number): RuntimeDisassembledInstruction[] {

		const instructions: RuntimeDisassembledInstruction[] = [];

		for (let a = address; a < address + instructionCount; a++) {
			if (a >= 0 && a < this.instructions.length) {
				instructions.push({
					address: a,
					instruction: this.instructions[a].name,
					line: this.instructions[a].line
				});
			} else {
				instructions.push({
					address: a,
					instruction: 'nop'
				});
			}
		}

		return instructions;
	}

	// private methods

	private getLine(line?: number): string {
		return this.sourceLines[line === undefined ? this.currentLine : line].trim();
	}

	private getWords(l: number, line: string): Word[] {
		// break line into words
		const WORD_REGEXP = /[a-z]+/ig;
		const words: Word[] = [];
		let match: RegExpExecArray | null;
		while (match = WORD_REGEXP.exec(line)) {
			words.push({ name: match[0], line: l, index: match.index });
		}
		return words;
	}

	private async loadSource(file: string): Promise<void> {

		if (this._sourceFile !== file) {
			let ext  = file.split(".").splice(-1)[0].toLowerCase();
			if (ext !== "bas" && ext !== "lst") {
				return;
			}

	
			this._sourceFile = file;

			//file = file.replace("readme.md", "test.bas");

			let symbolFileParts = file.split("/");
			symbolFileParts[symbolFileParts.length-1] ="bin/" + symbolFileParts[symbolFileParts.length-1].split(".",1)[0];
			let symbolFile = symbolFileParts.join("/");

			symbolFileParts[symbolFileParts.length-1] ="bin/debug.";
			this._debugFileToEmu= symbolFileParts.join("/") + "in";
			this._debugFileFromEmu = symbolFileParts.join("/") + "out";
			this._debugMemFile = symbolFileParts.join("/") + "mem";

			await this.initializeContents(
				await this.fileAccessor.readFile(file),
				await this.fileAccessor.readFile(symbolFile+".lst"),
				await this.fileAccessor.readFile(symbolFile+".lbl")
				);
		}
	}

	private async initializeContents(memory: Uint8Array, list: Uint8Array, refs: Uint8Array) {
		this.sourceLines = new TextDecoder().decode(memory).split(/\r?\n/);
		let listLines = new TextDecoder().decode(list).split(/\r?\n/);
		let refsLines = new TextDecoder().decode(refs).split(/\r?\n/);

		/* Reference
		000006r 1               	.export fb_var_AB
    000006r 1  xx xx xx xx  fb_var_AB:	.res 6	; Float variable
		000002r 1  xx xx        fb_var_B:	.res 2	; Word variable
		000004r 1               	.export fb_var_C
		000004r 1  xx xx        fb_var_C:	.res 2	; Word Array variable
		000006r 1               	.export fb_var_D
		000006r 1  xx xx        fb_var_D:	.res 2	; Byte Array variable
		000008r 1               	.export fb_var_HW
		000008r 1  xx xx        fb_var_HW:	.res 2	; String variable
		00000Ar 1               	.export fb_var_JJ
		00000Ar 1  xx xx        fb_var_JJ:	.res 2	; String Array variable
		00000Cr 1               	.export fb_var____DEBUG_KEY
		00000Cr 1  xx xx        fb_var____DEBUG_KEY:	.res 2	; Word variable
		*/
		for (let i = 0; i < listLines.length; i++) {
			if (!listLines[i].endsWith(" variable")){continue;}
			
			let line = listLines[i];
			let varTypeStart = line.lastIndexOf("; ")+2;
			let varTypeEnd = line.length-9;
			let varStart = line.indexOf(" fb_var_")+8;
			let varEnd = line.indexOf(":", varStart);

			if (varTypeStart <2 || varTypeEnd<varTypeStart || varStart <8 || varEnd <varStart) {
				continue;
			}
			
			let name = line.substring(varStart, varEnd);
			if (name.startsWith("___DEBUG_"))  {
				continue;
			}

			let varTypeParts = line.substring(varTypeStart, varTypeEnd).split(" ");
			let varType = varTypeParts[0];
			
			// Determine the array length. If it's under 256, add the variable
			/* 
			000011r 1  08           	.byte	8
			000012r 1  rr           	.byte	TOK_DIM
			000013r 1  rr           	makevar	"C4"
			float:
			00003Ar 1  05           	.byte	5
			00003Br 1  rr           	.byte	TOK_MUL6
			00003Cr 1  rr           	.byte	TOK_DIM
			00003Dr 1  rr           	makevar	"A5"
			*/

			var value;

			// Determine byte length for this variable type
			var byteLen= VAR_TYPE_LEN.get(varType);
			if (!byteLen) {
				console.error(`Warning! unexpected variable type: ${varType} for var: ${name}`);
				continue;
			}
		
			if (varTypeParts.length>1 && varTypeParts[1] === "Array") {
				let makeVar = `makevar\t\"${name}\"`;
				
				for (let j = 2; j < listLines.length; j++) {
					if (listLines[j].endsWith(makeVar) && listLines[j-1].endsWith("TOK_DIM")) {
						let arraySize = parseInt(listLines[j-(varType === VAR_FLOAT ? 3 : 2)].split("\t").slice(-1)[0]);
						
						if (varType === VAR_WORD || varType === VAR_STRING) {
							arraySize /= 2;
						} 

						byteLen *= arraySize;

						if (arraySize < 256) {
							value = [];
							for(let k=0;k<arraySize;k++) {
								value.push(new RuntimeVariable(k.toString(), varType === VAR_STRING ? "":0, varType, 0));
							}
						}
						break;
					}
				}
			} else {
				value = varType === VAR_STRING ? "" : 0;
			}
			
				
		
			if (typeof value !== 'undefined') {

				if (varType === VAR_STRING) {
					name = name + "$";
				} else if (varType === VAR_FLOAT) {
					name = name + "%";
				}
		
				let v = new RuntimeVariable(name, value, varType, byteLen);
				this.variables.set(name, v);
			}
		}

		/* Reference
		al 002300 .fb_var_A
		al 002302 .fb_var_B
		al 002304 .fb_var_HW
		al 002306 .fb_var____DEBUG_KEY
		*/
		this._varMinLoc = 65536;
		this._varMemSize = 0;
		for (let i = 0; i < refsLines.length; i++) {
			let parts = refsLines[i].split('.');
			if (parts.length>1 && parts[1].startsWith("fb_var_")) {
				let name = parts[1].substring(7);
				let v = this.variables.get(name) || this.variables.get(name + "$") || this.variables.get(name + "%");
				if (v) {
					let memLoc = parseInt(parts[0].substring(5).trim(), 16);
					if (memLoc < this._varMinLoc) {
						this._varMinLoc = memLoc;
					}
					v.memLoc = memLoc;
					this._varMemSize += VAR_TYPE_LEN.get(v.type) || 0;
				}	
			}		
		}
		
		// Construct memory dump payload request
		let requestMemoryDump = new Uint8Array(1+4*(this.variables.size+1));

		requestMemoryDump[0] = 2;// Dump memory
		this.setAtariWord(requestMemoryDump, 1, this._varMinLoc);
		this.setAtariWord(requestMemoryDump, 3, this._varMemSize);
		let memDumpIndex = 5;
		this.variables.forEach(v => {
			if (v.memLoc && (v.type === VAR_STRING || Array.isArray(v.value)) ) {
				this.setAtariWord(requestMemoryDump, memDumpIndex, v.memLoc);
				this.setAtariWord(requestMemoryDump, memDumpIndex+2, v.byteLen);
				memDumpIndex+=4;
			} else {
				console.error(`Warning! memLoc not found for varible: ${v.name}`);
			}
		});
		
		// Write memory dump file
		await this.fileAccessor.writeFile(this._debugMemFile, requestMemoryDump);

		this.instructions = [];

		this.starts = [];
		this.instructions = [];
		this.ends = [];
/*
		for (let l = 0; l < this.sourceLines.length; l++) {
			this.starts.push(this.instructions.length);
			const words = this.getWords(l, this.sourceLines[l]);
			for (let word of words) {
				this.instructions.push(word);
			}
			this.ends.push(this.instructions.length);
		}
		*/
	}

	/**
	 * return true on stop
	 */
	 private findNextStatement(reverse: boolean, stepEvent?: string): boolean {

		for (let ln = this.currentLine; reverse ? ln >= 0 : ln < this.sourceLines.length; reverse ? ln-- : ln++) {

			// is there a source breakpoint?
			const breakpoints = this.breakPoints.get(this._sourceFile);
			if (breakpoints) {
				const bps = breakpoints.filter(bp => bp.line === ln);
				if (bps.length > 0) {

					// send 'stopped' event
					this.sendEvent('stopOnBreakpoint');

					// the following shows the use of 'breakpoint' events to update properties of a breakpoint in the UI
					// if breakpoint is not yet verified, verify it now and send a 'breakpoint' update event
					if (!bps[0].verified) {
						bps[0].verified = true;
						this.sendEvent('breakpointValidated', bps[0]);
					}

					this.currentLine = ln;
					return true;
				}
			}

			const line = this.getLine(ln);
			if (line.length > 0) {
				this.currentLine = ln;
				break;
			}
		}
		if (stepEvent) {
			this.sendEvent(stepEvent);
			return true;
		}
		return false;
	}

	/**
	 * "execute a line" of the readme markdown.
	 * Returns true if execution sent out a stopped event and needs to stop.
	 */
	private executeLine(ln: number, reverse: boolean): boolean {

		// first "execute" the instructions associated with this line and potentially hit instruction breakpoints
		while (reverse ? this.instruction >= this.starts[ln] : this.instruction < this.ends[ln]) {
			reverse ? this.instruction-- : this.instruction++;
			if (this.instructionBreakpoints.has(this.instruction)) {
				this.sendEvent('stopOnInstructionBreakpoint');
				return true;
			}
		}

		const line = this.getLine(ln);

		// find variable accesses
		let reg0 = /\$([a-z][a-z0-9]*)(=(false|true|[0-9]+(\.[0-9]+)?|\".*\"|\{.*\}))?/ig;
		let matches0: RegExpExecArray | null;
		while (matches0 = reg0.exec(line)) {
			if (matches0.length === 5) {

				let access: string | undefined;

				const name = matches0[1];
				const value = matches0[3];
/*
				let v = new RuntimeVariable(name, value);

				const accessType = this.breakAddresses.get(name);
				if (access && accessType && accessType.indexOf(access) >= 0) {
					this.sendEvent('stopOnDataBreakpoint', access);
					return true;
				}
				*/
			}
		}

		// if 'log(...)' found in source -> send argument to debug console
		const reg1 = /(log|prio|out|err)\(([^\)]*)\)/g;
		let matches1: RegExpExecArray | null;
		while (matches1 = reg1.exec(line)) {
			if (matches1.length === 3) {
				this.sendEvent('output', matches1[1], matches1[2], this._sourceFile, ln, matches1.index);
			}
		}

		// if pattern 'exception(...)' found in source -> throw named exception
		const matches2 = /exception\((.*)\)/.exec(line);
		if (matches2 && matches2.length === 2) {
			const exception = matches2[1].trim();
			if (this.namedException === exception) {
				this.sendEvent('stopOnException', exception);
				return true;
			} else {
				if (this.otherExceptions) {
					this.sendEvent('stopOnException', undefined);
					return true;
				}
			}
		} else {
			// if word 'exception' found in source -> throw exception
			if (line.indexOf('exception') >= 0) {
				if (this.otherExceptions) {
					this.sendEvent('stopOnException', undefined);
					return true;
				}
			}
		}

		// nothing interesting found -> continue
		return false;
	}

	private async readProgramResponse(): Promise<void> {

	}
	private async verifyBreakpoints(path: string): Promise<void> {
		
		// Wait for response
		await this.fileAccessor.waitUntilFileDoesNotExist(this._debugFileToEmu);

		// Parse response and update vars
		let debugFileResponse = await this.fileAccessor.readFile(this._debugFileFromEmu);

		let varIndex = 0;
		let heapIndex = this._varMemSize;

		// Parse incoming variable data and populate variables in debugger
		this.variables.forEach(v => {
			if (v.memLoc) {
				let typeLen = VAR_TYPE_LEN.get(v.type) || 1;
				let arrayLen = v.byteLen / typeLen;
				switch (v.type) {
					case VAR_WORD:
					case VAR_FLOAT:
					case VAR_STRING:
						if (arrayLen === 1) {
							varIndex = v.memLoc-this._varMinLoc;
							if (v.type === VAR_STRING) {
								 varIndex = heapIndex;
								 heapIndex+=typeLen;
							}
							v.value = this.getAtariValue(debugFileResponse, varIndex, v.type);

							break;
						}
					case VAR_BYTE:
						if (arrayLen === 0) {
							console.error(`Warning! array length of 0 found for var:${v.name}, type:${v.type}, byteLen:${v.byteLen}, typeLen:${typeLen}`);
							break;
						} 
						for(let i=0;i<arrayLen;i++) {
							v.value[i].value = this.getAtariValue(debugFileResponse, heapIndex, v.type);
							heapIndex += typeLen;
						}
						
						break;
				}	
				
				
				
			} 
		});

		const bps = this.breakPoints.get(path);
		if (bps) {
			await this.loadSource(path);
			bps.forEach(bp => {
				if (!bp.verified && bp.line < this.sourceLines.length) {
					const srcLine = this.getLine(bp.line);

					// if a line is empty or starts with '+' we don't allow to set a breakpoint but move the breakpoint down
					if (srcLine.length === 0 || srcLine.indexOf('+') === 0) {
						bp.line++;
					}
					// if a line starts with '-' we don't allow to set a breakpoint but move the breakpoint up
					if (srcLine.indexOf('-') === 0) {
						bp.line--;
					}
					// don't set 'verified' to true if the line contains the word 'lazy'
					// in this case the breakpoint will be verified 'lazy' after hitting it once.
					if (srcLine.indexOf('lazy') < 0) {
						bp.verified = true;
						this.sendEvent('breakpointValidated', bp);
					}
				}
			});
		}
	}

	private sendEvent(event: string, ... args: any[]): void {
		setTimeout(() => {
			this.emit(event, ...args);
		}, 0);
	}

	private normalizePathAndCasing(path: string) {
		if (this.fileAccessor.isWindows) {
			return path.replace(/\//g, '\\').toLowerCase();
		} else {
			return path.replace(/\\/g, '/');
		}
	}

	
	private setAtariWord(array:Uint8Array, index: number, value: number) {
		array[index] = value % 256;
		array[index+1] = value/256;
	}

	private getAtariValue(array:Uint8Array, index: number, type: string)  {
		switch (type) {
			case VAR_WORD : return array[index] + array[index+1]*256;
			case VAR_BYTE : return array[index];
			case VAR_FLOAT: return 12.34; // TODO - parsee Atari 6-byte BCD
			case VAR_STRING: return new TextDecoder().decode(array.slice(index+1,index+array[index]+1));
			default: return 0;
		}
	}
}
