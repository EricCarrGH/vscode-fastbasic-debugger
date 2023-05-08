/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { EventEmitter } from 'events';
import { fastBasicChannel } from './activateMockDebug';
import * as cp from 'child_process';

export interface FileAccessor {
	isWindows: boolean;
	readFile(path: string): Promise<Uint8Array>;
	writeFile(path: string, contents: Uint8Array): Promise<void>;
	waitUntilFileDoesNotExist(path: string, timeoutMs?: number) :Promise<boolean>;
	waitUntilFileExists(path: string, timeoutMs?: number) :Promise<boolean>
	doesFileExist(path: string) :Promise<boolean>;
	deleteFile(path: string) : Promise<void>;
	
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

export type IRuntimeVariableType = number  | string | RuntimeVariable[];

export class RuntimeVariable {
	public reference?: number;

	public memLoc: number = 0;
	public modified: boolean = false;

	public get value() {
		return this._value;
	}

	public set value(value: IRuntimeVariableType) {
		this._value = value;
		this.modified = true;
	}

	public setValueFromSource(value : IRuntimeVariableType) {
		this._value = value;
	}


	constructor(public readonly name: string, private _value: IRuntimeVariableType, public readonly type: string, public readonly byteLen: number) {}
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

	private _debugFileToProg: string = '';
	private _debugFileFromProg: string = '';
	private _debugMemFile: string='';

	private _varMemSize: number = 0; // Size
	private _varMinLoc: number = 0;

	private variables = new Map<string, RuntimeVariable>();
	
	// the contents (= lines) of the one and only file
	private sourceLines: string[] = [];
	
	// This is the next line that will be 'executed'
	private _currentLine = 0;
	private get currentLine() {
		return this._currentLine;
	}
	private set currentLine(x) {
		this._currentLine = x;
	}

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

	constructor(private fileAccessor: FileAccessor) {
		super();
	}

	/**
	 * Start executing the given program.
	 */
	public async start(program: string, stopOnEntry: boolean, debug: boolean, emulatorPath: string, executable: string): Promise<void> {
 
		fastBasicChannel.appendLine(`Compiled successfully - running in emulator..`);

		// Load and parse the symbols if debugging
		if (debug) {
			// Load the source, which creates the memory dump file
			await this.loadSource(program);
			// Send breakpoints to start communication with the program before launching it
			await this.sendBreakpointsAndVars(1);
		}

			// send 'stopped' event
		//	this.findNextStatement(false, 'stopOnEntry');
			//return;
			//this.sendEvent('stopOnBreakpoint');

		// Run the program in the emulator
		cp.execFile(`${emulatorPath}`,["/singleinstance","/run", executable ], (err, stdout) => {
			if (err) {
				fastBasicChannel.appendLine(err.message);//.substring(err.message.indexOf("\n")));
			}
			fastBasicChannel.appendLine(stdout);
		});
		
		// Wait for the program to initiate a breakpoint
		await this.waitOnProgram();
	}


	/**
	 * Continue execution to the next breakpoint or end of program
	 */
	public async continue() {
		await this.sendBreakpointsAndVars(1);
		await this.waitOnProgram();
	}

	/**
	 * Step forward to the next line.
	 */
	public async step() {
		await this.sendBreakpointsAndVars(2);
		await this.waitOnProgram();
	}

	/**
	 * Just put the current line number for now
	 */
	public stack(startFrame: number, endFrame: number): IRuntimeStack {
		const frames: IRuntimeStackFrame[] = [{
			index: 0,
			name: `Line ${this.currentLine}`,
			file: this._sourceFile,
			line: this.currentLine
		}];

		return {
			frames: frames,
			count: 1
		};
	}

