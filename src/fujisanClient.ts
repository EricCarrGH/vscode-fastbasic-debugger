/**
 * Client for the Fujisan emulator's TCP server.
 * When you choose emulatorType "fujisan", the debugger talks to Fujisan over TCP to
 * deploy the XEX, set H4:, and trigger a cold boot. Breakpoints and variables still
 * go through the H4: host drive (debug.in, debug.out, debug.mem) like with other emulators.
 */

import * as net from 'net';

export interface FujisanResponse {
	type: 'response' | 'event';
	status?: 'success' | 'error';
	id?: string;
	result?: unknown;
	error?: string;
	event?: string;
	data?: unknown;
}

export interface FujisanCommand {
	command: string;
	id?: string;
	params?: unknown;
}

export class FujisanClient {
	private static readonly CONNECTION_TIMEOUT_MS = 5000;
	private static readonly REQUEST_TIMEOUT_MS = 10000;

	private client: net.Socket | null = null;
	private connected: boolean = false;
	private requestId: number = 0;
	private pendingRequests: Map<string, (response: FujisanResponse) => void> = new Map();
	private buffer: string = '';

	constructor(private host: string = 'localhost', private port: number = 6502) {
	}

	/**
	 * Connect to Fujisan's TCP server. Call this before sending any commands.
	 * Fails with an error if the connection fails or times out (5 seconds).
	 */
	public async connect(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.client = new net.Socket();

			const timeoutHandle = setTimeout(() => {
				if (!this.connected) {
					this.client?.destroy();
					reject(new Error('Connection timeout'));
				}
			}, FujisanClient.CONNECTION_TIMEOUT_MS);

			this.client.connect(this.port, this.host, () => {
				this.connected = true;
				clearTimeout(timeoutHandle);
				resolve();
			});

			this.client.on('data', (data) => {
				this.handleData(data.toString());
			});

			this.client.on('error', (error) => {
				if (!this.connected) {
					clearTimeout(timeoutHandle);
					reject(error);
				} else {
					console.error('Fujisan TCP error:', error);
					this.connected = false;
					this.pendingRequests.forEach((handler) => {
						handler({ type: 'response', status: 'error', error: 'Connection lost' });
					});
					this.pendingRequests.clear();
				}
			});

			this.client.on('close', () => {
				this.connected = false;
			});
		});
	}

	/** Close the connection to Fujisan. Safe to call even if already disconnected. */
	public disconnect(): void {
		if (this.client) {
			this.client.destroy();
			this.client = null;
			this.connected = false;
		}
	}

	/** True if we're still connected to the TCP server. */
	public isConnected(): boolean {
		return this.connected;
	}

	private handleData(data: string): void {
		this.buffer += data;

		const lines = this.buffer.split('\n');
		this.buffer = lines.pop() || '';

		for (const line of lines) {
			if (line.trim()) {
				try {
					const response: FujisanResponse = JSON.parse(line);
					this.handleResponse(response);
				} catch (error) {
					console.error('Bad JSON from Fujisan:', line, error);
				}
			}
		}
	}

	private handleResponse(response: FujisanResponse): void {
		if (response.type === 'response' && response.id) {
			const handler = this.pendingRequests.get(response.id);
			if (handler) {
				handler(response);
				this.pendingRequests.delete(response.id);
			}
		}
	}

	/**
	 * Send a command and wait for the response.
	 * @param command e.g. 'config.set_hard_drive', 'system.cold_boot', 'media.load_xex'
	 * @param params optional payload for the command
	 */
	public async sendCommand(command: string, params?: unknown): Promise<unknown> {
		if (!this.connected) {
			throw new Error('Not connected to Fujisan. Start Fujisan and turn on the TCP server (Tools → TCP Server).');
		}

		const id = `req-${++this.requestId}`;
		const request: FujisanCommand = {
			command,
			id,
			params
		};

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(id, (response) => {
				if (response.status === 'error') {
					const errorMsg = response.error || 'Unknown error';
					reject(new Error(errorMsg));
				} else {
					resolve(response.result);
				}
			});

			const message = JSON.stringify(request) + '\n';
			this.client!.write(message);

			setTimeout(() => {
				if (this.pendingRequests.has(id)) {
					this.pendingRequests.delete(id);
					reject(new Error('Fujisan did not respond in time'));
				}
			}, FujisanClient.REQUEST_TIMEOUT_MS);
		});
	}

	/** Perform a full cold boot in Fujisan. */
	public async coldBoot(): Promise<unknown> {
		return this.sendCommand('system.cold_boot');
	}

	/** Perform a warm boot in Fujisan. */
	public async warmBoot(): Promise<unknown> {
		return this.sendCommand('system.warm_boot');
	}

	/** Stop the FujiNet-PC process managed by Fujisan. */
	public async stopFujiNet(): Promise<unknown> {
		return this.sendCommand('system.stop_fujinet');
	}

	/** Start the FujiNet-PC process with Fujisan's saved settings. */
	public async startFujiNet(): Promise<unknown> {
		return this.sendCommand('system.start_fujinet');
	}

	/**
	 * Configure H4: hard drive mapping via TCP.
	 * @param path Absolute path to the folder to map to H4:
	 * @param drive Drive number (default: 4 for H4:)
	 */
	public async setHardDrive(path: string, drive: number = 4): Promise<unknown> {
		return this.sendCommand('config.set_hard_drive', { drive, path });
	}

	/** Load a XEX file into the emulator. path is the full path to the .xex file. */
	public async loadXex(path: string): Promise<unknown> {
		return this.sendCommand('media.load_xex', { path });
	}

	/**
	 * Reserved for when Fujisan adds a debug-specific load (e.g. with symbols).
	 * Right now we just use loadXex() for both run and debug.
	 */
	public async loadXexForDebug(path: string): Promise<unknown> {
		return this.sendCommand('debug.load_xex_for_debug', { path });
	}

	/** Query current emulator state (for future use). */
	public async getState(): Promise<unknown> {
		return this.sendCommand('status.get_state');
	}
}
