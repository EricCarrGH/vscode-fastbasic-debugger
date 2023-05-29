/*---------------------------------------------------------
 * Copyright (C) Microsoft Corporation. All rights reserved.
 *--------------------------------------------------------*/

import { EventEmitter } from 'events';
import { fastBasicChannel } from './activateDebugger';
import * as cp from 'child_process';
import util = require('util');
const exec = util.promisify(require('child_process').exec);
import { GetEmulatorSettingsMac, GetEmulatorSettingsWin } from './emulatorSettingsFiles';

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
	public largeArray: boolean = false;

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

enum MessageCommand {
	continue = 1,
	stepNext = 2,
	jump = 3
} 

/**
 * When implementing your own debugger extension for VS Code, you probably don't need this
 * class because you can rely on some existing debugger or runtime.
 */
export class FastbasicRuntime extends EventEmitter {


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
	//private sourceLines: string[] = [];
	
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
	public breakPoints = new Map<string, IRuntimeBreakpoint[]>();

	private clearedBreakPoints = new Array<IRuntimeBreakpoint>();

	// since we want to send breakpoint events, we will assign an id to every event
	// so that the frontend can match events with breakpoints.
	private breakpointId = 1;

	private _addressToLineMap = new Map<number, number>();
	private _lineToAddressMap = new Map<number, number>();
	private _maxLine : number = 0;
  private _debugCheckAddress: number = 0;
	private _debugBreakAddress: number = 0;
	private _debugTokRET: number = 0;
	private _debugTokJUMP: number = 0;
	
	constructor(private fileAccessor: FileAccessor) {
		super();
	}

	public async startEmulator(command:string) : Promise<void> {
		if ('win32' !== process.platform) {
			await exec(`osascript -e 'quit app "Atari800MacX"'`);
		}
		exec(command);
	}
	/**
	 * Start executing the given program.
	 */
	public async start(program: string, noDebug: boolean, emulatorPath: string, executable: string): Promise<void> {
 
		let isWindows = 'win32' === process.platform;

		if (!noDebug) {
			// Load the source, which creates the memory dump file
			await this.loadSource(program);

			// Send initial message to start communication with the program before launching it
			await this.sendMessageToProgram(MessageCommand.continue);
		}

		// Build the emulator H: drive location
		let pathParts = executable.split('/');
		pathParts[pathParts.length-1] = "";
		let binLocation = pathParts.join('/');
		let settingsFilePath="";

		let emulatorCommand = "";

		if (isWindows) {
		
		emulatorCommand = `${emulatorPath} /portable /singleinstance /run "${executable.split("/").join("\\")}"`;
		
		 // Build the emulator settings file path
		pathParts = emulatorPath.split('/');
		pathParts[pathParts.length-1] = "Altirra.ini";
		settingsFilePath = pathParts.join('/');

		/* If settings file does not exist, create base settings file with settings that work well for debugging:
		- Setup H: device under path4
		- Direct3D 9 so resize does not cause issues
		- Auto enable Joystick for arrow keys
		- Disable confirmation on close
		- Disable pause when inactive
		*/
		if (! await this.fileAccessor.doesFileExist(settingsFilePath)) {
			let defaultIniContents = new TextEncoder().encode(GetEmulatorSettingsWin(binLocation));

			await this.fileAccessor.writeFile(settingsFilePath, defaultIniContents);
			await new Promise(resolve => setTimeout(resolve, 100));
		} else {

			// File exists, so update the path4 location
			let existingSettingsFile = new TextDecoder().decode(await this.fileAccessor.readFile(settingsFilePath));
			existingSettingsFile = existingSettingsFile.replace(/(^\s*"Devices".*?\\"path4\\":\s*\\")([^"]*?)(\\")/gmi, (g0,g1,g2,g3) => {
				return g1+binLocation+g3;
			});

			await this.fileAccessor.writeFile(settingsFilePath, new TextEncoder().encode(existingSettingsFile));
			await new Promise(resolve => setTimeout(resolve, 100));

		}
	} else {
		// Update settings for Atari800MacX
			
		// Build the emulator settings file path
		settingsFilePath = binLocation + 'atari800macx-settings.a8c';

		/* If settings file does not exist, create base settings file with settings that work well for debugging:
		- Setup H: device under path4
		- Auto enable Joystick for arrow keys
		*/
		//if (! await this.fileAccessor.doesFileExist(iniPath)) {
			let defaultIniContents = new TextEncoder().encode(GetEmulatorSettingsMac(binLocation, executable));
			await this.fileAccessor.writeFile(settingsFilePath, defaultIniContents);
			await new Promise(resolve => setTimeout(resolve, 100));
		// } else {

		// // File exists, so update the path4 location
		// let existingSettingsFile = new TextDecoder().decode(await this.fileAccessor.readFile(iniPath));
	  // existingSettingsFile = existingSettingsFile.replace(/(^\s*"Devices".*?\\"path4\\":\s*\\")([^"]*?)(\\")/gmi, (g0,g1,g2,g3) => {
		// 	return g1+binLocation+g3;
		// });

		// await this.fileAccessor.writeFile(iniPath, new TextEncoder().encode(existingSettingsFile));
		// await new Promise(resolve => setTimeout(resolve, 100));
		emulatorCommand = emulatorCommand.slice()
		emulatorCommand = `open "${emulatorPath}" -n --args "${settingsFilePath}"`;
	}
	
	
		await this.startEmulator(emulatorCommand);
	