	/*
	 * Set breakpoint in file with given line.
	 */
	public async setBreakPoint(path: string, line: number): Promise<IRuntimeBreakpoint> {
		path = this.normalizePathAndCasing(path);

		const bp: IRuntimeBreakpoint = { verified: true, line, id: this.breakpointId++ };
		let bps = this.breakPoints.get(path);
		if (!bps) {
			bps = new Array<IRuntimeBreakpoint>();
			this.breakPoints.set(path, bps);
		}
		bps.push(bp);
		this.sendEvent('breakpointValidated', bp);
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


	// private methods


	private async loadSource(file: string): Promise<void> {
		file = this.normalizePathAndCasing(file);
		if (this._sourceFile !== file) {
			this._sourceFile = file;
			
			let ext  = file.split(".").splice(-1)[0].toLowerCase();
			if (ext !== "bas" && ext !== "lst") {
				return;
			}

			//file = file.replace("readme.md", "test.bas");

			let isWindows = 'win32' === process.platform;
			var folderDelimiter = isWindows ? "\\" : "/";

			let symbolFileParts = file.split(folderDelimiter);
			symbolFileParts[symbolFileParts.length-1] ="bin" + folderDelimiter + symbolFileParts[symbolFileParts.length-1].split(".",1)[0];
			let symbolFile = symbolFileParts.join(folderDelimiter);

			symbolFileParts[symbolFileParts.length-1] ="bin" + folderDelimiter + "debug.";
			this._debugFileToProg= symbolFileParts.join(folderDelimiter) + "in";
			this._debugFileFromProg = symbolFileParts.join(folderDelimiter) + "out";
			this._debugMemFile = symbolFileParts.join(folderDelimiter) + "mem";

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
								value.push(new RuntimeVariable(k.toString(), varType === VAR_STRING ? "":0, varType, Number(VAR_TYPE_LEN.get(varType))));
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
		let requestMemoryDump = new Uint8Array(4*(this.variables.size+1));
		this.setAtariWord(requestMemoryDump, 0, this._varMinLoc);
		this.setAtariWord(requestMemoryDump, 2, this._varMemSize);
		let memDumpIndex = 4;
		Array.from(this.variables.keys()).forEach(key => {
			let v = this.variables.get(key);
			if (v) {
				if(v.type === VAR_STRING || Array.isArray(v.value))  {
					this.setAtariWord(requestMemoryDump, memDumpIndex, v.memLoc);
					this.setAtariWord(requestMemoryDump, memDumpIndex+2, v.byteLen);
					memDumpIndex+=4;
				}
			} else {
				this.variables.delete(key);
			}
		});
		
		// Write memory dump file
		await this.fileAccessor.writeFile(this._debugMemFile, requestMemoryDump);
	}


	private async waitOnProgram(): Promise<void> {

		// Wait for response
		await this.fileAccessor.waitUntilFileDoesNotExist(this._debugFileToProg);
    
		// Parse response and update vars
		let debugFileResponse = await this.fileAccessor.readFile(this._debugFileFromProg);

		let packetType = debugFileResponse[0];

		switch (packetType) {
			case 9:
				this.sendEvent('end');
				break;
			case 1:
			let currentLine = this.getAtariValue(debugFileResponse, 1, VAR_WORD) ;
			let varIndex = 0;
			let startingLoc = this._varMinLoc - 3;
			let heapIndex = this._varMemSize + 3;
	
			// Parse incoming variable data and populate variables in debugger
			this.variables.forEach(v => {
				
				let typeLen = VAR_TYPE_LEN.get(v.type) || 1;
				let arrayLen = v.byteLen / typeLen;
				switch (v.type) {
					case VAR_WORD:
					case VAR_FLOAT:
					case VAR_STRING:
						if (arrayLen === 1) {
							varIndex = v.memLoc-startingLoc;
							if (v.type === VAR_STRING) {
								// Update real memory location for this string in case user wants to update it
								v.memLoc = Number(this.getAtariValue(debugFileResponse, heapIndex, VAR_WORD)); 
								heapIndex+=2;
								varIndex = heapIndex;
								heapIndex+=typeLen;
							}
							v.setValueFromSource(this.getAtariValue(debugFileResponse, varIndex, v.type))

							break;
						}
					case VAR_BYTE:
						if (arrayLen === 0) {
							console.error(`Warning! array length of 0 found for var:${v.name}, type:${v.type}, byteLen:${v.byteLen}, typeLen:${typeLen}`);
							break;
						} 
						
						// Update real memory location for this array in case user wants to update it
						v.memLoc = Number(this.getAtariValue(debugFileResponse, heapIndex, VAR_WORD)); 
						heapIndex+=2;
						if (Array.isArray(v.value)) {
							for(let i=0;i<arrayLen;i++) {
								if (v.type === VAR_STRING) {
									// Update real memory location for each string in the array in case user wants to update it
									v.value[i].memLoc = Number(this.getAtariValue(debugFileResponse, heapIndex, VAR_WORD)); 
									heapIndex+=2;
								} else {
									if (v.memLoc>0) {
										v.value[i].memLoc = v.memLoc + i*v.value[i].byteLen;
									}
								}
								
								v.value[i].setValueFromSource(this.getAtariValue(debugFileResponse, heapIndex, v.type));
								heapIndex += typeLen;
							}
						}
						
						break;
				} 
			});
			// send 'stopped' event
			if (typeof currentLine === "number") {
				this.currentLine = currentLine;
			}
			this.sendEvent('stopOnBreakpoint');	
			break;
		}	
	}

	private async sendPayloadToProgram(payload: Uint8Array) {
		// Send payload to program
		await this.fileAccessor.writeFile(this._debugFileToProg, payload);

		// Delete program's payload to us to trigger our payload is ready
		await this.fileAccessor.deleteFile(this._debugFileFromProg);
	}

	private async sendBreakpointsAndVars(messageMode: number): Promise<void> {
		const bps = this.breakPoints.get(this._sourceFile) ?? new Array<IRuntimeBreakpoint>();
		
		let payload = new Uint8Array(16000);
		
		
		payload[0] = messageMode;// Send Breakpoints and vars
		payload[1] = bps.length;// Number of breakpoints

		for (let i=0;i<bps.length;i++) {
			this.setAtariWord(payload,2+i*2, bps[i].line);
		}

		// Send any variables to update in form of [word:location][word:length][data]
		let index = 2+2*bps.length;
		
		this.variables.forEach(v => {
			if (v.memLoc && v.modified) {
				v.modified = false;
				if(Array.isArray(v.value))  {
					v.value.forEach(va => {
						if (va.modified) {
							va.modified=false;
					
							this.setAtariWord(payload, index, va.memLoc);
							let len = this.setAtariValue(payload, index+4, va.type, va.value); 
							this.setAtariWord(payload, index+2, len);
							index+=4+len;
						}
					});
				} else {
					this.setAtariWord(payload, index, v.memLoc);
					let len = this.setAtariValue(payload, index+4, v.type, v.value); 
					this.setAtariWord(payload, index+2, len);
					index+=4+len;
				}
				
			} 
		});

		payload = payload.slice(0,index);
		// Write payload
		await this.sendPayloadToProgram(payload);
	}

	private sendEvent(event: string, ... args: any[]): void {
		setTimeout(() => {
			this.emit(event, ...args);
		}, 0);
	}

	private normalizePathAndCasing(path: string) {
		if ('win32' === process.platform) {
			return path.replace(/\//g, '\\').toLowerCase();
		} else {
			return path.replace(/\\/g, '/');
		}
	}

	
	private setAtariWord(array:Uint8Array, offset: number, value: number) {
		array[offset] = value % 256;
		array[offset+1] = value/256;
	}

	private getAtariValue(array:Uint8Array, offset: number, type: string)  {
		switch (type) {
			case VAR_WORD : return array[offset] + array[offset+1]*256;
			case VAR_BYTE : return array[offset];
			case VAR_FLOAT: 
				// Parse Atari 6-byte BCD
				let value = '';
				for (let i=1;i<6;i++) {
					if (array[offset+i]<=9) {value +='0';}
					value += array[offset+i].toString(16);
				}
				// Add decimal point
				value = value.substring(0,2) + '.' + value.substring(2);

				// Negative value?
				if (array[offset] & 0x80) {value ='-' + value;}

				// Add Exponent
				value+="e" + 2*((array[offset] & 0x7F)-0x40);

				return parseFloat(value);
				
			case VAR_STRING: return new TextDecoder().decode(array.slice(offset+1,offset+array[offset]+1));
			default: return 0;
		}
	}

	private setAtariValue(array:Uint8Array, offset: number, type: string, value) : number {
		switch (type) {
			case VAR_WORD : 
				array[offset] = Number(value) % 256;
				array[offset+1] = Number(value)/256;
				return 2;
			case VAR_BYTE : 
				array[offset] = Number(value) % 256;
				return 1;
			case VAR_FLOAT: 
				// Store Atari 6-byte BCD

				// Convert to e notation
				let val = value.toExponential(9).toLowerCase();
				let negative = false;

				// Strip negative sign and decimal from the number
				if (val[0]==='-') { negative=true; val=val.slice(1);}
				val = val[0] + val.slice(2);

				// Shift value/exponent if neccessary
				let exponent = parseInt(val.slice(11))-1;
				if (exponent % 2 !== 0) {
					val = '0' + val.slice(0,9);
					exponent++;
				}

				// Set sign/exponent byte
				array[offset] = (negative ? 0x80 : 0) + 0x40+(exponent/2);

				// Set 5 number bytes
				for (let i=0;i<5;i++) {
					array[offset+1+i] = parseInt(val.slice(i*2,i*2+2), 16);
				}
				
				return 6; 
			case VAR_STRING: 
				array[offset] = String(value).length;
				array.set(new TextEncoder().encode(String(value)), offset+1);
				return array[offset]+1;
			default: return 0;
		}
	}

	/*
	Atari BCD notes:
	00 00 00 00 00 00
  Cn - Negative
	4n - Positive
   N - decimal position
	40 10 00 00 00 00 = 10
	41 10 00 00 00 00 = 1000
	42 10 00 00 00 00 = 100000
	40 12 34 ..       = 12.34
	41 12 34 ..       = 1234
	40 01 23 ..       =  1.23
	41 01 23 ..       =  123
  3F 01 23 ..       =  .0123 or 1.23E-2
	3E 01 23 ..       =  .000123 or 1.23-4
	3F 12 30 ..       =  .123 or 1.23E-1
	3E 12 30 ..       =  .00123 or 1.23E-3
	First byte:
	[Sign] [Exponent sign] [ E-N*2]
	
	so, First byte = (0x80 or 128) if negative + (0x40 or 64) + (Exponent/2)
	*/
}