		if (!noDebug) {
			// Wait for the program to initiate a breakpoint
			await this.waitOnProgram();
		}
	}


	

	/**
	 * Continue execution to the next breakpoint or end of program
	 */
	public async continue() {
		await this.sendMessageToProgram(MessageCommand.continue);
		await this.waitOnProgram();
	}

	/**
	 * Step forward to the next line.
	 */
	public async step() {
		await this.sendMessageToProgram(MessageCommand.stepNext);
		await this.waitOnProgram();
	}

	
	/**
	 * Jump to the line.
	 */
	public async jump(line : number) {
		await this.sendMessageToProgram(MessageCommand.jump, line);
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

		const bp: IRuntimeBreakpoint = { verified: true, line,  id: this.breakpointId++ };
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
				this.clearedBreakPoints.push(bp);
				return bp;
			}
		}
		return undefined;
	}

	public clearBreakpoints(path: string): void {
		const bps = this.breakPoints.get(this.normalizePathAndCasing(path));
		if (bps) {
			for (let i=0;i<bps.length;i++) {
				this.clearedBreakPoints.push(bps[i]);
			}
		}
		this.breakPoints.delete(this.normalizePathAndCasing(path));
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
			if (ext !== "bas" && ext !== "lst" && ext !== "fb") {
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

	private async initializeContents(memory: Uint8Array, list: Uint8Array, labels: Uint8Array) {
		//this.sourceLines = new TextDecoder().decode(memory).split(/\r?\n/);
		let listLines = new TextDecoder().decode(list).split(/\r?\n/);
		let labelLines = new TextDecoder().decode(labels).split(/\r?\n/);

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
			let isLargeArray = false;
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
						//Optimized compile: 
						let arraySize = parseInt(listLines[j-(varType === VAR_FLOAT ? 3 : 2)].split("\t").slice(-1)[0]);
					  //let arraySize = parseInt(listLines[j-(varType === VAR_FLOAT ? 5 : 5)].split("\t").slice(-1)[0])+1;
						
						/* Optimized compile*/
						if (varType === VAR_WORD || varType === VAR_STRING) {
							arraySize /= 2;
						}

						byteLen *= arraySize;
						value = [];
						if (arraySize < 256) {
							for(let k=0;k<arraySize;k++) {
								value.push(new RuntimeVariable(k.toString(), varType === VAR_STRING ? "":0, varType, Number(VAR_TYPE_LEN.get(varType))));
							}
						} else {
							value.push(new RuntimeVariable("0", arraySize - 1, varType, Number(VAR_TYPE_LEN.get(varType))));
							isLargeArray = true;
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
				v.largeArray = isLargeArray;
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
		this._maxLine = 0;
		for (let i = 0; i < labelLines.length; i++) {
	
			let parts = labelLines[i].split('.');
		
			if (parts.length>1) {

				// Get the memory location of debug_check proc, to:
				// 1. Toggle stepping through code at the start of the proc
				// 2. Set lines to call it when they don't have a breakpoint set
			  if (parts[1]==="fb_lbl____DEBUG_CHECK") {
					this._debugCheckAddress =  parseInt(parts[0].substring(5).trim(), 16);
				} 
				
				// Get the memory location of the debug_break proc, to:
				// 1. Set lines to call it when they have a breakpoint set
				else if (parts[1]==="fb_lbl____DEBUG_BREAK") {
					this._debugBreakAddress =  parseInt(parts[0].substring(5).trim(), 16);
				} 

				else if (parts[1]==="TOK_RET") {
					this._debugTokRET =  parseInt(parts[0].substring(6).trim(), 16);
					//this._debug_TOK_RET *= 257;
				} 
				else if (parts[1]==="TOK_JUMP") {
					this._debugTokJUMP =  parseInt(parts[0].substring(6).trim(), 16);
				} 
				 

				// Get the memory location of each line in memory, to:
				// 1. Determine which line the program stopped at
				// 2. Set/clear breakpoints on line
				else if (parts[1].startsWith("@FastBasic_LINE_")) {
					let line = parseInt(parts[1].slice(16).split('_')[0]);
					if (line<= listLines.length) {
						let memLoc = parseInt(parts[0].substring(5).trim(), 16);
						var existingLine =  Number(this._addressToLineMap.get(memLoc) ?? 0);
						if (existingLine<line) {
							this._addressToLineMap.set(memLoc, line);//remove the +1 later
							this._lineToAddressMap.set(line, memLoc);
							if (line> this._maxLine) {
								this._maxLine = line;
							}
						}
					}
				} else if (parts[1].startsWith("fb_var_")) {
					let name = parts[1].substring(7);
					
					let v = this.variables.get(name) || this.variables.get(name + "$") || this.variables.get(name + "%");
					if (v) {
						let memLoc = parseInt(parts[0].substring(5).trim(), 16);
						if (memLoc < this._varMinLoc) {
							this._varMinLoc = memLoc;
						}
						v.memLoc = memLoc;
						if (v.type !== VAR_STRING) {
							this._varMemSize += VAR_TYPE_LEN.get(v.type) || 0;
						}
					}	
				}
			}		
		}

		// Confirm we found all locations
		if (this._debugCheckAddress===0) {
			fastBasicChannel.appendLine(`fb_lbl____DEBUG_CHECK not found. Aborting!`);
			this.sendEvent('end');
			return;
		}
		
		if (this._debugBreakAddress===0) {
			fastBasicChannel.appendLine(`fb_lbl____DEBUG_BREAK not found. Aborting!`);
			this.sendEvent('end');
			return;
		}

		// Construct memory dump payload request
		let requestMemoryDump = new Uint8Array(4*(this.variables.size+1));
		this.setAtariWord(requestMemoryDump, 0, this._varMinLoc);
		this.setAtariWord(requestMemoryDump, 2, this._varMemSize);
		let memDumpIndex = 4;

		// Sort var list for easier visual lookup of variables
		let sortedVars = [...this.variables].sort((a,b) => a[0] > b[0] ? 1 : -1);

		// Generate memory dump request
		sortedVars.forEach(rv => {
			let v = rv[1];
				if(v.type === VAR_STRING || Array.isArray(v.value))  {
					this.setAtariWord(requestMemoryDump, memDumpIndex, v.memLoc);
					this.setAtariWord(requestMemoryDump, memDumpIndex+2, v.largeArray ? 2 : v.byteLen);
					memDumpIndex+=4;
				}
		});

		// Set variable map to sorted list (better user experience)
		this.variables = new Map(sortedVars);
		
		requestMemoryDump = requestMemoryDump.slice(0,memDumpIndex);

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
			// Flip the two bytes around since they were in backwards on the stack
			[debugFileResponse[1], debugFileResponse[2]] = [debugFileResponse[2], debugFileResponse[1]];

			let address = Number(this.getAtariValue(debugFileResponse, 1, VAR_WORD))-3;
			let currentLine = this._addressToLineMap.get(address) ?? 1;
			let varIndex = 0;
			let startingLoc = this._varMinLoc - 3;
			let heapIndex = this._varMemSize + 3;
	
			// Parse incoming variable data and populate variables in debugger
			this.variables.forEach(v => {
				
				let typeLen = VAR_TYPE_LEN.get(v.type) || 1;
				let arrayLen = v.byteLen / typeLen;
				if (v.largeArray) {
					// Get the real memory location for this large array
					v.memLoc = Number(this.getAtariValue(debugFileResponse, heapIndex, VAR_WORD)); 
					heapIndex+=4;
					return;
				}
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
							v.setValueFromSource(this.getAtariValue(debugFileResponse, varIndex, v.type));

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

	private async sendMessageToProgram(command: MessageCommand, jumpTo: number = 0): Promise<void> {
		const bps = this.breakPoints.get(this._sourceFile) ?? new Array<IRuntimeBreakpoint>();
		
		// If first line has a breakpoint set, and we are starting, change to step
		if (this.currentLine<=1 && bps.find(o=> o.line === 1)) {
			command = MessageCommand.stepNext;
		}

		let payload = new Uint8Array(16000);
	
		/* Payload format:
		[byte] Message/command
			[word] Jump To location if command is jump (3)
		[word] Location/Value pair count
			[word:location][word:value] pair (used to set/clear breakpoints)
			..
		[word:location][word:length][data] sets (read until EOF)
		*/
		
		payload[0] = command; // Let the program know our intent
		let index = 1;

		// Set the appropriate memory location for stepping:
		// If jump to was specified on a line that is invalid, keep checking subsequent lines until one is found
		if (jumpTo>0) {
			let newLineAddress = 0;
			for (let jumpLine = jumpTo;jumpLine<=this._maxLine; jumpLine++) {
				newLineAddress = this._lineToAddressMap.get(jumpLine) || 0;
				if (newLineAddress>0) {
					break;
				}
			}

			if (newLineAddress) {
				this.setAtariWord(payload, index, newLineAddress);
			  [payload[index], payload[index+1]] = [payload[index+1], payload[index]];
				index+=2;
			}
		}

		let countIndex = index, locValCount = 0;
		index+=2;

		// Clear breakpoints
		for (let i=0;i<this.clearedBreakPoints.length;i++) {
			let lineAddress = this._lineToAddressMap.get(this.clearedBreakPoints[i].line);
			if (lineAddress) {
				this.setAtariWord(payload,index, lineAddress+1);
				this.setAtariWord(payload,index+2, this._debugCheckAddress);
				index+=4; locValCount++;
			}
		}

		// Add breakpoints
		for (let i=0;i<bps.length;i++) {
			let lineAddress = this._lineToAddressMap.get(bps[i].line);
			if (lineAddress) {
				this.setAtariWord(payload,index, lineAddress+1);
				this.setAtariWord(payload,index+2, this._debugBreakAddress);
				index+=4; locValCount++;
			}
		}

		// Empty the list of cleared, now that the program will have the latest results.
		this.clearedBreakPoints = [];
		
		// Set the number of [word:location][word:value] pairs that were added
		this.setAtariWord(payload, countIndex, locValCount);


		// Update __DEBUG_CHECK TOKen to either return or jump to the break proc, in form of [word:location][word:length][data]		
		this.setAtariWord(payload,index, this._debugCheckAddress);

		if (command === MessageCommand.continue) {
			this.setAtariWord(payload,index+2, 1);
			payload[index+4] = this._debugTokRET;
			index+=5;
		} else {
			this.setAtariWord(payload,index+2, 3);
			payload[index+4] = this._debugTokJUMP;
			this.setAtariWord(payload, index+5, this._debugBreakAddress);
			index+=7;
		}

		// Send any variables to update in form of [word:location][word:length][data]		
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
